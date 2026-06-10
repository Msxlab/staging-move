import React, { useMemo } from "react";
import { View, Text, StyleSheet, type ViewStyle } from "react-native";
import { useAppTheme, type Theme } from "@/lib/theme";

interface BadgeProps {
  label: string;
  variant?: "primary" | "success" | "warning" | "error" | "info" | "neutral";
  size?: "sm" | "md";
  /**
   * Aurora status-dot chip (Edition VII StatusBadge idiom): renders a small
   * leading dot in the variant's text tone. Off by default so existing
   * badges are pixel-identical.
   */
  dot?: boolean;
  /**
   * Aurora mono-uppercase micro-label treatment (kicker/status pill idiom:
   * uppercased label, tight size, letterSpacing 1, weight 700). Off by
   * default so existing badges are pixel-identical.
   */
  mono?: boolean;
  style?: ViewStyle;
}

// Variant tone lookups read from the canonical tone tokens. The legacy
// keys (orange/emerald/amber/sky) alias onto rose/sage/honey/slate in
// Edition VII Aurora, so existing call sites flip palette without code
// changes. Built per-render against the resolved theme so light/dark
// switches actually re-paint the badge.
function makeVariantStyles(t: Theme) {
  return {
    primary: { bg: t.colors.primaryFaded, border: t.colors.orange.border, text: t.colors.orange.text },
    success: { bg: t.colors.successFaded, border: t.colors.emerald.border, text: t.colors.emerald.text },
    warning: { bg: t.colors.warningFaded, border: t.colors.amber.border, text: t.colors.amber.text },
    error: { bg: t.colors.errorFaded, border: t.colors.rose.border, text: t.colors.rose.text },
    info: { bg: t.colors.infoFaded, border: t.colors.sky.border, text: t.colors.sky.text },
    neutral: { bg: "rgba(236, 241, 248, 0.05)", border: t.colors.border, text: t.colors.textTertiary },
  } as const;
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    base: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: t.radius.full,
      borderWidth: 1,
      alignSelf: "flex-start",
    },
    md: {
      paddingHorizontal: 12,
      paddingVertical: 5,
    },
    text: {
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 0.3,
    },
    textMd: {
      fontSize: 13,
    },
    // ── Aurora additive treatments (Edition VII) ──
    // Row layout only applies when a dot is present, so dot-less badges
    // keep the original single-Text layout untouched.
    withDot: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    // Mono-uppercase micro-label (addresses Hub kicker convention:
    // fontSize 10-11 / letterSpacing 1 / weight 700 / .toUpperCase()).
    textMono: {
      fontSize: 10,
      letterSpacing: 1,
      fontWeight: "700",
    },
    textMonoMd: {
      fontSize: 11,
    },
  });

export function Badge({ label, variant = "neutral", size = "sm", dot = false, mono = false, style }: BadgeProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const variants = useMemo(() => makeVariantStyles(theme), [theme]);
  const v = variants[variant];
  return (
    <View
      style={[
        styles.base,
        size === "md" && styles.md,
        dot && styles.withDot,
        { backgroundColor: v.bg, borderColor: v.border },
        style,
      ]}
    >
      {dot && <View style={[styles.dot, { backgroundColor: v.text }]} />}
      <Text
        style={[
          styles.text,
          size === "md" && styles.textMd,
          mono && styles.textMono,
          mono && size === "md" && styles.textMonoMd,
          { color: v.text },
        ]}
      >
        {mono ? label.toUpperCase() : label}
      </Text>
    </View>
  );
}
