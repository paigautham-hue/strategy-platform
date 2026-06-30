/**
 * geminiRealtime.ts — Gemini Live session minting for Cairn voice.
 *
 * Cairn's DEFAULT voice engine. Mints a SHORT-LIVED Gemini Live ephemeral
 * token server-side (the raw Google key never reaches the browser) and
 * assembles the client `setup` payload (model, AUDIO response modality,
 * voice, the compact Cairn system instruction, and a Gemini-shaped version
 * of the read-only lookup tools). The client connects over WebSocket using
 * the returned token (see client/src/lib/geminiLiveEngine.ts).
 *
 * Auth model (mirrors realtime.ts / the OpenAI path):
 *   - Attempt an ephemeral-token mint: POST v1alpha/auth-tokens with
 *     x-goog-api-key and { config: { uses: 1, expireTime, newSessionExpireTime } }.
 *   - On ANY failure (network, non-2xx, missing token, kill switch, no key)
 *     fall back to the RAW key + authMethod 'raw' + the v1beta endpoint.
 *   - Kill switch GEMINI_USE_EPHEMERAL_TOKENS=false forces the raw path.
 *
 * REUSE (C13/C17): buildVoiceSystemPrompt, REALTIME_TOOLS,
 * checkVoiceRateLimit, and acquireVoiceLock are imported from ./realtime so
 * both providers share the SAME compact prompt, the SAME read-only tool
 * names/params (so executeTool needs no per-provider branch), and the SAME
 * per-user guards. We only translate the tool SHAPE to Gemini's
 * functionDeclaration format here.
 *
 * Transport note (C16, corrected): Gemini Live is WebSocket-native, PCM16
 * 16kHz in / 24kHz out — the Meridian iOS-proven choice (WebRTC dropped
 * audio on iOS WKWebView). See docs/CLAUDE.md C16.
 */

import { ENV } from "./env";
import {
  REALTIME_TOOLS,
  checkVoiceRateLimit,
  acquireVoiceLock,
  releaseVoiceLock,
} from "./realtime";

// Re-export the shared guards so a caller can lock/release via either
// module without reaching past this one (createSession imports the OpenAI
// guards already; these are here for symmetry + future Gemini-only callers).
export { checkVoiceRateLimit, acquireVoiceLock, releaseVoiceLock };

export type VoiceProvider = "gemini" | "openai";

// Gemini Live model — matches Meridian's production model. Both the
// standard and (currently disabled) native-audio modes resolve to this id.
export const GEMINI_LIVE_MODEL = "gemini-3.1-flash-live-preview";
// Default prebuilt Gemini voice.
export const GEMINI_DEFAULT_VOICE = "Kore";
// Allowed Gemini prebuilt voices (validated here, NOT in the Zod input, so
// the shared createSession voice param can stay provider-agnostic).
export const GEMINI_VOICES = [
  "Kore",
  "Puck",
  "Charon",
  "Fenrir",
  "Aoede",
  "Leda",
  "Orus",
  "Zephyr",
] as const;

// Ephemeral-token mint endpoint + lifetimes (ported from Meridian's
// geminiEphemeralToken.ts). 30-min expiry is the security ceiling; the
// boundary is expireTime + uses:1 (no model/voice/tool pinning — an
// unconstrained token avoids coupling the mint payload to the client setup
// shape, the PR #184 class of "unknown field rejected the handshake" bug).
const MINT_API_URL =
  "https://generativelanguage.googleapis.com/v1alpha/auth-tokens";
const EXPIRE_MS = 30 * 60 * 1000;
const NEW_SESSION_EXPIRE_MS = 30 * 60 * 1000;

/**
 * Resolve the Google API key. Prefer ENV.geminiApiKey (added to env.ts),
 * then tolerate the raw process.env names Meridian uses so a shared
 * deployment env keeps working.
 */
function resolveGoogleKey(): string {
  // `ENV.geminiApiKey` is added to env.ts in the integration step; read it
  // defensively so this module type-checks before that edit lands and still
  // prefers the typed ENV field once it exists.
  const fromEnv = (ENV as { geminiApiKey?: string }).geminiApiKey ?? "";
  return (
    fromEnv ||
    process.env.GOOGLE_GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GEMINI_API_KEY ||
    ""
  );
}

/**
 * Translate the shared OpenAI-shaped REALTIME_TOOLS into Gemini Live
 * functionDeclarations. The tool NAMES and parameter schemas stay identical
 * so server-side executeTool is shared verbatim (C13). We only:
 *   - drop the OpenAI-only `type: "function"` wrapper,
 *   - strip `additionalProperties` (Gemini's schema validator rejects it),
 *   - default an empty-object parameters block when a tool takes no args.
 */
export function buildGeminiFunctionDeclarations(): Array<{
  name: string;
  description: string;
  parameters: Record<string, any>;
}> {
  const stripSchema = (schema: any): Record<string, any> => {
    if (!schema || typeof schema !== "object") {
      return { type: "object", properties: {} };
    }
    const { additionalProperties: _drop, ...rest } = schema;
    const out: Record<string, any> = { ...rest };
    if (!out.type) out.type = "object";
    if (out.type === "object" && !out.properties) out.properties = {};
    return out;
  };

  return REALTIME_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: stripSchema(t.parameters),
  }));
}

/**
 * Build the Gemini Live `setup` payload the client sends as its first WS
 * frame. The engine splices in `model: models/<model>` + the
 * session-resumption handle; everything else is assembled here so the
 * client stays a dumb transport.
 */
export function buildGeminiSetup(opts: {
  model: string;
  voice: string;
  systemPrompt: string;
}): Record<string, any> {
  return {
    model: opts.model,
    generationConfig: {
      responseModalities: ["AUDIO"],
      // Lower temperature for voice — keeps replies focused and on-task.
      temperature: 0.7,
      thinkingConfig: { thinkingLevel: "low" },
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: opts.voice || GEMINI_DEFAULT_VOICE },
        },
      },
      mediaResolution: "MEDIA_RESOLUTION_LOW",
    },
    systemInstruction: { parts: [{ text: opts.systemPrompt }] },
    realtimeInputConfig: {
      // 'reflective' default VAD: patient turn-taking for a thinking
      // partner. LOW sensitivity + 1200ms silence so the strategist can
      // pause mid-thought without the bot jumping in.
      automaticActivityDetection: {
        disabled: false,
        startOfSpeechSensitivity: "START_SENSITIVITY_LOW",
        endOfSpeechSensitivity: "END_SENSITIVITY_LOW",
        silenceDurationMs: 1200,
        prefixPaddingMs: 300,
      },
      activityHandling: "START_OF_ACTIVITY_INTERRUPTS",
      turnCoverage: "TURN_INCLUDES_ONLY_ACTIVITY",
    },
    // MUST be bare {} — Gemini rejects a languageCode on these.
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    // Context window compression — critical for sessions > ~2 min (audio
    // tokens accumulate at ~25 tokens/sec).
    contextWindowCompression: { slidingWindow: { targetTokens: 16000 } },
    tools: [{ functionDeclarations: buildGeminiFunctionDeclarations() }],
  };
}

export interface MintedGeminiSession {
  /** Ephemeral token (v1alpha) or the raw key (v1beta fallback). */
  token: string;
  /** Which WS endpoint + query param the client must use. */
  authMethod: "ephemeral" | "raw";
  model: string;
  voice: string;
  /** API version implied by authMethod — purely informational for the client. */
  apiVersion: "v1alpha" | "v1beta";
  /** Full client setup payload (model, generationConfig, systemInstruction, tools, …). */
  setup: Record<string, any>;
}

/**
 * Mint a Gemini Live session. Attempts an ephemeral token; on ANY failure
 * gracefully returns the raw key with authMethod 'raw' (v1beta). Throws
 * only when NO Google key is configured at all (an environment error the
 * caller surfaces).
 */
export async function mintGeminiLiveSession(opts: {
  systemPrompt: string;
  voice?: string;
}): Promise<MintedGeminiSession> {
  const apiKey = resolveGoogleKey();
  if (!apiKey) {
    throw new Error(
      "Gemini Live voice is not configured — GOOGLE_GEMINI_API_KEY required.",
    );
  }

  const voice = GEMINI_VOICES.includes(
    (opts.voice ?? "") as (typeof GEMINI_VOICES)[number],
  )
    ? (opts.voice as string)
    : GEMINI_DEFAULT_VOICE;

  const setup = buildGeminiSetup({
    model: GEMINI_LIVE_MODEL,
    voice,
    systemPrompt: opts.systemPrompt,
  });

  const ephemeralToken = await mintEphemeralToken(apiKey);

  if (ephemeralToken) {
    return {
      token: ephemeralToken,
      authMethod: "ephemeral",
      model: GEMINI_LIVE_MODEL,
      voice,
      apiVersion: "v1alpha",
      setup,
    };
  }

  // Graceful fallback — ship the raw key on the v1beta endpoint. The token
  // is never theft-proof here, but the rest of the path is byte-identical
  // below the auth layer (the client picks v1beta + ?key= from authMethod).
  return {
    token: apiKey,
    authMethod: "raw",
    model: GEMINI_LIVE_MODEL,
    voice,
    apiVersion: "v1beta",
    setup,
  };
}

/**
 * POST to the v1alpha auth-tokens endpoint. Returns the token string, or
 * null on ANY failure (kill switch, network, non-2xx, missing token field).
 * Never throws — every failure maps to null so mintGeminiLiveSession can
 * degrade to the raw-key path.
 */
async function mintEphemeralToken(apiKey: string): Promise<string | null> {
  if (process.env.GEMINI_USE_EPHEMERAL_TOKENS === "false") {
    // Kill switch — operator explicitly forced raw-key mode.
    return null;
  }

  const now = Date.now();
  const expireTime = new Date(now + EXPIRE_MS).toISOString();
  const newSessionExpireTime = new Date(now + NEW_SESSION_EXPIRE_MS).toISOString();

  try {
    const response = await fetch(MINT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        config: {
          uses: 1,
          expireTime,
          newSessionExpireTime,
          // liveConnectConstraints (model/voice/tool pinning) intentionally
          // omitted — an unconstrained token avoids coupling the mint
          // payload to the client setup shape (PR #184 class of bug). The
          // security boundary stays expireTime + uses:1.
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "<no body>");
      console.warn(
        `[GeminiEphemeral] mint failed: HTTP ${response.status} — ${errText.slice(0, 200)}`,
      );
      return null;
    }

    // The AuthToken resource carries the token VALUE in `name` (format
    // `authTokens/…`), NOT a `token` field — verified against Google's
    // ephemeral-tokens docs. The client passes this `name` value as the
    // `access_token` query param on the v1alpha Live WS. (Meridian's own
    // reference reads `data.token`, which is always undefined — so its
    // ephemeral path silently dead-falls to the raw key. We fix it here.)
    const data = (await response.json()) as { name?: string };
    if (!data?.name) {
      console.warn(
        "[GeminiEphemeral] mint succeeded but response missing `name` (token) field",
      );
      return null;
    }
    return data.name;
  } catch (err: any) {
    console.warn(`[GeminiEphemeral] mint threw: ${err?.message || String(err)}`);
    return null;
  }
}
