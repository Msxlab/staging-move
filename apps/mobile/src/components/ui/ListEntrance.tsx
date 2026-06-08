import React from "react";
import type { ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";

/**
 * ListEntrance — a featherweight staggered entrance for list rows (address /
 * service / moving / provider cards). Each row fades in and lifts a few px, with
 * a per-index delay so a freshly-loaded list "cascades" in instead of popping
 * all at once. The travel (8px) sits at the calm end of the app's motion budget
 * — well under the page-turn slide — and the delay is capped so long lists never
 * feel sluggish.
 *
 * Implementation notes that keep this safe:
 *   - All motion runs on the Reanimated UI thread (a leading 0-valued timing for
 *     the stagger hold, then the entrance) — no setInterval / JS re-render loop.
 *   - Honours reduce-motion EVERYWHERE: renders settled (opacity 1, no offset)
 *     and never schedules an animation.
 *   - Cancels its animation on unmount so backing out of a screen mid-cascade
 *     never leaves a dangling worklet.
 *   - Purely decorative — it never gates rendering, navigation, or readiness.
 *     The row's content is always mounted; only its opacity/offset animate.
 *
 * Re-keying note: this plays its entrance once per mount. List screens should
 * leave the parent list mounted across refreshes (the data simply updates), so
 * a pull-to-refresh does NOT re-trigger the cascade — only the first paint and
 * genuine remounts (e.g. tab switch) do, which is the intended feel.
 */
export function ListEntrance({
  index,
  children,
  style,
  baseDelay = 28,
  maxDelay = 240,
  distance = 8,
  duration = 260,
}: {
  index: number;
  children: React.ReactNode;
  style?: ViewStyle;
  /** Per-item delay step in ms. */
  baseDelay?: number;
  /** Hard cap on the cumulative delay so long lists stay snappy. */
  maxDelay?: number;
  /** Upward translate distance in px (kept small/calm). */
  distance?: number;
  /** Entrance fade/slide duration in ms. */
  duration?: number;
}) {
  const reduceMotion = useReducedMotion();
  const enter = useSharedValue(reduceMotion ? 1 : 0);

  React.useEffect(() => {
    if (reduceMotion) {
      enter.value = 1;
      return;
    }
    const delay = Math.min(index * baseDelay, maxDelay);
    enter.value = withSequence(
      withTiming(0, { duration: delay }),
      withTiming(1, { duration, easing: Easing.out(Easing.cubic) }),
    );
    return () => {
      cancelAnimation(enter);
    };
    // Re-run only if the slot index or motion preference changes; the data
    // inside `children` updating does not (and should not) replay the cascade.
  }, [index, baseDelay, maxDelay, duration, reduceMotion, enter]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * distance }],
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}
