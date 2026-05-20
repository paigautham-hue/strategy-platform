import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Plus, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

interface CompaniesProps {
  onSelect: (id: number) => void;
}

export default function Companies({ onSelect }: CompaniesProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");

  const { data: companies, isLoading, refetch } = trpc.company.list.useQuery();
  const createMut = trpc.company.create.useMutation({
    onSuccess: () => {
      toast.success("Company created");
      setOpen(false);
      setName("");
      setIndustry("");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const canCreate = user?.role === "gp" || user?.role === "admin" || user?.role === "operator";

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl text-foreground">Portfolio Companies</h2>
          <p className="text-muted-foreground font-sans text-sm mt-1">
            {companies?.length ?? 0} companies in portfolio
          </p>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gradient-gold text-background font-sans gap-2">
                <Plus className="h-4 w-4" /> Add Company
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border/60">
              <DialogHeader>
                <DialogTitle className="font-heading">New Portfolio Company</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                    Company Name *
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Acme Corp"
                    className="bg-secondary/50 border-border/60"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                    Industry
                  </label>
                  <Input
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="SaaS, Healthcare, FinTech..."
                    className="bg-secondary/50 border-border/60"
                  />
                </div>
                <Button
                  className="w-full gradient-gold text-background font-sans"
                  disabled={!name.trim() || createMut.isPending}
                  onClick={() => createMut.mutate({ name: name.trim(), industry: industry.trim() || undefined })}
                >
                  {createMut.isPending ? "Creating..." : "Create Company"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : companies?.length === 0 ? (
        <Card className="card-glass">
          <CardContent className="py-16 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-body">No companies yet.</p>
            {canCreate && (
              <p className="text-muted-foreground font-sans text-sm mt-1">
                Add your first portfolio company to get started.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies?.map((c) => (
            <Card
              key={c.id}
              className="card-glass hover:border-gold/30 transition-all cursor-pointer group"
              onClick={() => onSelect(c.id)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                        <Building2 className="h-4 w-4 text-gold" />
                      </div>
                      <h3 className="font-heading text-sm text-foreground truncate group-hover:text-gold transition-colors">
                        {c.name}
                      </h3>
                    </div>
                    {c.industry && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {c.industry}
                      </Badge>
                    )}
                    {c.description && (
                      <p className="text-xs text-muted-foreground font-sans line-clamp-2 mt-1">
                        {c.description}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-gold transition-colors shrink-0 ml-2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
