import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  DollarSign,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Plus,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingScreen } from "@/components/ui/LoadingScreen";

// `service.monthlyCost` is the RAW per-cycle amount the user typed, so normalize
// to a true monthly figure before summing (mirrors the tax-report math).
function monthlyForCycle(cost: number, cycle?: string): number {
  const c = (cycle || "MONTHLY").toUpperCase();
  if (c === "YEARLY") return cost / 12;
  if (c === "QUARTERLY") return cost / 3;
  if (c === "WEEKLY") return (cost * 52) / 12;
  if (c === "ONE_TIME") return 0;
  return cost;
}

export default function BudgetScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [budgets, setBudgets] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);

  // Locale-aware currency formatter — reused in every card.
  const fmt = (n: number) =>
    new Intl.NumberFormat(i18n.language || "en", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBudgets = useCallback(async () => {
    const [res, svcRes] = await Promise.all([
      api.get<any>("/api/budget"),
      api.get<any>("/api/services", { limit: "200" }),
    ]);
    if (res.error) {
      setError(res.error);
      return false;
    }
    if (res.data) {
      setBudgets(res.data.budgets || res.data || []);
      setError(null);
    }
    if (svcRes.data) setServices(svcRes.data.services || svcRes.data || []);
    return true;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await fetchBudgets();
    } finally {
      setLoading(false);
    }
  }, [fetchBudgets]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchBudgets();
    } finally {
      setRefreshing(false);
    }
  }, [fetchBudgets]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingScreen />;

  const totalExpenses = budgets.reduce((sum, b) => sum + (b.actualExpenses || 0), 0);
  const totalIncome = budgets.reduce((sum, b) => sum + (b.actualIncome || 0), 0);
  const monthlyServiceCost = services.reduce((sum, s) => sum + monthlyForCycle(Number(s.monthlyCost) || 0, s.billingCycle), 0);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("budget.title")}</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push("/budget/new")}>
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Live monthly spend derived from the user's tracked services — shows
          even with zero manual budgets, which was the confusing "$0" before. */}
      {monthlyServiceCost > 0 ? (
        <View style={styles.serviceBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.serviceBannerLabel}>{t("budget.monthlyServiceCosts", { defaultValue: "Monthly service costs" })}</Text>
            <Text style={styles.serviceBannerSub}>
              {t("budget.fromYourServices", { count: services.length, defaultValue: "From your {{count}} tracked services" })}
            </Text>
          </View>
          <Text style={styles.serviceBannerValue}>{fmt(monthlyServiceCost)}</Text>
        </View>
      ) : null}

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: theme.colors.emerald.bg, borderColor: theme.colors.emerald.border }]}>
          <TrendingUp size={16} color={theme.colors.emerald.text} />
          <Text style={[styles.summaryValue, { color: theme.colors.emerald.text }]}>{fmt(totalIncome)}</Text>
          <Text style={styles.summaryLabel}>{t("budget.actualIncome")}</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: theme.colors.rose.bg, borderColor: theme.colors.rose.border }]}>
          <TrendingDown size={16} color={theme.colors.rose.text} />
          <Text style={[styles.summaryValue, { color: theme.colors.rose.text }]}>{fmt(totalExpenses)}</Text>
          <Text style={styles.summaryLabel}>{t("budget.actualExpenses")}</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: theme.colors.orange.bg, borderColor: theme.colors.orange.border }]}>
          <DollarSign size={16} color={theme.colors.orange.text} />
          <Text style={[styles.summaryValue, { color: theme.colors.orange.text }]}>{fmt(totalIncome - totalExpenses)}</Text>
          <Text style={styles.summaryLabel}>{t("budget.variance")}</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {error && budgets.length > 0 ? (
          <View style={{ marginHorizontal: 16, marginBottom: 12, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.rose.text }}>
            <Text style={{ color: theme.colors.rose.text, fontSize: 12, textAlign: "center" }}>{error}</Text>
          </View>
        ) : null}
        {error && budgets.length === 0 ? (
          <ErrorState message={error} onRetry={load} />
        ) : budgets.length === 0 ? (
          <EmptyState
            icon={<DollarSign size={32} color={theme.colors.primary} />}
            title={t("empty.budgets")}
            description={t("empty.budgetsDescription")}
            actionLabel={t("empty.addBudget")}
            onAction={() => router.push("/budget/new")}
          />
        ) : (
          <View style={styles.list}>
            {budgets.map((budget: any) => (
              <TouchableOpacity key={budget.id} activeOpacity={0.7} onPress={() => router.push({ pathname: "/budget/[id]", params: { id: budget.id } })}>
              <Card variant="default">
                <View style={styles.budgetHeader}>
                  <Text style={styles.budgetMonth}>
                    {(() => {
                      // `budget.month` is a DateTime (ISO); there is no `year`
                      // field. Format the month into "Month Year" instead of
                      // rendering a raw timestamp followed by `undefined`.
                      const d = budget.month ? new Date(budget.month) : null;
                      return d && !Number.isNaN(d.getTime())
                        ? d.toLocaleDateString(undefined, { year: "numeric", month: "long" })
                        : "";
                    })()}
                  </Text>
                  <Text style={[styles.budgetBalance, { color: (budget.actualIncome || 0) - (budget.actualExpenses || 0) >= 0 ? theme.colors.emerald.text : theme.colors.rose.text }]}>
                    {fmt((budget.actualIncome || 0) - (budget.actualExpenses || 0))}
                  </Text>
                </View>
                <View style={styles.budgetStats}>
                  <View style={styles.budgetStat}>
                    <Text style={styles.budgetStatLabel}>{t("budget.actualIncome")}</Text>
                    <Text style={[styles.budgetStatValue, { color: theme.colors.emerald.text }]}>{fmt(budget.actualIncome || 0)}</Text>
                  </View>
                  <View style={styles.budgetStat}>
                    <Text style={styles.budgetStatLabel}>{t("budget.actualExpenses")}</Text>
                    <Text style={[styles.budgetStatValue, { color: theme.colors.rose.text }]}>{fmt(budget.actualExpenses || 0)}</Text>
                  </View>
                  <View style={styles.budgetStat}>
                    <Text style={styles.budgetStatLabel}>{t("budget.plannedExpenses")}</Text>
                    <Text style={styles.budgetStatValue}>{fmt(budget.plannedExpenses || 0)}</Text>
                  </View>
                </View>
                {budget.notes && <Text style={styles.budgetNotes} numberOfLines={2}>{budget.notes}</Text>}
              </Card>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700", color: theme.colors.text },
  addBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center", ...theme.shadow.glow },
  serviceBanner: { flexDirection: "row", alignItems: "center", marginHorizontal: 20, marginBottom: 16, padding: 16, borderRadius: theme.radius.xl, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.card },
  serviceBannerLabel: { fontSize: 13, fontWeight: "700", color: theme.colors.text },
  serviceBannerSub: { fontSize: 11, color: theme.colors.textTertiary, marginTop: 2 },
  serviceBannerValue: { fontSize: 20, fontWeight: "800", color: theme.colors.primary },
  summaryRow: { flexDirection: "row", paddingHorizontal: 20, gap: 10, marginBottom: 16 },
  summaryCard: { flex: 1, borderRadius: theme.radius.lg, borderWidth: 1, padding: 12, alignItems: "center", gap: 4 },
  summaryValue: { fontSize: 16, fontWeight: "800" },
  summaryLabel: { fontSize: 11, color: theme.colors.textTertiary },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 32 },
  list: { gap: 12 },
  budgetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  budgetMonth: { fontSize: 16, fontWeight: "700", color: theme.colors.text },
  budgetBalance: { fontSize: 18, fontWeight: "800" },
  budgetStats: { flexDirection: "row", gap: 16, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.border },
  budgetStat: { flex: 1 },
  budgetStatLabel: { fontSize: 11, color: theme.colors.textTertiary },
  budgetStatValue: { fontSize: 14, fontWeight: "700", color: theme.colors.textSecondary, marginTop: 2 },
  budgetNotes: { fontSize: 13, color: theme.colors.textTertiary, marginTop: 10, lineHeight: 18, fontStyle: "italic" },
});
