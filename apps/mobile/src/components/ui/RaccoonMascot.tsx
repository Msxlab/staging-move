import React from "react";
import { View } from "react-native";
import { MoveRaccoon, type RaccoonMood } from "@/components/move";

export type RaccoonVariant = "dad" | "mom" | "kid";
export type RaccoonPose = "neutral" | "happy" | "sad" | "celebrate";

type Props = {
  /** Rendered width in px; height keeps the legacy 124:134 footprint stable. */
  size?: number;
  /** Kept for source compatibility; colors now come from the active theme. */
  fur?: string;
  variant?: RaccoonVariant;
  /** Kept for source compatibility; paid-plan styling is expressed by mood. */
  suited?: boolean;
  pose?: RaccoonPose;
};

function resolveSourceThemeMood(variant: RaccoonVariant, pose: RaccoonPose, suited: boolean): RaccoonMood {
  if (pose === "sad") return "alert";
  if (pose === "celebrate" || suited) return "approved";
  if (pose === "happy") return "happy";
  if (variant === "mom") return "thinking";
  if (variant === "kid") return "happy";
  return "calm";
}

/**
 * Compatibility wrapper for older mobile screens that still call the previous
 * household mascot API. The rendered artwork now uses the source-theme
 * geometric LocateFlow mark so legacy call sites do not fall back to the old
 * visual style.
 */
export function RaccoonMascot({ size = 100, variant = "kid", suited = false, pose = "neutral" }: Props) {
  const height = Math.round(size * (134 / 124));
  const markSize = Math.min(size, height);

  return (
    <View style={{ width: size, height, alignItems: "center", justifyContent: "center" }}>
      <MoveRaccoon size={markSize} mood={resolveSourceThemeMood(variant, pose, suited)} />
    </View>
  );
}
