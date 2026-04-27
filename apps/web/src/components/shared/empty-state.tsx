import { LucideIcon } from "lucide-react";
import Link from "next/link";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, actionHref, onAction }: EmptyStateProps) {
  const btn = "px-5 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition";
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center glass-card">
      <Icon className="h-16 w-16 text-foreground/40 mb-4" />
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-muted-foreground text-sm mb-6 max-w-sm">{description}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref}>
          <button className={btn}>{actionLabel}</button>
        </Link>
      )}
      {actionLabel && onAction && !actionHref && (
        <button className={btn} onClick={onAction}>{actionLabel}</button>
      )}
    </div>
  );
}
