/**
 * openaiRealtimeWsEngine.ts — OpenAI Realtime API over WebSocket transport.
 *
 * Ported from Meridian's battle-tested engine (client/src/lib/
 * openaiRealtimeWsEngine.ts). Meridian moved OpenAI Realtime from WebRTC to
 * WebSocket after WebRTC dropped audio on iOS WKWebView (PRs #276/#278/#279/
 * #283 failed to fix it). PCM16 24kHz mono both directions; ephemeral token
 * passed via WebSocket subprotocol so the raw OPENAI_API_KEY never leaves the
 * server. See docs/CLAUDE.md C16 (corrected).
 *
 * The component plugs in via the callbacks interface; everything above this
 * module is transport-agnostic.
 */

// ─── Public API ──────────────────────────────────────────────────────────────

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

export interface RealtimeWsSessionConfig {
  /** Ephemeral token minted by the server via /v1/realtime/client_secrets.
   *  SHORT-LIVED (~60s) — connect immediately after createSession returns. */
  ephemeralToken: string;
  model: string;
  voice: string;
  vadProfile?: "snappy" | "reflective";
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const SAMPLE_RATE = 24000;
// Power-of-2 in [256, 16384] (Web Audio spec; iOS WKWebView enforces it).
const AUDIO_CHUNK_SIZE = 2048;
const RECONNECT_BASE_DELAY_MS = 1000;
const MAX_RECONNECT_ATTEMPTS = 5;
// 250ms mic-unmute delay after AI finishes — avoids the AI's tail audio
// echoing back as "user speech" via the speaker.
const MIC_UNMUTE_DELAY_MS = 250;

// After a tool call, the follow-up response.create must SPEAK the answer
// already in the conversation — never re-enter the tool path. tool_choice:
// "none" structurally forces a spoken message. Session instructions are NOT
// overridden (that would strip the persona/context for this response).
const TOOL_ANSWER_RESPONSE_CREATE = {
  type: "response.create" as const,
  response: { tool_choice: "none" as const },
};

export class OpenAIRealtimeWsEngine {
  private ws: WebSocket | null = null;
  private micStream: MediaStream | null = null;
  private callbacks: RealtimeWsCallbacks;
  private config: RealtimeWsSessionConfig;
  private connected = false;
  private speaking = false;
  private intentionalDisconnect = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private audioContext: AudioContext | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private micGainNode: GainNode | null = null;
  private audioLevelInterval: ReturnType<typeof setInterval> | null = null;

  private playbackContext: AudioContext | null = null;
  private playbackQueue: AudioBufferSourceNode[] = [];
  private nextPlayTime = 0;
  private playbackCompressor: DynamicsCompressorNode | null = null;
  private playbackGainNode: GainNode | null = null;

  private micMuted = false;
  private unmuteMicTimeout: ReturnType<typeof setTimeout> | null = null;

  // Tool-call completion guard — see Meridian's notes. Every appended
  // function_call_output MUST eventually get a response.create or the bot
  // stays silent until prodded.
  private activeResponse = false;
  private pendingToolResponseCreate = false;
  private toolAnswerPending = false;
  private outstandingToolCalls = 0;

  constructor(config: RealtimeWsSessionConfig, callbacks: RealtimeWsCallbacks) {
    this.config = config;
    this.callbacks = callbacks;
  }

  // ── Public lifecycle ──

  async connect(opts?: { prewarmedMicStream?: MediaStream }): Promise<void> {
    this.callbacks.onStatusChange("connecting");
    try {
      await this.setupAudioInput(opts);
      await this.openWebSocket();
    } catch (err: any) {
      this.callbacks.onError(`Failed to start voice: ${err?.message || String(err)}`);
      this.callbacks.onStatusChange("error");
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.intentionalDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close(1000, "client_disconnect");
      } catch {
        /* best-effort */
      }
      this.ws = null;
    }
    this.teardownAudio();
    this.connected = false;
    this.callbacks.onStatusChange("disconnected");
  }

  sendToolResponse(callId: string, _name: string, result: Record<string, any>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.send({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify(result),
      },
    });
    this.toolAnswerPending = true;
    if (this.outstandingToolCalls > 0) this.outstandingToolCalls--;
    if (this.outstandingToolCalls > 0) return;
    if (this.activeResponse) {
      this.pendingToolResponseCreate = true;
    } else {
      this.send(TOOL_ANSWER_RESPONSE_CREATE);
    }
  }

  sendTextMessage(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.send({
      type: "conversation.item.create",
      item: { type: "message", role: "user", content: [{ type: "input_text", text }] },
    });
    this.send({ type: "response.create" });
  }

  interrupt(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.send({ type: "response.cancel" });
    this.cancelPlayback();
  }

  sendEvent(event: Record<string, any>): void {
    this.send(event);
  }

  isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  setMicMuted(muted: boolean): void {
    if (!this.micStream) return;
    for (const track of this.micStream.getAudioTracks()) {
      track.enabled = !muted;
    }
  }

  // ── WebSocket lifecycle ──

  private async openWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(this.config.model)}`;
      // Auth via subprotocol — browser-safe. DO NOT add `openai-beta.realtime-v1`:
      // our server mints GA client secrets, and a GA secret cannot start a Beta
      // session (OpenAI rejects it).
      const subprotocols = [
        "realtime",
        `openai-insecure-api-key.${this.config.ephemeralToken}`,
      ];
      let ws: WebSocket;
      try {
        ws = new WebSocket(url, subprotocols);
      } catch (err: any) {
        reject(err);
        return;
      }
      this.ws = ws;

      ws.onopen = () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        this.activeResponse = false;
        this.pendingToolResponseCreate = false;
        this.toolAnswerPending = false;
        this.outstandingToolCalls = 0;
        // Thin client-only override: the VAD eagerness profile (a client
        // preference the server can't know). GA nested schema; session.type
        // is required on EVERY session.update.
        this.send({
          type: "session.update",
          session: {
            type: "realtime",
            audio: {
              input: {
                turn_detection: {
                  type: "semantic_vad",
                  eagerness: this.config.vadProfile === "snappy" ? "high" : "medium",
                },
              },
            },
          },
        });
        this.callbacks.onStatusChange("connected");
        this.startAudioStreaming();
        resolve();
      };

      ws.onmessage = (msg) => {
        try {
          const evt = JSON.parse(msg.data);
          this.handleServerEvent(evt);
        } catch (err: any) {
          console.warn("[OpenAIRealtimeWs] message parse failed:", err?.message);
        }
      };

      ws.onerror = (evt) => {
        console.error("[OpenAIRealtimeWs] WS error:", evt);
        this.callbacks.onError("Voice connection error");
        if (!this.connected) reject(new Error("WS open failed"));
      };

      ws.onclose = (ev) => {
        this.connected = false;
        this.cancelPlayback();
        if (this.intentionalDisconnect) {
          this.callbacks.onStatusChange("disconnected");
          return;
        }
        if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          this.reconnectAttempts++;
          this.callbacks.onStatusChange("reconnecting");
          const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1);
          this.reconnectTimer = setTimeout(() => {
            this.openWebSocket().catch(() => undefined);
          }, delay);
        } else {
          this.callbacks.onError(`Voice disconnected (code ${ev.code}); max reconnects exceeded`);
          this.callbacks.onStatusChange("error");
        }
      };
    });
  }

  private send(payload: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify(payload));
    } catch (err: any) {
      console.warn("[OpenAIRealtimeWs] send failed:", err?.message);
    }
  }

  // ── Inbound event handling ──

  private handleServerEvent(evt: any): void {
    this.callbacks.onRawEvent?.(evt);
    const type: string = evt.type;
    switch (type) {
      case "session.created":
      case "session.updated":
        return;

      case "response.audio.delta":
      case "response.output_audio.delta": {
        const b64: string = evt.delta || evt.audio || "";
        if (!b64) return;
        this.enqueuePcmChunk(b64);
        if (!this.speaking) {
          this.speaking = true;
          this.duckMic();
          this.callbacks.onStatusChange("speaking");
        }
        return;
      }

      case "response.audio.done":
      case "response.output_audio.done":
        this.speaking = false;
        this.callbacks.onStatusChange("listening");
        this.scheduleMicUnmute();
        return;

      case "response.audio_transcript.delta":
      case "response.output_audio_transcript.delta": {
        const text = typeof evt.delta === "string" ? evt.delta : "";
        if (text) {
          this.callbacks.onTranscript({ role: "assistant", text, timestamp: Date.now(), isFinal: false });
        }
        return;
      }

      case "response.audio_transcript.done":
      case "response.output_audio_transcript.done": {
        const text = typeof evt.transcript === "string" ? evt.transcript : "";
        this.callbacks.onTranscript({ role: "assistant", text, timestamp: Date.now(), isFinal: true });
        return;
      }

      case "conversation.item.input_audio_transcription.delta": {
        const text = typeof evt.delta === "string" ? evt.delta : "";
        if (text) {
          this.callbacks.onTranscript({ role: "user", text, timestamp: Date.now(), isFinal: false });
        }
        return;
      }

      case "conversation.item.input_audio_transcription.completed": {
        const text = typeof evt.transcript === "string" ? evt.transcript : "";
        this.callbacks.onTranscript({ role: "user", text, timestamp: Date.now(), isFinal: true });
        return;
      }

      case "response.function_call_arguments.done": {
        try {
          const args = JSON.parse(evt.arguments || "{}");
          this.callbacks.onToolCall({ name: evt.name, args, callId: evt.call_id });
          this.outstandingToolCalls++;
        } catch (err: any) {
          console.warn("[OpenAIRealtimeWs] tool args parse failed:", err?.message, evt.arguments);
        }
        return;
      }

      case "input_audio_buffer.speech_started":
        if (this.speaking) {
          this.send({ type: "response.cancel" });
          this.cancelPlayback();
          this.speaking = false;
        }
        return;

      case "input_audio_buffer.speech_stopped":
        return;

      case "error": {
        const code = (evt.error?.code as string) || "";
        const msg =
          (evt.error?.message as string) ||
          (typeof evt.message === "string" ? evt.message : "Voice error");
        // A redundant response.create while one is active is BENIGN.
        if (
          code === "conversation_already_has_active_response" ||
          msg.toLowerCase().includes("already has an active response")
        ) {
          console.warn("[OpenAIRealtimeWs] ignored benign error:", msg);
          if (this.toolAnswerPending) this.pendingToolResponseCreate = true;
          return;
        }
        this.callbacks.onError(msg);
        return;
      }

      case "response.created":
        this.activeResponse = true;
        this.toolAnswerPending = false;
        this.pendingToolResponseCreate = false;
        this.outstandingToolCalls = 0;
        return;

      case "response.done":
        this.activeResponse = false;
        if (this.pendingToolResponseCreate) {
          this.pendingToolResponseCreate = false;
          this.send(TOOL_ANSWER_RESPONSE_CREATE);
        }
        return;

      case "response.cancelled":
        this.activeResponse = false;
        if (this.pendingToolResponseCreate) {
          this.pendingToolResponseCreate = false;
          this.send(TOOL_ANSWER_RESPONSE_CREATE);
        }
        return;

      default:
        return;
    }
  }

  // ── Mic capture ──

  private async setupAudioInput(opts?: { prewarmedMicStream?: MediaStream }): Promise<void> {
    if (opts?.prewarmedMicStream) {
      this.micStream = opts.prewarmedMicStream;
    } else {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: SAMPLE_RATE,
          channelCount: 1,
        } as MediaTrackConstraints,
        video: false,
      });
    }

    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AC({ sampleRate: SAMPLE_RATE });
    if (this.audioContext!.state === "suspended") {
      await this.audioContext!.resume();
    }

    const source = this.audioContext!.createMediaStreamSource(this.micStream);
    this.micGainNode = this.audioContext!.createGain();
    this.micGainNode.gain.value = 1.0;
    this.analyserNode = this.audioContext!.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.scriptProcessor = this.audioContext!.createScriptProcessor(AUDIO_CHUNK_SIZE, 1, 1);

    source.connect(this.micGainNode);
    this.micGainNode.connect(this.analyserNode);
    this.analyserNode.connect(this.scriptProcessor);
    // ScriptProcessor MUST connect onward for onaudioprocess to fire on iOS.
    const silentSink = this.audioContext!.createGain();
    silentSink.gain.value = 0;
    this.scriptProcessor.connect(silentSink);
    silentSink.connect(this.audioContext!.destination);

    const levelBuf = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.audioLevelInterval = setInterval(() => {
      if (!this.analyserNode) return;
      this.analyserNode.getByteFrequencyData(levelBuf);
      let sum = 0;
      for (let i = 0; i < levelBuf.length; i++) sum += levelBuf[i];
      this.callbacks.onAudioLevel(sum / levelBuf.length / 255);
    }, 100);

    this.playbackContext = new AC({ sampleRate: SAMPLE_RATE });
    if (this.playbackContext!.state === "suspended") {
      await this.playbackContext!.resume();
    }
    // Compressor → gain chain compensates for OpenAI TTS amplitude + iOS
    // secondary-context attenuation (Meridian V1.8.3).
    this.playbackCompressor = this.playbackContext!.createDynamicsCompressor();
    this.playbackCompressor.threshold.value = -12;
    this.playbackCompressor.ratio.value = 4;
    this.playbackCompressor.attack.value = 0.005;
    this.playbackCompressor.release.value = 0.05;
    this.playbackCompressor.knee.value = 6;
    this.playbackGainNode = this.playbackContext!.createGain();
    this.playbackGainNode.gain.value = 2.0;
    this.playbackCompressor.connect(this.playbackGainNode);
    this.playbackGainNode.connect(this.playbackContext!.destination);
    this.nextPlayTime = this.playbackContext!.currentTime;
  }

  private startAudioStreaming(): void {
    if (!this.scriptProcessor) return;
    this.scriptProcessor.onaudioprocess = (event) => {
      if (this.micMuted) return;
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      const input = event.inputBuffer.getChannelData(0);
      const pcm = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      this.send({ type: "input_audio_buffer.append", audio: int16ToBase64(pcm) });
    };
  }

  // ── Playback ──

  private enqueuePcmChunk(b64: string): void {
    if (!this.playbackContext) return;
    if (this.playbackContext.state === "suspended") {
      this.playbackContext.resume().catch(() => {
        /* recovers on next user gesture */
      });
    }
    const pcm = base64ToInt16(b64);
    const f32 = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) {
      f32[i] = pcm[i] / (pcm[i] < 0 ? 0x8000 : 0x7fff);
    }
    const buf = this.playbackContext.createBuffer(1, f32.length, SAMPLE_RATE);
    buf.copyToChannel(f32, 0);
    const src = this.playbackContext.createBufferSource();
    src.buffer = buf;
    if (this.playbackCompressor) {
      src.connect(this.playbackCompressor);
    } else if (this.playbackGainNode) {
      src.connect(this.playbackGainNode);
    } else {
      src.connect(this.playbackContext.destination);
    }
    const now = this.playbackContext.currentTime;
    const startAt = Math.max(this.nextPlayTime, now);
    src.start(startAt);
    this.nextPlayTime = startAt + buf.duration;
    this.playbackQueue.push(src);
    src.onended = () => {
      const i = this.playbackQueue.indexOf(src);
      if (i >= 0) this.playbackQueue.splice(i, 1);
    };
  }

  private cancelPlayback(): void {
    for (const src of this.playbackQueue) {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    }
    this.playbackQueue = [];
    if (this.playbackContext) {
      this.nextPlayTime = this.playbackContext.currentTime;
    }
  }

  // ── Mic ducking ──

  private duckMic(): void {
    this.micMuted = true;
    if (this.micGainNode) this.micGainNode.gain.value = 0;
    if (this.unmuteMicTimeout) {
      clearTimeout(this.unmuteMicTimeout);
      this.unmuteMicTimeout = null;
    }
  }

  private scheduleMicUnmute(): void {
    if (this.unmuteMicTimeout) clearTimeout(this.unmuteMicTimeout);
    this.unmuteMicTimeout = setTimeout(() => {
      this.micMuted = false;
      if (this.micGainNode) this.micGainNode.gain.value = 1;
      this.unmuteMicTimeout = null;
    }, MIC_UNMUTE_DELAY_MS);
  }

  // ── Teardown ──

  private teardownAudio(): void {
    if (this.audioLevelInterval) {
      clearInterval(this.audioLevelInterval);
      this.audioLevelInterval = null;
    }
    if (this.scriptProcessor) {
      try {
        this.scriptProcessor.disconnect();
      } catch {
        /* ignore */
      }
      this.scriptProcessor.onaudioprocess = null;
      this.scriptProcessor = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => undefined);
      this.audioContext = null;
    }
    this.cancelPlayback();
    if (this.playbackCompressor) {
      try {
        this.playbackCompressor.disconnect();
      } catch {
        /* already disconnected */
      }
      this.playbackCompressor = null;
    }
    if (this.playbackGainNode) {
      try {
        this.playbackGainNode.disconnect();
      } catch {
        /* already disconnected */
      }
      this.playbackGainNode = null;
    }
    if (this.playbackContext) {
      this.playbackContext.close().catch(() => undefined);
      this.playbackContext = null;
    }
  }
}

// ─── PCM16 / base64 helpers ──────────────────────────────────────────────────

function int16ToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(slice) as any);
  }
  return btoa(binary);
}

function base64ToInt16(b64: string): Int16Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
}
