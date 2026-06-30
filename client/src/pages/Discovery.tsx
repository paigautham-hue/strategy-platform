import { useMemo, useRef, useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Compass, Send, Sparkles, Save, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };
type Dimension = "businessModel" | "financials" | "operations" | "organization" | "technology";
type Coverage = Record<Dimension, number>;
const DIM_ORDER: Dimension[] = ["businessModel", "financials", "operations", "organization", "technology"];
const ZERO: Coverage = { businessModel: 0, financials: 0, operations: 0, organization: 0, technology: 0 };

interface Props {
  activeCompanyId: number | null;
}

export default function Discovery({ activeCompanyId }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [coverage, setCoverage] = useState<Coverage>(ZERO);
  const [gates, setGates] = useState({ overall: 0, previewAvailable: false, fullStrategyAvailable: false });
  const [drafts, setDrafts] = useState<Partial<Record<Dimension, string>>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  // Track the current company so a turn that resolves AFTER a company switch is ignored.
  const activeCompanyIdRef = useRef(activeCompanyId);
  activeCompanyIdRef.current = activeCompanyId;

  const { data: dimensions } = trpc.digitalTwin.dimensions.useQuery();
  const twinQuery = trpc.digitalTwin.twin.useQuery(
    { companyId: activeCompanyId ?? 0 },
    { enabled: activeCompanyId != null },
  );

  const turnMut = trpc.digitalTwin.nextTurn.useMutation({ onError: (e) => toast.error(e.message) });
  const saveMut = trpc.digitalTwin.saveDimension.useMutation({
    onSuccess: () => {
      toast.success("Dimension saved");
      twinQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const strategyMut = trpc.digitalTwin.generateStrategy.useMutation({ onError: (e) => toast.error(e.message) });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Reset per-company local state when the active company changes, so drafts and
  // the transcript from one company never leak into another (Save and Generate
  // are company-scoped, so a stale draft would otherwise write under the wrong id).
  useEffect(() => {
    setDrafts({});
    setMessages([]);
    setCoverage(ZERO);
    setGates({ overall: 0, previewAvailable: false, fullStrategyAvailable: false });
    strategyMut.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompanyId]);

  const dimLabel = useMemo<Record<string, string>>(() => dimensions ?? {}, [dimensions]);

  function send() {
    const text = input.trim();
    if (!text || turnMut.isPending) return;
    const reqCompany = activeCompanyId; // the company this turn was issued for
    const history = messages;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    turnMut.mutate(
      { history, userMessage: text, companyId: activeCompanyId ?? undefined },
      {
        onSuccess: (res) => {
          if (activeCompanyIdRef.current !== reqCompany) return; // switched mid-flight — drop stale reply
          setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
          setCoverage(res.coverage as Coverage);
          setGates(res.gates);
        },
        onError: () => {
          if (activeCompanyIdRef.current !== reqCompany) return;
          // Roll back the optimistic user bubble and restore the text so it isn't lost.
          setMessages((m) => m.slice(0, -1));
          setInput(text);
        },
      },
    );
  }

  const twinData = twinQuery.data;
  // The twin actually used for generation merges unsaved textarea drafts over the
  // persisted summaries, so "Generate" never silently ignores on-screen edits.
  const merged = useMemo(() => {
    const out: Partial<Record<Dimension, string>> = {};
    for (const d of DIM_ORDER) {
      const v = (drafts[d] ?? (twinData as Record<string, string> | undefined)?.[d] ?? "").trim();
      if (v) out[d] = v;
    }
    return out;
  }, [drafts, twinData]);
  const hasTwinContent = Object.keys(merged).length > 0;
  const strategy = strategyMut.data;

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-6xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl text-foreground flex items-center gap-2">
          <Compass className="h-5 w-5 text-gold" /> Discovery — Digital Twin
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          A guided interview that builds a structured picture of the business across five dimensions,
          steering toward whatever is still under-explored.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="card-glass flex flex-col h-[28rem]">
            <CardContent ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <p className="text-sm text-muted-foreground font-body text-center mt-16">
                  Start by describing the business — what it does and how it makes money.
                </p>
              )}
              {messages.map((m, i) => (
                <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={
                      m.role === "user"
                        ? "max-w-[80%] rounded-lg bg-gold/10 border border-gold/30 px-3 py-2 text-sm font-body"
                        : "max-w-[85%] rounded-lg bg-secondary/40 border border-border/50 px-3 py-2 text-sm font-body"
                    }
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {turnMut.isPending && (
                <div className="flex justify-start">
                  <div className="rounded-lg bg-secondary/40 border border-border/50 px-3 py-2 text-sm text-muted-foreground font-body animate-pulse">
                    Thinking…
                  </div>
                </div>
              )}
            </CardContent>
            <div className="border-t border-border/50 p-3 flex gap-2">
              <Input
                aria-label="Type your answer"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Type your answer…"
                className="bg-secondary/50 border-border/60 font-body"
              />
              <Button
                aria-label="Send message"
                className="gradient-gold text-background gap-1.5"
                disabled={!input.trim() || turnMut.isPending}
                onClick={send}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>

        {/* Coverage + gates */}
        <div className="space-y-4">
          <Card className="card-glass">
            <CardHeader>
              <CardTitle className="font-heading text-base">Coverage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {DIM_ORDER.map((d) => (
                <div key={d} className="space-y-1">
                  <div className="flex justify-between text-xs font-sans">
                    <span className="text-muted-foreground">{dimLabel[d] ?? d}</span>
                    <span className="text-foreground">{coverage[d]}%</span>
                  </div>
                  <Progress value={coverage[d]} className="h-1.5" />
                </div>
              ))}
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="outline" className="gap-1 text-[10px]">
                  Overall {gates.overall}%
                </Badge>
                <Badge variant={gates.previewAvailable ? "default" : "secondary"} className="gap-1 text-[10px]">
                  {gates.previewAvailable ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                  Preview
                </Badge>
                <Badge variant={gates.fullStrategyAvailable ? "default" : "secondary"} className="gap-1 text-[10px]">
                  {gates.fullStrategyAvailable ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                  Full strategy
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Capture + strategy */}
      {activeCompanyId == null ? (
        <Card className="card-glass">
          <CardContent className="p-4 text-sm text-muted-foreground font-body text-center">
            Select a company (top bar) to capture the Digital Twin and generate a strategy.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="card-glass">
            <CardHeader>
              <CardTitle className="font-heading text-base">Capture the Digital Twin</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {DIM_ORDER.map((d) => {
                // The value actually shown = unsaved draft over persisted summary.
                // Save/disable gate on `shown`, so a loaded-but-unedited dimension
                // can be re-saved and an empty string is never persisted.
                const shown = drafts[d] ?? (twinData as Record<string, string> | undefined)?.[d] ?? "";
                return (
                  <div key={d} className="space-y-1">
                    <label htmlFor={`dim-${d}`} className="text-[11px] text-muted-foreground font-sans uppercase tracking-wider">
                      {dimLabel[d] ?? d}
                    </label>
                    <Textarea
                      id={`dim-${d}`}
                      value={shown}
                      onChange={(e) => setDrafts((p) => ({ ...p, [d]: e.target.value }))}
                      placeholder={`Summary of ${dimLabel[d] ?? d}…`}
                      className="bg-secondary/50 border-border/60 font-body text-sm min-h-[60px]"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      disabled={saveMut.isPending || !shown.trim()}
                      onClick={() =>
                        saveMut.mutate({
                          companyId: activeCompanyId,
                          dimension: d,
                          // Omit a stale 0 (coverage resets on company switch and only
                          // fills from live chat) so re-saving doesn't clobber prior confidence.
                          summary: shown.trim(),
                          confidence: coverage[d] || undefined,
                        })
                      }
                    >
                      <Save className="h-3 w-3" /> Save
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="card-glass">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-heading text-base">AI transformation strategy</CardTitle>
              <Button
                size="sm"
                className="gradient-gold text-background gap-1.5 text-xs"
                disabled={!hasTwinContent || strategyMut.isPending}
                onClick={() => strategyMut.mutate({ twin: merged, companyId: activeCompanyId })}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {strategyMut.isPending ? "Generating…" : "Generate"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {!strategy && (
                <p className="text-sm text-muted-foreground font-body">
                  {hasTwinContent
                    ? "Generate a strategy from the captured Digital Twin."
                    : "Capture at least one dimension to enable generation."}
                </p>
              )}
              {strategy && (
                <div className="space-y-3">
                  <div className="rounded border border-gold/30 bg-gold/5 p-3 text-center">
                    <p className="text-[11px] text-muted-foreground font-sans uppercase tracking-wider">
                      AI readiness
                    </p>
                    <p className="font-heading text-3xl text-gold">{strategy.aiReadinessScore}/100</p>
                  </div>
                  {strategy.executiveSummary && (
                    <p className="text-sm font-body text-foreground">{strategy.executiveSummary}</p>
                  )}
                  {strategy.opportunities.length > 0 && (
                    <Section title="Opportunities">
                      {strategy.opportunities.map((o, i) => (
                        <li key={i} className="text-sm font-body">
                          <span className="text-foreground font-medium">{o.title}</span>
                          {o.impact && <Badge variant="secondary" className="ml-2 text-[10px]">impact: {o.impact}</Badge>}
                          {o.description && <span className="block text-muted-foreground text-xs">{o.description}</span>}
                        </li>
                      ))}
                    </Section>
                  )}
                  {strategy.risks.length > 0 && (
                    <Section title="Risks">
                      {strategy.risks.map((r, i) => (
                        <li key={i} className="text-sm font-body">
                          <span className="text-foreground font-medium">{r.risk}</span>
                          {r.mitigation && <span className="block text-muted-foreground text-xs">→ {r.mitigation}</span>}
                        </li>
                      ))}
                    </Section>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-sans uppercase tracking-wider text-gold">{title}</p>
      <ul className="space-y-1.5 list-none">{children}</ul>
    </div>
  );
}
