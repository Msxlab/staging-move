import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef, type ReactNode } from "react";
import { Appearance, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthStore } from "@/lib/auth-store";
import {
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
// `locateflow.theme.preference`. Default is "system" (follow the OS).
// When the preference is "system", `Appearance.addChangeListener`
// reacts to OS theme flips immediately.
// ──────────────────────────────────────────────────────────────────────

// Sapphire accent — the single uniform brand accent (Move design).
const ACCENT_DARK = "#5B8DEF";
const ACCENT_DARK_LIGHT = "#83AAF5";
const ACCENT_DARK_DEEP = "#3D6FD6";
const ACCENT_LIGHT = "#2E5FB0";
const ACCENT_LIGHT_LIGHT = "#3D74C8";
const ACCENT_LIGHT_DEEP = "#244C90";

const darkColors = {
  primary: ACCENT_DARK, // Sapphire #5B8DEF
  primaryLight: ACCENT_DARK_LIGHT, // #83AAF5
  primaryDark: ACCENT_DARK_DEEP, // #3D6FD6
  primaryFaded: "rgba(91, 141, 239, 0.12)",
  accent: ACCENT_DARK, // single accent — no separate honey accent

  success: "#54CB7E", // Move green
  successFaded: "rgba(84, 203, 126, 0.14)",
  warning: "#E0A85A", // Move amber
  warningFaded: "rgba(224, 168, 90, 0.16)",
  error: "#E25C5C", // Move red
  errorFaded: "rgba(226, 92, 92, 0.16)",
  info: "#37C2C9", // Move teal
  infoFaded: "rgba(55, 194, 201, 0.14)",

  background: "#0A0F1C", // Move bg
  surface: "#121B2D", // Move surface (cards)
  card: "#121B2D",
  cardHover: "#18233A", // surface2
  elevated: "#1F2C47", // surface3

  border: "rgba(110, 150, 225, 0.10)",
  borderLight: "rgba(255, 255, 255, 0.10)",
  borderFocus: "rgba(91, 141, 239, 0.55)",

  glass: {
    bg: "rgba(255, 255, 255, 0.03)",
    border: "rgba(255, 255, 255, 0.05)",
    highlight: "rgba(255, 255, 255, 0.08)",
  },

  text: "#EFF3FA", // Move text
  textSecondary: "#8A99B6", // dim
  textTertiary: "#42526F", // faint
  textMuted: "#42526F",

  orange: tonesDark.orange,
  emerald: tonesDark.emerald,
  amber: tonesDark.amber,
  rose: tonesDark.rose,
  sky: tonesDark.sky,
  cyan: tonesDark.cyan,

  gradient: {
    primary: ["#83AAF5", "#5B8DEF"] as readonly [string, string],
    warm: ["#3D6FD6", "#5B8DEF"] as readonly [string, string],
    glow: ["rgba(91, 141, 239, 0.40)", "rgba(91, 141, 239, 0.10)"] as readonly [string, string],
  },

  // ── Move design additions ───────────────────────────────────────────
  bg2: "#0C1322",
  surface2: "#18233A",
  surface3: "#1F2C47",
  dim: "#8A99B6",
  faint: "#42526F",
  onAccent: "#0A0F1C",
  accentSoft: "rgba(91, 141, 239, 0.09)",
  accentBorder: "rgba(91, 141, 239, 0.22)",
  green: "#54CB7E",
  red: "#E25C5C",
  amberSolid: "#E0A85A",
  teal: "#37C2C9",
  amberSoft: "rgba(224, 168, 90, 0.16)",
  amberLine: "rgba(224, 168, 90, 0.24)",
  redSoft: "rgba(226, 92, 92, 0.16)",
  redLine: "rgba(226, 92, 92, 0.22)",
  track: "rgba(255, 255, 255, 0.07)",
  handle: "rgba(255, 255, 255, 0.18)",
  glassPane: "rgba(6, 11, 24, 0.62)",
  heroGrad: ["#141C30", "#0C1220"] as readonly [string, string],
  mapBg: ["#0d1830", "#0a1120"] as readonly [string, string],
  mapGrid: "rgba(255, 255, 255, 0.06)",
  mapRouteBase: "rgba(255, 255, 255, 0.10)",
  raccoon: {
    head: "#8C9AB2",
    mask: "#0C1525",
    ear: "#C4A090",
    pupil: "#04080F",
    eye: ACCENT_DARK,
  },
} as const;

// Light palette — Aurora cool paper (Edition VII), Aurora ink-1 text.
const lightColors = {
  ...darkColors,

  // Move light scope — warm greige paper, Sapphire accent darkened for AA
  // contrast on the soft paper surface.
  primary: ACCENT_LIGHT, // #2E5FB0
  primaryLight: ACCENT_LIGHT_LIGHT, // #3D74C8
  primaryDark: ACCENT_LIGHT_DEEP, // #244C90
  accent: ACCENT_LIGHT,
  primaryFaded: "rgba(46, 95, 176, 0.10)",

  success: "#1C8A63",
  successFaded: "rgba(28, 138, 99, 0.12)",
  warning: "#A9761E",
  warningFaded: "rgba(169, 118, 30, 0.12)",
  error: "#C73838",
  errorFaded: "rgba(199, 56, 56, 0.12)",
  info: "#168E9C",
  infoFaded: "rgba(22, 142, 156, 0.12)",

  background: "#EFEADF", // greige paper
  surface: "#FFFFFF",
  card: "#FFFFFF",
  cardHover: "#F5F0E7", // surface2
  elevated: "#ECE6DA", // surface3

  border: "rgba(16, 29, 45, 0.10)",
  borderLight: "rgba(16, 29, 45, 0.14)",
  borderFocus: "rgba(46, 95, 176, 0.55)",

  glass: {
    bg: "rgba(255, 255, 255, 0.55)",
    border: "rgba(20, 32, 47, 0.06)",
    highlight: "rgba(20, 32, 47, 0.04)",
  },

  text: "#101D2D",
  textSecondary: "#48566C", // dim
  textTertiary: "#8794AC", // faint
  textMuted: "#8794AC",

  orange: tonesLight.orange,
  emerald: tonesLight.emerald,
  amber: tonesLight.amber,
  rose: tonesLight.rose,
  sky: tonesLight.sky,
  cyan: tonesLight.cyan,

  gradient: {
    primary: ["#3D74C8", "#2E5FB0"] as readonly [string, string],
    warm: ["#244C90", "#2E5FB0"] as readonly [string, string],
    glow: ["rgba(46, 95, 176, 0.30)", "rgba(46, 95, 176, 0.10)"] as readonly [string, string],
  },

  // ── Move design additions (light) ───────────────────────────────────
  bg2: "#E7E1D4",
  surface2: "#F5F0E7",
  surface3: "#ECE6DA",
  dim: "#48566C",
  faint: "#8794AC",
  onAccent: "#FFFFFF",
  accentSoft: "rgba(46, 95, 176, 0.10)",
  accentBorder: "rgba(46, 95, 176, 0.26)",
  green: "#1C8A63",
  red: "#C73838",
  amberSolid: "#A9761E",
  teal: "#168E9C",
  amberSoft: "rgba(169, 118, 30, 0.12)",
  amberLine: "rgba(169, 118, 30, 0.22)",
  redSoft: "rgba(199, 56, 56, 0.12)",
  redLine: "rgba(199, 56, 56, 0.22)",
  track: "rgba(0, 0, 0, 0.08)",
  handle: "rgba(0, 0, 0, 0.14)",
  glassPane: "rgba(255, 255, 255, 0.72)",
  heroGrad: ["#FFFFFF", "#F4EFE5"] as readonly [string, string],
  mapBg: ["#dde6ef", "#cdd8e6"] as readonly [string, string],
  mapGrid: "rgba(12, 24, 40, 0.07)",
  mapRouteBase: "rgba(12, 24, 40, 0.12)",
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
 * Move design type faces — explicit font-family constants for use in
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
// The Move design ships a single uniform Sapphire accent for every plan;
// the whole app reads as one premium ("Pro-like") surface. The former
// per-plan tinting (Free coral / Family mint / Pro honey) was removed.
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
    initialPreference ?? "system",
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
