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
  primary: brandColors.orange,            // rose #D4846A
  primaryLight: brandColors.orangeLight,  // rose-light #EDB99D
  primaryDark: brandColors.orangeDark,    // rose-deep #A85A42
  // Faded primary — matches `tonesDark.rose.bg` (12% rose) instead of the
  // legacy 15% orange. Keeps key faded surfaces (active-plan chip, hero
  // ring) on the new palette.
  primaryFaded: "rgba(212, 132, 106, 0.12)",
  accent: brandColors.amber,              // foil champagne #E5C9A8

  success: semanticColors.success,        // sage #5EAD9A
  successFaded: "rgba(94, 173, 154, 0.12)",
  warning: semanticColors.warning,        // honey #E3B04B
  warningFaded: "rgba(227, 176, 75, 0.14)",
  error: semanticColors.danger,           // warm-red #C85A3E
  errorFaded: "rgba(200, 90, 62, 0.14)",
  info: semanticColors.info,              // dusted slate #8AA9C0
  infoFaded: "rgba(138, 169, 192, 0.12)",

  background: surfaceDark.background,
  surface: surfaceDark.surface,
  card: surfaceDark.card,
  cardHover: surfaceDark.cardHover,
  elevated: surfaceDark.elevated,

  border: borderDark.default,
  borderLight: borderDark.strong,
  borderFocus: borderDark.focus,

  // Glass uses warm cream alpha (matches `glassDark` from shared tokens).
  // The previous `rgba(255,255,255,…)` made sticky chrome read as cool
  // white-on-near-black — Edition VI surfaces are warm umber, so the
  // overlay tint must also be warm cream.
  glass: {
    bg: "rgba(245, 241, 234, 0.04)",
    border: "rgba(245, 241, 234, 0.08)",
    highlight: "rgba(245, 241, 234, 0.07)",
  },

  // Foreground — warm cream `#F5F1EA` on warm umber surfaces (Edition VI).
  // The pure-white override was kept for pixel parity with the legacy
  // dark theme; it now reads cooler than every other surface.
  text: textDark.primary,
  textSecondary: textDark.secondary,
  textTertiary: textDark.tertiary,
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

// Light palette — Edition VI ivory paper, warm-deep-umber text.
const lightColors = {
  ...darkColors,

  primaryFaded: "rgba(184, 90, 66, 0.10)",

  background: surfaceLight.background,
  surface: surfaceLight.surface,
  card: surfaceLight.card,
  cardHover: surfaceLight.cardHover,
  elevated: surfaceLight.elevated,

  border: borderLight.default,
  borderLight: borderLight.strong,
  borderFocus: borderLight.focus,

  glass: {
    bg: "rgba(42, 31, 24, 0.04)",
    border: "rgba(42, 31, 24, 0.08)",
    highlight: "rgba(42, 31, 24, 0.04)",
  },

  text: textLight.primary,
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
