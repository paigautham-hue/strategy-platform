import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { PlatformLayout } from "./components/PlatformLayout";
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

// Pages
import Overview from "./pages/Overview";
import Companies from "./pages/Companies";
import Onboarding from "./pages/Onboarding";
import Projects from "./pages/Projects";
import Memory from "./pages/Memory";
import Ingest from "./pages/Ingest";
import StrategyArtifact from "./pages/StrategyArtifact";
import VoiceIntake from "./pages/VoiceIntake";
import Brainstorm from "./pages/Brainstorm";
import MemoDictation from "./pages/MemoDictation";
import Personas from "./pages/Personas";
import Decomposer from "./pages/Decomposer";
import PreMortem from "./pages/PreMortem";
import Drift from "./pages/Drift";
import Diagnosis from "./pages/Diagnosis";
import Research from "./pages/Research";
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
import CostDashboard from "./pages/CostDashboard";
import AuditLog from "./pages/AuditLog";
import UsageEvents from "./pages/UsageEvents";
import ExportPage from "./pages/ExportPage";
import McpTools from "./pages/McpTools";
import NotFound from "./pages/NotFound";

// ─── Login gate ───────────────────────────────────────────────────────────────

function LoginGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-xl gradient-gold flex items-center justify-center mx-auto animate-pulse">
            <FileText className="h-6 w-6 text-background" />
          </div>
          <p className="text-muted-foreground font-sans text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-8 max-w-sm px-6">
          <div className="space-y-3">
            <div className="w-16 h-16 rounded-2xl gradient-gold flex items-center justify-center mx-auto glow-gold">
              <FileText className="h-8 w-8 text-background" />
            </div>
            <h1 className="font-heading text-3xl text-gradient-gold">MERIDIAN</h1>
            <p className="text-muted-foreground font-body text-sm leading-relaxed">
              Private equity intelligence platform. Strategy compounds with every session.
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

function AppShell() {
  const [activeCompanyId, setActiveCompanyId] = useState<number | null>(null);

  return (
    <PlatformLayout
      activeCompanyId={activeCompanyId}
      onCompanySwitch={setActiveCompanyId}
    >
      <Switch>
        <Route path="/" component={() => <Overview activeCompanyId={activeCompanyId} />} />
        <Route path="/companies" component={() => <Companies onSelect={setActiveCompanyId} />} />
        <Route path="/onboarding" component={() => <Onboarding onSelect={setActiveCompanyId} />} />
        <Route path="/projects" component={() => <Projects activeCompanyId={activeCompanyId} />} />
        <Route path="/memory" component={() => <Memory activeCompanyId={activeCompanyId} />} />
        <Route path="/ingest" component={() => <Ingest activeCompanyId={activeCompanyId} />} />
        <Route path="/strategy-artifacts" component={() => <StrategyArtifact activeCompanyId={activeCompanyId} />} />
        <Route path="/voice-intake" component={() => <VoiceIntake activeCompanyId={activeCompanyId} />} />
        <Route path="/brainstorm" component={() => <Brainstorm activeCompanyId={activeCompanyId} />} />
        <Route path="/memo" component={() => <MemoDictation activeCompanyId={activeCompanyId} />} />
        <Route path="/personas" component={() => <Personas activeCompanyId={activeCompanyId} />} />
        <Route path="/diagnose" component={() => <Diagnosis activeCompanyId={activeCompanyId} />} />
        <Route path="/research" component={() => <Research activeCompanyId={activeCompanyId} />} />
        <Route path="/contradictions" component={() => <Contradictions activeCompanyId={activeCompanyId} />} />
        <Route path="/frameworks" component={() => <Frameworks activeCompanyId={activeCompanyId} />} />
        <Route path="/options" component={() => <Options activeCompanyId={activeCompanyId} />} />
        <Route path="/red-team" component={() => <RedTeam activeCompanyId={activeCompanyId} />} />
        <Route path="/war-game" component={() => <WarGame activeCompanyId={activeCompanyId} />} />
        <Route path="/cross-war-game" component={CrossCoWarGame} />
        <Route path="/decompose" component={() => <Decomposer activeCompanyId={activeCompanyId} />} />
        <Route path="/pre-mortem" component={() => <PreMortem activeCompanyId={activeCompanyId} />} />
        <Route path="/drift" component={() => <Drift activeCompanyId={activeCompanyId} />} />
        <Route path="/predictions" component={() => <Predictions activeCompanyId={activeCompanyId} />} />
        <Route path="/calibration" component={() => <Calibration activeCompanyId={activeCompanyId} />} />
        <Route path="/attribution" component={() => <Attribution activeCompanyId={activeCompanyId} />} />
        <Route path="/compliance" component={() => <Compliance activeCompanyId={activeCompanyId} />} />
        <Route path="/playbooks" component={() => <Playbooks activeCompanyId={activeCompanyId} />} />
        <Route path="/cost" component={CostDashboard} />
        <Route path="/audit" component={AuditLog} />
        <Route path="/usage" component={UsageEvents} />
        <Route path="/export" component={() => <ExportPage activeCompanyId={activeCompanyId} />} />
        <Route path="/mcp" component={() => <McpTools activeCompanyId={activeCompanyId} />} />
        <Route component={NotFound} />
      </Switch>
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
