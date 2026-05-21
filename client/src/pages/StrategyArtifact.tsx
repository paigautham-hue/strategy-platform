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
import {
  AlertCircle,
  Lightbulb,
  Telescope,
  CheckCircle2,
  XCircle,
  Target,
  ArrowRight,
} from "lucide-react";
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
        a.isStrategyArtifact ? `Recognised: ${a.artifactType ?? "artifact"}` : "Not a strategy artifact",
      );
    },
    onError: (e) => toast.error(e.message),
  });

  const applyMut = trpc.strategyArtifact.applyToCompany.useMutation({
    onSuccess: (r) => {
      toast.success(
        r.artifact.isStrategyArtifact
          ? `Applied — fit score ${r.application.fitScore}/100`
          : "Not a strategy artifact",
      );
    },
    onError: (e) => toast.error(e.message),
  });

  if (!activeCompanyId) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span className="font-sans text-sm">Select a company to recognise and apply strategy artifacts.</span>
      </div>
    );
  }

  const artifact = applyMut.data?.artifact ?? recognizeMut.data;
  const application = applyMut.data?.application;
  const busy = recognizeMut.isPending || applyMut.isPending;
  const canSubmit = content.trim().length > 0 && !busy;

  function run(kind: "recognize" | "apply") {
    if (!activeCompanyId) return;
    const input = { companyId: activeCompanyId, sourceType, content: content.trim() };
    if (kind === "recognize") recognizeMut.mutate(input);
    else applyMut.mutate(input);
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h2 className="font-heading text-2xl text-foreground">Strategy Artifacts</h2>
        <p className="text-muted-foreground font-sans text-sm mt-1 flex items-center gap-1.5">
          <Telescope className="h-3 w-3" />
          Drop in an external strategy — recognise its structure, then apply it to this company
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

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="font-sans gap-2 flex-1"
              disabled={!canSubmit}
              onClick={() => run("recognize")}
            >
              <Telescope className="h-4 w-4" />
              {recognizeMut.isPending ? "Recognising…" : "Recognise only"}
            </Button>
            <Button
              className="gradient-gold text-background font-sans gap-2 flex-1"
              disabled={!canSubmit}
              onClick={() => run("apply")}
            >
              <Target className="h-4 w-4" />
              {applyMut.isPending ? "Recognising + applying…" : "Recognise & apply to company"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recognised artifact */}
      {artifact && (
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              {artifact.isStrategyArtifact ? (
                <CheckCircle2 className="h-4 w-4 text-gold" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground" />
              )}
              {artifact.isStrategyArtifact ? artifact.title : "Not a strategy artifact"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {artifact.artifactType && (
                <Badge className="text-[10px] bg-gold/10 text-gold border-gold/20">
                  {artifact.artifactType}
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px]">
                classifier conf: {(artifact.classifierConfidence * 100).toFixed(0)}%
              </Badge>
              {artifact.attribution && (
                <Badge variant="secondary" className="text-[10px]">{artifact.attribution}</Badge>
              )}
            </div>
            {artifact.isStrategyArtifact && (
              <>
                <Field label="Core thesis" text={artifact.coreThesis} />
                <ListField label="Preconditions" items={artifact.preconditions} />
                <ListField label="Key moves" items={artifact.keyMoves} />
                <ListField label="Expected outcomes" items={artifact.expectedOutcomes} />
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Application result */}
      {application && artifact?.isStrategyArtifact && (
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <Target className="h-4 w-4 text-gold" /> Application to this company
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg border border-border/50 bg-secondary/30 px-4 py-2">
                <p className="text-[10px] text-muted-foreground font-sans uppercase tracking-wider">
                  Fit score
                </p>
                <p className="font-heading text-2xl text-gold">{application.fitScore}/100</p>
              </div>
              <p className="text-sm text-foreground font-body leading-relaxed flex-1">
                {application.fitRationale}
              </p>
            </div>

            <div className="rounded border border-gold/20 bg-gold/5 p-3">
              <p className="text-xs font-sans uppercase tracking-wider text-gold">Recommendation</p>
              <p className="text-sm text-foreground font-body mt-0.5">{application.recommendation}</p>
            </div>

            <ListField label="Gaps to close" items={application.gaps} />

            {application.adaptedMoves.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                  Adapted moves
                </p>
                <div className="space-y-2">
                  {application.adaptedMoves.map((m, i) => (
                    <div key={i} className="rounded border border-border/50 bg-secondary/20 p-2.5 space-y-1">
                      <p className="text-xs text-muted-foreground font-body line-through">{m.original}</p>
                      <p className="text-sm text-foreground font-body flex gap-1.5">
                        <ArrowRight className="h-3.5 w-3.5 text-gold shrink-0 mt-0.5" />
                        {m.adapted}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <ListField label="Risks" items={application.risks} />

            {application.applicationMemo && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                  Application memo
                </p>
                <p className="text-sm text-foreground font-body leading-relaxed whitespace-pre-line">
                  {application.applicationMemo}
                </p>
              </div>
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
