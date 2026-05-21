import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Workflow,
  Target,
  ListChecks,
  AlertTriangle,
  GitFork,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DecomposerProps {
  activeCompanyId: number | null;
}

export default function Decomposer({ activeCompanyId }: DecomposerProps) {
  const [thesis, setThesis] = useState("");

  const decomposeMut = trpc.decomposer.decompose.useMutation({
    onSuccess: (r) =>
      toast.success(
        `Decomposed into ${r.initiatives.length} initiatives, ${r.okrCount} OKRs`,
      ),
    onError: (e) => toast.error(e.message),
  });

  if (!activeCompanyId) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span className="font-sans text-sm">Select a company to decompose a strategy.</span>
      </div>
    );
  }

  const r = decomposeMut.data;

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-3xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl text-foreground flex items-center gap-2">
          <Workflow className="h-5 w-5 text-gold" /> Strategy Decomposer
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          The Strategy → Execution bridge. Turn a thesis into concrete
          initiatives, each with OKRs and a task list. Every objective is
          challenged for a measurable key result.
        </p>
      </div>

      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Strategy thesis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={thesis}
            onChange={(e) => setThesis(e.target.value)}
            placeholder="State the strategy to decompose into execution…"
            className="bg-secondary/50 border-border/60 min-h-[110px] font-body"
            rows={5}
          />
          <Button
            className="w-full gradient-gold text-background font-sans gap-2"
            disabled={!thesis.trim() || decomposeMut.isPending}
            onClick={() =>
              decomposeMut.mutate({ companyId: activeCompanyId, thesis: thesis.trim() })
            }
          >
            <Workflow className="h-4 w-4" />
            {decomposeMut.isPending ? "Decomposing…" : "Decompose into execution"}
          </Button>
        </CardContent>
      </Card>

      {r && (
        <>
          {r.vagueObjectives.length > 0 && (
            <Card className="card-glass border-destructive/40">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                <div className="space-y-1">
                  <p className="font-heading text-sm text-foreground">
                    {r.vagueObjectives.length} objective
                    {r.vagueObjectives.length === 1 ? "" : "s"} lack a measurable key result
                  </p>
                  <ul className="space-y-0.5">
                    {r.vagueObjectives.map((o, i) => (
                      <li key={i} className="text-xs text-muted-foreground font-body">
                        · {o}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}

          <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
            {r.initiatives.length} initiatives · {r.okrCount} OKRs
          </p>

          {r.initiatives.map((ini, idx) => (
            <Card key={idx} className="card-glass">
              <CardHeader>
                <CardTitle className="font-heading text-base flex items-center gap-2">
                  <Target className="h-4 w-4 text-gold" /> {ini.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground font-body leading-relaxed">
                  {ini.rationale}
                </p>

                <div className="flex flex-wrap gap-2">
                  {ini.expectedImpact && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <TrendingUp className="h-3 w-3" /> {ini.expectedImpact}
                    </Badge>
                  )}
                  {ini.costEstimate && (
                    <Badge variant="outline" className="text-[10px]">
                      cost: {ini.costEstimate}
                    </Badge>
                  )}
                  <Badge className="text-[10px] bg-gold/10 text-gold border-gold/20">
                    confidence {(ini.confidence * 100).toFixed(0)}%
                  </Badge>
                </div>

                {ini.dependencies.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <GitFork className="h-3.5 w-3.5 text-muted-foreground" />
                    {ini.dependencies.map((d, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">
                        {d}
                      </Badge>
                    ))}
                  </div>
                )}

                {ini.okrs.map((okr, oi) => (
                  <div
                    key={oi}
                    className="rounded border border-border/50 bg-secondary/20 p-3 space-y-2"
                  >
                    <p className="text-sm font-heading text-foreground">{okr.objective}</p>
                    <ul className="space-y-1">
                      {okr.keyResults.map((kr, ki) => (
                        <li key={ki} className="text-sm text-foreground font-body flex gap-2">
                          <span
                            className={cn(
                              "text-gold mt-0.5",
                              !kr.quantitative && "text-destructive",
                            )}
                          >
                            ·
                          </span>
                          <span className="flex-1">{kr.text}</span>
                          <Badge variant="outline" className="text-[9px] h-4 shrink-0">
                            {kr.indicator}
                          </Badge>
                          {!kr.quantitative && (
                            <Badge
                              variant="outline"
                              className="text-[9px] h-4 shrink-0 border-destructive/40 text-destructive"
                            >
                              not measurable
                            </Badge>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

                {ini.tasks.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider flex items-center gap-1.5">
                      <ListChecks className="h-3 w-3" /> Tasks
                    </p>
                    <ul className="space-y-1">
                      {ini.tasks.map((t, ti) => (
                        <li key={ti} className="text-sm text-foreground font-body flex gap-2">
                          <span className="text-gold">·</span>
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
