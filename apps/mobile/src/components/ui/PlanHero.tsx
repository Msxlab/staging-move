import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { useAuthStore } from "@/lib/auth-store";

// Plan mascots — a little "household" of animals on the dashboard. Family shows
// the family; Pro shows the same crew dressed up (top hat) for a premium feel.
// Emoji-based so it ships via OTA with zero binary assets; the layout is ready
// for illustrated <Image> art to drop in later without other changes.
const FAMILY_MASCOTS = ["🦊", "🐻", "🐰", "🦉"];
const PRO_MASCOTS = ["🦊", "🐻", "🐰"];

/**
 * Plan-themed welcome hero shown on the dashboard for Family / Pro members.
 * Colors come from the active (plan-tinted) theme, so it is crystal-green for
 * Family and premium violet/gold for Pro automatically. Renders nothing for
 * Individual / unknown plans.
 */
export function PlanHero() {
  const theme = useAppTheme();
  const styles = React.useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();
  const planTier = useAuthStore((s) => s.planTier);
  const key = (planTier ?? "").toUpperCase();
  if (key !== "FAMILY" && key !== "PRO") return null;

  const isPro = key === "PRO";
  const mascots = isPro ? PRO_MASCOTS : FAMILY_MASCOTS;
  const title = isPro
    ? t("plan.proTitle", "Pro household")
    : t("plan.familyTitle", "Family household");
  const subtitle = isPro
    ? t("plan.proSubtitle", "Premium tools for your whole crew.")
    : t("plan.familySubtitle", "Everyone under one roof, together.");

  return (
    <View style={styles.hero} accessibilityRole="summary">
      <View style={styles.mascotRow}>
        {mascots.map((m, i) => (
          <View key={i} style={[styles.bubble, i > 0 && styles.bubbleOverlap]}>
            <Text style={styles.mascot}>{m}</Text>
          </View>
        ))}
        {isPro && <Text style={styles.hat}>🎩</Text>}
      </View>
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
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
    hero: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 16,
      marginTop: 16,
      borderRadius: 20,
      backgroundColor: t.colors.primaryFaded,
      borderWidth: 1,
      borderColor: `${t.colors.primary}33`,
    },
    mascotRow: { flexDirection: "row", alignItems: "center" },
    bubble: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.card,
      borderWidth: 1.5,
      borderColor: `${t.colors.primary}55`,
    },
    bubbleOverlap: { marginLeft: -12 },
    mascot: { fontSize: 20 },
    hat: { fontSize: 18, marginLeft: 6 },
    copy: { flex: 1 },
    title: { fontSize: 15, fontWeight: "700", color: t.colors.text },
    subtitle: { fontSize: 12, color: t.colors.textTertiary, marginTop: 2 },
    pill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: t.colors.primary,
    },
    pillText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5, color: "#FFFFFF" },
  });
