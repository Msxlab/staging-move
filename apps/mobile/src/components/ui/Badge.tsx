import React, { useMemo } from "react";
import { View, Text, StyleSheet, type ViewStyle } from "react-native";
import { useAppTheme, type Theme } from "@/lib/theme";

interface BadgeProps {
  label: string;
  variant?: "primary" | "success" | "warning" | "error" | "info" | "neutral";
  size?: "sm" | "md";
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
  });

export function Badge({ label, variant = "neutral", size = "sm", style }: BadgeProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const variants = useMemo(() => makeVariantStyles(theme), [theme]);
  const v = variants[variant];
  return (
    <View style={[styles.base, size === "md" && styles.md, { backgroundColor: v.bg, borderColor: v.border }, style]}>
      <Text style={[styles.text, size === "md" && styles.textMd, { color: v.text }]}>{label}</Text>
    </View>
  );
}
