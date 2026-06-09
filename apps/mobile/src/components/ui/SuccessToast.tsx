import React, { useEffect, useMemo, useRef } from "react";
import { Text, StyleSheet } from "react-native";
import { CheckCircle2 } from "lucide-react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";
import { useAppTheme, type Theme } from "@/lib/theme";
import { RaccoonMascot } from "@/components/ui/RaccoonMascot";
import { hapticSuccess } from "@/lib/haptics";

interface SuccessToastProps {
  /** Flip to true to fire the toast; flip back to false to reset for re-use. */
  visible: boolean;
  /** Headline line (e.g. "Address added"). */
  message: string;
  /** Optional second line of supporting detail. */
  detail?: string;
  /** How long the toast stays before auto-hiding (ms). Default 1800. */
  duration?: number;
  /** Called when the toast finishes hiding so the parent can reset `visible`. */
  onHide?: () => void;
}

/**
 * SUCCESS MICRO-MOMENT — a small celebratory toast that closes the loop at
 * high-intent moments (address create, service create, budget actual saved).
 * Fires a success haptic + a tiny raccoon mascot + a checkmark.
 *
 * Reduce-motion-safe: under reduce-motion we skip the pop/slide entirely and
 * snap to fully visible (haptics are tactile, not visual motion, so they still
 * fire). OTA-safe: pure JS + reanimated + react-native-svg mascot — no binary
 * asset, no native module. Auto-hides after `duration` and calls `onHide`.
 */
export function SuccessToast({
  visible,
  message,
  detail,
  duration = 1800,
  onHide,
}: SuccessToastProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const reduceMotion = useReducedMotion();

  const progress = useSharedValue(0); // 0 hidden → 1 shown
  const pop = useSharedValue(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) {
      // Parent reset — make sure we're hidden without firing onHide again.
      progress.value = 0;
      pop.value = 0;
      return;
    }

    hapticSuccess();

    const finish = () => {
      onHide?.();
    };

    if (reduceMotion) {
      // No motion: snap in, hold, snap out.
      progress.value = 1;
      pop.value = 0;
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => {
        progress.value = 0;
        finish();
      }, duration);
      return () => {
        if (hideTimer.current) clearTimeout(hideTimer.current);
      };
    }

    progress.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) });
    // A single celebratory pop on the mascot/checkmark, then settle.
    pop.value = withSequence(
      withTiming(1, { duration: 220, easing: Easing.out(Easing.back(2.4)) }),
      withDelay(140, withSpring(0, { mass: 0.5, damping: 11, stiffness: 150 })),
    );

    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      progress.value = withTiming(
        0,
        { duration: 200, easing: Easing.in(Easing.cubic) },
        (done) => {
          if (done) runOnJS(finish)();
        },
      );
    }, duration);

    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      cancelAnimation(progress);
      cancelAnimation(pop);
    };
  }, [visible, reduceMotion, duration, onHide, progress, pop]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 16 }],
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pop.value * 0.18 }],
  }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.container, containerStyle]}
      pointerEvents="none"
      accessibilityRole="alert"
      accessibilityLabel={detail ? `${message}. ${detail}` : message}
    >
      <Animated.View style={[styles.mascot, badgeStyle]}>
        <RaccoonMascot size={34} variant="kid" />
      </Animated.View>
      <Animated.View style={[styles.checkWrap, badgeStyle]}>
        <CheckCircle2 size={20} color={theme.colors.success} />
      </Animated.View>
      <Text style={styles.message} numberOfLines={1}>
        {message}
      </Text>
      {detail ? (
        <Text style={styles.detail} numberOfLines={1}>
          {detail}
        </Text>
      ) : null}
    </Animated.View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      position: "absolute",
      left: 20,
      right: 20,
      bottom: 32,
      zIndex: 100,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: theme.radius.xl,
      backgroundColor: theme.colors.elevated,
      borderWidth: 1,
      borderColor: theme.colors.successFaded,
      ...theme.shadow.md,
    },
    mascot: { width: 34, alignItems: "center", justifyContent: "center" },
    checkWrap: { alignItems: "center", justifyContent: "center" },
    message: { flex: 1, fontSize: 14, fontWeight: "700", color: theme.colors.text },
    detail: { fontSize: 12, color: theme.colors.textTertiary },
  });
