import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Mic, Square, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  isSpeechRecognitionSupported,
  startDictation,
  type DictationHandle,
} from "@/lib/speech";

interface VoiceIntakeProps {
  activeCompanyId: number | null;
}

export default function VoiceIntake({ activeCompanyId }: VoiceIntakeProps) {
  const [, navigate] = useLocation();
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const dictationRef = useRef<DictationHandle | null>(null);
  const speechSupported = isSpeechRecognitionSupported();

  // Editable draft after parsing
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [parsed, setParsed] = useState(false);

  useEffect(() => () => dictationRef.current?.abort(), []);

  const parseMut = trpc.voice.parseIntent.useMutation({
    onSuccess: (intent) => {
      setDraftName(intent.projectName);
      setDraftDescription(intent.projectDescription);
      setParsed(true);
      if (intent.confidence === "low") {
        toast.warning("Low confidence — please review the draft before creating.");
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const createMut = trpc.project.create.useMutation({
    onSuccess: () => {
      toast.success("Strategy project created from your voice intake");
      navigate("/projects");
    },
    onError: (e) => toast.error(e.message),
  });

  function toggleListening() {
    if (listening) {
      dictationRef.current?.stop();
      return;
    }
    setTranscript("");
    setParsed(false);
    const handle = startDictation({
      onTranscript: setTranscript,
      onDone: (finalText) => {
        setListening(false);
        setTranscript(finalText);
      },
      onError: (msg) => {
        setListening(false);
        toast.error(msg);
      },
    });
    if (!handle) {
      toast.error("Voice capture could not start. Type your request instead.");
      return;
    }
    dictationRef.current = handle;
    setListening(true);
  }

  if (!activeCompanyId) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span className="font-sans text-sm">Select a company to start a voice intake.</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl text-foreground flex items-center gap-2">
          <Mic className="h-5 w-5 text-gold" /> Voice Intake
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          Speak a strategic question — it becomes a new project draft.
        </p>
      </div>

      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="font-heading text-lg">
            {speechSupported ? "Dictate your request" : "Type your request"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {speechSupported && (
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                className={`font-sans gap-2 ${
                  listening ? "bg-destructive text-destructive-foreground" : "gradient-gold text-background"
                }`}
                onClick={toggleListening}
              >
                {listening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {listening ? "Stop" : "Start dictation"}
              </Button>
              {listening && (
                <span className="text-xs text-gold font-sans flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-gold animate-pulse" /> Listening…
                </span>
              )}
            </div>
          )}

          <Textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="e.g. Should we expand Northwind into the German mid-market, and what would it take?"
            className="bg-secondary/50 border-border/60 min-h-[120px] font-body"
            rows={5}
          />

          <Button
            className="w-full gradient-gold text-background font-sans gap-2"
            disabled={!transcript.trim() || parseMut.isPending}
            onClick={() =>
              parseMut.mutate({ companyId: activeCompanyId, transcript: transcript.trim() })
            }
          >
            <Sparkles className="h-4 w-4" />
            {parseMut.isPending ? "Parsing intent…" : "Parse into a project"}
          </Button>
        </CardContent>
      </Card>

      {parsed && (
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-gold" /> Project draft
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground font-sans bg-secondary/40 rounded p-2 border border-border/40">
              Review and edit the draft, then create the project.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                Project name
              </label>
              <Textarea
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className="bg-secondary/50 border-border/60 font-body"
                rows={1}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                Description
              </label>
              <Textarea
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                className="bg-secondary/50 border-border/60 font-body"
                rows={4}
              />
            </div>
            <Button
              className="w-full gradient-gold text-background font-sans"
              disabled={!draftName.trim() || createMut.isPending}
              onClick={() =>
                createMut.mutate({
                  companyId: activeCompanyId,
                  name: draftName.trim().slice(0, 255),
                  description: draftDescription.trim() || undefined,
                })
              }
            >
              {createMut.isPending ? "Creating…" : "Create strategy project"}
            </Button>
          </CardContent>
        </Card>
      )}

      {!speechSupported && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground font-sans">
          <Badge variant="outline" className="text-[10px]">note</Badge>
          <span>
            Your browser does not support in-browser speech recognition — type the request above.
            (Chrome and Edge support dictation.)
          </span>
        </div>
      )}
    </div>
  );
}
