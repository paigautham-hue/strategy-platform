import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dices, LineChart as LineChartIcon, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip, Cell } from "recharts";

// Inputs are in ₹ Cr (the MGPS convention); a USD equivalent is shown via the FX rate.
const FIELDS: { id: keyof FormState; label: string; hint?: string }[] = [
  { id: "baseRevenue", label: "Base revenue (₹ Cr)" },
  { id: "ebitdaMargin", label: "EBITDA margin (%)" },
  { id: "taxRate", label: "Tax rate (%)" },
  { id: "discountRate", label: "Discount rate (%)" },
  { id: "terminalGrowthRate", label: "Terminal growth (%)" },
  { id: "revenueVolatility", label: "Revenue volatility (σ%)" },
  { id: "marginVolatility", label: "Margin volatility (σ%)" },
  { id: "growthVolatility", label: "Growth volatility (σ%)" },
];

interface FormState {
  baseRevenue: string;
  ebitdaMargin: string;
  taxRate: string;
  discountRate: string;
  terminalGrowthRate: string;
  revenueVolatility: string;
  marginVolatility: string;
  growthVolatility: string;
}

// MGPS-flavoured defaults so the page is useful on first load.
const DEFAULTS: FormState = {
  baseRevenue: "569",
  ebitdaMargin: "10",
  taxRate: "25",
  discountRate: "14",
  terminalGrowthRate: "4",
  revenueVolatility: "8",
  marginVolatility: "5",
  growthVolatility: "6",
};

function fmtCr(n: number): string {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr`;
}

export default function Simulation() {
  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [growth, setGrowth] = useState("18, 17, 20, 18");
  const [seed, setSeed] = useState("1");

  const { data: fx } = trpc.currency.rate.useQuery();
  const runMut = trpc.simulation.run.useMutation({ onError: (e) => toast.error(e.message) });
  const scenMut = trpc.simulation.scenarios.useMutation({ onError: (e) => toast.error(e.message) });

  // Once inputs change, the displayed results/charts no longer match — clear them.
  const clearResults = () => {
    runMut.reset();
    scenMut.reset();
  };

  const growthRates = useMemo(
    () =>
      growth
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n)),
    [growth],
  );

  const valid =
    growthRates.length >= 1 &&
    FIELDS.every((f) => form[f.id] !== "" && Number.isFinite(Number(form[f.id])));

  function buildInput() {
    return {
      baseRevenue: Number(form.baseRevenue),
      growthRates,
      ebitdaMargin: Number(form.ebitdaMargin),
      taxRate: Number(form.taxRate),
      discountRate: Number(form.discountRate),
      terminalGrowthRate: Number(form.terminalGrowthRate),
      revenueVolatility: Number(form.revenueVolatility),
      marginVolatility: Number(form.marginVolatility),
      growthVolatility: Number(form.growthVolatility),
    };
  }

  function run() {
    if (!valid) return;
    const s = Number(seed);
    runMut.mutate({ input: buildInput(), seed: Number.isFinite(s) ? s : 1 });
  }

  function compare() {
    if (!valid) return;
    const s = Number(seed);
    scenMut.mutate({ input: buildInput(), seed: Number.isFinite(s) ? s : 1 });
  }

  const result = runMut.data;
  const rate = fx?.rate ?? 83;
  const usdEquiv = (cr: number) => (cr * 1e7) / rate / 1e6; // ₹Cr → $M

  const percentileData = useMemo(() => {
    if (!result) return [];
    const p = result.percentiles;
    return [
      { name: "P10", value: p.p10 },
      { name: "P25", value: p.p25 },
      { name: "P50", value: p.p50 },
      { name: "P75", value: p.p75 },
      { name: "P90", value: p.p90 },
    ];
  }, [result]);

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl text-foreground flex items-center gap-2">
          <Dices className="h-5 w-5 text-gold" /> Financial Simulation
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          Monte Carlo projection of NPV, IRR and downside risk over a multi-year revenue plan.
          Seeded, so the same inputs reproduce the same distribution.
        </p>
      </div>

      {/* Inputs */}
      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Projection inputs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="growth-rates" className="text-[11px] text-muted-foreground font-sans uppercase tracking-wider">
              Per-year growth rates (%, comma-separated — sets the horizon)
            </label>
            <Input
              id="growth-rates"
              value={growth}
              onChange={(e) => {
                setGrowth(e.target.value);
                clearResults();
              }}
              placeholder="18, 17, 20, 18"
              className="bg-secondary/50 border-border/60 font-body h-9"
            />
            <p className="text-[11px] text-muted-foreground font-body">
              {growthRates.length} year{growthRates.length === 1 ? "" : "s"} parsed
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {FIELDS.map((f) => (
              <div key={f.id} className="space-y-1">
                <label htmlFor={`sim-${f.id}`} className="text-[11px] text-muted-foreground font-sans uppercase tracking-wider">
                  {f.label}
                </label>
                <Input
                  id={`sim-${f.id}`}
                  type="number"
                  value={form[f.id]}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, [f.id]: e.target.value }));
                    clearResults();
                  }}
                  className="bg-secondary/50 border-border/60 font-body h-9"
                />
              </div>
            ))}
            <div className="space-y-1">
              <label htmlFor="sim-seed" className="text-[11px] text-muted-foreground font-sans uppercase tracking-wider">
                Seed
              </label>
              <Input
                id="sim-seed"
                type="number"
                value={seed}
                onChange={(e) => {
                  setSeed(e.target.value);
                  clearResults();
                }}
                className="bg-secondary/50 border-border/60 font-body h-9"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              className="gradient-gold text-background font-sans gap-2"
              disabled={!valid || runMut.isPending}
              onClick={run}
            >
              <Dices className="h-4 w-4" />
              {runMut.isPending ? "Simulating…" : "Run 10,000 paths"}
            </Button>
            <Button
              variant="outline"
              className="font-sans gap-2"
              disabled={!valid || scenMut.isPending}
              onClick={compare}
            >
              <LineChartIcon className="h-4 w-4" />
              {scenMut.isPending ? "Comparing…" : "Compare scenarios"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="card-glass">
              <CardContent className="p-4 text-center">
                <p className="text-[11px] text-muted-foreground font-sans uppercase tracking-wider">
                  Mean NPV
                </p>
                <p className="font-heading text-2xl text-gold mt-1">{fmtCr(result.statistics.meanNPV)}</p>
                <p className="text-[11px] text-muted-foreground font-body">
                  ≈ ${usdEquiv(result.statistics.meanNPV).toLocaleString("en-US", { maximumFractionDigits: 1 })}M @ ₹{rate}/$
                </p>
              </CardContent>
            </Card>
            <Card className="card-glass">
              <CardContent className="p-4 text-center">
                <p className="text-[11px] text-muted-foreground font-sans uppercase tracking-wider">
                  Median NPV
                </p>
                <p className="font-heading text-2xl text-foreground mt-1">{fmtCr(result.statistics.medianNPV)}</p>
                <p className="text-[11px] text-muted-foreground font-body">σ {fmtCr(result.statistics.stdDevNPV)}</p>
              </CardContent>
            </Card>
            <Card className="card-glass">
              <CardContent className="p-4 text-center">
                <p className="text-[11px] text-muted-foreground font-sans uppercase tracking-wider">
                  Probability of loss
                </p>
                <p className="font-heading text-2xl text-amber-400 mt-1 flex items-center justify-center gap-1">
                  <TrendingDown className="h-4 w-4" />
                  {Math.round(result.riskMetrics.probabilityOfLoss * 100)}%
                </p>
                <p className="text-[11px] text-muted-foreground font-body">
                  Sharpe {result.riskMetrics.sharpeRatio === null ? "—" : result.riskMetrics.sharpeRatio}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="card-glass">
            <CardHeader>
              <CardTitle className="font-heading text-lg">NPV distribution (percentiles)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={percentileData}>
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={70} />
                  <RTooltip
                    formatter={(v: number) => fmtCr(v)}
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {percentileData.map((d, i) => (
                      <Cell key={i} fill={d.value < 0 ? "var(--destructive, #ef4444)" : "#D4AF37"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                <RiskStat label="VaR 95%" value={fmtCr(result.riskMetrics.valueAtRisk95)} />
                <RiskStat label="VaR 99%" value={fmtCr(result.riskMetrics.valueAtRisk99)} />
                <RiskStat label="Expected shortfall" value={fmtCr(result.riskMetrics.expectedShortfall)} />
                <RiskStat label="Paths" value={result.meta.numSimulations.toLocaleString("en-US")} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Scenario comparison */}
      {scenMut.data && (
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Best / base / worst</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <ScenarioCard label="Best" tone="text-gold" value={fmtCr(scenMut.data.bestCase.statistics.meanNPV)} />
            <ScenarioCard label="Base" tone="text-foreground" value={fmtCr(scenMut.data.baseCase.statistics.meanNPV)} />
            <ScenarioCard label="Worst" tone="text-amber-400" value={fmtCr(scenMut.data.worstCase.statistics.meanNPV)} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RiskStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border/40 bg-secondary/20 p-2.5 text-center">
      <p className="text-[10px] text-muted-foreground font-sans uppercase tracking-wider">{label}</p>
      <p className="text-sm font-heading text-foreground mt-0.5">{value}</p>
    </div>
  );
}

function ScenarioCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded border border-border/40 bg-secondary/20 p-3 text-center">
      <Badge variant="outline" className="text-[10px] mb-1">
        {label}
      </Badge>
      <p className={`font-heading text-lg ${tone}`}>{value}</p>
    </div>
  );
}
