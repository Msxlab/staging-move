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
        // Aurora mobile palette aligned with packages/shared/src/design-tokens.ts.
        // NativeWind className colors are a fixed (dark) palette; runtime
        // light/dark theming is driven by src/lib/theme.ts (useAppTheme).
        // Legacy keys (rose/foil/sage/primary/surface) are kept so existing
        // className call sites keep rendering.
        primary: {
          DEFAULT: "#7FB6E8",
          light: "#A5C9F0",
          dark: "#5C9DDC",
          50: "#EFF5FB",
          100: "#DDE7F5",
          200: "#BDD2EE",
          300: "#9CBDDD",
          400: "#7FB6E8",
          500: "#7FB6E8",
          600: "#6BA5D9",
          700: "#5C9DDC",
          800: "#3D7AB8",
          900: "#1F5FA0",
        },
        // Aurora-named aliases.
        rose: {
          DEFAULT: "#7FB6E8",
          light: "#A5C9F0",
          deep: "#5C9DDC",
          dark: "#3D7AB8",
        },
        foil: {
          DEFAULT: "#F2C46C",
          highlight: "#FBE7BD",
          shadow: "#D99A4E",
          ink: "#7A5418",
        },
        sage: {
          DEFAULT: "#87DDC0",
          soft: "#B0E8D2",
        },
        surface: {
          DEFAULT: "#0A0F18",
          elevated: "#0E1521",
          card: "#131C2C",
          hover: "#1A2438",
        },
        accent: "#F2C46C",
        // Semantic shorthands — Aurora mint / amber / coral / cool.
        success: "#87DDC0",
        warning: "#F2C46C",
        danger: "#F08C8E",
        info: "#7FB6E8",
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
