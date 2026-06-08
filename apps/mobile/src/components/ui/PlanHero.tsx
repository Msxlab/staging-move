import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";
import { useAppTheme, type Theme } from "@/lib/theme";
import { useAuthStore } from "@/lib/auth-store";
import { RaccoonMascot, type RaccoonVariant } from "@/components/ui/RaccoonMascot";

/**
 * One PlanHero crew member: wraps the static <RaccoonMascot/> with three layers
 * of life, all on the Reanimated UI thread (no setInterval / JS re-render loop):
 *   1. ENTRANCE — a spring scale 0.9 → 1 + fade-in on mount.
 *   2. IDLE     — an infinite, tiny breathing bob (translateY + micro-scale),
 *                 STAGGERED per member via `index` (different delay + period) so
 *                 the household never bobs in lockstep.
 *   3. CELEBRATE — a one-shot bounce (scale pop via withSequence) fired whenever
 *                 `celebrateTick` changes (e.g. an invite is accepted).
 * Honours reduce-motion: skips the loops + entrance, renders the settled pose.
 */
function AnimatedMascot({
  index,
  celebrateTick,
  size,
  fur,
  variant,
  suited,
}: {
  index: number;
  celebrateTick: number;
  size: number;
  fur: string;
  variant: RaccoonVariant;
  suited: boolean;
}) {
  const reduceMotion = useReducedMotion();

  // Entrance + celebration share the scale channel; idle owns bob (translateY)
  // and a separate breathing scale so they compose without fighting.
  const enter = useSharedValue(reduceMotion ? 1 : 0);
  const bob = useSharedValue(0);
  const pop = useSharedValue(0);

  // Stagger constants per member — distinct phase + period keep them out of sync.
  const delay = 90 * index;
  const period = 1700 + index * 240;

  React.useEffect(() => {
    if (reduceMotion) {
      enter.value = 1;
      return;
    }
    // Entrance spring (scale 0.9 → 1 via `enter` 0 → 1) + the fade comes from the
    // same driver in the worklet below.
    enter.value = withDelay(delay, withSpring(1, { mass: 0.6, damping: 11, stiffness: 130 }));
    // Infinite breathing bob, yo-yo so there are no seams; staggered start + period.
    bob.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: period, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
    return () => {
      cancelAnimation(enter);
      cancelAnimation(bob);
    };
  }, [reduceMotion, delay, period, enter, bob]);

  // Celebration: a one-shot pop. Skipped on the initial mount (tick 0) and when
  // reduce-motion is on.
  const firstTick = React.useRef(true);
  React.useEffect(() => {
    if (firstTick.current) {
      firstTick.current = false;
      return;
    }
    if (reduceMotion) return;
    // Staggered so the crew pops as a little wave, not a single thud.
    pop.value = withDelay(
      70 * index,
      withSequence(
        withTiming(1, { duration: 180, easing: Easing.out(Easing.back(2.4)) }),
        withSpring(0, { mass: 0.5, damping: 9, stiffness: 160 }),
      ),
    );
    // Cancel any in-flight pop if the crew unmounts (or celebrateTick changes)
    // mid-animation, so a queued worklet never lands on a torn-down node.
    return () => cancelAnimation(pop);
  }, [celebrateTick, reduceMotion, index, pop]);

  const style = useAnimatedStyle(() => {
    // entrance: 0 → 1 maps scale 0.9 → 1 and opacity 0 → 1.
    const enterScale = 0.9 + enter.value * 0.1;
    const opacity = enter.value;
    // breathing: bob 0..1 -> translateY +1..-1 and a hair of scale.
    const bobY = (0.5 - bob.value) * 2;
    const breatheScale = 1 + (bob.value - 0.5) * 0.012;
    // celebration pop adds up to +0.18 scale and a small lift.
    const popScale = pop.value * 0.18;
    const popY = pop.value * -4;
    return {
      opacity,
      transform: [
        { translateY: bobY + popY },
        { scale: enterScale * breatheScale + popScale },
      ],
    };
  });

  return (
    <Animated.View style={style}>
      <RaccoonMascot size={size} fur={fur} variant={variant} suited={suited} />
    </Animated.View>
  );
}

/**
 * Plan-themed welcome hero on the dashboard for Family / Pro members: a kawaii
 * raccoon household (dad / mom / kid) with a plan-colored gradient. Pro dresses
 * the crew in top hats + bow ties. Colors come from the active (plan-tinted)
 * theme, so it is crystal-green for Family and premium violet/gold for Pro.
 * Renders nothing for Individual / unknown plans.
 */
/**
 * @param celebrateTick A counter the dashboard bumps to fire a one-shot
 *   celebration bounce on the crew (e.g. after a household invite is accepted).
 *   Decoupled by design: PlanHero just watches the number change.
 */
export function PlanHero({ celebrateTick = 0 }: { celebrateTick?: number }) {
  const theme = useAppTheme();
  const styles = React.useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();
  const planTier = useAuthStore((s) => s.planTier);
  const key = (planTier ?? "").toUpperCase();
  if (key !== "FAMILY" && key !== "PRO") return null;

  const isPro = key === "PRO";
  const title = isPro ? t("plan.proTitle", "Pro household") : t("plan.familyTitle", "Family household");
  const subtitle = isPro
    ? t("plan.proSubtitle", "Premium tools for your whole crew.")
    : t("plan.familySubtitle", "Everyone under one roof, together.");

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <LinearGradient
        colors={[`${theme.colors.primary}2E`, `${theme.colors.primary}00`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1.1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.crew}>
        <AnimatedMascot index={0} celebrateTick={celebrateTick} size={64} fur="#94a3b3" variant="dad" suited={isPro} />
        <View style={styles.overlap}>
          <AnimatedMascot index={1} celebrateTick={celebrateTick} size={54} fur="#aeb9c6" variant="mom" suited={isPro} />
        </View>
        <View style={styles.overlap}>
          <AnimatedMascot index={2} celebrateTick={celebrateTick} size={42} fur="#bcc6d1" variant="kid" suited={isPro} />
        </View>
      </View>
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.pill}>
        <Text style={styles.pillText}>{isPro ? "PRO" : "FAMILY"}</Text>
      </View>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    wrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 22,
      overflow: "hidden",
      backgroundColor: t.colors.card,
      borderWidth: 1,
      borderColor: `${t.colors.primary}3D`,
    },
    crew: { flexDirection: "row", alignItems: "flex-end" },
    overlap: { marginLeft: -14 },
    copy: { flex: 1, paddingLeft: 4 },
    title: { fontSize: 15.5, fontWeight: "800", color: t.colors.text },
    subtitle: { fontSize: 12, color: t.colors.textSecondary, marginTop: 2 },
    pill: {
      paddingHorizontal: 11,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: t.colors.primary,
    },
    pillText: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.6, color: "#fff" },
  });
