import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useVoiceCall } from "@/contexts/VoiceCallContext";
import { getLoginUrl } from "@/const";
import {
  Building2,
  FolderOpen,
  Brain,
  TrendingUp,
  DollarSign,
  Shield,
  Activity,
  Download,
  ChevronDown,
  LogOut,
  User,
  Menu,
  X,
  Cpu,
  BarChart3,
  FileText,
  FileInput,
  Telescope,
  Rocket,
  Mic,
  Stethoscope,
  Radar,
  GitFork,
  Grid3x3,
  ListChecks,
  Swords,
  Crosshair,
  Network,
  Sparkles,
  Users,
  Workflow,
  ShieldAlert,
  Gauge,
  Scale,
  Microscope,
  ShieldCheck,
  BookOpen,
  Boxes,
  Combine,
  FlaskConical,
  Newspaper,
  UserCog,
  BookText,
  Layers,
  Calculator,
  Plug,
  PieChart,
  Share2,
  Compass,
  Dices,
  ClipboardList,
  Eye,
  LayoutDashboard,
  RadioTower,
  Radio,
  History as HistoryIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ─── Company Switcher ─────────────────────────────────────────────────────────

interface CompanySwitcherProps {
  activeCompanyId: number | null;
  onSwitch: (id: number) => void;
}

function CompanySwitcher({ activeCompanyId, onSwitch }: CompanySwitcherProps) {
  const { data: companies, isLoading } = trpc.company.list.useQuery();

  const active = companies?.find((c) => c.id === activeCompanyId);

  if (isLoading) return <Skeleton className="h-8 w-40" />;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-2 border-border/60 bg-secondary/50 text-sm font-sans hover:bg-secondary"
        >
          <Building2 className="h-3.5 w-3.5 text-gold" />
          <span className="max-w-[120px] truncate">
            {active?.name ?? "Select Company"}
          </span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {companies?.length === 0 && (
          <DropdownMenuItem disabled className="text-muted-foreground text-xs">
            No companies yet
          </DropdownMenuItem>
        )}
        {companies?.map((c) => (
          <DropdownMenuItem
            key={c.id}
            onClick={() => onSwitch(c.id)}
            className={cn(
              "gap-2",
              c.id === activeCompanyId && "bg-accent text-gold"
            )}
          >
            <Building2 className="h-3.5 w-3.5" />
            <span className="truncate">{c.name}</span>
            {c.id === activeCompanyId && (
              <Badge variant="secondary" className="ml-auto text-[10px] px-1 py-0">
                active
              </Badge>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Voice launch ─────────────────────────────────────────────────────────────
// Starts (or re-opens) a realtime voice call grounded in the active company.
// The call itself lives in VoiceCallProvider (C14), so this button only kicks
// it off — navigating away keeps it alive via the mini-player.

function VoiceLaunchButton({ activeCompanyId }: { activeCompanyId: number | null }) {
  const { data: companies } = trpc.company.list.useQuery();
  const { isCallActive, startCall, openOverlay } = useVoiceCall();
  const active = companies?.find((c) => c.id === activeCompanyId);

  const onClick = () => {
    if (isCallActive) {
      openOverlay();
      return;
    }
    if (activeCompanyId == null || !active) return;
    void startCall(activeCompanyId, active.name);
  };

  return (
    <Button
      size="sm"
      onClick={onClick}
      disabled={!isCallActive && activeCompanyId == null}
      className="w-full mt-2 gap-2 gradient-gold text-background font-sans h-8"
    >
      <Radio className="h-3.5 w-3.5" />
      {isCallActive ? "Open voice call" : "Talk to Cairn"}
    </Button>
  );
}

// ─── Navigation groups ────────────────────────────────────────────────────────
// Grouped by what the user is trying to DO (ask, simulate, execute, …), not by
// the platform's internal architecture. Groups are collapsible; only the group
// containing the current page starts open, so ~45 destinations stay scannable.

interface NavItem {
  href: string;
  label: string;
  icon: typeof BarChart3;
  /** One-line plain-language explanation, shown as a hover tooltip. */
  desc: string;
}

const NAV_GROUPS: { label: string | null; items: NavItem[] }[] = [
  {
    label: null,
    items: [
      { href: "/", label: "Overview", icon: BarChart3, desc: "Dashboard for the active company — ask a question, see health at a glance" },
      { href: "/history", label: "History", icon: HistoryIcon, desc: "Every saved analysis run — revisit, filter, and export as a document" },
    ],
  },
  {
    label: "Companies & Knowledge",
    items: [
      { href: "/companies", label: "Companies", icon: Building2, desc: "List and create your portfolio companies" },
      { href: "/onboarding", label: "Onboard Company", icon: Rocket, desc: "Wizard: create a company and seed its initial context" },
      { href: "/projects", label: "Projects", icon: FolderOpen, desc: "Strategy projects within the active company" },
      { href: "/memory", label: "Memory", icon: Brain, desc: "Everything the platform knows about this company — searchable, with confidence and history" },
      { href: "/connections", label: "Connections", icon: Share2, desc: "The entity graph — how people, products, and markets link together" },
      { href: "/ingest", label: "Ingest", icon: FileInput, desc: "Feed in documents, decks, or URLs — key facts are extracted into memory" },
      { href: "/vision", label: "Vision Studio", icon: Eye, desc: "Extract text from slides/whiteboards, or generate images from a prompt" },
    ],
  },
  {
    label: "Ask & Analyze",
    items: [
      { href: "/diagnose", label: "Diagnose", icon: Stethoscope, desc: "Start here — is this the right question? Reframes and classifies it first" },
      { href: "/research", label: "Research", icon: Radar, desc: "Specialist research agents investigate a diagnosed question in parallel" },
      { href: "/live-research", label: "Live Research", icon: RadioTower, desc: "The same research mesh, streamed live as each specialist reports" },
      { href: "/frameworks", label: "Frameworks", icon: Grid3x3, desc: "Porter, JTBD, Ansoff & more — auto-selected to fit the question type" },
      { href: "/options", label: "Options", icon: ListChecks, desc: "Generate strategic options and score them on 8 weighted criteria" },
      { href: "/red-team", label: "Red Team", icon: Swords, desc: "Five hostile personas attack your strategy before the market does" },
      { href: "/contradictions", label: "Contradictions", icon: GitFork, desc: "Where the company's own facts and claims conflict with each other" },
      { href: "/diagrams", label: "Diagrams", icon: PieChart, desc: "Generate Porter / SWOT / Three-Horizons visuals from company memory" },
      { href: "/brainstorm", label: "Brainstorm", icon: Sparkles, desc: "A guided 4-phase brainstorm — ideas are captured silently as you talk" },
      { href: "/memo", label: "Memo Dictation", icon: FileText, desc: "Dictate a monologue; get back a structured 1-page memo" },
      { href: "/voice-intake", label: "Voice Intake", icon: Mic, desc: "Speak a strategic question — it becomes a project draft" },
      { href: "/discovery", label: "Discovery (Digital Twin)", icon: Compass, desc: "A structured interview that builds a working model of the business" },
      { href: "/personas", label: "Advisory Personas", icon: Users, desc: "Ask a question to a virtual board — investor, operator, customer views" },
      { href: "/strategy-artifacts", label: "Strategy Artifacts", icon: Telescope, desc: "Import an external strategy document and apply it to a company" },
    ],
  },
  {
    label: "Simulate & Stress-Test",
    items: [
      { href: "/war-game", label: "War-Game", icon: Crosshair, desc: "Play your strategy against customers, competitors, regulators & investors over multiple rounds" },
      { href: "/cross-war-game", label: "Cross-Co War-Game", icon: Network, desc: "One scenario played across several portfolio companies at once (GP only)" },
      { href: "/simulation", label: "Financial Simulation", icon: Dices, desc: "Monte Carlo NPV/IRR — 10,000 paths, risk metrics, best/base/worst" },
      { href: "/pre-mortem", label: "Pre-Mortem", icon: ShieldAlert, desc: "Assume the initiative failed — work backwards to what killed it" },
    ],
  },
  {
    label: "Execute & Learn",
    items: [
      { href: "/decompose", label: "Decompose", icon: Workflow, desc: "Turn a strategy thesis into initiatives → OKRs → tasks" },
      { href: "/strategy-management", label: "Strategic Tracker", icon: ClipboardList, desc: "Track the KPIs, milestones, and risks of a strategy in flight" },
      { href: "/drift", label: "Drift Detection", icon: Gauge, desc: "Is execution drifting from the strategy? Detect it and propose a replan" },
      { href: "/kpi-library", label: "KPI Library", icon: Calculator, desc: "15 standard KPIs with definitions and formulas" },
      { href: "/predictions", label: "Predictions", icon: TrendingUp, desc: "The ledger of every claim the platform made — record and resolve outcomes" },
      { href: "/calibration", label: "Calibration", icon: Scale, desc: "How accurate has the platform been? Honest scoring of past predictions" },
      { href: "/attribution", label: "Attribution", icon: Microscope, desc: "What actually caused an outcome — causal analysis with confounders" },
      { href: "/playbooks", label: "Playbooks", icon: BookOpen, desc: "Winning moves promoted into reusable playbooks — only after outcomes prove them" },
      { href: "/patterns", label: "Pattern Mining", icon: Boxes, desc: "Recurring patterns mined from past projects" },
      { href: "/compliance", label: "Constitutional Audit", icon: ShieldCheck, desc: "Anti-hallucination audit — checks claims against their sources" },
    ],
  },
  {
    label: "Portfolio & Operations",
    items: [
      { href: "/portfolio", label: "Portfolio Dashboard", icon: LayoutDashboard, desc: "Cross-company health, calibration, and open predictions (GP only)" },
      { href: "/briefing", label: "Briefing", icon: Newspaper, desc: "A daily or weekly 1-page briefing built from recent signals" },
      { href: "/synergy", label: "Synergy Scout", icon: Combine, desc: "Scan the portfolio for synergies across 9 axes (GP only)" },
      { href: "/distillation", label: "Pattern Distillation", icon: FlaskConical, desc: "Anonymized cross-company patterns — only when 3+ companies show them (GP only)" },
      { href: "/cost", label: "Cost Dashboard", icon: DollarSign, desc: "AI spend per user, per model, per day" },
      { href: "/audit", label: "Audit Log", icon: Shield, desc: "Who read what, when — every confidential access is recorded" },
      { href: "/usage", label: "Usage Events", icon: Activity, desc: "Which features are actually being used" },
      { href: "/export", label: "Export", icon: Download, desc: "Encrypted per-company data export (GP only)" },
      { href: "/connectors", label: "Connectors", icon: Plug, desc: "Connect execution tools — Linear live; Notion/Jira coming" },
      { href: "/mcp", label: "MCP Tools", icon: Cpu, desc: "The platform's research tools — web search, SEC filings, memory lookup" },
      { href: "/manual", label: "User Manual", icon: BookText, desc: "The full guide to every feature, plus FAQ" },
      { href: "/users", label: "User Management", icon: UserCog, desc: "Manage users and roles (admin only)" },
    ],
  },
];

const GP_ONLY_ITEMS = ["/export", "/cost", "/cross-war-game", "/synergy", "/distillation", "/portfolio"];
const OPERATOR_ITEMS = ["/audit", "/usage", "/onboarding", "/connectors", "/strategy-management"];
const ADMIN_ONLY_ITEMS = ["/users"];

// ─── PlatformLayout ───────────────────────────────────────────────────────────

interface PlatformLayoutProps {
  children: React.ReactNode;
  activeCompanyId: number | null;
  onCompanySwitch: (id: number) => void;
}

export function PlatformLayout({
  children,
  activeCompanyId,
  onCompanySwitch,
}: PlatformLayoutProps) {
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Collapsible nav groups: closed by default, except the group holding the
  // current page. A manual toggle overrides until the next toggle.
  const [toggledGroups, setToggledGroups] = useState<Record<string, boolean>>({});
  const isGroupOpen = (group: { label: string | null; items: NavItem[] }) => {
    if (group.label === null) return true;
    return (
      toggledGroups[group.label] ?? group.items.some((item) => item.href === location)
    );
  };
  const toggleGroup = (group: { label: string | null; items: NavItem[] }) => {
    if (group.label === null) return;
    setToggledGroups((prev) => ({ ...prev, [group.label as string]: !isGroupOpen(group) }));
  };

  const canAccess = (href: string) => {
    if (!user) return false;
    if (ADMIN_ONLY_ITEMS.includes(href) && user.role !== "admin") return false;
    if (GP_ONLY_ITEMS.includes(href) && user.role !== "gp" && user.role !== "admin") return false;
    if (OPERATOR_ITEMS.includes(href) && user.role === "portco_team") return false;
    return true;
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* ── Sidebar ── */}
      <aside
        className={cn(
          "flex flex-col w-60 border-r border-border/60 bg-card shrink-0 transition-transform duration-200",
          "fixed inset-y-0 left-0 z-40 lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-border/60">
          <div className="w-8 h-8 rounded gradient-gold flex items-center justify-center shrink-0">
            <Layers className="h-4 w-4 text-background" />
          </div>
          <div>
            <h1 className="font-heading text-sm font-semibold text-gradient-gold leading-tight">
              CAIRN
            </h1>
            <p className="text-[10px] text-muted-foreground font-sans tracking-widest uppercase">
              Strategy Platform
            </p>
          </div>
        </div>

        {/* Company switcher */}
        <div className="px-3 py-3 border-b border-border/60">
          <CompanySwitcher
            activeCompanyId={activeCompanyId}
            onSwitch={onCompanySwitch}
          />
          <VoiceLaunchButton activeCompanyId={activeCompanyId} />
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {NAV_GROUPS.map((group, gi) => {
            const items = group.items.filter((item) => canAccess(item.href));
            if (items.length === 0) return null;
            const open = isGroupOpen(group);
            return (
              <div key={gi} className={cn(gi > 0 && "mt-3")}>
                {group.label && (
                  <button
                    onClick={() => toggleGroup(group)}
                    className="w-full flex items-center justify-between px-3 pb-1 pt-1 text-[10px] font-sans font-medium uppercase tracking-wider text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  >
                    <span>{group.label}</span>
                    <ChevronDown
                      className={cn("h-3 w-3 transition-transform", !open && "-rotate-90")}
                    />
                  </button>
                )}
                {open && items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.href;
                  return (
                    <Link key={item.href} href={item.href}>
                      <a
                        title={item.desc}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-1.5 rounded-md text-sm mb-0.5 transition-colors duration-150 relative",
                          isActive
                            ? "bg-gold/10 text-gold"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-r bg-gold" />
                        )}
                        <Icon className={cn("h-4 w-4 shrink-0", isActive && "text-gold")} />
                        <span className="font-sans">{item.label}</span>
                      </a>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-border/60 p-3">
          {isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 w-full px-2 py-2 rounded-md hover:bg-accent transition-colors text-left">
                  <div className="w-7 h-7 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center shrink-0">
                    <User className="h-3.5 w-3.5 text-gold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate text-foreground">
                      {user.name ?? user.email ?? "User"}
                    </p>
                    <p className="text-[10px] text-muted-foreground capitalize">
                      {user.role}
                    </p>
                  </div>
                  <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-48">
                <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                  {user.email}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => logout()}
                  className="text-destructive gap-2"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <a href={getLoginUrl()}>
              <Button size="sm" className="w-full gradient-gold text-background font-sans">
                Sign in
              </Button>
            </a>
          )}
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border/60 lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded hover:bg-accent"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-heading text-sm text-gradient-gold">CAIRN</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
