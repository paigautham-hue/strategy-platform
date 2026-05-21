/**
 * Browser speech-to-text wrapper — IMPLEMENTATION_PLAN.md Workstream 1.5
 *
 * One-shot voice intake uses the browser's Web Speech API: transcription
 * happens client-side, so there is no audio upload and no server STT call.
 * Where the API is unavailable (e.g. Firefox), the caller falls back to a
 * typed text input.
 *
 * Realtime WebRTC voice (the always-on copilot) is Phase 4 — this is the
 * lightweight one-shot path.
 */

/** Minimal shape of the Web Speech API we depend on. */
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Is browser speech recognition available? */
export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

export interface DictationHandle {
  /** Stop dictation and resolve the in-progress transcript. */
  stop(): void;
  /** Abort without resolving. */
  abort(): void;
}

export interface DictationCallbacks {
  /** Fired as interim + final text accumulates — for live display. */
  onTranscript: (text: string) => void;
  /** Fired once when dictation ends, with the final transcript. */
  onDone: (finalText: string) => void;
  /** Fired on error (permission denied, no speech, etc.). */
  onError: (message: string) => void;
}

/**
 * Begin one-shot dictation. Returns a handle to stop it, or null when the
 * Web Speech API is unavailable (the caller should offer a text input).
 */
export function startDictation(
  callbacks: DictationCallbacks,
  lang = "en-US",
): DictationHandle | null {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) return null;

  const recognition = new Ctor();
  recognition.lang = lang;
  recognition.continuous = true;
  recognition.interimResults = true;

  let finalText = "";
  let aborted = false;

  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const chunk = result[0]?.transcript ?? "";
      if (result.isFinal) finalText += chunk;
      else interim += chunk;
    }
    callbacks.onTranscript((finalText + interim).trim());
  };

  recognition.onerror = (event) => {
    if (event.error === "no-speech") return; // benign — keep listening
    callbacks.onError(describeSpeechError(event.error));
  };

  recognition.onend = () => {
    if (!aborted) callbacks.onDone(finalText.trim());
  };

  try {
    recognition.start();
  } catch {
    return null;
  }

  return {
    stop: () => recognition.stop(),
    abort: () => {
      aborted = true;
      recognition.abort();
    },
  };
}

function describeSpeechError(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access was denied. Allow it in your browser settings, or type instead.";
    case "audio-capture":
      return "No microphone was found.";
    case "network":
      return "Speech recognition lost its network connection.";
    default:
      return `Speech recognition error: ${code}`;
  }
}
