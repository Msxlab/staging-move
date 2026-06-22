import React from "react";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { MoveRaccoon } from "@/components/move";

/**
 * Back-compat wrapper for old splash/import paths.
 *
 * The full-body legacy mascot has been retired so every mobile surface uses the
 * source-theme geometric LocateFlow mark.
 */
export function RaccoonWalking({ size = 168 }: { size?: number }) {
  const reduceMotion = useReducedMotion();
  const markSize = Math.max(56, Math.round(size * 0.68));

  return (
    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(260)} pointerEvents="none">
      <MoveRaccoon size={markSize} mood="happy" />
    </Animated.View>
  );
}
