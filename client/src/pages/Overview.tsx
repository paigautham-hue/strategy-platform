import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Brain,
  TrendingUp,
  DollarSign,
  Building2,
  Activity,
  Shield,
  AlertCircle,
  Rocket,
  ArrowRight,
  Sparkles,
  Stethoscope,
  Radar,
  ListChecks,
  Crosshair,
  Workflow,
} from "lucide-react";
import { Link } from "wouter";

const QUICK_ACTIONS = [
  { href: "/diagnose", label: "Diagnose", icon: Stethoscope },
  { href: "/brainstorm", label: "Brainstorm", icon: Sparkles },
  { href: "/research", label: "Research", icon: Radar },
  { href: "/options", label: "Options", icon: ListChecks },
  { href: "/war-game", label: "War-Game", icon: Crosshair },
  { href: "/decompose", label: "Decompose", icon: Workflow },
];

interface OverviewProps {
  activeCompanyId: number | null;
}

function StatCard({
  title,
  value,
  icon: Icon,
  sub,
  href,
  loading,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
  href?: string;
  loading?: boolean;
}) {
  const content = (
    <Card className="card-glass hover:border-gold/30 transition-colors cursor-pointer group">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
              {title}
            </p>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <p className="text-2xl font-heading text-foreground group-hover:text-gold transition-colors">
                {value}
              </p>
            )}
            {sub && (
              <p className="text-xs text-muted-foreground font-sans">{sub}</p>
            )}
          </div>
          <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
            <Icon className="h-4 w-4 text-gold" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}><a>{content}</a></Link>;
  }
  return content;
}

// ─── Ask Cairn — the question-first entry point ───────────────────────────────
// Type a strategic question, get it diagnosed, and follow the suggested next
// step — no sidebar spelunking needed for the core loop.

const NEXT_STEPS = [
  { href: "/research", label: "Research it", icon: Radar, desc: "Dispatch the specialist research mesh" },
  { href: "/frameworks", label: "Apply frameworks", icon: ListChecks, desc: "Run the diagnosis-selected frameworks" },
  { href: "/options", label: "Generate options", icon: Workflow, desc: "Generate and score strategic options" },
];

function AskCairn({ companyId }: { companyId: number }) {
  const [question, setQuestion] = useState("");
  const diagnoseMut = trpc.diagnosis.diagnose.useMutation({
    onError: (e) => toast.error(e.message),
  });
  const d = diagnoseMut.data;

  return (
    <Card className="card-glass border-gold/30">
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-gold" /> Ask Cairn
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder='Ask any strategic question — e.g. "Should we expand into the German mid-market?"'
          className="bg-secondary/50 border-border/60 min-h-[70px] font-body"
          rows={2}
        />
        <Button
          className="w-full gradient-gold text-background font-sans gap-2"
          disabled={!question.trim() || diagnoseMut.isPending}
          onClick={() => diagnoseMut.mutate({ companyId, question: question.trim() })}
        >
          <Stethoscope className="h-4 w-4" />
          {diagnoseMut.isPending ? "Diagnosing…" : "Diagnose the question"}
        </Button>

        {d && (
          <div className="space-y-3 pt-1">
            <div className="p-3 rounded-md bg-secondary/40 border border-border/40 space-y-1">
              <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                The real question
              </p>
              <p className="text-sm text-foreground font-body leading-relaxed">
                {d.reframedQuestion}
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Badge className="text-[10px] bg-gold/10 text-gold border-gold/20">
                  {d.questionType}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  confidence: {d.confidence}
                </Badge>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider mb-1.5">
                Next step
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {NEXT_STEPS.map((step) => {
                  const Icon = step.icon;
                  return (
                    <Link key={step.href} href={step.href}>
                      <a className="flex items-start gap-2.5 p-3 rounded-md bg-secondary/40 border border-border/40 hover:border-gold/30 transition-colors group">
                        <Icon className="h-4 w-4 text-gold shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-sm font-sans text-foreground group-hover:text-gold transition-colors">
                            {step.label}
                          </p>
                          <p className="text-[11px] text-muted-foreground font-body">{step.desc}</p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-gold transition-colors shrink-0 ml-auto mt-1" />
                      </a>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Overview({ activeCompanyId }: OverviewProps) {
  const { user } = useAuth();
  const { data: companies, isLoading: loadingCo } = trpc.company.list.useQuery();
  const { data: costSummary, isLoading: loadingCost } = trpc.cost.mySummary.useQuery();
  const { data: memories, isLoading: loadingMem } = trpc.memory.query.useQuery(
    { companyId: activeCompanyId!, limit: 5 },
    { enabled: !!activeCompanyId }
  );
  const { data: predictions, isLoading: loadingPred } = trpc.prediction.list.useQuery(
    { companyId: activeCompanyId! },
    { enabled: !!activeCompanyId }
  );

  const greeting =
    user?.name ? `Welcome back, ${user.name.split(" ")[0]}` : "Welcome back";

  return (
    <div className="p-6 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="font-heading text-2xl text-foreground">{greeting}</h2>
        <p className="text-muted-foreground font-body text-sm">
          {activeCompanyId
            ? `Viewing intelligence for ${companies?.find((c) => c.id === activeCompanyId)?.name ?? "selected company"}`
            : "Select a company from the sidebar to begin"}
        </p>
      </div>

      {/* Getting started — shown until the first company is onboarded */}
      {!loadingCo && (companies?.length ?? 0) === 0 && (
        <Card className="card-glass border-gold/30">
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-base flex items-center gap-2">
              <Rocket className="h-4 w-4 text-gold" /> Get started
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              {
                n: 1,
                label: "Onboard your first company",
                desc: "Create a portfolio company and seed its context.",
                href: "/onboarding",
              },
              {
                n: 2,
                label: "Ingest a document",
                desc: "Feed in a deck, report, or notes — the platform extracts what matters.",
                href: "/ingest",
              },
              {
                n: 3,
                label: "Run your first diagnosis",
                desc: "Put a real strategic question to the engine.",
                href: "/diagnose",
              },
            ].map((step) => (
              <Link key={step.n} href={step.href}>
                <a className="flex items-center gap-3 p-3 rounded-md bg-secondary/40 border border-border/40 hover:border-gold/30 transition-colors group">
                  <div className="w-7 h-7 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                    <span className="text-xs font-heading text-gold">{step.n}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-sans text-foreground group-hover:text-gold transition-colors">
                      {step.label}
                    </p>
                    <p className="text-xs text-muted-foreground font-body">{step.desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-gold transition-colors shrink-0" />
                </a>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Ask Cairn — question-first entry to the reasoning loop */}
      {activeCompanyId && <AskCairn companyId={activeCompanyId} />}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Companies"
          value={loadingCo ? "—" : (companies?.length ?? 0)}
          icon={Building2}
          href="/companies"
          loading={loadingCo}
        />
        <StatCard
          title="Memory Items"
          value={loadingMem ? "—" : (memories?.length ?? 0)}
          icon={Brain}
          sub={activeCompanyId ? "for active company" : "select a company"}
          href="/memory"
          loading={loadingMem}
        />
        <StatCard
          title="Predictions"
          value={loadingPred ? "—" : (predictions?.length ?? 0)}
          icon={TrendingUp}
          sub={activeCompanyId ? "in ledger" : "select a company"}
          href="/predictions"
          loading={loadingPred}
        />
        <StatCard
          title="My LLM Cost"
          value={loadingCost ? "—" : `$${(costSummary?.totalCost ?? 0).toFixed(4)}`}
          icon={DollarSign}
          sub={`${costSummary?.totalCalls ?? 0} calls`}
          href="/cost"
          loading={loadingCost}
        />
      </div>

      {/* Quick actions */}
      <Card className="card-glass">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold" /> Quick actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.href} href={action.href}>
                  <a className="flex items-center gap-2.5 p-3 rounded-md bg-secondary/40 border border-border/40 hover:border-gold/30 hover:bg-secondary/60 transition-colors group">
                    <Icon className="h-4 w-4 text-gold shrink-0" />
                    <span className="text-sm font-sans text-foreground group-hover:text-gold transition-colors">
                      {action.label}
                    </span>
                  </a>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent memory */}
        <Card className="card-glass">
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-base flex items-center gap-2">
              <Brain className="h-4 w-4 text-gold" />
              Recent Memory
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!activeCompanyId ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                <AlertCircle className="h-4 w-4" />
                <span className="font-sans">Select a company to view memory</span>
              </div>
            ) : loadingMem ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : memories?.length === 0 ? (
              <p className="text-muted-foreground text-sm font-sans py-4">
                No memory items yet. Start a session to build intelligence.
              </p>
            ) : (
              <div className="space-y-2">
                {memories?.slice(0, 5).map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-md bg-secondary/40 border border-border/40 space-y-1"
                  >
                    <p className="text-xs text-foreground font-sans line-clamp-2">
                      {m.canonicalForm}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {m.claimModality}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-sans">
                        conf: {((m.confidence ?? 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent predictions */}
        <Card className="card-glass">
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-gold" />
              Prediction Ledger
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!activeCompanyId ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                <AlertCircle className="h-4 w-4" />
                <span className="font-sans">Select a company to view predictions</span>
              </div>
            ) : loadingPred ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : predictions?.length === 0 ? (
              <p className="text-muted-foreground text-sm font-sans py-4">
                No predictions recorded yet.
              </p>
            ) : (
              <div className="space-y-2">
                {predictions?.slice(0, 5).map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-md bg-secondary/40 border border-border/40 space-y-1"
                  >
                    <p className="text-xs text-foreground font-sans line-clamp-2">
                      {p.claim}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] px-1.5 py-0 ${
                          p.outcomeId ? "bg-success/20 text-success" : ""
                        }`}
                      >
                        {p.outcomeId ? "closed" : "open"}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-sans">
                        conf: {((p.confidence ?? 0) * 100).toFixed(0)}%
                      </span>
                      {p.framework && (
                        <span className="text-[10px] text-gold/70 font-sans">
                          {p.framework}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* System status */}
      <Card className="card-glass">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-gold" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "LLM Router", status: "operational" },
              { label: "MCP Gateway", status: "operational" },
              { label: "Memory Store", status: "operational" },
              { label: "Audit Log", status: "operational" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-xs font-sans text-muted-foreground">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
