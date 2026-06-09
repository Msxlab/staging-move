import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { Lock, ArrowRight, CalendarClock, Sparkles, CheckCircle2 } from "lucide-react-native";
import {
  getMoveCountdown,
  type RelocationChecklist,
  type ChecklistItem,
} from "@locateflow/shared";
import { useAppTheme, type Theme } from "@/lib/theme";
import { Card } from "./Card";
import { CategoryIcon } from "./CategoryIcon";
import { RaccoonMascot } from "./RaccoonMascot";

/**
 * VALUE-FIRST TEASER for the freemium re-architecture.
 *
 * The moving plan is a paid unlock (Individual / Family / Pro). Rather than
 * gating it behind a cold paywall, a FREE user who entered move details sees a
 * PREVIEW of the real plan: a live countdown to their move date, the top
 * personalized critical steps (USPS forwarding, the destination-state DMV
 * deadline, …), and an honest "Your N-step [from]→[to] plan is ready" line —
 * then a clear "Unlock with Individual" CTA.
 *
 * POSTURE: every step + reason shown here comes straight from the shared
 * `generateChecklist` engine (real STATE_DMV_DEADLINES data + the user's own
 * entered profile/state/date). NOTHING is fabricated. The card never persists a
 * MovingPlan — the checklist is computed ephemerally by the caller and passed in.
 *
 * Reused by onboarding (the move step) and the dashboard (free users see this
 * in place of the full Move Command Center).
 */

export type MoveTeaserStep = {
  id: string;
  title: string;
  /** The honest "because …" reason — a real stateNote or the item's own copy. */
  reason: string | null;
  icon: string;
};

type Props = {
  checklist: RelocationChecklist | null;
  /** Origin state (2-letter) for the route line + tz-correct countdown. */
  fromState: string;
  /** Destination state (2-letter) for the route line. */
  toState: string;
  /** Date-only (UTC-midnight) move date string the user entered. */
  moveDate: string | null;
  onUnlock: () => void;
  /** Disables the CTA + shows a spinner (e.g. while onboarding is finishing). */
  busy?: boolean;
  /** Compact variant for the dashboard (slightly tighter spacing). */
  variant?: "onboarding" | "dashboard";
};

const MAX_STEPS = 4;

/**
 * Pick the top personalized critical steps to preview. We lead with the single
 * `nextAction` (the engine's prioritized next move), then fill from the URGENT
 * items, de-duplicated by id, capped at MAX_STEPS. All come from the engine —
 * we only select + order what it already produced.
 */
export function selectTeaserSteps(checklist: RelocationChecklist | null): MoveTeaserStep[] {
  if (!checklist) return [];
  const picked: ChecklistItem[] = [];
  const seen = new Set<string>();
  const push = (item: ChecklistItem | null | undefined) => {
    if (!item || seen.has(item.id) || picked.length >= MAX_STEPS) return;
    seen.add(item.id);
    picked.push(item);
  };
  push(checklist.nextAction);
  for (const item of checklist.urgentItems) push(item);
  // Backfill from the earliest phases if the move is far out and nothing is
  // "urgent" yet — so the preview is never empty when there's a real plan.
  if (picked.length < MAX_STEPS) {
    for (const phase of checklist.phases) {
      for (const item of phase.items) {
        if (!item.isCompleted) push(item);
      }
    }
  }
  return picked.map((item) => ({
    id: item.id,
    title: item.title,
    // The honest reason: a state-specific deadline note when the engine produced
    // one (e.g. "TX requires license transfer within 90 days"), otherwise the
    // item's own description. Never an invented deadline.
    reason: item.stateNote || item.description || null,
    icon: item.icon,
  }));
}

export function MoveTeaserCard({
  checklist,
  fromState,
  toState,
  moveDate,
  onUnlock,
  busy = false,
  variant = "onboarding",
}: Props) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();

  const steps = useMemo(() => selectTeaserSteps(checklist), [checklist]);
  const countdown = useMemo(
    () => (moveDate ? getMoveCountdown(moveDate, { state: toState || fromState || null }) : null),
    [moveDate, toState, fromState],
  );

  const countdownLabel = (() => {
    if (!countdown || countdown.days === null) return null;
    if (countdown.isMovingDay) return t("teaser.movingDay", { defaultValue: "It's moving day!" });
    if (countdown.phase === "past")
      return t("teaser.daysAgo", { defaultValue: "Moved {{count}} days ago", count: countdown.absDays });
    if (countdown.absDays === 1) return t("teaser.oneDay", { defaultValue: "1 day to go" });
    return t("teaser.daysToGo", { defaultValue: "{{count}} days to go", count: countdown.absDays });
  })();

  const totalItems = checklist?.totalItems ?? 0;
  const route =
    fromState && toState ? `${fromState} → ${toState}` : toState || fromState || "";

  return (
    <Card variant="glow" style={styles.card}>
      {/* Header: mascot + "your plan is ready" */}
      <View style={styles.headerRow}>
        <View style={styles.mascot}>
          <RaccoonMascot size={48} variant="dad" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.eyebrowRow}>
            <Sparkles size={13} color={theme.colors.primary} />
            <Text style={styles.eyebrow}>{t("teaser.eyebrow", { defaultValue: "Your move preview" })}</Text>
          </View>
          {totalItems > 0 ? (
            <Text style={styles.headline} numberOfLines={2}>
              {route
                ? t("teaser.planReadyRoute", {
                    defaultValue: "Your {{count}}-step {{route}} plan is ready",
                    count: totalItems,
                    route,
                  })
                : t("teaser.planReady", {
                    defaultValue: "Your {{count}}-step personalized plan is ready",
                    count: totalItems,
                  })}
            </Text>
          ) : (
            <Text style={styles.headline} numberOfLines={2}>
              {t("teaser.planReadyGeneric", { defaultValue: "Your personalized move plan is ready" })}
            </Text>
          )}
        </View>
      </View>

      {/* Countdown */}
      {countdownLabel && (
        <View style={styles.countdownRow}>
          <CalendarClock size={16} color={theme.colors.primary} />
          <Text style={styles.countdownText}>{countdownLabel}</Text>
        </View>
      )}

      {/* Top personalized critical steps — each with its honest reason */}
      {steps.length > 0 && (
        <View style={styles.stepsWrap}>
          <Text style={styles.stepsLabel}>
            {t("teaser.topSteps", { defaultValue: "Your top critical steps" })}
          </Text>
          {steps.map((step) => (
            <View key={step.id} style={styles.stepRow}>
              <CategoryIcon emoji={step.icon} size={16} color={theme.colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle} numberOfLines={1}>
                  {step.title}
                </Text>
                {step.reason ? (
                  <Text style={styles.stepReason} numberOfLines={2}>
                    {step.reason}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
          {totalItems > steps.length && (
            <View style={styles.moreRow}>
              <CheckCircle2 size={14} color={theme.colors.textMuted} />
              <Text style={styles.moreText}>
                {t("teaser.moreSteps", {
                  defaultValue: "+{{count}} more steps in your full plan",
                  count: totalItems - steps.length,
                })}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Unlock CTA */}
      <View style={styles.unlockWrap}>
        <Text style={styles.unlockHint}>
          {t("teaser.unlockHint", {
            defaultValue:
              "Unlock your full plan: a personalized checklist, deadline countdown, and move tracking.",
          })}
        </Text>
        <TouchableOpacity
          style={[styles.unlockBtn, busy && styles.unlockBtnDisabled]}
          onPress={onUnlock}
          disabled={busy}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t("teaser.unlockCta", { defaultValue: "Unlock your full move plan with Individual" })}
          accessibilityState={{ disabled: busy }}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Lock size={16} color="#fff" />
              <Text style={styles.unlockBtnText}>
                {t("teaser.unlockCta", { defaultValue: "Unlock with Individual" })}
              </Text>
              <ArrowRight size={16} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </Card>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: { padding: 18, gap: 14 },
    headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    mascot: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: theme.colors.primaryFaded,
      borderWidth: 1,
      borderColor: "rgba(127, 182, 232,0.3)",
      alignItems: "center",
      justifyContent: "center",
    },
    eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 3 },
    eyebrow: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.colors.primary,
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },
    headline: { fontSize: 17, fontWeight: "800", color: theme.colors.text, letterSpacing: -0.2, lineHeight: 22 },
    countdownRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      alignSelf: "flex-start",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: theme.colors.primaryFaded,
      borderWidth: 1,
      borderColor: "rgba(127, 182, 232,0.3)",
    },
    countdownText: { fontSize: 14, fontWeight: "800", color: theme.colors.primary, letterSpacing: -0.2 },
    stepsWrap: { gap: 10 },
    stepsLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    stepRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      padding: 10,
      borderRadius: 12,
      backgroundColor: "rgba(255,255,255,0.03)",
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    stepTitle: { fontSize: 14, fontWeight: "700", color: theme.colors.text },
    stepReason: { fontSize: 11, color: "#B49BFF", marginTop: 2, lineHeight: 15 },
    moreRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
    moreText: { fontSize: 12, color: theme.colors.textMuted, fontWeight: "600" },
    unlockWrap: { gap: 10, marginTop: 2 },
    unlockHint: { fontSize: 12, color: theme.colors.textTertiary, lineHeight: 17 },
    unlockBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.lg,
      paddingVertical: 14,
      ...theme.shadow.glow,
    },
    unlockBtnDisabled: { opacity: 0.6 },
    unlockBtnText: { fontSize: 15, fontWeight: "800", color: "#fff", letterSpacing: -0.2 },
  });
