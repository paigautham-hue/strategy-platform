import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardList, Sparkles, Target, Flag, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  activeCompanyId: number | null;
}

const KPI_STATUS_TONE: Record<string, string> = {
  "on-track": "text-emerald-400",
  "at-risk": "text-amber-400",
  "off-track": "text-red-400",
  unknown: "text-muted-foreground",
};

export default function StrategyManagement({ activeCompanyId }: Props) {
  const [context, setContext] = useState("");
  const companyId = activeCompanyId ?? undefined;
  const enabled = activeCompanyId != null;

  const kpis = trpc.strategyManagement.listKpis.useQuery({ companyId: activeCompanyId ?? 0 }, { enabled });
  const milestones = trpc.strategyManagement.listMilestones.useQuery({ companyId: activeCompanyId ?? 0 }, { enabled });
  const risks = trpc.strategyManagement.listRisks.useQuery({ companyId: activeCompanyId ?? 0 }, { enabled });

  const genMut = trpc.strategyManagement.generate.useMutation({
    onSuccess: (res) => {
      const w = res.written;
      toast.success(`Wrote ${w.kpis} KPIs · ${w.milestones} milestones · ${w.risks} risks`);
      kpis.refetch();
      milestones.refetch();
      risks.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!enabled) {
    return (
      <div className="p-6 max-w-3xl mx-auto animate-fade-in">
        <Card className="card-glass">
          <CardContent className="p-6 text-sm text-muted-foreground font-body text-center">
            Select a company (top bar) to generate and track KPIs, milestones, and risks.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl text-foreground flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-gold" /> Strategic Tracker
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          Turn a strategy context into trackable KPIs, roadmap milestones, and a scored risk register —
          generated, validated, and saved.
        </p>
      </div>

      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Generate from context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Paste the strategy context — goals, growth plan, segments, constraints…"
            className="bg-secondary/50 border-border/60 font-body text-sm min-h-[120px]"
          />
          <Button
            className="gradient-gold text-background font-sans gap-2"
            disabled={!context.trim() || genMut.isPending}
            onClick={() => genMut.mutate({ context: context.trim(), companyId: activeCompanyId })}
          >
            <Sparkles className="h-4 w-4" />
            {genMut.isPending ? "Generating…" : "Generate & save"}
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="kpis">
        <TabsList>
          <TabsTrigger value="kpis" className="gap-1.5">
            <Target className="h-3.5 w-3.5" /> KPIs ({kpis.data?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="milestones" className="gap-1.5">
            <Flag className="h-3.5 w-3.5" /> Milestones ({milestones.data?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="risks" className="gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Risks ({risks.data?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kpis" className="space-y-2 mt-3">
          {(kpis.data ?? []).length === 0 && <Empty />}
          {(kpis.data ?? []).map((k) => (
            <Card key={k.id} className="card-glass">
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-heading text-foreground">{k.label}</p>
                  <p className="text-xs text-muted-foreground font-body">
                    {k.target != null && `target ${k.target}${k.unit ? ` ${k.unit}` : ""}`}
                    {k.current != null && ` · current ${k.current}${k.unit ? ` ${k.unit}` : ""}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <Badge variant="secondary" className="text-[10px]">{k.category}</Badge>
                  <p className={`text-[11px] font-sans mt-0.5 ${KPI_STATUS_TONE[k.status] ?? ""}`}>{k.status}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="milestones" className="space-y-2 mt-3">
          {(milestones.data ?? []).length === 0 && <Empty />}
          {(milestones.data ?? []).map((m) => (
            <Card key={m.id} className="card-glass">
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-heading text-foreground">{m.title}</p>
                  {m.description && <p className="text-xs text-muted-foreground font-body">{m.description}</p>}
                </div>
                <div className="text-right shrink-0">
                  {(m.quarter || m.fiscalYear) && (
                    <Badge variant="outline" className="text-[10px]">
                      {[m.quarter, m.fiscalYear].filter(Boolean).join(" ")}
                    </Badge>
                  )}
                  <p className="text-[11px] text-muted-foreground font-sans mt-0.5">{m.status}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="risks" className="space-y-2 mt-3">
          {(risks.data ?? []).length === 0 && <Empty />}
          {(risks.data ?? []).map((r) => (
            <Card key={r.id} className="card-glass">
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-heading text-foreground">{r.title}</p>
                  {r.mitigation && <p className="text-xs text-muted-foreground font-body">→ {r.mitigation}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-heading text-lg text-amber-400">{r.riskScore}</p>
                  <p className="text-[10px] text-muted-foreground font-sans">P{r.probability} × I{r.impact}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Empty() {
  return (
    <Card className="card-glass">
      <CardContent className="p-4 text-sm text-muted-foreground font-body text-center">
        Nothing yet — generate from a strategy context above.
      </CardContent>
    </Card>
  );
}
