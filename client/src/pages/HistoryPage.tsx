/**
 * History — every saved reasoning run for the active company, filterable by
 * kind, revisitable, and exportable to a print-ready document.
 */

import { useState } from "react";
import { AlertCircle, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AnalysisHistory, KIND_LABEL, type AnalysisKind } from "@/components/AnalysisHistory";
import { cn } from "@/lib/utils";

interface HistoryPageProps {
  activeCompanyId: number | null;
}

export default function HistoryPage({ activeCompanyId }: HistoryPageProps) {
  const [kind, setKind] = useState<AnalysisKind | null>(null);

  if (!activeCompanyId) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span className="font-sans text-sm">Select a company to see its analysis history.</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-3xl mx-auto">
      <div>
        <h2 className="font-heading text-2xl text-foreground flex items-center gap-2">
          <History className="h-5 w-5 text-gold" /> History
        </h2>
        <p className="text-muted-foreground font-sans text-sm mt-1">
          Every diagnosis, research run, war-game, and briefing — saved, revisitable, exportable.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge
          onClick={() => setKind(null)}
          className={cn(
            "cursor-pointer text-[11px] select-none",
            kind === null
              ? "bg-gold/15 text-gold border-gold/30"
              : "bg-secondary/60 text-muted-foreground border-border/40 hover:text-foreground"
          )}
        >
          All
        </Badge>
        {(Object.entries(KIND_LABEL) as [AnalysisKind, string][]).map(([k, label]) => (
          <Badge
            key={k}
            onClick={() => setKind(k)}
            className={cn(
              "cursor-pointer text-[11px] select-none",
              kind === k
                ? "bg-gold/15 text-gold border-gold/30"
                : "bg-secondary/60 text-muted-foreground border-border/40 hover:text-foreground"
            )}
          >
            {label}
          </Badge>
        ))}
      </div>

      <AnalysisHistory
        companyId={activeCompanyId}
        kind={kind ?? undefined}
        limit={100}
        title={kind ? `${KIND_LABEL[kind]} runs` : "All runs"}
      />
    </div>
  );
}
