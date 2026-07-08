/**
 * AnalysisHistory — past runs of a reasoning surface, revisitable and exportable.
 *
 * Reasoning results are persisted server-side (analysis_run). This component
 * lists them per company (optionally filtered to one kind), expands a run
 * inline with a generic result renderer, and exports a run as a print-ready
 * document (browser print → Save as PDF; zero dependencies).
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, ChevronDown, ChevronUp, Printer } from "lucide-react";

export const KIND_LABEL = {
  diagnosis: "Diagnosis",
  research: "Research",
  frameworks: "Frameworks",
  options: "Options",
  red_team: "Red Team",
  war_game: "War-Game",
  pre_mortem: "Pre-Mortem",
  briefing: "Briefing",
  brainstorm: "Brainstorm",
  decompose: "Decomposition",
  persona: "Persona Consult",
  playbook: "Playbook",
  pattern_mining: "Pattern Mining",
} as const;

export type AnalysisKind = keyof typeof KIND_LABEL;

const labelize = (key: string) =>
  key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());

// ─── Generic result renderer (React) ─────────────────────────────────────────

function ValueNode({ value, depth }: { value: unknown; depth: number }) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return <p className="text-sm text-foreground font-body leading-relaxed">{String(value)}</p>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return (
      <ul className="space-y-1">
        {value.map((item, i) => (
          <li key={i} className="text-sm text-foreground font-body flex gap-2">
            <span className="text-gold shrink-0">·</span>
            <div className="min-w-0 flex-1">
              <ValueNode value={item} depth={depth + 1} />
            </div>
          </li>
        ))}
      </ul>
    );
  }
  if (typeof value === "object") {
    return (
      <div className={depth > 0 ? "space-y-2" : "space-y-3"}>
        {Object.entries(value as Record<string, unknown>).map(([k, v]) => {
          if (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) {
            return null;
          }
          return (
            <div key={k} className="space-y-1">
              <p className="text-xs text-muted-foreground font-sans uppercase tracking-wider">
                {labelize(k)}
              </p>
              <ValueNode value={v} depth={depth + 1} />
            </div>
          );
        })}
      </div>
    );
  }
  return null;
}

// ─── Print export ─────────────────────────────────────────────────────────────

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function valueToHtml(value: unknown, depth: number): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return `<p>${escapeHtml(String(value))}</p>`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "";
    return `<ul>${value.map((v) => `<li>${valueToHtml(v, depth + 1)}</li>`).join("")}</ul>`;
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => {
        const body = valueToHtml(v, depth + 1);
        if (!body) return "";
        const tag = depth === 0 ? "h2" : depth === 1 ? "h3" : "h4";
        return `<${tag}>${escapeHtml(labelize(k))}</${tag}>${body}`;
      })
      .join("");
  }
  return "";
}

export function printAnalysisRun(run: {
  kind: string;
  inputSummary: string;
  result: unknown;
  createdAt: string | Date;
}) {
  const created = new Date(run.createdAt).toLocaleString();
  const kindLabel = (KIND_LABEL as Record<string, string>)[run.kind] ?? run.kind;
  const html = `<!doctype html><html><head><meta charset="utf-8">
<title>${escapeHtml(kindLabel)} — Cairn</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; max-width: 720px; margin: 40px auto; padding: 0 24px; line-height: 1.55; }
  h1 { font-size: 22px; border-bottom: 2px solid #b8860b; padding-bottom: 8px; }
  h2 { font-size: 16px; margin-top: 24px; color: #333; }
  h3 { font-size: 14px; margin-top: 16px; color: #444; }
  h4 { font-size: 13px; margin-top: 12px; color: #555; }
  p, li { font-size: 13px; }
  ul { padding-left: 20px; }
  .meta { color: #777; font-size: 12px; margin-bottom: 24px; }
  @media print { body { margin: 0 auto; } }
</style></head><body>
<h1>${escapeHtml(kindLabel)}</h1>
<div class="meta">${escapeHtml(run.inputSummary)}<br>Generated ${escapeHtml(created)} · CAIRN strategy platform</div>
${valueToHtml(run.result, 0)}
</body></html>`;

  const win = window.open("", "_blank", "width=840,height=900");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  // Give the new window a beat to lay out before the print dialog.
  setTimeout(() => win.print(), 250);
}

// ─── The history list ─────────────────────────────────────────────────────────

interface AnalysisHistoryProps {
  companyId: number;
  /** Restrict to one kind (per-page usage); omit to list all kinds (History page). */
  kind?: AnalysisKind;
  limit?: number;
  title?: string;
  /** Render skeleton/empty/error states instead of disappearing (History page). */
  showEmpty?: boolean;
}

export function AnalysisHistory({ companyId, kind, limit, title, showEmpty }: AnalysisHistoryProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { data: runs, isLoading, isError, error } = trpc.analysisRuns.list.useQuery({
    companyId,
    kind,
    limit: limit ?? 20,
  });

  // Per-page panels stay invisible until there is history to show; the
  // History page (showEmpty) always renders its state.
  if (!showEmpty && (isLoading || isError || !runs || runs.length === 0)) return null;

  if (showEmpty && isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 w-full rounded bg-secondary/40 animate-pulse" />
        ))}
      </div>
    );
  }
  if (showEmpty && isError) {
    return (
      <Card className="card-glass border-destructive/40">
        <CardContent className="py-8 text-center text-sm text-muted-foreground font-body">
          Could not load history{error?.message ? ` — ${error.message}` : ""}. Try refreshing.
        </CardContent>
      </Card>
    );
  }
  if (showEmpty && (!runs || runs.length === 0)) {
    return (
      <Card className="card-glass">
        <CardContent className="py-12 text-center space-y-1">
          <History className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-foreground font-body">No saved runs yet.</p>
          <p className="text-xs text-muted-foreground font-body">
            Run a diagnosis, research, war-game, or any other analysis — every result is saved here automatically.
          </p>
        </CardContent>
      </Card>
    );
  }
  if (!runs || runs.length === 0) return null;

  return (
    <Card className="card-glass">
      <CardHeader>
        <CardTitle className="font-heading text-lg flex items-center gap-2">
          <History className="h-4 w-4 text-gold" /> {title ?? "Past runs"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {runs.map((run) => {
          const expanded = expandedId === run.id;
          return (
            <div key={run.id} className="rounded border border-border/40 bg-secondary/30">
              <button
                className="w-full flex items-center gap-2 p-3 text-left"
                onClick={() => setExpandedId(expanded ? null : run.id)}
              >
                {!kind && (
                  <Badge className="text-[10px] bg-gold/10 text-gold border-gold/20 shrink-0">
                    {KIND_LABEL[run.kind] ?? run.kind}
                  </Badge>
                )}
                <span className="text-sm text-foreground font-body truncate flex-1">
                  {run.inputSummary}
                </span>
                <span className="text-xs text-muted-foreground font-sans shrink-0">
                  {new Date(run.createdAt).toLocaleDateString()}
                </span>
                {expanded ? (
                  <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
              </button>
              {expanded && (
                <div className="px-3 pb-3 space-y-3">
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      onClick={() => printAnalysisRun(run)}
                    >
                      <Printer className="h-3 w-3" /> Export / Print
                    </Button>
                  </div>
                  <ValueNode value={run.result} depth={0} />
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
