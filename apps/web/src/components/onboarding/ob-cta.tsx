"use client";

import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Loader2, Lock } from "lucide-react";

/**
 * Unified onboarding CTA — bundle-3 chat4 owner decision (1).
 *
 * ONE CTA language across web + mobile onboarding:
 *  - `primary`: filled, ~52px tall, 14px radius, 15px/700 type, plan-accent
 *    fill through the existing `--primary` token (the AppShell `.plan-*`
 *    classes re-point it per tier), spring press + CSS-only ripple.
 *  - `back`: quiet ghost — the step's retreat action.
 *  - `skip`: lowest rung — mono uppercase link.
 *
 * REAL disabled state (owner decision): when `disabled` + `disabledHint`,
 * the button swaps to a neutral fill with a lock glyph and the short hint AS
 * the label — never an opacity hack. `loading` shows a spinner and disables.
 *
 * All motion (spring press, ripple, arrow nudge) lives in globals.css under
 * the "Onboarding unified CTA + AI coach" section and is fully gated behind
 * prefers-reduced-motion. Purely presentational: click/disabled semantics are
 * byte-identical to the buttons it replaces.
 */
export type ObCtaVariant = "primary" | "back" | "skip";

export interface ObCtaProps {
  variant?: ObCtaVariant;
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  /** Native disabled. With `disabledHint`, renders the honest locked state. */
  disabled?: boolean;
  /** Short reason shown as the label while disabled (no opacity hack). */
  disabledHint?: string;
  /** Spinner state — also disables the button (matches `disabled={saving}`). */
  loading?: boolean;
  /** Label shown next to the spinner (defaults to `children`). */
  loadingLabel?: ReactNode;
  /** Trailing arrow on `primary` (default true). */
  arrow?: boolean;
  /** Leading arrow on `back` (default true). */
  backArrow?: boolean;
  className?: string;
  "aria-label"?: string;
}

/** Class assembly kept pure so tests can assert exact variant classes. */
export function getObCtaClassName(
  variant: ObCtaVariant,
  opts: { locked?: boolean; loading?: boolean; className?: string } = {},
): string {
  return [
    "ob-cta",
    `ob-cta--${variant}`,
    opts.locked ? "ob-cta-locked" : "",
    opts.loading ? "ob-cta-loading" : "",
    opts.className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function ObCta({
  variant = "primary",
  children,
  onClick,
  type = "button",
  disabled = false,
  disabledHint,
  loading = false,
  loadingLabel,
  arrow = true,
  backArrow = true,
  className,
  "aria-label": ariaLabel,
}: ObCtaProps) {
  const isDisabled = disabled || loading;
  const locked = disabled && !loading;
  const showHint = locked && Boolean(disabledHint);

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-disabled={isDisabled || undefined}
      aria-label={ariaLabel}
      className={getObCtaClassName(variant, { locked, loading, className })}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span className="ob-cta-label">{loadingLabel ?? children}</span>
        </>
      ) : showHint ? (
        <>
          <Lock className="h-4 w-4" aria-hidden="true" />
          <span className="ob-cta-label">{disabledHint}</span>
        </>
      ) : (
        <>
          {variant === "back" && backArrow && (
            <ArrowLeft className="h-4 w-4 ob-cta-arrow-back" aria-hidden="true" />
          )}
          <span className="ob-cta-label">{children}</span>
          {variant === "primary" && arrow && (
            <ArrowRight className="h-4 w-4 ob-cta-arrow" aria-hidden="true" />
          )}
        </>
      )}
    </button>
  );
}
