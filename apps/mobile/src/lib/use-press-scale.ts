import { useCallback } from "react";
import {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

/**
 * Subtle springy press feedback for tappable surfaces (Button, Card).
 *
 * Returns an `animatedStyle` (a scale transform) plus `onPressIn`/`onPressOut`
 * handlers to wire into a Pressable/TouchableOpacity. Press-in springs the
 * surface to ~0.96; release springs it back to 1. The spring is calm (mass-1,
 * well-damped) so it settles quickly without a bouncy overshoot.
 *
 * Honours reduce-motion: the scale stays pinned at 1 and the handlers no-op,
 * so the only feedback is the host's existing activeOpacity.
 */
export function usePressScale(min = 0.96) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const onPressIn = useCallback(() => {
    if (reduceMotion) return;
    scale.value = withSpring(min, { mass: 0.5, damping: 16, stiffness: 320 });
  }, [reduceMotion, min, scale]);

  const onPressOut = useCallback(() => {
    if (reduceMotion) return;
    scale.value = withSpring(1, { mass: 0.5, damping: 14, stiffness: 280 });
  }, [reduceMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return { animatedStyle, onPressIn, onPressOut };
}
