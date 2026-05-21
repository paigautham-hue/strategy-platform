import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Scale, FlaskConical, Globe } from "lucide-react";

interface CalibrationProps {
  activeCompanyId: number | null;
}

type Stratum = {
  label: string;
  count: number;
  brier: number;
  reliability: number;
  resolution: number;
  uncertainty: number;
  hitRate: number;
};

function StratumCard({ s }: { s: Stratum }) {
  return (
    <div className="rounded border border-border/50 bg-secondary/20 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-sm font-heading text-foreground capitalize">{s.label}</p>
        <Badge variant="secondary" className="text-[10px] ml-auto">
          {s.count} closed
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-body">
        <Metric label="Brier" value={s.brier} hint="lower better" />
        <Metric label="Hit rate" value={`${(s.hitRate * 100).toFixed(0)}%`} hint="higher better" />
        <Metric label="Reliability" value={s.reliability} hint="lower better" />
        <Metric label="Resolution" value={s.resolution} hint="higher better" />
        <Metric label="Uncertainty" value={s.uncertainty} hint="base-rate" />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground">
        {label} <span className="text-[10px] opacity-60">({hint})</span>
      </span>
      <span className="text-foreground font-heading">{value}</span>
    </div>
  );
}

export default function Calibration({ activeCompanyId }: CalibrationProps) {
  const { data, isLoading } = trpc.calibration.scorecard.useQuery(
    { companyId: activeCompanyId ?? 0 },
    { enabled: !!activeCompanyId },
  );

  if (!activeCompanyId) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span className="font-sans text-sm">Select a company to view its calibration scorecard.</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl text-foreground flex items-center gap-2">
          <Scale className="h-5 w-5 text-gold" /> Calibration Scorecard
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          How well the platform's probabilistic claims hold up. Proper scoring
          rules — Brier, with Murphy's reliability / resolution / uncertainty —
          so confident hedging cannot game the score.
        </p>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground font-sans">Loading scorecard…</p>
      )}

      {data && (
        <>
          {data.real.count === 0 && data.synthetic.count === 0 ? (
            <Card className="card-glass">
              <CardContent className="p-6 text-center space-y-1">
                <p className="font-heading text-sm text-foreground">
                  No closed predictions yet
                </p>
                <p className="text-xs text-muted-foreground font-body">
                  The scorecard populates as predictions reach their horizon and
                  outcomes are logged to the ledger.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="card-glass">
                <CardHeader>
                  <CardTitle className="font-heading text-base flex items-center gap-2">
                    <Globe className="h-4 w-4 text-gold" /> Real-world calibration
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <StratumCard s={data.real} />
                </CardContent>
              </Card>

              <Card className="card-glass">
                <CardHeader>
                  <CardTitle className="font-heading text-base flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-gold" /> Synthetic calibration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <StratumCard s={data.synthetic} />
                  <p className="text-[11px] text-muted-foreground font-sans">
                    Synthetic outcomes (war-games) are scored separately and never
                    mixed into the real-world record.
                  </p>
                </CardContent>
              </Card>

              {data.byFramework.length > 0 && (
                <Card className="card-glass">
                  <CardHeader>
                    <CardTitle className="font-heading text-base">By framework</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {data.byFramework.map((s) => (
                      <StratumCard key={s.label} s={s} />
                    ))}
                  </CardContent>
                </Card>
              )}

              {data.byHorizon.length > 0 && (
                <Card className="card-glass">
                  <CardHeader>
                    <CardTitle className="font-heading text-base">By horizon</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {data.byHorizon.map((s) => (
                      <StratumCard key={s.label} s={s} />
                    ))}
                  </CardContent>
                </Card>
              )}

              {data.curve.length > 0 && (
                <Card className="card-glass">
                  <CardHeader>
                    <CardTitle className="font-heading text-base">
                      Calibration curve
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {data.curve.map((bin, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-xs font-body">
                          <span className="text-muted-foreground">
                            {(bin.lower * 100).toFixed(0)}–{(bin.upper * 100).toFixed(0)}%
                            <span className="ml-1 opacity-60">({bin.count})</span>
                          </span>
                          <span className="text-foreground">
                            forecast {(bin.meanForecast * 100).toFixed(0)}% · observed{" "}
                            {(bin.observedFrequency * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                          <div
                            className="h-full bg-gold"
                            style={{ width: `${bin.observedFrequency * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
