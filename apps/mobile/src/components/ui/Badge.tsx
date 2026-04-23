import React from "react";
import { View, Text, StyleSheet, type ViewStyle } from "react-native";
import { theme } from "@/lib/theme";

interface BadgeProps {
  label: string;
  variant?: "primary" | "success" | "warning" | "error" | "info" | "neutral";
  size?: "sm" | "md";
  style?: ViewStyle;
}

const variantStyles = {
  primary: { bg: theme.colors.primaryFaded, border: "rgba(212, 132, 106,0.3)", text: theme.colors.orange.text },
  success: { bg: theme.colors.successFaded, border: "rgba(16,185,129,0.3)", text: theme.colors.emerald.text },
  warning: { bg: theme.colors.warningFaded, border: "rgba(227, 176, 75,0.3)", text: theme.colors.amber.text },
  error: { bg: theme.colors.errorFaded, border: "rgba(239,68,68,0.3)", text: theme.colors.rose.text },
  info: { bg: theme.colors.infoFaded, border: "rgba(59,130,246,0.3)", text: theme.colors.sky.text },
  neutral: { bg: "rgba(255,255,255,0.05)", border: theme.colors.border, text: theme.colors.textTertiary },
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
