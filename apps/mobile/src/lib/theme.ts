import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef, type ReactNode } from "react";
import { Appearance, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthStore } from "@/lib/auth-store";
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

const darkColors = {
  primary: brandColors.orange,            // Aurora cool #7FB6E8
  primaryLight: brandColors.orangeLight,  // cool-light #A5C9F0
  primaryDark: brandColors.orangeDark,    // cool-2 #5C9DDC
  // Faded primary — Aurora cool at 12%. Keeps key faded surfaces
  // (active-plan chip, hero ring) on the cool palette.
  primaryFaded: "rgba(127, 182, 232, 0.12)",
  accent: brandColors.amber,              // honey/champagne foil #F2C46C

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

  // Brand accents darkened on paper for AA contrast — mirrors web `.light`
  // (--rose #2D7BC4 / --foil #B0781E) and the design bundle's light scope.
  // Without these, light mode inherited the dark-mode bright blue/honey, which
  // fail contrast on the soft-sky paper surface.
  primary: "#2D7BC4", // paper cool blue
  primaryLight: "#4D8FCE",
  primaryDark: "#1F5FA0",
  accent: "#B0781E", // paper honey/champagne foil
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
// Per-plan accent theming (Family / Pro)
//
// Family and Pro members get a plan-tinted palette: the primary/accent
// hues + hero gradients shift while surfaces and text stay on the base
// scheme so contrast/readability are preserved. Individual (or unknown)
// plans render the base Aurora palette unchanged. The active plan is read
// from the auth store (set after the client resolves entitlement) and
// applied via `applyPlanPalette` inside `ThemeProvider`.
// ──────────────────────────────────────────────────────────────────────

type PlanAccentSet = {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  primaryFaded: string;
  gradPrimary: readonly [string, string];
  gradGlow: readonly [string, string];
};

// Canonical plan hexes from the Edition VII design handoff (additions.css):
// Free #FF9DB2/#E0567E · Individual = base cool blue (no entry) ·
// Family #4FD1B5/#1F9E78 · Pro #F2C46C/#B0781E. Per the handoff, plans
// retint ONLY the accent set — surfaces/cards/backgrounds stay on the base
// Aurora navy/paper so every plan shares one canvas (and honey stays
// reserved for premium moments rather than tinting whole screens).
const planAccents: Record<"FREE" | "FAMILY" | "PRO", Record<ResolvedScheme, PlanAccentSet>> = {
  // Free — candy coral/pink ("Start here"), deliberately distinct from the
  // paid accents so the upgrade path reads at a glance.
  FREE: {
    dark: {
      primary: "#FF9DB2",
      primaryLight: "#FFB9C8",
      primaryDark: "#F4799A",
      primaryFaded: "rgba(255, 157, 178, 0.12)",
      gradPrimary: ["#FFB9C8", "#FF9DB2"],
      gradGlow: ["rgba(255, 157, 178, 0.34)", "rgba(244, 121, 154, 0.10)"],
    },
    light: {
      primary: "#E0567E",
      primaryLight: "#E97B99",
      primaryDark: "#BC3E62",
      primaryFaded: "rgba(224, 86, 126, 0.10)",
      gradPrimary: ["#E97B99", "#E0567E"],
      gradGlow: ["rgba(224, 86, 126, 0.28)", "rgba(188, 62, 98, 0.10)"],
    },
  },
  // Family — teal/mint, luxury crystal green.
  FAMILY: {
    dark: {
      primary: "#4FD1B5",
      primaryLight: "#7FDFC9",
      primaryDark: "#2FB89C",
      primaryFaded: "rgba(79, 209, 181, 0.12)",
      gradPrimary: ["#7FDFC9", "#4FD1B5"],
      gradGlow: ["rgba(79, 209, 181, 0.40)", "rgba(47, 184, 156, 0.10)"],
    },
    light: {
      primary: "#1F9E78",
      primaryLight: "#2FB89C",
      primaryDark: "#16775A",
      primaryFaded: "rgba(31, 158, 120, 0.10)",
      gradPrimary: ["#2FB89C", "#1F9E78"],
      gradGlow: ["rgba(31, 158, 120, 0.30)", "rgba(47, 184, 156, 0.10)"],
    },
  },
  // Pro — premium honey / champagne foil (the brand's signature gold). Mirrors
  // web `.plan-pro` (--primary: 41 85% 68%) so Pro reads identically on every
  // surface.
  PRO: {
    dark: {
      primary: "#F2C46C",
      primaryLight: "#F9D88E",
      primaryDark: "#D99A4E",
      primaryFaded: "rgba(242, 196, 108, 0.12)",
      gradPrimary: ["#FBE7BD", "#F2C46C"],
      gradGlow: ["rgba(242, 196, 108, 0.40)", "rgba(217, 154, 78, 0.12)"],
    },
    light: {
      primary: "#B0781E",
      primaryLight: "#D99A4E",
      primaryDark: "#8A5E16",
      primaryFaded: "rgba(176, 120, 30, 0.10)",
      gradPrimary: ["#D99A4E", "#B0781E"],
      gradGlow: ["rgba(176, 120, 30, 0.30)", "rgba(217, 154, 78, 0.10)"],
    },
  },
};

/**
 * Returns the base theme tinted for the given plan. FREE / FAMILY / PRO shift
 * the primary accent + hero gradients; Individual (or unknown) returns the
 * base palette unchanged. Surfaces are never retinted — one Aurora canvas for
 * every plan. Cast through `unknown` because the base palette uses `as const`
 * literal types and the plan values are different literals of the same shape.
 */
export function applyPlanPalette(
  base: Theme,
  scheme: ResolvedScheme,
  plan: string | null | undefined,
): Theme {
  const key = (plan ?? "").toUpperCase();
  const accentSet =
    key === "FAMILY" ? planAccents.FAMILY
    : key === "PRO" ? planAccents.PRO
    : key.startsWith("FREE") ? planAccents.FREE
    : null;
  if (!accentSet) return base;
  const p = accentSet[scheme];
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: p.primary,
      primaryLight: p.primaryLight,
      primaryDark: p.primaryDark,
      primaryFaded: p.primaryFaded,
      gradient: {
        ...base.colors.gradient,
        primary: p.gradPrimary,
        glow: p.gradGlow,
      },
    },
  } as unknown as Theme;
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
