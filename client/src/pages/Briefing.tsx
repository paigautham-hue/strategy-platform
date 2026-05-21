import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Newspaper, Bell, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BriefingProps {
  activeCompanyId: number | null;
}

type Cadence = "daily" | "weekly";

export default function Briefing({ activeCompanyId }: BriefingProps) {
  const [cadence, setCadence] = useState<Cadence>("weekly");
  const [notes, setNotes] = useState("");

  const genMut = trpc.briefing.generate.useMutation({
    onSuccess: () => toast.success("Briefing ready"),
    onError: (e) => toast.error(e.message),
  });

  if (!activeCompanyId) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span className="font-sans text-sm">Select a company to generate a briefing.</span>
      </div>
    );
  }

  const b = genMut.data;

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl text-foreground flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-gold" /> Strategy Briefing
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          A board-style synthesis of the platform's recent signals, with a sharp
          "what needs your attention" read.
        </p>
      </div>

      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Cadence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            {(["daily", "weekly"] as Cadence[]).map((c) => (
              <button
                key={c}
                onClick={() => setCadence(c)}
                className={cn(
                  "flex-1 rounded-md border px-3 py-2 text-sm font-sans capitalize transition-colors",
                  c === cadence
                    ? "border-gold/40 bg-gold/10 text-gold"
                    : "border-border/60 bg-secondary/30 text-muted-foreground hover:text-foreground",
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional — add your own notes or signals for this period…"
            className="bg-secondary/50 border-border/60 min-h-[80px] font-body"
            rows={3}
          />
          <Button
            className="w-full gradient-gold text-background font-sans gap-2"
            disabled={genMut.isPending}
            onClick={() =>
              genMut.mutate({
                companyId: activeCompanyId,
                cadence,
                notes: notes.trim() || undefined,
              })
            }
          >
            <Newspaper className="h-4 w-4" />
            {genMut.isPending ? "Building briefing…" : `Generate ${cadence} briefing`}
          </Button>
        </CardContent>
      </Card>

      {b && (
        <>
          <Card className="card-glass border-gold/30">
            <CardContent className="p-4 space-y-1">
              <Badge variant="secondary" className="text-[10px] capitalize">
                {b.cadence} briefing
              </Badge>
              <p className="font-heading text-lg text-foreground leading-snug">
                {b.headline}
              </p>
            </CardContent>
          </Card>

          {b.needsAttention.length > 0 && (
            <Card className="card-glass border-amber-500/30">
              <CardHeader>
                <CardTitle className="font-heading text-base flex items-center gap-2">
                  <Bell className="h-4 w-4 text-amber-400" /> Needs your attention
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {b.needsAttention.map((n, i) => (
                    <li key={i} className="text-sm text-foreground font-body flex gap-2">
                      <span className="text-amber-400">·</span>
                      <span>{n}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {b.sections.map((s, i) => (
            <Card key={i} className="card-glass">
              <CardHeader>
                <CardTitle className="font-heading text-base">{s.heading}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground font-body leading-relaxed whitespace-pre-line">
                  {s.body}
                </p>
              </CardContent>
            </Card>
          ))}

          {b.suggestedActions.length > 0 && (
            <Card className="card-glass">
              <CardHeader>
                <CardTitle className="font-heading text-base">Suggested actions</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {b.suggestedActions.map((a, i) => (
                    <li key={i} className="text-sm text-foreground font-body flex gap-2">
                      <ArrowRight className="h-3.5 w-3.5 text-gold shrink-0 mt-0.5" />
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
