import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Swords, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface RedTeamProps {
  activeCompanyId: number | null;
}

const SEVERITY_STYLE: Record<string, string> = {
  fatal: "border-destructive/50 text-destructive",
  major: "border-amber-500/50 text-amber-400",
  minor: "border-border text-muted-foreground",
};

export default function RedTeam({ activeCompanyId }: RedTeamProps) {
  const [strategy, setStrategy] = useState("");

  const reviewMut = trpc.redTeam.review.useMutation({
    onSuccess: (r) => {
      if (r.survivedReview) toast.success("Strategy survived red-team review");
      else toast.error(`${r.fatalFlaws.length} fatal flaw(s) found`);
    },
    onError: (e) => toast.error(e.message),
  });

  if (!activeCompanyId) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span className="font-sans text-sm">Select a company to run a red-team review.</span>
      </div>
    );
  }

  const r = reviewMut.data;

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl text-foreground flex items-center gap-2">
          <Swords className="h-5 w-5 text-gold" /> Red Team
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          Stress-test a strategy adversarially — five hostile vantage points attack it,
          and a fatal flaw means it has not survived review.
        </p>
      </div>

      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Strategy to attack</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
            placeholder="Describe the strategy or option to stress-test…"
            className="bg-secondary/50 border-border/60 min-h-[120px] font-body"
            rows={5}
          />
          <Button
            className="w-full gradient-gold text-background font-sans gap-2"
            disabled={!strategy.trim() || reviewMut.isPending}
            onClick={() => reviewMut.mutate({ companyId: activeCompanyId, strategy: strategy.trim() })}
          >
            <Swords className="h-4 w-4" />
            {reviewMut.isPending ? "Red team attacking…" : "Run red-team review"}
          </Button>
        </CardContent>
      </Card>

      {r && (
        <>
          <Card className={`card-glass ${r.survivedReview ? "border-gold/30" : "border-destructive/40"}`}>
            <CardContent className="p-4 flex items-start gap-3">
              {r.survivedReview ? (
                <ShieldCheck className="h-6 w-6 text-gold shrink-0" />
              ) : (
                <ShieldAlert className="h-6 w-6 text-destructive shrink-0" />
              )}
              <div className="space-y-1">
                <p className="font-heading text-base text-foreground">
                  {r.survivedReview ? "Survived review" : `${r.fatalFlaws.length} fatal flaw(s)`}
                </p>
                <p className="text-sm text-muted-foreground font-body leading-relaxed">{r.verdict}</p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
              {r.critiques.length} critiques
            </p>
            {r.critiques.map((c, i) => (
              <Card key={i} className="card-glass">
                <CardContent className="p-4 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-heading text-sm text-foreground">{c.personaLabel}</h4>
                    <Badge variant="outline" className={`text-[10px] ${SEVERITY_STYLE[c.severity] ?? ""}`}>
                      {c.severity}
                    </Badge>
                  </div>
                  <p className="text-sm text-foreground font-body leading-relaxed">{c.critique}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
