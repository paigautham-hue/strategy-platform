import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users as UsersIcon, Building2, ShieldAlert, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Role = "gp" | "operator" | "portco_team" | "admin";

const ROLES: { value: Role; label: string; blurb: string }[] = [
  { value: "admin", label: "Admin", blurb: "Platform + user management; sees everything." },
  { value: "gp", label: "GP", blurb: "Strategy lead; sees every company." },
  { value: "operator", label: "Operator", blurb: "Runs companies; scoped to assigned companies." },
  { value: "portco_team", label: "Portco Team", blurb: "Portfolio-company staff; scoped to their company." },
];

const ROLE_STYLE: Record<Role, string> = {
  admin: "bg-gold/10 text-gold border-gold/20",
  gp: "bg-gold/10 text-gold border-gold/20",
  operator: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  portco_team: "bg-secondary text-muted-foreground border-border/40",
};

export default function Users() {
  const utils = trpc.useUtils();
  const { data: users, isLoading } = trpc.user.list.useQuery();
  const { data: companies } = trpc.company.list.useQuery();

  const roleMut = trpc.user.updateRole.useMutation({
    onSuccess: () => {
      toast.success("Role updated");
      utils.user.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const companiesMut = trpc.user.assignCompanies.useMutation({
    onSuccess: () => {
      toast.success("Company access updated");
      utils.user.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const busy = roleMut.isPending || companiesMut.isPending;

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-3xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl text-foreground flex items-center gap-2">
          <UsersIcon className="h-5 w-5 text-gold" /> User Management
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          Manage who has access, their role, and — for operators and portfolio
          teams — which companies they can see.
        </p>
        <p className="text-[11px] text-muted-foreground font-sans mt-2 flex items-center gap-1.5">
          <ShieldAlert className="h-3 w-3 text-gold" />
          Admin-only. Users appear here automatically the first time they sign in.
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground font-sans">Loading users…</p>}

      {users && users.length === 0 && (
        <Card className="card-glass">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground font-body">
              No users yet. They are created on first sign-in.
            </p>
          </CardContent>
        </Card>
      )}

      {users?.map((u) => {
        const role = u.role as Role;
        const assigned: number[] = Array.isArray(u.assignedCompanyIds)
          ? (u.assignedCompanyIds as number[])
          : [];
        const scoped = role === "operator" || role === "portco_team";

        const toggleCompany = (companyId: number) => {
          const next = assigned.includes(companyId)
            ? assigned.filter((id) => id !== companyId)
            : [...assigned, companyId];
          companiesMut.mutate({ userId: u.id, companyIds: next });
        };

        return (
          <Card key={u.id} className="card-glass">
            <CardHeader>
              <CardTitle className="font-heading text-base flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center shrink-0">
                  <UserIcon className="h-3.5 w-3.5 text-gold" />
                </div>
                <span className="truncate">{u.name ?? u.email ?? `User ${u.id}`}</span>
                <Badge className={cn("text-[10px] ml-auto capitalize", ROLE_STYLE[role])}>
                  {role.replace("_", " ")}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {u.email && (
                <p className="text-xs text-muted-foreground font-body -mt-2">{u.email}</p>
              )}

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                  Role
                </label>
                <Select
                  value={role}
                  onValueChange={(v) => roleMut.mutate({ userId: u.id, role: v as Role })}
                  disabled={busy}
                >
                  <SelectTrigger className="bg-secondary/50 border-border/60 text-sm max-w-[260px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label} — <span className="text-muted-foreground">{r.blurb}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-sans uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="h-3 w-3" /> Company access
                </label>
                {!scoped ? (
                  <p className="text-xs text-muted-foreground font-body">
                    {role === "admin" ? "Admins" : "GPs"} see every company — no scoping needed.
                  </p>
                ) : companies && companies.length > 0 ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {companies.map((c) => {
                        const on = assigned.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            disabled={busy}
                            onClick={() => toggleCompany(c.id)}
                            className={cn(
                              "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-sans transition-colors",
                              on
                                ? "border-gold/40 bg-gold/10 text-gold"
                                : "border-border/60 bg-secondary/40 text-muted-foreground hover:text-foreground",
                            )}
                          >
                            <Building2 className="h-3 w-3" />
                            {c.name}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-muted-foreground font-sans">
                      {assigned.length === 0
                        ? "Not scoped — this user currently sees every company. Select companies to restrict."
                        : `Scoped to ${assigned.length} ${assigned.length === 1 ? "company" : "companies"}.`}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground font-body">
                    No companies to assign yet.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
