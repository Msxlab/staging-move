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
import { Lock } from "lucide-react-native";
import { useAppTheme, type Theme } from "@/lib/theme";
import { hapticLight } from "@/lib/haptics";
import { usePressScale } from "@/lib/use-press-scale";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline" | "gradient";
  /**
   * `cta` — the unified onboarding CTA size (design bundle-3 `.obc`):
   * 54px tall, 14px radius, 16px/700 label. Additive; existing call sites
   * on sm/md/lg are untouched.
   */
  size?: "sm" | "md" | "lg" | "cta";
  loading?: boolean;
  disabled?: boolean;
  /**
   * How a disabled button reads. `opacity` is the legacy 0.5-dim (default,
   * preserves every existing call site). `neutral` is the design bundle's
   * REAL locked state (`.obc.is-locked`): flat neutral fill + muted label,
   * no glow, no icons, no opacity hack. Applies to the solid variants;
   * `gradient` keeps its legacy dim.
   */
  disabledTone?: "opacity" | "neutral";
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
  disabledTone = "opacity",
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
  // Real locked state (`.is-locked`): neutral fill, muted label, icons hidden
  // (the design swaps the arrow out entirely rather than ghosting it).
  // A disabled gradient CTA dimmed to 0.5 opacity washes out illegibly on the
  // light canvas (pale-on-pale). Treat any disabled gradient like the neutral
  // "locked" state — a readable card-fill with muted label — instead.
  const neutralDisabled = (disabledTone === "neutral" || variant === "gradient") && disabled;

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
    neutralDisabled ? styles.disabledNeutral : (disabled || loading) && styles.disabled,
    style,
  ];

  const textStyles = [
    styles.text,
    styles[`text_${variant}`],
    styles[`textSize_${size}`],
    neutralDisabled ? styles.textDisabledNeutral : (disabled || loading) && styles.textDisabled,
    textStyle,
  ];

  const content = loading ? (
    <ActivityIndicator
      size="small"
      color={variant === "primary" || variant === "gradient" ? "#fff" : theme.colors.primary}
    />
  ) : (
    <>
      {/* Locked read (design `.obc.is-locked`): the caller's icons are swapped
          for a small lock glyph so the button itself says "not yet" instead of
          merely looking dimmer. Legacy opacity-disabled call sites unchanged. */}
      {neutralDisabled ? <Lock size={15} color={theme.colors.textMuted} /> : icon}
      <Text style={textStyles}>{title}</Text>
      {neutralDisabled ? null : trailingIcon}
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
          style={
            neutralDisabled && !loading
              ? [styles.base, styles[`size_${size}`], fullWidth && styles.fullWidth, styles.disabledNeutral, style]
              : [(disabled || loading) && styles.disabled, style]
          }
        >
          {neutralDisabled && !loading ? (
            content
          ) : (
            <LinearGradient
              colors={[theme.colors.primaryLight, theme.colors.primary, theme.colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
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
          )}
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
    borderColor: theme.colors.accentBorder,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  danger: {
    backgroundColor: theme.colors.errorFaded,
    borderWidth: 1,
    // Aurora coral border to match `semanticColors.danger` (#E25C5C).
    borderColor: "rgba(226, 92, 92, 0.30)",
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
  // Unified onboarding CTA (`.obc`): ~54px tall, 14px radius. minHeight (not
  // a fixed height) so large font-scale settings can still grow the button.
  size_cta: {
    minHeight: 54,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: theme.radius.lg,
  },
  fullWidth: {
    width: "100%",
  },
  disabled: {
    opacity: 0.5,
  },
  // Real locked state (`.obc.is-locked`) — flat neutral surface, no glow, no
  // opacity hack. Shadow fields zeroed to cancel the primary variant's glow.
  disabledNeutral: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: "transparent",
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
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
  // Unified onboarding CTA label: 16px / 700, slight tightening (`.obc`).
  textSize_cta: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0,
  },
  textDisabled: {
    opacity: 0.7,
  },
  textDisabledNeutral: {
    color: theme.colors.textMuted,
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
