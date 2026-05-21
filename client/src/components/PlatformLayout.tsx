import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
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

// ─── Navigation items ─────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: BarChart3 },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/onboarding", label: "Onboard Company", icon: Rocket },
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/memory", label: "Memory", icon: Brain },
  { href: "/ingest", label: "Ingest", icon: FileInput },
  { href: "/voice-intake", label: "Voice Intake", icon: Mic },
  { href: "/brainstorm", label: "Brainstorm", icon: Sparkles },
  { href: "/memo", label: "Memo Dictation", icon: FileText },
  { href: "/personas", label: "Advisory Personas", icon: Users },
  { href: "/strategy-artifacts", label: "Strategy Artifacts", icon: Telescope },
  { href: "/diagnose", label: "Diagnose", icon: Stethoscope },
  { href: "/research", label: "Research", icon: Radar },
  { href: "/contradictions", label: "Contradictions", icon: GitFork },
  { href: "/frameworks", label: "Frameworks", icon: Grid3x3 },
  { href: "/options", label: "Options", icon: ListChecks },
  { href: "/red-team", label: "Red Team", icon: Swords },
  { href: "/war-game", label: "War-Game", icon: Crosshair },
  { href: "/cross-war-game", label: "Cross-Co War-Game", icon: Network },
  { href: "/decompose", label: "Decompose", icon: Workflow },
  { href: "/pre-mortem", label: "Pre-Mortem", icon: ShieldAlert },
  { href: "/drift", label: "Drift Detection", icon: Gauge },
  { href: "/predictions", label: "Predictions", icon: TrendingUp },
  { href: "/calibration", label: "Calibration", icon: Scale },
  { href: "/attribution", label: "Attribution", icon: Microscope },
  { href: "/compliance", label: "Constitutional Audit", icon: ShieldCheck },
  { href: "/cost", label: "Cost Dashboard", icon: DollarSign },
  { href: "/audit", label: "Audit Log", icon: Shield },
  { href: "/usage", label: "Usage Events", icon: Activity },
  { href: "/export", label: "Export", icon: Download },
  { href: "/mcp", label: "MCP Tools", icon: Cpu },
];

const GP_ONLY_ITEMS = ["/export", "/cost", "/cross-war-game"];
const OPERATOR_ITEMS = ["/audit", "/usage", "/onboarding"];

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

  const canAccess = (href: string) => {
    if (!user) return false;
    if (GP_ONLY_ITEMS.includes(href) && user.role !== "gp" && user.role !== "admin") return false;
    if (OPERATOR_ITEMS.includes(href) && user.role === "portco_team") return false;
    return true;
  };

  const visibleItems = NAV_ITEMS.filter((item) => canAccess(item.href));

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
            <FileText className="h-4 w-4 text-background" />
          </div>
          <div>
            <h1 className="font-heading text-sm font-semibold text-gradient-gold leading-tight">
              MERIDIAN
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
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <a
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm mb-0.5 transition-colors duration-150",
                    isActive
                      ? "bg-gold/10 text-gold border border-gold/20"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", isActive && "text-gold")} />
                  <span className="font-sans">{item.label}</span>
                </a>
              </Link>
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
          <span className="font-heading text-sm text-gradient-gold">MERIDIAN</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
