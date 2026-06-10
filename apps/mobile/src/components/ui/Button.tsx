import React, { useMemo, useState } from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useAppTheme, type Theme } from "@/lib/theme";
import { hapticLight } from "@/lib/haptics";
import { usePressScale } from "@/lib/use-press-scale";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline" | "gradient";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon,
  iconRight,
  rightIcon,
  fullWidth = false,
  accessibilityLabel,
  accessibilityHint,
  style,
  textStyle,
}: ButtonProps) {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const interactive = !disabled && !loading;
  const trailingIcon = rightIcon || iconRight;

  // Aurora shimmer sweep — a one-shot highlight strip that sweeps across
  // primary CTAs on press (Edition VII handoff, additions.css
  // `.ca-cta.primary::after`: a skewed translateX'd gradient strip).
  // Runs once per tap (~600ms) and is fully disabled under reduce-motion,
  // matching the handoff's `prefers-reduced-motion` block. The existing
  // springy press feedback (usePressScale) is untouched.
  const reduceMotion = useReducedMotion();
  const isPrimaryCta = variant === "primary" || variant === "gradient";
  const shimmerEnabled = isPrimaryCta && !reduceMotion;
  const shimmer = useSharedValue(0);
  const [shimmerWidth, setShimmerWidth] = useState(0);
  const onShimmerLayout = shimmerEnabled
    ? (e: LayoutChangeEvent) => {
        const w = Math.round(e.nativeEvent.layout.width);
        setShimmerWidth((prev) => (prev === w ? prev : w));
      }
    : undefined;
  const stripWidth = Math.max(36, shimmerWidth * 0.45);
  const shimmerAnimatedStyle = useAnimatedStyle(
    () => ({
      // Invisible at rest (progress 0) and after the sweep completes (1).
      opacity: interpolate(shimmer.value, [0, 0.08, 0.85, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: -stripWidth + shimmer.value * (shimmerWidth + stripWidth * 2) },
        { skewX: "-20deg" },
      ],
    }),
    [stripWidth, shimmerWidth],
  );
  const shimmerRadius =
    size === "sm" ? theme.radius.sm : size === "lg" ? theme.radius.xl : theme.radius.lg;
  const shimmerOverlay =
    shimmerEnabled && shimmerWidth > 0 ? (
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: shimmerRadius, overflow: "hidden" }]}
      >
        <Animated.View style={[styles.shimmerStrip, { width: stripWidth }, shimmerAnimatedStyle]}>
          <LinearGradient
            // Achromatic white highlight per the Aurora handoff
            // (`.ca-cta.primary::after` — rgba(255,255,255,.45) sweep).
            colors={["rgba(255, 255, 255, 0)", "rgba(255, 255, 255, 0.4)", "rgba(255, 255, 255, 0)"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
    ) : null;

  const handlePress = () => {
    if (!loading && !disabled) {
      hapticLight();
      if (shimmerEnabled) {
        shimmer.value = 0;
        shimmer.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) });
      }
      onPress();
    }
  };

  const buttonStyles = [
    styles.base,
    styles[variant],
    styles[`size_${size}`],
    fullWidth && styles.fullWidth,
    (disabled || loading) && styles.disabled,
    style,
  ];

  const textStyles = [
    styles.text,
    styles[`text_${variant}`],
    styles[`textSize_${size}`],
    (disabled || loading) && styles.textDisabled,
    textStyle,
  ];

  const content = loading ? (
    <ActivityIndicator
      size="small"
      color={variant === "primary" || variant === "gradient" ? "#fff" : theme.colors.primary}
    />
  ) : (
    <>
      {icon}
      <Text style={textStyles}>{title}</Text>
      {trailingIcon}
    </>
  );

  if (variant === "gradient") {
    return (
      <Animated.View style={animatedStyle}>
        <TouchableOpacity
          onPress={handlePress}
          onPressIn={interactive ? onPressIn : undefined}
          onPressOut={interactive ? onPressOut : undefined}
          disabled={disabled || loading}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel || title}
          accessibilityHint={accessibilityHint}
          accessibilityState={{ disabled: disabled || loading }}
          style={[(disabled || loading) && styles.disabled, style]}
        >
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.accent]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            onLayout={onShimmerLayout}
            style={[
              styles.base,
              styles[`size_${size}`],
              fullWidth && styles.fullWidth,
              { ...theme.shadow.glow },
            ]}
          >
            {content}
            {shimmerOverlay}
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[animatedStyle, fullWidth && styles.fullWidth]}>
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={interactive ? onPressIn : undefined}
        onPressOut={interactive ? onPressOut : undefined}
        disabled={disabled || loading}
        onLayout={onShimmerLayout}
        style={buttonStyles}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || title}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: disabled || loading }}
      >
        {content}
        {shimmerOverlay}
      </TouchableOpacity>
    </Animated.View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: theme.radius.lg,
  },
  primary: {
    backgroundColor: theme.colors.primary,
    ...theme.shadow.glow,
  },
  secondary: {
    backgroundColor: theme.colors.primaryFaded,
    borderWidth: 1,
    // Aurora cool 30% — matches `theme.colors.primary` (#7FB6E8).
    borderColor: "rgba(127, 182, 232, 0.30)",
  },
  ghost: {
    backgroundColor: "transparent",
  },
  danger: {
    backgroundColor: theme.colors.errorFaded,
    borderWidth: 1,
    // Aurora coral border to match `semanticColors.danger` (#F08C8E).
    borderColor: "rgba(240, 140, 142, 0.30)",
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  gradient: {
    backgroundColor: "transparent",
  },
  size_sm: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
  },
  size_md: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  size_lg: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: theme.radius.xl,
  },
  fullWidth: {
    width: "100%",
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontWeight: "600",
  },
  text_primary: {
    color: "#ffffff",
  },
  text_secondary: {
    color: theme.colors.orange.text,
  },
  text_ghost: {
    color: theme.colors.textSecondary,
  },
  text_danger: {
    color: theme.colors.error,
  },
  text_outline: {
    color: theme.colors.textSecondary,
  },
  text_gradient: {
    color: "#ffffff",
  },
  textSize_sm: {
    fontSize: 13,
  },
  textSize_md: {
    fontSize: 15,
  },
  textSize_lg: {
    fontSize: 17,
  },
  textDisabled: {
    opacity: 0.7,
  },
  // Aurora shimmer sweep strip — sized/positioned at render time
  // (width is ~45% of the measured button, per additions.css).
  shimmerStrip: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
  },
});
