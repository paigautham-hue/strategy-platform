import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Grid3x3, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface FrameworksProps {
  activeCompanyId: number | null;
}

export default function Frameworks({ activeCompanyId }: FrameworksProps) {
  const [question, setQuestion] = useState("");

  const analyzeMut = trpc.frameworks.analyze.useMutation({
    onSuccess: (r) => toast.success(`${r.analyses.length} frameworks applied`),
    onError: (e) => toast.error(e.message),
  });

  if (!activeCompanyId) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span className="font-sans text-sm">Select a company to run framework analysis.</span>
      </div>
    );
  }

  const data = analyzeMut.data;

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-3xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl text-foreground flex items-center gap-2">
          <Grid3x3 className="h-5 w-5 text-gold" /> Framework Analysis
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          The question is diagnosed, then the frameworks that genuinely fit its type are
          applied — grounded in this company's memory.
        </p>
      </div>

      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Strategic question</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. Should we move upmarket into enterprise?"
            className="bg-secondary/50 border-border/60 min-h-[100px] font-body"
            rows={4}
          />
          <Button
            className="w-full gradient-gold text-background font-sans gap-2"
            disabled={!question.trim() || analyzeMut.isPending}
            onClick={() =>
              analyzeMut.mutate({ companyId: activeCompanyId, question: question.trim() })
            }
          >
            <Sparkles className="h-4 w-4" />
            {analyzeMut.isPending ? "Diagnosing + applying frameworks…" : "Analyze with frameworks"}
          </Button>
        </CardContent>
      </Card>

      {data && (
        <>
          <Card className="card-glass">
            <CardHeader>
              <CardTitle className="font-heading text-lg">Diagnosis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge className="text-[10px] bg-gold/10 text-gold border-gold/20">
                  {data.diagnosis.questionType}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {data.analyses.length} frameworks selected
                </Badge>
              </div>
              <p className="text-sm text-foreground font-body leading-relaxed">
                {data.diagnosis.reframedQuestion}
              </p>
            </CardContent>
          </Card>

          {data.analyses.map((a) => (
            <Card key={a.frameworkId} className="card-glass">
              <CardHeader>
                <CardTitle className="font-heading text-lg">{a.frameworkLabel}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {a.summary && (
                  <p className="text-sm text-muted-foreground font-body leading-relaxed">
                    {a.summary}
                  </p>
                )}
                {a.sections.map((s, i) => (
                  <div key={i} className="space-y-1.5">
                    <p className="text-xs text-gold font-sans uppercase tracking-wider">{s.title}</p>
                    <ul className="space-y-1">
                      {s.points.map((p, j) => (
                        <li key={j} className="text-sm text-foreground font-body flex gap-2">
                          <span className="text-gold">·</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {a.keyImplications.length > 0 && (
                  <div className="space-y-1.5 rounded border border-gold/20 bg-gold/5 p-3">
                    <p className="text-xs text-gold font-sans uppercase tracking-wider">
                      Key implications
                    </p>
                    <ul className="space-y-1">
                      {a.keyImplications.map((k, i) => (
                        <li key={i} className="text-sm text-foreground font-body flex gap-2">
                          <span className="text-gold">·</span>
                          <span>{k}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
