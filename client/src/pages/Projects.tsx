import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderOpen, Plus, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

interface ProjectsProps {
  activeCompanyId: number | null;
}

export default function Projects({ activeCompanyId }: ProjectsProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

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
            <Card key={p.id} className="card-glass hover:border-gold/30 transition-colors">
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
    </div>
  );
}
