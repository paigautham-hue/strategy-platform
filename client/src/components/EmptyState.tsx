import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description?: string;
  /** Optional call-to-action link. */
  action?: { label: string; href: string };
  /** Render bare (no Card wrapper) when already inside a Card. */
  bare?: boolean;
}

/**
 * A consistent empty / no-data placeholder — an icon, a title, a line of
 * guidance, and an optional call to action. Used wherever a surface has
 * nothing to show yet.
 */
export function EmptyState({ icon: Icon, title, description, action, bare }: EmptyStateProps) {
  const body = (
    <div className="flex flex-col items-center text-center gap-3 py-8">
      <div className="w-12 h-12 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center">
        <Icon className="h-5 w-5 text-gold" />
      </div>
      <div className="space-y-1">
        <p className="font-heading text-base text-foreground">{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground font-body max-w-sm leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && (
        <Link href={action.href}>
          <Button size="sm" className="gradient-gold text-background font-sans mt-1">
            {action.label}
          </Button>
        </Link>
      )}
    </div>
  );

  if (bare) return body;
  return (
    <Card className="card-glass">
      <CardContent className="p-2">{body}</CardContent>
    </Card>
  );
}
