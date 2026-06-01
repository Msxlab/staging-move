import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared empty-state panel for admin list/table surfaces.
 *
 * One consistent "nothing here" treatment across every module: a muted
 * circular icon, a title, an optional description, and an optional action
 * slot (e.g. a "Clear filters" button or a "Create the first X" CTA).
 *
 * Replaces the ad-hoc plain-text "No X found" lines that each page rolled
 * on its own. `compact` tightens the vertical rhythm for in-card / nested
 * contexts (e.g. a panel inside a detail view).
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact,
  className,
}: {
  icon: ElementType;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-4" : "py-12",
        className,
      )}
    >
      <div className="rounded-full bg-muted/30 p-3 text-muted-foreground">
        <Icon className={cn(compact ? "h-5 w-5" : "h-6 w-6")} aria-hidden="true" />
      </div>
      <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
