import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, PieChart, Swords, Grid2x2, Layers3 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DiagramsProps {
  activeCompanyId: number | null;
}

type DiagramType = "porter" | "swot" | "three_horizons";

const TYPES: { type: DiagramType; label: string; icon: React.ElementType }[] = [
  { type: "porter", label: "Five Forces", icon: Swords },
  { type: "swot", label: "SWOT", icon: Grid2x2 },
  { type: "three_horizons", label: "Three Horizons", icon: Layers3 },
];

const INTENSITY_STYLE: Record<string, string> = {
  low: "bg-gold/10 text-gold border-gold/30",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  high: "bg-destructive/10 text-destructive border-destructive/30",
};

export default function Diagrams({ activeCompanyId }: DiagramsProps) {
  const [diagramType, setDiagramType] = useState<DiagramType>("porter");
  const [subject, setSubject] = useState("");

  const genMut = trpc.diagram.generate.useMutation({
    onSuccess: () => toast.success("Diagram generated"),
    onError: (e) => toast.error(e.message),
  });

  if (!activeCompanyId) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span className="font-sans text-sm">Select a company to generate a diagram.</span>
      </div>
    );
  }

  const d = genMut.data;

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl text-foreground flex items-center gap-2">
          <PieChart className="h-5 w-5 text-gold" /> Strategy Diagrams
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          Generate a structured strategy diagram — rendered crisp and native,
          grounded in this company's memory.
        </p>
      </div>

      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Build a diagram</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            {TYPES.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.type}
                  onClick={() => setDiagramType(t.type)}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-2 text-sm font-sans flex items-center justify-center gap-1.5 transition-colors",
                    t.type === diagramType
                      ? "border-gold/40 bg-gold/10 text-gold"
                      : "border-border/60 bg-secondary/30 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject — a company, market, or strategic question…"
            className="bg-secondary/50 border-border/60 font-body"
          />
          <Button
            className="w-full gradient-gold text-background font-sans gap-2"
            disabled={!subject.trim() || genMut.isPending}
            onClick={() =>
              genMut.mutate({
                companyId: activeCompanyId,
                diagramType,
                subject: subject.trim(),
              })
            }
          >
            <PieChart className="h-4 w-4" />
            {genMut.isPending ? "Generating…" : "Generate diagram"}
          </Button>
        </CardContent>
      </Card>

      {d && (
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="font-heading text-lg">{d.title || "Diagram"}</CardTitle>
          </CardHeader>
          <CardContent>
            {d.kind === "porter" && <PorterView forces={d.forces} />}
            {d.kind === "swot" && <SwotView d={d} />}
            {d.kind === "three_horizons" && <HorizonsView horizons={d.horizons} />}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ForceBox({
  force,
}: {
  force: { label: string; intensity: string; rationale: string };
}) {
  return (
    <div className={cn("rounded-md border p-3 space-y-1", INTENSITY_STYLE[force.intensity])}>
      <div className="flex items-center gap-2">
        <p className="text-xs font-heading text-foreground">{force.label}</p>
        <Badge variant="outline" className="text-[9px] ml-auto capitalize">
          {force.intensity}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground font-body leading-snug">{force.rationale}</p>
    </div>
  );
}

function PorterView({
  forces,
}: {
  forces: { id: string; label: string; intensity: string; rationale: string }[];
}) {
  const byId = (id: string) => forces.find((f) => f.id === id);
  const rivalry = byId("rivalry");
  return (
    <div className="grid grid-cols-3 gap-2.5">
      <div />
      {byId("new_entrants") && <ForceBox force={byId("new_entrants")!} />}
      <div />
      {byId("supplier_power") && <ForceBox force={byId("supplier_power")!} />}
      {rivalry && (
        <div
          className={cn(
            "rounded-md border-2 p-3 space-y-1 flex flex-col justify-center",
            INTENSITY_STYLE[rivalry.intensity],
          )}
        >
          <p className="text-xs font-heading text-foreground text-center">{rivalry.label}</p>
          <Badge variant="outline" className="text-[9px] capitalize mx-auto">
            {rivalry.intensity}
          </Badge>
          <p className="text-[11px] text-muted-foreground font-body leading-snug text-center">
            {rivalry.rationale}
          </p>
        </div>
      )}
      {byId("buyer_power") && <ForceBox force={byId("buyer_power")!} />}
      <div />
      {byId("substitutes") && <ForceBox force={byId("substitutes")!} />}
      <div />
    </div>
  );
}

function SwotCell({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: string;
}) {
  return (
    <div className={cn("rounded-md border p-3 space-y-1.5 min-h-[120px]", tone)}>
      <p className="text-xs font-heading uppercase tracking-wider">{label}</p>
      <ul className="space-y-1">
        {items.length === 0 ? (
          <li className="text-xs text-muted-foreground font-body">—</li>
        ) : (
          items.map((it, i) => (
            <li key={i} className="text-xs text-foreground font-body leading-snug flex gap-1.5">
              <span className="opacity-60">·</span>
              <span>{it}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function SwotView({
  d,
}: {
  d: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <SwotCell label="Strengths" items={d.strengths} tone="border-gold/30 bg-gold/5" />
      <SwotCell
        label="Weaknesses"
        items={d.weaknesses}
        tone="border-destructive/30 bg-destructive/5"
      />
      <SwotCell
        label="Opportunities"
        items={d.opportunities}
        tone="border-amber-500/30 bg-amber-500/5"
      />
      <SwotCell label="Threats" items={d.threats} tone="border-destructive/30 bg-destructive/5" />
    </div>
  );
}

function HorizonsView({
  horizons,
}: {
  horizons: { horizon: number; theme: string; items: string[] }[];
}) {
  const HORIZON_LABEL: Record<number, string> = {
    1: "Horizon 1 — Defend & extend the core",
    2: "Horizon 2 — Emerging growth",
    3: "Horizon 3 — Future options",
  };
  return (
    <div className="space-y-2.5">
      {horizons.map((h) => (
        <div
          key={h.horizon}
          className="rounded-md border border-border/50 bg-secondary/20 p-3 space-y-1.5"
        >
          <div className="flex items-center gap-2">
            <Badge className="text-[10px] bg-gold/10 text-gold border-gold/20">
              H{h.horizon}
            </Badge>
            <p className="text-xs font-heading text-foreground">
              {h.theme || HORIZON_LABEL[h.horizon]}
            </p>
          </div>
          <ul className="space-y-1">
            {h.items.length === 0 ? (
              <li className="text-xs text-muted-foreground font-body">—</li>
            ) : (
              h.items.map((it, i) => (
                <li key={i} className="text-sm text-foreground font-body flex gap-2">
                  <span className="text-gold">·</span>
                  <span>{it}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      ))}
    </div>
  );
}
