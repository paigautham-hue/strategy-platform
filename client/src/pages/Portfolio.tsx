import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard, CheckCircle2, XCircle, Target } from "lucide-react";
import { toast } from "sonner";

interface Props {
  activeCompanyId: number | null;
}

export default function Portfolio({ activeCompanyId }: Props) {
  const overview = trpc.portfolio.overview.useQuery(undefined, { retry: false });
  const [actuals, setActuals] = useState<Record<number, string>>({});

  const open = trpc.prediction.listOpen.useQuery(
    { companyId: activeCompanyId ?? 0, limit: 50 },
    { enabled: activeCompanyId != null },
  );

  const resolveMut = trpc.prediction.resolve.useMutation({
    onSuccess: () => {
      toast.success("Outcome recorded");
      open.refetch();
      overview.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  if (overview.isError) {
    return (
      <div className="p-6 max-w-3xl mx-auto animate-fade-in">
        <Card className="card-glass">
          <CardContent className="p-6 text-sm text-muted-foreground font-body text-center">
            The portfolio view is GP-only. Ask an admin if you need access.
          </CardContent>
        </Card>
      </div>
    );
  }

  const data = overview.data;
  const t = data?.totals;

  function resolve(predictionId: number, held: boolean) {
    if (activeCompanyId == null) return;
    const actualValue = (actuals[predictionId] ?? "").trim() || (held ? "Claim held" : "Claim did not hold");
    resolveMut.mutate({ predictionId, companyId: activeCompanyId, held, actualValue });
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl text-foreground flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-gold" /> Portfolio
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          Cross-company prediction ledger and calibration. The learning loop fills in as predictions
          are recorded and their outcomes resolved.
        </p>
      </div>

      {/* Totals */}
      {t && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Stat label="Companies" value={t.companies} />
          <Stat label="Predictions" value={t.totalPredictions} />
          <Stat label="Resolved" value={t.closedPredictions} />
          <Stat label="Open" value={t.openPredictions} tone="text-amber-400" />
        </div>
      )}

      {/* Per-company calibration */}
      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="font-heading text-lg">By company</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(data?.companies ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground font-body">No companies yet.</p>
          )}
          {(data?.companies ?? []).map((c) => (
            <div key={c.companyId} className="rounded border border-border/40 bg-secondary/20 p-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-heading text-foreground">{c.name}</p>
                <p className="text-xs text-muted-foreground font-body">
                  {c.totalPredictions} predictions · {c.closedPredictions} resolved · {c.openPredictions} open
                </p>
              </div>
              <div className="text-right shrink-0">
                {c.realScored > 0 ? (
                  <>
                    <p className="font-heading text-lg text-gold">Brier {c.realBrier}</p>
                    <p className="text-[11px] text-muted-foreground font-sans">
                      hit {Math.round((c.realHitRate ?? 0) * 100)}% · {c.realScored} scored
                    </p>
                  </>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">no scored outcomes yet</Badge>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Resolution panel (active company) */}
      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <Target className="h-4 w-4 text-gold" /> Resolve predictions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeCompanyId == null ? (
            <p className="text-sm text-muted-foreground font-body">
              Select a company (top bar) to record the outcomes of its open predictions.
            </p>
          ) : (open.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground font-body">
              No open predictions for this company — they appear here as the platform makes claims.
            </p>
          ) : (
            (open.data ?? []).map((p) => (
              <div key={p.id} className="rounded border border-border/40 bg-secondary/20 p-3 space-y-2">
                <p className="text-sm font-body text-foreground">{p.claim}</p>
                <p className="text-[11px] text-muted-foreground font-sans">
                  confidence {Math.round(Number(p.confidence) * 100)}%
                  {p.framework ? ` · ${p.framework}` : ""}
                  {p.horizon ? ` · ${p.horizon}` : ""}
                </p>
                <Input
                  aria-label="What actually happened"
                  value={actuals[p.id] ?? ""}
                  onChange={(e) => setActuals((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  placeholder="What actually happened? (optional note)"
                  className="bg-secondary/50 border-border/60 font-body h-9 text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                    disabled={resolveMut.isPending}
                    onClick={() => resolve(p.id, true)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Held
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    disabled={resolveMut.isPending}
                    onClick={() => resolve(p.id, false)}
                  >
                    <XCircle className="h-3.5 w-3.5" /> Didn't hold
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone = "text-foreground" }: { label: string; value: number; tone?: string }) {
  return (
    <Card className="card-glass">
      <CardContent className="p-4 text-center">
        <p className="text-[11px] text-muted-foreground font-sans uppercase tracking-wider">{label}</p>
        <p className={`font-heading text-2xl mt-1 ${tone}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
