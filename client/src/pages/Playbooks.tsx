import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  BookOpen,
  Zap,
  CheckCircle2,
  Target,
  ArrowUpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AnalysisHistory } from "@/components/AnalysisHistory";

interface PlaybooksProps {
  activeCompanyId: number | null;
}

export default function Playbooks({ activeCompanyId }: PlaybooksProps) {
  const [pattern, setPattern] = useState("");
  const [evidence, setEvidence] = useState("");

  const draftMut = trpc.playbook.draft.useMutation({
    onSuccess: (p) => toast.success(`Drafted and saved: ${p.title}`),
    onError: (e) => toast.error(e.message),
  });

  if (!activeCompanyId) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span className="font-sans text-sm">Select a company to draft a playbook.</span>
      </div>
    );
  }

  const p = draftMut.data;

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl text-foreground flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-gold" /> Playbook Engine
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          Turn a recurring pattern into a reusable strategic playbook — trigger
          conditions, gated steps, expected outcomes. Playbooks are promoted
          project → company → portfolio only after passing outcome checks.
        </p>
      </div>

      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Recurring pattern</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="Describe the recurring decision pattern and what tends to work…"
            className="bg-secondary/50 border-border/60 min-h-[110px] font-body"
            rows={5}
          />
          <Textarea
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder="Optional — summary of the evidence projects this pattern is drawn from…"
            className="bg-secondary/50 border-border/60 min-h-[70px] font-body"
            rows={3}
          />
          <Button
            className="w-full gradient-gold text-background font-sans gap-2"
            disabled={!pattern.trim() || draftMut.isPending}
            onClick={() =>
              draftMut.mutate({
                companyId: activeCompanyId,
                pattern: pattern.trim(),
                evidenceSummary: evidence.trim() || undefined,
              })
            }
          >
            <BookOpen className="h-4 w-4" />
            {draftMut.isPending ? "Drafting…" : "Draft playbook"}
          </Button>
        </CardContent>
      </Card>

      {p && (
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-gold" /> {p.title}
              <Badge variant="secondary" className="text-[10px] ml-auto capitalize">
                {p.layer} layer
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {p.triggerConditions.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="h-3 w-3" /> Trigger conditions
                </p>
                <ul className="space-y-1">
                  {p.triggerConditions.map((t, i) => (
                    <li key={i} className="text-sm text-foreground font-body flex gap-2">
                      <span className="text-gold">·</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                Steps
              </p>
              {p.steps.map((s) => (
                <div
                  key={s.order}
                  className="rounded border border-border/50 bg-secondary/20 p-2.5 space-y-1"
                >
                  <p className="text-sm text-foreground font-body flex gap-2">
                    <span className="text-gold font-heading">{s.order}.</span>
                    <span>{s.action}</span>
                  </p>
                  <p className="text-xs text-muted-foreground font-body flex items-center gap-1.5 pl-5">
                    <Target className="h-3 w-3 text-gold" /> Gate: {s.gate}
                  </p>
                </div>
              ))}
            </div>

            {p.expectedOutcomes.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3" /> Expected outcomes
                </p>
                <ul className="space-y-1">
                  {p.expectedOutcomes.map((o, i) => (
                    <li key={i} className="text-sm text-foreground font-body flex gap-2">
                      <span className="text-gold">·</span>
                      <span>{o}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <AnalysisHistory companyId={activeCompanyId} kind="playbook" title="Saved playbooks" />

      <Card className="card-glass">
        <CardContent className="p-4 space-y-2">
          <p className="text-xs font-sans uppercase tracking-wider text-gold flex items-center gap-1.5">
            <ArrowUpCircle className="h-3.5 w-3.5" /> Promotion ladder
          </p>
          <p className="text-xs text-muted-foreground font-body leading-relaxed">
            A new playbook starts at the <strong>project</strong> layer.
            Promotion to <strong>company</strong> requires the outcome gate — ≥ 3
            evidence projects at ≥ 50% hit rate. Promotion to{" "}
            <strong>portfolio</strong> additionally requires diversity — evidence
            spanning ≥ 2 industries, geos, or stages. A playbook below a 30% hit
            rate after 6 months is auto-retired.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
