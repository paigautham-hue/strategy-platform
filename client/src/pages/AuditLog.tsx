import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Lock } from "lucide-react";

export default function AuditLog() {
  const { data: logs, isLoading } = trpc.audit.list.useQuery({ limit: 100 });

  const tierColor = (tier: string) => {
    if (tier === "restricted") return "bg-destructive/20 text-destructive border-destructive/30";
    if (tier === "confidential") return "bg-warning/20 text-warning border-warning/30";
    return "bg-secondary text-secondary-foreground";
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h2 className="font-heading text-2xl text-foreground">Audit Log</h2>
        <p className="text-muted-foreground font-sans text-sm mt-1 flex items-center gap-1.5">
          <Lock className="h-3 w-3" />
          Append-only · No delete or update path
        </p>
      </div>

      <Card className="card-glass">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-gold" />
            Audit Entries ({logs?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : logs?.length === 0 ? (
            <p className="text-muted-foreground font-sans text-sm py-4">No audit entries yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-sans">
                <thead>
                  <tr className="border-b border-border/40">
                    {["Time", "Action", "Resource", "Tier", "User", "Trace"].map((h) => (
                      <th key={h} className="text-left text-muted-foreground pb-2 pr-4 font-normal uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs?.map((log) => (
                    <tr key={log.id} className="border-b border-border/20 hover:bg-secondary/20">
                      <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {log.action}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {log.resourceType}
                        {log.resourceId && <span className="text-muted-foreground/60"> #{log.resourceId}</span>}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge className={`text-[10px] px-1.5 py-0 ${tierColor(log.confidentialityTier ?? "standard")}`}>
                          {log.confidentialityTier}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">{log.userId ?? "—"}</td>
                      <td className="py-2 text-muted-foreground/60 font-mono text-[10px] truncate max-w-[80px]">
                        {log.traceId ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
