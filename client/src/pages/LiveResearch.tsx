import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Radar, Loader2, CheckCircle2, Brain, Sparkles } from "lucide-react";

interface Props {
  activeCompanyId: number | null;
}

type Confidence = "high" | "medium" | "low";
interface SpecialistFindings {
  specialistId: string;
  specialistLabel: string;
  findings: string[];
  summary: string;
  confidence: Confidence;
}
interface SpecialistNode {
  id: string;
  label: string;
  lens: string;
  status: "pending" | "done";
  result?: SpecialistFindings;
}

const CONF_TONE: Record<Confidence, string> = {
  high: "text-emerald-400",
  medium: "text-gold",
  low: "text-amber-400",
};

export default function LiveResearch({ activeCompanyId }: Props) {
  const [question, setQuestion] = useState("");
  const [running, setRunning] = useState(false);
  const [nodes, setNodes] = useState<SpecialistNode[]>([]);
  const [memoryCount, setMemoryCount] = useState<number | null>(null);
  const [synthesizing, setSynthesizing] = useState(false);
  const [brief, setBrief] = useState<{ synthesis: string; keyTakeaways: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Tear down the stream on unmount or company switch.
    return () => esRef.current?.close();
  }, []);
  useEffect(() => {
    esRef.current?.close();
    setRunning(false);
  }, [activeCompanyId]);

  function run() {
    if (activeCompanyId == null || !question.trim() || running) return;
    esRef.current?.close();
    setRunning(true);
    setNodes([]);
    setMemoryCount(null);
    setSynthesizing(false);
    setBrief(null);
    setError(null);

    const url = `/api/research/stream?question=${encodeURIComponent(question.trim())}&companyId=${activeCompanyId}`;
    const es = new EventSource(url, { withCredentials: true });
    esRef.current = es;

    es.onmessage = (ev) => {
      let e: any;
      try {
        e = JSON.parse(ev.data);
      } catch {
        return;
      }
      switch (e.type) {
        case "start":
          setNodes(e.specialists.map((s: { id: string; label: string; lens: string }) => ({ ...s, status: "pending" })));
          break;
        case "memory":
          setMemoryCount(e.count);
          break;
        case "specialist":
          setNodes((prev) =>
            prev.map((n) => (n.id === e.result.specialistId ? { ...n, status: "done", result: e.result } : n)),
          );
          break;
        case "synthesizing":
          setSynthesizing(true);
          break;
        case "complete":
          setSynthesizing(false);
          setBrief({ synthesis: e.brief.synthesis, keyTakeaways: e.brief.keyTakeaways });
          break;
        case "error":
          setError(e.message ?? "Research failed");
          break;
      }
    };
    es.addEventListener("end", () => {
      es.close();
      setRunning(false);
    });
    es.onerror = () => {
      es.close();
      setRunning(false);
      setError((prev) => prev ?? "The research stream was interrupted.");
    };
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-3xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl text-foreground flex items-center gap-2">
          <Radar className="h-5 w-5 text-gold" /> Live Research
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          Watch the research mesh work in real time — each specialist appears as it finishes, then the
          Chief Strategist synthesises.
        </p>
      </div>

      {activeCompanyId == null ? (
        <Card className="card-glass">
          <CardContent className="p-4 text-sm text-muted-foreground font-body text-center">
            Select a company (top bar) to ground the research in its memory.
          </CardContent>
        </Card>
      ) : (
        <Card className="card-glass">
          <CardContent className="p-4 flex gap-2">
            <Input
              aria-label="Research question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
              placeholder="e.g. Should we expand the Bible-books export line into the US?"
              className="bg-secondary/50 border-border/60 font-body"
            />
            <Button className="gradient-gold text-background gap-1.5" disabled={!question.trim() || running} onClick={run}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
              {running ? "Running" : "Research"}
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="card-glass border-red-500/30">
          <CardContent className="p-4 text-sm text-red-400 font-body">{error}</CardContent>
        </Card>
      )}

      {/* Activity tree */}
      {nodes.length > 0 && (
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="font-heading text-base flex items-center gap-2">
              <Brain className="h-4 w-4 text-gold" /> Research mesh
              {memoryCount != null && (
                <Badge variant="secondary" className="text-[10px] ml-1">
                  {memoryCount} memories grounding
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {nodes.map((n) => (
              <div key={n.id} className="rounded border border-border/40 bg-secondary/20 p-3">
                <div className="flex items-center gap-2">
                  {n.status === "done" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />
                  )}
                  <span className="text-sm font-heading text-foreground">{n.label}</span>
                  {n.result && (
                    <Badge variant="outline" className={`text-[10px] ml-auto ${CONF_TONE[n.result.confidence]}`}>
                      {n.result.confidence}
                    </Badge>
                  )}
                </div>
                {n.result ? (
                  <div className="mt-1.5 pl-6 space-y-1">
                    {n.result.summary && <p className="text-xs text-muted-foreground font-body">{n.result.summary}</p>}
                    {n.result.findings.map((f, i) => (
                      <p key={i} className="text-xs text-foreground font-body">• {f}</p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 pl-6 text-xs text-muted-foreground font-body italic">{n.lens}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Synthesis */}
      {(synthesizing || brief) && (
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="font-heading text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-gold" /> Synthesis
              {synthesizing && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {brief ? (
              <>
                <p className="text-sm font-body text-foreground leading-relaxed">{brief.synthesis}</p>
                {brief.keyTakeaways.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-sans uppercase tracking-wider text-gold">Key takeaways</p>
                    {brief.keyTakeaways.map((t, i) => (
                      <p key={i} className="text-sm text-foreground font-body">• {t}</p>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground font-body">Composing the picture…</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
