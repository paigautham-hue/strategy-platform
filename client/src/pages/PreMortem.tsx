import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  ShieldAlert,
  Flag,
  CheckCircle2,
  XCircle,
  Eye,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PreMortemProps {
  activeCompanyId: number | null;
}

const SEVERITY_STYLE: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  low: "bg-gold/10 text-gold border-gold/20",
};

export default function PreMortem({ activeCompanyId }: PreMortemProps) {
  const [initiative, setInitiative] = useState("");
  const [context, setContext] = useState("");

  const runMut = trpc.decomposer.preMortem.useMutation({
    onSuccess: (r) => toast.success(`Pre-mortem surfaced ${r.risks.length} risks`),
    onError: (e) => toast.error(e.message),
  });

  if (!activeCompanyId) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span className="font-sans text-sm">Select a company to run a pre-mortem.</span>
      </div>
    );
  }

  const r = runMut.data;

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl text-foreground flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-gold" /> Pre-Mortem
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          Before an initiative goes active: assume it is twelve months later and
          it has failed. Work backwards to a risk register — graded, with
          early-warning signs and mitigations.
        </p>
      </div>

      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Initiative to pre-mortem</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={initiative}
            onChange={(e) => setInitiative(e.target.value)}
            placeholder="The initiative about to launch…"
            className="bg-secondary/50 border-border/60 font-body"
          />
          <Textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Optional — plan, scope, owners, timeline, anything relevant…"
            className="bg-secondary/50 border-border/60 min-h-[90px] font-body"
            rows={4}
          />
          <Button
            className="w-full gradient-gold text-background font-sans gap-2"
            disabled={!initiative.trim() || runMut.isPending}
            onClick={() =>
              runMut.mutate({
                companyId: activeCompanyId,
                initiative: initiative.trim(),
                context: context.trim() || undefined,
              })
            }
          >
            <ShieldAlert className="h-4 w-4" />
            {runMut.isPending ? "Running the pre-mortem…" : "Run pre-mortem"}
          </Button>
        </CardContent>
      </Card>

      {r && (
        <>
          <Card className={cn("card-glass", r.readyToLaunch ? "border-gold/30" : "border-destructive/40")}>
            <CardContent className="p-4 flex items-start gap-3">
              {r.readyToLaunch ? (
                <CheckCircle2 className="h-6 w-6 text-gold shrink-0" />
              ) : (
                <XCircle className="h-6 w-6 text-destructive shrink-0" />
              )}
              <div className="space-y-1">
                <p className="font-heading text-base text-foreground">
                  {r.readyToLaunch
                    ? "Cleared for launch — every risk has a mitigation"
                    : "Not cleared — risks remain without a mitigation"}
                </p>
                <p className="text-sm text-muted-foreground font-body flex items-start gap-1.5">
                  <Flag className="h-3.5 w-3.5 text-gold shrink-0 mt-0.5" />
                  Top risk: {r.topRisk}
                </p>
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
            Risk register — {r.risks.length} risks, most severe first
          </p>

          {r.risks.map((risk, i) => (
            <Card key={i} className="card-glass">
              <CardContent className="p-4 space-y-2.5">
                <div className="flex items-start gap-2">
                  <p className="text-sm font-heading text-foreground flex-1">{risk.risk}</p>
                  <Badge
                    className={cn("text-[10px] shrink-0", SEVERITY_STYLE[risk.severity])}
                  >
                    {risk.severity}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    likelihood: {risk.likelihood}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    impact: {risk.impact}
                  </Badge>
                </div>
                {risk.earlyWarningSign && (
                  <p className="text-sm text-muted-foreground font-body flex items-start gap-1.5">
                    <Eye className="h-3.5 w-3.5 text-gold shrink-0 mt-0.5" />
                    {risk.earlyWarningSign}
                  </p>
                )}
                {risk.mitigation && (
                  <p className="text-sm text-foreground font-body flex items-start gap-1.5">
                    <Wrench className="h-3.5 w-3.5 text-gold shrink-0 mt-0.5" />
                    {risk.mitigation}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
