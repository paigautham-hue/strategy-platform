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
import { AlertCircle, FileInput, Sparkles, Layers } from "lucide-react";
import { toast } from "sonner";

interface IngestProps {
  activeCompanyId: number | null;
}

type SourceType = "text" | "markdown" | "html" | "url";

const SOURCE_LABEL: Record<SourceType, string> = {
  text: "Plain text",
  markdown: "Markdown",
  html: "Raw HTML",
  url: "Web URL",
};

export default function Ingest({ activeCompanyId }: IngestProps) {
  const [sourceType, setSourceType] = useState<SourceType>("text");
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");

  const ingestMut = trpc.ingest.document.useMutation({
    onSuccess: (r) => {
      toast.success(
        `Ingested — ${r.added} added, ${r.noop} duplicate, ${r.contradictions} contradiction(s)`,
      );
    },
    onError: (e) => toast.error(e.message),
  });

  if (!activeCompanyId) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span className="font-sans text-sm">Select a company to ingest documents into its memory.</span>
      </div>
    );
  }

  const result = ingestMut.data;
  const canSubmit = content.trim().length > 0 && !ingestMut.isPending;

  function submit() {
    if (!activeCompanyId) return;
    ingestMut.mutate({
      companyId: activeCompanyId,
      sourceType,
      content: content.trim(),
      sourceUrl: sourceType !== "url" && sourceUrl.trim() ? sourceUrl.trim() : undefined,
    });
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h2 className="font-heading text-2xl text-foreground">Ingest</h2>
        <p className="text-muted-foreground font-sans text-sm mt-1 flex items-center gap-1.5">
          <Layers className="h-3 w-3" />
          Document → chunk → extract claims → ADD / NOOP / UPDATE / SUPERSEDE / CONTRADICTION → memory
        </p>
      </div>

      {/* Source form */}
      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <FileInput className="h-4 w-4 text-gold" /> Source
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                Source type
              </label>
              <Select value={sourceType} onValueChange={(v) => setSourceType(v as SourceType)}>
                <SelectTrigger className="bg-secondary/50 border-border/60 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SOURCE_LABEL) as SourceType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {SOURCE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {sourceType !== "url" && (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                  Source URL (optional)
                </label>
                <Input
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://… — sets source trust"
                  className="bg-secondary/50 border-border/60"
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
              {sourceType === "url" ? "URL to fetch" : `${SOURCE_LABEL[sourceType]} content`}
            </label>
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
                placeholder="Paste the document content here…"
                className="bg-secondary/50 border-border/60 min-h-[180px] font-body"
                rows={9}
              />
            )}
          </div>

          <p className="text-xs text-muted-foreground font-sans bg-secondary/40 rounded p-2 border border-border/40">
            Claims are extracted, deduplicated against existing memory, and stored with
            source-trust-weighted confidence. Low-trust sources are quarantined until corroborated.
          </p>

          <Button
            className="w-full gradient-gold text-background font-sans gap-2"
            disabled={!canSubmit}
            onClick={submit}
          >
            <Sparkles className="h-4 w-4" />
            {ingestMut.isPending ? "Ingesting — chunking, extracting, deciding…" : "Ingest document"}
          </Button>
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Ingest result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Source chars" value={result.sourceChars} />
              <Stat label="Chunks" value={`${result.chunksProcessed}/${result.chunks}`} />
              <Stat label="Claims extracted" value={result.claimsExtracted} />
              <Stat label="Source trust" value={`${(result.sourceTrust * 100).toFixed(0)}%`} />
              <Stat label="Added" value={result.added} accent />
              <Stat label="Duplicates (noop)" value={result.noop} />
              <Stat label="Updated / superseded" value={result.updated + result.superseded} />
              <Stat label="Contradictions" value={result.contradictions} />
            </div>

            <div className="flex flex-wrap gap-2">
              {result.quarantined > 0 && (
                <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-400">
                  {result.quarantined} quarantined (low-trust source)
                </Badge>
              )}
              {result.resolvedUrl && (
                <Badge variant="secondary" className="text-[10px]">
                  fetched: {result.resolvedUrl}
                </Badge>
              )}
              <Badge variant="secondary" className="text-[10px]">
                {result.memoryItemIds.length} memory item(s) written
              </Badge>
            </div>

            {result.errors.length > 0 && (
              <div className="space-y-1 rounded border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="text-xs font-sans uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <AlertCircle className="h-3 w-3" /> {result.errors.length} note(s)
                </p>
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-muted-foreground font-sans">
                    {e}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
      <p className="text-[10px] text-muted-foreground font-sans uppercase tracking-wider">{label}</p>
      <p className={`font-heading text-xl mt-0.5 ${accent ? "text-gold" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
