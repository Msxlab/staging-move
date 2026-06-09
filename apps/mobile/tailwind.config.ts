import type { Config } from "tailwindcss";
import {
  brandColors,
  orangeScale,
  surfaceDark,
  semanticColors,
} from "@locateflow/shared";

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
        // Primary scale — `bg-primary-500` etc. resolve to Aurora cool values.
        primary: {
          DEFAULT: brandColors.orange,        // Aurora cool #7FB6E8
          light: brandColors.orangeLight,     // cool-light #A5C9F0
          dark: brandColors.orangeDark,       // cool-2 #5C9DDC
          50: orangeScale[50],
          100: orangeScale[100],
          200: orangeScale[200],
          300: orangeScale[300],
          400: orangeScale[400],
          500: orangeScale[500],
          600: orangeScale[600],
          700: orangeScale[700],
          800: orangeScale[800],
          900: orangeScale[900],
        },
        // Aurora-named aliases (kept under legacy "rose"/"foil"/"sage" keys
        // so existing call sites flip palette without source changes).
        rose: {
          DEFAULT: brandColors.rose,          // Aurora cool #7FB6E8
          light: brandColors.roseLight,       // cool-light #A5C9F0
          deep: brandColors.roseDeep,         // cool-2 #5C9DDC
          dark: brandColors.roseDark,         // cool-deep #3D7AB8
        },
        foil: {
          DEFAULT: brandColors.foil,          // honey/champagne #F2C46C
          highlight: brandColors.foilHighlight, // champagne #FBE7BD
          shadow: brandColors.foilShadow,     // champagne shadow #D99A4E
          ink: brandColors.foilInk,           // honey ink #7A5418
        },
        sage: {
          DEFAULT: brandColors.sage,          // Aurora mint #87DDC0
          soft: brandColors.sageSoft,         // mint-soft #B0E8D2
        },
        surface: {
          DEFAULT: surfaceDark.background,    // au-base #0A0F18
          elevated: surfaceDark.surface,      // au-base-2 #0E1521
          card: surfaceDark.card,             // au-base-3 #131C2C
          hover: surfaceDark.cardHover,       // #1A2438
        },
        // `accent` historically meant "amber/yellow callout" — now the
        // honey/champagne foil so highlight pills match web.
        accent: brandColors.foil,             // honey/champagne #F2C46C
        // Semantic shorthands.
        success: semanticColors.success,      // Aurora mint #87DDC0
        warning: semanticColors.warning,      // Aurora amber #F2C46C
        danger: semanticColors.danger,        // Aurora coral #F08C8E
        info: semanticColors.info,            // Aurora cool #7FB6E8
      },
      fontFamily: {
        // Fraunces (display) + Geist (sans/mono) — loaded via expo-font in
        // app/_layout.tsx. Falls back to system if the font hasn't loaded.
        display: ["Fraunces_400Regular", "Didot", "Georgia", "serif"],
        sans: ["Geist_400Regular", "Inter", "system-ui", "sans-serif"],
        mono: ["GeistMono_400Regular", "JetBrainsMono", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
