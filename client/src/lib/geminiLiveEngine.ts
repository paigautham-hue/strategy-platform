/**
 * geminiLiveEngine.ts — Google Gemini Live voice engine over WebSocket.
 *
 * DEFAULT Cairn voice engine. Ported faithfully from Meridian's
 * battle-tested `geminiLiveEngine.ts` (client/src/lib/geminiLiveEngine.ts),
 * with all Meridian-specific imports inlined/stripped so this file is
 * self-contained.
 *
 * Architecture:
 *   Mic → AudioContext(16kHz) → PCM16 → base64 → WS → Gemini
 *   Gemini → WS → base64 PCM16(24kHz) → AudioContext(24kHz) → Speakers
 *
 * It exposes the SAME public surface as openaiRealtimeWsEngine.ts
 * (RealtimeWsCallbacks + the connect/disconnect/sendToolResponse/
 * sendTextMessage/interrupt/sendEvent/isOpen/setMicMuted method set) so
 * VoiceCallContext can instantiate either engine interchangeably by
 * provider. Everything above this module is transport- and rate-agnostic.
 *
 * Transport note (C16, corrected): Gemini Live is WebSocket-native. We use
 * WS + PCM16 — the Meridian-proven choice. WebRTC dropped audio on iOS
 * WKWebView (Meridian PRs #276/#278/#279/#283 failed to fix it). The one
 * real divergence from the OpenAI engine is the asymmetric audio: Gemini
 * wants 16kHz PCM IN and emits 24kHz PCM OUT (OpenAI is symmetric 24kHz).
 * That asymmetry is handled entirely inside this file.
 *
 * Auth (C13/C16 server-key discipline): the raw Google key never reaches
 * the browser. The server mints a short-lived ephemeral token and passes
 * it (plus an `authMethod`) into the config here. 'ephemeral' uses the
 * v1alpha BidiGenerateContentConstrained endpoint with `?access_token=`;
 * 'raw' uses the v1beta BidiGenerateContent endpoint with `?key=`. Auth is
 * ALWAYS a query param — never a header or a setup-message field.
 */

// ─── Public API (drop-in compatible with openaiRealtimeWsEngine.ts) ──────────

export interface RealtimeWsCallbacks {
  onTranscript: (entry: {
    role: "user" | "assistant";
    text: string;
    timestamp: number;
    isFinal: boolean;
  }) => void;
  onStatusChange: (
    status:
      | "connecting"
      | "connected"
      | "speaking"
      | "listening"
      | "processing"
      | "disconnected"
      | "error"
      | "reconnecting",
  ) => void;
  onError: (error: string) => void;
  onAudioLevel: (level: number) => void;
  onToolCall: (toolCall: {
    name: string;
    args: Record<string, any>;
    callId: string;
  }) => void;
  onRawEvent?: (event: any) => void;
}

/**
 * VAD profile (turn-taking eagerness):
 *   - 'reflective' (default): patient — LOW sensitivity, 1200ms silence
 *     before the turn ends. Lets the user pause mid-thought without the
 *     bot jumping in.
 *   - 'snappy': fast — HIGH sensitivity, 600ms silence. Lower-latency
 *     turn-taking; better for quick lookups.
 */
export type VadProfile = "reflective" | "snappy";

/**
 * The Gemini Live `setup` payload the server assembles (model,
 * generationConfig, speechConfig voice, systemInstruction, tools, …). The
 * engine sends `{ setup }` verbatim as the first WS frame, splicing in the
 * session-resumption handle when present. Keeping the full setup object
 * server-side mirrors how Cairn already returns the OpenAI session
 * ingredients — the engine stays a dumb transport.
 */
export interface GeminiSetupPayload {
  model: string;
  generationConfig?: Record<string, any>;
  systemInstruction?: Record<string, any>;
  realtimeInputConfig?: Record<string, any>;
  inputAudioTranscription?: Record<string, any>;
  outputAudioTranscription?: Record<string, any>;
  contextWindowCompression?: Record<string, any>;
  tools?: any[];
  [key: string]: any;
}

export interface RealtimeWsSessionConfig {
  /**
   * Short-lived ephemeral token minted by the server (v1alpha auth-tokens).
   * Used on the v1alpha endpoint with `?access_token=` when
   * `authMethod === 'ephemeral'`. Connect immediately after mint.
   */
  ephemeralToken: string;
  /**
   * Auth path selector. 'ephemeral' → v1alpha + `?access_token=<token>`;
   * 'raw' → v1beta + `?key=<token>` (the raw-key fallback the server uses
   * when minting fails). Undefined is treated as 'ephemeral' — the Cairn
   * default — since the server always mints first.
   */
  authMethod?: "ephemeral" | "raw";
  /** Gemini Live model id, e.g. 'gemini-3.1-flash-live-preview'. */
  model: string;
  /** Prebuilt voice name, e.g. 'Kore'. */
  voice: string;
  /** Turn-taking eagerness (only used if the server didn't pin VAD in setup). */
  vadProfile?: VadProfile;
  /**
   * The full Gemini Live `setup` payload from the server (systemInstruction,
   * tools, generationConfig, …). When present it is sent as-is; when absent
   * the engine synthesizes a minimal setup from model/voice/vadProfile so a
   * bare config still connects.
   */
  setup?: GeminiSetupPayload;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const INPUT_SAMPLE_RATE = 16000; // Gemini expects 16kHz mono input.
const OUTPUT_SAMPLE_RATE = 24000; // Gemini emits 24kHz mono output.

// Standard BidiGenerateContent endpoint — raw API keys (?key=) MUST use
// v1beta. The v1alpha BidiGenerateContentConstrained endpoint is ONLY for
// ephemeral tokens (?access_token=). Mixing v1alpha + ?key= silently fails.
const WS_BASE_RAW =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";
const WS_BASE_EPHEMERAL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained";

const MAX_RECONNECT_ATTEMPTS = 20;
const RECONNECT_BASE_DELAY_MS = 1000;

// Audio chunk: 1024 samples @ 16kHz = 64ms per chunk (20-100ms best practice).
const AUDIO_CHUNK_SIZE = 1024;

// 250ms mic-unmute delay after the AI finishes — avoids the AI's tail audio
// echoing back as "user speech" through the speaker. (Meridian optimized
// this down from 600ms; 600ms added too much perceived latency.)
const MIC_UNMUTE_DELAY_MS = 250;

// localStorage key for the resumption handle. 2h age cap — older handles are
// likely stale on Google's side and would be rejected anyway.
const SESSION_HANDLE_KEY = "cairn.gemini.sessionHandle";

/**
 * Inlined from Meridian's voiceStartupBreakdown.ts — the ONLY Meridian
 * import the engine had. Pure heuristic: classify a WS close as an
 * auth/credential rejection so a connect-phase auth failure short-circuits
 * the reconnect loop instead of spinning 20 attempts against a dead token.
 */
function isLikelyAuthRejectedClose(code: number, reason: string): boolean {
  try {
    if (code === 1008 || code === 1002) return true;
    if (typeof reason === "string" && reason.length > 0) {
      return /auth|token|expired|unauthor|forbidden|permission|api key|credential|401|403/i.test(
        reason,
      );
    }
    return false;
  } catch {
    return false;
  }
}

// ─── Engine ──────────────────────────────────────────────────────────────────

export class GeminiLiveEngine {
  private ws: WebSocket | null = null;
  private micStream: MediaStream | null = null;
  private callbacks: RealtimeWsCallbacks;
  private config: RealtimeWsSessionConfig;
  private isConnected = false;
  private isSpeaking = false;
  private intentionalDisconnect = false;
  private reachedSetupComplete = false;

  // Audio input
  private audioContext: AudioContext | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private micGainNode: GainNode | null = null;
  private audioLevelInterval: ReturnType<typeof setInterval> | null = null;
  private pcmBuffer: Int16Array | null = null;

  // Audio output. Loudness chain mirrors the OpenAI engine EXACTLY
  // (compressor → 2.0× gain) so both bots are loudness-matched — Gemini at
  // raw unity gain sounded "too quiet" next to OpenAI.
  private playbackContext: AudioContext | null = null;
  private playbackQueue: Float32Array[] = [];
  private nextPlayTime = 0;
  private playbackChunkCount = 0;
  private playbackCompressor: DynamicsCompressorNode | null = null;
  private playbackGainNode: GainNode | null = null;

  // Echo prevention
  private micMuted = false; // echo-prevention mute (still streams zero frames)
  private userMuted = false; // user-initiated mute — always wins over echo mute
  private unmuteMicTimeout: ReturnType<typeof setTimeout> | null = null;
  // Gain applied while the AI is speaking — hard-gate (0) cuts the
  // mic-to-Gemini path entirely so Gemini can't transcribe the bot's own
  // echoed voice as user input. Barge-in survives via a LOCAL VAD on the
  // raw (pre-gain) mic stream (see startLocalVAD / triggerLocalBargein).
  private readonly DUCK_GAIN_DURING_AI_SPEECH = 0;
  private isDucked = false;

  // Local VAD — runs while the mic-to-Gemini path is muted during AI
  // speech. Polls RMS on the raw mic stream every 50ms; sustained energy
  // above an adaptive threshold for 5 frames (250ms) triggers a barge-in.
  private vadAnalyser: AnalyserNode | null = null;
  private vadFloatBuffer: Float32Array<ArrayBuffer> | null = null;
  private vadIntervalId: ReturnType<typeof setInterval> | null = null;
  private vadSustainedFramesAboveThreshold = 0;
  private readonly VAD_POLL_INTERVAL_MS = 50;
  private readonly VAD_SUSTAIN_FRAMES_REQUIRED = 5; // 5 × 50ms = 250ms
  // Per-turn echo-baseline calibration. The threshold becomes
  // max(echoBaseline * 2.5, 0.025) — adaptive to phone-speaker volume,
  // room acoustics, and ambient noise (these vary ~10× across handheld /
  // speaker / car / outdoors). The MIN floor defends against pathological
  // calibration during pure silence (headphones → no echo at all).
  private vadEchoBaseline = 0;
  private vadCalibrationFramesRemaining = 0;
  private readonly VAD_CALIBRATION_FRAMES = 10; // 10 × 50ms = 500ms
  private readonly VAD_BASELINE_MULTIPLIER = 2.5;
  private readonly VAD_MIN_THRESHOLD = 0.025;
  private readonly VAD_CALIBRATION_CEILING = 0.05;

  // Ring buffer for first-word preservation on barge-in. While the
  // mic-to-Gemini gain is 0, the live ScriptProcessor sends zero frames —
  // so the user's first ~250ms of an interrupt is never seen by Gemini.
  // A second ScriptProcessor taps the RAW (pre-gain) source and writes
  // Int16 chunks into a small circular buffer; on local barge-in we flush
  // the buffered preroll so Gemini hears the interrupt from the first
  // syllable. Sized 5 × 1024 = 320ms at 16kHz (> the 250ms sustain window).
  private ringBufferProcessor: ScriptProcessorNode | null = null;
  private readonly RING_BUFFER_CHUNK_COUNT = 5;
  private ringBuffer: Int16Array[] = [];
  private ringBufferWriteIndex = 0;

  // Rolling buffer of the AI's last ~15s of output text — secondary echo
  // defence: a user transcription that's a clean substring of recent AI
  // output is suppressed from the UI.
  private recentAiOutput: Array<{ text: string; at: number }> = [];
  private readonly ECHO_BUFFER_MS = 15_000;

  // Session resumption (handles the ~10-min WebSocket connection wall and
  // cross-call persistence). Stored to localStorage on capture/update so a
  // new engine instance can resume. Age-capped at 2h.
  private sessionHandle: string | null = (() => {
    try {
      if (typeof localStorage === "undefined") return null;
      const stored = localStorage.getItem(SESSION_HANDLE_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored) as { handle?: string; savedAt?: number };
      const handle = parsed?.handle;
      const savedAt = parsed?.savedAt ?? 0;
      const ageMs = Date.now() - savedAt;
      const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
      if (!handle || ageMs > TWO_HOURS_MS) {
        localStorage.removeItem(SESSION_HANDLE_KEY);
        return null;
      }
      return handle;
    } catch {
      return null;
    }
  })();

  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private hasGreeted = false;

  // ── GoAway proactive-handover state ──
  // Gemini sends `goAway` ~5s before it force-closes the WS at the 10-min
  // wall. We open a NEW WS in parallel carrying the resumption handle, wait
  // for its setupComplete, then atomically swap so future sends route
  // through the new connection BEFORE the old one closes — no audible pause.
  private pendingHandoverWs: WebSocket | null = null;
  private handoverTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private isHandingOver = false;

  // Event handlers for cleanup
  private visibilityHandler: (() => void) | null = null;
  private onlineHandler: (() => void) | null = null;
  private offlineHandler: (() => void) | null = null;

  constructor(config: RealtimeWsSessionConfig, callbacks: RealtimeWsCallbacks) {
    this.config = config;
    this.callbacks = callbacks;
  }

  // ─── Safe send ───────────────────────────────────────────────────────────

  private safeSend(data: string): boolean {
    try {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(data);
        return true;
      }
    } catch (e) {
      console.warn("[GeminiLive] Send failed:", e);
    }
    return false;
  }

  private persistSessionHandle(handle: string): void {
    try {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem(
        SESSION_HANDLE_KEY,
        JSON.stringify({ handle, savedAt: Date.now() }),
      );
    } catch {
      /* quota / disabled — non-fatal */
    }
  }

  // ─── Public lifecycle (matches OpenAIRealtimeWsEngine) ──────────────────────

  async connect(opts?: { prewarmedMicStream?: MediaStream }): Promise<void> {
    if (this.isConnected || this.ws) {
      console.warn("[GeminiLive] Already connected or connecting");
      return;
    }
    this.callbacks.onStatusChange("connecting");
    this.intentionalDisconnect = false;
    this.reconnectAttempts = 0;

    // Hoisted out of the try so the catch can stop a stream that was
    // acquired but never adopted (avoids a lingering iOS recording dot).
    let micStream: MediaStream | undefined;
    try {
      if (opts?.prewarmedMicStream) {
        micStream = opts.prewarmedMicStream;
      } else {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: INPUT_SAMPLE_RATE,
            channelCount: 1,
          } as MediaTrackConstraints,
          video: false,
        });
      }
      this.micStream = micStream;

      // Track-ended listener — surfaces an unplugged/revoked mic.
      this.micStream.getTracks().forEach((track) => {
        track.addEventListener("ended", () => {
          this.callbacks.onError(
            "Microphone disconnected. Please reconnect your audio device.",
          );
          this.callbacks.onStatusChange("error");
        });
      });

      // Build the audio graph BEFORE opening the WS so playback context +
      // mic gate exist by the time setupComplete fires (the WS handshake
      // overlaps audio init). The setupComplete handler starts streaming +
      // greeting once the graph is ready.
      await this.setupAudioInput();
      this.setupAudioOutput();

      // iOS Safari visibility handler — resume suspended AudioContexts +
      // detect a WS that died while backgrounded.
      this.visibilityHandler = () => {
        if (document.visibilityState === "visible" && !this.intentionalDisconnect) {
          if (this.audioContext?.state === "suspended")
            this.audioContext.resume().catch(() => {});
          if (this.playbackContext?.state === "suspended")
            this.playbackContext.resume().catch(() => {});
          if (
            this.ws &&
            this.ws.readyState !== WebSocket.OPEN &&
            this.ws.readyState !== WebSocket.CONNECTING
          ) {
            this.ws = null;
            this.isConnected = false;
            this.attemptReconnect();
          }
        }
      };
      document.addEventListener("visibilitychange", this.visibilityHandler);

      // Online/offline detection.
      this.offlineHandler = () => this.callbacks.onStatusChange("reconnecting");
      this.onlineHandler = () => {
        if (!this.isConnected && !this.intentionalDisconnect) {
          this.reconnectAttempts = 0;
          this.attemptReconnect();
        }
      };
      window.addEventListener("offline", this.offlineHandler);
      window.addEventListener("online", this.onlineHandler);

      this.connectWebSocket();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Connection failed";
      this.callbacks.onError(`Failed to start voice: ${errorMsg}`);
      this.callbacks.onStatusChange("error");
      if (micStream && this.micStream !== micStream) {
        try {
          micStream.getTracks().forEach((t) => t.stop());
        } catch {
          /* defensive */
        }
      }
      await this.disconnect();
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.intentionalDisconnect = true;
    this.isConnected = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.visibilityHandler) {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.offlineHandler) {
      window.removeEventListener("offline", this.offlineHandler);
      this.offlineHandler = null;
    }
    if (this.onlineHandler) {
      window.removeEventListener("online", this.onlineHandler);
      this.onlineHandler = null;
    }

    if (this.audioLevelInterval) {
      clearInterval(this.audioLevelInterval);
      this.audioLevelInterval = null;
    }
    if (this.unmuteMicTimeout) {
      clearTimeout(this.unmuteMicTimeout);
      this.unmuteMicTimeout = null;
    }

    this.stopAudioStreaming();
    this.stopLocalVAD();
    this.vadAnalyser?.disconnect();
    this.vadAnalyser = null;
    this.vadFloatBuffer = null;
    if (this.ringBufferProcessor) {
      this.ringBufferProcessor.onaudioprocess = null;
      this.ringBufferProcessor.disconnect();
      this.ringBufferProcessor = null;
    }
    this.ringBuffer = [];
    this.ringBufferWriteIndex = 0;
    this.scriptProcessor?.disconnect();
    this.scriptProcessor = null;
    this.analyserNode?.disconnect();
    this.analyserNode = null;
    this.micGainNode?.disconnect();
    this.micGainNode = null;
    this.audioContext?.close().catch(() => {});
    this.audioContext = null;

    this.playbackContext?.close().catch(() => {});
    this.playbackContext = null;
    this.playbackCompressor = null;
    this.playbackGainNode = null;
    this.playbackQueue = [];
    this.nextPlayTime = 0;
    this.playbackChunkCount = 0;
    this.pcmBuffer = null;

    this.micStream?.getTracks().forEach((t) => t.stop());
    this.micStream = null;

    // Abort any in-flight handover FIRST so the pending WS + watchdog are
    // cleaned up before we tear down this.ws.
    this.abortHandover();

    if (this.ws) {
      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        try {
          this.ws.close(1000, "Session ended");
        } catch {
          /* best-effort */
        }
      }
      this.ws = null;
    }

    this.sessionHandle = null;
    this.hasGreeted = false;
    this.userMuted = false;
    this.micMuted = false;
    this.callbacks.onStatusChange("disconnected");
  }

  /**
   * Deliver a tool result back to Gemini. The result object is sent raw
   * (Gemini expects `response: { ...result }`, NOT `response: { result }`).
   *
   * Unlike OpenAI, Gemini does not need an explicit "now speak" trigger —
   * delivering the functionResponse lets the model continue its turn and
   * voice the answer. Idempotent-safe across multiple outstanding calls
   * (each functionResponse is independent and addressed by call id).
   */
  sendToolResponse(callId: string, name: string, result: Record<string, any>): void {
    this.safeSend(
      JSON.stringify({
        toolResponse: {
          functionResponses: [{ name, id: callId, response: result }],
        },
      }),
    );
  }

  /**
   * Send a text turn to the model. Uses `realtimeInput.text` (NOT
   * clientContent — clientContent only seeds history and does NOT trigger
   * generation). VoiceCallContext calls this right after connect() to nudge
   * the opening greeting.
   */
  sendTextMessage(text: string): void {
    this.safeSend(JSON.stringify({ realtimeInput: { text } }));
  }

  /**
   * Interrupt the assistant (barge-in driven by the UI). Gemini's
   * server-side VAD normally handles interrupts, but exposing this keeps
   * parity with the OpenAI engine: stop local playback and flip to
   * listening. Idempotent.
   */
  interrupt(): void {
    if (!this.isSpeaking) return;
    this.isSpeaking = false;
    this.unduckMic();
    this.clearPlaybackQueue();
    this.callbacks.onStatusChange("listening");
    this.unmuteMicDelayed();
  }

  /**
   * Escape hatch — send a raw Gemini Live client frame. Parity with the
   * OpenAI engine's `sendEvent`. The payload is JSON-serialized as-is.
   */
  sendEvent(event: Record<string, any>): void {
    this.safeSend(JSON.stringify(event));
  }

  isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * User mute control (matches OpenAI's setMicMuted). Gain-based, never
   * track.enabled = false: disabling tracks stops the ScriptProcessor from
   * firing, so Gemini receives ZERO frames and the session hangs (Gemini's
   * VAD needs a continuous stream — muted frames are zero-filled, not
   * absent). User mute always wins over echo mute.
   */
  setMicMuted(muted: boolean): void {
    this.userMuted = muted;
    this.micMuted = muted;
    if (muted) {
      if (this.unmuteMicTimeout) {
        clearTimeout(this.unmuteMicTimeout);
        this.unmuteMicTimeout = null;
      }
    }
    if (this.micGainNode && this.audioContext) {
      this.micGainNode.gain.setValueAtTime(
        muted ? 0 : 1.0,
        this.audioContext.currentTime,
      );
    }
  }

  // ─── WebSocket lifecycle ───────────────────────────────────────────────────

  /**
   * Single source of truth for the WS URL. 'ephemeral' → v1alpha +
   * `?access_token=`; 'raw' → v1beta + `?key=`. Reused by both the cold
   * connect AND the goAway handover so the handover keeps the original auth
   * method. Returns null when the credential is unusable.
   */
  private getWsUrl(): string | null {
    const token = this.config.ephemeralToken;
    if (!token?.trim()) return null;
    // Undefined authMethod defaults to 'ephemeral' — the Cairn server always
    // mints an ephemeral token first and only ships 'raw' on mint failure.
    if (this.config.authMethod === "raw") {
      return `${WS_BASE_RAW}?key=${encodeURIComponent(token)}`;
    }
    return `${WS_BASE_EPHEMERAL}?access_token=${encodeURIComponent(token)}`;
  }

  private connectWebSocket(): void {
    if (this.intentionalDisconnect) return;
    const wsUrl = this.getWsUrl();
    if (!wsUrl) {
      console.warn(
        `[GeminiLive] No usable credential for authMethod=${this.config.authMethod || "ephemeral"}; aborting connect.`,
      );
      this.callbacks.onError(
        "Couldn't authenticate the voice session. Try again in a moment.",
      );
      this.callbacks.onStatusChange("error");
      return;
    }

    this.ws = new WebSocket(wsUrl);
    this.ws.onopen = () => this.onWsOpen();
    this.ws.onmessage = (e) => this.onWsMessage(e);
    this.ws.onerror = (e) => this.onWsError(e);
    this.ws.onclose = (e) => this.onWsClose(e);
  }

  private onWsOpen(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Reset playback + duck/local-VAD state on (re)connect. If the WS
    // dropped while the AI was speaking, isDucked is still true and the VAD
    // is still polling — unduckMic is idempotent and also stops the VAD.
    this.clearPlaybackQueue();
    this.isSpeaking = false;
    this.unduckMic();

    this.safeSend(JSON.stringify(this.buildSetupMessage()));
  }

  /**
   * Build the Gemini Live `{ setup: {...} }` first frame. Prefers the
   * server-supplied setup payload (systemInstruction + tools + voice + VAD
   * already assembled in geminiRealtime.ts). Falls back to a minimal setup
   * synthesized from model/voice/vadProfile so a bare config still
   * connects. The session-resumption handle is always spliced in here.
   *
   * Gemini's setup message is SINGLE-SHOT per WebSocket — re-sending on the
   * same socket is silently dropped. The goAway handover opens a NEW socket
   * whose first frame is its own fresh setup (with the resumption handle).
   */
  private buildSetupMessage(): Record<string, any> {
    const sessionResumption = this.sessionHandle
      ? { handle: this.sessionHandle }
      : {};

    if (this.config.setup) {
      // Server already assembled the setup; clone shallowly and splice in
      // model prefix + resumption handle without mutating the config.
      const s = this.config.setup;
      return {
        setup: {
          ...s,
          model: s.model.startsWith("models/") ? s.model : `models/${s.model}`,
          sessionResumption,
        },
      };
    }

    // Fallback: synthesize a minimal setup from the bare config.
    const vadProfile: VadProfile = this.config.vadProfile || "reflective";
    const vadConfig =
      vadProfile === "snappy"
        ? {
            disabled: false,
            startOfSpeechSensitivity: "START_SENSITIVITY_HIGH",
            endOfSpeechSensitivity: "END_SENSITIVITY_HIGH",
            silenceDurationMs: 600,
            prefixPaddingMs: 200,
          }
        : {
            disabled: false,
            startOfSpeechSensitivity: "START_SENSITIVITY_LOW",
            endOfSpeechSensitivity: "END_SENSITIVITY_LOW",
            silenceDurationMs: 1200,
            prefixPaddingMs: 300,
          };

    return {
      setup: {
        model: `models/${this.config.model}`,
        generationConfig: {
          responseModalities: ["AUDIO"],
          temperature: 0.7,
          thinkingConfig: { thinkingLevel: "low" },
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: this.config.voice || "Kore" },
            },
          },
          mediaResolution: "MEDIA_RESOLUTION_LOW",
        },
        realtimeInputConfig: {
          automaticActivityDetection: vadConfig,
          activityHandling: "START_OF_ACTIVITY_INTERRUPTS",
          turnCoverage: "TURN_INCLUDES_ONLY_ACTIVITY",
        },
        // MUST be bare {} — Gemini rejects a languageCode here.
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        contextWindowCompression: { slidingWindow: { targetTokens: 16000 } },
        sessionResumption,
        tools: [{ functionDeclarations: [] }],
      },
    };
  }

  private async onWsMessage(event: MessageEvent): Promise<void> {
    try {
      // CRITICAL: Gemini Live sends messages as Blobs in the browser (NOT
      // strings). We MUST read the Blob as text before JSON.parse —
      // otherwise JSON.parse(blob) coerces to "[object Blob]" and throws,
      // silently swallowing every message.
      let rawText: string;
      if (event.data instanceof Blob) {
        rawText = await event.data.text();
      } else if (event.data instanceof ArrayBuffer) {
        rawText = new TextDecoder().decode(event.data);
      } else {
        rawText = event.data as string;
      }
      const msg = JSON.parse(rawText);
      this.callbacks.onRawEvent?.(msg);

      // ── Setup complete ──
      if (msg.setupComplete) {
        this.isConnected = true;
        this.reachedSetupComplete = true;
        this.reconnectAttempts = 0;
        this.callbacks.onStatusChange("connected");

        const handle: string | undefined =
          msg.setupComplete.sessionResumption?.handle;
        if (handle) {
          this.sessionHandle = handle;
          this.persistSessionHandle(handle);
        }

        // Start streaming + greeting. The audio graph was built in
        // connect() before the WS opened, so it's ready here.
        this.startConversationStreams();
        return;
      }

      // ── goAway — Gemini about to drop the connection ──
      if (msg.goAway) {
        const rawTimeLeft = msg.goAway.timeLeft;
        const timeLeftMs = rawTimeLeft
          ? parseFloat(String(rawTimeLeft).replace("s", "")) * 1000
          : 5000;
        this.beginProactiveHandover(timeLeftMs);
        return;
      }

      // ── Session resumption update — store latest handle ──
      if (msg.sessionResumptionUpdate) {
        const update = msg.sessionResumptionUpdate;
        if (update.resumable && update.newHandle) {
          this.sessionHandle = update.newHandle;
          this.persistSessionHandle(update.newHandle);
        } else if (update.handle) {
          this.sessionHandle = update.handle;
          this.persistSessionHandle(update.handle);
        }
      }

      // ── Server content (audio, transcription, interruption) ──
      if (msg.serverContent) {
        const sc = msg.serverContent;

        // Audio output from the model.
        if (sc.modelTurn?.parts) {
          for (const part of sc.modelTurn.parts) {
            if (part.inlineData?.data) {
              if (!this.isSpeaking) {
                this.isSpeaking = true;
                this.callbacks.onStatusChange("speaking");
                // Hard-gate the mic while the AI speaks; barge-in survives
                // via the local VAD started inside duckMicForAISpeech().
                this.duckMicForAISpeech();
              }
              this.enqueueAudio(part.inlineData.data);
            }
          }
        }

        // Input transcription (what the user said).
        if (sc.inputTranscription?.text) {
          const text = sc.inputTranscription.text.trim();
          if (text) {
            if (this.looksLikeEchoOfAIOutput(text)) {
              // Suppressed as AI echo.
            } else if (this.looksLikeTranscriptionHallucination(text)) {
              // Suppressed as a low-SNR transcription hallucination.
            } else {
              this.callbacks.onTranscript({
                role: "user",
                text,
                timestamp: Date.now(),
                isFinal: true,
              });
            }
          }
        }

        // Output transcription (what the AI said).
        if (sc.outputTranscription?.text) {
          const text = sc.outputTranscription.text.trim();
          if (text) {
            this.trackAIOutput(text);
            this.callbacks.onTranscript({
              role: "assistant",
              text,
              timestamp: Date.now(),
              isFinal: true,
            });
          }
        }

        // Interrupted (server-side VAD barge-in).
        if (sc.interrupted) {
          this.isSpeaking = false;
          this.unduckMic();
          this.clearPlaybackQueue();
          this.callbacks.onStatusChange("listening");
          this.unmuteMicDelayed();
        }

        // Turn complete.
        if (sc.turnComplete) {
          this.isSpeaking = false;
          this.unduckMic();
          this.callbacks.onStatusChange("listening");
          this.unmuteMicDelayed();
        }

        // Generation complete — precise unmute signal.
        if (sc.generationComplete) {
          this.isSpeaking = false;
          this.unduckMic();
          this.callbacks.onStatusChange("listening");
          this.unmuteMicDelayed();
        }
      }

      // ── Tool calls ──
      if (msg.toolCall) {
        this.handleToolCall(msg.toolCall);
      }
    } catch (e) {
      console.error("[GeminiLive] Failed to parse message:", e);
    }
  }

  private onWsError(event?: Event): void {
    console.error("[GeminiLive] WebSocket error:", event);
    // onWsClose handles reconnection.
  }

  private onWsClose(event: CloseEvent): void {
    console.error(
      `[GeminiLive] WebSocket closed — code: ${event.code}, reason: "${event.reason}", wasClean: ${event.wasClean}`,
    );
    this.isConnected = false;
    this.cancelInFlightSpeaking();

    if (this.intentionalDisconnect) {
      this.callbacks.onStatusChange("disconnected");
      return;
    }

    // Connect-phase auth rejection is FATAL — never fed into the reconnect
    // loop. Every reconnect would reuse the SAME dead credential via
    // getWsUrl(), so the loop can never succeed.
    if (
      !this.reachedSetupComplete &&
      isLikelyAuthRejectedClose(event.code, event.reason)
    ) {
      const detail =
        event.reason ||
        (event.code === 1008
          ? "Auth error — check API key"
          : `WebSocket closed with code ${event.code}`);
      this.callbacks.onError(`Gemini connection failed: ${detail}`);
      this.callbacks.onStatusChange("error");
      return;
    }

    // First-attempt failure with no resumption handle — surface, no retry.
    if (this.reconnectAttempts === 0 && !this.sessionHandle) {
      const detail =
        event.reason ||
        (event.code === 1008
          ? "Auth error — check API key"
          : `WebSocket closed with code ${event.code}`);
      this.callbacks.onError(`Gemini connection failed: ${detail}`);
      this.callbacks.onStatusChange("error");
      return;
    }

    if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      this.attemptReconnect();
      return;
    }

    if (event.code !== 1000) {
      this.callbacks.onError(`Connection closed: ${event.reason || "Unknown error"}`);
    }
    this.callbacks.onStatusChange("disconnected");
  }

  /** Reset speaking/duck state when a socket drops mid-turn. */
  private cancelInFlightSpeaking(): void {
    if (this.isSpeaking || this.isDucked) {
      this.isSpeaking = false;
      this.unduckMic();
      this.clearPlaybackQueue();
    }
  }

  // ─── GoAway proactive handover ─────────────────────────────────────────────

  private beginProactiveHandover(timeLeftMs: number): void {
    if (this.isHandingOver) return;
    if (!this.sessionHandle) {
      // No handle to resume — fall back to cold reconnect when the server
      // force-closes.
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(1000, "goAway (no resumption handle)");
      }
      return;
    }
    const wsUrl = this.getWsUrl();
    if (!wsUrl) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(1000, "goAway (no auth credential)");
      }
      return;
    }

    this.isHandingOver = true;
    let newWs: WebSocket;
    try {
      newWs = new WebSocket(wsUrl);
    } catch (e) {
      console.warn("[GeminiLive] Handover WS construction failed:", e);
      this.abortHandover();
      return;
    }
    this.pendingHandoverWs = newWs;

    // Cap the wait at 80% of the goAway window, clamped to [1500, 4000]ms.
    const timeoutMs = Math.max(1500, Math.min(timeLeftMs * 0.8, 4000));
    this.handoverTimeoutId = setTimeout(() => {
      if (this.pendingHandoverWs === newWs) {
        console.warn("[GeminiLive] Handover timed out — falling back to cold reconnect");
        this.abortHandover();
      }
    }, timeoutMs);

    newWs.onopen = () => {
      try {
        newWs.send(JSON.stringify(this.buildSetupMessage()));
      } catch (e) {
        console.warn("[GeminiLive] Handover setup send failed:", e);
        this.abortHandover();
      }
    };

    newWs.onmessage = async (e) => {
      try {
        let rawText: string;
        if (e.data instanceof Blob) rawText = await e.data.text();
        else if (e.data instanceof ArrayBuffer)
          rawText = new TextDecoder().decode(e.data);
        else rawText = e.data as string;
        const parsed = JSON.parse(rawText);
        if (parsed?.setupComplete) {
          const handle: string | undefined =
            parsed.setupComplete.sessionResumption?.handle;
          if (handle) {
            this.sessionHandle = handle;
            this.persistSessionHandle(handle);
          }
          this.completeProactiveHandover(newWs);
        }
        // Pre-swap messages (e.g. an early audio chunk) are dropped by
        // design — once the swap fires, onWsMessage takes over.
      } catch (err) {
        console.warn("[GeminiLive] Handover message parse failed:", err);
      }
    };

    newWs.onerror = () => {
      if (this.pendingHandoverWs === newWs) this.abortHandover();
    };
    newWs.onclose = () => {
      if (this.pendingHandoverWs === newWs) this.abortHandover();
    };
  }

  private completeProactiveHandover(newWs: WebSocket): void {
    if (this.pendingHandoverWs !== newWs) return; // stale

    if (this.handoverTimeoutId) {
      clearTimeout(this.handoverTimeoutId);
      this.handoverTimeoutId = null;
    }

    const oldWs = this.ws;
    // Detach old handlers BEFORE close so its onclose doesn't trigger
    // attemptReconnect.
    if (oldWs) {
      oldWs.onopen = null;
      oldWs.onmessage = null;
      oldWs.onerror = null;
      oldWs.onclose = null;
    }

    this.ws = newWs;
    this.pendingHandoverWs = null;
    this.isHandingOver = false;

    // Bind standard handlers (skip onWsOpen — that would resend setup +
    // greeting and interrupt the live conversation).
    newWs.onmessage = (e) => this.onWsMessage(e);
    newWs.onerror = (e) => this.onWsError(e);
    newWs.onclose = (e) => this.onWsClose(e);

    if (
      oldWs &&
      (oldWs.readyState === WebSocket.OPEN ||
        oldWs.readyState === WebSocket.CONNECTING)
    ) {
      try {
        oldWs.close(1000, "replaced by proactive handover");
      } catch {
        /* already closing */
      }
    }
  }

  private abortHandover(): void {
    if (this.handoverTimeoutId) {
      clearTimeout(this.handoverTimeoutId);
      this.handoverTimeoutId = null;
    }
    const pending = this.pendingHandoverWs;
    this.pendingHandoverWs = null;
    this.isHandingOver = false;
    if (pending) {
      pending.onopen = null;
      pending.onmessage = null;
      pending.onerror = null;
      pending.onclose = null;
      try {
        if (
          pending.readyState === WebSocket.OPEN ||
          pending.readyState === WebSocket.CONNECTING
        ) {
          pending.close(1000, "handover aborted");
        }
      } catch {
        /* already closing */
      }
    }
  }

  // ─── Reconnection with session resumption ──────────────────────────────────

  private attemptReconnect(): void {
    if (this.intentionalDisconnect) return;
    if (!navigator.onLine) {
      this.callbacks.onStatusChange("reconnecting");
      return;
    }

    this.reconnectAttempts++;
    const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1);
    this.callbacks.onStatusChange("reconnecting");
    if (this.intentionalDisconnect) return;

    this.stopAudioStreaming();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    this.reconnectTimer = setTimeout(() => {
      if (this.intentionalDisconnect) return;
      try {
        this.connectWebSocket();
      } catch (error) {
        console.error("[GeminiLive] Reconnect failed:", error);
        if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          this.attemptReconnect();
        } else {
          this.callbacks.onError(
            "Connection lost after multiple retries. Please start a new session.",
          );
          this.callbacks.onStatusChange("error");
        }
      }
    }, delay);
  }

  // ─── Conversation start (greeting) ─────────────────────────────────────────

  /**
   * Start audio streaming and (once) send the greeting trigger. Mute the
   * mic BEFORE the greeting to stop VAD detecting ambient noise as speech
   * (which would block the AI from responding) and to stop the AI's first
   * audio bleeding through speaker → mic → transcribed as user input. The
   * mic unmutes via unmuteMicDelayed() after the AI's first turn.
   *
   * A 300ms delay before the greeting lets the iOS audio stack settle (echo
   * canceller warm-up, gain settle, speaker path stabilize) before the bot
   * starts generating audio. Applies ONLY to the first greeting.
   *
   * Note: VoiceCallContext also calls sendTextMessage() right after
   * connect() as its own greeting nudge. hasGreeted gates the engine's
   * built-in greeting so the two don't double-fire; whichever lands the
   * first realtimeInput.text wins and the other is a harmless extra text
   * turn the model folds into the same opening.
   */
  private startConversationStreams(): void {
    this.startAudioStreaming();
    if (this.hasGreeted) return;
    this.hasGreeted = true;
    this.muteMic();
    const GREETING_DELAY_MS = 300;
    setTimeout(() => {
      this.safeSend(
        JSON.stringify({
          realtimeInput: {
            text: "[System: The voice session is starting now. Greet the user in one short sentence and ask what they'd like to think through.]",
          },
        }),
      );
    }, GREETING_DELAY_MS);
  }

  // ─── Audio input (Mic → PCM16 → WebSocket) ─────────────────────────────────

  private async setupAudioInput(): Promise<void> {
    if (!this.micStream) return;

    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AC({ sampleRate: INPUT_SAMPLE_RATE });
    if (this.audioContext!.state === "suspended") {
      await this.audioContext!.resume();
    }
    this.audioContext!.onstatechange = () => {
      if (this.audioContext?.state === "suspended" && !this.intentionalDisconnect) {
        this.audioContext.resume().catch(() => {});
      }
    };

    const source = this.audioContext!.createMediaStreamSource(this.micStream);

    this.micGainNode = this.audioContext!.createGain();
    this.micGainNode.gain.value = 1.0;

    this.analyserNode = this.audioContext!.createAnalyser();
    this.analyserNode.fftSize = 256;

    this.scriptProcessor = this.audioContext!.createScriptProcessor(
      AUDIO_CHUNK_SIZE,
      1,
      1,
    );
    this.pcmBuffer = new Int16Array(AUDIO_CHUNK_SIZE);

    // Silent sink — ScriptProcessor requires a connection to destination to
    // fire onaudioprocess (iOS), but we must NOT play mic audio through the
    // speakers (feedback loop).
    const silentOutput = this.audioContext!.createGain();
    silentOutput.gain.value = 0;

    source.connect(this.micGainNode);
    this.micGainNode.connect(this.analyserNode);
    this.micGainNode.connect(this.scriptProcessor);
    this.scriptProcessor.connect(silentOutput);
    silentOutput.connect(this.audioContext!.destination);

    // Local-VAD analyser taps the RAW source BEFORE the gain node, so it can
    // still see user energy when micGainNode.gain = 0 during AI speech.
    this.vadAnalyser = this.audioContext!.createAnalyser();
    this.vadAnalyser.fftSize = 512;
    this.vadAnalyser.smoothingTimeConstant = 0;
    this.vadFloatBuffer = new Float32Array(this.vadAnalyser.fftSize);
    source.connect(this.vadAnalyser);

    // Ring-buffer ScriptProcessor taps the RAW (pre-gain) source so we
    // capture the user's first syllable even while the live path is gated.
    this.ringBufferProcessor = this.audioContext!.createScriptProcessor(
      AUDIO_CHUNK_SIZE,
      1,
      1,
    );
    this.ringBufferProcessor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      const chunk = new Int16Array(AUDIO_CHUNK_SIZE);
      for (let i = 0; i < AUDIO_CHUNK_SIZE; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        chunk[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      this.appendToRingBuffer(chunk);
    };
    source.connect(this.ringBufferProcessor);
    this.ringBufferProcessor.connect(silentOutput);

    // Audio level for the UI waveform.
    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.audioLevelInterval = setInterval(() => {
      if (!this.analyserNode) return;
      this.analyserNode.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      this.callbacks.onAudioLevel(sum / dataArray.length / 255);
    }, 100);
  }

  private startAudioStreaming(): void {
    if (!this.scriptProcessor) return;

    this.scriptProcessor.onaudioprocess = (e) => {
      if (!this.isConnected || !this.ws) return;
      // WebSocket backpressure — skip the frame if the send buffer is
      // backed up.
      if (this.ws.bufferedAmount > 65536) return;

      const inputData = e.inputBuffer.getChannelData(0);

      // When muted, send silent ZERO-FILLED frames (NOT nothing). Gemini's
      // VAD needs a continuous stream — without frames the session hangs.
      if (this.micMuted) {
        const silentPcm = new Int16Array(inputData.length);
        const silentBytes = new Uint8Array(
          silentPcm.buffer,
          0,
          inputData.length * 2,
        ).slice();
        const silentBase64 = this.arrayBufferToBase64(
          silentBytes.buffer as ArrayBuffer,
        );
        this.safeSend(
          JSON.stringify({
            realtimeInput: {
              audio: { data: silentBase64, mimeType: "audio/pcm;rate=16000" },
            },
          }),
        );
        return;
      }

      const pcm16 =
        this.pcmBuffer && this.pcmBuffer.length >= inputData.length
          ? this.pcmBuffer
          : new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      const pcmBytes = new Uint8Array(pcm16.buffer, 0, inputData.length * 2).slice();
      const base64 = this.arrayBufferToBase64(pcmBytes.buffer as ArrayBuffer);

      this.safeSend(
        JSON.stringify({
          realtimeInput: {
            audio: { data: base64, mimeType: "audio/pcm;rate=16000" },
          },
        }),
      );
    };
  }

  private stopAudioStreaming(): void {
    if (this.scriptProcessor) {
      this.scriptProcessor.onaudioprocess = null;
    }
  }

  // ─── Audio output (WebSocket → PCM24 → Speakers) ───────────────────────────

  // Build source → compressor → 2.0× gain → destination on the CURRENT
  // playbackContext. Must run on every (re)creation — clearPlaybackQueue()
  // closes + recreates the context on barge-in, which would otherwise
  // orphan these nodes and silently drop to unity gain. Params copied from
  // openaiRealtimeWsEngine so both bots are loudness-matched.
  private buildPlaybackChain(): void {
    if (!this.playbackContext) return;
    try {
      this.playbackCompressor = this.playbackContext.createDynamicsCompressor();
      this.playbackCompressor.threshold.value = -12;
      this.playbackCompressor.ratio.value = 4;
      this.playbackCompressor.attack.value = 0.005;
      this.playbackCompressor.release.value = 0.05;
      this.playbackCompressor.knee.value = 6;
      this.playbackGainNode = this.playbackContext.createGain();
      this.playbackGainNode.gain.value = 2.0;
      this.playbackCompressor.connect(this.playbackGainNode);
      this.playbackGainNode.connect(this.playbackContext.destination);
    } catch (err: any) {
      // Defensive: fall back to a direct destination connect (quieter is
      // better than silent).
      console.warn(
        "[GeminiLive] playback chain build failed (non-fatal, unity fallback):",
        err?.message || err,
      );
      this.playbackCompressor = null;
      this.playbackGainNode = null;
    }
  }

  private setupAudioOutput(): void {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    this.playbackContext = new AC({ sampleRate: OUTPUT_SAMPLE_RATE });
    if (this.playbackContext!.state === "suspended") {
      this.playbackContext!.resume().catch(() => {});
    }
    this.playbackContext!.onstatechange = () => {
      if (this.playbackContext?.state === "suspended" && !this.intentionalDisconnect) {
        this.playbackContext.resume().catch(() => {});
      }
    };
    this.buildPlaybackChain();
  }

  private enqueueAudio(base64Data: string): void {
    if (!this.playbackContext) return;

    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    // PCM16 needs an even byte length; an odd-length payload would make the
    // Int16Array constructor throw and silently drop the chunk. Clamp to the
    // largest even prefix.
    const usableSamples = Math.floor(bytes.byteLength / 2);
    const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, usableSamples);

    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 0x8000;
    }

    // Playback queue overflow protection.
    if (this.playbackQueue.length > 50) {
      console.warn("[GeminiLive] Playback queue overflow, dropping old chunks");
      this.playbackQueue.splice(0, this.playbackQueue.length - 10);
      this.nextPlayTime = 0;
    }

    this.playbackQueue.push(float32);
    this.playNextChunk();
  }

  private playNextChunk(): void {
    if (!this.playbackContext || this.playbackQueue.length === 0) return;

    const samples = this.playbackQueue.shift()!;
    const buffer = this.playbackContext.createBuffer(
      1,
      samples.length,
      OUTPUT_SAMPLE_RATE,
    );
    buffer.getChannelData(0).set(samples);

    const source = this.playbackContext.createBufferSource();
    source.buffer = buffer;
    if (this.playbackCompressor) {
      source.connect(this.playbackCompressor);
    } else if (this.playbackGainNode) {
      source.connect(this.playbackGainNode);
    } else {
      source.connect(this.playbackContext.destination);
    }

    const now = this.playbackContext.currentTime;
    const startTime = Math.max(now, this.nextPlayTime);
    source.start(startTime);
    this.nextPlayTime = startTime + buffer.duration;

    // Drift correction every 100 chunks.
    this.playbackChunkCount++;
    if (this.playbackChunkCount % 100 === 0) {
      this.nextPlayTime = Math.max(this.nextPlayTime, this.playbackContext.currentTime);
    }

    source.onended = () => {
      source.disconnect();
      if (this.playbackQueue.length > 0) {
        this.playNextChunk();
      }
    };
  }

  private clearPlaybackQueue(): void {
    this.playbackQueue = [];
    this.nextPlayTime = 0;
    this.playbackChunkCount = 0;
    // Close + recreate the playback context to stop all in-flight audio.
    if (this.playbackContext) {
      this.playbackContext.close().catch(() => {});
      this.playbackCompressor = null;
      this.playbackGainNode = null;
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      this.playbackContext = new AC({ sampleRate: OUTPUT_SAMPLE_RATE });
      if (this.playbackContext!.state === "suspended") {
        this.playbackContext!.resume().catch(() => {});
      }
      this.playbackContext!.onstatechange = () => {
        if (
          this.playbackContext?.state === "suspended" &&
          !this.intentionalDisconnect
        ) {
          this.playbackContext.resume().catch(() => {});
        }
      };
      this.buildPlaybackChain();
    }
  }

  // ─── Echo prevention / ducking ─────────────────────────────────────────────

  private muteMic(): void {
    this.micMuted = true;
    if (this.unmuteMicTimeout) {
      clearTimeout(this.unmuteMicTimeout);
      this.unmuteMicTimeout = null;
    }
    if (this.micGainNode && this.audioContext) {
      this.micGainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    }
    // Do NOT disable tracks — that starves Gemini's VAD of frames and hangs
    // the session. gain=0 + zero-filled frames only.
  }

  /**
   * Hard-gate the mic-to-Gemini path while the AI is speaking. gain=0 cuts
   * the path so Gemini never sees the bot's own echo. Barge-in survives via
   * the local VAD started here, watching the RAW (pre-gain) mic stream.
   * No-op if the user has muted manually or we're already ducked.
   */
  private duckMicForAISpeech(): void {
    if (this.userMuted || this.micMuted || this.isDucked) return;
    this.isDucked = true;
    if (this.micGainNode && this.audioContext) {
      const t = this.audioContext.currentTime;
      this.micGainNode.gain.setValueAtTime(this.micGainNode.gain.value, t);
      this.micGainNode.gain.linearRampToValueAtTime(
        this.DUCK_GAIN_DURING_AI_SPEECH,
        t + 0.04,
      );
    }
    // Reset the ring buffer at the start of each AI turn so a barge-in
    // within the first ~320ms doesn't flush stale audio from the prior turn
    // (the bot's own dying syllables → echo loop).
    this.ringBuffer = [];
    this.ringBufferWriteIndex = 0;
    this.startLocalVAD();
  }

  /**
   * Restore mic gain to 1.0 when the AI finishes speaking. Fast ramp (30ms)
   * so the user's next utterance captures cleanly. Always stops the local
   * VAD — Gemini's server-side VAD takes over once we're live again.
   */
  private unduckMic(): void {
    if (!this.isDucked) return;
    this.isDucked = false;
    this.stopLocalVAD();
    if (this.userMuted || this.micMuted) return; // still muted; don't touch gain
    if (this.micGainNode && this.audioContext) {
      const t = this.audioContext.currentTime;
      this.micGainNode.gain.setValueAtTime(this.micGainNode.gain.value, t);
      this.micGainNode.gain.linearRampToValueAtTime(1.0, t + 0.03);
    }
  }

  private startLocalVAD(): void {
    if (this.vadIntervalId != null) return; // already running
    if (!this.vadAnalyser || !this.vadFloatBuffer) return;
    this.vadSustainedFramesAboveThreshold = 0;
    this.vadEchoBaseline = 0;
    this.vadCalibrationFramesRemaining = this.VAD_CALIBRATION_FRAMES;
    this.vadIntervalId = setInterval(() => {
      if (!this.vadAnalyser || !this.vadFloatBuffer) {
        this.stopLocalVAD();
        return;
      }
      if (this.userMuted || this.micMuted) {
        this.vadSustainedFramesAboveThreshold = 0;
        return;
      }
      this.vadAnalyser.getFloatTimeDomainData(this.vadFloatBuffer);
      let sumSquares = 0;
      const buf = this.vadFloatBuffer;
      for (let i = 0; i < buf.length; i++) {
        sumSquares += buf[i] * buf[i];
      }
      const rms = Math.sqrt(sumSquares / buf.length);

      // Per-turn calibration. During the first VAD_CALIBRATION_FRAMES ticks,
      // observe the echo floor and do NOT trigger barge-in. Skip samples
      // above the ceiling — those are almost certainly the user talking
      // over the AI's opening syllables, not echo, and would poison the
      // baseline (inflated threshold → user can't barge in for the turn).
      if (this.vadCalibrationFramesRemaining > 0) {
        if (rms > this.vadEchoBaseline && rms < this.VAD_CALIBRATION_CEILING) {
          this.vadEchoBaseline = rms;
        }
        this.vadCalibrationFramesRemaining--;
        return;
      }

      const activeThreshold = Math.max(
        this.vadEchoBaseline * this.VAD_BASELINE_MULTIPLIER,
        this.VAD_MIN_THRESHOLD,
      );
      if (rms > activeThreshold) {
        this.vadSustainedFramesAboveThreshold++;
        if (
          this.vadSustainedFramesAboveThreshold >= this.VAD_SUSTAIN_FRAMES_REQUIRED
        ) {
          this.triggerLocalBargein();
        }
      } else {
        this.vadSustainedFramesAboveThreshold = 0;
      }
    }, this.VAD_POLL_INTERVAL_MS);
  }

  private stopLocalVAD(): void {
    if (this.vadIntervalId != null) {
      clearInterval(this.vadIntervalId);
      this.vadIntervalId = null;
    }
    this.vadSustainedFramesAboveThreshold = 0;
    this.vadEchoBaseline = 0;
    this.vadCalibrationFramesRemaining = 0;
  }

  /**
   * Local barge-in: stop bot playback, flush the preroll ring buffer so
   * Gemini hears the interrupt from the first syllable, restore mic gain,
   * flip to listening. All ops idempotent so a near-simultaneous server
   * `interrupted` event is a harmless no-op.
   */
  private triggerLocalBargein(): void {
    this.stopLocalVAD();
    this.isSpeaking = false;
    // Flush BEFORE restoring gain so the live frames are a smooth extension
    // of the buffered preroll.
    this.flushRingBufferToGemini();
    this.unduckMic();
    this.clearPlaybackQueue();
    this.callbacks.onStatusChange("listening");
  }

  private appendToRingBuffer(chunk: Int16Array): void {
    // Indexed circular buffer — overwrite rather than shift to avoid GC
    // churn on every audio frame.
    if (this.ringBuffer.length < this.RING_BUFFER_CHUNK_COUNT) {
      this.ringBuffer.push(chunk);
    } else {
      this.ringBuffer[this.ringBufferWriteIndex] = chunk;
    }
    this.ringBufferWriteIndex =
      (this.ringBufferWriteIndex + 1) % this.RING_BUFFER_CHUNK_COUNT;
  }

  private flushRingBufferToGemini(): void {
    if (this.ringBuffer.length === 0) return;
    const ordered: Int16Array[] = [];
    if (this.ringBuffer.length < this.RING_BUFFER_CHUNK_COUNT) {
      for (let i = 0; i < this.ringBuffer.length; i++) {
        ordered.push(this.ringBuffer[i]);
      }
    } else {
      for (let i = 0; i < this.RING_BUFFER_CHUNK_COUNT; i++) {
        const idx = (this.ringBufferWriteIndex + i) % this.RING_BUFFER_CHUNK_COUNT;
        ordered.push(this.ringBuffer[idx]);
      }
    }
    for (const chunk of ordered) {
      const bytes = new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      this.safeSend(
        JSON.stringify({
          realtimeInput: {
            audio: { data: base64, mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}` },
          },
        }),
      );
    }
    this.ringBuffer = [];
    this.ringBufferWriteIndex = 0;
  }

  private trackAIOutput(text: string): void {
    const now = Date.now();
    this.recentAiOutput.push({ text, at: now });
    this.recentAiOutput = this.recentAiOutput.filter(
      (e) => now - e.at < this.ECHO_BUFFER_MS,
    );
  }

  /**
   * Secondary echo defence — true if the user transcript is a clean
   * substring of recent AI output. Conservative: requires ≥8 chars so a
   * legitimate short "Thanks"/"OK"/"yes" never gets swallowed.
   */
  private looksLikeEchoOfAIOutput(userText: string): boolean {
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s']/g, "")
        .replace(/\s+/g, " ")
        .trim();
    const u = normalize(userText);
    if (u.length < 8) return false;
    const joined = normalize(this.recentAiOutput.map((e) => e.text).join(" "));
    if (joined.length < 8) return false;
    return joined.includes(u);
  }

  /**
   * Whisper-family hallucination filter. Gemini Live doesn't accept a
   * language hint on inputAudioTranscription, so it auto-detects per frame
   * and during silence/breath/noise commonly emits short non-Latin
   * particles. Suppress when BOTH: length ≤ 8 chars AND no ASCII
   * letters/digits. Conservative — only the common single-token
   * hallucination class.
   */
  private looksLikeTranscriptionHallucination(text: string): boolean {
    if (text.length > 8) return false;
    if (/[A-Za-z0-9]/.test(text)) return false;
    return true;
  }

  private unmuteMicDelayed(): void {
    if (this.userMuted) return; // user mute always wins
    if (this.unmuteMicTimeout) clearTimeout(this.unmuteMicTimeout);
    this.unmuteMicTimeout = setTimeout(() => {
      if (this.userMuted) {
        this.unmuteMicTimeout = null;
        return;
      }
      this.micMuted = false;
      if (this.micGainNode && this.audioContext) {
        this.micGainNode.gain.setValueAtTime(1.0, this.audioContext.currentTime);
      }
      this.unmuteMicTimeout = null;
    }, MIC_UNMUTE_DELAY_MS);
  }

  // ─── Tool call handling ────────────────────────────────────────────────────

  private handleToolCall(toolCall: any): void {
    if (!toolCall.functionCalls) return;
    for (const fc of toolCall.functionCalls) {
      if (!fc?.name) continue;
      // Gemini normally sends an `id` to correlate the functionResponse; if
      // it's ever absent, synthesize a stable one so sendToolResponse can
      // still echo it back (an undefined id orphans the response).
      const callId: string = fc.id ?? `${fc.name}-${Date.now()}`;
      this.callbacks.onToolCall({
        name: fc.name,
        args: fc.args || {},
        callId,
      });
    }
  }

  // ─── Utilities ─────────────────────────────────────────────────────────────

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const CHUNK = 0x8000;
    const chunks: string[] = [];
    for (let i = 0; i < bytes.length; i += CHUNK) {
      chunks.push(
        String.fromCharCode.apply(
          null,
          bytes.subarray(i, Math.min(i + CHUNK, bytes.length)) as unknown as number[],
        ),
      );
    }
    return btoa(chunks.join(""));
  }
}
