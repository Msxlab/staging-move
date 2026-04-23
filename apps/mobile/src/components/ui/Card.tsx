import React from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  type AccessibilityRole,
  type AccessibilityState,
  type ViewStyle,
} from "react-native";
import { theme } from "@/lib/theme";

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  variant?: "default" | "elevated" | "bordered" | "glow" | "glass";
  accessible?: boolean;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityState?: AccessibilityState;
}

export function Card({
  children,
  onPress,
  style,
  variant = "default",
  accessible,
  accessibilityRole,
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
}: CardProps) {
  const cardStyle = [styles.base, styles[variant], style];

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={cardStyle}
        accessible={accessible}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={accessibilityState}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={cardStyle}
      accessible={accessible}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={accessibilityState}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
  },
  default: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  elevated: {
    backgroundColor: theme.colors.elevated,
    ...theme.shadow.md,
  },
  bordered: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  glow: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: "rgba(212, 132, 106, 0.2)",
    ...theme.shadow.glow,
  },
  glass: {
    backgroundColor: theme.colors.glass.bg,
    borderWidth: 1,
    borderColor: theme.colors.glass.border,
  },
});
