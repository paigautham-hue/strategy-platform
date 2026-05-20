import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity } from "lucide-react";

export default function UsageEvents() {
  const { data: events, isLoading } = trpc.audit.usageEvents.useQuery({ limit: 100 });

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h2 className="font-heading text-2xl text-foreground">Usage Events</h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          All UI actions emitted to the usage event log
        </p>
      </div>

      <Card className="card-glass">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-gold" />
            Events ({events?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : events?.length === 0 ? (
            <p className="text-muted-foreground font-sans text-sm py-4">No usage events yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-sans">
                <thead>
                  <tr className="border-b border-border/40">
                    {["Time", "Action", "Surface", "Role", "User", "Company"].map((h) => (
                      <th key={h} className="text-left text-muted-foreground pb-2 pr-4 font-normal uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {events?.map((e) => (
                    <tr key={e.id} className="border-b border-border/20 hover:bg-secondary/20">
                      <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">
                        {new Date(e.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {e.action}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">{e.surface}</td>
                      <td className="py-2 pr-4">
                        {e.role && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {e.role}
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">{e.userId ?? "—"}</td>
                      <td className="py-2 text-muted-foreground">{e.companyId ?? "—"}</td>
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
