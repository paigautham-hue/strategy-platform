import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Zap, Clock, CheckCircle2, XCircle } from "lucide-react";

export default function CostDashboard() {
  const { data, isLoading } = trpc.cost.mySummary.useQuery();

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h2 className="font-heading text-2xl text-foreground">Cost Dashboard</h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          Your LLM usage and cost summary
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Cost",
            value: isLoading ? "—" : `$${(data?.totalCost ?? 0).toFixed(4)}`,
            icon: DollarSign,
          },
          {
            label: "Total Calls",
            value: isLoading ? "—" : (data?.totalCalls ?? 0),
            icon: Zap,
          },
          {
            label: "Avg Latency",
            value: isLoading ? "—" : `${(data?.avgLatency ?? 0).toFixed(0)}ms`,
            icon: Clock,
          },
          {
            label: "Success Rate",
            value: isLoading ? "—" : `${((data?.successRate ?? 1) * 100).toFixed(1)}%`,
            icon: CheckCircle2,
          },
        ].map((item) => (
          <Card key={item.label} className="card-glass">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                    {item.label}
                  </p>
                  {isLoading ? (
                    <Skeleton className="h-7 w-20 mt-1" />
                  ) : (
                    <p className="text-xl font-heading text-foreground mt-1">{item.value}</p>
                  )}
                </div>
                <item.icon className="h-4 w-4 text-gold mt-1" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="card-glass">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-base">Recent LLM Calls</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : data?.logs?.length === 0 ? (
            <p className="text-muted-foreground font-sans text-sm py-4">No LLM calls yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-sans">
                <thead>
                  <tr className="border-b border-border/40">
                    {["Type", "Model", "Tokens In", "Tokens Out", "Cost", "Latency", "Status"].map((h) => (
                      <th key={h} className="text-left text-muted-foreground pb-2 pr-4 font-normal uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data?.logs?.map((log) => (
                    <tr key={log.id} className="border-b border-border/20 hover:bg-secondary/20">
                      <td className="py-2 pr-4">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {log.callType}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">{log.model}</td>
                      <td className="py-2 pr-4">{log.tokensIn}</td>
                      <td className="py-2 pr-4">{log.tokensOut}</td>
                      <td className="py-2 pr-4 text-gold">${(log.costUsd ?? 0).toFixed(5)}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{log.latencyMs}ms</td>
                      <td className="py-2">
                        {log.success ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-destructive" />
                        )}
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
