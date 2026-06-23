import { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /**
   * Optional full illustration (e.g. the raccoon mascot) rendered above the
   * title in place of the Lucide icon. When set, the `icon` is ignored — pass
   * a decorative, aria-hidden element. Lets key "getting started" surfaces
   * carry the on-brand character for cross-platform parity with mobile.
   */
  illustration?: ReactNode;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  secondaryActionHref?: string;
  onSecondaryAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  illustration,
  actionLabel,
  actionHref,
  onAction,
  secondaryActionLabel,
  secondaryActionHref,
  onSecondaryAction,
}: EmptyStateProps) {
  // Align to the canonical, app-wide Button "default" pairing (bg-primary +
  // text-primary-foreground) which is contrast-safe in BOTH themes. The previous
  // bg-tone-orange-fg + text-white failed dark-mode contrast (white on the light
  // Gold accent ~2.33:1). (component-theme-system-02)
  const primaryBtn = "px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition";
  const secondaryBtn = "px-5 py-2.5 rounded-xl border border-border bg-foreground/5 text-foreground text-sm font-medium hover:bg-foreground/10 transition";
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center glass-card">
      {illustration ? (
        <div className="mb-4">{illustration}</div>
      ) : (
        <Icon className="h-16 w-16 text-foreground/40 mb-4" />
      )}
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-muted-foreground text-sm mb-6 max-w-sm">{description}</p>
      <div className="flex flex-col sm:flex-row gap-2">
        {actionLabel && actionHref && (
          <Link href={actionHref} className={primaryBtn}>
            {actionLabel}
          </Link>
        )}
        {actionLabel && onAction && !actionHref && (
          <button className={primaryBtn} onClick={onAction}>{actionLabel}</button>
        )}
        {secondaryActionLabel && secondaryActionHref && (
          <Link href={secondaryActionHref} className={secondaryBtn}>
            {secondaryActionLabel}
          </Link>
        )}
        {secondaryActionLabel && onSecondaryAction && !secondaryActionHref && (
          <button className={secondaryBtn} onClick={onSecondaryAction}>{secondaryActionLabel}</button>
        )}
      </div>
    </div>
  );
}
