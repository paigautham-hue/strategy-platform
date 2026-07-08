import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Users, MessageSquare, Quote } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AnalysisHistory } from "@/components/AnalysisHistory";

interface PersonasProps {
  activeCompanyId: number | null;
}

export default function Personas({ activeCompanyId }: PersonasProps) {
  const [personaId, setPersonaId] = useState<string>("");
  const [question, setQuestion] = useState("");

  const { data: personas, isLoading: personasLoading } = trpc.persona.list.useQuery();

  const utils = trpc.useUtils();
  const consultMut = trpc.persona.consult.useMutation({
    onSuccess: (r) => {
      toast.success(`${r.personaLabel} responded`);
      void utils.analysisRuns.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!activeCompanyId) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span className="font-sans text-sm">Select a company to consult a persona.</span>
      </div>
    );
  }

  const r = consultMut.data;
  const canRun = !!personaId && question.trim().length > 0 && !consultMut.isPending;

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl text-foreground flex items-center gap-2">
          <Users className="h-5 w-5 text-gold" /> Advisory Personas
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          The same question lands differently depending on who you ask. Pick a
          stance and put your question to it — grounded in this company's memory.
        </p>
      </div>

      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Choose a persona</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {personasLoading &&
            [1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}
          {personas?.map((p) => (
            <button
              key={p.id}
              onClick={() => setPersonaId(p.id)}
              className={cn(
                "w-full text-left rounded-md border px-3 py-2.5 transition-colors",
                p.id === personaId
                  ? "border-gold/40 bg-gold/10"
                  : "border-border/60 bg-secondary/30 hover:bg-secondary/50",
              )}
            >
              <p
                className={cn(
                  "font-heading text-sm",
                  p.id === personaId ? "text-gold" : "text-foreground",
                )}
              >
                {p.label}
              </p>
              <p className="text-xs text-muted-foreground font-body mt-0.5 leading-snug">
                {p.description}
              </p>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Your question</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What do you want this persona's take on?"
            className="bg-secondary/50 border-border/60 min-h-[100px] font-body"
            rows={4}
          />
          <Button
            className="w-full gradient-gold text-background font-sans gap-2"
            disabled={!canRun}
            onClick={() =>
              consultMut.mutate({
                companyId: activeCompanyId,
                personaId,
                question: question.trim(),
              })
            }
          >
            <MessageSquare className="h-4 w-4" />
            {consultMut.isPending ? "Consulting…" : "Consult persona"}
          </Button>
        </CardContent>
      </Card>

      {r && (
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <Quote className="h-4 w-4 text-gold" /> {r.personaLabel}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-foreground font-body leading-relaxed whitespace-pre-line">
              {r.response}
            </p>
            {r.keyPoints.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                  Key points
                </p>
                <ul className="space-y-1">
                  {r.keyPoints.map((p, i) => (
                    <li key={i} className="text-sm text-foreground font-body flex gap-2">
                      <span className="text-gold">·</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <AnalysisHistory companyId={activeCompanyId} kind="persona" title="Past consultations" />
    </div>
  );
}
