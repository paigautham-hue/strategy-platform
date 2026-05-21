import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Lightbulb, Telescope, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

interface StrategyArtifactProps {
  activeCompanyId: number | null;
}

type SourceType = "text" | "markdown" | "html" | "url";

export default function StrategyArtifact({ activeCompanyId }: StrategyArtifactProps) {
  const [sourceType, setSourceType] = useState<SourceType>("text");
  const [content, setContent] = useState("");

  const recognizeMut = trpc.strategyArtifact.recognize.useMutation({
    onSuccess: (a) => {
      toast.success(
        a.isStrategyArtifact
          ? `Recognised: ${a.artifactType ?? "strategy artifact"}`
          : "Not a strategy artifact",
      );
    },
    onError: (e) => toast.error(e.message),
  });

  if (!activeCompanyId) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span className="font-sans text-sm">Select a company to recognise strategy artifacts.</span>
      </div>
    );
  }

  const a = recognizeMut.data;
  const canSubmit = content.trim().length > 0 && !recognizeMut.isPending;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h2 className="font-heading text-2xl text-foreground">Strategy Artifacts</h2>
        <p className="text-muted-foreground font-sans text-sm mt-1 flex items-center gap-1.5">
          <Telescope className="h-3 w-3" />
          Drop in an external strategy — article, playbook, framework — and extract its reusable structure
        </p>
      </div>

      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-gold" /> Source
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5 max-w-[200px]">
            <label className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
              Source type
            </label>
            <Select value={sourceType} onValueChange={(v) => setSourceType(v as SourceType)}>
              <SelectTrigger className="bg-secondary/50 border-border/60 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Plain text</SelectItem>
                <SelectItem value="markdown">Markdown</SelectItem>
                <SelectItem value="html">Raw HTML</SelectItem>
                <SelectItem value="url">Web URL</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {sourceType === "url" ? (
            <Input
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="https://example.com/strategy-article"
              className="bg-secondary/50 border-border/60 font-body"
            />
          ) : (
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste a strategy article, playbook, framework, or case study…"
              className="bg-secondary/50 border-border/60 min-h-[200px] font-body"
              rows={10}
            />
          )}

          <Button
            className="w-full gradient-gold text-background font-sans gap-2"
            disabled={!canSubmit}
            onClick={() =>
              recognizeMut.mutate({
                companyId: activeCompanyId,
                sourceType,
                content: content.trim(),
              })
            }
          >
            <Telescope className="h-4 w-4" />
            {recognizeMut.isPending ? "Recognising…" : "Recognise strategy"}
          </Button>
        </CardContent>
      </Card>

      {a && (
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              {a.isStrategyArtifact ? (
                <CheckCircle2 className="h-4 w-4 text-gold" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground" />
              )}
              {a.isStrategyArtifact ? a.title : "Not a strategy artifact"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {a.artifactType && (
                <Badge className="text-[10px] bg-gold/10 text-gold border-gold/20">
                  {a.artifactType}
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px]">
                classifier conf: {(a.classifierConfidence * 100).toFixed(0)}%
              </Badge>
              {a.attribution && (
                <Badge variant="secondary" className="text-[10px]">{a.attribution}</Badge>
              )}
            </div>

            {a.isStrategyArtifact && (
              <>
                <Field label="Core thesis" text={a.coreThesis} />
                <ListField label="Preconditions" items={a.preconditions} />
                <ListField label="Key moves" items={a.keyMoves} />
                <ListField label="Expected outcomes" items={a.expectedOutcomes} />
                {a.contextOfOrigin && <Field label="Context of origin" text={a.contextOfOrigin} />}
                <p className="text-xs text-muted-foreground font-sans bg-secondary/40 rounded p-2 border border-border/40">
                  Next (Phase 2): apply this artifact to a portfolio company — fit assessment,
                  adaptation, and an application memo.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, text }: { label: string; text: string }) {
  if (!text) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider">{label}</p>
      <p className="text-sm text-foreground font-body leading-relaxed">{text}</p>
    </div>
  );
}

function ListField({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider">{label}</p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-foreground font-body leading-relaxed flex gap-2">
            <span className="text-gold">·</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
