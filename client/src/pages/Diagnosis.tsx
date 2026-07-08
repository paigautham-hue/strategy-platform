import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Stethoscope, Sparkles, HelpCircle, Compass } from "lucide-react";
import { toast } from "sonner";
import { AnalysisHistory } from "@/components/AnalysisHistory";

interface DiagnosisProps {
  activeCompanyId: number | null;
}

const TYPE_LABEL: Record<string, string> = {
  adjacency: "Adjacency expansion",
  white_space: "White-space discovery",
  geographic: "Geographic expansion",
  m_and_a: "M&A",
  pricing: "Pricing & packaging",
  capability: "Capability build/buy/partner",
  competitive_response: "Competitive response",
  portfolio: "Portfolio allocation",
  scenario: "Scenario planning",
  custom: "Custom",
};

export default function Diagnosis({ activeCompanyId }: DiagnosisProps) {
  const [question, setQuestion] = useState("");

  const diagnoseMut = trpc.diagnosis.diagnose.useMutation({
    onSuccess: (d) => {
      if (d.confidence === "low") {
        toast.warning("Low-confidence diagnosis — the question may need sharpening.");
      } else {
        toast.success(`Diagnosed: ${TYPE_LABEL[d.questionType] ?? d.questionType}`);
      }
    },
    onError: (e) => toast.error(e.message),
  });

  if (!activeCompanyId) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span className="font-sans text-sm">Select a company to diagnose a strategic question.</span>
      </div>
    );
  }

  const d = diagnoseMut.data;

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl text-foreground flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-gold" /> Diagnose
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          Before any framework — is this the right question? The diagnosis reframes it,
          classifies it, and names what must be researched.
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
            placeholder="e.g. Should we build an AI feature to keep up with competitors?"
            className="bg-secondary/50 border-border/60 min-h-[110px] font-body"
            rows={4}
          />
          <Button
            className="w-full gradient-gold text-background font-sans gap-2"
            disabled={!question.trim() || diagnoseMut.isPending}
            onClick={() =>
              diagnoseMut.mutate({ companyId: activeCompanyId, question: question.trim() })
            }
          >
            <Sparkles className="h-4 w-4" />
            {diagnoseMut.isPending ? "Diagnosing…" : "Diagnose the question"}
          </Button>
        </CardContent>
      </Card>

      {d && (
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <Compass className="h-4 w-4 text-gold" /> Diagnosis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge className="text-[10px] bg-gold/10 text-gold border-gold/20">
                {TYPE_LABEL[d.questionType] ?? d.questionType}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                confidence: {d.confidence}
              </Badge>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                The real question
              </p>
              <p className="text-base text-foreground font-body leading-relaxed">
                {d.reframedQuestion}
              </p>
            </div>

            {d.rationale && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                  Why
                </p>
                <p className="text-sm text-muted-foreground font-body leading-relaxed">
                  {d.rationale}
                </p>
              </div>
            )}

            {d.keyUnknowns.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider flex items-center gap-1.5">
                  <HelpCircle className="h-3 w-3" /> Key unknowns — what research must close
                </p>
                <ul className="space-y-1">
                  {d.keyUnknowns.map((u, i) => (
                    <li key={i} className="text-sm text-foreground font-body flex gap-2">
                      <span className="text-gold">·</span>
                      <span>{u}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {d.suggestedFrameworks.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                  Frameworks that would help
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {d.suggestedFrameworks.map((f, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">{f}</Badge>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground font-sans bg-secondary/40 rounded p-2 border border-border/40">
              Next (Phase 2): the Chief Strategist dispatches research agents against these
              unknowns; the Reasoning Mesh (Phase 3) applies the suggested frameworks.
            </p>
          </CardContent>
        </Card>
      )}

      <AnalysisHistory companyId={activeCompanyId} kind="diagnosis" />
    </div>
  );
}
