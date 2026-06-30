/**
 * realtime.ts — OpenAI Realtime API session minting for Cairn voice.
 *
 * Mints a SHORT-LIVED ephemeral client secret server-side (the raw
 * OPENAI_API_KEY never reaches the browser) via the GA endpoint
 * `POST /v1/realtime/client_secrets`, with a compact Cairn system prompt
 * (C17 — compact prompt + on-demand lookup tools, never a context dump)
 * and read-only lookup tool definitions. The client connects over
 * WebSocket using the returned token (see openaiRealtimeWsEngine.ts).
 *
 * Transport note (C16, corrected): the in-repo C16 rule predates
 * Meridian's WebRTC→WebSocket migration. WebRTC dropped audio on iOS
 * WKWebView (Meridian PRs #276/#278/#279/#283 failed to fix it); Meridian
 * shipped a WebSocket + PCM16 engine instead. We port that proven engine.
 * See docs/CLAUDE.md C16 for the full corrected lesson.
 */

import { ENV } from "./env";

// Default to the GA `gpt-realtime` model — broadest availability and a
// simpler request body (no reasoning/parallel_tool_calls fields, which
// only the reasoning variant accepts). Bump to "gpt-realtime-2" once the
// account key is confirmed entitled.
export const REALTIME_MODEL = "gpt-realtime";
export const DEFAULT_VOICE = "alloy";
export const REALTIME_VOICES = ["alloy", "echo", "shimmer", "marin", "cedar"] as const;

// ── Read-only lookup tools (C13-safe: no writes; C17: on-demand) ──────────────
// The model calls these to ground answers in the active company's data
// instead of us dumping everything into the prompt. The client dispatches
// each call back to `realtime.executeTool` and returns the result.
export const REALTIME_TOOLS = [
  {
    type: "function" as const,
    name: "lookup_company",
    description:
      "Get the active company's profile — name, industry, description, and strategy snapshot. Call this when you need company facts you don't already have.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    type: "function" as const,
    name: "lookup_memory",
    description:
      "Semantic search over the company's strategy memory (hypotheses, decisions, evidence, insights). Use for any 'what do we know / what did we decide about X' question.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The topic or question to search the memory for.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    type: "function" as const,
    name: "lookup_predictions",
    description:
      "List the company's open predictions from the Prediction Ledger, plus its calibration scorecard (Brier score, hit rate). Use for 'what are we tracking', 'what's overdue', or 'how good are our forecasts'.",
    parameters: {
      type: "object",
      properties: {
        overdueOnly: {
          type: "boolean",
          description: "If true, return only predictions past their target date.",
        },
      },
      additionalProperties: false,
    },
  },
] as const;

export type RealtimeToolName = (typeof REALTIME_TOOLS)[number]["name"];

// ── Compact system prompt (C17 + C18: static prefix, company suffix) ──────────

const STATIC_PROMPT_PREFIX = `You are the voice of Cairn — a private strategy-intelligence platform. You are speaking out loud with a strategist about one of their portfolio companies. Be a sharp, concise thinking partner: direct, grounded, never sycophantic.

Rules of engagement:
- Keep spoken answers tight — a few sentences. This is a conversation, not a memo. Offer to go deeper rather than dumping detail.
- You do NOT have the company's data memorized. Call the lookup tools (lookup_company, lookup_memory, lookup_predictions) to ground every factual claim. Never invent numbers, predictions, or decisions.
- When you call a tool, say a brief natural filler first ("Let me check…") then deliver the answer once the result returns.
- If the user asks for something you cannot do by voice (writing to the ledger, generating artifacts), tell them which screen to use — don't pretend to have done it.
- Think in strategy terms: hypotheses, options, predictions, calibration, second-order effects. Challenge weak reasoning.`;

export function buildVoiceSystemPrompt(company: {
  name?: string | null;
  industry?: string | null;
  description?: string | null;
}): string {
  const lines: string[] = [STATIC_PROMPT_PREFIX, "", "## ACTIVE COMPANY"];
  lines.push(`Name: ${company.name ?? "Unknown"}`);
  if (company.industry) lines.push(`Industry: ${company.industry}`);
  if (company.description) lines.push(`About: ${company.description.slice(0, 600)}`);
  lines.push(
    "",
    "Use the lookup tools for anything beyond these basics. Open the conversation with a short, warm greeting and ask what they want to think through.",
  );
  return lines.join("\n");
}

// ── Per-user guards: rate limit + single concurrent session ───────────────────

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;
const LOCK_TTL_MS = 2 * 60_000;
const creationTimestamps = new Map<number, number[]>();
const activeSessions = new Map<number, number>();

export function checkVoiceRateLimit(userId: number): void {
  const now = Date.now();
  const recent = (creationTimestamps.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    throw new Error("Rate limit exceeded — please wait before starting another voice session.");
  }
  recent.push(now);
  creationTimestamps.set(userId, recent);
}

export function acquireVoiceLock(userId: number): void {
  activeSessions.set(userId, Date.now());
}
export function releaseVoiceLock(userId: number): void {
  activeSessions.delete(userId);
}

// ── Mint ──────────────────────────────────────────────────────────────────────

export interface MintedVoiceSession {
  ephemeralToken: string;
  model: string;
  voice: string;
  expiresAt: number | null;
}

export async function mintRealtimeSession(opts: {
  systemPrompt: string;
  voice?: string;
}): Promise<MintedVoiceSession> {
  if (!ENV.openAiApiKey) {
    throw new Error(
      "Realtime voice is not configured — OPENAI_API_KEY is required (with Realtime API access).",
    );
  }
  const voice = REALTIME_VOICES.includes((opts.voice ?? "") as (typeof REALTIME_VOICES)[number])
    ? (opts.voice as string)
    : DEFAULT_VOICE;

  const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session: {
        type: "realtime",
        model: REALTIME_MODEL,
        instructions: opts.systemPrompt,
        tools: REALTIME_TOOLS,
        tool_choice: "auto",
        // GA nested session schema — `format` is an OBJECT, not a flat
        // string. PCM16 @ 24kHz both directions (the WS engine's decoder
        // assumes exactly this).
        audio: {
          input: {
            format: { type: "audio/pcm", rate: 24000 },
            noise_reduction: { type: "near_field" },
            transcription: { model: "gpt-4o-mini-transcribe", language: "en" },
            turn_detection: {
              type: "semantic_vad",
              eagerness: "medium",
              interrupt_response: true,
              create_response: true,
            },
          },
          output: {
            format: { type: "audio/pcm", rate: 24000 },
            voice,
          },
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[realtime] client_secrets failed:", res.status, body.slice(0, 500));
    throw new Error(`Failed to mint voice session (${res.status}).`);
  }

  const json: any = await res.json();
  // GA returns `{ value, expires_at, session }`; older shapes nest under
  // `client_secret`. Accept both so a minor API shift doesn't break us.
  const token: string =
    json?.value ?? json?.client_secret?.value ?? json?.client_secret ?? "";
  if (!token) throw new Error("Voice session mint returned no token.");
  const expiresAt: number | null =
    typeof json?.expires_at === "number"
      ? json.expires_at
      : typeof json?.client_secret?.expires_at === "number"
        ? json.client_secret.expires_at
        : null;

  return { ephemeralToken: token, model: REALTIME_MODEL, voice, expiresAt };
}
