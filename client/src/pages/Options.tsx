import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ListChecks, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";
import { AnalysisHistory } from "@/components/AnalysisHistory";

interface OptionsProps {
  activeCompanyId: number | null;
}

const CRITERIA: { id: string; label: string }[] = [
  { id: "strategic_fit", label: "Strategic fit" },
  { id: "market_attractiveness", label: "Market" },
  { id: "capability_fit", label: "Capability" },
  { id: "financial_return", label: "Financial" },
  { id: "execution_safety", label: "Safety" },
  { id: "time_to_value", label: "Speed" },
  { id: "reversibility", label: "Reversible" },
  { id: "synergy_value", label: "Synergy" },
];

export default function Options({ activeCompanyId }: OptionsProps) {
  const [question, setQuestion] = useState("");
  const utils = trpc.useUtils();

  const analyzeMut = trpc.options.analyze.useMutation({
    onSuccess: (r) => {
      toast.success(`${r.options.length} options generated and scored`);
      void utils.analysisRuns.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!activeCompanyId) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span className="font-sans text-sm">Select a company to generate strategic options.</span>
      </div>
    );
  }

  const data = analyzeMut.data;

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-3xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl text-foreground flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-gold" /> Strategic Options
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          Distinct options generated and scored by multi-criteria decision analysis,
          ranked by weighted score.
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
            placeholder="e.g. How should we respond to a low-cost new entrant?"
            className="bg-secondary/50 border-border/60 min-h-[100px] font-body"
            rows={4}
          />
          <Button
            className="w-full gradient-gold text-background font-sans gap-2"
            disabled={!question.trim() || analyzeMut.isPending}
            onClick={() =>
              analyzeMut.mutate({ companyId: activeCompanyId, question: question.trim() })
            }
          >
            <Sparkles className="h-4 w-4" />
            {analyzeMut.isPending ? "Generating + scoring options…" : "Generate options"}
          </Button>
        </CardContent>
      </Card>

      {data && data.options.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {data.options.length} options
            </Badge>
            <Badge
              variant="outline"
              className={`text-[10px] ${
                data.rankingRobust ? "border-gold/40 text-gold" : "border-amber-500/40 text-amber-400"
              }`}
            >
              {data.rankingRobust ? "ranking robust to ±20% weights" : "ranking weight-sensitive"}
            </Badge>
          </div>

          {data.options.map((o, idx) => (
            <Card key={o.optionId} className={`card-glass ${idx === 0 ? "border-gold/30" : ""}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {idx === 0 && <Trophy className="h-4 w-4 text-gold" />}
                      <h4 className="font-heading text-base text-foreground">{o.title}</h4>
                    </div>
                    <p className="text-sm text-muted-foreground font-body leading-relaxed mt-1">
                      {o.description}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-secondary/30 px-3 py-1.5 text-center shrink-0">
                    <p className="text-[10px] text-muted-foreground font-sans uppercase">MCDA</p>
                    <p className="font-heading text-xl text-gold">{o.weightedScore.toFixed(1)}</p>
                  </div>
                </div>
                {o.rationale && (
                  <p className="text-xs text-muted-foreground font-sans italic">{o.rationale}</p>
                )}
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                  {CRITERIA.map((c) => (
                    <div key={c.id} className="text-center">
                      <p className="text-[9px] text-muted-foreground font-sans truncate">{c.label}</p>
                      <p className="text-sm font-heading text-foreground">
                        {(o.scores[c.id] ?? 0).toFixed(0)}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AnalysisHistory companyId={activeCompanyId} kind="options" />
    </div>
  );
}
