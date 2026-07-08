import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  FlaskConical,
  Shield,
  CheckCircle2,
  XCircle,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";

function num(v: string, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** GP-only page gate — mirrors the server's gpProcedure so a direct URL hit
 *  shows a clear message instead of raw FORBIDDEN errors. */
export function GpOnlyGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user && user.role !== "gp" && user.role !== "admin") {
    return (
      <div className="p-6 max-w-3xl mx-auto animate-fade-in">
        <div className="card-glass rounded-xl border border-border/60 p-6 text-sm text-muted-foreground font-body text-center">
          This surface is GP-only. Ask an admin if you need access.
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

export default function Distillation() {
  const [patternText, setPatternText] = useState("");
  const [sourceCount, setSourceCount] = useState("3");

  const previewMut = trpc.distillation.preview.useMutation({
    onSuccess: (r) =>
      toast.success(
        r.publishable
          ? `Publishable — ${r.redactionCount} redactions`
          : "Not publishable — min-portco gate",
      ),
    onError: (e) => toast.error(e.message),
  });

  const publishMut = trpc.distillation.publish.useMutation({
    onSuccess: () =>
      toast.success("Published — the anonymized pattern is now in the portfolio-wide knowledge layer"),
    onError: (e) => toast.error(e.message),
  });

  const r = previewMut.data;

  return (
    <GpOnlyGate>
    <div className="p-6 space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl text-foreground flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-gold" /> Pattern Distillation
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          Before a pattern learned inside one company can be surfaced to another,
          it is anonymized — company names, dollar amounts, and dates stripped —
          and gated on being drawn from at least three portcos.
        </p>
        <p className="text-[11px] text-muted-foreground font-sans mt-2 flex items-center gap-1.5">
          <Shield className="h-3 w-3 text-gold" />
          GP-only. Anonymization is checked against every company in the tenant.
        </p>
      </div>

      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Pattern to distill</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={patternText}
            onChange={(e) => {
              setPatternText(e.target.value);
              // The preview/publish state belongs to the OLD text — editing
              // invalidates both (stale "publishable" must not carry over).
              if (previewMut.data) previewMut.reset();
              if (publishMut.data || publishMut.isSuccess) publishMut.reset();
            }}
            placeholder="Paste the cross-company pattern text…"
            className="bg-secondary/50 border-border/60 min-h-[140px] font-body"
            rows={7}
          />
          <div className="space-y-1.5 max-w-[220px]">
            <label className="text-[11px] text-muted-foreground font-sans uppercase tracking-wider">
              Source portcos
            </label>
            <Input
              type="number"
              value={sourceCount}
              onChange={(e) => setSourceCount(e.target.value)}
              className="bg-secondary/50 border-border/60 font-body h-9"
            />
          </div>
          <Button
            className="w-full gradient-gold text-background font-sans gap-2"
            disabled={!patternText.trim() || previewMut.isPending}
            onClick={() =>
              previewMut.mutate({
                patternText: patternText.trim(),
                sourcePortcoCount: Math.max(0, num(sourceCount)),
              })
            }
          >
            <EyeOff className="h-4 w-4" />
            {previewMut.isPending ? "Distilling…" : "Distill & anonymize"}
          </Button>
        </CardContent>
      </Card>

      {r && (
        <>
          <Card className={cn("card-glass", r.publishable ? "border-gold/30" : "border-destructive/40")}>
            <CardContent className="p-4 flex items-start gap-3">
              {r.publishable ? (
                <CheckCircle2 className="h-6 w-6 text-gold shrink-0" />
              ) : (
                <XCircle className="h-6 w-6 text-destructive shrink-0" />
              )}
              <div className="space-y-1">
                <p className="font-heading text-base text-foreground">
                  {r.publishable ? "Cleared for cross-company publication" : "Not publishable"}
                </p>
                <p className="text-sm text-muted-foreground font-body">{r.reason}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="card-glass">
            <CardHeader>
              <CardTitle className="font-heading text-base flex items-center gap-2">
                <EyeOff className="h-4 w-4 text-gold" /> Anonymized text
                <Badge variant="secondary" className="text-[10px] ml-auto">
                  {r.redactionCount} redactions
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-foreground font-body leading-relaxed whitespace-pre-line">
                {r.anonymizedText}
              </p>
              {r.publishable && (
                <Button
                  className="w-full gradient-gold text-background font-sans gap-2"
                  disabled={publishMut.isPending || publishMut.isSuccess}
                  onClick={() =>
                    publishMut.mutate({
                      patternText: patternText.trim(),
                      sourcePortcoCount: Math.max(0, num(sourceCount)),
                    })
                  }
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {publishMut.isSuccess
                    ? "Published to portfolio knowledge"
                    : publishMut.isPending
                      ? "Publishing…"
                      : "Publish to portfolio knowledge"}
                </Button>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
    </GpOnlyGate>
  );
}
