import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Combine, Building2, Shield, Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const VALUE_STYLE: Record<string, string> = {
  high: "bg-gold/10 text-gold border-gold/20",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  low: "bg-secondary text-muted-foreground border-border/40",
};

export default function SynergyScout() {
  const [selected, setSelected] = useState<number[]>([]);

  const { data: companies } = trpc.company.list.useQuery();

  const scoutMut = trpc.synergy.scout.useMutation({
    onSuccess: (r) => toast.success(`Found ${r.candidates.length} synergy candidates`),
    onError: (e) => toast.error(e.message),
  });

  const r = scoutMut.data;
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
          <Combine className="h-5 w-5 text-gold" /> Synergy Scout
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          Across the portfolio, value hides in the overlaps. Nine detectors scan
          for shared customers, joint procurement leverage, licensable IP,
          correlated macro risk, and more.
        </p>
        <p className="text-[11px] text-muted-foreground font-sans mt-2 flex items-center gap-1.5">
          <Shield className="h-3 w-3 text-gold" />
          GP-only. Every cross-company read is recorded to the audit log.
        </p>
      </div>

      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Portfolio companies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
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
              No companies yet — onboard at least two to scout for synergies.
            </p>
          )}
          <Button
            className="w-full gradient-gold text-background font-sans gap-2"
            disabled={selected.length < 2 || scoutMut.isPending}
            onClick={() => scoutMut.mutate({ companyIds: selected })}
          >
            <Combine className="h-4 w-4" />
            {scoutMut.isPending ? "Scouting…" : `Scout ${selected.length || ""} companies`}
          </Button>
        </CardContent>
      </Card>

      {r && (
        <div className="space-y-3">
          {r.candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground font-sans text-center">
              No synergy candidates surfaced.
            </p>
          ) : (
            r.candidates.map((c, i) => (
              <Card key={i} className="card-glass">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-gold shrink-0" />
                    <p className="text-sm font-heading text-foreground">{c.detectorLabel}</p>
                    <Badge className={cn("text-[10px] ml-auto", VALUE_STYLE[c.value])}>
                      {c.value} value
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground font-body leading-relaxed">
                    {c.description}
                  </p>
                  {c.recommendedAction && (
                    <p className="text-sm text-foreground font-body flex items-start gap-1.5">
                      <ArrowRight className="h-3.5 w-3.5 text-gold shrink-0 mt-0.5" />
                      {c.recommendedAction}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {c.companyIds.map((id) => (
                      <Badge key={id} variant="secondary" className="text-[10px]">
                        {nameOf(id)}
                      </Badge>
                    ))}
                    <Badge variant="outline" className="text-[10px] ml-auto">
                      confidence {(c.confidence * 100).toFixed(0)}%
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
