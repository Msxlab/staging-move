import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { useAuthStore } from "@/lib/auth-store";
import { RaccoonMascot } from "@/components/ui/RaccoonMascot";

/**
 * Plan-themed welcome hero on the dashboard for Family / Pro members: a kawaii
 * raccoon household (dad / mom / kid) with a plan-colored gradient. Pro dresses
 * the crew in top hats + bow ties. Colors come from the active (plan-tinted)
 * theme, so it is crystal-green for Family and premium violet/gold for Pro.
 * Renders nothing for Individual / unknown plans.
 */
export function PlanHero() {
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
        <RaccoonMascot size={64} fur="#94a3b3" variant="dad" suited={isPro} />
        <View style={styles.overlap}>
          <RaccoonMascot size={54} fur="#aeb9c6" variant="mom" suited={isPro} />
        </View>
        <View style={styles.overlap}>
          <RaccoonMascot size={42} fur="#bcc6d1" variant="kid" suited={isPro} />
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
