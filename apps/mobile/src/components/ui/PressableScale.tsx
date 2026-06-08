import React from "react";
import {
  TouchableOpacity,
  type AccessibilityRole,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated from "react-native-reanimated";
import { usePressScale } from "@/lib/use-press-scale";

/**
 * PressableScale — a drop-in TouchableOpacity that adds the app's subtle springy
 * press feedback (via usePressScale) to surfaces that aren't a <Card/>. Use it
 * for header "+" add buttons, icon buttons, and other key tap targets so the
 * press feel is consistent across the app and not just on cards.
 *
 * The scale spring is calm + reduce-motion-safe (usePressScale pins scale at 1
 * and no-ops its handlers under reduce-motion), so the only feedback then is the
 * host's activeOpacity. The wrapping Animated.View carries the transform while
 * the inner TouchableOpacity keeps full a11y + the original layout style.
 */
export function PressableScale({
  children,
  onPress,
  style,
  disabled,
  min = 0.94,
  activeOpacity = 0.7,
  accessibilityRole = "button",
  accessibilityLabel,
  accessibilityHint,
  hitSlop,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  /** Press-in target scale; defaults to a slightly punchier 0.94 for buttons. */
  min?: number;
  activeOpacity?: number;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  hitSlop?: { top?: number; bottom?: number; left?: number; right?: number };
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(min);

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
        activeOpacity={activeOpacity}
        style={style}
        hitSlop={hitSlop}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: !!disabled }}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}
