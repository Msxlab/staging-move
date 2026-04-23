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
  primary: brandColors.rose,
  primaryLight: brandColors.roseLight,
  primaryDark: brandColors.roseDeep,
  primaryFaded: "rgba(212, 132, 106, 0.15)",
  accent: brandColors.foil,
  accentDeep: brandColors.foilShadow,

  // Edition VI · canonical Champagne & Rose names exposed alongside
  // the legacy `primary/accent` keys so new screens can read them direct.
  rosePrimary: brandColors.rose,
  roseLight: brandColors.roseLight,
  roseDeep: brandColors.roseDeep,
  foilA: brandColors.foilHighlight,
  foilB: brandColors.foil,
  foilC: brandColors.foilShadow,
  sage: brandColors.sage,

  success: semanticColors.success,
  successFaded: "rgba(94, 173, 154, 0.15)",
  warning: semanticColors.warning,
  warningFaded: "rgba(227, 176, 75, 0.15)",
  error: semanticColors.danger,
  errorFaded: "rgba(200, 90, 62, 0.15)",
  info: semanticColors.info,
  infoFaded: "rgba(138, 169, 192, 0.15)",

  background: surfaceDark.background,
  surface: surfaceDark.surface,
  card: surfaceDark.card,
  cardHover: surfaceDark.cardHover,
  elevated: surfaceDark.elevated,

  border: borderDark.default,
  borderLight: borderDark.strong,
  borderFoil: borderDark.foil,
  borderFocus: borderDark.focus,

  // Mobile glass — cream alpha on umber so the foil can breathe through.
  glass: {
    bg: "rgba(245, 241, 234, 0.05)",
    border: "rgba(245, 241, 234, 0.10)",
    highlight: "rgba(245, 241, 234, 0.07)",
  },

  // Cream ink on umber — replaces the legacy pure white.
  text: "#F5F1EA",
  textSecondary: textDark.secondary,
  textTertiary: "rgba(245, 241, 234, 0.38)",
  textMuted: textDark.muted,

  orange: tonesDark.orange,
  emerald: tonesDark.emerald,
  amber: tonesDark.amber,
  rose: tonesDark.rose,
  foil: tonesDark.foil,
  sageT: tonesDark.sage,
  honey: tonesDark.honey,
  umber: tonesDark.umber,
  slate: tonesDark.slate,
  sky: tonesDark.sky,
  cyan: tonesDark.cyan,

  gradient: {
    primary: gradients.foil as readonly [string, string, string],
    foil: gradients.foil as readonly [string, string, string],
    rose: gradients.rose as readonly [string, string],
    warm: gradients.warm as readonly [string, string],
    glow: gradients.glow as readonly [string, string],
  },
} as const;

// Light palette — ivory paper, deeper rose for contrast. Same shape
// as darkColors so any `Theme`-typed component can swap palettes.
const lightColors = {
  ...darkColors,

  // Rose deepens a hair on paper for AA contrast over ivory.
  primary: "#B85A42",
  primaryLight: "#D4846A",
  primaryDark: "#8B3E28",
  primaryFaded: "rgba(184, 90, 66, 0.10)",
  rosePrimary: "#B85A42",
  roseLight: "#D4846A",
  roseDeep: "#8B3E28",

  background: surfaceLight.background,
  surface: surfaceLight.surface,
  card: surfaceLight.card,
  cardHover: surfaceLight.cardHover,
  elevated: surfaceLight.elevated,

  border: borderLight.default,
  borderLight: borderLight.strong,
  borderFoil: borderLight.foil,
  borderFocus: borderLight.focus,

  glass: {
    bg: "rgba(255, 255, 255, 0.70)",
    border: "rgba(42, 31, 24, 0.08)",
    highlight: "rgba(42, 31, 24, 0.04)",
  },

  text: "#2A1F18",
  textSecondary: textLight.secondary,
  textTertiary: textLight.tertiary,
  textMuted: textLight.muted,

  orange: tonesLight.orange,
  emerald: tonesLight.emerald,
  amber: tonesLight.amber,
  rose: tonesLight.rose,
  foil: tonesLight.foil,
  sageT: tonesLight.sage,
  honey: tonesLight.honey,
  umber: tonesLight.umber,
  slate: tonesLight.slate,
  sky: tonesLight.sky,
  cyan: tonesLight.cyan,
} as const;

// ──────────────────────────────────────────────────────────────────────
// Typography — Edition VI font family names match the fonts registered
// in `app/_layout.tsx` via @expo-google-fonts. Use these in StyleSheets:
//
//   title: { fontFamily: theme.typography.display, fontSize: 28 }
//   italic: { fontFamily: theme.typography.displayItalic }
//
// When a screen is on NativeWind, prefer the tailwind classes
// (`font-display`, `font-sans`, `font-mono`) — they resolve to the same
// registered family names from `tailwind.config.ts`.
// ──────────────────────────────────────────────────────────────────────
const typography = {
  display: "Fraunces",
  displayLight: "Fraunces-Light",
  displayMedium: "Fraunces-Medium",
  displayItalic: "Fraunces-Italic",
  displayLightItalic: "Fraunces-LightItalic",
  sans: "Geist",
  sansLight: "Geist-Light",
  sansMedium: "Geist-Medium",
  sansSemiBold: "Geist-SemiBold",
  sansBold: "Geist-Bold",
  mono: "GeistMono",
  monoMedium: "GeistMono-Medium",
} as const;

export const theme = {
  colors: darkColors,
  spacing: tokenSpacing,
  radius: tokenRadii,
  shadow: shadowsMobile,
  typography,
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
export function themeForScheme(scheme: "light" | "dark" | null | undefined): Theme {
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
  return themeForScheme(scheme);
}
