import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "#10b981",
          light: "#d1fae5",
        },
        warning: {
          DEFAULT: "#f59e0b",
          light: "#fef3c7",
        },
        danger: {
          DEFAULT: "#ef4444",
          light: "#fee2e2",
        },
        info: {
          DEFAULT: "#3b82f6",
          light: "#dbeafe",
        },
        // Brand namespace — mirrors apps/web/tailwind.config.ts. Kept in sync
        // manually until we extract both into a shared Tailwind preset.
        // Source of truth: packages/shared/src/design-tokens.ts.
        brand: {
          orange: "var(--brand-orange)",
          "orange-light": "var(--brand-orange-light)",
          "orange-dark": "var(--brand-orange-dark)",
          amber: "var(--brand-amber)",
        },
        orange: {
          50: "var(--orange-50)",
          100: "var(--orange-100)",
          200: "var(--orange-200)",
          300: "var(--orange-300)",
          400: "var(--orange-400)",
          500: "var(--orange-500)",
          600: "var(--orange-600)",
          700: "var(--orange-700)",
          800: "var(--orange-800)",
          900: "var(--orange-900)",
        },
        tone: {
          "orange-bg": "var(--tone-orange-bg)",
          "orange-br": "var(--tone-orange-br)",
          "orange-fg": "var(--tone-orange-fg)",
          "emerald-bg": "var(--tone-emerald-bg)",
          "emerald-br": "var(--tone-emerald-br)",
          "emerald-fg": "var(--tone-emerald-fg)",
          "amber-bg": "var(--tone-amber-bg)",
          "amber-br": "var(--tone-amber-br)",
          "amber-fg": "var(--tone-amber-fg)",
          "rose-bg": "var(--tone-rose-bg)",
          "rose-br": "var(--tone-rose-br)",
          "rose-fg": "var(--tone-rose-fg)",
          "sky-bg": "var(--tone-sky-bg)",
          "sky-br": "var(--tone-sky-br)",
          "sky-fg": "var(--tone-sky-fg)",
          "cyan-bg": "var(--tone-cyan-bg)",
          "cyan-br": "var(--tone-cyan-br)",
          "cyan-fg": "var(--tone-cyan-fg)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "Consolas", "Courier New", "monospace"],
      },
      fontSize: {
        "brand-xs": ["11px", { lineHeight: "16px" }],
        "brand-sm": ["12px", { lineHeight: "18px" }],
        "brand-base": ["14px", { lineHeight: "20px" }],
        "brand-md": ["15px", { lineHeight: "22px" }],
        "brand-lg": ["16px", { lineHeight: "24px" }],
        "brand-xl": ["18px", { lineHeight: "28px" }],
        "brand-2xl": ["22px", { lineHeight: "28px" }],
        "brand-3xl": ["28px", { lineHeight: "32px" }],
        "brand-display": ["40px", { lineHeight: "44px", letterSpacing: "-0.02em" }],
        "brand-display-lg": ["60px", { lineHeight: "64px", letterSpacing: "-0.02em" }],
      },
      boxShadow: {
        glow: "var(--shadow-glow)",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
};

export default config;
