import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Mic,
  Square,
  FileText,
  Copy,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  startDictation,
  isSpeechRecognitionSupported,
  type DictationHandle,
} from "@/lib/speech";

interface MemoDictationProps {
  activeCompanyId: number | null;
}

type MemoSection = { heading: string; body: string };
type StructuredMemo = {
  title: string;
  executiveSummary: string;
  sections: MemoSection[];
  decisions: string[];
  nextActions: string[];
};

function toMarkdown(m: StructuredMemo): string {
  const lines = [`# ${m.title}`, "", m.executiveSummary, ""];
  for (const s of m.sections) lines.push(`## ${s.heading}`, "", s.body, "");
  if (m.decisions.length) lines.push("## Decisions", "", ...m.decisions.map((d) => `- ${d}`), "");
  if (m.nextActions.length) lines.push("## Next actions", "", ...m.nextActions.map((a) => `- ${a}`), "");
  return lines.join("\n").trim();
}

export default function MemoDictation({ activeCompanyId }: MemoDictationProps) {
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [copied, setCopied] = useState(false);
  const dictationRef = useRef<DictationHandle | null>(null);
  const baseTextRef = useRef("");

  const structureMut = trpc.memo.structure.useMutation({
    onSuccess: () => toast.success("Memo structured"),
    onError: (e) => toast.error(e.message),
  });

  if (!activeCompanyId) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span className="font-sans text-sm">Select a company to dictate a memo.</span>
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

  const memo = structureMut.data;

  async function copyMarkdown() {
    if (!memo) return;
    try {
      await navigator.clipboard.writeText(toMarkdown(memo));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Memo copied as markdown");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl text-foreground flex items-center gap-2">
          <FileText className="h-5 w-5 text-gold" /> Memo Dictation
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          Think out loud for a few minutes — the platform structures the
          monologue into a clean one-page memo.
        </p>
      </div>

      <Card className="card-glass">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-heading text-lg">Dictate or type</CardTitle>
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
            placeholder="Talk through the situation, your thinking, the decision, and what happens next…"
            className="bg-secondary/50 border-border/60 min-h-[180px] font-body"
            rows={9}
          />
          <Button
            className="w-full gradient-gold text-background font-sans gap-2"
            disabled={!transcript.trim() || structureMut.isPending}
            onClick={() =>
              structureMut.mutate({ companyId: activeCompanyId, transcript: transcript.trim() })
            }
          >
            <FileText className="h-4 w-4" />
            {structureMut.isPending ? "Structuring…" : "Structure into memo"}
          </Button>
        </CardContent>
      </Card>

      {memo && (
        <Card className="card-glass">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <CardTitle className="font-heading text-lg">{memo.title}</CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 font-sans shrink-0"
              onClick={copyMarkdown}
            >
              {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-gold" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy markdown"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded border border-gold/20 bg-gold/5 p-3">
              <p className="text-xs font-sans uppercase tracking-wider text-gold">
                Executive summary
              </p>
              <p className="text-sm text-foreground font-body mt-1 leading-relaxed">
                {memo.executiveSummary}
              </p>
            </div>

            {memo.sections.map((s, i) => (
              <div key={i} className="space-y-1">
                <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                  {s.heading}
                </p>
                <p className="text-sm text-foreground font-body leading-relaxed whitespace-pre-line">
                  {s.body}
                </p>
              </div>
            ))}

            {memo.decisions.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                  Decisions
                </p>
                <ul className="space-y-1">
                  {memo.decisions.map((d, i) => (
                    <li key={i} className="text-sm text-foreground font-body flex gap-2">
                      <span className="text-gold">·</span>
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {memo.nextActions.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                  Next actions
                </p>
                <ul className="space-y-1">
                  {memo.nextActions.map((a, i) => (
                    <li key={i} className="text-sm text-foreground font-body flex gap-2">
                      <ArrowRight className="h-3.5 w-3.5 text-gold shrink-0 mt-0.5" />
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-muted-foreground font-sans">
              <Badge variant="secondary" className="text-[10px] mr-1.5">structured</Badge>
              Faithful to what was dictated — review before sharing.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
