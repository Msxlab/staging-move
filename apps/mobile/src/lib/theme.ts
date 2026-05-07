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
  primary: brandColors.orange,            // Aurora cool #7FB6E8
  primaryLight: brandColors.orangeLight,  // cool-light #A5C9F0
  primaryDark: brandColors.orangeDark,    // cool-2 #5C9DDC
  // Faded primary — Aurora cool at 12%. Keeps key faded surfaces
  // (active-plan chip, hero ring) on the cool palette.
  primaryFaded: "rgba(127, 182, 232, 0.12)",
  accent: brandColors.amber,              // Aurora violet #B49BFF

  success: semanticColors.success,        // Aurora mint #87DDC0
  successFaded: "rgba(135, 221, 192, 0.12)",
  warning: semanticColors.warning,        // Aurora amber #F2C46C
  warningFaded: "rgba(242, 196, 108, 0.14)",
  error: semanticColors.danger,           // Aurora coral #F08C8E
  errorFaded: "rgba(240, 140, 142, 0.14)",
  info: semanticColors.info,              // Aurora cool #7FB6E8
  infoFaded: "rgba(127, 182, 232, 0.12)",

  background: surfaceDark.background,
  surface: surfaceDark.surface,
  card: surfaceDark.card,
  cardHover: surfaceDark.cardHover,
  elevated: surfaceDark.elevated,

  border: borderDark.default,
  borderLight: borderDark.strong,
  borderFocus: borderDark.focus,

  // Glass — Aurora pane alphas. Matches `glassDark` from shared tokens,
  // which is now cool white-on-navy for the Aurora system.
  glass: {
    bg: "rgba(255, 255, 255, 0.03)",
    border: "rgba(255, 255, 255, 0.05)",
    highlight: "rgba(255, 255, 255, 0.08)",
  },

  // Foreground — Aurora cool ink `#ECF1F8` on navy surfaces (Edition VII).
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

// Light palette — Aurora cool paper (Edition VII), Aurora ink-1 text.
const lightColors = {
  ...darkColors,

  primaryFaded: "rgba(45, 123, 196, 0.10)",

  background: surfaceLight.background,
  surface: surfaceLight.surface,
  card: surfaceLight.card,
  cardHover: surfaceLight.cardHover,
  elevated: surfaceLight.elevated,

  border: borderLight.default,
  borderLight: borderLight.strong,
  borderFocus: borderLight.focus,

  glass: {
    bg: "rgba(255, 255, 255, 0.55)",
    border: "rgba(20, 32, 47, 0.06)",
    highlight: "rgba(20, 32, 47, 0.04)",
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
