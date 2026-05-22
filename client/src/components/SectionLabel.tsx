import { cn } from "@/lib/utils";

interface SectionLabelProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * A section divider for long result pages — a small uppercase label with a
 * trailing hairline rule. Gives stacked-card outputs a clear visual rhythm.
 */
export function SectionLabel({ children, className }: SectionLabelProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="text-xs text-muted-foreground font-sans uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap">
        {children}
      </span>
      <span className="h-px flex-1 bg-border/50" />
    </div>
  );
}
