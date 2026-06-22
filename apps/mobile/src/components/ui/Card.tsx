import React, { useMemo } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  type AccessibilityRole,
  type AccessibilityState,
  type ViewStyle,
} from "react-native";
import Animated from "react-native-reanimated";
import { useAppTheme, type Theme } from "@/lib/theme";
import { usePressScale } from "@/lib/use-press-scale";

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
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
  onLongPress,
  style,
  variant = "default",
  accessible,
  accessibilityRole,
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
}: CardProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.97);
  const cardStyle = [styles.base, styles[variant], style];

  if (onPress || onLongPress) {
    return (
      <Animated.View style={animatedStyle}>
        <TouchableOpacity
          onPress={onPress}
          onLongPress={onLongPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
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
      </Animated.View>
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

const makeStyles = (theme: Theme) => StyleSheet.create({
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
    // Move Sapphire ring (Edition VIII) — matches `--line-foil` on web.
    borderColor: "rgba(91, 141, 239, 0.30)",
    ...theme.shadow.glow,
  },
  glass: {
    backgroundColor: theme.colors.glass.bg,
    borderWidth: 1,
    borderColor: theme.colors.glass.border,
  },
});
