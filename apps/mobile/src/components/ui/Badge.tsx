import React from "react";
import { View, Text, StyleSheet, type ViewStyle } from "react-native";
import { theme } from "@/lib/theme";

interface BadgeProps {
  label: string;
  variant?: "primary" | "success" | "warning" | "error" | "info" | "neutral";
  size?: "sm" | "md";
  style?: ViewStyle;
}

// Variant borders read from the canonical tone tokens. The legacy keys
// (orange/emerald/amber/sky) alias onto rose/sage/honey/slate in Edition
// VI, so existing call sites flip palette without code changes.
const variantStyles = {
  primary: { bg: theme.colors.primaryFaded, border: theme.colors.orange.border, text: theme.colors.orange.text },
  success: { bg: theme.colors.successFaded, border: theme.colors.emerald.border, text: theme.colors.emerald.text },
  warning: { bg: theme.colors.warningFaded, border: theme.colors.amber.border, text: theme.colors.amber.text },
  error: { bg: theme.colors.errorFaded, border: theme.colors.rose.border, text: theme.colors.rose.text },
  info: { bg: theme.colors.infoFaded, border: theme.colors.sky.border, text: theme.colors.sky.text },
  neutral: { bg: "rgba(245, 241, 234, 0.05)", border: theme.colors.border, text: theme.colors.textTertiary },
};

export function Badge({ label, variant = "neutral", size = "sm", style }: BadgeProps) {
  const v = variantStyles[variant];
  return (
    <View style={[styles.base, size === "md" && styles.md, { backgroundColor: v.bg, borderColor: v.border }, style]}>
      <Text style={[styles.text, size === "md" && styles.textMd, { color: v.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
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
