import * as React from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Clock,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * StatusBadge — status chip where the icon is STRUCTURAL, not decorative.
 *
 * The audit (§2.2 "Renk Uyumu & Tema") flagged that the app was
 * communicating success/warning/error state through color alone —
 * a WCAG 1.4.1 violation (Use of Color) that makes payment
 * success/failure indistinguishable for color-blind users. This
 * component refuses to render without an icon + visible label, and
 * each variant ships its own default icon that carries meaning on
 * its own. If a caller explicitly passes `icon={null}` the type
 * system still forces them to acknowledge the choice — and the label
 * becomes the redundant information channel.
 *
 * Variants map to the brand's tonal pairs (docs/brand-voice.md) so
 * the badge visually belongs on dark and light surfaces without
 * further configuration.
 */

type Status = "success" | "warning" | "error" | "info" | "pending" | "neutral";

const DEFAULT_ICONS: Record<Status, LucideIcon> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
  pending: Clock,
  neutral: Info,
};

const VARIANT_CLASSES: Record<Status, string> = {
  // Use the canonical tonal-pair CSS variables from globals.css so
  // light mode inherits the right foreground automatically.
  success:
    "bg-tone-emerald-bg border-tone-emerald-br text-tone-emerald-fg",
  warning:
    "bg-tone-amber-bg border-tone-amber-br text-tone-amber-fg",
  error:
    "bg-tone-rose-bg border-tone-rose-br text-tone-rose-fg",
  info: "bg-tone-sky-bg border-tone-sky-br text-tone-sky-fg",
  pending:
    "bg-tone-cyan-bg border-tone-cyan-br text-tone-cyan-fg",
  neutral:
    "bg-muted text-muted-foreground border-transparent",
};

const SIZE_CLASSES = {
  sm: "text-[11px] leading-4 px-2 py-0.5 gap-1",
  md: "text-xs leading-5 px-2.5 py-1 gap-1.5",
  lg: "text-sm leading-5 px-3 py-1.5 gap-2",
} as const;

const ICON_SIZE = { sm: 12, md: 14, lg: 16 } as const;

export interface StatusBadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  status: Status;
  label: string;
  /**
   * Override the default icon. Pass a Lucide component or `null` to
   * opt out explicitly — the status remains communicated through the
   * label + role="status", which is screen-reader accessible.
   */
  icon?: LucideIcon | null;
  size?: keyof typeof SIZE_CLASSES;
}

export function StatusBadge({
  status,
  label,
  icon,
  size = "md",
  className,
  ...rest
}: StatusBadgeProps) {
  const Icon = icon === undefined ? DEFAULT_ICONS[status] : icon;
  const px = ICON_SIZE[size];

  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        SIZE_CLASSES[size],
        VARIANT_CLASSES[status],
        className,
      )}
      {...rest}
    >
      {Icon && <Icon size={px} aria-hidden="true" className="shrink-0" />}
      <span>{label}</span>
    </span>
  );
}
