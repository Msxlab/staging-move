import type { Config } from "tailwindcss";

// Edition VI · Champagne & Rose. Token names mirror the web/admin
// Tailwind configs so cross-surface components can stay literal.
// Source of truth: packages/shared/src/design-tokens.ts.
export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Primary scale — name kept; values flipped to rose so existing
        // `bg-primary-500` callers automatically render rose.
        primary: {
          DEFAULT: "#D4846A",
          light: "#EDB99D",
          dark: "#A85A42",
          50: "#FBF1ED",
          100: "#F6E0D6",
          200: "#EDC0AC",
          300: "#E5A287",
          400: "#DC8B6F",
          500: "#D4846A",
          600: "#BC6C53",
          700: "#A85A42",
          800: "#8A4630",
          900: "#6A2E1C",
        },
        // Edition VI semantic shorthands.
        rose: {
          DEFAULT: "#D4846A",
          light: "#EDB99D",
          deep: "#A85A42",
        },
        foil: {
          DEFAULT: "#E5C9A8",
          a: "#F4E4D0",
          b: "#E5C9A8",
          c: "#B8936C",
          ink: "#8E6D4A",
        },
        sage: {
          DEFAULT: "#5EAD9A",
          soft: "#8FC9B7",
        },
        // Surfaces — umber-near-black, slightly warm.
        surface: {
          DEFAULT: "#0E0A07",
          elevated: "#13100B",
          card: "#181410",
          hover: "#1F1A14",
        },
        // Cream ink on umber.
        ink: {
          DEFAULT: "#F5F1EA",
          deep: "#2A1F18",
        },
        // Accent kept (was amber #FBBF24); now resolves to flat foil.
        accent: "#E5C9A8",
      },
      fontFamily: {
        // expo-font registers these names in app/_layout.tsx; until the
        // font assets land, NativeWind falls through to the system font.
        sans: ["Geist"],
        display: ["Fraunces"],
        serif: ["Fraunces"],
        mono: ["GeistMono"],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "14px",
        xl: "20px",
        "2xl": "28px",
      },
    },
  },
  plugins: [],
} satisfies Config;
