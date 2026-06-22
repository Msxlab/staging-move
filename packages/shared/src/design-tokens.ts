/**
 * LocateFlow canonical design tokens.
 *
 * Single source of truth for colors, typography, spacing, radii, and
 * shadows across web, admin, and mobile.
 *
 * Edition VIII · LocateFlow Gold/Sapphire. The values below follow the design
 * handoff defaults: deep navy surfaces with Gold as the dark primary accent,
 * Sapphire as the light primary accent, plus
 * green / teal / amber / red semantic support colors. Legacy export names
 * (`brand.orange`, `tones.orange`,
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
// Brand palette — LocateFlow Gold/Sapphire (Edition VIII)
// Dark mode uses Gold, light mode uses Sapphire, with teal info and green success.
// ────────────────────────────────────────────────────────────────────

export const brandColors = {
  // Legacy names — kept so `brand.orange` references in code keep working.
  // Values now resolve to the design handoff's dark Gold primary so existing
  // legacy references flip without a codemod.
  orange: "#CBA45E", // primary — Gold
  orangeLight: "#DCBC7C", // hover / soft glow
  orangeDark: "#B0852F", // pressed — Gold dark
  amber: "#E0A85A", // secondary / warning

  // Canonical design names.
  rose: "#CBA45E", // primary Gold in dark mode
  roseLight: "#DCBC7C",
  roseDeep: "#B0852F",
  roseDark: "#86631A",
  foil: "#CBA45E", // premium Gold
  foilHighlight: "#DCBC7C", // gradient stop a
  foilShadow: "#B0852F", // gradient stop c
  foilInk: "#86631A", // readable gold ink on paper
  sage: "#54CB7E", // success green
  sageSoft: "#8BE3A8",
  nude: "#E0A85A", // amber alias
  nudeDeep: "#A9761E",
} as const;

/**
 * Sapphire scale - LocateFlow light-mode primary. The legacy `orangeScale` /
 * `roseScale` exports point at *this* scale so fixed utility palettes keep a
 * readable blue paper accent while runtime theme consumers use Gold in dark.
 */
export const roseScale = {
  50: "#EEF5FF",
  100: "#DBE8FF",
  200: "#C8D9FB",
  300: "#A9C5F8",
  400: "#3D74C8", // light Sapphire hover / soft glow
  500: "#2E5FB0", // light Sapphire primary
  600: "#2E5FB0",
  700: "#244C90", // pressed
  800: "#244C90",
  900: "#18345F",
} as const;

/**
 * Foil/gold scale — premium Gold highlight → body → shadow so legacy
 * `foilScale.highlight` callers keep rendering in the handoff palette.
 */
export const foilScale = {
  highlight: "#DCBC7C", // gold highlight
  body: "#CBA45E", // flat gold
  shadow: "#B0852F", // gold shadow
  ink: "#86631A", // gold ink on paper
} as const;

/**
 * Legacy alias — `orangeScale` now points at the rose values. This means
 * Tailwind's `bg-orange-500` (which resolves to `var(--orange-500)` in
 * web/admin) renders rose. Mobile reads the same scale via the `primary`
 * extension in `apps/mobile/tailwind.config.ts`.
 */
export const orangeScale = roseScale;

// ────────────────────────────────────────────────────────────────────
// Surfaces - deep navy on dark, soft sky on light
// ────────────────────────────────────────────────────────────────────

export const surfaceDark = {
  background: "#070B14",
  surface: "#121B2D",
  card: "#18233A",
  cardHover: "#16203A",
  elevated: "#1D2943",
} as const;

export const surfaceLight = {
  background: "#F2F4F8", // au-base
  surface: "#FFFFFF",
  card: "#EAEEF4", // au-base-2
  cardHover: "#E2E7EE", // au-base-3
  elevated: "#FFFFFF",
} as const;

// ────────────────────────────────────────────────────────────────────
// Foreground / text - LocateFlow ink ramp
// ────────────────────────────────────────────────────────────────────

export const textDark = {
  primary: "#EFF3FA",
  secondary: "#8A99B6",
  tertiary: "#5A6A86",
  muted: "#41526F",
} as const;

export const textLight = {
  primary: "#14202F", // au-ink
  secondary: "#4A5C75", // au-ink-2
  tertiary: "#7A8A9F", // au-ink-3
  muted: "#ABB6C5", // au-ink-4
} as const;

// ────────────────────────────────────────────────────────────────────
// Borders — alpha, never opaque. Focus follows the current dark/light accent.
// ────────────────────────────────────────────────────────────────────

export const borderDark = {
  default: "rgba(255, 255, 255, 0.05)", // au-edge-2
  strong: "rgba(255, 255, 255, 0.10)", // au-edge
  foil: "rgba(203, 164, 94, 0.24)", // gold hairline
  rose: "rgba(203, 164, 94, 0.30)", // gold ring
  focus: "rgba(203, 164, 94, 0.55)", // 2px outline on focus-visible
} as const;

export const borderLight = {
  default: "rgba(20, 32, 47, 0.06)",
  strong: "rgba(20, 32, 47, 0.14)",
  foil: "rgba(46, 95, 176, 0.30)",
  rose: "rgba(46, 95, 176, 0.30)",
  focus: "rgba(46, 95, 176, 0.55)",
} as const;

// ────────────────────────────────────────────────────────────────────
// Semantic colors — green/amber/red/teal from the design handoff.
// ────────────────────────────────────────────────────────────────────

export const semanticColors = {
  success: "#54CB7E",
  successLight: "rgba(84, 203, 126, 0.14)",
  warning: "#E0A85A",
  warningLight: "rgba(224, 168, 90, 0.16)",
  danger: "#E25C5C",
  dangerLight: "rgba(226, 92, 92, 0.16)",
  info: "#37C2C9",
  infoLight: "rgba(55, 194, 201, 0.14)",
} as const;

export const semanticColorsLight = {
  success: "#0F6B50",
  successLight: "rgba(15, 107, 80, 0.10)",
  warning: "#7A5418",
  warningLight: "rgba(138, 91, 22, 0.10)",
  danger: "#A83333",
  dangerLight: "rgba(168, 51, 51, 0.10)",
  info: "#16666B",
  infoLight: "rgba(22, 102, 107, 0.10)",
} as const;

// ────────────────────────────────────────────────────────────────────
// Plan accent colors — kept as compatibility hooks for plan-aware UI. Every
// plan resolves to the canonical LocateFlow accent; plan identity lives
// in copy/badges instead of recoloring the brand.
// ────────────────────────────────────────────────────────────────────

export const planColors = {
  free: { dark: "#CBA45E", light: "#2E5FB0" },
  individual: { dark: "#CBA45E", light: "#2E5FB0" },
  family: { dark: "#CBA45E", light: "#2E5FB0" },
  pro: { dark: "#CBA45E", light: "#2E5FB0" },
} as const;

// ────────────────────────────────────────────────────────────────────
// Tonal pairs — stat cards, category chips, service-type indicators.
// Compatibility tone vocabulary: rose, foil, sage, honey,
// umber, slate. The `orange/emerald/amber/sky/cyan` legacy tone names
// alias onto the closest new tones so existing UI keeps rendering.
// ────────────────────────────────────────────────────────────────────

const _tonesDarkCanonical = {
  rose: {
    bg: "rgba(226, 92, 92, 0.16)",
    border: "rgba(226, 92, 92, 0.28)",
    text: "#E25C5C",
  },
  foil: {
    bg: "rgba(203, 164, 94, 0.09)",
    border: "rgba(203, 164, 94, 0.22)",
    text: "#CBA45E",
  },
  sage: {
    bg: "rgba(84, 203, 126, 0.14)",
    border: "rgba(84, 203, 126, 0.24)",
    text: "#54CB7E",
  },
  honey: {
    bg: "rgba(224, 168, 90, 0.16)",
    border: "rgba(224, 168, 90, 0.24)",
    text: "#E0A85A",
  },
  // umber — Gold shadow tone (matches bundle --tone-umber-fg).
  umber: {
    bg: "rgba(176, 133, 47, 0.12)",
    border: "rgba(176, 133, 47, 0.24)",
    text: "#B0852F",
  },
  slate: {
    bg: "rgba(168, 181, 201, 0.10)",
    border: "rgba(168, 181, 201, 0.22)",
    text: "#A8B5C9",
  },
} as const;

const _tonesDarkInfo = {
  bg: "rgba(55, 194, 201, 0.14)",
  border: "rgba(55, 194, 201, 0.24)",
  text: "#37C2C9",
} as const;

const _tonesLightCanonical = {
  rose: {
    bg: "rgba(168, 51, 51, 0.10)",
    border: "rgba(168, 51, 51, 0.22)",
    text: "#A83333",
  },
  foil: {
    bg: "rgba(46, 95, 176, 0.10)",
    border: "rgba(46, 95, 176, 0.22)",
    text: "#244C90",
  },
  sage: {
    bg: "rgba(15, 107, 80, 0.10)",
    border: "rgba(15, 107, 80, 0.22)",
    text: "#0F6B50",
  },
  honey: {
    bg: "rgba(138, 91, 22, 0.10)",
    border: "rgba(138, 91, 22, 0.22)",
    text: "#7A5418",
  },
  umber: {
    bg: "rgba(46, 95, 176, 0.10)",
    border: "rgba(46, 95, 176, 0.22)",
    text: "#244C90",
  },
  slate: {
    bg: "rgba(74, 92, 117, 0.10)",
    border: "rgba(74, 92, 117, 0.22)",
    text: "#4A5C75",
  },
} as const;

const _tonesLightInfo = {
  bg: "rgba(22, 102, 107, 0.10)",
  border: "rgba(22, 102, 107, 0.22)",
  text: "#16666B",
} as const;

export const tonesDark = {
  ..._tonesDarkCanonical,
  // Legacy aliases — orange→rose, emerald→sage, amber→honey, sky→slate,
  // cyan→slate. Existing `text-tone-orange-fg` etc. flip palette.
  orange: _tonesDarkCanonical.foil,
  emerald: _tonesDarkCanonical.sage,
  amber: _tonesDarkCanonical.honey,
  sky: _tonesDarkInfo,
  cyan: _tonesDarkInfo,
} as const;

export const tonesLight = {
  ..._tonesLightCanonical,
  orange: _tonesLightCanonical.foil,
  emerald: _tonesLightCanonical.sage,
  amber: _tonesLightCanonical.honey,
  sky: _tonesLightInfo,
  cyan: _tonesLightInfo,
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
  /** Foil — gold highlight → gold body → gold shadow at 135°. Brand moment. */
  foil: ["#DCBC7C", "#CBA45E", "#B0852F"] as const,
  /** Rose legacy slot — Gold highlight → Gold shadow. */
  rose: ["#DCBC7C", "#B0852F"] as const,
  /** Premium — full Gold sweep for upgrade CTAs / "Order moving pack". */
  premium: ["#DCBC7C", "#CBA45E", "#B0852F"] as const,
  // Legacy names — flipped to Gold so old gradient sites read the dark handoff default.
  primary: ["#DCBC7C", "#CBA45E"] as const,
  warm: ["#B0852F", "#CBA45E"] as const,
  glow: ["rgba(203, 164, 94, 0.40)", "rgba(55, 194, 201, 0.10)"] as const,
} as const;

// ────────────────────────────────────────────────────────────────────
// Radii — LocateFlow UI scale (6 / 10 / 14 / 20 / 28).
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
  /** Gold glow — reserved for the active state of the primary CTA. */
  glow: {
    shadowColor: "#CBA45E",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 6,
  },
  /** Gold glow — premium / upgrade moments only. */
  foil: {
    shadowColor: "#CBA45E",
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
  glow: "0 0 20px rgba(203, 164, 94, 0.28)", // Gold
  foil: "0 0 30px rgba(203, 164, 94, 0.20)", // premium Gold
} as const;

// ────────────────────────────────────────────────────────────────────
// Typography - Playfair Display for hero/h1/h2, DM Sans for UI, and
// DM Mono for numerals/meta. Legacy Fraunces/Geist names remain fallbacks
// in app CSS only for older assets and not-yet-migrated references.
// ────────────────────────────────────────────────────────────────────

export const fontFamilies = {
  display: '"Playfair Display", "Didot", Georgia, serif',
  sans: '"DM Sans", "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  mono: '"DM Mono", "Geist Mono", "JetBrains Mono", ui-monospace, Consolas, monospace',
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

/** Legacy display-axis presets. Current Playfair usage ignores unsupported axes. */
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
