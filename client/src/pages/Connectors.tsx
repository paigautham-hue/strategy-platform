import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  Plug,
  CheckCircle2,
  XCircle,
  Link2,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ConnectorsProps {
  activeCompanyId: number | null;
}

const STATUS_STYLE: Record<string, string> = {
  connected: "bg-gold/10 text-gold border-gold/20",
  disconnected: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  error: "bg-destructive/10 text-destructive border-destructive/20",
  "not-configured": "bg-secondary text-muted-foreground border-border/40",
};

export default function Connectors({ activeCompanyId }: ConnectorsProps) {
  const utils = trpc.useUtils();
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [pushTitle, setPushTitle] = useState("");
  const [pushDesc, setPushDesc] = useState("");

  const { data: connectors } = trpc.connector.list.useQuery(
    { companyId: activeCompanyId ?? 0 },
    { enabled: !!activeCompanyId },
  );
  const linear = connectors?.find((c) => c.type === "linear");

  const { data: teamsData } = trpc.connector.teams.useQuery(
    { companyId: activeCompanyId ?? 0 },
    { enabled: !!activeCompanyId && linear?.status === "connected" },
  );
  const { data: links } = trpc.connector.links.useQuery(
    { companyId: activeCompanyId ?? 0 },
    { enabled: !!activeCompanyId },
  );

  const refresh = () => {
    utils.connector.list.invalidate();
    utils.connector.links.invalidate();
  };

  const connectMut = trpc.connector.connect.useMutation({
    onSuccess: () => {
      toast.success("Credential saved — now test the connection");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const testMut = trpc.connector.test.useMutation({
    onSuccess: (r) => {
      r.ok ? toast.success(`Connected as ${r.name}`) : toast.error(r.error ?? "Test failed");
      refresh();
      utils.connector.teams.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const setTeamMut = trpc.connector.setTeam.useMutation({
    onSuccess: () => {
      toast.success("Linear team set");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const disconnectMut = trpc.connector.disconnect.useMutation({
    onSuccess: () => {
      toast.success("Disconnected");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const pushMut = trpc.connector.pushInitiative.useMutation({
    onSuccess: (issue) => {
      toast.success(`Pushed ${issue.identifier}`);
      setPushTitle("");
      setPushDesc("");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!activeCompanyId) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span className="font-sans text-sm">Select a company to manage its connectors.</span>
      </div>
    );
  }

  const busy =
    connectMut.isPending || testMut.isPending || disconnectMut.isPending || setTeamMut.isPending;

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl text-foreground flex items-center gap-2">
          <Plug className="h-5 w-5 text-gold" /> Execution Connectors
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          Connect this company's execution tools so initiatives can be pushed
          straight to where the work happens. Credentials are encrypted at rest.
        </p>
      </div>

      {connectors?.map((c) => (
        <Card key={c.type} className="card-glass">
          <CardHeader>
            <CardTitle className="font-heading text-base flex items-center gap-2">
              <Plug className="h-4 w-4 text-gold" /> {c.label}
              <Badge className={cn("text-[10px] ml-auto", STATUS_STYLE[c.status])}>
                {c.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground font-body">{c.description}</p>

            {!c.available ? (
              <p className="text-xs text-muted-foreground font-sans italic">
                Not yet available.
              </p>
            ) : !c.configured ? (
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={tokens[c.type] ?? ""}
                  onChange={(e) => setTokens((p) => ({ ...p, [c.type]: e.target.value }))}
                  placeholder={c.credentialLabel}
                  className="bg-secondary/50 border-border/60 font-body"
                />
                <Button
                  className="gradient-gold text-background font-sans shrink-0"
                  disabled={busy || !(tokens[c.type] ?? "").trim()}
                  onClick={() =>
                    connectMut.mutate({
                      companyId: activeCompanyId,
                      connectorType: c.type,
                      credential: (tokens[c.type] ?? "").trim(),
                    })
                  }
                >
                  Connect
                </Button>
              </div>
            ) : (
              <>
                {c.lastError && (
                  <p className="text-xs text-destructive font-body flex items-start gap-1.5">
                    <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    {c.lastError}
                  </p>
                )}
                {c.status === "connected" && (
                  <p className="text-xs text-gold font-body flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Connection verified.
                  </p>
                )}

                {c.type === "linear" && c.status === "connected" && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-muted-foreground font-sans uppercase tracking-wider">
                      Target team {c.teamName ? `· currently ${c.teamName}` : "· not set"}
                    </label>
                    <Select
                      value=""
                      onValueChange={(v) => {
                        const team = teamsData?.teams.find((t) => t.id === v);
                        if (team)
                          setTeamMut.mutate({
                            companyId: activeCompanyId,
                            teamId: team.id,
                            teamName: team.name,
                          });
                      }}
                      disabled={busy || !teamsData?.ok}
                    >
                      <SelectTrigger className="bg-secondary/50 border-border/60 text-sm">
                        <SelectValue placeholder="Choose a Linear team…" />
                      </SelectTrigger>
                      <SelectContent>
                        {teamsData?.teams.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="font-sans"
                    disabled={busy}
                    onClick={() =>
                      testMut.mutate({ companyId: activeCompanyId, connectorType: c.type })
                    }
                  >
                    {testMut.isPending ? "Testing…" : "Test connection"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="font-sans text-destructive"
                    disabled={busy}
                    onClick={() =>
                      disconnectMut.mutate({ companyId: activeCompanyId, connectorType: c.type })
                    }
                  >
                    Disconnect
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Push an initiative — only when Linear is fully ready */}
      {linear?.status === "connected" && linear.teamName && (
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="font-heading text-base flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-gold" /> Push an initiative to Linear
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={pushTitle}
              onChange={(e) => setPushTitle(e.target.value)}
              placeholder="Initiative title"
              className="bg-secondary/50 border-border/60 font-body"
            />
            <Textarea
              value={pushDesc}
              onChange={(e) => setPushDesc(e.target.value)}
              placeholder="Description (optional)"
              className="bg-secondary/50 border-border/60 min-h-[70px] font-body"
              rows={3}
            />
            <Button
              className="w-full gradient-gold text-background font-sans gap-2"
              disabled={!pushTitle.trim() || pushMut.isPending}
              onClick={() =>
                pushMut.mutate({
                  companyId: activeCompanyId,
                  title: pushTitle.trim(),
                  description: pushDesc.trim() || undefined,
                })
              }
            >
              <ArrowUpRight className="h-4 w-4" />
              {pushMut.isPending ? "Pushing…" : `Push to ${linear.teamName}`}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recorded links */}
      {links && links.length > 0 && (
        <Card className="card-glass">
          <CardHeader>
            <CardTitle className="font-heading text-base flex items-center gap-2">
              <Link2 className="h-4 w-4 text-gold" /> Synced items
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {links.map((l) => (
              <div
                key={l.id}
                className="flex items-center gap-2 rounded border border-border/40 bg-secondary/20 p-2.5"
              >
                <Badge variant="secondary" className="text-[10px]">
                  {l.connectorType}
                </Badge>
                <span className="text-sm text-foreground font-body flex-1 truncate">
                  {l.localKey}
                </span>
                {l.externalState && (
                  <Badge variant="outline" className="text-[10px]">
                    {l.externalState}
                  </Badge>
                )}
                {l.externalUrl && (
                  <a
                    href={l.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-gold hover:text-gold/80"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
