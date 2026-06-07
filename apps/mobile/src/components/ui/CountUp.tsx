import React, { useEffect, useState } from "react";
import { Text, type TextStyle, type StyleProp } from "react-native";
import {
  Easing,
  cancelAnimation,
  runOnJS,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

/**
 * A number that animates up to `value` on mount and whenever `value` changes
 * (e.g. a dashboard refresh). Subtle by design: ~600ms ease-out, and instant
 * under reduce-motion.
 *
 * Reanimated can't drive a <Text/>'s children directly, so a single shared
 * value tweens on the UI thread (from its current position to the new target)
 * and a derived worklet pushes rounded frames back to JS state via runOnJS.
 * Animating the shared value's *current* position to the target means a
 * mid-flight `value` change re-targets smoothly rather than snapping. The
 * driver is cancelled on unmount.
 *
 * `format` lets callers render currency / plain integers from the same numeric
 * tween (so the $-sign and thousands separators count up too).
 */
export function CountUp({
  value,
  duration = 600,
  format,
  style,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  style?: StyleProp<TextStyle>;
}) {
  const reduceMotion = useReducedMotion();
  // The animated numeric position. Starts at 0 so the first mount counts up.
  const animated = useSharedValue(reduceMotion ? value : 0);
  const [display, setDisplay] = useState(reduceMotion ? value : 0);

  useEffect(() => {
    if (reduceMotion || duration <= 0) {
      cancelAnimation(animated);
      animated.value = value;
      setDisplay(value);
      return;
    }
    // Tween from wherever we are now toward the new target.
    animated.value = withTiming(value, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, reduceMotion]);

  useEffect(() => {
    return () => {
      cancelAnimation(animated);
    };
  }, [animated]);

  // Bridge UI-thread frames to JS state. Cheap: only fires while animating.
  useDerivedValue(() => {
    runOnJS(setDisplay)(animated.value);
  });

  const text = format ? format(display) : String(Math.round(display));
  return (
    <Text
      style={style}
      accessibilityLabel={format ? format(value) : String(Math.round(value))}
    >
      {text}
    </Text>
  );
}
