import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef, type ReactNode } from "react";
import { Appearance, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthStore } from "@/lib/auth-store";
import {
  brandColors,
  borderDark,
  borderLight,
  glassDark,
  glassLight,
  gradients,
  roseScale,
  semanticColors,
  semanticColorsLight,
  surfaceDark,
  surfaceLight,
  textDark,
  textLight,
  tonesDark,
  tonesLight,
  spacing as tokenSpacing,
  radii as tokenRadii,
  shadowsMobile,
} from "@locateflow/shared";

// ──────────────────────────────────────────────────────────────────────
// Dual-palette theming + user-controlled appearance preference.
//
// Token source of truth: packages/shared/src/design-tokens.ts. The
// palette objects below consume those tokens directly — changing a
// brand color in shared/design-tokens.ts flows through to every screen
// without a codemod.
//
// Two surfaces are exposed:
//   1. Static `theme` / `lightTheme` exports — backwards-compatible with
//      every existing `import { theme } from "@/lib/theme"` call site.
//      `theme` resolves to the dark palette; `lightTheme` to the light
//      palette. These do not change at runtime.
//   2. `ThemeProvider` + `useAppTheme()` + `useThemePreference()` —
//      a Context-driven layer that exposes a stored preference
//      ("system" | "light" | "dark") plus a resolved scheme that the
//      Settings screen can read and update. Components opting into the
//      new system get live theme switching; components still on the
//      static `theme` import keep rendering the dark palette until
//      next reload (the gradual-migration tradeoff documented below).
//
// Persistence: the user preference is persisted in AsyncStorage under
// `locateflow.theme.preference`. Default is "dark" so a fresh install starts on the source-theme canvas.
// When the preference is "system", `Appearance.addChangeListener`
// reacts to OS theme flips immediately.
// ──────────────────────────────────────────────────────────────────────

// Canonical Aurora accents from shared design tokens.
// Dark follows the source theme's Gold accent; light follows its Sapphire accent.
const ACCENT_DARK = brandColors.rose;
const ACCENT_DARK_LIGHT = brandColors.roseLight;
const ACCENT_DARK_DEEP = brandColors.roseDeep;
const ACCENT_LIGHT = roseScale[500];
const ACCENT_LIGHT_LIGHT = roseScale[400];
const ACCENT_LIGHT_DEEP = roseScale[700];
const FOIL_DARK = brandColors.foil;
const FOIL_LIGHT = roseScale[500];

const LIGHT_GRADIENTS = {
  primary: ["#3D74C8", "#2E5FB0"] as const,
  warm: ["#3D74C8", "#2E5FB0"] as const,
  glow: ["rgba(46, 95, 176, 0.22)", "rgba(55, 194, 201, 0.10)"] as const,
};

const darkColors = {
  primary: ACCENT_DARK,
  primaryLight: ACCENT_DARK_LIGHT,
  primaryDark: ACCENT_DARK_DEEP,
  primaryFaded: tonesDark.orange.bg,
  accent: FOIL_DARK,

  success: semanticColors.success,
  successFaded: semanticColors.successLight,
  warning: semanticColors.warning,
  warningFaded: semanticColors.warningLight,
  error: semanticColors.danger,
  errorFaded: semanticColors.dangerLight,
  info: semanticColors.info,
  infoFaded: semanticColors.infoLight,

  background: surfaceDark.background,
  surface: surfaceDark.surface,
  card: surfaceDark.card,
  cardHover: surfaceDark.cardHover,
  elevated: surfaceDark.elevated,

  border: borderDark.default,
  borderLight: borderDark.strong,
  borderFocus: borderDark.focus,

  glass: {
    bg: glassDark.bg,
    border: glassDark.border,
    highlight: glassDark.hover,
  },

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
    primary: gradients.primary,
    warm: gradients.warm,
    glow: gradients.glow,
  },

  // Back-compat aliases for older mobile components.
  bg2: surfaceDark.surface,
  surface2: surfaceDark.cardHover,
  surface3: surfaceDark.elevated,
  dim: textDark.secondary,
  faint: textDark.muted,
  onAccent: surfaceDark.background,
  accentSoft: tonesDark.foil.bg,
  accentBorder: tonesDark.foil.border,
  green: semanticColors.success,
  red: semanticColors.danger,
  amberSolid: semanticColors.warning,
  teal: semanticColors.info,
  amberSoft: semanticColors.warningLight,
  amberLine: tonesDark.foil.border,
  redSoft: semanticColors.dangerLight,
  redLine: tonesDark.rose.border,
  track: "rgba(255, 255, 255, 0.07)",
  handle: "rgba(255, 255, 255, 0.18)",
  glassPane: "rgba(6, 10, 18, 0.62)",
  heroGrad: [surfaceDark.card, surfaceDark.background] as readonly [string, string],
  mapBg: [surfaceDark.surface, surfaceDark.background] as readonly [string, string],
  mapGrid: borderDark.default,
  mapRouteBase: borderDark.strong,
  raccoon: {
    head: "#8C9AB2",
    mask: "#0C1525",
    ear: "#C4A090",
    pupil: "#04080F",
    eye: ACCENT_DARK,
  },
} as const;

// Light palette — LocateFlow Sapphire paper (Edition VIII), Aurora ink-1 text.
const lightColors = {
  ...darkColors,

  // Light scope mirrors the shared Aurora paper palette.
  primary: ACCENT_LIGHT,
  primaryLight: ACCENT_LIGHT_LIGHT,
  primaryDark: ACCENT_LIGHT_DEEP,
  accent: FOIL_LIGHT,
  primaryFaded: tonesLight.orange.bg,

  success: semanticColorsLight.success,
  successFaded: semanticColorsLight.successLight,
  warning: semanticColorsLight.warning,
  warningFaded: semanticColorsLight.warningLight,
  error: semanticColorsLight.danger,
  errorFaded: semanticColorsLight.dangerLight,
  info: semanticColorsLight.info,
  infoFaded: semanticColorsLight.infoLight,

  background: surfaceLight.background,
  surface: surfaceLight.surface,
  card: surfaceLight.surface,
  cardHover: surfaceLight.cardHover,
  elevated: surfaceLight.elevated,

  border: borderLight.default,
  borderLight: borderLight.strong,
  borderFocus: borderLight.focus,

  glass: {
    bg: glassLight.bg,
    border: glassLight.border,
    highlight: glassLight.hover,
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

  gradient: {
    primary: LIGHT_GRADIENTS.primary,
    warm: LIGHT_GRADIENTS.warm,
    glow: LIGHT_GRADIENTS.glow,
  },

  // Back-compat aliases for older mobile components.
  bg2: surfaceLight.card,
  surface2: surfaceLight.cardHover,
  surface3: surfaceLight.elevated,
  dim: textLight.secondary,
  faint: textLight.muted,
  onAccent: "#FFFFFF",
  accentSoft: tonesLight.foil.bg,
  accentBorder: tonesLight.foil.border,
  green: semanticColorsLight.success,
  red: semanticColorsLight.danger,
  amberSolid: semanticColorsLight.warning,
  teal: semanticColorsLight.info,
  amberSoft: semanticColorsLight.warningLight,
  amberLine: tonesLight.foil.border,
  redSoft: semanticColorsLight.dangerLight,
  redLine: tonesLight.rose.border,
  track: "rgba(0, 0, 0, 0.08)",
  handle: "rgba(0, 0, 0, 0.14)",
  glassPane: glassLight.bg,
  heroGrad: [surfaceLight.surface, surfaceLight.background] as readonly [string, string],
  mapBg: [surfaceLight.card, surfaceLight.cardHover] as readonly [string, string],
  mapGrid: borderLight.default,
  mapRouteBase: borderLight.strong,
  raccoon: {
    head: "#7E8EA6",
    mask: "#0F1D2D",
    ear: "#C4A090",
    pupil: "#06101E",
    eye: ACCENT_LIGHT,
  },
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

/**
 * Mobile type faces — explicit font-family constants for use in
 * StyleSheet `fontFamily`. React Native maps a weight to a *distinct*
 * loaded font file, so pick the exact constant rather than relying on
 * `fontWeight`. Playfair Display = serif/display, DM Sans = UI, DM Mono =
 * numerals/meta. These match the families loaded in app/_layout.tsx.
 */
export const fonts = {
  serif: "PlayfairDisplay_700Bold",
  serifSemibold: "PlayfairDisplay_600SemiBold",
  serifBold: "PlayfairDisplay_800ExtraBold",
  serifBlack: "PlayfairDisplay_900Black",
  serifItalic: "PlayfairDisplay_700Bold_Italic",
  sans: "DMSans_400Regular",
  sansMedium: "DMSans_500Medium",
  sansSemibold: "DMSans_600SemiBold",
  sansBold: "DMSans_700Bold",
  mono: "DMMono_400Regular",
  monoMedium: "DMMono_500Medium",
} as const;

/** Explicit opt-in: resolve a palette by name. */
export function themeForScheme(scheme: "light" | "dark" | "unspecified" | null | undefined): Theme {
  return scheme === "light" ? lightTheme : theme;
}

// ──────────────────────────────────────────────────────────────────────
// Appearance preference + Provider
// ──────────────────────────────────────────────────────────────────────

/**
 * Three-state user preference. `system` = follow the OS color scheme;
 * `light` / `dark` = force a specific palette regardless of the OS.
 */
export type ThemePreference = "system" | "light" | "dark";

/** What the app is actually rendering once `system` has been resolved. */
export type ResolvedScheme = "light" | "dark";

// ──────────────────────────────────────────────────────────────────────
// Plan accent theming — RETIRED
//
// Plan palette is currently a pass-through: shared Aurora tokens define
// the app-wide accent system, while plan-specific treatment stays in
// dedicated billing/upgrade components.
// `applyPlanPalette` is kept as a pass-through so existing callers
// (e.g. ThemeProvider) don't need to change.
// ──────────────────────────────────────────────────────────────────────

export function applyPlanPalette(
  base: Theme,
  _scheme: ResolvedScheme,
  _plan: string | null | undefined,
): Theme {
  return base;
}

const STORAGE_KEY = "locateflow.theme.preference";

const ALL_PREFERENCES: ReadonlyArray<ThemePreference> = ["system", "light", "dark"];

function isPreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && (ALL_PREFERENCES as readonly string[]).includes(value);
}

interface ThemeContextValue {
  /** User-selected preference. `system` is the default. */
  preference: ThemePreference;
  /** What the app is currently rendering. */
  resolvedScheme: ResolvedScheme;
  /** Active palette / spacing / radius / shadow tokens. */
  theme: Theme;
  /** Convenience access to the active color object. */
  colors: Theme["colors"];
  /** Persist a new preference and apply it immediately. */
  setPreference: (next: ThemePreference) => Promise<void>;
  /** True until the stored preference has been read from disk. */
  hydrated: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
  /** Optional override used by tests. Real callers should not pass this. */
  initialPreference?: ThemePreference;
}

/**
 * Wraps the app and exposes the theme preference + resolved scheme via
 * Context. Mount this once at the root of the navigation tree (above
 * the `<Stack />`).
 *
 * Hydration order:
 *   1. First render returns `system` + the OS color scheme so the very
 *      first frame already matches the device — no flash of wrong palette.
 *   2. AsyncStorage read happens in `useEffect`; once it returns, any
 *      stored preference replaces the default.
 *   3. When `preference === "system"`, an `Appearance.addChangeListener`
 *      reacts to OS theme flips and re-renders consumers.
 */
export function ThemeProvider({ children, initialPreference }: ThemeProviderProps) {
  const systemScheme = useColorScheme();

  const [preference, setPreferenceState] = useState<ThemePreference>(
    initialPreference ?? "dark",
  );
  const [hydrated, setHydrated] = useState<boolean>(initialPreference !== undefined);
  // Mirrors `Appearance.getColorScheme()` so we react to OS-level flips
  // even when `useColorScheme()` cache lags during foreground transitions.
  const [systemAppearanceScheme, setSystemAppearanceScheme] = useState<ResolvedScheme>(() => {
    const initial = Appearance.getColorScheme();
    return initial === "light" ? "light" : "dark";
  });
  const hydratedRef = useRef(initialPreference !== undefined);

  // 1) Hydrate the stored preference. Best-effort; on failure we keep
  //    the default `system`.
  useEffect(() => {
    if (hydratedRef.current) return;
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled) return;
        if (isPreference(raw)) {
          setPreferenceState(raw);
        }
        setHydrated(true);
        hydratedRef.current = true;
      })
      .catch(() => {
        if (cancelled) return;
        setHydrated(true);
        hydratedRef.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 2) Listen for OS-level theme changes so `system` reacts in real time.
  //    `useColorScheme()` already triggers a re-render but
  //    `Appearance.addChangeListener` is the documented event source —
  //    we keep both in sync to avoid stale reads on Android cold-foreground.
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemAppearanceScheme(colorScheme === "light" ? "light" : "dark");
    });
    return () => subscription.remove();
  }, []);

  const resolvedScheme: ResolvedScheme = useMemo(() => {
    if (preference === "light") return "light";
    if (preference === "dark") return "dark";
    // `system`: prefer the React hook (re-renders synchronously on
    // change), fall back to the Appearance API mirror.
    if (systemScheme === "light" || systemScheme === "dark") return systemScheme;
    return systemAppearanceScheme;
  }, [preference, systemScheme, systemAppearanceScheme]);

  const planTier = useAuthStore((s) => s.planTier);
  const activeTheme = useMemo<Theme>(
    () => applyPlanPalette(resolvedScheme === "light" ? lightTheme : theme, resolvedScheme, planTier),
    [resolvedScheme, planTier],
  );

  const setPreference = useCallback(async (next: ThemePreference) => {
    if (!isPreference(next)) return;
    setPreferenceState(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Best-effort persistence; the in-memory state is already updated
      // so the user sees the change. We accept a transient mismatch on
      // app restart if the disk write fails.
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      resolvedScheme,
      theme: activeTheme,
      colors: activeTheme.colors,
      setPreference,
      hydrated,
    }),
    [preference, resolvedScheme, activeTheme, setPreference, hydrated],
  );

  return React.createElement(ThemeContext.Provider, { value }, children);
}

/**
 * React hook that returns the active theme and lets the caller flip
 * between palettes via `setPreference`. Reads from `ThemeProvider`
 * context — falls back to a `system`-resolved palette if the provider
 * is missing so individual screens can't crash in a dev preview.
 */
export function useThemePreference(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx;

  // Fallback so screens hosted outside the provider (e.g. early splash
  // before the root layout mounts) still render meaningful values.
  const scheme = Appearance.getColorScheme();
  const resolved: ResolvedScheme = scheme === "light" ? "light" : "dark";
  const fallbackTheme = resolved === "light" ? lightTheme : theme;
  return {
    preference: "system",
    resolvedScheme: resolved,
    theme: fallbackTheme,
    colors: fallbackTheme.colors,
    setPreference: async () => {
      // No-op without a provider — surface this in __DEV__ so it's caught.
      if (__DEV__) {
        console.warn("[theme] setPreference called without a ThemeProvider mounted.");
      }
    },
    hydrated: true,
  };
}

/**
 * Convenience hook — the active palette only. Drop-in replacement for
 * `import { theme }` when a component needs to react to user theme
 * changes. Identical structure to the static `theme` export so call
 * sites can switch a single import.
 *
 *   const t = useAppTheme();
 *   <View style={{ backgroundColor: t.colors.background }} />
 */
export function useAppTheme(): Theme {
  return useThemePreference().theme;
}

/**
 * Hook + factory pattern used throughout the mobile codebase to make
 * `StyleSheet.create` actually react to theme changes.
 *
 * `StyleSheet.create` runs once at module-import time, so a value like
 * `backgroundColor: theme.colors.background` is captured against the
 * static dark palette at first load and never refreshes. Wrapping the
 * factory in this hook re-runs `StyleSheet.create` whenever the
 * resolved theme changes, so the rendered styles flip with the user's
 * Appearance preference.
 *
 *   const makeStyles = (t: Theme) => StyleSheet.create({
 *     container: { backgroundColor: t.colors.background },
 *   });
 *
 *   function Screen() {
 *     const styles = useThemedStyles(makeStyles);
 *     return <View style={styles.container} />;
 *   }
 */
export function useThemedStyles<T>(factory: (t: Theme) => T): T {
  const t = useAppTheme();
  return React.useMemo(() => factory(t), [factory, t]);
}

/**
 * Synchronous getter for non-component code (e.g. navigation theme
 * factories that run before the first render). Reads the OS color
 * scheme directly — does not see the user's stored preference.
 */
export function getInitialTheme(): Theme {
  const scheme = Appearance.getColorScheme();
  return scheme === "light" ? lightTheme : theme;
}

/** Storage key — exported so tests / migration tooling can use it. */
export const THEME_PREFERENCE_STORAGE_KEY = STORAGE_KEY;
