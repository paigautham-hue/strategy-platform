import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Cpu, Play, ChevronDown, ChevronUp, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface McpToolsProps {
  activeCompanyId: number | null;
}

export default function McpTools({ activeCompanyId }: McpToolsProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, { success: boolean; output?: unknown; error?: string; latencyMs: number }>>({});

  const { data: tools, isLoading } = trpc.mcp.tools.useQuery();
  const dispatchMut = trpc.mcp.dispatch.useMutation({
    onSuccess: (data, variables) => {
      setResults((prev) => ({ ...prev, [variables.toolName]: data }));
      if (!data.success) toast.error(`Tool failed: ${data.error}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const dispatch = (toolName: string) => {
    let parsedInput: unknown = {};
    try {
      parsedInput = JSON.parse(inputs[toolName] || "{}");
    } catch {
      toast.error("Invalid JSON input");
      return;
    }
    dispatchMut.mutate({ toolName, input: parsedInput, companyId: activeCompanyId ?? undefined });
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h2 className="font-heading text-2xl text-foreground">MCP Tool Registry</h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          All tool calls are dispatched through the MCP gateway. Direct fetch calls in domain code are prohibited.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {tools?.map((tool) => {
            const isExpanded = expanded === tool.name;
            const result = results[tool.name];
            const isPending = dispatchMut.isPending && dispatchMut.variables?.toolName === tool.name;

            return (
              <Card key={tool.name} className="card-glass">
                <CardHeader
                  className="pb-2 cursor-pointer"
                  onClick={() => setExpanded(isExpanded ? null : tool.name)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
                        <Cpu className="h-4 w-4 text-gold" />
                      </div>
                      <div>
                        <CardTitle className="font-heading text-sm text-foreground">
                          {tool.name}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground font-sans mt-0.5">
                          {tool.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {result && (
                        result.success
                          ? <CheckCircle2 className="h-4 w-4 text-success" />
                          : <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      {isExpanded
                        ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      }
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0 space-y-3">
                    {tool.inputSchema != null && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                          Expected input
                        </p>
                        <pre className="text-[11px] font-mono bg-secondary/40 rounded p-2 border border-border/40 overflow-x-auto max-h-32 text-muted-foreground">
                          {JSON.stringify(tool.inputSchema, null, 2)}
                        </pre>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                        Input (JSON)
                      </label>
                      <Textarea
                        value={inputs[tool.name] ?? "{}"}
                        onChange={(e) =>
                          setInputs((prev) => ({ ...prev, [tool.name]: e.target.value }))
                        }
                        placeholder={`{"query": "example"}`}
                        className="bg-secondary/50 border-border/60 font-mono text-xs min-h-[80px]"
                        rows={3}
                      />
                    </div>
                    <Button
                      size="sm"
                      className="gradient-gold text-background font-sans gap-2"
                      disabled={isPending}
                      onClick={() => dispatch(tool.name)}
                    >
                      {isPending ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Running...</>
                      ) : (
                        <><Play className="h-3.5 w-3.5" /> Dispatch</>
                      )}
                    </Button>

                    {result && (
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={result.success ? "default" : "destructive"}
                            className={`text-[10px] px-1.5 py-0 ${result.success ? "bg-success/20 text-success border-success/30" : ""}`}
                          >
                            {result.success ? "success" : "error"}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground font-sans">
                            {result.latencyMs}ms
                          </span>
                        </div>
                        <pre className="text-xs font-mono bg-secondary/40 rounded p-3 border border-border/40 overflow-x-auto max-h-48 text-foreground/80">
                          {result.success
                            ? JSON.stringify(result.output, null, 2)
                            : result.error
                          }
                        </pre>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
