import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { PlatformLayout } from "./components/PlatformLayout";
import { VoiceOverlay } from "./components/VoiceOverlay";
import { VoiceMiniPlayer } from "./components/VoiceMiniPlayer";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Layers } from "lucide-react";

// Pages
import Overview from "./pages/Overview";
import Companies from "./pages/Companies";
import Onboarding from "./pages/Onboarding";
import Projects from "./pages/Projects";
import Memory from "./pages/Memory";
import Ingest from "./pages/Ingest";
import Vision from "./pages/Vision";
import EntityGraph from "./pages/EntityGraph";
import StrategyArtifact from "./pages/StrategyArtifact";
import VoiceIntake from "./pages/VoiceIntake";
import Brainstorm from "./pages/Brainstorm";
import MemoDictation from "./pages/MemoDictation";
import Personas from "./pages/Personas";
import Diagrams from "./pages/Diagrams";
import Decomposer from "./pages/Decomposer";
import PreMortem from "./pages/PreMortem";
import Drift from "./pages/Drift";
import KpiLibrary from "./pages/KpiLibrary";
import Discovery from "./pages/Discovery";
import Simulation from "./pages/Simulation";
import StrategyManagement from "./pages/StrategyManagement";
import Diagnosis from "./pages/Diagnosis";
import Research from "./pages/Research";
import LiveResearch from "./pages/LiveResearch";
import Contradictions from "./pages/Contradictions";
import Frameworks from "./pages/Frameworks";
import Options from "./pages/Options";
import RedTeam from "./pages/RedTeam";
import WarGame from "./pages/WarGame";
import CrossCoWarGame from "./pages/CrossCoWarGame";
import Predictions from "./pages/Predictions";
import Calibration from "./pages/Calibration";
import Attribution from "./pages/Attribution";
import Compliance from "./pages/Compliance";
import Playbooks from "./pages/Playbooks";
import PatternMining from "./pages/PatternMining";
import SynergyScout from "./pages/SynergyScout";
import Portfolio from "./pages/Portfolio";
import Distillation from "./pages/Distillation";
import Briefing from "./pages/Briefing";
import CostDashboard from "./pages/CostDashboard";
import AuditLog from "./pages/AuditLog";
import UsageEvents from "./pages/UsageEvents";
import ExportPage from "./pages/ExportPage";
import McpTools from "./pages/McpTools";
import Connectors from "./pages/Connectors";
import Users from "./pages/Users";
import Manual from "./pages/Manual";
import HistoryPage from "./pages/HistoryPage";
import NotFound from "./pages/NotFound";

// ─── Login gate ───────────────────────────────────────────────────────────────

function LoginGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-xl gradient-gold flex items-center justify-center mx-auto animate-pulse">
            <Layers className="h-6 w-6 text-background" />
          </div>
          <p className="text-muted-foreground font-sans text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
        {/* Ambient depth — a soft gold glow + faint grid behind the mark. */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 60% 50% at 50% 38%, rgba(212,175,55,0.12), transparent 70%)",
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent 75%)",
          }}
        />
        <div className="text-center space-y-8 max-w-sm px-6 relative">
          <div className="space-y-3">
            <div className="w-16 h-16 rounded-2xl gradient-gold flex items-center justify-center mx-auto glow-gold">
              <Layers className="h-8 w-8 text-background" />
            </div>
            <h1 className="font-heading text-3xl text-gradient-gold">CAIRN</h1>
            <p className="text-muted-foreground font-body text-sm leading-relaxed">
              Private strategy intelligence. Built stone by stone — every session compounds.
            </p>
          </div>
          <a href={getLoginUrl()}>
            <Button className="w-full gradient-gold text-background font-sans font-medium h-11">
              Sign in to continue
            </Button>
          </a>
          <p className="text-[11px] text-muted-foreground font-sans">
            Access restricted to authorized personnel only.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// ─── App shell ────────────────────────────────────────────────────────────────

// The active company survives a page refresh — without this, every reload
// drops the selection and re-blocks nearly every page behind "Select a company".
const ACTIVE_COMPANY_KEY = "cairn-active-company-id";

function loadActiveCompanyId(): number | null {
  try {
    const raw = localStorage.getItem(ACTIVE_COMPANY_KEY);
    const parsed = raw === null ? NaN : Number(raw);
    return Number.isInteger(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function AppShell() {
  const [activeCompanyId, setActiveCompanyIdState] = useState<number | null>(loadActiveCompanyId);

  const setActiveCompanyId = (id: number | null) => {
    setActiveCompanyIdState(id);
    try {
      if (id === null) localStorage.removeItem(ACTIVE_COMPANY_KEY);
      else localStorage.setItem(ACTIVE_COMPANY_KEY, String(id));
    } catch {
      // Storage unavailable (private mode) — selection is session-only.
    }
  };

  // Clear a restored selection that no longer exists (company deleted, or the
  // stored id belongs to a company this user can't see).
  const { data: companies } = trpc.company.list.useQuery();
  useEffect(() => {
    if (!companies || activeCompanyId === null) return;
    if (!companies.some((c) => c.id === activeCompanyId)) setActiveCompanyId(null);
  }, [companies, activeCompanyId]);

  return (
    <PlatformLayout
      activeCompanyId={activeCompanyId}
      onCompanySwitch={setActiveCompanyId}
    >
      <Switch>
        <Route path="/" component={() => <Overview activeCompanyId={activeCompanyId} />} />
        <Route path="/history" component={() => <HistoryPage activeCompanyId={activeCompanyId} />} />
        <Route path="/companies" component={() => <Companies onSelect={setActiveCompanyId} />} />
        <Route path="/onboarding" component={() => <Onboarding onSelect={setActiveCompanyId} />} />
        <Route path="/projects" component={() => <Projects activeCompanyId={activeCompanyId} />} />
        <Route path="/memory" component={() => <Memory activeCompanyId={activeCompanyId} />} />
        <Route path="/connections" component={() => <EntityGraph activeCompanyId={activeCompanyId} />} />
        <Route path="/ingest" component={() => <Ingest activeCompanyId={activeCompanyId} />} />
        <Route path="/vision" component={() => <Vision activeCompanyId={activeCompanyId} />} />
        <Route path="/strategy-artifacts" component={() => <StrategyArtifact activeCompanyId={activeCompanyId} />} />
        <Route path="/voice-intake" component={() => <VoiceIntake activeCompanyId={activeCompanyId} />} />
        <Route path="/brainstorm" component={() => <Brainstorm activeCompanyId={activeCompanyId} />} />
        <Route path="/memo" component={() => <MemoDictation activeCompanyId={activeCompanyId} />} />
        <Route path="/personas" component={() => <Personas activeCompanyId={activeCompanyId} />} />
        <Route path="/diagrams" component={() => <Diagrams activeCompanyId={activeCompanyId} />} />
        <Route path="/diagnose" component={() => <Diagnosis activeCompanyId={activeCompanyId} />} />
        <Route path="/research" component={() => <Research activeCompanyId={activeCompanyId} />} />
        <Route path="/live-research" component={() => <LiveResearch activeCompanyId={activeCompanyId} />} />
        <Route path="/contradictions" component={() => <Contradictions activeCompanyId={activeCompanyId} />} />
        <Route path="/frameworks" component={() => <Frameworks activeCompanyId={activeCompanyId} />} />
        <Route path="/options" component={() => <Options activeCompanyId={activeCompanyId} />} />
        <Route path="/red-team" component={() => <RedTeam activeCompanyId={activeCompanyId} />} />
        <Route path="/war-game" component={() => <WarGame activeCompanyId={activeCompanyId} />} />
        <Route path="/cross-war-game" component={CrossCoWarGame} />
        <Route path="/decompose" component={() => <Decomposer activeCompanyId={activeCompanyId} />} />
        <Route path="/pre-mortem" component={() => <PreMortem activeCompanyId={activeCompanyId} />} />
        <Route path="/drift" component={() => <Drift activeCompanyId={activeCompanyId} />} />
        <Route path="/kpi-library" component={KpiLibrary} />
        <Route path="/discovery" component={() => <Discovery activeCompanyId={activeCompanyId} />} />
        <Route path="/simulation" component={Simulation} />
        <Route path="/strategy-management" component={() => <StrategyManagement activeCompanyId={activeCompanyId} />} />
        <Route path="/predictions" component={() => <Predictions activeCompanyId={activeCompanyId} />} />
        <Route path="/calibration" component={() => <Calibration activeCompanyId={activeCompanyId} />} />
        <Route path="/attribution" component={() => <Attribution activeCompanyId={activeCompanyId} />} />
        <Route path="/compliance" component={() => <Compliance activeCompanyId={activeCompanyId} />} />
        <Route path="/playbooks" component={() => <Playbooks activeCompanyId={activeCompanyId} />} />
        <Route path="/patterns" component={() => <PatternMining activeCompanyId={activeCompanyId} />} />
        <Route path="/synergy" component={SynergyScout} />
        <Route path="/portfolio" component={() => <Portfolio activeCompanyId={activeCompanyId} onCompanySwitch={setActiveCompanyId} />} />
        <Route path="/distillation" component={Distillation} />
        <Route path="/briefing" component={() => <Briefing activeCompanyId={activeCompanyId} />} />
        <Route path="/cost" component={CostDashboard} />
        <Route path="/audit" component={AuditLog} />
        <Route path="/usage" component={UsageEvents} />
        <Route path="/export" component={() => <ExportPage activeCompanyId={activeCompanyId} />} />
        <Route path="/mcp" component={() => <McpTools activeCompanyId={activeCompanyId} />} />
        <Route path="/connectors" component={() => <Connectors activeCompanyId={activeCompanyId} />} />
        <Route path="/users" component={Users} />
        <Route path="/manual" component={Manual} />
        <Route component={NotFound} />
      </Switch>
      {/* Realtime voice surfaces — decoupled from any single page (C14). */}
      <VoiceOverlay />
      <VoiceMiniPlayer />
    </PlatformLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <LoginGate>
            <AppShell />
          </LoginGate>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
