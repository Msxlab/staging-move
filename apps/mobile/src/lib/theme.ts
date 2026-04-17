export const theme = {
  colors: {
    primary: "#F97316",
    primaryLight: "#FB923C",
    primaryDark: "#EA580C",
    primaryFaded: "rgba(249, 115, 22, 0.15)",
    accent: "#FBBF24",
    success: "#10b981",
    successFaded: "rgba(16, 185, 129, 0.15)",
    warning: "#f59e0b",
    warningFaded: "rgba(245, 158, 11, 0.15)",
    error: "#ef4444",
    errorFaded: "rgba(239, 68, 68, 0.15)",
    info: "#3b82f6",
    infoFaded: "rgba(59, 130, 246, 0.15)",

    background: "#0a0a0f",
    surface: "#12121a",
    card: "#1a1a25",
    cardHover: "#22222f",
    elevated: "#252530",

    border: "rgba(255, 255, 255, 0.08)",
    borderLight: "rgba(255, 255, 255, 0.12)",
    borderFocus: "rgba(249, 115, 22, 0.5)",

    glass: {
      bg: "rgba(255, 255, 255, 0.06)",
      border: "rgba(255, 255, 255, 0.12)",
      highlight: "rgba(255, 255, 255, 0.08)",
    },

    text: "#ffffff",
    textSecondary: "rgba(255, 255, 255, 0.7)",
    textTertiary: "rgba(255, 255, 255, 0.4)",
    textMuted: "rgba(255, 255, 255, 0.2)",

    orange: { bg: "rgba(249, 115, 22, 0.1)", border: "rgba(249, 115, 22, 0.2)", text: "#FB923C" },
    emerald: { bg: "rgba(16, 185, 129, 0.1)", border: "rgba(16, 185, 129, 0.2)", text: "#6ee7b7" },
    amber: { bg: "rgba(245, 158, 11, 0.1)", border: "rgba(245, 158, 11, 0.2)", text: "#fcd34d" },
    rose: { bg: "rgba(244, 63, 94, 0.1)", border: "rgba(244, 63, 94, 0.2)", text: "#fda4af" },
    sky: { bg: "rgba(14, 165, 233, 0.1)", border: "rgba(14, 165, 233, 0.2)", text: "#7dd3fc" },
    cyan: { bg: "rgba(6, 182, 212, 0.1)", border: "rgba(6, 182, 212, 0.2)", text: "#67e8f9" },

    gradient: {
      primary: ["#F97316", "#FBBF24"] as readonly [string, string],
      warm: ["#EA580C", "#F97316"] as readonly [string, string],
      glow: ["rgba(249, 115, 22, 0.4)", "rgba(251, 191, 36, 0.1)"] as readonly [string, string],
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    "2xl": 24,
    "3xl": 32,
    "4xl": 40,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    "2xl": 24,
    full: 9999,
  },
  shadow: {
    sm: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 4,
    },
    lg: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    glow: {
      shadowColor: "#F97316",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    },
  },
} as const;

export type Theme = typeof theme;
