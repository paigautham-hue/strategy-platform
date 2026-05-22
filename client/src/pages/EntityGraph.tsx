import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Share2, ArrowRight, Spline } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface EntityGraphProps {
  activeCompanyId: number | null;
}

const HOP_STYLE: Record<number, string> = {
  0: "bg-gold/15 text-gold border-gold/30",
  1: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  2: "bg-secondary text-muted-foreground border-border/40",
  3: "bg-secondary/60 text-muted-foreground border-border/30",
};

export default function EntityGraph({ activeCompanyId }: EntityGraphProps) {
  const [query, setQuery] = useState("");

  const queryMut = trpc.entityGraph.query.useMutation({
    onSuccess: (r) =>
      toast.success(`${r.entities.length} entities · ${r.connections.length} connections`),
    onError: (e) => toast.error(e.message),
  });

  if (!activeCompanyId) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span className="font-sans text-sm">Select a company to explore its connections.</span>
      </div>
    );
  }

  const r = queryMut.data;
  const hopGroups = r
    ? [0, 1, 2, 3]
        .map((hop) => ({ hop, entities: r.entities.filter((e) => e.hops === hop) }))
        .filter((g) => g.entities.length > 0)
    : [];

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl text-foreground flex items-center gap-2">
          <Share2 className="h-5 w-5 text-gold" /> Connections
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          Multi-hop retrieval — beyond the facts that match your question, it
          surfaces the chains that connect them across separate memory items.
        </p>
      </div>

      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Ask across the graph</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="A question whose answer needs connecting facts — e.g. 'How is our biggest customer exposed to our main competitor?'"
            className="bg-secondary/50 border-border/60 min-h-[90px] font-body"
            rows={4}
          />
          <Button
            className="w-full gradient-gold text-background font-sans gap-2"
            disabled={!query.trim() || queryMut.isPending}
            onClick={() =>
              queryMut.mutate({ companyId: activeCompanyId, query: query.trim() })
            }
          >
            <Spline className="h-4 w-4" />
            {queryMut.isPending ? "Tracing connections…" : "Trace connections"}
          </Button>
        </CardContent>
      </Card>

      {r && (
        <>
          {r.sourceCount === 0 ? (
            <p className="text-sm text-muted-foreground font-sans text-center">
              No memory to traverse — ingest documents for this company first.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                Graph built from {r.sourceCount} memory items
              </p>

              {hopGroups.map((g) => (
                <Card key={g.hop} className="card-glass">
                  <CardContent className="p-4 space-y-2">
                    <p className="text-xs font-sans uppercase tracking-wider text-gold">
                      {g.hop === 0 ? "Query entities" : `${g.hop} hop${g.hop > 1 ? "s" : ""} away`}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {g.entities.map((e, i) => (
                        <Badge
                          key={i}
                          className={cn("text-[11px] gap-1", HOP_STYLE[g.hop] ?? HOP_STYLE[3])}
                        >
                          {e.label}
                          <span className="opacity-60">· {e.type}</span>
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {r.connections.length > 0 && (
                <Card className="card-glass">
                  <CardHeader>
                    <CardTitle className="font-heading text-base">Connections</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {r.connections.map((c, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-sm font-body flex-wrap"
                      >
                        <span className="text-foreground font-heading">{c.from}</span>
                        <span className="flex items-center gap-1 text-xs text-gold">
                          <ArrowRight className="h-3 w-3" />
                          {c.relation}
                          <ArrowRight className="h-3 w-3" />
                        </span>
                        <span className="text-foreground font-heading">{c.to}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {r.entities.length === 0 && (
                <p className="text-sm text-muted-foreground font-sans text-center">
                  No entities surfaced for that query.
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
