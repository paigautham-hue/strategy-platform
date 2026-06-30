/**
 * VoiceOverlay — full-screen realtime-voice surface.
 *
 * C14: closing this overlay (the X / minimize) does NOT end the call — it
 * just hides the surface and reveals the persistent mini-player. Only the
 * "End" button tears the call down.
 */

import { useEffect, useRef } from "react";
import { useVoiceCall } from "@/contexts/VoiceCallContext";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, PhoneOff, ChevronDown, Radio } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  connecting: "Connecting…",
  connected: "Listening",
  listening: "Listening",
  speaking: "Speaking",
  processing: "Thinking…",
  reconnecting: "Reconnecting…",
  error: "Connection error",
  disconnected: "Disconnected",
  idle: "Idle",
};

export function VoiceOverlay() {
  const {
    status,
    isCallActive,
    isOverlayOpen,
    isMuted,
    audioLevel,
    transcript,
    partial,
    companyName,
    error,
    endCall,
    toggleMute,
    closeOverlay,
  } = useVoiceCall();

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [transcript, partial]);

  if (!isCallActive || !isOverlayOpen) return null;

  const speaking = status === "speaking";
  const orbScale = 1 + Math.min(audioLevel * 1.4, 0.6);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background/95 backdrop-blur-xl animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-gold" />
          <div>
            <p className="font-heading text-sm text-foreground">Cairn Voice</p>
            <p className="text-[11px] text-muted-foreground font-sans">{companyName}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={closeOverlay}
          className="gap-1.5 text-muted-foreground"
          aria-label="Minimize voice call"
        >
          <ChevronDown className="h-4 w-4" /> Minimize
        </Button>
      </div>

      {/* Orb + status */}
      <div className="flex flex-col items-center justify-center gap-4 py-8">
        <div className="relative flex items-center justify-center h-40 w-40">
          <div
            className={`absolute rounded-full transition-transform duration-100 ${
              speaking ? "bg-gold/30" : "bg-gold/15"
            }`}
            style={{ height: "10rem", width: "10rem", transform: `scale(${orbScale})` }}
          />
          <div
            className={`relative h-24 w-24 rounded-full gradient-gold flex items-center justify-center ${
              isMuted ? "opacity-50" : ""
            } ${status === "listening" || status === "connected" ? "animate-pulse" : ""}`}
          >
            {isMuted ? (
              <MicOff className="h-9 w-9 text-background" />
            ) : (
              <Mic className="h-9 w-9 text-background" />
            )}
          </div>
        </div>
        <p className="font-sans text-sm text-gold uppercase tracking-widest">
          {STATUS_LABEL[status] ?? status}
        </p>
        {error && <p className="text-xs text-red-400 font-body max-w-sm text-center">{error}</p>}
      </div>

      {/* Transcript */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 pb-4 max-w-2xl mx-auto w-full space-y-3">
        {transcript.length === 0 && !partial.user && !partial.assistant && (
          <p className="text-center text-sm text-muted-foreground font-body mt-8">
            Start speaking — ask about strategy, predictions, or what's in memory for this company.
          </p>
        )}
        {transcript.map((line, i) => (
          <TranscriptBubble key={i} role={line.role} text={line.text} />
        ))}
        {partial.user && <TranscriptBubble role="user" text={partial.user} faded />}
        {partial.assistant && <TranscriptBubble role="assistant" text={partial.assistant} faded />}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 py-6 border-t border-border/40">
        <Button
          variant="outline"
          size="lg"
          onClick={toggleMute}
          className={`gap-2 ${isMuted ? "border-gold/50 text-gold" : ""}`}
        >
          {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          {isMuted ? "Unmute" : "Mute"}
        </Button>
        <Button variant="destructive" size="lg" onClick={endCall} className="gap-2">
          <PhoneOff className="h-4 w-4" /> End
        </Button>
      </div>
    </div>
  );
}

function TranscriptBubble({
  role,
  text,
  faded,
}: {
  role: "user" | "assistant";
  text: string;
  faded?: boolean;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm font-body ${
          isUser ? "bg-gold/15 text-foreground" : "bg-secondary/50 text-foreground"
        } ${faded ? "opacity-60" : ""}`}
      >
        {text}
      </div>
    </div>
  );
}
