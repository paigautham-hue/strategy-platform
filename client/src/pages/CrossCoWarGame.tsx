import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Network,
  Building2,
  Sparkles,
  AlertTriangle,
  Flag,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { SectionLabel } from "@/components/SectionLabel";
import { cn } from "@/lib/utils";

const EXPOSURE_STYLE: Record<string, string> = {
  low: "bg-gold/10 text-gold border-gold/20",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  high: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function CrossCoWarGame() {
  const [selected, setSelected] = useState<number[]>([]);
  const [scenario, setScenario] = useState("");

  const { data: companies } = trpc.company.list.useQuery();

  const runMut = trpc.warGame.crossCompany.useMutation({
    onSuccess: (r) =>
      toast.success(`Cross-company war-game complete — ${r.findings.length} findings`),
    onError: (e) => toast.error(e.message),
  });

  const r = runMut.data;
  const nameOf = (id: number) => companies?.find((c) => c.id === id)?.name ?? `Company ${id}`;

  function toggle(id: number) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-3xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl text-foreground flex items-center gap-2">
          <Network className="h-5 w-5 text-gold" /> Cross-Company War-Game
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          Apply one shared shock — an FX swing, a supplier acquisition, a new
          regulation — across two or more portfolio companies at once, and
          surface the non-obvious synergies and correlated risks.
        </p>
        <p className="text-[11px] text-muted-foreground font-sans mt-2 flex items-center gap-1.5">
          <Shield className="h-3 w-3 text-gold" />
          GP-only. Every cross-company read is recorded to the audit log.
        </p>
      </div>

      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Companies in scope</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {companies && companies.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {companies.map((c) => (
                <button
                  key={c.id}
                  onClick={() => toggle(c.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-sans transition-colors",
                    selected.includes(c.id)
                      ? "border-gold/40 bg-gold/10 text-gold"
                      : "border-border/60 bg-secondary/40 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  {c.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground font-sans">
              No companies yet — onboard at least two to run a cross-company war-game.
            </p>
          )}
          <p className="text-xs text-muted-foreground font-sans">
            Selected {selected.length} — pick at least 2 (max 6).
          </p>
        </CardContent>
      </Card>

      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Shared scenario / shock</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            placeholder="e.g. Both portcos depend on supplier X — supplier X is acquired by a competitor. Play it out."
            className="bg-secondary/50 border-border/60 min-h-[100px] font-body"
            rows={4}
          />
          <Button
            className="w-full gradient-gold text-background font-sans gap-2"
            disabled={selected.length < 2 || !scenario.trim() || runMut.isPending}
            onClick={() =>
              runMut.mutate({ companyIds: selected, scenario: scenario.trim() })
            }
          >
            <Network className="h-4 w-4" />
            {runMut.isPending ? "Playing across the portfolio…" : "Run cross-company war-game"}
          </Button>
        </CardContent>
      </Card>

      {r && (
        <>
          <Card className="card-glass border-gold/30">
            <CardContent className="p-4 flex items-start gap-3">
              <Flag className="h-6 w-6 text-gold shrink-0" />
              <div className="space-y-1">
                <p className="font-heading text-base text-foreground">Portfolio implication</p>
                <p className="text-sm text-muted-foreground font-body leading-relaxed">
                  {r.portfolioImplication}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <SectionLabel>Per-company outcomes</SectionLabel>
            {r.companyOutcomes.map((o) => (
              <Card key={o.companyId} className="card-glass">
                <CardContent className="p-4 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gold" />
                    <p className="font-heading text-sm text-foreground">{o.companyName}</p>
                    <Badge
                      className={cn(
                        "text-[10px] ml-auto",
                        EXPOSURE_STYLE[o.exposure] ?? EXPOSURE_STYLE.medium,
                      )}
                    >
                      {o.exposure} exposure
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground font-body leading-relaxed">
                    {o.outcome}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {r.findings.length > 0 && (
            <div className="space-y-3">
              <SectionLabel>Cross-company findings</SectionLabel>
              {r.findings.map((f, i) => (
                <Card
                  key={i}
                  className={cn(
                    "card-glass",
                    f.kind === "synergy" ? "border-gold/30" : "border-destructive/30",
                  )}
                >
                  <CardContent className="p-4 flex items-start gap-3">
                    {f.kind === "synergy" ? (
                      <Sparkles className="h-5 w-5 text-gold shrink-0" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                    )}
                    <div className="space-y-1.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          f.kind === "synergy"
                            ? "border-gold/30 text-gold"
                            : "border-destructive/30 text-destructive",
                        )}
                      >
                        {f.kind}
                      </Badge>
                      <p className="text-sm text-foreground font-body leading-relaxed">
                        {f.finding}
                      </p>
                      {f.companyIds.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {f.companyIds.map((id) => (
                            <Badge key={id} variant="secondary" className="text-[10px]">
                              {nameOf(id)}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground font-sans">
            <Badge variant="secondary" className="text-[10px] mr-1.5">synthetic</Badge>
            Each company's outcome was logged to the prediction ledger as a
            synthetic outcome — kept separate from real outcomes in calibration.
          </p>
        </>
      )}
    </div>
  );
}
