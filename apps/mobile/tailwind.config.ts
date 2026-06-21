import type { Config } from "tailwindcss";

// Edition VIII - Move Gold. The mobile NativeWind palette is sourced from
// packages/shared/src/design-tokens.ts so `bg-primary-500` / `bg-primary`
// / `bg-surface` resolve to the Gold, teal, and green values shipped
// system-wide.
//
// Legacy names (rose, foil, sage, primary, surface) are preserved on
// purpose: existing `bg-primary-500` / `bg-rose` / `bg-foil` call sites
// keep rendering, the values just flip to Move Gold. New code should
// prefer the semantic aliases (`bg-rose`/gold, `bg-foil`/gold,
// `bg-sage`/green).
export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Move Gold mobile palette aligned with packages/shared/src/design-tokens.ts.
        // NativeWind className colors are a fixed (dark) palette; runtime
        // light/dark theming is driven by src/lib/theme.ts (useAppTheme).
        // Legacy keys (rose/foil/sage/primary/surface) are kept so existing
        // className call sites keep rendering.
        primary: {
          DEFAULT: "#CBA45E",
          light: "#DCBC7C",
          dark: "#B0852F",
          50: "#FCF7EA",
          100: "#F6E9C8",
          200: "#EBD39B",
          300: "#DCBC7C",
          400: "#CBA45E",
          500: "#CBA45E",
          600: "#B89142",
          700: "#B0852F",
          800: "#9A7325",
          900: "#86631A",
        },
        // Legacy aliases retained for existing class names.
        rose: {
          DEFAULT: "#E25C5C",
          light: "#F08A8A",
          deep: "#C84E51",
          dark: "#A83333",
        },
        foil: {
          DEFAULT: "#CBA45E",
          highlight: "#DCBC7C",
          shadow: "#B0852F",
          ink: "#86631A",
        },
        sage: {
          DEFAULT: "#54CB7E",
          soft: "#8BE3A8",
        },
        surface: {
          DEFAULT: "#070B14",
          elevated: "#1D2943",
          card: "#18233A",
          hover: "#16203A",
        },
        accent: "#CBA45E",
        // Semantic shorthands - green / amber / coral / teal.
        success: "#54CB7E",
        warning: "#E0A85A",
        danger: "#E25C5C",
        info: "#37C2C9",
      },
      fontFamily: {
        // Move design system: Playfair Display (display/serif) + DM Sans
        // (sans) + DM Mono (mono) — loaded via expo-font in app/_layout.tsx.
        // Falls back to system if the font hasn't loaded. For specific heading
        // weights use the explicit `fonts.*` constants from src/lib/theme.ts.
        display: ["PlayfairDisplay_700Bold", "Didot", "Georgia", "serif"],
        sans: ["DMSans_400Regular", "Inter", "system-ui", "sans-serif"],
        mono: ["DMMono_400Regular", "JetBrainsMono", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
