import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Gauge,
  CalendarClock,
  Activity,
  GitFork,
  Compass,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DriftProps {
  activeCompanyId: number | null;
}

const STATUS_STYLE: Record<string, string> = {
  ahead: "bg-gold/10 text-gold border-gold/20",
  "on-track": "bg-gold/10 text-gold border-gold/20",
  stable: "bg-gold/10 text-gold border-gold/20",
  "insufficient-data": "bg-secondary text-muted-foreground border-border/40",
  slipping: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  diverging: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  questioned: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  watch: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  behind: "bg-destructive/10 text-destructive border-destructive/20",
  "off-track": "bg-destructive/10 text-destructive border-destructive/20",
  invalidated: "bg-destructive/10 text-destructive border-destructive/20",
  alert: "bg-destructive/10 text-destructive border-destructive/20",
  none: "bg-gold/10 text-gold border-gold/20",
};

const REPLAN_STYLE: Record<string, string> = {
  continue: "bg-gold/10 text-gold border-gold/20",
  "adjust-pace": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  pivot: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  kill: "bg-destructive/10 text-destructive border-destructive/20",
};

function num(v: string, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function Drift({ activeCompanyId }: DriftProps) {
  const [initiative, setInitiative] = useState("");
  const [context, setContext] = useState("");
  const [plannedPct, setPlannedPct] = useState("50");
  const [actualPct, setActualPct] = useState("35");
  const [kpiExpected, setKpiExpected] = useState("100");
  const [kpiActual, setKpiActual] = useState("80");
  const [kpiSamples, setKpiSamples] = useState("30");
  const [higherIsBetter, setHigherIsBetter] = useState(true);
  const [contradictions, setContradictions] = useState("1");

  const detectMut = trpc.drift.detect.useMutation({
    onSuccess: (r) => toast.success(`Drift severity: ${r.report.severity}`),
    onError: (e) => toast.error(e.message),
  });

  if (!activeCompanyId) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span className="font-sans text-sm">Select a company to run drift detection.</span>
      </div>
    );
  }

  const r = detectMut.data;

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl text-foreground flex items-center gap-2">
          <Gauge className="h-5 w-5 text-gold" /> Drift Detection
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          Watch an active initiative for divergence — schedule, KPI, and thesis.
          When drift is found, the replan engine proposes the next move.
        </p>
      </div>

      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Initiative under watch</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={initiative}
            onChange={(e) => setInitiative(e.target.value)}
            placeholder="The active initiative…"
            className="bg-secondary/50 border-border/60 font-body"
          />
          <Textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Optional context for the replan engine…"
            className="bg-secondary/50 border-border/60 min-h-[70px] font-body"
            rows={3}
          />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Planned progress %" value={plannedPct} onChange={setPlannedPct} />
            <Field label="Actual progress %" value={actualPct} onChange={setActualPct} />
            <Field label="KPI expected" value={kpiExpected} onChange={setKpiExpected} />
            <Field label="KPI actual" value={kpiActual} onChange={setKpiActual} />
            <Field label="KPI sample size" value={kpiSamples} onChange={setKpiSamples} />
            <Field
              label="Contradictions vs thesis"
              value={contradictions}
              onChange={setContradictions}
            />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={higherIsBetter}
              onChange={(e) => setHigherIsBetter(e.target.checked)}
              className="h-4 w-4 rounded border-border/60 accent-gold"
            />
            <span className="text-sm font-sans text-foreground">
              A higher KPI value is better
            </span>
          </label>

          <Button
            className="w-full gradient-gold text-background font-sans gap-2"
            disabled={!initiative.trim() || detectMut.isPending}
            onClick={() =>
              detectMut.mutate({
                companyId: activeCompanyId,
                initiative: initiative.trim(),
                context: context.trim() || undefined,
                plannedProgress: Math.min(1, Math.max(0, num(plannedPct) / 100)),
                actualProgress: Math.min(1, Math.max(0, num(actualPct) / 100)),
                kpiExpected: num(kpiExpected),
                kpiActual: num(kpiActual),
                kpiSampleSize: Math.max(0, num(kpiSamples)),
                kpiHigherIsBetter: higherIsBetter,
                contradictionCount: Math.max(0, num(contradictions)),
              })
            }
          >
            <Gauge className="h-4 w-4" />
            {detectMut.isPending ? "Detecting drift…" : "Detect drift"}
          </Button>
        </CardContent>
      </Card>

      {r && (
        <>
          <Card
            className={cn(
              "card-glass",
              r.report.severity === "alert"
                ? "border-destructive/40"
                : r.report.severity === "watch"
                  ? "border-amber-500/30"
                  : "border-gold/30",
            )}
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <p className="font-heading text-base text-foreground">Drift report</p>
                <Badge className={cn("text-[10px] ml-auto", STATUS_STYLE[r.report.severity])}>
                  {r.report.severity}
                </Badge>
              </div>
              <DetectorRow
                icon={CalendarClock}
                label="Schedule"
                status={r.report.schedule.status}
                detail={`${r.report.schedule.driftPct} pts behind plan`}
              />
              <DetectorRow
                icon={Activity}
                label="KPI"
                status={r.report.kpi.status}
                detail={`${r.report.kpi.divergencePct}% divergence · ${
                  r.report.kpi.favorable ? "favourable" : "adverse"
                }`}
              />
              <DetectorRow
                icon={GitFork}
                label="Thesis"
                status={r.report.thesis.status}
                detail={`${r.report.thesis.contradictionCount} contradictions`}
              />
            </CardContent>
          </Card>

          {r.replan && (
            <Card className="card-glass">
              <CardHeader>
                <CardTitle className="font-heading text-lg flex items-center gap-2">
                  <Compass className="h-4 w-4 text-gold" /> Replan proposal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Badge
                  className={cn("text-[11px]", REPLAN_STYLE[r.replan.recommendation])}
                >
                  {r.replan.recommendation}
                </Badge>
                <p className="text-sm text-foreground font-body leading-relaxed">
                  {r.replan.rationale}
                </p>
                {r.replan.adjustments.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                      Adjustments
                    </p>
                    <ul className="space-y-1">
                      {r.replan.adjustments.map((a, i) => (
                        <li key={i} className="text-sm text-foreground font-body flex gap-2">
                          <span className="text-gold">·</span>
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {!r.replan && (
            <p className="text-xs text-muted-foreground font-sans text-center">
              No drift detected — no replan needed.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] text-muted-foreground font-sans uppercase tracking-wider">
        {label}
      </label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-secondary/50 border-border/60 font-body h-9"
      />
    </div>
  );
}

function DetectorRow({
  icon: Icon,
  label,
  status,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  status: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="h-4 w-4 text-gold shrink-0" />
      <span className="text-sm font-heading text-foreground w-20">{label}</span>
      <Badge className={cn("text-[10px]", STATUS_STYLE[status])}>{status}</Badge>
      <span className="text-xs text-muted-foreground font-body ml-auto">{detail}</span>
    </div>
  );
}
