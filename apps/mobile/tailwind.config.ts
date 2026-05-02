import type { Config } from "tailwindcss";
import {
  brandColors,
  orangeScale,
  surfaceDark,
  semanticColors,
} from "@locateflow/shared";

// Edition VI · Champagne & Rose. The mobile NativeWind palette is sourced
// from packages/shared/src/design-tokens.ts so `bg-primary-500` /
// `bg-primary` / `bg-surface` resolve to the same hex values that
// apps/mobile/src/lib/theme.ts and apps/web/tailwind.config.ts produce.
//
// Legacy names are preserved on purpose: existing `bg-primary-500` call
// sites keep rendering, the values just flip to rose. New code should
// prefer the semantic aliases (`bg-rose`, `bg-foil`, `bg-sage`).
export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Primary scale — `bg-primary-500` etc. now resolve to rose values.
        primary: {
          DEFAULT: brandColors.orange,        // #D4846A
          light: brandColors.orangeLight,     // #EDB99D
          dark: brandColors.orangeDark,       // #A85A42
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
        // Canonical Champagne & Rose names.
        rose: {
          DEFAULT: brandColors.rose,          // #D4846A
          light: brandColors.roseLight,       // #EDB99D
          deep: brandColors.roseDeep,         // #A85A42
          dark: brandColors.roseDark,         // #6A2E1C
        },
        foil: {
          DEFAULT: brandColors.foil,          // #E5C9A8
          highlight: brandColors.foilHighlight, // #F4E4D0
          shadow: brandColors.foilShadow,     // #B8936C
          ink: brandColors.foilInk,           // #8E6D4A
        },
        sage: {
          DEFAULT: brandColors.sage,          // #5EAD9A
          soft: brandColors.sageSoft,         // #8FC9B7
        },
        surface: {
          DEFAULT: surfaceDark.background,    // #0E0A07 (was #0a0a0f)
          elevated: surfaceDark.surface,      // #13100B
          card: surfaceDark.card,             // #181410
          hover: surfaceDark.cardHover,       // #1F1A14
        },
        // `accent` historically meant "amber/yellow callout" — flipped to
        // foil champagne so highlight pills match web.
        accent: brandColors.foil,             // #E5C9A8
        // Semantic shorthands.
        success: semanticColors.success,      // #5EAD9A
        warning: semanticColors.warning,      // #E3B04B
        danger: semanticColors.danger,        // #C85A3E
        info: semanticColors.info,            // #8AA9C0
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
