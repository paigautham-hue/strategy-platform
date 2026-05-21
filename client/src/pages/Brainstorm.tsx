import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Lightbulb,
  Mic,
  Square,
  Sparkles,
  ListChecks,
  HelpCircle,
  AlertTriangle,
  FlaskConical,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  startDictation,
  isSpeechRecognitionSupported,
  type DictationHandle,
} from "@/lib/speech";

interface BrainstormProps {
  activeCompanyId: number | null;
}

const PHASES = [
  { id: "diverge", label: "Diverge", goal: "Generate many possibilities without judging." },
  { id: "probe", label: "Probe", goal: "Dig into the most promising threads." },
  { id: "sharpen", label: "Sharpen", goal: "Narrow to the strongest options." },
  { id: "lock", label: "Lock", goal: "Commit to a direction and next actions." },
] as const;

type PhaseId = (typeof PHASES)[number]["id"];

const CATEGORIES = [
  { key: "hypotheses", label: "Hypotheses", icon: FlaskConical },
  { key: "options", label: "Options", icon: ListChecks },
  { key: "assumptions", label: "Assumptions", icon: Lightbulb },
  { key: "risks", label: "Risks", icon: AlertTriangle },
  { key: "openQuestions", label: "Open questions", icon: HelpCircle },
] as const;

export default function Brainstorm({ activeCompanyId }: BrainstormProps) {
  const [phase, setPhase] = useState<PhaseId>("diverge");
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const dictationRef = useRef<DictationHandle | null>(null);
  const baseTextRef = useRef("");

  const extractMut = trpc.brainstorm.extract.useMutation({
    onSuccess: (c) =>
      toast.success(
        `Captured ${
          c.hypotheses.length +
          c.options.length +
          c.assumptions.length +
          c.risks.length +
          c.openQuestions.length
        } items`,
      ),
    onError: (e) => toast.error(e.message),
  });

  const recapMut = trpc.brainstorm.recap.useMutation({
    onError: (e) => toast.error(e.message),
  });

  if (!activeCompanyId) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span className="font-sans text-sm">Select a company to run a brainstorm.</span>
      </div>
    );
  }

  function toggleDictation() {
    if (listening) {
      dictationRef.current?.stop();
      return;
    }
    if (!isSpeechRecognitionSupported()) {
      toast.error("Voice dictation is not supported in this browser — type instead.");
      return;
    }
    baseTextRef.current = transcript ? transcript.trimEnd() + "\n" : "";
    const handle = startDictation({
      onTranscript: (text) => setTranscript(baseTextRef.current + text),
      onDone: (finalText) => {
        setTranscript(baseTextRef.current + finalText);
        setListening(false);
        dictationRef.current = null;
      },
      onError: (message) => {
        toast.error(message);
        setListening(false);
        dictationRef.current = null;
      },
    });
    if (!handle) {
      toast.error("Could not start dictation.");
      return;
    }
    dictationRef.current = handle;
    setListening(true);
  }

  const captures = extractMut.data;
  const recap = recapMut.data;
  const canRun = transcript.trim().length > 0;

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-3xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl text-foreground flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-gold" /> Brainstorm Mode
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          Think out loud through four phases. Five silent extractors capture the
          hypotheses, options, assumptions, risks, and open questions — then a
          recap names the themes and the next moves.
        </p>
      </div>

      {/* Phase stepper */}
      <div className="flex gap-2">
        {PHASES.map((p, i) => (
          <button
            key={p.id}
            onClick={() => setPhase(p.id)}
            className={cn(
              "flex-1 rounded-md border px-3 py-2 text-left transition-colors",
              p.id === phase
                ? "border-gold/40 bg-gold/10"
                : "border-border/60 bg-secondary/30 hover:bg-secondary/50",
            )}
          >
            <p
              className={cn(
                "text-xs font-sans uppercase tracking-wider",
                p.id === phase ? "text-gold" : "text-muted-foreground",
              )}
            >
              {i + 1}. {p.label}
            </p>
            <p className="text-[11px] text-muted-foreground font-body mt-0.5 leading-snug">
              {p.goal}
            </p>
          </button>
        ))}
      </div>

      <Card className="card-glass">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-heading text-lg">Session transcript</CardTitle>
          <Button
            variant={listening ? "destructive" : "outline"}
            size="sm"
            className="gap-1.5 font-sans"
            onClick={toggleDictation}
          >
            {listening ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            {listening ? "Stop" : "Dictate"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Type or dictate the brainstorm — ideas, half-thoughts, tangents and all…"
            className="bg-secondary/50 border-border/60 min-h-[180px] font-body"
            rows={9}
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="font-sans gap-2 flex-1"
              disabled={!canRun || extractMut.isPending}
              onClick={() =>
                extractMut.mutate({ companyId: activeCompanyId, transcript: transcript.trim() })
              }
            >
              <ListChecks className="h-4 w-4" />
              {extractMut.isPending ? "Capturing…" : "Extract captures"}
            </Button>
            <Button
              className="gradient-gold text-background font-sans gap-2 flex-1"
              disabled={!canRun || recapMut.isPending}
              onClick={() =>
                recapMut.mutate({
                  companyId: activeCompanyId,
                  transcript: transcript.trim(),
                  captures: captures ?? undefined,
                })
              }
            >
              <Sparkles className="h-4 w-4" />
              {recapMut.isPending ? "Recapping…" : "Close & recap"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Draft tray */}
      {captures && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
            Draft tray
          </p>
          {CATEGORIES.map((cat) => {
            const items = captures[cat.key];
            if (items.length === 0) return null;
            const Icon = cat.icon;
            return (
              <Card key={cat.key} className="card-glass">
                <CardContent className="p-4 space-y-2">
                  <p className="text-xs font-sans uppercase tracking-wider text-gold flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" />
                    {cat.label}
                    <Badge variant="secondary" className="text-[10px] ml-1">
                      {items.length}
                    </Badge>
                  </p>
                  <ul className="space-y-1">
                    {items.map((item, i) => (
                      <li
                        key={i}
                        className="text-sm text-foreground font-body leading-relaxed flex gap-2"
                      >
                        <span className="text-gold">·</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Recap card */}
      {recap && (
        <Card className="card-glass border-gold/30">
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-gold" /> Session recap
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-foreground font-body leading-relaxed whitespace-pre-line">
              {recap.recap}
            </p>
            {recap.suggestedMoves.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                  Suggested next moves
                </p>
                <ul className="space-y-1">
                  {recap.suggestedMoves.map((m, i) => (
                    <li
                      key={i}
                      className="text-sm text-foreground font-body leading-relaxed flex gap-2"
                    >
                      <ArrowRight className="h-3.5 w-3.5 text-gold shrink-0 mt-0.5" />
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
