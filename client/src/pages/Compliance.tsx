import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ShieldCheck, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComplianceProps {
  activeCompanyId: number | null;
}

function rateColor(rate: number): string {
  if (rate >= 0.9) return "text-gold";
  if (rate >= 0.7) return "text-amber-400";
  return "text-destructive";
}

function barColor(rate: number): string {
  if (rate >= 0.9) return "bg-gold";
  if (rate >= 0.7) return "bg-amber-400";
  return "bg-destructive";
}

export default function Compliance({ activeCompanyId }: ComplianceProps) {
  const { data, isLoading } = trpc.compliance.auditPredictions.useQuery(
    { companyId: activeCompanyId ?? 0 },
    { enabled: !!activeCompanyId },
  );

  if (!activeCompanyId) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span className="font-sans text-sm">Select a company to run the constitutional audit.</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl text-foreground flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-gold" /> Constitutional Audit
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          The anti-hallucination audit measures principle-compliance, not vibes.
          A small constitution of explicit, checkable rules is applied to every
          claim in the prediction ledger.
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground font-sans">Running audit…</p>}

      {data && (
        <>
          <Card className="card-glass">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="text-center">
                <p
                  className={cn(
                    "font-heading text-3xl",
                    rateColor(data.overallComplianceRate),
                  )}
                >
                  {(data.overallComplianceRate * 100).toFixed(0)}%
                </p>
                <p className="text-[10px] text-muted-foreground font-sans uppercase tracking-wider">
                  compliant
                </p>
              </div>
              <div className="flex-1">
                <p className="font-heading text-sm text-foreground">
                  Audited {data.sampleSize} ledger {data.sampleSize === 1 ? "claim" : "claims"}
                </p>
                <p className="text-xs text-muted-foreground font-body">
                  {data.flagged.length} flagged for review
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="card-glass">
            <CardHeader>
              <CardTitle className="font-heading text-base">Principle compliance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.principles.map((p) => (
                <div key={p.principleId} className="space-y-1">
                  <div className="flex justify-between text-xs font-body">
                    <span className="text-foreground">{p.label}</span>
                    <span className="text-muted-foreground">
                      {p.applicable === 0 ? (
                        "n/a"
                      ) : (
                        <>
                          {p.applicable - p.violations}/{p.applicable} ·{" "}
                          <span className={rateColor(p.complianceRate)}>
                            {(p.complianceRate * 100).toFixed(0)}%
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                    <div
                      className={cn("h-full", barColor(p.complianceRate))}
                      style={{ width: `${p.complianceRate * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {data.flagged.length > 0 && (
            <Card className="card-glass border-destructive/30">
              <CardHeader>
                <CardTitle className="font-heading text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" /> Flagged claims
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.flagged.map((f, i) => (
                  <div
                    key={i}
                    className="rounded border border-border/50 bg-secondary/20 p-2.5 space-y-1.5"
                  >
                    <p className="text-sm text-foreground font-body leading-relaxed">{f.claim}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {f.violatedPrinciples.map((p) => (
                        <Badge
                          key={p}
                          variant="outline"
                          className="text-[9px] border-destructive/30 text-destructive"
                        >
                          {p}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {data.sampleSize === 0 && (
            <p className="text-xs text-muted-foreground font-sans text-center">
              No ledger claims to audit yet.
            </p>
          )}
        </>
      )}
    </div>
  );
}
