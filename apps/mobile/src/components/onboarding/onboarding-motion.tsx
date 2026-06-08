import React from "react";
import { View, StyleSheet, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  withSequence,
  withSpring,
  cancelAnimation,
} from "react-native-reanimated";
import { useAppTheme } from "@/lib/theme";

/**
 * Onboarding motion primitives — deliberately tiny, all on the Reanimated UI
 * thread (no setInterval / JS re-render loops), and every one settles instantly
 * under reduce-motion. Amplitudes stay at or under PlanHero's ±1px idle ceiling
 * for translateY-style motion; the only larger travel is the one-shot step
 * cross-fade slide (8px), which reads as a calm page turn, not a bounce.
 *
 * None of these gate navigation or readiness — they are purely decorative.
 */

/**
 * StepTransition — wraps the active onboarding step's content and plays a light
 * cross-fade + short upward slide whenever `stepKey` changes. We key the inner
 * tree on `stepKey` so React remounts it; the fresh mount re-runs the entrance
 * (and re-triggers any staggered children inside). Travel is 8px and the fade
 * is 220ms — enough to feel like a page turn, far too small to feel busy.
 */
export function StepTransition({
  stepKey,
  children,
  style,
}: {
  stepKey: string | number;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const reduceMotion = useReducedMotion();
  // 0 → 1 drives opacity 0 → 1 and translateY 8 → 0.
  const enter = useSharedValue(reduceMotion ? 1 : 0);

  React.useEffect(() => {
    if (reduceMotion) {
      enter.value = 1;
      return;
    }
    enter.value = 0;
    enter.value = withTiming(1, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
    return () => {
      cancelAnimation(enter);
    };
    // Re-run on every step change (the remount handles the children).
  }, [stepKey, reduceMotion, enter]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 8 }],
  }));

  return (
    <Animated.View key={stepKey} style={[animatedStyle, style]}>
      {children}
    </Animated.View>
  );
}

/**
 * StaggerItem — a featherweight entrance for list rows (option chips, recommended
 * cards). Fades in + lifts 6px, with a per-index delay so a list "cascades" in
 * rather than popping all at once. Delay is capped so long lists never feel slow.
 * Honours reduce-motion (renders settled). Cleans its animation up on unmount.
 */
export function StaggerItem({
  index,
  children,
  style,
  baseDelay = 24,
  maxDelay = 260,
}: {
  index: number;
  children: React.ReactNode;
  style?: ViewStyle;
  baseDelay?: number;
  maxDelay?: number;
}) {
  const reduceMotion = useReducedMotion();
  const enter = useSharedValue(reduceMotion ? 1 : 0);

  React.useEffect(() => {
    if (reduceMotion) {
      enter.value = 1;
      return;
    }
    const delay = Math.min(index * baseDelay, maxDelay);
    // Stagger via a leading hold (a 0-valued timing of `delay` ms) followed by
    // the actual entrance — all on the UI thread, no JS timer.
    enter.value = withSequence(
      withTiming(0, { duration: delay }),
      withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) }),
    );
    return () => {
      cancelAnimation(enter);
    };
  }, [index, baseDelay, maxDelay, reduceMotion, enter]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 6 }],
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}

/**
 * OnboardingProgressBar — a single continuous track with an animated fill that
 * springs to the current step's fraction, replacing the old hard-swap dot row.
 * The fill width eases between steps so forward/back navigation reads as smooth
 * progress. A faint "pulse" overlay can be fired on step-complete (see `pulseTick`)
 * for a gentle confirmation shimmer. Reduce-motion: fill jumps instantly, no pulse.
 */
export function OnboardingProgressBar({
  step,
  total,
  pulseTick = 0,
}: {
  step: number;
  total: number;
  pulseTick?: number;
}) {
  const theme = useAppTheme();
  const reduceMotion = useReducedMotion();
  // Fraction filled: completed steps count as done; the current step is shown
  // as "in progress" by filling up to and including it. We fill (step+1)/total
  // so even step 0 shows a sliver, signalling "you've started".
  const target = Math.max(0, Math.min(1, (step + 1) / total));
  const fill = useSharedValue(reduceMotion ? target : 0);
  const pulse = useSharedValue(0);

  React.useEffect(() => {
    if (reduceMotion) {
      fill.value = target;
      return;
    }
    // Calm spring — well-damped, no overshoot past the target.
    fill.value = withSpring(target, { mass: 0.7, damping: 18, stiffness: 120 });
    return () => {
      cancelAnimation(fill);
    };
  }, [target, reduceMotion, fill]);

  // One-shot confirmation shimmer on step-complete.
  const firstPulse = React.useRef(true);
  React.useEffect(() => {
    if (firstPulse.current) {
      firstPulse.current = false;
      return;
    }
    if (reduceMotion) return;
    pulse.value = withSequence(
      withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 420, easing: Easing.in(Easing.quad) }),
    );
    return () => {
      cancelAnimation(pulse);
    };
  }, [pulseTick, reduceMotion, pulse]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fill.value * 100}%`,
  }));

  // The pulse brightens the fill slightly (opacity 1 → ~1, overlay 0 → 0.5 → 0).
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value * 0.5,
  }));

  return (
    <View
      style={[styles.track, { backgroundColor: theme.colors.border }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: step + 1 }}
    >
      <Animated.View
        style={[styles.fill, { backgroundColor: theme.colors.primary }, fillStyle]}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "#ffffff", borderRadius: 999 },
            pulseStyle,
          ]}
          pointerEvents="none"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 4,
    borderRadius: 999,
    overflow: "hidden",
    width: "100%",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
  },
});
