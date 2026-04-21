/**
 * LocateFlow canonical design tokens.
 *
 * Single source of truth for colors, typography, spacing, radii, and
 * shadows across web, admin, and mobile. Derived from the handoff
 * bundle in `docs/design-system/` (see `colors_and_type.css` and
 * `README.md`). Consumers:
 *
 *   - `apps/web/tailwind.config.ts` / `apps/admin/tailwind.config.ts`
 *     extend their `theme.colors`, `theme.fontSize`, `theme.spacing`,
 *     `theme.borderRadius` via `tokens.*`. Shadcn HSL variables
 *     (`--primary`, `--card`, …) continue to drive Tailwind — the
 *     tokens here populate the *brand* namespace alongside them
 *     (e.g. `text-brand-orange`, `bg-tone-emerald-bg`).
 *
 *   - `apps/mobile/src/lib/theme.ts` imports `tokens.colors.tones`,
 *     `tokens.spacing`, `tokens.radius`, `tokens.shadow.glow` so the
 *     mobile palette stays in lockstep with the brand when the design
 *     evolves.
 *
 *   - `apps/web/src/styles/globals.css` mirrors these values as CSS
 *     custom properties under the `--brand-*`, `--orange-*`,
 *     `--tone-*`, `--fs-*`, `--tracking-*` namespaces — non-Tailwind
 *     contexts (raw CSS, email templates, MDX) can use them directly.
 *
 * Changing a value here propagates to all three surfaces. Do NOT add
 * new tokens without updating the brand doc in
 * `docs/design-system/README.md`.
 */

// ────────────────────────────────────────────────────────────────────
// Brand palette
// ────────────────────────────────────────────────────────────────────

export const brandColors = {
  orange: "#F97316", // primary — orange-500
  orangeLight: "#FB923C", // orange-400
  orangeDark: "#EA580C", // orange-600
  amber: "#FBBF24", // secondary / accent — amber-400
} as const;

/** The orange scale used directly by mobile and as custom-property fallbacks on web. */
export const orangeScale = {
  50: "#fff7ed",
  100: "#ffedd5",
  200: "#fed7aa",
  300: "#fdba74",
  400: "#fb923c",
  500: "#f97316",
  600: "#ea580c",
  700: "#c2410c",
  800: "#9a3412",
  900: "#7c2d12",
} as const;

// ────────────────────────────────────────────────────────────────────
// Surfaces — dark-first; light-mode equivalents on the `.light` side
// ────────────────────────────────────────────────────────────────────

export const surfaceDark = {
  background: "#0a0a0f",
  surface: "#12121a",
  card: "#1a1a25",
  cardHover: "#22222f",
  elevated: "#252530",
} as const;

export const surfaceLight = {
  background: "#ffffff",
  surface: "#f8fafc",
  card: "#ffffff",
  cardHover: "#f1f5f9",
  elevated: "#f8fafc",
} as const;

// ────────────────────────────────────────────────────────────────────
// Foreground / text — alpha layers on top of the surface
// ────────────────────────────────────────────────────────────────────

export const textDark = {
  primary: "rgba(255, 255, 255, 1)",
  secondary: "rgba(255, 255, 255, 0.70)",
  tertiary: "rgba(255, 255, 255, 0.45)",
  muted: "rgba(255, 255, 255, 0.20)",
} as const;

export const textLight = {
  primary: "rgba(15, 23, 42, 1)",
  secondary: "rgba(15, 23, 42, 0.75)",
  tertiary: "rgba(15, 23, 42, 0.50)",
  muted: "rgba(15, 23, 42, 0.30)",
} as const;

// ────────────────────────────────────────────────────────────────────
// Borders — alpha, never opaque
// ────────────────────────────────────────────────────────────────────

export const borderDark = {
  default: "rgba(255, 255, 255, 0.08)",
  strong: "rgba(255, 255, 255, 0.12)",
  focus: "rgba(249, 115, 22, 0.50)",
} as const;

export const borderLight = {
  default: "rgba(15, 23, 42, 0.08)",
  strong: "rgba(15, 23, 42, 0.12)",
  focus: "rgba(234, 88, 12, 0.50)",
} as const;

// ────────────────────────────────────────────────────────────────────
// Semantic colors (apply to both palettes)
// ────────────────────────────────────────────────────────────────────

export const semanticColors = {
  success: "#10b981",
  successLight: "#d1fae5",
  warning: "#f59e0b",
  warningLight: "#fef3c7",
  danger: "#ef4444",
  dangerLight: "#fee2e2",
  info: "#3b82f6",
  infoLight: "#dbeafe",
} as const;

// ────────────────────────────────────────────────────────────────────
// Tonal pairs — stat cards, category chips, service-type indicators.
// Every tone ships as a {bg, border, text} triplet. Do not invent new
// tones — pick from the six.
// ────────────────────────────────────────────────────────────────────

export const tonesDark = {
  orange: {
    bg: "rgba(249, 115, 22, 0.10)",
    border: "rgba(249, 115, 22, 0.20)",
    text: "#fb923c",
  },
  emerald: {
    bg: "rgba(16, 185, 129, 0.10)",
    border: "rgba(16, 185, 129, 0.20)",
    text: "#6ee7b7",
  },
  amber: {
    bg: "rgba(245, 158, 11, 0.10)",
    border: "rgba(245, 158, 11, 0.20)",
    text: "#fcd34d",
  },
  rose: {
    bg: "rgba(244, 63, 94, 0.10)",
    border: "rgba(244, 63, 94, 0.20)",
    text: "#fda4af",
  },
  sky: {
    bg: "rgba(14, 165, 233, 0.10)",
    border: "rgba(14, 165, 233, 0.20)",
    text: "#7dd3fc",
  },
  cyan: {
    bg: "rgba(6, 182, 212, 0.10)",
    border: "rgba(6, 182, 212, 0.20)",
    text: "#67e8f9",
  },
} as const;

export const tonesLight = {
  orange: {
    bg: "rgba(249, 115, 22, 0.08)",
    border: "rgba(249, 115, 22, 0.25)",
    text: "#c2410c",
  },
  emerald: {
    bg: "rgba(16, 185, 129, 0.08)",
    border: "rgba(16, 185, 129, 0.25)",
    text: "#047857",
  },
  amber: {
    bg: "rgba(245, 158, 11, 0.08)",
    border: "rgba(245, 158, 11, 0.25)",
    text: "#b45309",
  },
  rose: {
    bg: "rgba(244, 63, 94, 0.08)",
    border: "rgba(244, 63, 94, 0.25)",
    text: "#be123c",
  },
  sky: {
    bg: "rgba(14, 165, 233, 0.08)",
    border: "rgba(14, 165, 233, 0.25)",
    text: "#0369a1",
  },
  cyan: {
    bg: "rgba(6, 182, 212, 0.08)",
    border: "rgba(6, 182, 212, 0.25)",
    text: "#0e7490",
  },
} as const;

export type ToneKey = keyof typeof tonesDark;

// ────────────────────────────────────────────────────────────────────
// Glass — used on landing, modals, elevated chrome
// ────────────────────────────────────────────────────────────────────

export const glassDark = {
  bg: "rgba(255, 255, 255, 0.05)",
  border: "rgba(255, 255, 255, 0.10)",
  hover: "rgba(255, 255, 255, 0.10)",
} as const;

export const glassLight = {
  bg: "rgba(255, 255, 255, 0.70)",
  border: "rgba(0, 0, 0, 0.08)",
  hover: "rgba(0, 0, 0, 0.04)",
} as const;

// ────────────────────────────────────────────────────────────────────
// Gradients — reserved for brand moments (hero CTA, premium affordances)
// ────────────────────────────────────────────────────────────────────

export const gradients = {
  primary: ["#F97316", "#FBBF24"] as const, // orange → amber
  warm: ["#EA580C", "#F97316"] as const, // deeper → brand
  glow: ["rgba(249, 115, 22, 0.40)", "rgba(251, 191, 36, 0.10)"] as const,
} as const;

// ────────────────────────────────────────────────────────────────────
// Radii — applies to both palettes
// ────────────────────────────────────────────────────────────────────

export const radii = {
  sm: 8,
  md: 12, // default shadcn --radius
  lg: 16,
  xl: 20,
  "2xl": 24,
  full: 9999,
} as const;

// ────────────────────────────────────────────────────────────────────
// Spacing — 4 px rhythm (xs..4xl)
// ────────────────────────────────────────────────────────────────────

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
} as const;

// ────────────────────────────────────────────────────────────────────
// Shadows — mobile uses structured values; web maps to box-shadow strings
// ────────────────────────────────────────────────────────────────────

export const shadowsMobile = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  /**
   * Orange glow — reserved for premium / active affordances.
   * Don't spray it on normal cards (see brand doc).
   */
  glow: {
    shadowColor: "#F97316",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;

export const shadowsWeb = {
  sm: "0 1px 2px rgba(0, 0, 0, 0.2)",
  md: "0 2px 4px rgba(0, 0, 0, 0.25)",
  lg: "0 4px 8px rgba(0, 0, 0, 0.3)",
  xl: "0 10px 40px rgba(0, 0, 0, 0.5)",
  glow: "0 0 12px rgba(249, 115, 22, 0.30)",
} as const;

// ────────────────────────────────────────────────────────────────────
// Typography — Inter everywhere, JetBrains Mono for admin chrome
// ────────────────────────────────────────────────────────────────────

export const fontFamilies = {
  sans: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  mono: '"JetBrains Mono", Consolas, "Courier New", monospace',
} as const;

/** Font size scale — matches the brand doc type table. */
export const fontSizes = {
  xs: 11, // captions, kbd hints
  sm: 12, // labels, stat labels, meta
  base: 14, // default body, buttons
  md: 15, // quick-action labels
  lg: 16, // body lead
  xl: 18, // section headings in-app
  "2xl": 22, // card titles
  "3xl": 28, // dashboard h1, stat values
  display: 40, // marketing h2
  "display-lg": 60, // landing hero h1
} as const;

export const fontWeights = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  black: 800,
} as const;

export const lineHeights = {
  tight: 1.1,
  snug: 1.25,
  normal: 1.5,
  relaxed: 1.65,
} as const;

export const letterSpacing = {
  tight: "-0.02em",
  normal: "0",
  wide: "0.02em",
} as const;

// ────────────────────────────────────────────────────────────────────
// Consolidated export — callers usually want the full bundle
// ────────────────────────────────────────────────────────────────────

export const tokens = {
  brand: brandColors,
  orange: orangeScale,
  surface: { dark: surfaceDark, light: surfaceLight },
  text: { dark: textDark, light: textLight },
  border: { dark: borderDark, light: borderLight },
  glass: { dark: glassDark, light: glassLight },
  semantic: semanticColors,
  tones: { dark: tonesDark, light: tonesLight },
  gradients,
  radii,
  spacing,
  shadows: { mobile: shadowsMobile, web: shadowsWeb },
  typography: {
    families: fontFamilies,
    sizes: fontSizes,
    weights: fontWeights,
    lineHeights,
    letterSpacing,
  },
} as const;

export type DesignTokens = typeof tokens;
