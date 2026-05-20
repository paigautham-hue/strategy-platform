import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, Plus, Search, AlertCircle, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface MemoryProps {
  activeCompanyId: number | null;
}

export default function Memory({ activeCompanyId }: MemoryProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [rawContent, setRawContent] = useState("");
  const [claimModality, setClaimModality] = useState<"actual" | "hypothetical" | "simulated" | "counterfactual">("actual");
  const [confidence, setConfidence] = useState("0.7");

  const { data: memories, isLoading, refetch } = trpc.memory.query.useQuery(
    { companyId: activeCompanyId!, query: searchQuery || undefined, limit: 50 },
    { enabled: !!activeCompanyId }
  );

  const writeMut = trpc.memory.write.useMutation({
    onSuccess: () => {
      toast.success("Memory item written and embedded");
      setOpen(false);
      setRawContent("");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!activeCompanyId) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span className="font-sans text-sm">Select a company to view its memory store.</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl text-foreground">Memory Store</h2>
          <p className="text-muted-foreground font-sans text-sm mt-1 flex items-center gap-1.5">
            <Lock className="h-3 w-3" />
            Company-scoped isolation enforced · Bi-temporal (C19) · Canonical form (C20)
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gradient-gold text-background font-sans gap-2">
              <Plus className="h-4 w-4" /> Write Memory
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border/60 max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading">Write Memory Item</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-xs text-muted-foreground font-sans bg-secondary/40 rounded p-2 border border-border/40">
                The LLM router will normalize your input to canonical S-P-O-Q form and generate an embedding. PII will be redacted before any LLM call.
              </p>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                  Raw Content *
                </label>
                <Textarea
                  value={rawContent}
                  onChange={(e) => setRawContent(e.target.value)}
                  placeholder="Enter a strategic claim, insight, or observation..."
                  className="bg-secondary/50 border-border/60 min-h-[100px] font-body"
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                    Modality
                  </label>
                  <Select
                    value={claimModality}
                    onValueChange={(v) => setClaimModality(v as typeof claimModality)}
                  >
                    <SelectTrigger className="bg-secondary/50 border-border/60 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="actual">Actual</SelectItem>
                      <SelectItem value="hypothetical">Hypothetical</SelectItem>
                      <SelectItem value="simulated">Simulated</SelectItem>
                      <SelectItem value="counterfactual">Counterfactual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                    Confidence (0–1)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={confidence}
                    onChange={(e) => setConfidence(e.target.value)}
                    className="bg-secondary/50 border-border/60"
                  />
                </div>
              </div>
              <Button
                className="w-full gradient-gold text-background font-sans"
                disabled={!rawContent.trim() || writeMut.isPending}
                onClick={() =>
                  writeMut.mutate({
                    companyId: activeCompanyId,
                    rawContent: rawContent.trim(),
                    claimModality,
                    confidence: parseFloat(confidence),
                  })
                }
              >
                {writeMut.isPending ? "Writing & embedding..." : "Write Memory"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search memory by keyword..."
          className="pl-9 bg-secondary/50 border-border/60 font-sans"
        />
      </div>

      {/* Memory list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : memories?.length === 0 ? (
        <Card className="card-glass">
          <CardContent className="py-16 text-center">
            <Brain className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-body">
              {searchQuery ? "No memory items match your query." : "No memory items yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {memories?.map((m) => (
            <Card key={m.id} className="card-glass hover:border-gold/20 transition-colors">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                      Canonical Form
                    </p>
                    <p className="text-sm text-foreground font-body leading-relaxed">
                      {m.canonicalForm}
                    </p>
                    {m.rawContent !== m.canonicalForm && (
                      <>
                        <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider mt-2">
                          Raw
                        </p>
                        <p className="text-xs text-muted-foreground font-sans line-clamp-2">
                          {m.rawContent}
                        </p>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {m.claimModality}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    conf: {((m.confidence ?? 0) * 100).toFixed(0)}%
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {m.decayClass}
                  </Badge>
                  {m.embedding && (
                    <Badge className="text-[10px] px-1.5 py-0 bg-gold/10 text-gold border-gold/20">
                      embedded · {m.embeddingModelVersion}
                    </Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground font-sans ml-auto">
                    {new Date(m.validAt).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
