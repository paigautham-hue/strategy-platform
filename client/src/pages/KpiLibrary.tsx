import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calculator, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";

const CATEGORY_LABELS: Record<string, string> = {
  "unit-economics": "Unit economics",
  retention: "Retention",
  growth: "Growth",
  efficiency: "Efficiency",
  liquidity: "Liquidity",
};

export default function KpiLibrary() {
  const [selectedId, setSelectedId] = useState<string>("");
  const [inputs, setInputs] = useState<Record<string, string>>({});

  const { data: kpis } = trpc.kpi.list.useQuery();

  const computeMut = trpc.kpi.compute.useMutation({
    onError: (e) => toast.error(e.message),
  });

  const selected = useMemo(
    () => kpis?.find((k) => k.id === selectedId),
    [kpis, selectedId],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, typeof kpis>();
    for (const k of kpis ?? []) {
      const list = map.get(k.category) ?? [];
      list.push(k);
      map.set(k.category, list);
    }
    return Array.from(map.entries());
  }, [kpis]);

  function pick(id: string) {
    setSelectedId(id);
    setInputs({});
    computeMut.reset();
  }

  const result = computeMut.data;
  const canCompute =
    !!selected &&
    selected.inputs.every((inp) => {
      const v = inputs[inp.id];
      return v !== undefined && v !== "" && Number.isFinite(Number(v));
    });

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl text-foreground flex items-center gap-2">
          <Calculator className="h-5 w-5 text-gold" /> KPI Library
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          The standard operating metrics — CAC, payback, NRR, LTV, Rule of 40
          and more. Pick one, enter the inputs, and compute it.
        </p>
      </div>

      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Choose a metric</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedId} onValueChange={pick}>
            <SelectTrigger className="bg-secondary/50 border-border/60 text-sm">
              <SelectValue placeholder="Select a KPI…" />
            </SelectTrigger>
            <SelectContent>
              {kpis?.map((k) => (
                <SelectItem key={k.id} value={k.id}>
                  {k.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selected && (
            <>
              <div className="rounded border border-border/50 bg-secondary/20 p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-heading text-foreground">{selected.label}</p>
                  <Badge variant="secondary" className="text-[10px]">
                    {CATEGORY_LABELS[selected.category] ?? selected.category}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[10px] gap-1 ml-auto"
                  >
                    {selected.higherIsBetter ? (
                      <TrendingUp className="h-3 w-3 text-gold" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-amber-400" />
                    )}
                    {selected.higherIsBetter ? "higher is better" : "lower is better"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground font-body">{selected.description}</p>
                <p className="text-xs text-gold font-body">{selected.formula}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {selected.inputs.map((inp) => (
                  <div key={inp.id} className="space-y-1">
                    <label className="text-[11px] text-muted-foreground font-sans uppercase tracking-wider">
                      {inp.label}
                    </label>
                    <Input
                      type="number"
                      value={inputs[inp.id] ?? ""}
                      onChange={(e) =>
                        setInputs((prev) => ({ ...prev, [inp.id]: e.target.value }))
                      }
                      className="bg-secondary/50 border-border/60 font-body h-9"
                    />
                  </div>
                ))}
              </div>

              <Button
                className="w-full gradient-gold text-background font-sans gap-2"
                disabled={!canCompute || computeMut.isPending}
                onClick={() => {
                  if (!selected) return;
                  const numeric: Record<string, number> = {};
                  for (const inp of selected.inputs) numeric[inp.id] = Number(inputs[inp.id]);
                  computeMut.mutate({ id: selected.id, inputs: numeric });
                }}
              >
                <Calculator className="h-4 w-4" />
                {computeMut.isPending ? "Computing…" : "Compute"}
              </Button>

              {computeMut.isSuccess && (
                <div className="rounded border border-gold/30 bg-gold/5 p-4 text-center">
                  {result ? (
                    <>
                      <p className="font-heading text-3xl text-gold">{result.formatted}</p>
                      <p className="text-xs text-muted-foreground font-sans mt-1">
                        {result.label}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground font-body">
                      No defined result for those inputs (check for a zero denominator).
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Reference catalog */}
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
          All metrics
        </p>
        {grouped.map(([category, list]) => (
          <Card key={category} className="card-glass">
            <CardContent className="p-4 space-y-2">
              <p className="text-xs font-sans uppercase tracking-wider text-gold">
                {CATEGORY_LABELS[category] ?? category}
              </p>
              {list?.map((k) => (
                <button
                  key={k.id}
                  onClick={() => pick(k.id)}
                  className="w-full text-left rounded border border-border/40 bg-secondary/20 p-2.5 hover:border-gold/30 transition-colors"
                >
                  <p className="text-sm font-heading text-foreground">{k.label}</p>
                  <p className="text-xs text-muted-foreground font-body">{k.formula}</p>
                </button>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
