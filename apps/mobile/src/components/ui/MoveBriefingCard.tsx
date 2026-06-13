import React, { useEffect, useMemo, useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Sparkles, X, ChevronRight, Lock, ArrowRight } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAppTheme, type Theme } from "@/lib/theme";
import { Card } from "@/components/ui/Card";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { getMergedDisplayCategoryIcon } from "@/lib/recommendation-engine";
import { hapticLight, hapticMedium } from "@/lib/haptics";
import { api } from "@/lib/api";
import {
  parseBriefing,
  pickActivePlanId,
  resolveBriefingActionRoute,
  type ParsedBriefingAction,
} from "./MoveBriefingCard.helpers";

interface MoveBriefingCardProps {
  /**
   * The briefing text (plain prose + an optional machine-readable meta tail).
   * Optional so the unentitled teaser can render without one — the server
   * never generates a briefing for a FREE user.
   */
  briefing?: string;
  /**
   * True when the prose summary came from the LLM. Drives the subtle
   * "AI-generated" label. When false the card renders the same way but without
   * that label (the rule-based fallback is still a real, useful briefing).
   */
  aiGenerated?: boolean;
  /**
   * Plan entitlement (paid-plans-only packaging). `false` ⇒ render the
   * value-first upgrade teaser (honest pitch + locked rows + "Unlock with
   * Individual" routed to the subscription screen) instead of briefing
   * content. Defaults to true so existing call sites — and pre-flag servers —
   * keep today's behavior unchanged.
   */
  entitled?: boolean;
  onDismiss?: () => void;
}

// ── Per-stage "seen" persistence ──────────────────────────────
// We re-show the briefing whenever the move stage changes (no_move ->
// in_progress -> recently_completed). A per-stage marker records that the user
// has already seen this stage's briefing. A separate permanent flag (set via a
// long-press) suppresses it for good.
const BRIEFING_SEEN_STAGE_KEY = "locateflow.moveBriefing.seenStage";
const BRIEFING_NEVER_KEY = "locateflow.moveBriefing.never";
// Unentitled teaser: one X-tap hides it for this install (its own key, so a
// user who later upgrades still gets the real briefing despite having
// dismissed the teaser). Long-press "never" suppresses both, as before.
const BRIEFING_TEASER_SEEN_KEY = "locateflow.moveBriefing.teaserSeen";

/**
 * First-run "move briefing" card. Renders a plain-English situation summary +
 * the top 3 next actions as TAPPABLE, deep-linked rows. Shows a subtle
 * "AI-generated" chip when the summary was produced by the LLM.
 *
 * Self-contained: it parses its own structured actions out of the `briefing`
 * string, navigates via its own router, and manages its own per-move-stage
 * "seen" persistence (so it recurs across stages) plus a long-press
 * "don't show again". The parent only hands it text + an onDismiss callback.
 *
 * Freemium packaging: the AI briefing is paid-plans-only. With
 * `entitled={false}` the card renders a value-first teaser instead — an
 * honest pitch + three locked rows naming what the briefing actually does +
 * an "Unlock with Family" CTA routed to the existing subscription screen
 * (the same destination every mobile upsell uses). The teaser keeps the X
 * (its own one-time "seen" key) and the long-press permanent dismissal, so
 * an upsell never becomes an un-dismissable banner.
 */
export function MoveBriefingCard({
  briefing = "",
  aiGenerated = false,
  entitled = true,
  onDismiss,
}: MoveBriefingCardProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();
  const router = useRouter();

  const parsed = useMemo(() => parseBriefing(briefing), [briefing]);

  // Visibility gating. `null` while we read AsyncStorage (render nothing yet to
  // avoid a flash, then hide-or-show based on the per-stage / never markers).
  const [visible, setVisible] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [never, seenStage, teaserSeen] = await AsyncStorage.multiGet([
          BRIEFING_NEVER_KEY,
          BRIEFING_SEEN_STAGE_KEY,
          BRIEFING_TEASER_SEEN_KEY,
        ]);
        if (cancelled) return;
        if (never[1] === "true") {
          setVisible(false);
          return;
        }
        // Unentitled teaser: show once per install (until X), independent of
        // the per-stage markers a paid briefing uses.
        if (!entitled) {
          setVisible(teaserSeen[1] !== "true");
          return;
        }
        // Show unless we've already shown this exact stage. When the stage is
        // unknown (legacy/plain-text payload), fall back to always showing.
        const stage = parsed.moveStage;
        if (stage && seenStage[1] === stage) {
          setVisible(false);
          return;
        }
        setVisible(true);
      } catch {
        // Storage unavailable → fail open and show the briefing.
        if (!cancelled) setVisible(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [parsed.moveStage, entitled]);

  // X tap: mark THIS stage as seen so it recurs when the stage changes. We do
  // NOT call the parent onDismiss here (that path is reserved for the permanent
  // long-press dismissal), keeping per-stage re-show intact. In teaser mode the
  // X writes the teaser's own key instead.
  const handleSeen = useCallback(() => {
    hapticLight();
    setVisible(false);
    if (!entitled) {
      void AsyncStorage.setItem(BRIEFING_TEASER_SEEN_KEY, "true").catch(() => {});
      return;
    }
    if (parsed.moveStage) {
      void AsyncStorage.setItem(BRIEFING_SEEN_STAGE_KEY, parsed.moveStage).catch(() => {});
    }
  }, [parsed.moveStage, entitled]);

  // Long-press: permanently suppress the briefing across all stages.
  const handleNeverAgain = useCallback(() => {
    hapticMedium();
    setVisible(false);
    void AsyncStorage.setItem(BRIEFING_NEVER_KEY, "true").catch(() => {});
    onDismiss?.();
  }, [onDismiss]);

  // ── Active plan resolution ────────────────────────────────────
  // plan/state_rule actions deep-link straight to the plan DETAIL screen
  // (where the state-rules guidance + task timeline live) instead of
  // dead-ending on the bare Move tab. The meta tail may carry the plan id;
  // otherwise we look it up once, lazily, and only when an action actually
  // needs it. Lookup failure is fine — navigation falls back to the Move tab.
  const [fetchedPlanId, setFetchedPlanId] = useState<string | null>(null);
  const wantsPlanRoute =
    entitled &&
    parsed.planId === null &&
    parsed.actions.some((a) => a.target.kind === "plan" || a.target.kind === "state_rule");
  useEffect(() => {
    if (!wantsPlanRoute || visible !== true) return;
    let cancelled = false;
    void (async () => {
      const res = await api.get<{ plans?: unknown }>("/api/moving");
      if (cancelled || res.error) return;
      setFetchedPlanId(pickActivePlanId(res.data?.plans));
    })().catch(() => {
      // Best-effort only; the Move tab fallback still works.
    });
    return () => {
      cancelled = true;
    };
  }, [wantsPlanRoute, visible]);
  const activePlanId = parsed.planId ?? fetchedPlanId;

  const navigate = useCallback(
    (action: ParsedBriefingAction) => {
      hapticLight();
      const route = resolveBriefingActionRoute(action.target, activePlanId);
      switch (route.pathname) {
        case "/services/new":
          // BROWSE landing with the category in focus: recommended providers of
          // that category first, manual add as the in-screen fallback.
          router.push({ pathname: "/services/new", params: route.params });
          break;
        case "/moving/[id]":
          router.push({ pathname: "/moving/[id]", params: route.params });
          break;
        default:
          router.push(route.pathname);
          break;
      }
    },
    [router, activePlanId],
  );

  const handleUnlock = useCallback(() => {
    hapticLight();
    router.push("/settings/subscription");
  }, [router]);

  if (visible === null || visible === false) return null;

  const hasActions = parsed.actions.length > 0;

  // ── Value-first teaser (entitled:false) ──────────────────────
  if (!entitled) {
    const lockedRows = [
      t("dashboard.briefingTeaserRow1", "A plain-English read on where your move stands"),
      t("dashboard.briefingTeaserRow2", "Your top 3 next steps, linked to the right screen"),
      t("dashboard.briefingTeaserRow3", "A fresh briefing as your move progresses"),
    ];
    return (
      <Card variant="glow" style={{ marginBottom: 16 }}>
        <View style={styles.headerRow}>
          <View style={styles.iconWrap}>
            <Sparkles size={18} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t("dashboard.briefingTitle", "Your move briefing")}</Text>
            <Text style={styles.aiLabel}>
              {t("teaser.paidFeatureLabel", "Individual plan feature")}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleSeen}
            onLongPress={handleNeverAgain}
            delayLongPress={500}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t("dashboard.briefingDismiss", "Dismiss briefing")}
            accessibilityHint={t(
              "dashboard.briefingDismissHint",
              "Long-press to stop showing this",
            )}
          >
            <X size={18} color={theme.colors.textTertiary} />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <Text style={styles.line}>
            {t(
              "dashboard.briefingTeaserPitch",
              "Get a personalized briefing built from your real addresses, dates, and services — with the next steps that matter most right now.",
            )}
          </Text>
        </View>

        <View style={styles.actions}>
          {lockedRows.map((label, i) => (
            <View key={label} style={[styles.actionRow, i > 0 && styles.actionRowDivider]}>
              <View style={styles.actionIcon}>
                <Lock size={13} color={theme.colors.primary} />
              </View>
              <View style={styles.actionText}>
                <Text style={styles.actionTitle}>{label}</Text>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.unlockBtn}
          onPress={handleUnlock}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t("teaser.briefingUnlockCta", "Unlock with Family")}
        >
          <Lock size={14} color="#fff" />
          <Text style={styles.unlockBtnText}>{t("teaser.briefingUnlockCta", "Unlock with Family")}</Text>
          <ArrowRight size={14} color="#fff" />
        </TouchableOpacity>
      </Card>
    );
  }

  return (
    <Card variant="glow" style={{ marginBottom: 16 }}>
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <Sparkles size={18} color={theme.colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t("dashboard.briefingTitle", "Your move briefing")}</Text>
          {aiGenerated && (
            <Text style={styles.aiLabel}>{t("dashboard.briefingAiLabel", "AI-generated")}</Text>
          )}
        </View>
        <TouchableOpacity
          onPress={handleSeen}
          onLongPress={handleNeverAgain}
          delayLongPress={500}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={t("dashboard.briefingDismiss", "Dismiss briefing")}
          accessibilityHint={t(
            "dashboard.briefingDismissHint",
            "Long-press to stop showing this",
          )}
        >
          <X size={18} color={theme.colors.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* Situation summary (prose). */}
      <View style={styles.body}>
        {parsed.proseLines.map((line, i) => (
          <Text key={i} style={styles.line}>
            {line}
          </Text>
        ))}
      </View>

      {/* Tappable, deep-linked next actions. */}
      {hasActions && (
        <View style={styles.actions}>
          {parsed.actions.map((action, i) => {
            const emoji =
              action.target.kind === "category"
                ? getMergedDisplayCategoryIcon(action.target.category)
                : null;
            return (
              <TouchableOpacity
                key={i}
                style={[styles.actionRow, i > 0 && styles.actionRowDivider]}
                onPress={() => navigate(action)}
                accessibilityRole="button"
                accessibilityLabel={action.title}
                accessibilityHint={action.why}
              >
                <View style={styles.actionIcon}>
                  {emoji ? (
                    <CategoryIcon emoji={emoji} size={16} color={theme.colors.primary} />
                  ) : (
                    <Text style={styles.actionIndex}>{i + 1}</Text>
                  )}
                </View>
                <View style={styles.actionText}>
                  <Text style={styles.actionTitle}>{action.title}</Text>
                  <Text style={styles.actionWhy}>{action.why}</Text>
                </View>
                <ChevronRight size={16} color={theme.colors.textTertiary} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </Card>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 10,
    },
    iconWrap: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primaryFaded ?? "rgba(127,182,232,0.14)",
    },
    title: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.text,
    },
    aiLabel: {
      fontSize: 10,
      fontWeight: "600",
      letterSpacing: 0.3,
      color: theme.colors.textTertiary,
      marginTop: 1,
    },
    body: {
      gap: 6,
    },
    line: {
      fontSize: 13.5,
      lineHeight: 20,
      color: theme.colors.textSecondary,
    },
    actions: {
      marginTop: 12,
    },
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
    },
    actionRowDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    actionIcon: {
      width: 30,
      height: 30,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primaryFaded ?? "rgba(127,182,232,0.14)",
    },
    actionIndex: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.colors.primary,
    },
    actionText: {
      flex: 1,
      gap: 2,
    },
    actionTitle: {
      fontSize: 13.5,
      fontWeight: "600",
      color: theme.colors.text,
    },
    actionWhy: {
      fontSize: 12,
      lineHeight: 16,
      color: theme.colors.textTertiary,
    },
    // ── Teaser-only styles (entitled:false) ──
    // Same CTA idiom as FreeMoveUpsellCard (the established mobile upsell).
    unlockBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.lg,
      paddingVertical: 12,
      marginTop: 14,
      ...theme.shadow.glow,
    },
    unlockBtnText: {
      fontSize: 14,
      fontWeight: "800",
      color: "#fff",
      letterSpacing: 0,
    },
  });
