import React, { useEffect, useState, useCallback } from "react";
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
import { theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingScreen } from "@/components/ui/LoadingScreen";

export default function BudgetScreen() {
  const router = useRouter();
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBudgets = useCallback(async () => {
    const res = await api.get<any>("/api/budget");
    if (res.data) setBudgets(res.data.budgets || res.data || []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    await fetchBudgets();
    setLoading(false);
  }, [fetchBudgets]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBudgets();
    setRefreshing(false);
  }, [fetchBudgets]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingScreen />;

  const totalExpenses = budgets.reduce((sum, b) => sum + (b.actualExpenses || 0), 0);
  const totalIncome = budgets.reduce((sum, b) => sum + (b.actualIncome || 0), 0);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Budget</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push("/budget/new" as any)}>
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: theme.colors.emerald.bg, borderColor: theme.colors.emerald.border }]}>
          <TrendingUp size={16} color={theme.colors.emerald.text} />
          <Text style={[styles.summaryValue, { color: theme.colors.emerald.text }]}>${totalIncome.toLocaleString()}</Text>
          <Text style={styles.summaryLabel}>Income</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: theme.colors.rose.bg, borderColor: theme.colors.rose.border }]}>
          <TrendingDown size={16} color={theme.colors.rose.text} />
          <Text style={[styles.summaryValue, { color: theme.colors.rose.text }]}>${totalExpenses.toLocaleString()}</Text>
          <Text style={styles.summaryLabel}>Expenses</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: theme.colors.orange.bg, borderColor: theme.colors.orange.border }]}>
          <DollarSign size={16} color={theme.colors.orange.text} />
          <Text style={[styles.summaryValue, { color: theme.colors.orange.text }]}>${(totalIncome - totalExpenses).toLocaleString()}</Text>
          <Text style={styles.summaryLabel}>Balance</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {budgets.length === 0 ? (
          <EmptyState
            icon={<DollarSign size={32} color={theme.colors.primary} />}
            title="No budget entries"
            description="Start tracking your monthly income and expenses."
            actionLabel="Add Budget"
            onAction={() => router.push("/budget/new" as any)}
          />
        ) : (
          <View style={styles.list}>
            {budgets.map((budget: any) => (
              <Card key={budget.id} variant="default">
                <View style={styles.budgetHeader}>
                  <Text style={styles.budgetMonth}>{budget.month} {budget.year}</Text>
                  <Text style={[styles.budgetBalance, { color: (budget.actualIncome || 0) - (budget.actualExpenses || 0) >= 0 ? theme.colors.emerald.text : theme.colors.rose.text }]}>
                    ${((budget.actualIncome || 0) - (budget.actualExpenses || 0)).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.budgetStats}>
                  <View style={styles.budgetStat}>
                    <Text style={styles.budgetStatLabel}>Income</Text>
                    <Text style={[styles.budgetStatValue, { color: theme.colors.emerald.text }]}>${(budget.actualIncome || 0).toLocaleString()}</Text>
                  </View>
                  <View style={styles.budgetStat}>
                    <Text style={styles.budgetStatLabel}>Expenses</Text>
                    <Text style={[styles.budgetStatValue, { color: theme.colors.rose.text }]}>${(budget.actualExpenses || 0).toLocaleString()}</Text>
                  </View>
                  <View style={styles.budgetStat}>
                    <Text style={styles.budgetStatLabel}>Planned</Text>
                    <Text style={styles.budgetStatValue}>${(budget.plannedExpenses || 0).toLocaleString()}</Text>
                  </View>
                </View>
                {budget.notes && <Text style={styles.budgetNotes} numberOfLines={2}>{budget.notes}</Text>}
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700", color: theme.colors.text },
  addBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center", ...theme.shadow.glow },
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
