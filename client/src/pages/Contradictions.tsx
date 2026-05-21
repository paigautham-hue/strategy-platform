import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, GitFork, Scale } from "lucide-react";
import { toast } from "sonner";

interface ContradictionsProps {
  activeCompanyId: number | null;
}

export default function Contradictions({ activeCompanyId }: ContradictionsProps) {
  const { data, isLoading, refetch } = trpc.contradiction.list.useQuery(
    { companyId: activeCompanyId!, limit: 50 },
    { enabled: !!activeCompanyId },
  );

  const resolveMut = trpc.contradiction.resolve.useMutation({
    onSuccess: () => {
      toast.success("Contradiction resolved");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!activeCompanyId) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span className="font-sans text-sm">Select a company to review contradictions.</span>
      </div>
    );
  }

  const open = (data ?? []).filter((c) => c.status === "open");
  const resolved = (data ?? []).filter((c) => c.status !== "open");

  function resolve(
    id: number,
    resolution: "resolved_in_favor_of_a" | "resolved_in_favor_of_b" | "both_valid_with_scope",
  ) {
    if (!activeCompanyId) return;
    resolveMut.mutate({ contradictionId: id, companyId: activeCompanyId, resolution });
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h2 className="font-heading text-2xl text-foreground flex items-center gap-2">
          <GitFork className="h-5 w-5 text-gold" /> Contradictions
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          Conflicting claims the ingest pipeline flagged. Resolving retires the losing
          claim — both remain in history (C19).
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : open.length === 0 && resolved.length === 0 ? (
        <Card className="card-glass">
          <CardContent className="py-16 text-center">
            <Scale className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-body">No contradictions — memory is consistent.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {open.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                {open.length} open
              </p>
              {open.map((c) => (
                <Card key={c.id} className="card-glass border-amber-500/20">
                  <CardContent className="p-4 space-y-3">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <ClaimBox label="Claim A" item={c.a} />
                      <ClaimBox label="Claim B" item={c.b} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="font-sans text-xs"
                        disabled={resolveMut.isPending}
                        onClick={() => resolve(c.id, "resolved_in_favor_of_a")}
                      >
                        A is correct
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="font-sans text-xs"
                        disabled={resolveMut.isPending}
                        onClick={() => resolve(c.id, "resolved_in_favor_of_b")}
                      >
                        B is correct
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="font-sans text-xs"
                        disabled={resolveMut.isPending}
                        onClick={() => resolve(c.id, "both_valid_with_scope")}
                      >
                        Both valid (different scope)
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {resolved.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                {resolved.length} resolved
              </p>
              {resolved.map((c) => (
                <Card key={c.id} className="card-glass opacity-70">
                  <CardContent className="p-4 space-y-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {c.status.replace(/_/g, " ")}
                    </Badge>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <ClaimBox label="Claim A" item={c.a} />
                      <ClaimBox label="Claim B" item={c.b} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ClaimBox({
  label,
  item,
}: {
  label: string;
  item: { id: number; canonicalForm: string; confidence: number } | null;
}) {
  return (
    <div className="rounded border border-border/50 bg-secondary/20 p-2.5 space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground font-sans uppercase tracking-wider">{label}</p>
        {item && (
          <Badge variant="outline" className="text-[10px]">
            conf {(item.confidence * 100).toFixed(0)}%
          </Badge>
        )}
      </div>
      <p className="text-sm text-foreground font-body leading-relaxed">
        {item ? item.canonicalForm : "(memory item not found)"}
      </p>
    </div>
  );
}
