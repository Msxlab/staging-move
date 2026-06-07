import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Wallet, TrendingUp, PlusCircle, ArrowRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import {
  computeSavingsInsights,
  type ServiceLike,
} from "@/lib/service-insights";

/**
 * Dashboard savings / insights card. Computed entirely client-side from the
 * user's tracked services (no new endpoint, no schema change): total tracked
 * $/mo (+ annualized), the most-expensive category, and a gentle nudge when
 * some services are missing a cost.
 *
 * Calm + on-brand: a single card matching the rest of the dashboard, the
 * emerald spend tone already used on the services screen, and 1–2 plain-English
 * insight lines rather than a chart. Renders nothing when there are no active
 * services to summarize (the dashboard already has a first-run hero for that).
 */
export function SavingsInsightsCard({ services }: { services: ServiceLike[] }) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t, i18n } = useTranslation();
  const router = useRouter();

  const insights = useMemo(() => computeSavingsInsights(services), [services]);

  // Nothing tracked yet → let the dashboard's first-run hero carry the moment.
  if (insights.serviceCount === 0) return null;

  const currencyFmt = (n: number) =>
    new Intl.NumberFormat(i18n.language || "en", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);

  const categoryLabel = (category: string) =>
    t(`categories.${category}`, { defaultValue: category.replace(/_/g, " ") });

  // Build 1–2 insight lines. The headline (tracking $X/mo across N services) is
  // always present; then EITHER the missing-cost nudge OR the top-category line.
  const lines: { icon: typeof TrendingUp; text: string; tone: string }[] = [];
  if (insights.missingCostCount > 0) {
    lines.push({
      icon: PlusCircle,
      tone: theme.colors.amber.text,
      text: t("insights.missingCost", {
        count: insights.missingCostCount,
        defaultValue:
          insights.missingCostCount === 1
            ? "1 service is missing a cost — add it for a complete picture"
            : `${insights.missingCostCount} services are missing a cost — add them for a complete picture`,
      }),
    });
  }
  if (insights.topCategory && insights.topCategory.total > 0) {
    lines.push({
      icon: TrendingUp,
      tone: theme.colors.emerald.text,
      text: t("insights.topCategory", {
        category: categoryLabel(insights.topCategory.category),
        amount: currencyFmt(insights.topCategory.total),
        defaultValue: `${categoryLabel(insights.topCategory.category)} is your biggest category at ${currencyFmt(insights.topCategory.total)}/mo`,
      }),
    });
  }
  const shownLines = lines.slice(0, 2);

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => router.push("/(tabs)/services")}
      accessibilityRole="summary"
      accessibilityLabel={t("insights.title", { defaultValue: "Spending insights" })}
    >
      <View style={styles.header}>
        <View style={styles.iconDisc}>
          <Wallet size={18} color={theme.colors.emerald.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t("insights.title", { defaultValue: "Spending insights" })}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {t("insights.headline", {
              total: currencyFmt(insights.totalMonthly),
              count: insights.serviceCount,
              defaultValue: `Tracking ${currencyFmt(insights.totalMonthly)}/mo across ${insights.serviceCount} services`,
            })}
          </Text>
        </View>
        <ArrowRight size={16} color={theme.colors.textTertiary} />
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{currencyFmt(insights.totalMonthly)}</Text>
          <Text style={styles.metricLabel}>{t("insights.perMonth", { defaultValue: "per month" })}</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{currencyFmt(insights.totalYearly)}</Text>
          <Text style={styles.metricLabel}>{t("insights.perYear", { defaultValue: "per year" })}</Text>
        </View>
      </View>

      {shownLines.length > 0 && (
        <View style={styles.lines}>
          {shownLines.map((line, i) => {
            const Icon = line.icon;
            return (
              <View key={i} style={styles.line}>
                <Icon size={13} color={line.tone} />
                <Text style={styles.lineText} numberOfLines={2}>
                  {line.text}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </TouchableOpacity>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      marginTop: 20,
      padding: 16,
      borderRadius: theme.radius.xl,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    header: { flexDirection: "row", alignItems: "center", gap: 12 },
    iconDisc: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: theme.colors.emerald.bg,
      borderWidth: 1,
      borderColor: theme.colors.emerald.border,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { fontSize: 15, fontWeight: "700", color: theme.colors.text },
    sub: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 2 },
    metricsRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 14,
      paddingVertical: 12,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.surface,
    },
    metric: { flex: 1, alignItems: "center" },
    metricDivider: { width: 1, alignSelf: "stretch", backgroundColor: theme.colors.border, marginVertical: 4 },
    metricValue: { fontSize: 20, fontWeight: "800", color: theme.colors.emerald.text, letterSpacing: -0.5 },
    metricLabel: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
    lines: { marginTop: 12, gap: 8 },
    line: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    lineText: { flex: 1, fontSize: 12.5, color: theme.colors.textSecondary, lineHeight: 18 },
  });
