import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Boxes,
  Plus,
  X,
  Repeat,
  TriangleAlert,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { AnalysisHistory } from "@/components/AnalysisHistory";

interface PatternMiningProps {
  activeCompanyId: number | null;
}

export default function PatternMining({ activeCompanyId }: PatternMiningProps) {
  const [projects, setProjects] = useState<string[]>(["", ""]);
  const [draftedPattern, setDraftedPattern] = useState<string | null>(null);

  const mineMut = trpc.pattern.mine.useMutation({
    onSuccess: (r) =>
      toast.success(
        `Found ${r.patterns.length} patterns, ${r.antiPatterns.length} anti-patterns`,
      ),
    onError: (e) => toast.error(e.message),
  });

  const draftMut = trpc.playbook.draft.useMutation({
    onSuccess: (p) => {
      toast.success(
        <span>
          Playbook drafted and saved: <strong>{p.title}</strong> —{" "}
          <Link href="/playbooks"><a className="underline">open Playbooks</a></Link>
        </span>,
      );
    },
    onError: (e) => toast.error(e.message),
    onSettled: () => setDraftedPattern(null),
  });

  function promoteToPlaybook(patternName: string, description: string, whenItApplies?: string) {
    if (!activeCompanyId) return;
    setDraftedPattern(patternName);
    draftMut.mutate({
      companyId: activeCompanyId,
      pattern: `${patternName}: ${description}${whenItApplies ? ` Applies when: ${whenItApplies}` : ""}`,
      evidenceSummary: `Mined from ${projects.filter((p) => p.trim()).length} past projects on the Pattern Mining surface.`,
    });
  }

  if (!activeCompanyId) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span className="font-sans text-sm">Select a company to mine project patterns.</span>
      </div>
    );
  }

  const filled = projects.map((p) => p.trim()).filter(Boolean);
  const canMine = filled.length >= 2 && !mineMut.isPending;
  const r = mineMut.data;

  function update(i: number, value: string) {
    setProjects((prev) => prev.map((p, idx) => (idx === i ? value : p)));
  }
  function add() {
    setProjects((prev) => [...prev, ""]);
  }
  function remove(i: number) {
    setProjects((prev) => (prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl text-foreground flex items-center gap-2">
          <Boxes className="h-5 w-5 text-gold" /> Pattern Mining
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          Mine past projects for the recurring decision structures that work —
          and the failure shapes that repeat. Patterns that recur become
          candidates for the playbook engine.
        </p>
      </div>

      <Card className="card-glass">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Past projects</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {projects.map((p, i) => (
            <div key={i} className="flex gap-2">
              <Textarea
                value={p}
                onChange={(e) => update(i, e.target.value)}
                placeholder={`Project ${i + 1} — the decision made and how it turned out…`}
                className="bg-secondary/50 border-border/60 min-h-[70px] font-body"
                rows={3}
              />
              {projects.length > 2 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-8 w-8"
                  onClick={() => remove(i)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" className="font-sans gap-2 flex-1" onClick={add}>
              <Plus className="h-4 w-4" /> Add project
            </Button>
            <Button
              className="gradient-gold text-background font-sans gap-2 flex-1"
              disabled={!canMine}
              onClick={() =>
                mineMut.mutate({ companyId: activeCompanyId, projects: filled })
              }
            >
              <Boxes className="h-4 w-4" />
              {mineMut.isPending ? "Mining…" : "Mine patterns"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {r && (
        <>
          <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
            {r.projectsAnalyzed} projects analyzed
          </p>

          {r.patterns.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-heading text-foreground flex items-center gap-2">
                <Repeat className="h-4 w-4 text-gold" /> Recurring patterns
              </p>
              {r.patterns.map((p, i) => (
                <Card key={i} className="card-glass">
                  <CardContent className="p-4 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-heading text-foreground">{p.name}</p>
                      <Badge variant="secondary" className="text-[10px] ml-auto">
                        support {p.support}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground font-body leading-relaxed">
                      {p.description}
                    </p>
                    {p.whenItApplies && (
                      <p className="text-xs text-muted-foreground font-body">
                        <span className="text-gold">When:</span> {p.whenItApplies}
                      </p>
                    )}
                    {p.typicalOutcome && (
                      <p className="text-xs text-muted-foreground font-body">
                        <span className="text-gold">Typical outcome:</span> {p.typicalOutcome}
                      </p>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1.5 mt-1"
                      disabled={draftMut.isPending}
                      onClick={() => promoteToPlaybook(p.name, p.description, p.whenItApplies)}
                    >
                      <BookOpen className="h-3 w-3" />
                      {draftMut.isPending && draftedPattern === p.name
                        ? "Drafting playbook…"
                        : "Draft playbook from this pattern"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {r.antiPatterns.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-heading text-foreground flex items-center gap-2">
                <TriangleAlert className="h-4 w-4 text-destructive" /> Anti-patterns
              </p>
              {r.antiPatterns.map((a, i) => (
                <Card key={i} className="card-glass border-destructive/30">
                  <CardContent className="p-4 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-heading text-foreground">{a.name}</p>
                      <Badge variant="secondary" className="text-[10px] ml-auto">
                        support {a.support}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground font-body leading-relaxed">
                      {a.description}
                    </p>
                    {a.failureMode && (
                      <p className="text-xs text-destructive font-body">
                        Failure mode: {a.failureMode}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {r.patterns.length === 0 && r.antiPatterns.length === 0 && (
            <p className="text-xs text-muted-foreground font-sans text-center">
              No recurring patterns found — the projects may be too varied or too few.
            </p>
          )}
        </>
      )}

      <AnalysisHistory companyId={activeCompanyId} kind="pattern_mining" title="Past mining runs" />
    </div>
  );
}
