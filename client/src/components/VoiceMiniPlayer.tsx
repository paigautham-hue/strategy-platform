/**
 * VoiceMiniPlayer — persistent control bar shown while a voice call is live
 * but the full overlay is minimized (C14). Lets the user keep navigating the
 * app with the call running, re-open the overlay, or end the call.
 */

import { useVoiceCall } from "@/contexts/VoiceCallContext";
import { Button } from "@/components/ui/button";
import { Maximize2, PhoneOff, Mic, MicOff, Radio } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  connecting: "Connecting…",
  connected: "Listening",
  listening: "Listening",
  speaking: "Speaking",
  processing: "Thinking…",
  reconnecting: "Reconnecting…",
};

export function VoiceMiniPlayer() {
  const {
    status,
    isCallActive,
    isOverlayOpen,
    isMuted,
    companyName,
    openOverlay,
    endCall,
    toggleMute,
  } = useVoiceCall();

  // Visible only when a call is live AND the overlay is minimized (C14).
  if (!isCallActive || isOverlayOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-full border border-gold/30 bg-card/95 backdrop-blur px-4 py-2 shadow-lg animate-fade-in">
      <span className="relative flex h-2.5 w-2.5">
        <span
          className={`absolute inline-flex h-full w-full rounded-full bg-gold opacity-75 ${
            status === "speaking" ? "animate-ping" : ""
          }`}
        />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-gold" />
      </span>
      <div className="flex items-center gap-1.5">
        <Radio className="h-3.5 w-3.5 text-gold" />
        <div className="leading-tight">
          <p className="text-xs font-heading text-foreground max-w-[120px] truncate">{companyName}</p>
          <p className="text-[10px] text-muted-foreground font-sans">
            {STATUS_LABEL[status] ?? "On call"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={toggleMute}
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <MicOff className="h-3.5 w-3.5 text-gold" /> : <Mic className="h-3.5 w-3.5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={openOverlay}
          aria-label="Expand voice call"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-red-400 hover:text-red-300"
          onClick={endCall}
          aria-label="End voice call"
        >
          <PhoneOff className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
