import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#F97316",
          light: "#FB923C",
          dark: "#EA580C",
          50: "#FFF7ED",
          100: "#FFEDD5",
          200: "#FED7AA",
          300: "#FDBA74",
          400: "#FB923C",
          500: "#F97316",
          600: "#EA580C",
          700: "#C2410C",
          800: "#9A3412",
          900: "#7C2D12",
        },
        surface: {
          DEFAULT: "#0a0a0f",
          elevated: "#12121a",
          card: "#1a1a25",
          hover: "#22222f",
        },
        accent: "#FBBF24",
      },
      fontFamily: {
        sans: ["Inter"],
        mono: ["JetBrainsMono"],
      },
    },
  },
  plugins: [],
} satisfies Config;
