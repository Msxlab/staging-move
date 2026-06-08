import React, { useEffect, useMemo, useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Sparkles, X, ChevronRight } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAppTheme, type Theme } from "@/lib/theme";
import { Card } from "@/components/ui/Card";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { getMergedDisplayCategoryIcon } from "@/lib/recommendation-engine";
import { hapticLight, hapticMedium } from "@/lib/haptics";

interface MoveBriefingCardProps {
  /** The briefing text (plain prose + an optional machine-readable meta tail). */
  briefing: string;
  /**
   * True when the prose summary came from the LLM. Drives the subtle
   * "AI-generated" label. When false the card renders the same way but without
   * that label (the rule-based fallback is still a real, useful briefing).
   */
  aiGenerated: boolean;
  onDismiss?: () => void;
}

// ── Self-contained briefing meta parsing ──────────────────────
// The server packs structured data into the single `briefing` string as
// `<prose>\n<SENTINEL>\n<json>`. We split on the sentinel, render the prose, and
// parse the JSON tail for tappable deep-linked actions + the current move stage.
// Kept here (not imported from web) so the card stays fully self-contained.
const BRIEFING_META_SENTINEL = "<<<LF_BRIEFING_META>>>";

type BriefingDeeplink =
  | { type: "category"; category: string }
  | { type: "services" }
  | { type: "state-rules" }
  | { type: "plan" };

interface BriefingAction {
  title: string;
  why: string;
  deeplink: BriefingDeeplink;
}

type MoveStage = "no_move" | "planning" | "in_progress" | "recently_completed";

interface ParsedBriefing {
  /** The human-readable prose lines (sentinel + tail stripped). */
  proseLines: string[];
  actions: BriefingAction[];
  moveStage: MoveStage | null;
}

function isDeeplink(value: unknown): value is BriefingDeeplink {
  if (!value || typeof value !== "object") return false;
  const t = (value as { type?: unknown }).type;
  if (t === "services" || t === "state-rules" || t === "plan") return true;
  if (t === "category") return typeof (value as { category?: unknown }).category === "string";
  return false;
}

function parseBriefing(raw: string): ParsedBriefing {
  const idx = raw.indexOf(BRIEFING_META_SENTINEL);
  const prose = (idx >= 0 ? raw.slice(0, idx) : raw).trim();
  const proseLines = prose
    .split("\n")
    .map((l) => l.trim())
    // Drop any stray leading numbered-action lines (defensive: the AI summary
    // path is prose-only, but the rule-based fallback also embeds a numbered
    // list in its prose — those become tappable rows below, so hide them here).
    .filter((l) => l.length > 0 && !/^\d+\.\s/.test(l));

  let actions: BriefingAction[] = [];
  let moveStage: MoveStage | null = null;
  if (idx >= 0) {
    try {
      const meta = JSON.parse(raw.slice(idx + BRIEFING_META_SENTINEL.length).trim());
      if (Array.isArray(meta?.actions)) {
        actions = meta.actions
          .filter(
            (a: unknown): a is BriefingAction =>
              !!a &&
              typeof (a as BriefingAction).title === "string" &&
              typeof (a as BriefingAction).why === "string" &&
              isDeeplink((a as BriefingAction).deeplink),
          )
          .slice(0, 3);
      }
      const stage = meta?.moveStage;
      if (
        stage === "no_move" ||
        stage === "planning" ||
        stage === "in_progress" ||
        stage === "recently_completed"
      ) {
        moveStage = stage;
      }
    } catch {
      // Malformed tail → just render the prose with no actions.
    }
  }
  return { proseLines, actions, moveStage };
}

// ── Per-stage "seen" persistence ──────────────────────────────
// We re-show the briefing whenever the move stage changes (no_move ->
// in_progress -> recently_completed). A per-stage marker records that the user
// has already seen this stage's briefing. A separate permanent flag (set via a
// long-press) suppresses it for good.
const BRIEFING_SEEN_STAGE_KEY = "locateflow.moveBriefing.seenStage";
const BRIEFING_NEVER_KEY = "locateflow.moveBriefing.never";

/**
 * First-run "move briefing" card. Renders a plain-English situation summary +
 * the top 3 next actions as TAPPABLE, deep-linked rows. Shows a subtle
 * "AI-generated" chip when the summary was produced by the LLM.
 *
 * Self-contained: it parses its own structured actions out of the `briefing`
 * string, navigates via its own router, and manages its own per-move-stage
 * "seen" persistence (so it recurs across stages) plus a long-press
 * "don't show again". The parent only hands it text + an onDismiss callback.
 */
export function MoveBriefingCard({ briefing, aiGenerated, onDismiss }: MoveBriefingCardProps) {
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
        const [never, seenStage] = await AsyncStorage.multiGet([
          BRIEFING_NEVER_KEY,
          BRIEFING_SEEN_STAGE_KEY,
        ]);
        if (cancelled) return;
        if (never[1] === "true") {
          setVisible(false);
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
  }, [parsed.moveStage]);

  // X tap: mark THIS stage as seen so it recurs when the stage changes. We do
  // NOT call the parent onDismiss here (that path is reserved for the permanent
  // long-press dismissal), keeping per-stage re-show intact.
  const handleSeen = useCallback(() => {
    hapticLight();
    setVisible(false);
    if (parsed.moveStage) {
      void AsyncStorage.setItem(BRIEFING_SEEN_STAGE_KEY, parsed.moveStage).catch(() => {});
    }
  }, [parsed.moveStage]);

  // Long-press: permanently suppress the briefing across all stages.
  const handleNeverAgain = useCallback(() => {
    hapticMedium();
    setVisible(false);
    void AsyncStorage.setItem(BRIEFING_NEVER_KEY, "true").catch(() => {});
    onDismiss?.();
  }, [onDismiss]);

  const navigate = useCallback(
    (deeplink: BriefingDeeplink) => {
      hapticLight();
      switch (deeplink.type) {
        case "category":
          router.push({
            pathname: "/services/new",
            params: { category: deeplink.category, mode: "manual" },
          });
          break;
        case "services":
          router.push("/(tabs)/services");
          break;
        case "state-rules":
        case "plan":
          // The plan list; the plan detail surfaces state rules (DMV, voter,
          // tax) and the move date. Neutral target — the active plan id isn't
          // available to this card.
          router.push("/(tabs)/moving");
          break;
      }
    },
    [router],
  );

  if (visible === null || visible === false) return null;

  const hasActions = parsed.actions.length > 0;

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
              action.deeplink.type === "category"
                ? getMergedDisplayCategoryIcon(action.deeplink.category)
                : null;
            return (
              <TouchableOpacity
                key={i}
                style={[styles.actionRow, i > 0 && styles.actionRowDivider]}
                onPress={() => navigate(action.deeplink)}
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
  });
