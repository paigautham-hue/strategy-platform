import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Microscope,
  CheckCircle2,
  XCircle,
  Shuffle,
  GitCompareArrows,
  Lightbulb,
  Network,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AttributionProps {
  activeCompanyId: number | null;
}

const CONTRIB_STYLE: Record<string, string> = {
  high: "bg-gold/10 text-gold border-gold/20",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  low: "bg-secondary text-muted-foreground border-border/40",
};

export default function Attribution({ activeCompanyId }: AttributionProps) {
  const [initiative, setInitiative] = useState("");
  const [outcome, setOutcome] = useState("");
  const [context, setContext] = useState("");

  const analyzeMut = trpc.attribution.analyze.useMutation({
    onSuccess: (r) =>
      toast.success(
        r.hasFailureTrace
          ? "Attribution complete"
          : "Attribution complete — no failure traces surfaced (review)",
      ),
    onError: (e) => toast.error(e.message),
  });

  if (!activeCompanyId) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span className="font-sans text-sm">Select a company to attribute an initiative.</span>
      </div>
    );
  }

  const r = analyzeMut.data;

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl text-foreground flex items-center gap-2">
          <Microscope className="h-5 w-5 text-gold" /> Causal Attribution
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          When an initiative completes: did it cause the outcome, or would it
          have happened anyway? Variables changed, a counterfactual, credit
          assignment, named confounders, and a post-mortem framed as hypotheses.
        </p>
      </div>

      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Completed initiative</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={initiative}
            onChange={(e) => setInitiative(e.target.value)}
            placeholder="The initiative that completed…"
            className="bg-secondary/50 border-border/60 font-body"
          />
          <Textarea
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            placeholder="The outcome — what actually happened…"
            className="bg-secondary/50 border-border/60 min-h-[80px] font-body"
            rows={3}
          />
          <Textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Optional — execution log, timeline, market conditions…"
            className="bg-secondary/50 border-border/60 min-h-[70px] font-body"
            rows={3}
          />
          <Button
            className="w-full gradient-gold text-background font-sans gap-2"
            disabled={!initiative.trim() || !outcome.trim() || analyzeMut.isPending}
            onClick={() =>
              analyzeMut.mutate({
                companyId: activeCompanyId,
                initiative: initiative.trim(),
                outcome: outcome.trim(),
                context: context.trim() || undefined,
              })
            }
          >
            <Microscope className="h-4 w-4" />
            {analyzeMut.isPending ? "Attributing…" : "Run attribution"}
          </Button>
        </CardContent>
      </Card>

      {r && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <ListCard
              icon={CheckCircle2}
              title="What worked"
              items={r.whatWorked}
              tone="gold"
            />
            <ListCard
              icon={XCircle}
              title="What didn't"
              items={r.whatDidnt}
              tone="destructive"
            />
          </div>

          {r.variablesChanged.length > 0 && (
            <ListCard
              icon={Shuffle}
              title="Variables changed"
              items={r.variablesChanged}
              tone="gold"
            />
          )}

          <Card className="card-glass">
            <CardHeader>
              <CardTitle className="font-heading text-base flex items-center gap-2">
                <GitCompareArrows className="h-4 w-4 text-gold" /> Counterfactual
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground font-body leading-relaxed">
                {r.counterfactual}
              </p>
            </CardContent>
          </Card>

          {r.creditAssignment.length > 0 && (
            <Card className="card-glass">
              <CardHeader>
                <CardTitle className="font-heading text-base">Credit assignment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {r.creditAssignment.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        c.isInternal
                          ? "border-gold/30 text-gold"
                          : "border-border/50 text-muted-foreground",
                      )}
                    >
                      {c.isInternal ? "internal" : "external"}
                    </Badge>
                    <span className="text-sm text-foreground font-body flex-1">{c.factor}</span>
                    <Badge className={cn("text-[10px]", CONTRIB_STYLE[c.contribution])}>
                      {c.contribution}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {r.confounders.length > 0 && (
            <ListCard
              icon={Network}
              title="Confounders to condition on"
              items={r.confounders}
              tone="amber"
            />
          )}

          <Card className="card-glass border-gold/30">
            <CardContent className="p-4 flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-gold shrink-0" />
              <div className="space-y-1">
                <p className="font-heading text-sm text-foreground">Lesson</p>
                <p className="text-sm text-muted-foreground font-body leading-relaxed">
                  {r.lesson}
                </p>
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground font-sans">
            <Badge variant="secondary" className="text-[10px] mr-1.5">hypotheses</Badge>
            Attribution outputs are hypotheses — confirm them before they land in
            procedural memory.
          </p>
        </>
      )}
    </div>
  );
}

function ListCard({
  icon: Icon,
  title,
  items,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  items: string[];
  tone: "gold" | "destructive" | "amber";
}) {
  const toneClass =
    tone === "destructive" ? "text-destructive" : tone === "amber" ? "text-amber-400" : "text-gold";
  return (
    <Card className="card-glass">
      <CardContent className="p-4 space-y-2">
        <p
          className={cn(
            "text-xs font-sans uppercase tracking-wider flex items-center gap-1.5",
            toneClass,
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {title}
        </p>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground font-sans">None surfaced.</p>
        ) : (
          <ul className="space-y-1">
            {items.map((item, i) => (
              <li key={i} className="text-sm text-foreground font-body flex gap-2">
                <span className={toneClass}>·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
