/**
 * LocateFlow canonical design tokens.
 *
 * Single source of truth for colors, typography, spacing, radii, and
 * shadows across web, admin, and mobile.
 *
 * Edition VII · Aurora. The values below were flipped from the
 * Champagne & Rose palette (Edition VI) to Aurora's cool / honey /
 * mint / amber / coral system to match the system-wide theming shipped
 * on web and admin. The premium "foil" accent (and Pro plan) is
 * honey/champagne. Legacy export names (`brand.orange`, `tones.orange`,
 * `roseScale`, `foilScale`, etc.) are preserved on purpose so the
 * mobile app — the only runtime consumer of this file — flips palette
 * without a codemod. Web and admin don't import at runtime; their
 * globals.css mirrors these values manually.
 *
 * Consumers:
 *   - `apps/mobile/src/lib/theme.ts` consumes `tokens.colors.tones`,
 *     `tokens.spacing`, `tokens.radius`, `tokens.shadow.glow`.
 *   - `apps/mobile/tailwind.config.ts` populates NativeWind palette.
 *   - `apps/web/src/styles/globals.css` and `apps/admin/src/app/aurora.css`
 *     keep their own copies of the same numeric values; sync manually
 *     when these change.
 */

// ────────────────────────────────────────────────────────────────────
// Brand palette — Aurora (Edition VII)
// Cool blue primary, honey/champagne accent, mint success.
// ────────────────────────────────────────────────────────────────────

export const brandColors = {
  // Legacy names — kept so `brand.orange` references in code keep working.
  // Values now resolve to Aurora cool (primary) / honey (accent) so the
  // visual surface flips automatically.
  orange: "#7FB6E8", // primary — Aurora cool
  orangeLight: "#A5C9F0", // hover / soft glow
  orangeDark: "#5C9DDC", // pressed — Aurora cool-2
  amber: "#F2C46C", // secondary / accent — honey/champagne foil

  // Canonical Aurora names.
  rose: "#7FB6E8", // primary cool
  roseLight: "#A5C9F0",
  roseDeep: "#5C9DDC",
  roseDark: "#3D7AB8",
  foil: "#F2C46C", // honey/champagne accent (Pro)
  foilHighlight: "#FBE7BD", // champagne highlight (gradient stop a)
  foilShadow: "#D99A4E", // champagne shadow (gradient stop c)
  foilInk: "#7A5418", // honey ink
  sage: "#87DDC0", // mint
  sageSoft: "#B0E8D2",
  nude: "#F2C46C", // alias of foil/honey
  nudeDeep: "#D99A4E",
} as const;

/**
 * Cool scale — Aurora primary. The legacy `orangeScale` / `roseScale`
 * exports point at *this* scale so `bg-orange-500`, `text-orange-400`,
 * `tokens.orange[500]`, etc. flip palette without touching component
 * code. The 500 step is the brand pin color.
 */
export const roseScale = {
  50: "#EFF5FB",
  100: "#DDE7F5",
  200: "#BDD2EE",
  300: "#9CBDDD",
  400: "#7FB6E8", // brand pin (was 500 step)
  500: "#7FB6E8", // primary
  600: "#6BA5D9",
  700: "#5C9DDC", // pressed (cool-2)
  800: "#3D7AB8",
  900: "#1F5FA0",
} as const;

/**
 * Foil/honey scale — Aurora secondary accent. Champagne highlight →
 * honey body → champagne shadow so legacy `foilScale.highlight` callers
 * keep rendering, now in the honey/champagne foil.
 */
export const foilScale = {
  highlight: "#FBE7BD", // champagne highlight
  body: "#F2C46C", // honey/champagne (the flat-color use)
  shadow: "#D99A4E", // champagne shadow
  ink: "#7A5418", // honey ink on paper
} as const;

/**
 * Legacy alias — `orangeScale` now points at the rose values. This means
 * Tailwind's `bg-orange-500` (which resolves to `var(--orange-500)` in
 * web/admin) renders rose. Mobile reads the same scale via the `primary`
 * extension in `apps/mobile/tailwind.config.ts`.
 */
export const orangeScale = roseScale;

// ────────────────────────────────────────────────────────────────────
// Surfaces — Aurora deep navy on dark, soft sky on light
// ────────────────────────────────────────────────────────────────────

export const surfaceDark = {
  background: "#0A0F18", // au-base
  surface: "#0E1521", // au-base-2 (cards)
  card: "#131C2C", // au-base-3 (card hover, input fill)
  cardHover: "#1A2438", // active surface, menu hover
  elevated: "#212C45", // popovers, dialogs
} as const;

export const surfaceLight = {
  background: "#F2F4F8", // au-base
  surface: "#FFFFFF",
  card: "#EAEEF4", // au-base-2
  cardHover: "#E2E7EE", // au-base-3
  elevated: "#FFFFFF",
} as const;

// ────────────────────────────────────────────────────────────────────
// Foreground / text — Aurora ink ramp (cool-tinted whites/blacks)
// ────────────────────────────────────────────────────────────────────

export const textDark = {
  primary: "#ECF1F8", // au-ink
  secondary: "#A8B5C9", // au-ink-2
  tertiary: "#6E7C92", // au-ink-3
  muted: "#4C586D", // au-ink-4
} as const;

export const textLight = {
  primary: "#14202F", // au-ink
  secondary: "#4A5C75", // au-ink-2
  tertiary: "#7A8A9F", // au-ink-3
  muted: "#ABB6C5", // au-ink-4
} as const;

// ────────────────────────────────────────────────────────────────────
// Borders — alpha, never opaque. Focus is always a cool ring.
// ────────────────────────────────────────────────────────────────────

export const borderDark = {
  default: "rgba(255, 255, 255, 0.05)", // au-edge-2
  strong: "rgba(255, 255, 255, 0.10)", // au-edge
  foil: "rgba(242, 196, 108, 0.24)", // honey hairline
  rose: "rgba(127, 182, 232, 0.30)", // cool ring
  focus: "rgba(127, 182, 232, 0.55)", // 2px outline on focus-visible
} as const;

export const borderLight = {
  default: "rgba(20, 32, 47, 0.06)",
  strong: "rgba(20, 32, 47, 0.14)",
  foil: "rgba(176, 120, 30, 0.30)",
  rose: "rgba(45, 123, 196, 0.30)",
  focus: "rgba(45, 123, 196, 0.55)",
} as const;

// ────────────────────────────────────────────────────────────────────
// Semantic colors — Aurora mint/amber/coral/cool. All in the brand family.
// ────────────────────────────────────────────────────────────────────

export const semanticColors = {
  success: "#87DDC0", // au-mint
  successLight: "rgba(135, 221, 192, 0.14)",
  warning: "#F2C46C", // au-amber
  warningLight: "rgba(242, 196, 108, 0.14)",
  danger: "#F08C8E", // au-coral
  dangerLight: "rgba(240, 140, 142, 0.16)",
  info: "#7FB6E8", // au-cool
  infoLight: "rgba(127, 182, 232, 0.14)",
} as const;

// ────────────────────────────────────────────────────────────────────
// Tonal pairs — stat cards, category chips, service-type indicators.
// Six tones in the Edition VI vocabulary: rose, foil, sage, honey,
// umber, slate. The `orange/emerald/amber/sky/cyan` legacy tone names
// alias onto the closest new tones so existing UI keeps rendering.
// ────────────────────────────────────────────────────────────────────

const _tonesDarkCanonical = {
  // rose tone is now Aurora cool — semantic intent (warning/attention) preserved.
  rose: {
    bg: "rgba(127, 182, 232, 0.10)",
    border: "rgba(127, 182, 232, 0.22)",
    text: "#7FB6E8",
  },
  foil: {
    bg: "rgba(242, 196, 108, 0.10)",
    border: "rgba(242, 196, 108, 0.24)",
    text: "#F2C46C",
  },
  sage: {
    bg: "rgba(135, 221, 192, 0.10)",
    border: "rgba(135, 221, 192, 0.22)",
    text: "#87DDC0",
  },
  honey: {
    bg: "rgba(242, 196, 108, 0.10)",
    border: "rgba(242, 196, 108, 0.22)",
    text: "#F2C46C",
  },
  // umber — champagne shadow tone (matches bundle --tone-umber-fg).
  umber: {
    bg: "rgba(216, 154, 78, 0.10)",
    border: "rgba(216, 154, 78, 0.22)",
    text: "#D99A4E",
  },
  slate: {
    bg: "rgba(168, 181, 201, 0.10)",
    border: "rgba(168, 181, 201, 0.22)",
    text: "#A8B5C9",
  },
} as const;

const _tonesLightCanonical = {
  rose: {
    bg: "rgba(45, 123, 196, 0.10)",
    border: "rgba(45, 123, 196, 0.22)",
    text: "#2D7BC4",
  },
  foil: {
    bg: "rgba(176, 120, 30, 0.10)",
    border: "rgba(176, 120, 30, 0.22)",
    text: "#B0781E",
  },
  sage: {
    bg: "rgba(46, 155, 121, 0.10)",
    border: "rgba(46, 155, 121, 0.22)",
    text: "#2E9B79",
  },
  honey: {
    bg: "rgba(185, 131, 24, 0.10)",
    border: "rgba(185, 131, 24, 0.22)",
    text: "#B98318",
  },
  umber: {
    bg: "rgba(176, 120, 30, 0.10)",
    border: "rgba(176, 120, 30, 0.22)",
    text: "#B0781E",
  },
  slate: {
    bg: "rgba(74, 92, 117, 0.10)",
    border: "rgba(74, 92, 117, 0.22)",
    text: "#4A5C75",
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
  bg: "rgba(255, 255, 255, 0.03)", // au-pane
  border: "rgba(255, 255, 255, 0.05)", // au-edge-2
  hover: "rgba(255, 255, 255, 0.08)", // au-pane-3
} as const;

export const glassLight = {
  bg: "rgba(255, 255, 255, 0.55)", // au-pane
  border: "rgba(20, 32, 47, 0.06)", // au-edge-2
  hover: "rgba(255, 255, 255, 0.92)", // au-pane-3
} as const;

// ────────────────────────────────────────────────────────────────────
// Gradients — the foil is the brand's signature treatment.
// `primary` keeps its name so legacy callers keep working.
// ────────────────────────────────────────────────────────────────────

export const gradients = {
  /** Foil — champagne highlight → honey → champagne shadow at 135°. Brand moment. */
  foil: ["#FBE7BD", "#F2C46C", "#D99A4E"] as const,
  /** Rose — soft cool → cool-2, used on hero pin glows, illustration fills. */
  rose: ["#A5C9F0", "#5C9DDC"] as const,
  /** Premium — cool→honey sweep for upgrade CTAs / "Order moving pack". */
  premium: ["#7FB6E8", "#F2C46C"] as const,
  // Legacy names — flipped to Aurora cool so old gradient sites read cool.
  primary: ["#DDE7F5", "#7FB6E8"] as const,
  warm: ["#5C9DDC", "#7FB6E8"] as const,
  glow: ["rgba(127, 182, 232, 0.40)", "rgba(242, 196, 108, 0.10)"] as const,
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
  /** Cool glow — reserved for the active state of the primary CTA. */
  glow: {
    shadowColor: "#7FB6E8",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 6,
  },
  /** Honey glow — premium / upgrade moments only. */
  foil: {
    shadowColor: "#F2C46C",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
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
  glow: "0 0 20px rgba(127, 182, 232, 0.28)", // Aurora cool
  foil: "0 0 30px rgba(242, 196, 108, 0.20)", // honey/champagne
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
