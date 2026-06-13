import React, { useEffect, useMemo, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight, CalendarClock, PartyPopper, Rocket, Sparkles, Truck } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";
import {
  getMoveCountdown,
  formatDateOnlyUtc,
  type RelocationChecklist,
} from "@locateflow/shared";
import { useAppTheme, type Theme } from "@/lib/theme";
import { RaccoonMascot } from "@/components/ui/RaccoonMascot";
import { hapticLight, hapticSuccess } from "@/lib/haptics";

/**
 * MOVE COMMAND CENTER — the dashboard's top-pinned engagement hero (mobile).
 * Parity with the web component:
 *   1. ACTIVE MOVE → countdown + readiness ring + single next-critical CTA.
 *   2. NO PLAN     → a warm "start your move" raccoon hero (not 0/0/$0).
 *
 * Readiness blends checklist %-done with critical-providers set-up-vs-needed.
 * The MILESTONE celebration (readiness 100% OR move day reached) fires a single
 * one-shot pop + glow + success haptic — reduce-motion-safe (skipped entirely
 * when reduce-motion is on; haptics are tactile, not visual motion) and latched
 * so it only runs once per mount. Animations cancel on unmount.
 */

export interface CommandCenterAction {
  id: string;
  name: string;
  category: string;
  reason?: string;
  deadline?: string;
}

interface Props {
  activePlan: { id: string; fromCity: string; toCity: string; moveDate: string } | null;
  checklist: RelocationChecklist | null;
  topAction: CommandCenterAction | null;
  missingCriticalCount: number;
  completedCriticalCount: number;
  state?: string | null;
  /**
   * COLD-START momentum floor. True when the user has genuinely completed the
   * first real setup steps for this plan — origin AND destination are set. This
   * is the ONLY thing that lifts the ring off a hard 0% before any task/provider
   * progress: we credit only setup the user actually did (never a fabricated
   * task completion). When false the ring behaves exactly as before.
   */
  hasOriginDestination?: boolean;
  onOpenPlan: () => void;
  onOpenAction: (action: CommandCenterAction) => void;
  onStartMove: () => void;
}

// Cold-start momentum floor (%). Having an active plan WITH origin + destination
// set is real, user-completed setup — so the ring starts here instead of a
// demotivating 0%. It is a floor only: any genuine task/provider progress that
// computes higher always wins. Kept low + honest (not a fake "you're 15% done").
const COLD_START_FLOOR = 6;

function computeReadiness(
  checklist: RelocationChecklist | null,
  completedCritical: number,
  missingCritical: number,
  hasOriginDestination = false,
): number {
  const signals: number[] = [];
  if (checklist && checklist.totalItems > 0) {
    signals.push(checklist.completedItems / checklist.totalItems);
  }
  const criticalTotal = completedCritical + missingCritical;
  if (criticalTotal > 0) {
    signals.push(completedCritical / criticalTotal);
  }
  const computed =
    signals.length === 0
      ? 0
      : Math.round((signals.reduce((a, b) => a + b, 0) / signals.length) * 100);
  // Floor the ring at a low non-zero ONLY when real setup is done. Never lowers
  // a genuinely higher score; never applies without origin+destination.
  const floored = hasOriginDestination ? Math.max(computed, COLD_START_FLOOR) : computed;
  return Math.max(0, Math.min(100, floored));
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * SVG readiness ring whose fill animates as `percent` changes, so clearing a
 * task visibly sweeps the ring forward. Reduce-motion-safe: when reduce-motion
 * is on we snap straight to the target (no timing). The numeric label is driven
 * by the same `percent` prop so it stays in lockstep with the parent's state.
 */
function ReadinessRing({ percent, color, track, label }: { percent: number; color: string; track: string; label: string }) {
  const size = 84;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const reduceMotion = useReducedMotion();

  const clamped = Math.max(0, Math.min(100, percent));
  // Shared progress fraction (0..1) animates toward the latest percent. Start at
  // the first value (no entrance sweep from 0 on mount under reduce-motion).
  const progress = useSharedValue(clamped / 100);

  useEffect(() => {
    const target = clamped / 100;
    if (reduceMotion) {
      progress.value = target;
      return;
    }
    progress.value = withTiming(target, {
      duration: 650,
      easing: Easing.out(Easing.cubic),
    });
    return () => cancelAnimation(progress);
  }, [clamped, reduceMotion, progress]);

  const animatedProps = useAnimatedProps(() => ({
    // Dash length grows with progress; the gap (c) keeps the rest of the ring empty.
    strokeDasharray: `${progress.value * c}, ${c}`,
  }));

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }} accessibilityLabel={label}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          animatedProps={animatedProps}
        />
      </Svg>
      <Text style={{ fontSize: 19, fontWeight: "800", color }}>{percent}%</Text>
    </View>
  );
}

export function MoveCommandCenter({
  activePlan,
  checklist,
  topAction,
  missingCriticalCount,
  completedCriticalCount,
  state,
  hasOriginDestination,
  onOpenPlan,
  onOpenAction,
  onStartMove,
}: Props) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();

  // Entrance + one-shot celebration share a single scale/glow channel.
  const enter = useSharedValue(reduceMotion ? 1 : 0);
  const pop = useSharedValue(0);
  const firedRef = useRef(false);

  const countdown = activePlan
    ? getMoveCountdown(activePlan.moveDate, { state })
    : null;
  const readiness = activePlan
    ? computeReadiness(checklist, completedCriticalCount, missingCriticalCount, hasOriginDestination)
    : 0;
  const milestoneReached = !!activePlan && (readiness >= 100 || (countdown?.phase ?? "upcoming") !== "upcoming");

  useEffect(() => {
    if (reduceMotion) {
      enter.value = 1;
      return;
    }
    enter.value = withSpring(1, { mass: 0.6, damping: 13, stiffness: 130 });
    return () => cancelAnimation(enter);
  }, [reduceMotion, enter]);

  // Milestone celebration: one-shot pop + glow + success haptic, latched so it
  // never re-fires; skipped under reduce-motion.
  useEffect(() => {
    if (!milestoneReached || firedRef.current) return;
    firedRef.current = true;
    if (reduceMotion) return;
    hapticSuccess();
    pop.value = withSequence(
      withTiming(1, { duration: 220, easing: Easing.out(Easing.back(2.2)) }),
      withDelay(160, withSpring(0, { mass: 0.5, damping: 10, stiffness: 150 })),
    );
    return () => cancelAnimation(pop);
  }, [milestoneReached, reduceMotion, pop]);

  const cardStyle = useAnimatedStyle(() => {
    const enterScale = 0.97 + enter.value * 0.03;
    const popScale = pop.value * 0.03;
    return {
      opacity: enter.value,
      transform: [{ scale: enterScale + popScale }],
    };
  });

  // ── NO-PLAN: warm "start your move" hero ──────────────────────────────────
  if (!activePlan) {
    return (
      <Animated.View style={[styles.card, styles.noPlanCard, cardStyle]} accessibilityRole="summary">
        <LinearGradient
          colors={[`${theme.colors.primary}24`, `${theme.colors.primary}00`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1.1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.noPlanTop}>
          <RaccoonMascot size={52} fur="#aeb9c6" variant="kid" />
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>{t("dashboard.commandCenter_eyebrow")}</Text>
            <Text style={styles.noPlanTitle}>{t("dashboard.commandCenter_noPlanTitle")}</Text>
            <Text style={styles.noPlanBody}>{t("dashboard.commandCenter_noPlanBody")}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.cta}
          onPress={() => {
            hapticLight();
            onStartMove();
          }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t("dashboard.commandCenter_noPlanCta")}
        >
          <Truck size={16} color="#fff" />
          <Text style={styles.ctaText}>{t("dashboard.commandCenter_noPlanCta")}</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // ── ACTIVE MOVE ───────────────────────────────────────────────────────────
  const cd = countdown!;
  const isCelebration = cd.phase === "today" || readiness >= 100;
  const moveDateLabel = formatDateOnlyUtc(activePlan.moveDate);
  const countdownLine =
    cd.phase === "today"
      ? t("dashboard.commandCenter_movingDay")
      : cd.phase === "past"
        ? t("dashboard.commandCenter_daysAgo", { count: cd.absDays })
        : cd.absDays === 1
          ? t("dashboard.commandCenter_oneDay")
          : t("dashboard.commandCenter_daysToGo", { count: cd.absDays });

  const HeadIcon = isCelebration ? PartyPopper : CalendarClock;

  return (
    <Animated.View style={[styles.card, cardStyle]} accessibilityRole="summary">
      <LinearGradient
        colors={[`${theme.colors.primary}26`, `${theme.colors.primary}00`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1.1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.activeRow}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <View style={styles.eyebrowRow}>
            <HeadIcon size={14} color={theme.colors.primary} />
            <Text style={styles.eyebrow}>{t("dashboard.commandCenter_eyebrow")}</Text>
          </View>
          <Text style={styles.countdown} numberOfLines={2}>
            {countdownLine}
          </Text>
          <Text style={styles.route} numberOfLines={1}>
            {activePlan.fromCity} → {activePlan.toCity}
            {moveDateLabel ? ` · ${moveDateLabel}` : ""}
          </Text>
        </View>
        <ReadinessRing
          percent={readiness}
          color={theme.colors.primary}
          track={`${theme.colors.text}1A`}
          label={t("dashboard.commandCenter_readinessLabel", { percent: readiness })}
        />
      </View>

      {/* Single Next Critical Action CTA (or "all set") */}
      {topAction ? (
        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => {
            hapticLight();
            onOpenAction(topAction);
          }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={topAction.name}
        >
          <View style={styles.actionIcon}>
            <Sparkles size={16} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionEyebrow}>{t("dashboard.commandCenter_nextAction")}</Text>
            <Text style={styles.actionName} numberOfLines={1}>
              {topAction.name}
            </Text>
            {(topAction.deadline || topAction.reason) && (
              <Text style={styles.actionSub} numberOfLines={1}>
                {topAction.deadline ? `${topAction.deadline} · ` : ""}
                {topAction.reason || (topAction.category || "").replace(/_/g, " ")}
              </Text>
            )}
          </View>
          <ArrowRight size={16} color={theme.colors.primary} />
        </TouchableOpacity>
      ) : readiness >= 100 ? (
        <View style={[styles.actionRow, styles.allSetRow]}>
          <Rocket size={16} color={theme.colors.success} />
          <Text style={styles.allSetText}>{t("dashboard.commandCenter_allSet")}</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => {
            hapticLight();
            onOpenPlan();
          }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t("dashboard.commandCenter_viewPlan")}
        >
          <Text style={[styles.actionName, { flex: 1 }]}>{t("dashboard.commandCenter_viewPlan")}</Text>
          <ArrowRight size={16} color={theme.colors.textTertiary} />
        </TouchableOpacity>
      )}

      <Text style={styles.readinessFoot}>
        {checklist
          ? t("dashboard.commandCenter_readinessDetail", {
              done: checklist.completedItems,
              total: checklist.totalItems,
            })
          : missingCriticalCount > 0
            ? t("dashboard.commandCenter_readinessProviders", { count: missingCriticalCount })
            : t("dashboard.commandCenter_readiness")}
      </Text>
    </Animated.View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    card: {
      marginBottom: 4,
      padding: 18,
      borderRadius: 24,
      overflow: "hidden",
      backgroundColor: t.colors.card,
      borderWidth: 1,
      borderColor: `${t.colors.primary}3D`,
      ...t.shadow.sm,
    },
    noPlanCard: {},
    noPlanTop: { flexDirection: "row", alignItems: "center", gap: 12 },
    noPlanTitle: { fontSize: 19, fontWeight: "800", color: t.colors.text, marginTop: 2 },
    noPlanBody: { fontSize: 12.5, color: t.colors.textSecondary, marginTop: 4, lineHeight: 18 },
    eyebrow: {
      fontSize: 10.5,
      fontWeight: "800",
      letterSpacing: 0.5,
      textTransform: "uppercase",
      color: t.colors.primary,
    },
    eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    activeRow: { flexDirection: "row", alignItems: "center" },
    countdown: {
      fontSize: 28,
      fontWeight: "800",
      letterSpacing: 0,
      color: t.colors.text,
      marginTop: 6,
    },
    route: { fontSize: 12.5, color: t.colors.textSecondary, marginTop: 4 },
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 14,
      padding: 12,
      borderRadius: 16,
      backgroundColor: "rgba(255,255,255,0.04)",
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    allSetRow: { backgroundColor: t.colors.successFaded, borderColor: `${t.colors.success}3D` },
    allSetText: { fontSize: 14, fontWeight: "700", color: t.colors.success },
    actionIcon: {
      width: 36,
      height: 36,
      borderRadius: 11,
      backgroundColor: t.colors.primaryFaded,
      alignItems: "center",
      justifyContent: "center",
    },
    actionEyebrow: {
      fontSize: 9.5,
      fontWeight: "800",
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: t.colors.primary,
    },
    actionName: { fontSize: 14, fontWeight: "700", color: t.colors.text, marginTop: 1 },
    actionSub: { fontSize: 11, color: t.colors.textTertiary, marginTop: 1 },
    readinessFoot: { fontSize: 11, color: t.colors.textMuted, marginTop: 10, textAlign: "right" },
    cta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 14,
      height: 46,
      borderRadius: t.radius.lg,
      backgroundColor: t.colors.primary,
      ...t.shadow.glow,
    },
    ctaText: { fontSize: 14.5, fontWeight: "700", color: "#fff" },
  });
