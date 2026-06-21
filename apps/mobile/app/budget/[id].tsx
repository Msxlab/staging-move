import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, fonts, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { asObject } from "@/lib/offline-cache";
import { detailCacheKey, useDetailOfflineCache } from "@/lib/use-detail-offline-cache";
import { HeroCard, MoveCard, SectionHeader, MoveProgressBar, Pill } from "@/components/move";

function readBudgetDetailCache(raw: unknown): any | null {
  return asObject(raw) as any | null;
}

export default function BudgetDetailScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const {
    data: budget,
    setCachedData: setBudget,
    loading,
    setLoading,
    startForegroundLoad,
  } = useDetailOfflineCache<any>(detailCacheKey("budget", id), readBudgetDetailCache);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fmt = (n: number) =>
    new Intl.NumberFormat(i18n.language || "en", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);

  const fetchBudget = useCallback(async () => {
    const res = await api.get<any>("/api/budget", { id });
    if (res.error) {
      setError(t("budget.unavailable"));
      return false;
    }
    if (res.data?.budget) {
      setBudget(res.data.budget);
      setError(null);
    } else if (res.data?.budgets?.length) {
      setBudget(res.data.budgets.find((item: any) => item.id === id) || null);
      setError(null);
    }
    return true;
  }, [id, t]);

  const load = useCallback(async () => {
    startForegroundLoad();
    try {
      await fetchBudget();
    } finally {
      setLoading(false);
    }
  }, [fetchBudget, setLoading, startForegroundLoad]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchBudget();
    } finally {
      setRefreshing(false);
    }
  }, [fetchBudget]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingScreen />;

  if (!budget) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t("budget.title")}</Text>
          <View style={{ width: 44 }} />
        </View>
        <ErrorState
          title={error ? t("budget.unavailable") : t("budget.notFound")}
          message={error || t("budget.removed")}
          onRetry={load}
        />
      </SafeAreaView>
    );
  }

  const income = budget.actualIncome || 0;
  const expenses = budget.actualExpenses || 0;
  const plannedIncome = budget.plannedIncome || 0;
  const plannedExpenses = budget.plannedExpenses || 0;
  const savings = income - expenses;
  const plannedSavings = plannedIncome - plannedExpenses;
  const overBudget = plannedExpenses > 0 && expenses > plannedExpenses;
  const spendPct = plannedExpenses > 0 ? Math.min(100, (expenses / plannedExpenses) * 100) : 0;

  let categoryBreakdown: [string, number][] = [];
  if (budget.categoryBreakdown) {
    try {
      const raw = typeof budget.categoryBreakdown === "string"
        ? JSON.parse(budget.categoryBreakdown)
        : budget.categoryBreakdown;
      if (raw && typeof raw === "object") {
        categoryBreakdown = Object.entries(raw as Record<string, number>).sort(([, a], [, b]) => (b as number) - (a as number));
      }
    } catch {}
  }

  const monthName = budget.month
    ? new Date(budget.month).toLocaleDateString(i18n.language || "en", { month: "long", year: "numeric" })
    : `${budget.month} ${budget.year}`;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{monthName}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        <HeroCard style={styles.hero} padding={16} radius={theme.radius.xl}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Wallet size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroKicker}>BUDGET COMMAND</Text>
              <Text style={styles.heroTitle} numberOfLines={1}>{monthName}</Text>
              <Text style={styles.heroSub} numberOfLines={1}>
                {overBudget ? t("budget.overBudget") : t("budget.onTrack")}
              </Text>
            </View>
            <Pill
              label={overBudget ? t("budget.overBudget") : t("budget.onTrack")}
              tone={overBudget ? "error" : "success"}
            />
          </View>

          <MoveProgressBar value={spendPct / 100} height={8} style={styles.progressTrack} />

          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{fmt(expenses)}</Text>
              <Text style={styles.heroStatLabel}>spent</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{plannedExpenses ? fmt(plannedExpenses) : "--"}</Text>
              <Text style={styles.heroStatLabel}>planned</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={[styles.heroStatValue, savings < 0 && styles.heroStatWarn]}>{fmt(savings)}</Text>
              <Text style={styles.heroStatLabel}>balance</Text>
            </View>
          </View>
        </HeroCard>

        <View style={styles.summaryGrid}>
          <MoveCard style={styles.summaryCard} padding={14} radius={theme.radius.xl}>
            <TrendingUp size={18} color={theme.colors.success} />
            <Text style={[styles.summaryValue, { color: theme.colors.success }]}>{fmt(income)}</Text>
            <Text style={styles.summaryLabel}>{t("budget.actualIncome")}</Text>
            {plannedIncome ? <Text style={styles.summaryPlanned}>{t("budget.plannedAmount", { amount: fmt(plannedIncome) })}</Text> : null}
          </MoveCard>
          <MoveCard style={styles.summaryCard} padding={14} radius={theme.radius.xl}>
            <TrendingDown size={18} color={theme.colors.error} />
            <Text style={[styles.summaryValue, { color: theme.colors.error }]}>{fmt(expenses)}</Text>
            <Text style={styles.summaryLabel}>{t("budget.actualExpenses")}</Text>
            {plannedExpenses ? <Text style={styles.summaryPlanned}>{t("budget.plannedAmount", { amount: fmt(plannedExpenses) })}</Text> : null}
          </MoveCard>
          <MoveCard style={styles.summaryCard} padding={14} radius={theme.radius.xl}>
            <DollarSign size={18} color={savings >= 0 ? theme.colors.success : theme.colors.error} />
            <Text style={[styles.summaryValue, { color: savings >= 0 ? theme.colors.success : theme.colors.error }]}>{fmt(savings)}</Text>
            <Text style={styles.summaryLabel}>{t("budget.savings")}</Text>
            {income > 0 ? <Text style={styles.summaryPlanned}>{t("budget.savingsRate", { rate: ((savings / income) * 100).toFixed(1) })}</Text> : null}
            {plannedIncome || plannedExpenses ? <Text style={styles.summaryPlanned}>Plan {fmt(plannedSavings)}</Text> : null}
          </MoveCard>
        </View>

        {/* Category Breakdown */}
        {categoryBreakdown.length > 0 && (
          <>
            <SectionHeader label={t("budget.spendingByCategory")} style={styles.sectionHeader} />
            <MoveCard style={styles.breakdownCard} padding={14} radius={theme.radius.xl}>
              {categoryBreakdown.map(([cat, amount], i) => {
                const pct = expenses > 0 ? ((amount as number) / expenses) * 100 : 0;
                return (
                  <View key={cat} style={[styles.categoryRow, i > 0 && styles.categoryDivider]}>
                    <View style={styles.categoryHeader}>
                      <Text style={styles.categoryName}>{cat}</Text>
                      <Text style={styles.categoryAmount}>{fmt(amount as number)}</Text>
                    </View>
                    <MoveProgressBar value={Math.min(100, pct) / 100} height={6} style={styles.progressBg} />
                    <Text style={styles.categoryPct}>{pct.toFixed(1)}%</Text>
                  </View>
                );
              })}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{t("budget.total")}</Text>
                <Text style={styles.totalValue}>{fmt(expenses)}</Text>
              </View>
            </MoveCard>
          </>
        )}

        {budget.notes && (
          <>
            <SectionHeader label={t("budget.notes")} style={styles.sectionHeader} />
            <MoveCard padding={14} radius={theme.radius.xl}>
              <Text style={styles.notes}>{budget.notes}</Text>
            </MoveCard>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center", marginHorizontal: 8, fontSize: 20, fontFamily: fonts.serifBold, color: theme.colors.text },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  hero: {
    marginBottom: 14,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: theme.colors.accentSoft,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCopy: { flex: 1, minWidth: 0 },
  heroKicker: {
    fontSize: 10,
    fontFamily: fonts.sansBold,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: theme.colors.primary,
  },
  heroTitle: {
    fontSize: 22,
    fontFamily: fonts.serifBold,
    color: theme.colors.text,
    marginTop: 3,
  },
  heroSub: {
    fontSize: 12,
    fontFamily: fonts.sans,
    color: theme.colors.faint,
    marginTop: 3,
  },
  progressTrack: {
    marginTop: 16,
  },
  heroStats: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  heroStat: {
    flex: 1,
    minHeight: 58,
    borderRadius: 16,
    padding: 10,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: "center",
  },
  heroStatValue: {
    fontSize: 13,
    fontFamily: fonts.sansBold,
    color: theme.colors.text,
  },
  heroStatWarn: {
    color: theme.colors.error,
  },
  heroStatLabel: {
    fontSize: 9,
    fontFamily: fonts.sansBold,
    letterSpacing: 0.6,
    color: theme.colors.faint,
    textTransform: "uppercase",
    marginTop: 3,
  },
  summaryGrid: { gap: 12 },
  summaryCard: { gap: 4 },
  summaryValue: { fontSize: 24, fontFamily: fonts.sansBold },
  summaryLabel: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.dim },
  summaryPlanned: { fontSize: 11, fontFamily: fonts.sans, color: theme.colors.faint, marginTop: 2 },
  sectionHeader: { marginTop: 20, marginBottom: 10, marginLeft: 2 },
  breakdownCard: { paddingTop: 6, paddingBottom: 12 },
  categoryRow: { paddingVertical: 10 },
  categoryDivider: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  categoryHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  categoryName: { fontSize: 13, fontFamily: fonts.sansSemibold, color: theme.colors.text },
  categoryAmount: { fontSize: 13, fontFamily: fonts.sansSemibold, color: theme.colors.dim },
  progressBg: { marginBottom: 3 },
  categoryPct: { fontSize: 10, fontFamily: fonts.sans, color: theme.colors.faint },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 12, marginTop: 4, borderTopWidth: 1, borderTopColor: theme.colors.border },
  totalLabel: { fontSize: 14, fontFamily: fonts.sansBold, color: theme.colors.text },
  totalValue: { fontSize: 14, fontFamily: fonts.sansBold, color: theme.colors.text },
  notes: { fontSize: 13, fontFamily: fonts.sans, color: theme.colors.dim, lineHeight: 20 },
});
