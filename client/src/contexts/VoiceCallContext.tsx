/**
 * VoiceCallContext — owns the realtime voice call, decoupled from any overlay.
 *
 * C14: `isCallActive` and `isOverlayOpen` are independent. Closing the overlay
 * must NOT end the call; the persistent mini-player keeps it alive while the
 * user navigates. The provider lives above the router (mounted in main.tsx) so
 * the engine survives page changes.
 *
 * The provider also dispatches the model's read-only tool calls back through
 * tRPC (`realtime.executeTool`) and feeds results to the engine.
 */

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { trpc } from "@/lib/trpc";
import {
  OpenAIRealtimeWsEngine,
  type RealtimeWsCallbacks,
} from "@/lib/openaiRealtimeWsEngine";
import { GeminiLiveEngine } from "@/lib/geminiLiveEngine";

/**
 * The public surface both engines expose, so the provider can be swapped
 * transparently (C16: Gemini Live default, OpenAI Realtime opt-in). Both
 * GeminiLiveEngine and OpenAIRealtimeWsEngine satisfy this structurally.
 */
interface VoiceEngine {
  connect(opts?: { prewarmedMicStream?: MediaStream }): Promise<void>;
  disconnect(): Promise<void>;
  sendToolResponse(callId: string, name: string, result: Record<string, any>): void;
  sendTextMessage(text: string): void;
  interrupt(): void;
  sendEvent(event: Record<string, any>): void;
  isOpen(): boolean;
  setMicMuted(muted: boolean): void;
}

export type VoiceStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "speaking"
  | "listening"
  | "processing"
  | "reconnecting"
  | "error"
  | "disconnected";

export interface TranscriptLine {
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}

interface VoiceCallState {
  status: VoiceStatus;
  isCallActive: boolean;
  isOverlayOpen: boolean;
  isMuted: boolean;
  audioLevel: number;
  transcript: TranscriptLine[];
  partial: { user: string; assistant: string };
  companyId: number | null;
  companyName: string | null;
  error: string | null;
  startCall: (companyId: number, companyName: string) => Promise<void>;
  endCall: () => void;
  toggleMute: () => void;
  openOverlay: () => void;
  closeOverlay: () => void;
}

const VoiceCallContext = createContext<VoiceCallState | null>(null);

const LIVE_STATUSES: VoiceStatus[] = [
  "connecting",
  "connected",
  "speaking",
  "listening",
  "processing",
  "reconnecting",
];

export function VoiceCallProvider({ children }: { children: ReactNode }) {
  const utils = trpc.useUtils();
  const engineRef = useRef<VoiceEngine | null>(null);
  const companyIdRef = useRef<number | null>(null);
  const partialRef = useRef<{ user: string; assistant: string }>({ user: "", assistant: "" });

  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [partial, setPartial] = useState<{ user: string; assistant: string }>({ user: "", assistant: "" });
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isCallActive = LIVE_STATUSES.includes(status);

  const teardown = useCallback(() => {
    const engine = engineRef.current;
    engineRef.current = null;
    if (engine) void engine.disconnect();
    // Best-effort release of the server-side single-session lock.
    utils.client.realtime.endSession.mutate().catch(() => undefined);
    partialRef.current = { user: "", assistant: "" };
    setPartial({ user: "", assistant: "" });
    setAudioLevel(0);
    setIsMuted(false);
  }, [utils]);

  const startCall = useCallback(
    async (cid: number, cname: string) => {
      // Replace any prior call cleanly.
      if (engineRef.current) teardown();
      setError(null);
      setTranscript([]);
      partialRef.current = { user: "", assistant: "" };
      setPartial({ user: "", assistant: "" });
      setCompanyId(cid);
      setCompanyName(cname);
      companyIdRef.current = cid;
      setStatus("connecting");
      setIsOverlayOpen(true);

      let session: {
        provider: "gemini" | "openai";
        ephemeralToken: string;
        authMethod?: "ephemeral" | "raw";
        model: string;
        voice: string;
        setup?: Record<string, any>;
        companyName?: string;
      };
      try {
        session = await utils.client.realtime.createSession.mutate({ companyId: cid });
      } catch (err: any) {
        setError(err?.message ?? "Could not start the voice session.");
        setStatus("error");
        return;
      }

      const callbacks: RealtimeWsCallbacks = {
        onStatusChange: (s) => setStatus(s as VoiceStatus),
        onError: (msg) => setError(msg),
        onAudioLevel: (lvl) => setAudioLevel(lvl),
        onTranscript: ({ role, text, isFinal }) => {
          if (isFinal) {
            partialRef.current[role] = "";
            setPartial({ ...partialRef.current });
            const clean = text.trim();
            if (clean) {
              setTranscript((prev) => [...prev, { role, text: clean, timestamp: Date.now() }]);
            }
          } else {
            partialRef.current[role] = (partialRef.current[role] ?? "") + text;
            setPartial({ ...partialRef.current });
          }
        },
        onToolCall: async ({ name, args, callId }) => {
          const engine = engineRef.current;
          if (!engine) return;
          const activeCompany = companyIdRef.current;
          if (activeCompany == null) {
            engine.sendToolResponse(callId, name, { error: "No active company." });
            return;
          }
          try {
            const result = await utils.client.realtime.executeTool.mutate({
              companyId: activeCompany,
              name,
              args: args ?? {},
            });
            engine.sendToolResponse(callId, name, result as Record<string, any>);
          } catch (err: any) {
            engine.sendToolResponse(callId, name, {
              error: err?.message ?? "Tool lookup failed.",
            });
          }
        },
      };

      // Pick the engine by provider. Gemini Live is the default (the
      // iOS-proven path); OpenAI Realtime is the opt-in fallback. Both
      // satisfy the VoiceEngine surface, so everything below is identical.
      const engine: VoiceEngine =
        session.provider === "openai"
          ? new OpenAIRealtimeWsEngine(
              { ephemeralToken: session.ephemeralToken, model: session.model, voice: session.voice },
              callbacks,
            )
          : new GeminiLiveEngine(
              {
                ephemeralToken: session.ephemeralToken,
                authMethod: session.authMethod,
                model: session.model,
                voice: session.voice,
                setup: session.setup as any,
              },
              callbacks,
            );
      engineRef.current = engine;
      try {
        await engine.connect();
        // The OpenAI engine doesn't self-greet, so nudge it. The Gemini
        // engine sends its own greeting trigger on setupComplete — nudging
        // it too would double-fire the opening turn.
        if (session.provider === "openai") {
          engine.sendTextMessage(
            "Greet me briefly by voice and ask what I want to think through about this company.",
          );
        }
      } catch {
        // connect() already surfaced the error via callbacks.
      }
    },
    [teardown, utils],
  );

  const endCall = useCallback(() => {
    teardown();
    setStatus("idle");
    setIsOverlayOpen(false);
    setCompanyId(null);
    setCompanyName(null);
    companyIdRef.current = null;
  }, [teardown]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      engineRef.current?.setMicMuted(next);
      return next;
    });
  }, []);

  const openOverlay = useCallback(() => setIsOverlayOpen(true), []);
  const closeOverlay = useCallback(() => setIsOverlayOpen(false), []);

  return (
    <VoiceCallContext.Provider
      value={{
        status,
        isCallActive,
        isOverlayOpen,
        isMuted,
        audioLevel,
        transcript,
        partial,
        companyId,
        companyName,
        error,
        startCall,
        endCall,
        toggleMute,
        openOverlay,
        closeOverlay,
      }}
    >
      {children}
    </VoiceCallContext.Provider>
  );
}

export function useVoiceCall(): VoiceCallState {
  const ctx = useContext(VoiceCallContext);
  if (!ctx) throw new Error("useVoiceCall must be used within VoiceCallProvider");
  return ctx;
}
