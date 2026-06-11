import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Sparkles, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { useAuthStore } from "@/lib/auth-store";
import { hapticLight } from "@/lib/haptics";
import { RaccoonMascot } from "@/components/ui/RaccoonMascot";
import {
  coachStorageKey,
  parseCoachCollapsed,
  serializeCoachCollapsed,
} from "./ob-coach-state";

/**
 * ObCoach — the onboarding AI-coach callout (design bundle-3, onb-core.jsx
 * `OBCoach` + onb-buttons.css `.ob-coach` / `.ob-coach-mini`).
 *
 * Every onboarding step renders one of these with a short HONEST explainer of
 * why accurate data on that step improves the AI's suggestions ("accurate
 * data → accurate recommendations"). Behaviour per the owner decision:
 *   - open by default on the user's FIRST onboarding;
 *   - dismissible via × to a small "!" pill that reopens it;
 *   - the collapsed state is remembered per user in AsyncStorage (one shared
 *     boolean across steps, mirroring the design flow's single `coachOpen`).
 *
 * Purely presentational — it never gates a step's validation or submit path.
 * Entrance is a small fade + 6px lift that settles instantly under
 * reduce-motion; expand/collapse is a plain conditional swap (no
 * LayoutAnimation, so it is Hermes/new-arch safe).
 */

/**
 * In-memory mirror of the persisted collapse flag so per-step remounts (each
 * onboarding step remounts its content) render the correct state on the first
 * frame instead of re-reading AsyncStorage and flashing.
 */
const hydratedCollapseCache = new Map<string, boolean>();

interface ObCoachProps {
  /** Short uppercase eyebrow line (already translated). */
  eyebrow: string;
  /** One-or-two sentence honest explainer (already translated). */
  body: string;
  /**
   * Optional 0-100 data-quality score (design `.ob-quality`): a thin bar +
   * "Data quality N%" under the body. Honest profile-completeness only —
   * computed by computeOnboardingDataQuality, never invented here. Omit to
   * render the classic copy-only coach.
   */
  quality?: number;
  style?: StyleProp<ViewStyle>;
}

/** Small mount reveal for the expanded card — reduce-motion renders settled. */
function CoachReveal({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  const enter = useSharedValue(reduceMotion ? 1 : 0);

  React.useEffect(() => {
    if (reduceMotion) {
      enter.value = 1;
      return;
    }
    enter.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) });
    return () => {
      cancelAnimation(enter);
    };
  }, [reduceMotion, enter]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 6 }],
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

export function ObCoach({ eyebrow, body, quality, style }: ObCoachProps) {
  const theme = useAppTheme();
  const styles = React.useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();
  // Defensive display clamp — the mapper already returns 0-100, but a bad
  // caller must never paint a bar wider than its track.
  const qualityPct =
    typeof quality === "number" && Number.isFinite(quality)
      ? Math.max(0, Math.min(100, Math.round(quality)))
      : null;
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const storageKey = coachStorageKey(userId);

  // null = not hydrated yet (render nothing for that frame — no wrong-state
  // flash). The module cache makes every remount after the first instant.
  const [collapsed, setCollapsed] = React.useState<boolean | null>(
    () => hydratedCollapseCache.get(storageKey) ?? null,
  );

  React.useEffect(() => {
    let cancelled = false;
    const cachedValue = hydratedCollapseCache.get(storageKey);
    if (cachedValue !== undefined) {
      setCollapsed(cachedValue);
      return;
    }
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (cancelled) return;
        const value = parseCoachCollapsed(raw);
        hydratedCollapseCache.set(storageKey, value);
        setCollapsed(value);
      })
      .catch(() => {
        if (cancelled) return;
        // Unreadable storage → first-run default (open). Don't poison the
        // cache permanently; an explicit toggle below will set it.
        setCollapsed(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  const setAndPersist = (next: boolean) => {
    hapticLight();
    hydratedCollapseCache.set(storageKey, next);
    setCollapsed(next);
    // Best-effort persistence — in-memory state already updated.
    AsyncStorage.setItem(storageKey, serializeCoachCollapsed(next)).catch(() => {});
  };

  if (collapsed === null) return null;

  if (collapsed) {
    return (
      <View style={[styles.container, style]}>
        <TouchableOpacity
          style={styles.mini}
          onPress={() => setAndPersist(false)}
          accessibilityRole="button"
          accessibilityLabel={t("onboarding.coach_reopen", { defaultValue: "Why this matters" })}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <View style={styles.miniBadge}>
            <Text style={styles.miniBadgeText}>!</Text>
          </View>
          <Text style={styles.miniText}>
            {t("onboarding.coach_reopen", { defaultValue: "Why this matters" })}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <CoachReveal>
        <View style={styles.card}>
          <View style={styles.avatar}>
            <RaccoonMascot size={26} />
          </View>
          <View style={styles.bodyCol}>
            <View style={styles.eyebrowRow}>
              <Sparkles size={11} color={theme.colors.primary} />
              <Text style={styles.eyebrow}>{eyebrow}</Text>
            </View>
            <Text style={styles.bodyText}>{body}</Text>
            {qualityPct !== null && (
              <View
                style={styles.qualityRow}
                accessibilityRole="text"
                accessibilityLabel={t("onboarding.coach_quality", {
                  defaultValue: "Data quality {{quality}}%",
                  quality: qualityPct,
                })}
              >
                <View style={styles.qualityTrack}>
                  {/* Static width per render — no animation, so no
                      reduce-motion concern; the bar simply reflects the
                      latest honest completeness number. */}
                  <View style={[styles.qualityFill, { width: `${qualityPct}%` }]} />
                </View>
                <Text style={styles.qualityLabel}>
                  {t("onboarding.coach_quality", {
                    defaultValue: "Data quality {{quality}}%",
                    quality: qualityPct,
                  })}
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.close}
            onPress={() => setAndPersist(true)}
            accessibilityRole="button"
            accessibilityLabel={t("onboarding.coach_hideA11y", { defaultValue: "Hide explanation" })}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={13} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </View>
      </CoachReveal>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      width: "100%",
    },
    // Expanded card — plan-accent tinted pane (`.ob-coach`): faded primary
    // fill + focus border, 14px radius, avatar + eyebrow + body, × top-right.
    card: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 11,
      padding: 12,
      paddingRight: 32,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderFocus,
      backgroundColor: theme.colors.primaryFaded,
      width: "100%",
    },
    avatar: {
      width: 34,
      height: 34,
      borderRadius: 11,
      backgroundColor: theme.colors.primaryFaded,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      flexShrink: 0,
    },
    bodyCol: {
      flex: 1,
      minWidth: 0,
    },
    eyebrowRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginBottom: 4,
    },
    eyebrow: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color: theme.colors.primary,
      flexShrink: 1,
      // Mono-uppercase eyebrow (design `.ob-coach-ey`); system mono keeps it
      // dependency-free + Hermes-safe, mirroring the onboarding skip link.
      fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    },
    bodyText: {
      fontSize: 13,
      lineHeight: 18,
      color: theme.colors.textSecondary,
    },
    // Data-quality meter (design `.ob-quality`): thin track + tiny mono label.
    qualityRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 8,
    },
    qualityTrack: {
      flex: 1,
      height: 4,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.border,
      overflow: "hidden",
    },
    qualityFill: {
      height: "100%",
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.primary,
    },
    qualityLabel: {
      fontSize: 10,
      fontWeight: "600",
      color: theme.colors.textTertiary,
      fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
      flexShrink: 0,
    },
    close: {
      position: "absolute",
      top: 8,
      right: 8,
      width: 22,
      height: 22,
      borderRadius: 7,
      alignItems: "center",
      justifyContent: "center",
    },
    // Collapsed "!" pill (`.ob-coach-mini`) — lowest-footprint reopen affordance.
    mini: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingVertical: 6,
      paddingLeft: 7,
      paddingRight: 12,
      borderRadius: theme.radius.full,
      borderWidth: 1,
      borderColor: theme.colors.borderFocus,
      backgroundColor: theme.colors.primaryFaded,
    },
    miniBadge: {
      width: 19,
      height: 19,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    miniBadgeText: {
      fontSize: 12,
      fontWeight: "800",
      // Ink-on-accent: the app background tone gives the same dark-on-bright
      // (dark mode) / light-on-deep (light mode) contrast as the design's
      // `--btnink` without hardcoding a hex.
      color: theme.colors.background,
      lineHeight: 14,
    },
    miniText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.textSecondary,
    },
  });
