import { useColorScheme } from "react-native";
import {
  brandColors,
  semanticColors,
  surfaceDark,
  surfaceLight,
  textDark,
  textLight,
  borderDark,
  borderLight,
  tonesDark,
  tonesLight,
  gradients,
  spacing as tokenSpacing,
  radii as tokenRadii,
  shadowsMobile,
} from "@locateflow/shared";

// ──────────────────────────────────────────────────────────────────────
// Dual-palette theming.
//
// Token source of truth: packages/shared/src/design-tokens.ts. The
// palette objects below consume those tokens directly — changing a
// brand color in shared/design-tokens.ts flows through to every screen
// without a codemod.
//
// Backward compatibility: `theme` (default export) stays dark so the
// legacy `theme.colors.background` call sites continue to resolve to
// the dark palette. Screens that opt into light-aware rendering switch
// to `useAppTheme()`.
// ──────────────────────────────────────────────────────────────────────

const darkColors = {
  primary: brandColors.orange,
  primaryLight: brandColors.orangeLight,
  primaryDark: brandColors.orangeDark,
  primaryFaded: "rgba(249, 115, 22, 0.15)",
  accent: brandColors.amber,

  success: semanticColors.success,
  successFaded: "rgba(16, 185, 129, 0.15)",
  warning: semanticColors.warning,
  warningFaded: "rgba(245, 158, 11, 0.15)",
  error: semanticColors.danger,
  errorFaded: "rgba(239, 68, 68, 0.15)",
  info: semanticColors.info,
  infoFaded: "rgba(59, 130, 246, 0.15)",

  background: surfaceDark.background,
  surface: surfaceDark.surface,
  card: surfaceDark.card,
  cardHover: surfaceDark.cardHover,
  elevated: surfaceDark.elevated,

  border: borderDark.default,
  borderLight: borderDark.strong,
  borderFocus: borderDark.focus,

  // Mobile glass uses slightly richer alpha than shared glassDark
  // (keeps legacy visual weight for sheets & sticky chrome).
  glass: {
    bg: "rgba(255, 255, 255, 0.06)",
    border: "rgba(255, 255, 255, 0.12)",
    highlight: "rgba(255, 255, 255, 0.08)",
  },

  // Mobile historically used hex white + 0.4 tertiary; keep those exact
  // values for pixel parity with existing screens.
  text: "#ffffff",
  textSecondary: textDark.secondary,
  textTertiary: "rgba(255, 255, 255, 0.4)",
  textMuted: textDark.muted,

  orange: tonesDark.orange,
  emerald: tonesDark.emerald,
  amber: tonesDark.amber,
  rose: tonesDark.rose,
  sky: tonesDark.sky,
  cyan: tonesDark.cyan,

  gradient: {
    primary: gradients.primary as readonly [string, string],
    warm: gradients.warm as readonly [string, string],
    glow: gradients.glow as readonly [string, string],
  },
} as const;

// Light palette — same brand orange, surfaces inverted, text darkened.
// Tones chosen to hit WCAG AA on common Tailwind-ish contrast checks.
const lightColors = {
  ...darkColors,

  primaryFaded: "rgba(249, 115, 22, 0.10)",

  background: surfaceLight.background,
  surface: surfaceLight.surface,
  card: surfaceLight.card,
  cardHover: surfaceLight.cardHover,
  elevated: surfaceLight.elevated,

  border: borderLight.default,
  borderLight: borderLight.strong,
  borderFocus: borderLight.focus,

  glass: {
    bg: "rgba(15, 23, 42, 0.04)",
    border: "rgba(15, 23, 42, 0.08)",
    highlight: "rgba(15, 23, 42, 0.04)",
  },

  text: "#0f172a",
  textSecondary: textLight.secondary,
  textTertiary: textLight.tertiary,
  textMuted: textLight.muted,

  orange: tonesLight.orange,
  emerald: tonesLight.emerald,
  amber: tonesLight.amber,
  rose: tonesLight.rose,
  sky: tonesLight.sky,
  cyan: tonesLight.cyan,
} as const;

export const theme = {
  colors: darkColors,
  spacing: tokenSpacing,
  radius: tokenRadii,
  shadow: shadowsMobile,
} as const;

export type Theme = typeof theme;

/**
 * Light-palette equivalent of the default `theme`. Structure is identical
 * so any component that accepts `Theme` can accept this. Cast through
 * unknown because `darkColors` is `as const` (narrow literal types);
 * `lightColors` uses different string literals but the same shape.
 */
export const lightTheme = {
  ...theme,
  colors: lightColors,
} as unknown as Theme;

/** Explicit opt-in: resolve a palette by name. */
export function themeForScheme(scheme: "light" | "dark" | "unspecified" | null | undefined): Theme {
  return scheme === "light" ? lightTheme : theme;
}

/**
 * React hook that returns the active palette based on the OS setting.
 * Screens that want to respect light mode should read their colors from
 * this hook instead of the static `theme` export:
 *
 *   const t = useAppTheme();
 *   <View style={{ backgroundColor: t.colors.background }} />
 *
 * Legacy screens using `theme` directly will continue to render dark —
 * the migration is intentionally gradual.
 */
export function useAppTheme(): Theme {
  const scheme = useColorScheme();
  return themeForScheme(scheme === "light" || scheme === "dark" ? scheme : null);
}
