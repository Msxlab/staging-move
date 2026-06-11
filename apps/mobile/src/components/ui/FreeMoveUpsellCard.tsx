import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import { Lock, ArrowRight, Sparkles, MapPin, Bell, Zap } from "lucide-react-native";
import { useAppTheme, type Theme } from "@/lib/theme";
import { Card } from "./Card";
import { RaccoonMascot } from "./RaccoonMascot";

/**
 * FREE DASHBOARD HERO (freemium re-architecture).
 *
 * Replaces the full Move Command Center for FREE users. Honest framing: free
 * keeps your home organized (addresses, providers, bills, reminders); the full
 * moving plan — personalized checklist, countdown, and tracking — unlocks with
 * Individual. Tapping "Unlock" routes to the subscription page where the normal
 * plan-creation flow becomes available after upgrade.
 *
 * No fabricated numbers/dates — this is a static value statement, not a preview
 * of a plan the user hasn't entered. (The onboarding teaser, computed from real
 * entered data, is the place we preview an actual plan.)
 */

type Props = {
  onUnlock: () => void;
};

export function FreeMoveUpsellCard({ onUnlock }: Props) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();

  const freeFeatures = [
    { icon: MapPin, label: t("teaser.freeAddresses", { defaultValue: "Up to 3 homes & addresses" }) },
    { icon: Zap, label: t("teaser.freeProviders", { defaultValue: "Up to 10 providers & services" }) },
    { icon: Bell, label: t("teaser.freeReminders", { defaultValue: "Bill & renewal reminders" }) },
  ];

  return (
    <Card variant="glow" style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.mascot}>
          <RaccoonMascot size={48} variant="dad" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.eyebrowRow}>
            <Sparkles size={13} color={theme.colors.primary} />
            <Text style={styles.eyebrow}>{t("teaser.dashboardEyebrow", { defaultValue: "Unlock the move" })}</Text>
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {t("teaser.dashboardTitle", { defaultValue: "Ready to plan your move?" })}
          </Text>
        </View>
      </View>

      <Text style={styles.body}>
        {t("teaser.dashboardBody", {
          defaultValue:
            "Free keeps your home organized — addresses, providers, bills, and reminders. The full moving plan (personalized checklist, countdown, and tracking) unlocks with Individual.",
        })}
      </Text>

      <View style={styles.freeWrap}>
        <Text style={styles.freeLabel}>{t("teaser.freeIncluded", { defaultValue: "Included free" })}</Text>
        {freeFeatures.map((f) => {
          const Icon = f.icon;
          return (
            <View key={f.label} style={styles.freeRow}>
              <Icon size={14} color={theme.colors.success} />
              <Text style={styles.freeText}>{f.label}</Text>
            </View>
          );
        })}
      </View>

      <TouchableOpacity
        style={styles.unlockBtn}
        onPress={onUnlock}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={t("teaser.dashboardCta", { defaultValue: "Unlock your move plan" })}
      >
        <Lock size={16} color="#fff" />
        <Text style={styles.unlockBtnText}>{t("teaser.dashboardCta", { defaultValue: "Unlock your move plan" })}</Text>
        <ArrowRight size={16} color="#fff" />
      </TouchableOpacity>
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
    title: { fontSize: 18, fontWeight: "800", color: theme.colors.text, letterSpacing: -0.3, lineHeight: 23 },
    body: { fontSize: 13, color: theme.colors.textTertiary, lineHeight: 19 },
    freeWrap: {
      gap: 8,
      padding: 12,
      borderRadius: 14,
      backgroundColor: "rgba(255,255,255,0.03)",
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    freeLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    freeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    freeText: { fontSize: 13, color: theme.colors.text, fontWeight: "600" },
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
    unlockBtnText: { fontSize: 15, fontWeight: "800", color: "#fff", letterSpacing: -0.2 },
  });
