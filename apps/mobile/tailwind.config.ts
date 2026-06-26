import type { Config } from "tailwindcss";

// Edition VIII - LocateFlow Gold/Sapphire. The mobile NativeWind palette is sourced from
// packages/shared/src/design-tokens.ts so `bg-primary-500` / `bg-primary`
// / `bg-surface` resolve to the Gold dark accent, teal, and green values shipped
// system-wide.
//
// Legacy names (rose, foil, sage, primary, surface) are preserved on
// purpose: existing `bg-primary-500` / `bg-rose` / `bg-foil` call sites
// keep rendering. New code should prefer the semantic aliases (`bg-rose`/gold,
// `bg-foil`/gold,
// `bg-sage`/green).
export default {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // LocateFlow Gold mobile palette aligned with packages/shared/src/design-tokens.ts.
        // NativeWind className colors are a fixed dark palette; runtime
        // light/dark theming is driven by src/lib/theme.ts (useAppTheme).
        // Legacy keys (rose/foil/sage/primary/surface) are kept so existing
        // className call sites keep rendering.
        primary: {
          DEFAULT: "#5B8DEF",
          light: "#83AAF5",
          dark: "#3D6FD6",
          50: "#FFF8E8",
          100: "#F8E8BF",
          200: "#EAD095",
          300: "#83AAF5",
          400: "#5B8DEF",
          500: "#5B8DEF",
          600: "#3D6FD6",
          700: "#9A7325",
          800: "#86631A",
          900: "#5F4614",
        },
        // Legacy aliases retained for existing class names.
        rose: {
          DEFAULT: "#E25C5C",
          light: "#F08A8A",
          deep: "#C84E51",
          dark: "#A83333",
        },
        foil: {
          DEFAULT: "#5B8DEF",
          highlight: "#83AAF5",
          shadow: "#3D6FD6",
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
        accent: "#5B8DEF",
        // Semantic shorthands - green / amber / coral / teal.
        success: "#54CB7E",
        warning: "#E0A85A",
        danger: "#E25C5C",
        info: "#37C2C9",
      },
      fontFamily: {
        // LocateFlow design system: Playfair Display (display/serif) + DM Sans
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
