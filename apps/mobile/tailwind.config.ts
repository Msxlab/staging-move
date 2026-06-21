import type { Config } from "tailwindcss";

// Edition VII · Aurora. The mobile NativeWind palette is sourced from
// packages/shared/src/design-tokens.ts so `bg-primary-500` / `bg-primary`
// / `bg-surface` resolve to the cool/violet/mint Aurora values shipped
// system-wide.
//
// Legacy names (rose, foil, sage, primary, surface) are preserved on
// purpose: existing `bg-primary-500` / `bg-rose` / `bg-foil` call sites
// keep rendering, the values just flip to Aurora. New code should
// prefer the semantic aliases (`bg-rose`/cool, `bg-foil`/violet,
// `bg-sage`/mint).
export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Move design — single uniform Sapphire accent on navy. These
        // NativeWind className colors are a fixed (dark) palette; runtime
        // light/dark theming is driven by src/lib/theme.ts (useAppTheme).
        // Legacy keys (rose/foil/sage/primary/surface) are kept so existing
        // className call sites keep rendering — values just flip to Move.
        primary: {
          DEFAULT: "#5B8DEF", // Sapphire
          light: "#83AAF5",
          dark: "#3D6FD6",
          50: "#EEF3FE",
          100: "#D9E5FC",
          200: "#B7CEF9",
          300: "#92B2F4",
          400: "#83AAF5",
          500: "#5B8DEF",
          600: "#3D6FD6",
          700: "#2E5FB0",
          800: "#244C90",
          900: "#1B3A6E",
        },
        // Aurora-named aliases — all now resolve to the Sapphire accent.
        rose: {
          DEFAULT: "#5B8DEF",
          light: "#83AAF5",
          deep: "#3D6FD6",
          dark: "#2E5FB0",
        },
        foil: {
          DEFAULT: "#5B8DEF",
          highlight: "#83AAF5",
          shadow: "#3D6FD6",
          ink: "#2E5FB0",
        },
        sage: {
          DEFAULT: "#54CB7E", // Move green
          soft: "#7FE0A0",
        },
        surface: {
          DEFAULT: "#0A0F1C", // Move bg
          elevated: "#121B2D", // surface
          card: "#121B2D",
          hover: "#18233A", // surface2
        },
        accent: "#5B8DEF", // Sapphire accent
        // Semantic shorthands — Move green / amber / red / teal.
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
