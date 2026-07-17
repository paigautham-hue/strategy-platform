import { useState, useRef, useEffect } from "react";
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
import { AlertCircle, FileInput, Sparkles, Layers, Upload, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { extractTextFromFile, ACCEPTED_FILE_TYPES } from "@/lib/file-extract";

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
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadFile(file: File) {
    setFileLoading(true);
    try {
      const result = await extractTextFromFile(file);
      setSourceType("text");
      setContent(result.text);
      setFileName(file.name);
      toast.success(`Loaded ${file.name} — ${result.text.length.toLocaleString()} characters`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read the file");
    } finally {
      setFileLoading(false);
    }
  }

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (file) await loadFile(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length === 0) return;
    if (files.length > 1) {
      toast.info("One document at a time — loading the first file; drop the others after ingesting.");
    }
    void loadFile(files[0]);
  }

  // Async job flow: `start` returns immediately with a jobId; we poll `status`
  // for chunk progress. A big document no longer dies at the proxy timeout.
  const [jobId, setJobId] = useState<string | null>(null);
  const notifiedRef = useRef<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const startMut = trpc.ingest.start.useMutation({
    onSuccess: (r) => {
      setJobId(r.jobId);
      notifiedRef.current = null;
    },
    onError: (e) => toast.error(e.message),
  });

  const { data: job } = trpc.ingest.status.useQuery(
    { jobId: jobId! },
    {
      enabled: !!jobId,
      refetchInterval: (query) =>
        query.state.data?.status === "running" ? 2000 : false,
    },
  );

  useEffect(() => {
    if (!job || !jobId || notifiedRef.current === jobId) return;
    if (job.status === "complete" && job.result) {
      notifiedRef.current = jobId;
      toast.success(
        `Ingested — ${job.result.added} added, ${job.result.noop} duplicate, ${job.result.contradictions} contradiction(s)`,
      );
      // Make completion unmistakable: clear the form for the next document
      // and bring the result card into view (it sits below a tall textarea).
      setContent("");
      setFileName(null);
      setSourceUrl("");
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    } else if (job.status === "error") {
      notifiedRef.current = jobId;
      toast.error(job.error ?? "Ingest failed");
    }
  }, [job, jobId]);

  if (!activeCompanyId) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span className="font-sans text-sm">Select a company to ingest documents into its memory.</span>
      </div>
    );
  }

  const running = startMut.isPending || job?.status === "running";
  const result = job?.status === "complete" ? job.result : null;
  const canSubmit = content.trim().length > 0 && !running;

  function submit() {
    if (!activeCompanyId) return;
    startMut.mutate({
      companyId: activeCompanyId,
      sourceType,
      content: content.trim(),
      sourceUrl: sourceType !== "url" && sourceUrl.trim() ? sourceUrl.trim() : undefined,
      maxChunks: 100,
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

          {/* File drop zone — extracts PDF / Word / PowerPoint / Excel / text in-browser */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            onChange={onFilePicked}
            className="hidden"
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            className={`rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
              dragActive
                ? "border-gold bg-gold/5"
                : "border-border/60 bg-secondary/30 hover:border-gold/40"
            }`}
          >
            <Upload className={`h-6 w-6 mx-auto mb-2 ${dragActive ? "text-gold" : "text-muted-foreground"}`} />
            <p className="text-sm font-sans text-foreground">
              {fileLoading
                ? "Reading file…"
                : dragActive
                  ? "Drop it here"
                  : "Drag & drop a file here, or click to browse"}
            </p>
            <p className="text-xs text-muted-foreground font-sans mt-1">
              PDF · Word · PowerPoint · Excel/CSV · Markdown · Text (max 20 MB)
            </p>
            {fileName && (
              <Badge variant="secondary" className="text-[10px] mt-2">loaded: {fileName}</Badge>
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
            {running
              ? job?.progress?.total
                ? `Ingesting — chunk ${job.progress.processed} of ${job.progress.total}…`
                : "Ingesting — chunking, extracting, deciding…"
              : "Ingest document"}
          </Button>
          {running && job?.progress?.total ? (
            <div className="h-1.5 w-full rounded bg-secondary/60 overflow-hidden">
              <div
                className="h-full gradient-gold transition-all duration-500"
                style={{ width: `${Math.round((job.progress.processed / job.progress.total) * 100)}%` }}
              />
            </div>
          ) : null}
          {running && (
            <p className="text-xs text-muted-foreground font-sans text-center">
              Large documents keep processing in the background — you can leave this page and come back.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <Card className="card-glass border-gold/30" ref={resultRef}>
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-gold" /> Document ingested
            </CardTitle>
            <p className="text-xs text-muted-foreground font-sans mt-1">
              {result.added > 0
                ? `${result.added} new fact(s) written to this company's memory. `
                : result.noop > 0
                  ? "Everything in this document was already known — no new facts. "
                  : "No new facts were extracted. "}
              <Link href="/memory">
                <a className="text-gold underline">Open Memory</a>
              </Link>
              {" · the form is cleared for your next document."}
            </p>
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
