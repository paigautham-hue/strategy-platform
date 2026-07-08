import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Plus, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface PredictionsProps {
  activeCompanyId: number | null;
}

/** Inline outcome-resolution form for an open prediction. */
function ResolveForm({
  predictionId,
  companyId,
  onDone,
}: {
  predictionId: number;
  companyId: number;
  onDone: () => void;
}) {
  const [held, setHeld] = useState<boolean | null>(null);
  const [actualValue, setActualValue] = useState("");

  const resolveMut = trpc.prediction.resolve.useMutation({
    onSuccess: () => {
      toast.success("Outcome recorded — calibration updated");
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="mt-2 ml-8 space-y-2 rounded border border-border/40 bg-secondary/30 p-3">
      <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
        Record the real-world outcome
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={held === true ? "default" : "outline"}
          className={`h-7 text-xs gap-1.5 ${held === true ? "bg-success/20 text-success border border-success/40 hover:bg-success/30" : ""}`}
          onClick={() => setHeld(true)}
        >
          <CheckCircle2 className="h-3 w-3" /> Held
        </Button>
        <Button
          size="sm"
          variant={held === false ? "default" : "outline"}
          className={`h-7 text-xs gap-1.5 ${held === false ? "bg-destructive/20 text-destructive border border-destructive/40 hover:bg-destructive/30" : ""}`}
          onClick={() => setHeld(false)}
        >
          <XCircle className="h-3 w-3" /> Did not hold
        </Button>
      </div>
      <Textarea
        value={actualValue}
        onChange={(e) => setActualValue(e.target.value)}
        placeholder="What actually happened?"
        className="bg-secondary/50 border-border/60 font-body text-sm"
        rows={2}
      />
      <Button
        size="sm"
        className="w-full gradient-gold text-background font-sans text-xs"
        disabled={held === null || !actualValue.trim() || resolveMut.isPending}
        onClick={() =>
          resolveMut.mutate({
            predictionId,
            companyId,
            held: held as boolean,
            actualValue: actualValue.trim(),
          })
        }
      >
        {resolveMut.isPending ? "Recording…" : "Record outcome"}
      </Button>
    </div>
  );
}

export default function Predictions({ activeCompanyId }: PredictionsProps) {
  const [open, setOpen] = useState(false);
  const [claim, setClaim] = useState("");
  const [confidence, setConfidence] = useState("0.7");
  const [framework, setFramework] = useState("");
  const [horizon, setHorizon] = useState("");
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const { data: predictions, isLoading, refetch } = trpc.prediction.list.useQuery(
    { companyId: activeCompanyId!, limit: 100 },
    { enabled: !!activeCompanyId }
  );

  const recordMut = trpc.prediction.record.useMutation({
    onSuccess: () => {
      toast.success("Prediction recorded in ledger");
      setOpen(false);
      setClaim("");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!activeCompanyId) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span className="font-sans text-sm">Select a company to view the prediction ledger.</span>
      </div>
    );
  }

  const open_preds = predictions?.filter((p) => !p.outcomeId) ?? [];
  const closed_preds = predictions?.filter((p) => p.outcomeId) ?? [];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl text-foreground">Prediction Ledger</h2>
          <p className="text-muted-foreground font-sans text-sm mt-1">
            {open_preds.length} open · {closed_preds.length} closed
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gradient-gold text-background font-sans gap-2">
              <Plus className="h-4 w-4" /> Record Prediction
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border/60 max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading">Record Prediction</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-xs text-muted-foreground font-sans bg-secondary/40 rounded p-2 border border-border/40">
                C2: Every strategic claim must be recorded in the ledger before it is acted upon.
              </p>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                  Claim *
                </label>
                <Textarea
                  value={claim}
                  onChange={(e) => setClaim(e.target.value)}
                  placeholder="State the strategic prediction or claim..."
                  className="bg-secondary/50 border-border/60 font-body"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                    Confidence
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    value={confidence}
                    onChange={(e) => setConfidence(e.target.value)}
                    className="bg-secondary/50 border-border/60"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                    Framework
                  </label>
                  <Input
                    value={framework}
                    onChange={(e) => setFramework(e.target.value)}
                    placeholder="Porter's, SWOT..."
                    className="bg-secondary/50 border-border/60 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                    Horizon
                  </label>
                  <Input
                    value={horizon}
                    onChange={(e) => setHorizon(e.target.value)}
                    placeholder="12M, 3Y..."
                    className="bg-secondary/50 border-border/60 text-xs"
                  />
                </div>
              </div>
              <Button
                className="w-full gradient-gold text-background font-sans"
                disabled={!claim.trim() || recordMut.isPending}
                onClick={() =>
                  recordMut.mutate({
                    companyId: activeCompanyId,
                    claim: claim.trim(),
                    confidence: parseFloat(confidence),
                    framework: framework.trim() || undefined,
                    horizon: horizon.trim() || undefined,
                    model: "gpt-4o",
                  })
                }
              >
                {recordMut.isPending ? "Recording..." : "Record in Ledger"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : predictions?.length === 0 ? (
        <Card className="card-glass">
          <CardContent className="py-16 text-center">
            <TrendingUp className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-body">No predictions recorded yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {predictions?.map((p) => (
            <Card key={p.id} className="card-glass hover:border-gold/20 transition-colors">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    p.outcomeId ? "bg-success/20 border border-success/30" : "bg-gold/10 border border-gold/20"
                  }`}>
                    {p.outcomeId
                      ? <CheckCircle2 className="h-3 w-3 text-success" />
                      : <TrendingUp className="h-3 w-3 text-gold" />
                    }
                  </div>
                  <p className="text-sm text-foreground font-body flex-1">{p.claim}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 pl-8">
                  <Badge
                    variant={p.outcomeId ? "default" : "secondary"}
                    className={`text-[10px] px-1.5 py-0 ${p.outcomeId ? "bg-success/20 text-success border-success/30" : ""}`}
                  >
                    {p.outcomeId ? "closed" : "open"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    conf: {((p.confidence ?? 0) * 100).toFixed(0)}%
                  </Badge>
                  {p.framework && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-gold border-gold/30">
                      {p.framework}
                    </Badge>
                  )}
                  {p.horizon && (
                    <span className="text-[10px] text-muted-foreground font-sans">
                      horizon: {p.horizon}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground font-sans ml-auto">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </span>
                  {!p.outcomeId && p.outcomeClass !== "synthetic" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[11px] px-2"
                      onClick={() => setResolvingId(resolvingId === p.id ? null : p.id)}
                    >
                      {resolvingId === p.id ? "Cancel" : "Resolve"}
                    </Button>
                  )}
                </div>
                {resolvingId === p.id && (
                  <ResolveForm
                    predictionId={p.id}
                    companyId={activeCompanyId}
                    onDone={() => {
                      setResolvingId(null);
                      refetch();
                    }}
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
