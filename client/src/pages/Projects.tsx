import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  FolderOpen,
  Plus,
  AlertCircle,
  Stethoscope,
  Workflow,
  ClipboardList,
  History as HistoryIcon,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

interface ProjectSummary {
  id: number;
  name: string;
  description: string | null;
  createdAt: string | Date;
}

const PROJECT_ACTIONS = [
  { href: "/diagnose", label: "Diagnose a question", icon: Stethoscope, desc: "Start the reasoning loop for this project's question" },
  { href: "/decompose", label: "Decompose a strategy", icon: Workflow, desc: "Turn the thesis into initiatives, OKRs, and tasks" },
  { href: "/strategy-management", label: "Strategic Tracker", icon: ClipboardList, desc: "Track KPIs, milestones, and risks" },
  { href: "/history", label: "Analysis History", icon: HistoryIcon, desc: "Revisit and export saved runs" },
];

/** Detail dialog shown when a project card is clicked. */
function ProjectDetail({
  project,
  companyId,
  onClose,
}: {
  project: ProjectSummary;
  companyId: number;
  onClose: () => void;
}) {
  const { data: sessions, isLoading } = trpc.session.list.useQuery({
    companyId,
    projectId: project.id,
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border/60 max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-gold" /> {project.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          {project.description && (
            <p className="text-sm text-muted-foreground font-body leading-relaxed">
              {project.description}
            </p>
          )}
          <p className="text-xs text-muted-foreground font-sans">
            Created {new Date(project.createdAt).toLocaleDateString()}
          </p>

          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare className="h-3 w-3" /> Sessions
            </p>
            {isLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : !sessions || sessions.length === 0 ? (
              <p className="text-xs text-muted-foreground font-sans">
                No sessions yet — run an analysis below to get started.
              </p>
            ) : (
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 rounded border border-border/40 bg-secondary/30 px-2.5 py-1.5"
                  >
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                      {s.endedAt ? "ended" : "open"}
                    </Badge>
                    <span className="text-xs text-foreground font-sans truncate flex-1">
                      {s.title ?? `Session ${s.id}`}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-sans shrink-0">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
              Work on this project
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PROJECT_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <Link key={action.href} href={action.href}>
                    <a
                      title={action.desc}
                      className="flex items-center gap-2.5 p-2.5 rounded-md bg-secondary/40 border border-border/40 hover:border-gold/30 transition-colors group"
                    >
                      <Icon className="h-4 w-4 text-gold shrink-0" />
                      <span className="text-xs font-sans text-foreground group-hover:text-gold transition-colors flex-1">
                        {action.label}
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:text-gold shrink-0" />
                    </a>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ProjectsProps {
  activeCompanyId: number | null;
}

export default function Projects({ activeCompanyId }: ProjectsProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<ProjectSummary | null>(null);

  const { data: projects, isLoading, refetch } = trpc.project.list.useQuery(
    { companyId: activeCompanyId! },
    { enabled: !!activeCompanyId }
  );

  const createMut = trpc.project.create.useMutation({
    onSuccess: () => {
      toast.success("Project created");
      setOpen(false);
      setName("");
      setDescription("");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const canCreate = user?.role !== "portco_team";

  if (!activeCompanyId) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span className="font-sans text-sm">Select a company from the sidebar to view projects.</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl text-foreground">Strategy Projects</h2>
          <p className="text-muted-foreground font-sans text-sm mt-1">
            {projects?.length ?? 0} projects
          </p>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gradient-gold text-background font-sans gap-2">
                <Plus className="h-4 w-4" /> New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border/60">
              <DialogHeader>
                <DialogTitle className="font-heading">New Strategy Project</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                    Project Name *
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Q4 Market Entry Analysis"
                    className="bg-secondary/50 border-border/60"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                    Description
                  </label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description..."
                    className="bg-secondary/50 border-border/60"
                  />
                </div>
                <Button
                  className="w-full gradient-gold text-background font-sans"
                  disabled={!name.trim() || createMut.isPending}
                  onClick={() =>
                    createMut.mutate({
                      companyId: activeCompanyId,
                      name: name.trim(),
                      description: description.trim() || undefined,
                    })
                  }
                >
                  {createMut.isPending ? "Creating..." : "Create Project"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : projects?.length === 0 ? (
        <Card className="card-glass">
          <CardContent className="py-16 text-center">
            <FolderOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-body">No projects yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {projects?.map((p) => (
            <Card
              key={p.id}
              className="card-glass hover:border-gold/30 transition-colors cursor-pointer"
              onClick={() => setSelected(p)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                  <FolderOpen className="h-4 w-4 text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-heading text-sm text-foreground truncate">{p.name}</p>
                  {p.description && (
                    <p className="text-xs text-muted-foreground font-sans line-clamp-1 mt-0.5">
                      {p.description}
                    </p>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground font-sans shrink-0">
                  {new Date(p.createdAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <ProjectDetail
          project={selected}
          companyId={activeCompanyId}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
