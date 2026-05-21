import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Swords, Flag, Users, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

interface WarGameProps {
  activeCompanyId: number | null;
}

export default function WarGame({ activeCompanyId }: WarGameProps) {
  const [strategy, setStrategy] = useState("");

  const runMut = trpc.warGame.run.useMutation({
    onSuccess: (r) =>
      toast.success(`War-game complete — strategy ${r.survived ? "survived" : "did not survive"}`),
    onError: (e) => toast.error(e.message),
  });

  if (!activeCompanyId) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span className="font-sans text-sm">Select a company to run a war-game.</span>
      </div>
    );
  }

  const r = runMut.data;

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl text-foreground flex items-center gap-2">
          <Swords className="h-5 w-5 text-gold" /> War-Game
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          Play a strategy out over several rounds against customers, competitors,
          regulators, and investors who react and escalate.
        </p>
      </div>

      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Strategy to war-game</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
            placeholder="Describe the strategy to play out…"
            className="bg-secondary/50 border-border/60 min-h-[110px] font-body"
            rows={5}
          />
          <Button
            className="w-full gradient-gold text-background font-sans gap-2"
            disabled={!strategy.trim() || runMut.isPending}
            onClick={() => runMut.mutate({ companyId: activeCompanyId, strategy: strategy.trim() })}
          >
            <Swords className="h-4 w-4" />
            {runMut.isPending ? "Playing the war-game…" : "Run war-game"}
          </Button>
          {runMut.isPending && (
            <p className="text-xs text-muted-foreground font-sans text-center">
              Several simulated rounds — this can take a moment.
            </p>
          )}
        </CardContent>
      </Card>

      {r && (
        <>
          <Card className={`card-glass ${r.survived ? "border-gold/30" : "border-destructive/40"}`}>
            <CardContent className="p-4 flex items-start gap-3">
              {r.survived ? (
                <CheckCircle2 className="h-6 w-6 text-gold shrink-0" />
              ) : (
                <XCircle className="h-6 w-6 text-destructive shrink-0" />
              )}
              <div className="space-y-1">
                <p className="font-heading text-base text-foreground flex items-center gap-2">
                  <Flag className="h-4 w-4 text-gold" />
                  {r.survived ? "Strategy survived the war-game" : "Strategy did not survive"}
                </p>
                <p className="text-sm text-muted-foreground font-body leading-relaxed">{r.outcome}</p>
              </div>
            </CardContent>
          </Card>

          {r.keyLearnings.length > 0 && (
            <Card className="card-glass">
              <CardHeader>
                <CardTitle className="font-heading text-sm">Key learnings</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {r.keyLearnings.map((l, i) => (
                    <li key={i} className="text-sm text-foreground font-body flex gap-2">
                      <span className="text-gold">·</span>
                      <span>{l}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider flex items-center gap-1.5">
              <Users className="h-3 w-3" /> {r.rounds.length} rounds
            </p>
            {r.rounds.map((round) => (
              <Card key={round.round} className="card-glass">
                <CardContent className="p-4 space-y-2">
                  <p className="text-xs text-gold font-sans uppercase tracking-wider">
                    Round {round.round}
                  </p>
                  {round.moves.length === 0 ? (
                    <p className="text-xs text-muted-foreground font-sans">No moves this round.</p>
                  ) : (
                    round.moves.map((m, i) => (
                      <div key={i} className="space-y-0.5">
                        <p className="text-xs font-heading text-foreground">{m.stakeholderLabel}</p>
                        <p className="text-sm text-muted-foreground font-body leading-relaxed">
                          {m.move}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <p className="text-xs text-muted-foreground font-sans">
            <Badge variant="secondary" className="text-[10px] mr-1.5">synthetic</Badge>
            The war-game outcome was logged to the prediction ledger as a synthetic
            outcome — kept separate from real outcomes in calibration.
          </p>
        </>
      )}
    </div>
  );
}
