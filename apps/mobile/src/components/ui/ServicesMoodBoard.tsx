import React, { useEffect, useMemo, useRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { RaccoonMascot, type RaccoonPose } from "@/components/ui/RaccoonMascot";

/**
 * MOOD-REACTIVE SERVICES BOARD
 *
 * The raccoon's pose reflects how many services the user is tracking — it goes
 * from SAD on an empty board, pops to CELEBRATE on the very first service (and
 * again at a healthy count), and reads HAPPY while momentum is building. Pure
 * UI: it is driven entirely by the `count` the screen already has from the
 * /api/services response — no new data, no API, no fabricated numbers.
 *
 * Honest by construction: the headline shows the real tracked count and the
 * subtitle is encouragement, never an invented statistic.
 *
 * Reduce-motion-safe: there is NO looping animation. When the pose changes we
 * play a single, short cross-fade (so the swap doesn't pop); under reduce-motion
 * we skip even that and snap to the settled pose. OTA-safe: react-native-svg +
 * reanimated only — no binary asset, no native module.
 */

export interface ServiceMood {
  pose: RaccoonPose;
  /** i18n key for the headline (count is interpolated). */
  titleKey: string;
  /** i18n key for the supporting line. */
  subtitleKey: string;
  /** Accent token used for the mood ring + headline tint. */
  tone: "muted" | "blue" | "mint";
}

/**
 * Pure, testable mapping from tracked-service count → mood.
 *
 * Thresholds:
 *   0      → SAD       "No services yet" (the empty-state nudge)
 *   1      → CELEBRATE "First service tracked!" (first-win milestone)
 *   2–4    → HAPPY     "Building momentum" (neutral-positive)
 *   5+     → CELEBRATE "Looking great" (healthy-count milestone)
 */
export function moodForServiceCount(count: number): ServiceMood {
  const n = Math.max(0, Math.floor(count || 0));
  if (n === 0) {
    return { pose: "sad", titleKey: "services.mood.emptyTitle", subtitleKey: "services.mood.emptySubtitle", tone: "muted" };
  }
  if (n === 1) {
    return { pose: "celebrate", titleKey: "services.mood.firstTitle", subtitleKey: "services.mood.firstSubtitle", tone: "mint" };
  }
  if (n < 5) {
    return { pose: "happy", titleKey: "services.mood.buildingTitle", subtitleKey: "services.mood.buildingSubtitle", tone: "blue" };
  }
  return { pose: "celebrate", titleKey: "services.mood.healthyTitle", subtitleKey: "services.mood.healthySubtitle", tone: "mint" };
}

interface ServicesMoodBoardProps {
  /** Number of services the user is currently tracking (real, from the API). */
  count: number;
  /** Mascot size in px. */
  size?: number;
}

export function ServicesMoodBoard({ count, size = 96 }: ServicesMoodBoardProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();

  const mood = useMemo(() => moodForServiceCount(count), [count]);
  const toneColor =
    mood.tone === "mint" ? theme.colors.emerald.text : mood.tone === "blue" ? theme.colors.primary : theme.colors.textMuted;

  // Single short cross-fade whenever the pose changes — never a loop. The first
  // render snaps in (no fade), so the board doesn't flash on mount.
  const fade = useSharedValue(1);
  const prevPose = useRef<RaccoonPose>(mood.pose);
  useEffect(() => {
    if (prevPose.current === mood.pose) return;
    prevPose.current = mood.pose;
    if (reduceMotion) {
      fade.value = 1;
      return;
    }
    fade.value = 0;
    fade.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
    return () => cancelAnimation(fade);
  }, [mood.pose, reduceMotion, fade]);

  const mascotStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + fade.value * 0.65,
    transform: [{ scale: 0.96 + fade.value * 0.04 }],
  }));

  const title = t(mood.titleKey, { count, defaultValue: defaultTitle(mood, count) });
  const subtitle = t(mood.subtitleKey, { defaultValue: defaultSubtitle(mood) });

  return (
    <View
      style={[styles.card, { borderColor: toneColor + "33", backgroundColor: toneColor + "0D" }]}
      accessibilityRole="summary"
      accessibilityLabel={`${title}. ${subtitle}`}
    >
      <View style={[styles.ring, { borderColor: toneColor + "30", backgroundColor: toneColor + "12" }]}>
        <Animated.View style={mascotStyle} accessible={false}>
          <RaccoonMascot size={size} variant="kid" fur="#aeb9c6" pose={mood.pose} />
        </Animated.View>
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

// Honest English fallbacks used when an i18n key is missing — count is real,
// copy is encouragement only (never an invented statistic).
function defaultTitle(mood: ServiceMood, count: number): string {
  switch (mood.pose) {
    case "sad":
      return "No services tracked yet";
    case "celebrate":
      return count === 1 ? "First service tracked!" : `${count} services tracked`;
    default:
      return `${count} services tracked`;
  }
}

function defaultSubtitle(mood: ServiceMood): string {
  switch (mood.pose) {
    case "sad":
      return "Add your first utility, bank, or subscription and the raccoon perks up.";
    case "happy":
      return "Nice momentum — keep adding what's tied to your home.";
    default:
      return "Your move tracking is looking healthy.";
  }
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      marginBottom: 16,
      padding: 14,
      borderRadius: 18,
      borderWidth: 1,
    },
    ring: {
      width: 108,
      height: 108,
      borderRadius: 54,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    copy: { flex: 1, minWidth: 0 },
    title: { fontSize: 16, fontWeight: "800", letterSpacing: 0 },
    subtitle: { fontSize: 12.5, color: theme.colors.textTertiary, marginTop: 4, lineHeight: 18 },
  });
