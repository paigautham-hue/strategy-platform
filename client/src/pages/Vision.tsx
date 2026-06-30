import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, ImagePlus, Sparkles, Upload, Download } from "lucide-react";
import { toast } from "sonner";

interface Props {
  activeCompanyId: number | null;
}

const MAX_BYTES = 8 * 1024 * 1024;

export default function Vision({ activeCompanyId }: Props) {
  // ── Extract (vision-in) ──
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("");
  const [instruction, setInstruction] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Generate (vision-out) ──
  const [prompt, setPrompt] = useState("");

  const extractMut = trpc.vision.extract.useMutation({ onError: (e) => toast.error(e.message) });
  const generateMut = trpc.vision.generate.useMutation({ onError: (e) => toast.error(e.message) });

  function onPickFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image exceeds the 8 MB limit.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setDataUrl(url);
      setBase64(url.includes(",") ? url.slice(url.indexOf(",") + 1) : url);
      setMimeType(file.type);
      extractMut.reset();
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-3xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl text-foreground flex items-center gap-2">
          <Eye className="h-5 w-5 text-gold" /> Vision Studio
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          Read a slide, whiteboard, chart, or screenshot into structured text — or generate a
          stylised image from a prompt.
        </p>
      </div>

      <Tabs defaultValue="extract">
        <TabsList>
          <TabsTrigger value="extract" className="gap-1.5">
            <ImagePlus className="h-3.5 w-3.5" /> Extract
          </TabsTrigger>
          <TabsTrigger value="generate" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Generate
          </TabsTrigger>
        </TabsList>

        {/* ── Vision IN ── */}
        <TabsContent value="extract" className="space-y-4 mt-3">
          <Card className="card-glass">
            <CardHeader>
              <CardTitle className="font-heading text-lg">Extract from an image</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                aria-label="Choose an image"
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0])}
              />
              <Button variant="outline" className="gap-2" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" /> {dataUrl ? "Choose a different image" : "Choose an image"}
              </Button>

              {dataUrl && (
                <div className="rounded border border-border/50 bg-secondary/20 p-2">
                  <img src={dataUrl} alt="Selected" className="max-h-64 mx-auto rounded" />
                </div>
              )}

              <div className="space-y-1">
                <label htmlFor="vision-instruction" className="text-[11px] text-muted-foreground font-sans uppercase tracking-wider">
                  What to extract (optional)
                </label>
                <Textarea
                  id="vision-instruction"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="e.g. Read this revenue chart — give me the series and the values per year."
                  className="bg-secondary/50 border-border/60 font-body text-sm min-h-[60px]"
                />
              </div>

              <Button
                className="gradient-gold text-background font-sans gap-2"
                disabled={!base64 || extractMut.isPending}
                onClick={() =>
                  base64 &&
                  extractMut.mutate({
                    imageBase64: base64,
                    mimeType,
                    instruction: instruction.trim() || undefined,
                    companyId: activeCompanyId ?? undefined,
                  })
                }
              >
                <Eye className="h-4 w-4" />
                {extractMut.isPending ? "Reading…" : "Extract"}
              </Button>

              {extractMut.data && (
                <div className="rounded border border-gold/30 bg-gold/5 p-4">
                  {extractMut.data.text ? (
                    <p className="text-sm font-body text-foreground whitespace-pre-wrap leading-relaxed">
                      {extractMut.data.text}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground font-body">
                      Couldn't read anything from that image — try a clearer or higher-resolution one.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Vision OUT ── */}
        <TabsContent value="generate" className="space-y-4 mt-3">
          <Card className="card-glass">
            <CardHeader>
              <CardTitle className="font-heading text-lg">Generate an image</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="vision-prompt" className="text-[11px] text-muted-foreground font-sans uppercase tracking-wider">
                  Prompt
                </label>
                <Textarea
                  id="vision-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. A clean Three-Horizons diagram for a print-services growth strategy, gold-on-charcoal."
                  className="bg-secondary/50 border-border/60 font-body text-sm min-h-[80px]"
                />
              </div>
              <Button
                className="gradient-gold text-background font-sans gap-2"
                disabled={!prompt.trim() || generateMut.isPending}
                onClick={() => generateMut.mutate({ prompt: prompt.trim() })}
              >
                <Sparkles className="h-4 w-4" />
                {generateMut.isPending ? "Generating…" : "Generate"}
              </Button>

              {generateMut.isSuccess &&
                (generateMut.data?.url ? (
                  <div className="rounded border border-gold/30 bg-gold/5 p-2 space-y-2">
                    <img src={generateMut.data.url} alt="Generated" className="max-h-80 mx-auto rounded" />
                    <a href={generateMut.data.url} target="_blank" rel="noreferrer" className="block">
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs w-full">
                        <Download className="h-3 w-3" /> Open full image
                      </Button>
                    </a>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground font-body">
                    Image generation didn't return a result — try rephrasing the prompt.
                  </p>
                ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
