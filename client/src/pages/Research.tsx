import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Radar, Sparkles, Users, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { AnalysisHistory } from "@/components/AnalysisHistory";

interface ResearchProps {
  activeCompanyId: number | null;
}

const CONF_COLOR: Record<string, string> = {
  high: "bg-gold/10 text-gold border-gold/20",
  medium: "bg-secondary text-foreground",
  low: "border-amber-500/40 text-amber-400",
};

export default function Research({ activeCompanyId }: ResearchProps) {
  const [question, setQuestion] = useState("");
  const utils = trpc.useUtils();

  const runMut = trpc.research.run.useMutation({
    onSuccess: (r) => {
      toast.success(`Research complete — ${r.brief.specialists.length} specialists reported`);
      void utils.analysisRuns.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!activeCompanyId) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span className="font-sans text-sm">Select a company to run research.</span>
      </div>
    );
  }

  const data = runMut.data;

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-3xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl text-foreground flex items-center gap-2">
          <Radar className="h-5 w-5 text-gold" /> Research Mesh
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          A diagnosed question dispatched to a mesh of specialist research agents,
          grounded in this company's memory.
        </p>
      </div>

      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Strategic question</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. Should Northwind expand into the German mid-market?"
            className="bg-secondary/50 border-border/60 min-h-[100px] font-body"
            rows={4}
          />
          <Button
            className="w-full gradient-gold text-background font-sans gap-2"
            disabled={!question.trim() || runMut.isPending}
            onClick={() => runMut.mutate({ companyId: activeCompanyId, question: question.trim() })}
          >
            <Sparkles className="h-4 w-4" />
            {runMut.isPending ? "Diagnosing + researching…" : "Run research"}
          </Button>
          {runMut.isPending && (
            <p className="text-xs text-muted-foreground font-sans text-center">
              The mesh runs several specialist agents in parallel — this can take a moment.
            </p>
          )}
        </CardContent>
      </Card>

      {data && (
        <>
          {/* Diagnosis summary */}
          <Card className="card-glass">
            <CardHeader>
              <CardTitle className="font-heading text-lg">Diagnosis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge className="text-[10px] bg-gold/10 text-gold border-gold/20">
                  {data.diagnosis.questionType}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  confidence: {data.diagnosis.confidence}
                </Badge>
              </div>
              <p className="text-sm text-foreground font-body leading-relaxed">
                {data.diagnosis.reframedQuestion}
              </p>
            </CardContent>
          </Card>

          {/* Synthesis */}
          <Card className="card-glass">
            <CardHeader>
              <CardTitle className="font-heading text-lg flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-gold" /> Chief Strategist synthesis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-foreground font-body leading-relaxed">
                {data.brief.synthesis}
              </p>
              {data.brief.keyTakeaways.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                    Key takeaways
                  </p>
                  <ul className="space-y-1">
                    {data.brief.keyTakeaways.map((t, i) => (
                      <li key={i} className="text-sm text-foreground font-body flex gap-2">
                        <span className="text-gold">·</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Specialist findings */}
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider flex items-center gap-1.5">
              <Users className="h-3 w-3" /> {data.brief.specialists.length} specialist reports
            </p>
            {data.brief.specialists.map((s) => (
              <Card key={s.specialistId} className="card-glass">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-heading text-sm text-foreground">{s.specialistLabel}</h4>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${CONF_COLOR[s.confidence] ?? ""}`}
                    >
                      {s.confidence}
                    </Badge>
                  </div>
                  {s.summary && (
                    <p className="text-sm text-muted-foreground font-body leading-relaxed">
                      {s.summary}
                    </p>
                  )}
                  {s.findings.length > 0 && (
                    <ul className="space-y-1 pt-1">
                      {s.findings.map((f, i) => (
                        <li key={i} className="text-sm text-foreground font-body flex gap-2">
                          <span className="text-gold">·</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <AnalysisHistory companyId={activeCompanyId} kind="research" />
    </div>
  );
}
