"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * <Button> — the shared admin button.
 *
 * Codifies the raw <button> patterns scattered across the admin (page-header
 * actions, form Save/Cancel pairs, pagination, destructive confirms) into one
 * component so disabled state, weight and hover never drift again. Visuals are
 * derived 1:1 from the existing inline-Tailwind buttons and the .au-btn CSS
 * family in aurora.css — this is NOT a new visual language.
 *
 *   - primary       accent fill (the "New …" / "Save" / "Export" action)
 *   - secondary     neutral border + card surface (Cancel / Refresh)
 *   - ghost         chromeless, hover tint (icon-only + low-emphasis)
 *   - danger        solid destructive (the irreversible confirm)
 *   - dangerOutline destructive hairline that opens a confirm (Delete / Revoke)
 *
 * Every variant inherits disabled:opacity-50 disabled:cursor-not-allowed.
 * `loading` shows a spinner and disables the button. Sizes use the same
 * px/py rhythm as the legacy inline buttons so migrating a raw <button> is a
 * zero-visual-change swap (md == the dominant px-4 py-2.5 text-sm action).
 * All colour flows through the admin Tailwind theme tokens, which .adm-aurora
 * remaps for both light-slate and dark-navy, so no hex is baked in.
 */

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "dangerOutline";

export type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Show a leading spinner and disable the button. */
  loading?: boolean;
  /** Icon before the label (e.g. a lucide <Plus />); auto-sized, hidden while loading. */
  leftIcon?: ReactNode;
  /** Icon after the label; auto-sized, hidden while loading. */
  rightIcon?: ReactNode;
  /** Stretch to fill the container (full-width submits). */
  fullWidth?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground font-semibold hover:bg-primary/90 active:translate-y-px",
  secondary:
    "border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground active:translate-y-px",
  ghost:
    "text-muted-foreground hover:bg-accent hover:text-foreground active:translate-y-px",
  danger:
    "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:translate-y-px",
  dangerOutline:
    "border border-destructive/30 text-destructive hover:bg-destructive/10 active:translate-y-px",
};

// py/px rhythm copied from the real call sites so a swap is visually neutral:
// sm == the Views/Columns secondary chip; md == the dominant primary action;
// lg == a roomier form submit; icon == the pagination chevron (p-2 square).
const sizes: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
  lg: "px-5 py-3 text-sm",
  icon: "p-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      type = "button",
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;
    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={cn(
          base,
          variants[variant],
          sizes[size],
          fullWidth && "w-full",
          className,
        )}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
        ) : leftIcon ? (
          <span className="shrink-0 [&_svg]:h-4 [&_svg]:w-4" aria-hidden="true">
            {leftIcon}
          </span>
        ) : null}
        {children}
        {!loading && rightIcon ? (
          <span className="shrink-0 [&_svg]:h-4 [&_svg]:w-4" aria-hidden="true">
            {rightIcon}
          </span>
        ) : null}
      </button>
    );
  },
);

Button.displayName = "Button";
