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
        // Semantic colors — Aurora ramp. Resolves through the CSS vars
        // declared in globals.css so light/dark switch automatically.
        success: {
          DEFAULT: "var(--success)",
          light: "var(--success-soft)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          light: "var(--warning-soft)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          light: "var(--danger-soft)",
        },
        info: {
          DEFAULT: "var(--info)",
          light: "var(--info-soft)",
        },
        // Edition VI · Champagne & Rose. Mirrors apps/web/tailwind.config.ts.
        brand: {
          orange: "var(--brand-orange)",
          "orange-light": "var(--brand-orange-light)",
          "orange-dark": "var(--brand-orange-dark)",
          amber: "var(--brand-amber)",
          rose: "var(--rose)",
          "rose-light": "var(--rose-light)",
          "rose-deep": "var(--rose-deep)",
          foil: "var(--foil)",
          "foil-a": "var(--foil-a)",
          "foil-b": "var(--foil-b)",
          "foil-c": "var(--foil-c)",
          "foil-ink": "var(--foil-ink)",
          sage: "var(--sage)",
        },
        rose: {
          DEFAULT: "var(--rose)",
          light: "var(--rose-light)",
          deep: "var(--rose-deep)",
        },
        foil: {
          DEFAULT: "var(--foil)",
          a: "var(--foil-a)",
          b: "var(--foil-b)",
          c: "var(--foil-c)",
          ink: "var(--foil-ink)",
        },
        sage: {
          DEFAULT: "var(--sage)",
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
          "rose-bg": "var(--tone-rose-bg)",
          "rose-br": "var(--tone-rose-br)",
          "rose-fg": "var(--tone-rose-fg)",
          "foil-bg": "var(--tone-foil-bg)",
          "foil-br": "var(--tone-foil-br)",
          "foil-fg": "var(--tone-foil-fg)",
          "sage-bg": "var(--tone-sage-bg)",
          "sage-br": "var(--tone-sage-br)",
          "sage-fg": "var(--tone-sage-fg)",
          "honey-bg": "var(--tone-honey-bg)",
          "honey-br": "var(--tone-honey-br)",
          "honey-fg": "var(--tone-honey-fg)",
          "umber-bg": "var(--tone-umber-bg)",
          "umber-br": "var(--tone-umber-br)",
          "umber-fg": "var(--tone-umber-fg)",
          "slate-bg": "var(--tone-slate-bg)",
          "slate-br": "var(--tone-slate-br)",
          "slate-fg": "var(--tone-slate-fg)",
          "orange-bg": "var(--tone-orange-bg)",
          "orange-br": "var(--tone-orange-br)",
          "orange-fg": "var(--tone-orange-fg)",
          "emerald-bg": "var(--tone-emerald-bg)",
          "emerald-br": "var(--tone-emerald-br)",
          "emerald-fg": "var(--tone-emerald-fg)",
          "amber-bg": "var(--tone-amber-bg)",
          "amber-br": "var(--tone-amber-br)",
          "amber-fg": "var(--tone-amber-fg)",
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
        xl: "20px",
        "2xl": "28px",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["var(--font-display)", "Didot", "Georgia", "serif"],
        serif: ["var(--font-display)", "Didot", "Georgia", "serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "Consolas", "Courier New", "monospace"],
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
        "brand-4xl": ["36px", { lineHeight: "40px", letterSpacing: "-0.02em" }],
        "brand-display": ["48px", { lineHeight: "52px", letterSpacing: "-0.02em" }],
        "brand-display-lg": ["72px", { lineHeight: "76px", letterSpacing: "-0.025em" }],
        "brand-display-xl": ["96px", { lineHeight: "100px", letterSpacing: "-0.03em" }],
      },
      boxShadow: {
        glow: "var(--shadow-glow)",
        rose: "var(--shadow-rose)",
        foil: "var(--shadow-foil)",
      },
      backgroundImage: {
        foil: "linear-gradient(135deg, var(--foil-a) 0%, var(--foil-b) 50%, var(--foil-c) 100%)",
        "rose-gradient": "linear-gradient(135deg, var(--rose-light) 0%, var(--rose-deep) 100%)",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
};

export default config;
