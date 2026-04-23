/**
 * LocateFlow canonical design tokens.
 *
 * Single source of truth for colors, typography, spacing, radii, and
 * shadows across web, admin, and mobile. Sourced from the handoff bundle
 * shipped under `LocateFlow Design System-handoff.zip` (Edition VI ·
 * Champagne & Rose). See the bundle's `colors_and_type.css` for the full
 * narrative.
 *
 * Naming note. The legacy `brand.orange` / `tones.orange` / `orange-N`
 * names are preserved on purpose: the codebase has hundreds of call sites
 * referencing them. The *values* now resolve to the rose/foil palette so
 * existing components inherit the new look without a codemod. New code
 * should prefer the semantic aliases (`brand.rose`, `tones.rose`,
 * `tones.foil`, etc.).
 *
 * Consumers:
 *   - `apps/web/tailwind.config.ts` / `apps/admin/tailwind.config.ts`
 *     extend their `theme.colors`, `theme.fontFamily`, etc. via
 *     `tokens.*`. Shadcn HSL variables (`--primary`, `--card`, …)
 *     continue to drive Tailwind — the tokens here populate the *brand*
 *     namespace alongside them.
 *   - `apps/mobile/src/lib/theme.ts` consumes `tokens.colors.tones`,
 *     `tokens.spacing`, `tokens.radius`, `tokens.shadow.glow`.
 *   - `apps/web/src/styles/globals.css` mirrors these as CSS custom
 *     properties under the `--brand-*`, `--orange-*`, `--rose-*`,
 *     `--foil-*`, `--tone-*`, `--fs-*`, `--tracking-*` namespaces.
 */

// ────────────────────────────────────────────────────────────────────
// Brand palette — Champagne & Rose
// ────────────────────────────────────────────────────────────────────

export const brandColors = {
  // Legacy names — kept so `brand.orange` references in code keep working.
  // Values now resolve to rose so the visual surface flips automatically.
  orange: "#D4846A", // primary — was #F97316
  orangeLight: "#EDB99D", // hover / soft glow — was #FB923C
  orangeDark: "#A85A42", // pressed — was #EA580C
  amber: "#E5C9A8", // secondary / accent (now flat foil) — was #FBBF24

  // Canonical Champagne & Rose names.
  rose: "#D4846A",
  roseLight: "#EDB99D",
  roseDeep: "#A85A42",
  roseDark: "#6A2E1C",
  foil: "#E5C9A8",
  foilHighlight: "#F4E4D0",
  foilShadow: "#B8936C",
  foilInk: "#8E6D4A",
  sage: "#5EAD9A",
  sageSoft: "#8FC9B7",
  nude: "#E5C9A8",
  nudeDeep: "#B8936C",
} as const;

/**
 * Rose scale — the "primary" scale. The legacy `orangeScale` export below
 * still resolves to *these* values so `bg-orange-500`, `text-orange-400`,
 * etc. flip palette without touching component code.
 */
export const roseScale = {
  50: "#FBF1ED",
  100: "#F6E0D6",
  200: "#EDC0AC",
  300: "#E5A287",
  400: "#DC8B6F",
  500: "#D4846A", // primary (the pin)
  600: "#BC6C53",
  700: "#A85A42", // pressed
  800: "#8A4630",
  900: "#6A2E1C", // wax-seal shadow
} as const;

/**
 * Foil scale — champagne highlight → body → shadow. Use as a flat color
 * when a gradient won't render (small chrome, SVG strokes); otherwise
 * prefer `gradients.foil`.
 */
export const foilScale = {
  highlight: "#F4E4D0", // foil-a
  body: "#E5C9A8", // foil-b (the flat-color use)
  shadow: "#B8936C", // foil-c
  ink: "#8E6D4A", // foil on paper
} as const;

/**
 * Legacy alias — `orangeScale` now points at the rose values. This means
 * Tailwind's `bg-orange-500` (which resolves to `var(--orange-500)` in
 * web/admin) renders rose. Mobile reads the same scale via the `primary`
 * extension in `apps/mobile/tailwind.config.ts`.
 */
export const orangeScale = roseScale;

// ────────────────────────────────────────────────────────────────────
// Surfaces — umber-near-black on dark, ivory paper on light
// ────────────────────────────────────────────────────────────────────

export const surfaceDark = {
  background: "#0E0A07", // umber-near-black, slightly warm
  surface: "#13100B", // cards
  card: "#181410", // card hover, input fill (was surface-2)
  cardHover: "#1F1A14", // active surface, menu hover (was surface-3)
  elevated: "#261F17", // popovers, dialogs
} as const;

export const surfaceLight = {
  background: "#FBF7EC", // ivory paper
  surface: "#FFFFFF",
  card: "#F7EEE3",
  cardHover: "#F0E4D2",
  elevated: "#FFFFFF",
} as const;

// ────────────────────────────────────────────────────────────────────
// Foreground / text — alpha layers on top of the surface
// ────────────────────────────────────────────────────────────────────

export const textDark = {
  primary: "#F5F1EA",
  secondary: "rgba(245, 241, 234, 0.62)",
  tertiary: "rgba(245, 241, 234, 0.38)",
  muted: "rgba(245, 241, 234, 0.20)",
} as const;

export const textLight = {
  primary: "#2A1F18",
  secondary: "rgba(42, 31, 24, 0.72)",
  tertiary: "rgba(42, 31, 24, 0.50)",
  muted: "rgba(42, 31, 24, 0.30)",
} as const;

// ────────────────────────────────────────────────────────────────────
// Borders — alpha, never opaque. Focus is always a rose ring.
// ────────────────────────────────────────────────────────────────────

export const borderDark = {
  default: "rgba(245, 241, 234, 0.08)",
  strong: "rgba(245, 241, 234, 0.14)",
  foil: "rgba(229, 201, 168, 0.22)", // hairline chrome
  rose: "rgba(212, 132, 106, 0.30)",
  focus: "rgba(212, 132, 106, 0.55)", // 2px outline on focus-visible
} as const;

export const borderLight = {
  default: "rgba(42, 31, 24, 0.08)",
  strong: "rgba(42, 31, 24, 0.14)",
  foil: "rgba(184, 147, 108, 0.30)",
  rose: "rgba(184, 90, 66, 0.30)",
  focus: "rgba(184, 90, 66, 0.55)",
} as const;

// ────────────────────────────────────────────────────────────────────
// Semantic colors — sage for success, dark honey for warning,
// warm-red for danger, dusted slate for info. All in the brand family.
// ────────────────────────────────────────────────────────────────────

export const semanticColors = {
  success: "#5EAD9A", // sage
  successLight: "rgba(94, 173, 154, 0.12)",
  warning: "#E3B04B", // dark honey
  warningLight: "rgba(227, 176, 75, 0.14)",
  danger: "#C85A3E", // warm red, one step deeper than rose
  dangerLight: "rgba(200, 90, 62, 0.14)",
  info: "#8AA9C0", // dusted slate
  infoLight: "rgba(138, 169, 192, 0.12)",
} as const;

// ────────────────────────────────────────────────────────────────────
// Tonal pairs — stat cards, category chips, service-type indicators.
// Six tones in the Edition VI vocabulary: rose, foil, sage, honey,
// umber, slate. The `orange/emerald/amber/sky/cyan` legacy tone names
// alias onto the closest new tones so existing UI keeps rendering.
// ────────────────────────────────────────────────────────────────────

const _tonesDarkCanonical = {
  rose: {
    bg: "rgba(212, 132, 106, 0.10)",
    border: "rgba(212, 132, 106, 0.22)",
    text: "#EDB99D",
  },
  foil: {
    bg: "rgba(229, 201, 168, 0.09)",
    border: "rgba(229, 201, 168, 0.22)",
    text: "#F4E4D0",
  },
  sage: {
    bg: "rgba(94, 173, 154, 0.09)",
    border: "rgba(94, 173, 154, 0.22)",
    text: "#8FC9B7",
  },
  honey: {
    bg: "rgba(227, 176, 75, 0.09)",
    border: "rgba(227, 176, 75, 0.22)",
    text: "#EFC878",
  },
  umber: {
    bg: "rgba(184, 147, 108, 0.09)",
    border: "rgba(184, 147, 108, 0.22)",
    text: "#D4B68F",
  },
  slate: {
    bg: "rgba(138, 169, 192, 0.09)",
    border: "rgba(138, 169, 192, 0.22)",
    text: "#B5CDDD",
  },
} as const;

const _tonesLightCanonical = {
  rose: {
    bg: "rgba(184, 90, 66, 0.08)",
    border: "rgba(184, 90, 66, 0.22)",
    text: "#8B3E28",
  },
  foil: {
    bg: "rgba(184, 147, 108, 0.08)",
    border: "rgba(184, 147, 108, 0.22)",
    text: "#8E6D4A",
  },
  sage: {
    bg: "rgba(94, 173, 154, 0.08)",
    border: "rgba(94, 173, 154, 0.22)",
    text: "#2F6F5F",
  },
  honey: {
    bg: "rgba(227, 176, 75, 0.08)",
    border: "rgba(227, 176, 75, 0.22)",
    text: "#8B6A1F",
  },
  umber: {
    bg: "rgba(184, 147, 108, 0.08)",
    border: "rgba(184, 147, 108, 0.22)",
    text: "#6A4F30",
  },
  slate: {
    bg: "rgba(138, 169, 192, 0.08)",
    border: "rgba(138, 169, 192, 0.22)",
    text: "#456180",
  },
} as const;

export const tonesDark = {
  ..._tonesDarkCanonical,
  // Legacy aliases — orange→rose, emerald→sage, amber→honey, sky→slate,
  // cyan→slate. Existing `text-tone-orange-fg` etc. flip palette.
  orange: _tonesDarkCanonical.rose,
  emerald: _tonesDarkCanonical.sage,
  amber: _tonesDarkCanonical.honey,
  sky: _tonesDarkCanonical.slate,
  cyan: _tonesDarkCanonical.slate,
} as const;

export const tonesLight = {
  ..._tonesLightCanonical,
  orange: _tonesLightCanonical.rose,
  emerald: _tonesLightCanonical.sage,
  amber: _tonesLightCanonical.honey,
  sky: _tonesLightCanonical.slate,
  cyan: _tonesLightCanonical.slate,
} as const;

export type ToneKey = keyof typeof tonesDark;

// ────────────────────────────────────────────────────────────────────
// Glass — used on landing, modals, sticky headers
// ────────────────────────────────────────────────────────────────────

export const glassDark = {
  bg: "rgba(245, 241, 234, 0.04)",
  border: "rgba(245, 241, 234, 0.08)",
  hover: "rgba(245, 241, 234, 0.07)",
} as const;

export const glassLight = {
  bg: "rgba(255, 255, 255, 0.70)",
  border: "rgba(42, 31, 24, 0.08)",
  hover: "rgba(42, 31, 24, 0.04)",
} as const;

// ────────────────────────────────────────────────────────────────────
// Gradients — the foil is the brand's signature treatment.
// `primary` keeps its name so legacy callers keep working.
// ────────────────────────────────────────────────────────────────────

export const gradients = {
  /** Foil — champagne highlight → body → shadow at 135°. Brand moment. */
  foil: ["#F4E4D0", "#E5C9A8", "#B8936C"] as const,
  /** Rose — soft to deep, used on hero pin glows, illustration fills. */
  rose: ["#EDB99D", "#A85A42"] as const,
  /** Premium — full foil ink for upgrade CTAs / "Order moving pack". */
  premium: ["#F4E4D0", "#E5C9A8", "#B8936C"] as const,
  // Legacy names — flipped to foil so old gradient sites read champagne.
  primary: ["#F4E4D0", "#E5C9A8"] as const,
  warm: ["#A85A42", "#D4846A"] as const,
  glow: ["rgba(212, 132, 106, 0.40)", "rgba(229, 201, 168, 0.10)"] as const,
} as const;

// ────────────────────────────────────────────────────────────────────
// Radii — Edition VI scale (6 / 10 / 14 / 20 / 28).
// Mobile/web naming kept (`sm/md/lg/xl/2xl`) so call sites don't need
// updating; the actual pixel values shifted to the new scale.
// ────────────────────────────────────────────────────────────────────

export const radii = {
  sm: 6,
  md: 10, // default --radius
  lg: 14,
  xl: 20,
  "2xl": 28,
  full: 9999,
} as const;

// ────────────────────────────────────────────────────────────────────
// Spacing — 4 px rhythm, extended to 5xl (56) and 6xl (80) per the
// new system. Existing `xs..4xl` keys keep their original values.
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
  "5xl": 56,
  "6xl": 80,
} as const;

// ────────────────────────────────────────────────────────────────────
// Shadows — `glow` flipped from orange to rose; new `foil` glow added
// for premium moments. Don't spray either on normal cards.
// ────────────────────────────────────────────────────────────────────

export const shadowsMobile = {
  xs: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 4,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.55,
    shadowRadius: 50,
    elevation: 8,
  },
  /** Rose glow — reserved for the active state of the primary CTA. */
  glow: {
    shadowColor: "#D4846A",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 6,
  },
  /** Foil glow — premium / upgrade moments only. */
  foil: {
    shadowColor: "#E5C9A8",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 30,
    elevation: 6,
  },
} as const;

export const shadowsWeb = {
  xs: "0 1px 2px rgba(0, 0, 0, 0.25)",
  sm: "0 2px 6px rgba(0, 0, 0, 0.28)",
  md: "0 6px 18px rgba(0, 0, 0, 0.40)",
  lg: "0 20px 50px rgba(0, 0, 0, 0.55)",
  xl: "0 40px 80px rgba(0, 0, 0, 0.60)",
  glow: "0 0 20px rgba(212, 132, 106, 0.28)", // rose
  foil: "0 0 30px rgba(229, 201, 168, 0.16)",
} as const;

// ────────────────────────────────────────────────────────────────────
// Typography — Fraunces (display, variable opsz/SOFT) for hero/h1/h2,
// Geist (sans) for UI, Geist Mono for numerals/meta. Inter is the
// fallback, not the default.
// ────────────────────────────────────────────────────────────────────

export const fontFamilies = {
  display: '"Fraunces", "Didot", Georgia, serif',
  sans: '"Geist", "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  mono: '"Geist Mono", "JetBrains Mono", ui-monospace, Consolas, monospace',
} as const;

/** Font size scale — matches the brand doc type table (px values). */
export const fontSizes = {
  xs: 11,
  sm: 12,
  base: 14,
  md: 15,
  lg: 16,
  xl: 18,
  "2xl": 22,
  "3xl": 28,
  "4xl": 36,
  display: 48,
  "display-lg": 72,
  "display-xl": 96,
} as const;

export const fontWeights = {
  light: 300,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  black: 800,
} as const;

export const lineHeights = {
  tight: 1.0,
  snug: 1.15,
  normal: 1.45,
  relaxed: 1.7,
} as const;

export const letterSpacing = {
  tightest: "-0.035em",
  tight: "-0.02em",
  normal: "0",
  wide: "0.04em",
  mono: "0.14em",
} as const;

/** Fraunces opsz/SOFT axis presets — character of the display type. */
export const fontVariationSettings = {
  displayHero: '"opsz" 144, "SOFT" 50',
  displayH2: '"opsz" 96, "SOFT" 40',
  displayH3: '"opsz" 48, "SOFT" 30',
  displaySm: '"opsz" 36, "SOFT" 20',
} as const;

// ────────────────────────────────────────────────────────────────────
// Consolidated export
// ────────────────────────────────────────────────────────────────────

export const tokens = {
  brand: brandColors,
  /** Legacy alias kept for `tokens.orange[500]` callers. Resolves to rose. */
  orange: orangeScale,
  rose: roseScale,
  foil: foilScale,
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
    variations: fontVariationSettings,
  },
} as const;

export type DesignTokens = typeof tokens;
