/**
 * SEMANTIC STATUS → TONE mapping (single source of truth).
 *
 * Turns domain enums (due-date urgency, recommendation confidence, risk level)
 * into a small set of semantic tones so every surface reads consistently. The
 * tones map 1:1 to the Badge component's variants AND to the theme's
 * success/warning/error/info color tokens, both of which already supply
 * dark- AND light-mode-correct (AA) values — so routing status through here
 * gives dual-theme parity for free.
 *
 * Pure + dependency-free (no theme import) so it stays unit-testable; callers
 * resolve a tone to concrete colors with `resolveToneColors(theme, tone)`.
 */

export type SemanticTone = "success" | "warning" | "error" | "info" | "neutral";

/** Badge variant for a tone (Badge already maps these to per-scheme tokens). */
export function toneBadgeVariant(tone: SemanticTone): "success" | "warning" | "error" | "info" | "neutral" {
  return tone;
}

/**
 * Whole calendar days until a due date string (negative = overdue). Returns
 * null for missing/unparseable input so callers can fall back to neutral.
 */
export function daysUntilDue(value: string | null | undefined, now: number = Date.now()): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  return Math.floor((time - now) / 86_400_000);
}

/** Due-date urgency tone from whole days remaining (negative = overdue). */
export function dueUrgencyTone(days: number | null | undefined): SemanticTone {
  if (days == null || Number.isNaN(days)) return "neutral";
  if (days < 0) return "error"; // overdue — must stand out
  if (days <= 2) return "warning"; // due very soon
  if (days <= 7) return "info"; // upcoming
  return "neutral";
}

/** Recommendation/coverage confidence tone. Accepts HIGH/MEDIUM/LOW (any case). */
export function confidenceTone(confidence: string | null | undefined): SemanticTone {
  switch ((confidence ?? "").toUpperCase()) {
    case "HIGH":
      return "success";
    case "MEDIUM":
      return "warning";
    case "LOW":
      return "neutral";
    default:
      return "neutral";
  }
}

/**
 * Risk-level tone. TRUE high risk reads as danger (error/coral), not amber, so
 * users can tell a real alarm from merely informational/county-relative data.
 */
export function riskTone(level: string | null | undefined): SemanticTone {
  switch ((level ?? "").toLowerCase()) {
    case "high":
    case "elevated":
    case "severe":
      return "error";
    case "moderate":
    case "medium":
      return "warning";
    case "low":
    case "minimal":
      return "success";
    default:
      return "neutral";
  }
}

/** A minimal shape of the resolved theme colors this helper reads. */
interface ToneColorTheme {
  colors: {
    success: string;
    warning: string;
    error: string;
    info: string;
    textTertiary: string;
    successFaded?: string;
    warningFaded?: string;
    errorFaded?: string;
    infoFaded?: string;
  };
}

export interface ToneColors {
  /** Foreground text/icon color. */
  fg: string;
  /** Soft background tint (falls back to a low-alpha fg when no *Faded token). */
  bg: string;
}

/** Resolve a tone to concrete dark/light-correct colors from the app theme. */
export function resolveToneColors(theme: ToneColorTheme, tone: SemanticTone): ToneColors {
  const c = theme.colors;
  switch (tone) {
    case "success":
      return { fg: c.success, bg: c.successFaded ?? `${c.success}22` };
    case "warning":
      return { fg: c.warning, bg: c.warningFaded ?? `${c.warning}22` };
    case "error":
      return { fg: c.error, bg: c.errorFaded ?? `${c.error}22` };
    case "info":
      return { fg: c.info, bg: c.infoFaded ?? `${c.info}22` };
    default:
      return { fg: c.textTertiary, bg: `${c.textTertiary}1A` };
  }
}
