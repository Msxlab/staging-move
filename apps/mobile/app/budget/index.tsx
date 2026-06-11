import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  DollarSign,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Plus,
  Target,
  Calendar,
  PiggyBank,
  BarChart3,
  Sparkles,
  Receipt,
  AlertTriangle,
  WalletCards,
  Check,
  X,
  ChevronDown,
  Wallet,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  BUDGET_CATEGORY_LABELS,
  calculateBudgetActuals,
  calculateBudgetPlan,
  monthlyAmountForCycle,
  parseBudgetCategoryLimits,
  type BudgetCategoryLabel,
  type ServiceCostInput,
} from "@locateflow/shared";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { GradientProgress } from "@/components/ui/GradientProgress";
import { CountUp } from "@/components/ui/CountUp";
import { ListEntrance } from "@/components/ui/ListEntrance";
import { PressableScale } from "@/components/ui/PressableScale";
import { CollapsibleCard } from "@/components/ui/CollapsibleCard";
import { SuccessToast } from "@/components/ui/SuccessToast";
import { hapticSuccess, hapticError, hapticLight } from "@/lib/haptics";

interface BudgetRow {
  id: string;
  month: string;
  year?: number;
  plannedIncome?: number | null;
  actualIncome?: number | null;
  plannedExpenses?: number | null;
  actualExpenses?: number | null;
  savingsRate?: number | null;
  categoryBreakdown?: string | null;
  notes?: string | null;
  addressId?: string | null;
}

interface AddressOption {
  id: string;
  city?: string | null;
  state?: string | null;
  nickname?: string | null;
  isPrimary?: boolean;
}

// Per-category bar colors — the friendly tone tokens already on the theme,
// so the palette flips with light/dark + plan accent. Falls back to primary.
function categoryColor(theme: Theme, category: BudgetCategoryLabel): readonly [string, string] {
  const map: Partial<Record<BudgetCategoryLabel, readonly [string, string]>> = {
    Utilities: [theme.colors.cyan.text, theme.colors.cyan.border],
    "Internet & Phone": [theme.colors.sky.text, theme.colors.sky.border],
    Insurance: [theme.colors.amber.text, theme.colors.amber.border],
    Subscriptions: [theme.colors.primary, theme.colors.primaryLight],
    "Banking / Financial": [theme.colors.emerald.text, theme.colors.emerald.border],
    Moving: [theme.colors.orange.text, theme.colors.orange.border],
    Shopping: [theme.colors.emerald.border, theme.colors.emerald.text],
    Transportation: [theme.colors.sky.border, theme.colors.sky.text],
  };
  return map[category] || theme.colors.gradient.primary;
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthDateFromKey(monthKey: string) {
  const [year, month] = monthKey.split("-").map((part) => Number(part));
  // UTC-anchored to match the shared engine's isDateInMonth comparisons.
  return new Date(Date.UTC(year, (month || 1) - 1, 1));
}

function budgetMonthKey(month: string | Date) {
  const date = month instanceof Date ? month : new Date(month);
  if (!Number.isFinite(date.getTime())) return "";
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(monthKey: string, locale: string) {
  return monthDateFromKey(monthKey).toLocaleDateString(locale || "en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Add `delta` calendar months to a YYYY-MM key. Used by the month stepper.
function shiftMonthKey(monthKey: string, delta: number) {
  const [year, month] = monthKey.split("-").map((part) => Number(part));
  const d = new Date(Date.UTC(year, (month || 1) - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function addressLabel(addresses: AddressOption[], addressId?: string | null) {
  if (!addressId) return "All addresses";
  const address = addresses.find((item) => item.id === addressId);
  if (!address) return "Selected address";
  return address.nickname || [address.city, address.state].filter(Boolean).join(", ") || "Address";
}

function cycleSuffix(billingCycle?: string | null): string {
  const cycle = (billingCycle || "MONTHLY").trim().toUpperCase();
  if (cycle === "ONE_TIME") return " one-time";
  if (cycle === "YEARLY" || cycle === "ANNUAL") return "/yr";
  if (cycle === "QUARTERLY") return "/qtr";
  if (cycle === "WEEKLY") return "/wk";
  return "/mo";
}

function toServices(rows: any[]): ServiceCostInput[] {
  return rows.map((service) => ({
    id: service.id,
    providerName: service.providerName,
    category: service.category,
    addressId: service.addressId,
    monthlyCost:
      typeof service.monthlyCost === "number" ? service.monthlyCost : Number(service.monthlyCost || 0),
    actualMonthlyCost:
      service.actualMonthlyCost === null || service.actualMonthlyCost === undefined
        ? null
        : Number(service.actualMonthlyCost),
    billingCycle: service.billingCycle,
    isActive: service.isActive,
    activatedAt: service.activatedAt,
    createdAt: service.createdAt,
  }));
}

export default function BudgetScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const locale = i18n.language || "en";

  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [addresses, setAddresses] = useState<AddressOption[]>([]);
  const [services, setServices] = useState<ServiceCostInput[]>([]);
  // Logged actual per service for the VIEWED month (serviceId → amount). Refetched
  // when the month/address filter changes so the month-stepper shows that month's
  // real ServiceCostLog rows, never one overwriting scalar.
  const [monthActuals, setMonthActuals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters mirror web: a month stepper + an address picker.
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [addressPickerOpen, setAddressPickerOpen] = useState(false);

  // Per-line actual cost drafts (keyed by service id) + which row is saving.
  const [actualDrafts, setActualDrafts] = useState<Record<string, string>>({});
  const [savingActualId, setSavingActualId] = useState<string | null>(null);
  // Success micro-moment when a real actual cost is logged (not on clear). The
  // screen stays mounted, so the toast self-resets via onHide.
  const [showActualSaved, setShowActualSaved] = useState(false);

  const fmt = useCallback(
    (n: number) =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(n),
    [locale],
  );

  const fetchAll = useCallback(async () => {
    const [budgetRes, addrRes, svcRes] = await Promise.all([
      api.get<any>("/api/budget"),
      api.get<any>("/api/addresses", { limit: "200" }),
      api.get<any>("/api/services", { limit: "200" }),
    ]);
    if (budgetRes.error) {
      setError(budgetRes.error);
      return false;
    }
    setError(null);
    setBudgets(budgetRes.data?.budgets || budgetRes.data || []);
    setAddresses(addrRes.data?.addresses || addrRes.data || []);
    setServices(toServices(svcRes.data?.services || svcRes.data || []));
    return true;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await fetchAll();
    } finally {
      setLoading(false);
    }
  }, [fetchAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchAll();
    } finally {
      setRefreshing(false);
    }
  }, [fetchAll]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedMonthDate = useMemo(() => monthDateFromKey(selectedMonth), [selectedMonth]);
  const selectedAddress = selectedAddressId || null;

  // Fetch the VIEWED month's logged actuals (ServiceCostLog rows) whenever the
  // month/address changes — this is what makes stepping months show real
  // per-month numbers instead of one scalar.
  const loadMonthActuals = useCallback(async () => {
    const params: Record<string, string> = { month: `${selectedMonth}-01` };
    if (selectedAddress) params.addressId = selectedAddress;
    const res = await api.get<any>("/api/budget/actuals", params);
    if (res.error || !res.data) {
      setMonthActuals({});
      return;
    }
    const next: Record<string, number> = {};
    for (const service of res.data.services || []) {
      if (service.loggedActual !== null && service.loggedActual !== undefined) {
        next[service.id] = Number(service.loggedActual);
      }
    }
    setMonthActuals(next);
  }, [selectedMonth, selectedAddress]);

  useEffect(() => {
    loadMonthActuals();
  }, [loadMonthActuals]);

  // Engine input for the SELECTED month: attach each service's per-month log (or
  // an empty array = estimate only) so the shared engine resolves actuals from
  // the viewed month, not the legacy scalar.
  const servicesForMonth = useMemo<ServiceCostInput[]>(
    () =>
      services.map((service) => ({
        ...service,
        costLogs:
          monthActuals[service.id] !== undefined
            ? [{ month: `${selectedMonth}-01`, amount: monthActuals[service.id] }]
            : [],
      })),
    [services, monthActuals, selectedMonth],
  );

  // ── Shared engine: projection plan + estimate-vs-actual reconciliation ──
  const plan = useMemo(
    () => calculateBudgetPlan(services, { month: selectedMonthDate, addressId: selectedAddress }),
    [services, selectedAddress, selectedMonthDate],
  );
  const actuals = useMemo(
    () => calculateBudgetActuals(servicesForMonth, { month: selectedMonthDate, addressId: selectedAddress }),
    [servicesForMonth, selectedAddress, selectedMonthDate],
  );

  const currentBudget = useMemo(
    () =>
      budgets.find(
        (budget) =>
          budgetMonthKey(budget.month) === selectedMonth &&
          (budget.addressId || "") === (selectedAddressId || ""),
      ) || null,
    [budgets, selectedAddressId, selectedMonth],
  );

  const budgetLimit = currentBudget?.plannedExpenses || 0;
  const categoryLimits = useMemo(
    () => parseBudgetCategoryLimits(currentBudget?.categoryBreakdown || null),
    [currentBudget],
  );
  const budgetDelta = budgetLimit > 0 ? budgetLimit - plan.projectedThisMonth : null;
  const budgetUsedPercent =
    budgetLimit > 0 ? Math.min((plan.projectedThisMonth / budgetLimit) * 100, 100) : 0;
  const hasServiceCosts = plan.monthlyCommitted > 0 || plan.oneTimeThisMonth > 0;

  // Active, costed lines in scope — the rows a user can log a real cost for.
  const trackableServices = useMemo(
    () =>
      services.filter(
        (service) =>
          service.isActive !== false &&
          (!selectedAddress || service.addressId === selectedAddress) &&
          Number(service.monthlyCost || 0) > 0,
      ),
    [services, selectedAddress],
  );
  // "Logged" is per-VIEWED-month: a line counts as confirmed only if it has a log
  // for this month, never because of a leftover scalar from another month.
  const loggedActualCount = trackableServices.filter(
    (service) => monthActuals[service.id] !== undefined,
  ).length;

  const persistServiceActual = useCallback(
    async (serviceId: string, amount: number | null) => {
      setSavingActualId(serviceId);
      // Write the actual for the VIEWED month's ServiceCostLog row (not the single
      // scalar) so logging is scoped to the month on screen.
      const res = await api.post<any>("/api/budget/actuals", {
        serviceId,
        month: `${selectedMonth}-01`,
        amount,
      });
      setSavingActualId(null);
      if (res.error) {
        hapticError();
        setError(res.error);
        return;
      }
      if (amount === null) {
        // Clearing a logged actual — quiet success haptic, no celebration toast.
        hapticSuccess();
      } else {
        // Logged a real actual cost — fire the success micro-moment (the toast
        // fires hapticSuccess itself, so don't double it here).
        setShowActualSaved(true);
      }
      // Reflect locally so variance/savings recompute immediately for this month.
      setMonthActuals((prev) => {
        const next = { ...prev };
        if (amount === null) delete next[serviceId];
        else next[serviceId] = amount;
        return next;
      });
      setActualDrafts((prev) => {
        const next = { ...prev };
        delete next[serviceId];
        return next;
      });
      // Refresh the saved budgets so "Budget History" reflects the new actual
      // (the server recomputes the month's snapshot when an actual is logged).
      fetchAll();
    },
    [selectedMonth, fetchAll],
  );

  const confirmProjectedActual = useCallback(
    (service: ServiceCostInput) => {
      // One-tap "looks right" — the projected per-cycle amount becomes the actual.
      persistServiceActual(service.id, Number(service.monthlyCost || 0));
    },
    [persistServiceActual],
  );

  const saveActualDraft = useCallback(
    (service: ServiceCostInput) => {
      const raw = actualDrafts[service.id];
      if (raw === undefined || raw.trim() === "") {
        hapticError();
        return;
      }
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0) {
        hapticError();
        return;
      }
      persistServiceActual(service.id, value);
    },
    [actualDrafts, persistServiceActual],
  );

  if (loading) return <LoadingScreen />;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <PressableScale
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityLabel={t("common.back", { defaultValue: "Back" })}
        >
          <ArrowLeft size={22} color={theme.colors.text} />
        </PressableScale>
        <Text style={styles.title}>{t("budget.title")}</Text>
        <PressableScale
          style={styles.addBtn}
          onPress={() => router.push("/budget/new")}
          accessibilityLabel={t("budget.newBudget")}
        >
          <Plus size={20} color="#fff" />
        </PressableScale>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {error ? (
          budgets.length === 0 ? (
            <ErrorState message={error} onRetry={load} />
          ) : (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          )
        ) : null}

        {!error && services.length === 0 && budgets.length === 0 ? (
          /* First-run: nothing costed and no budgets yet — friendly mascot
             empty state instead of an all-zero dashboard. */
          <EmptyState
            mascot="kid"
            icon={<Wallet size={28} color={theme.colors.primary} />}
            title={t("budget.emptyHeroTitle", { defaultValue: "Nothing to budget yet" })}
            description={t("budget.emptyHeroDescription", {
              defaultValue: "Track a service with a monthly cost and we'll project your spending here — then set a limit to stay on top of it.",
            })}
            actionLabel={t("services.newTitle")}
            onAction={() => router.push("/services/new")}
            secondaryActionLabel={t("budget.setMonthlyBudget", { defaultValue: "Set Monthly Budget" })}
            onSecondaryAction={() => router.push("/budget/new")}
          />
        ) : (
        <>
        {/* ── Filters: month stepper + address picker ── */}
        <View style={styles.filterRow}>
          <View style={styles.monthStepper}>
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                setSelectedMonth((m) => shiftMonthKey(m, -1));
              }}
              style={styles.stepBtn}
              accessibilityRole="button"
              accessibilityLabel={t("budget.previousMonth", { defaultValue: "Previous month" })}
            >
              <ArrowLeft size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <View style={styles.monthLabelWrap}>
              <Calendar size={13} color={theme.colors.textTertiary} />
              <Text style={styles.monthLabelText} numberOfLines={1}>
                {monthLabel(selectedMonth, locale)}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                setSelectedMonth((m) => shiftMonthKey(m, 1));
              }}
              style={styles.stepBtn}
              accessibilityRole="button"
              accessibilityLabel={t("budget.nextMonth", { defaultValue: "Next month" })}
            >
              <ArrowLeft size={16} color={theme.colors.textSecondary} style={styles.flip} />
            </TouchableOpacity>
          </View>
        </View>

        {addresses.length > 0 ? (
          <View style={styles.addressPickerWrap}>
            <TouchableOpacity
              style={styles.addressPicker}
              activeOpacity={0.7}
              onPress={() => setAddressPickerOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={t("budget.filterByAddress", { defaultValue: "Filter by address" })}
            >
              <Target size={14} color={theme.colors.textTertiary} />
              <Text style={styles.addressPickerText} numberOfLines={1}>
                {addressLabel(addresses, selectedAddressId)}
              </Text>
              <ChevronDown size={16} color={theme.colors.textTertiary} />
            </TouchableOpacity>
            {addressPickerOpen ? (
              <View style={styles.addressMenu}>
                <TouchableOpacity
                  style={styles.addressMenuItem}
                  onPress={() => {
                    setSelectedAddressId("");
                    setAddressPickerOpen(false);
                  }}
                >
                  <Text style={[styles.addressMenuText, !selectedAddressId && styles.addressMenuActive]}>
                    {t("budget.allAddresses", { defaultValue: "All addresses" })}
                  </Text>
                  {!selectedAddressId ? <Check size={15} color={theme.colors.primary} /> : null}
                </TouchableOpacity>
                {addresses.map((address) => (
                  <TouchableOpacity
                    key={address.id}
                    style={styles.addressMenuItem}
                    onPress={() => {
                      setSelectedAddressId(address.id);
                      setAddressPickerOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.addressMenuText,
                        selectedAddressId === address.id && styles.addressMenuActive,
                      ]}
                      numberOfLines={1}
                    >
                      {address.nickname ||
                        [address.city, address.state].filter(Boolean).join(", ") ||
                        "Address"}
                    </Text>
                    {selectedAddressId === address.id ? (
                      <Check size={15} color={theme.colors.primary} />
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ── Nudge banners ── */}
        {!hasServiceCosts ? (
          <View style={[styles.nudge, styles.nudgeWarn]}>
            <AlertTriangle size={16} color={theme.colors.amber.text} />
            <Text style={[styles.nudgeText, { color: theme.colors.amber.text }]}>
              {t("budget.nudge_addCosts", {
                defaultValue: "Add costs to your services to unlock budget tracking.",
              })}
            </Text>
          </View>
        ) : !currentBudget ? (
          <View style={[styles.nudge, styles.nudgeInfo]}>
            <Target size={16} color={theme.colors.cyan.text} />
            <Text style={[styles.nudgeText, { color: theme.colors.cyan.text }]}>
              {t("budget.nudge_setLimit", {
                amount: fmt(plan.monthlyCommitted),
                defaultValue: `Your active services total ${fmt(
                  plan.monthlyCommitted,
                )}/mo. Set a monthly budget to compare.`,
              })}
            </Text>
          </View>
        ) : null}

        {/* ── Aurora glass hero — the month's projected spend at a glance ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <Text style={styles.heroKicker}>{monthLabel(selectedMonth, locale).toUpperCase()}</Text>
            <View style={styles.heroBadge}>
              <Wallet size={12} color={theme.colors.accent} />
              <Text style={styles.heroBadgeText} numberOfLines={1}>
                {addressLabel(addresses, selectedAddressId).toUpperCase()}
              </Text>
            </View>
          </View>
          <CountUp value={plan.projectedThisMonth} format={fmt} style={styles.heroBig} />
          <Text style={styles.heroSub}>
            {t("budget.projectedThisMonth", { defaultValue: "Projected this month" })}
            {budgetLimit > 0
              ? ` · ${t("budget.monthlyLimit", { defaultValue: "Budget limit" })} ${fmt(budgetLimit)}`
              : ` · ${t("budget.noLimitYet", { defaultValue: "No monthly limit yet" })}`}
          </Text>
          {budgetLimit > 0 ? (
            <GradientProgress
              progress={budgetUsedPercent}
              height={9}
              style={styles.heroBar}
              colors={
                plan.projectedThisMonth > budgetLimit
                  ? [theme.colors.rose.text, theme.colors.rose.border]
                  : [theme.colors.emerald.text, theme.colors.emerald.border]
              }
            />
          ) : null}
        </View>

        {/* ── Overview stat grid (parity with web's 4 stat cards) ── */}
        <View style={styles.statGrid}>
          <View style={[styles.statCard, { backgroundColor: theme.colors.orange.bg, borderColor: theme.colors.orange.border }]}>
            <DollarSign size={15} color={theme.colors.orange.text} />
            <CountUp
              value={plan.monthlyCommitted}
              format={fmt}
              style={[styles.statValue, { color: theme.colors.orange.text }]}
            />
            <Text style={styles.statLabel}>
              {t("budget.monthlyCommitted", { defaultValue: "Monthly committed" })}
            </Text>
            <Text style={styles.statSub}>
              {plan.costedRecurringServices.length}{" "}
              {t("budget.recurring", { defaultValue: "recurring" })}
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.colors.cyan.bg, borderColor: theme.colors.cyan.border }]}>
            <Target size={15} color={theme.colors.cyan.text} />
            <Text style={[styles.statValue, { color: theme.colors.cyan.text }]} numberOfLines={1}>
              {budgetLimit > 0 ? fmt(budgetLimit) : t("budget.notSet", { defaultValue: "Not set" })}
            </Text>
            <Text style={styles.statLabel}>
              {t("budget.monthlyLimit", { defaultValue: "Budget limit" })}
            </Text>
            <Text style={styles.statSub} numberOfLines={1}>
              {addressLabel(addresses, selectedAddressId)}
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.colors.emerald.bg, borderColor: theme.colors.emerald.border }]}>
            <Calendar size={15} color={theme.colors.emerald.text} />
            <CountUp
              value={plan.projectedThisMonth}
              format={fmt}
              style={[styles.statValue, { color: theme.colors.emerald.text }]}
            />
            <Text style={styles.statLabel}>
              {t("budget.projectedThisMonth", { defaultValue: "Projected this month" })}
            </Text>
            <Text style={styles.statSub}>
              {plan.oneTimeThisMonth > 0
                ? `${fmt(plan.oneTimeThisMonth)} ${t("budget.oneTime", { defaultValue: "one-time" })}`
                : monthLabel(selectedMonth, locale)}
            </Text>
          </View>
          <View
            style={[
              styles.statCard,
              budgetDelta !== null && budgetDelta < 0
                ? { backgroundColor: theme.colors.rose.bg, borderColor: theme.colors.rose.border }
                : { backgroundColor: theme.colors.emerald.bg, borderColor: theme.colors.emerald.border },
            ]}
          >
            <PiggyBank
              size={15}
              color={budgetDelta !== null && budgetDelta < 0 ? theme.colors.rose.text : theme.colors.emerald.text}
            />
            <Text
              style={[
                styles.statValue,
                { color: budgetDelta !== null && budgetDelta < 0 ? theme.colors.rose.text : theme.colors.emerald.text },
              ]}
              numberOfLines={1}
            >
              {budgetDelta === null ? t("budget.setBudget", { defaultValue: "Set budget" }) : fmt(Math.abs(budgetDelta))}
            </Text>
            <Text style={styles.statLabel}>
              {budgetDelta !== null && budgetDelta < 0
                ? t("budget.overBudget", { defaultValue: "Over budget" })
                : t("budget.underBudget", { defaultValue: "Under budget" })}
            </Text>
            <Text style={styles.statSub}>
              {budgetDelta === null
                ? t("budget.noLimitYet", { defaultValue: "No monthly limit yet" })
                : budgetDelta >= 0
                  ? t("budget.youreUnder", { defaultValue: "You're under" })
                  : t("budget.youreOver", { defaultValue: "You're over" })}
            </Text>
          </View>
        </View>

        {/* ── Budget vs committed: progress + committed/one-time/delta split ── */}
        <Card variant="default" style={styles.section}>
          <View style={styles.sectionHeader}>
            <Target size={16} color={theme.colors.cyan.text} />
            <Text style={styles.sectionTitle}>
              {t("budget.budgetVsCommitted", { defaultValue: "Budget vs Committed" })}
            </Text>
          </View>
          {budgetLimit <= 0 ? (
            <Text style={styles.emptyHint}>
              {t("budget.setLimitToCompare", {
                defaultValue: "Set a monthly budget limit to compare your committed and projected costs.",
              })}
            </Text>
          ) : (
            <View>
              <View style={styles.rowBetween}>
                <Text style={styles.mutedSm}>
                  {t("budget.projectedThisMonth", { defaultValue: "Projected this month" })}
                </Text>
                <Text style={styles.valueSm}>{fmt(plan.projectedThisMonth)}</Text>
              </View>
              <GradientProgress
                progress={budgetUsedPercent}
                height={10}
                style={styles.progressSpacing}
                colors={
                  plan.projectedThisMonth > budgetLimit
                    ? [theme.colors.rose.text, theme.colors.rose.border]
                    : [theme.colors.emerald.text, theme.colors.emerald.border]
                }
              />
              <View style={styles.splitRow}>
                <View style={styles.splitCell}>
                  <Text style={styles.splitLabel}>
                    {t("budget.committed", { defaultValue: "Committed" })}
                  </Text>
                  <Text style={styles.splitValue}>{fmt(plan.monthlyCommitted)}</Text>
                </View>
                <View style={styles.splitCell}>
                  <Text style={styles.splitLabel}>
                    {t("budget.oneTime", { defaultValue: "One-time" })}
                  </Text>
                  <Text style={styles.splitValue}>{fmt(plan.oneTimeThisMonth)}</Text>
                </View>
                <View style={styles.splitCell}>
                  <Text style={styles.splitLabel}>
                    {budgetDelta !== null && budgetDelta < 0
                      ? t("budget.over", { defaultValue: "Over" })
                      : t("budget.under", { defaultValue: "Under" })}
                  </Text>
                  <Text
                    style={[
                      styles.splitValue,
                      {
                        color:
                          budgetDelta !== null && budgetDelta < 0
                            ? theme.colors.rose.text
                            : theme.colors.emerald.text,
                      },
                    ]}
                  >
                    {budgetDelta === null ? fmt(0) : fmt(Math.abs(budgetDelta))}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </Card>

        {/* ── Spending by category with per-category limits ── */}
        <Card variant="default" style={styles.section}>
          <View style={styles.sectionHeader}>
            <BarChart3 size={16} color={theme.colors.orange.text} />
            <Text style={styles.sectionTitle}>
              {t("budget.spendingByCategory", { defaultValue: "Spending by Category" })}
            </Text>
          </View>
          {plan.byBudgetCategory.length === 0 ? (
            <Text style={styles.emptyHint}>
              {t("budget.noCostDataFilter", { defaultValue: "No service cost data for this filter." })}
            </Text>
          ) : (
            <View style={styles.catList}>
              {plan.byBudgetCategory.map((row, i) => {
                const limit = categoryLimits[row.category] || 0;
                const pct = Math.min((row.amount / Math.max(plan.projectedThisMonth, 1)) * 100, 100);
                const over = limit > 0 && row.amount > limit;
                return (
                  <ListEntrance key={row.category} index={i}>
                    <View style={styles.catRow}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.catName}>{row.category}</Text>
                        <Text style={[styles.catAmount, over && { color: theme.colors.rose.text }]}>
                          {fmt(row.amount)}
                          {limit > 0 ? ` / ${fmt(limit)}` : ""}
                        </Text>
                      </View>
                      <GradientProgress
                        progress={pct}
                        height={6}
                        style={styles.catBarSpacing}
                        colors={over ? [theme.colors.rose.text, theme.colors.rose.border] : categoryColor(theme, row.category)}
                      />
                    </View>
                  </ListEntrance>
                );
              })}
            </View>
          )}
        </Card>

        {/* ── MONEY LAYER: real savings (substantiated over logged lines) ── */}
        <Card
          variant="default"
          style={{
            ...styles.section,
            borderColor: theme.colors.emerald.border,
            backgroundColor: theme.colors.emerald.bg,
          }}
        >
          <View style={styles.sectionHeader}>
            <Sparkles size={16} color={theme.colors.emerald.text} />
            <Text style={styles.sectionTitle}>
              {t("budget.yourRealSavings", { defaultValue: "Your Real Savings" })}
            </Text>
          </View>
          {actuals.loggedServiceCount === 0 ? (
            <Text style={styles.emptyHint}>
              {t("budget.logToSeeSavings", {
                defaultValue: "Log what your services actually cost below to see substantiated savings vs. your estimates.",
              })}
            </Text>
          ) : (
            <View style={styles.savingsGrid}>
              <View style={styles.savingsCell}>
                <View style={styles.savingsLabelRow}>
                  {actuals.monthlySavings >= 0 ? (
                    <TrendingDown size={13} color={theme.colors.emerald.text} />
                  ) : (
                    <TrendingUp size={13} color={theme.colors.rose.text} />
                  )}
                  <Text style={styles.savingsLabel}>
                    {actuals.monthlySavings >= 0
                      ? t("budget.monthlySavings", { defaultValue: "Monthly savings" })
                      : t("budget.monthlyOverage", { defaultValue: "Monthly overage" })}
                  </Text>
                </View>
                <CountUp
                  value={Math.abs(actuals.monthlySavings)}
                  format={fmt}
                  style={[
                    styles.savingsValue,
                    { color: actuals.monthlySavings >= 0 ? theme.colors.emerald.text : theme.colors.rose.text },
                  ]}
                />
              </View>
              <View style={styles.savingsCell}>
                <Text style={styles.savingsLabel}>
                  {t("budget.annualized", { defaultValue: "Annualized" })}
                </Text>
                <CountUp
                  value={Math.abs(actuals.annualSavings)}
                  format={fmt}
                  style={[
                    styles.savingsValue,
                    { color: actuals.annualSavings >= 0 ? theme.colors.emerald.text : theme.colors.rose.text },
                  ]}
                />
              </View>
              <View style={styles.savingsCell}>
                <Text style={styles.savingsLabel}>
                  {t("budget.savingsRateLabel", { defaultValue: "Savings rate" })}
                </Text>
                <Text
                  style={[
                    styles.savingsValue,
                    { color: (actuals.savingsRate ?? 0) >= 0 ? theme.colors.emerald.text : theme.colors.rose.text },
                  ]}
                >
                  {actuals.savingsRate === null ? "—" : `${Math.round(actuals.savingsRate * 100)}%`}
                </Text>
              </View>
              <View style={styles.savingsCell}>
                <Text style={styles.savingsLabel}>
                  {t("budget.estimateVsActual", { defaultValue: "Estimate vs actual" })}
                </Text>
                <Text style={styles.savingsHeadline} numberOfLines={1}>
                  {fmt(actuals.projectedForLoggedServices)} → {fmt(actuals.actualThisMonth)}
                </Text>
                <Text style={styles.savingsConfirmed}>
                  {t("budget.confirmedCount", {
                    count: actuals.loggedServiceCount,
                    defaultValue: `${actuals.loggedServiceCount} confirmed`,
                  })}
                </Text>
              </View>
            </View>
          )}
        </Card>

        {/* ── Log actual costs: per-line input + "Looks right" + clear ── */}
        <Card variant="default" style={styles.section}>
          <View style={styles.sectionHeader}>
            <Receipt size={16} color={theme.colors.orange.text} />
            <Text style={styles.sectionTitle}>
              {t("budget.logActualCosts", { defaultValue: "Log Actual Costs" })}
            </Text>
            <View style={{ flex: 1 }} />
            <Badge
              label={`${loggedActualCount}/${trackableServices.length}`}
              variant={loggedActualCount > 0 ? "success" : "neutral"}
            />
          </View>
          <Text style={styles.sectionSub}>
            {t("budget.logActualHintMonth", {
              month: monthLabel(selectedMonth, locale),
              defaultValue: `Logging ${monthLabel(selectedMonth, locale)}. Confirm the estimate or enter what each service actually cost that month. We compare it to our projection to prove your savings.`,
            })}
          </Text>
          {trackableServices.length === 0 ? (
            <Text style={styles.emptyHint}>
              {t("budget.noCostedServices", { defaultValue: "No active costed services in this filter yet." })}
            </Text>
          ) : (
            <View style={styles.logList}>
              {trackableServices.map((service, i) => {
                const projected = Number(service.monthlyCost || 0);
                // hasActual is per the VIEWED month's log, not a single scalar.
                const hasActual = monthActuals[service.id] !== undefined;
                const actual = hasActual ? Number(monthActuals[service.id]) : null;
                const draft = actualDrafts[service.id];
                const isSaving = savingActualId === service.id;
                const lineVariance =
                  actual !== null
                    ? monthlyAmountForCycle(projected, service.billingCycle) -
                      monthlyAmountForCycle(actual, service.billingCycle)
                    : null;
                return (
                  <ListEntrance key={service.id} index={i}>
                    <View style={styles.logRow}>
                      <View style={styles.rowBetween}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={styles.logName} numberOfLines={1}>
                            {service.providerName}
                          </Text>
                          <Text style={styles.logMeta} numberOfLines={1}>
                            {t("budget.est", { defaultValue: "Est." })} {fmt(projected)}
                            {cycleSuffix(service.billingCycle)}
                            {hasActual
                              ? ` · ${t("budget.youPaid", { defaultValue: "You paid" })} ${fmt(actual!)}${cycleSuffix(service.billingCycle)}`
                              : ""}
                          </Text>
                        </View>
                        {hasActual && lineVariance !== null ? (
                          <Badge
                            label={`${lineVariance >= 0 ? t("budget.saved", { defaultValue: "Saved" }) : t("budget.over", { defaultValue: "Over" })} ${fmt(Math.abs(lineVariance))}/mo`}
                            variant={lineVariance >= 0 ? "success" : "error"}
                          />
                        ) : null}
                      </View>
                      <View style={styles.logInputRow}>
                        <View style={styles.logInputWrap}>
                          <DollarSign size={13} color={theme.colors.textMuted} />
                          <TextInput
                            style={styles.logInput}
                            keyboardType="decimal-pad"
                            placeholder={
                              hasActual
                                ? String(actual)
                                : t("budget.whatYouPaid", { defaultValue: "What you actually paid" })
                            }
                            placeholderTextColor={theme.colors.textMuted}
                            value={draft ?? (hasActual ? String(actual) : "")}
                            editable={!isSaving}
                            onChangeText={(value) =>
                              setActualDrafts((prev) => ({
                                ...prev,
                                [service.id]: value.replace(/[^0-9.]/g, ""),
                              }))
                            }
                          />
                        </View>
                        <TouchableOpacity
                          style={styles.saveActualBtn}
                          onPress={() => saveActualDraft(service)}
                          disabled={isSaving}
                          activeOpacity={0.7}
                          accessibilityRole="button"
                          accessibilityLabel={t("common.save")}
                        >
                          {isSaving ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.saveActualText}>{t("common.save", { defaultValue: "Save" })}</Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.looksRightBtn}
                          onPress={() => confirmProjectedActual(service)}
                          disabled={isSaving}
                          activeOpacity={0.7}
                          accessibilityRole="button"
                          accessibilityLabel={t("budget.looksRight", { defaultValue: "Looks right" })}
                        >
                          <Check size={14} color={theme.colors.emerald.text} />
                        </TouchableOpacity>
                        {hasActual ? (
                          <TouchableOpacity
                            style={styles.clearActualBtn}
                            onPress={() => persistServiceActual(service.id, null)}
                            disabled={isSaving}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel={t("budget.clearActual", { defaultValue: "Clear actual" })}
                          >
                            <X size={14} color={theme.colors.textMuted} />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  </ListEntrance>
                );
              })}
            </View>
          )}
        </Card>

        {/* ── Estimate vs actual variance by category (collapsed by default) ── */}
        {actuals.loggedServiceCount > 0 ? (
          <CollapsibleCard
            title={t("budget.estimateVsActualByCategory", { defaultValue: "Estimate vs Actual by Category" })}
            icon={<BarChart3 size={16} color={theme.colors.cyan.text} />}
          >
            <View style={styles.catList}>
              {actuals.perCategory
                .filter((row) => row.loggedCount > 0)
                .map((row) => {
                  const saved = row.variance >= 0;
                  return (
                    <View key={row.category} style={styles.varRow}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.catName}>{row.category}</Text>
                        <Text
                          style={[
                            styles.catAmount,
                            { color: saved ? theme.colors.emerald.text : theme.colors.rose.text },
                          ]}
                        >
                          {saved
                            ? t("budget.saved", { defaultValue: "Saved" })
                            : t("budget.over", { defaultValue: "Over" })}{" "}
                          {fmt(Math.abs(row.variance))}
                        </Text>
                      </View>
                      <View style={styles.varMetaRow}>
                        <Text style={styles.varMeta}>
                          {t("budget.est", { defaultValue: "Est." })} {fmt(row.projected)} →{" "}
                          {t("budget.actual", { defaultValue: "Actual" })} {fmt(row.actual)}
                        </Text>
                        <Text style={styles.varMeta}>
                          {row.loggedCount}/{row.totalCount}{" "}
                          {t("budget.confirmed", { defaultValue: "confirmed" })}
                        </Text>
                      </View>
                    </View>
                  );
                })}
            </View>
          </CollapsibleCard>
        ) : null}

        {/* ── One-time costs this month (collapsed by default) ── */}
        {plan.oneTimeServicesThisMonth.length > 0 ? (
          <CollapsibleCard
            title={t("budget.oneTimeThisMonth", { defaultValue: "One-time Costs This Month" })}
            icon={<WalletCards size={16} color={theme.colors.amber.text} />}
          >
            <View style={styles.simpleList}>
              {plan.oneTimeServicesThisMonth.map((service) => (
                <View key={service.id} style={styles.simpleRow}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.simpleName} numberOfLines={1}>
                      {service.providerName}
                    </Text>
                    <Text style={styles.simpleMeta} numberOfLines={1}>
                      {service.friendlyCategory} · {service.budgetCategory}
                    </Text>
                  </View>
                  <Text style={styles.simpleAmount}>{fmt(service.oneTimeAmount)}</Text>
                </View>
              ))}
            </View>
          </CollapsibleCard>
        ) : null}

        {/* ── Services missing cost: nudge list (collapsed by default) ── */}
        <CollapsibleCard
          title={t("budget.servicesMissingCost", { defaultValue: "Services Missing Cost" })}
          icon={<AlertTriangle size={16} color={theme.colors.amber.text} />}
          headerRight={
            plan.missingCostServices.length > 0 ? (
              <Badge label={String(plan.missingCostServices.length)} variant="warning" />
            ) : undefined
          }
        >
          {plan.missingCostServices.length === 0 ? (
            <Text style={styles.emptyHint}>
              {t("budget.allHaveCost", { defaultValue: "All active services in this filter have cost data." })}
            </Text>
          ) : (
            <View style={styles.simpleList}>
              {plan.missingCostServices.slice(0, 8).map((service) => (
                <TouchableOpacity
                  key={service.id}
                  style={styles.simpleRow}
                  activeOpacity={0.7}
                  onPress={() => router.push({ pathname: "/services/[id]", params: { id: service.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={t("budget.addCostFor", {
                    name: service.providerName,
                    defaultValue: `Add cost for ${service.providerName}`,
                  })}
                >
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.simpleName} numberOfLines={1}>
                      {service.providerName}
                    </Text>
                    <Text style={styles.simpleMeta} numberOfLines={1}>
                      {service.friendlyCategory} · {service.budgetCategory}
                    </Text>
                  </View>
                  <Text style={styles.addCostLink}>
                    {t("budget.addCost", { defaultValue: "Add cost" })}
                  </Text>
                </TouchableOpacity>
              ))}
              {plan.missingCostServices.length > 8 ? (
                <Text style={styles.moreHint}>
                  {t("budget.moreMissing", {
                    count: plan.missingCostServices.length - 8,
                    defaultValue: `+${plan.missingCostServices.length - 8} more services missing cost data`,
                  })}
                </Text>
              ) : null}
            </View>
          )}
        </CollapsibleCard>

        {/* ── Budget history: real actual spent + savings rate (collapsed) ── */}
        <CollapsibleCard
          title={t("budget.history", { defaultValue: "Budget History" })}
          icon={<Calendar size={16} color={theme.colors.orange.text} />}
          headerRight={
            budgets.length > 0 ? <Badge label={String(budgets.length)} variant="neutral" /> : undefined
          }
        >
          {budgets.length === 0 ? (
            <EmptyState
              icon={<Wallet size={28} color={theme.colors.primary} />}
              title={t("budget.noLimitsYet", { defaultValue: "No budget limits yet" })}
              description={
                hasServiceCosts
                  ? t("budget.nudge_setLimit", {
                      amount: fmt(plan.monthlyCommitted),
                      defaultValue: `Your active services total ${fmt(plan.monthlyCommitted)}/mo. Set a monthly budget to compare.`,
                    })
                  : t("budget.nudge_addCosts", {
                      defaultValue: "Add costs to your services to unlock budget tracking.",
                    })
              }
              actionLabel={t("budget.setMonthlyBudget", { defaultValue: "Set Monthly Budget" })}
              onAction={() => router.push("/budget/new")}
            />
          ) : (
            <View style={styles.historyList}>
              {budgets.map((budget, i) => {
                const key = budgetMonthKey(budget.month);
                const limit = budget.plannedExpenses || 0;
                // actualExpenses is now the REAL realized cost from logged actuals
                // (0 until something is confirmed) — no longer the projection.
                const actualSnapshot = budget.actualExpenses || 0;
                const delta = limit > 0 && actualSnapshot > 0 ? limit - actualSnapshot : null;
                const limits = parseBudgetCategoryLimits(budget.categoryBreakdown || null);
                const rate = budget.savingsRate;
                return (
                  <ListEntrance key={budget.id} index={i}>
                    <View style={styles.historyRow}>
                      <View style={styles.rowBetween}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.historyMonth}>{monthLabel(key, locale)}</Text>
                          <Text style={styles.historyAddr}>{addressLabel(addresses, budget.addressId)}</Text>
                        </View>
                        {delta !== null ? (
                          <Badge
                            label={
                              delta < 0
                                ? t("budget.overBudget", { defaultValue: "Over Budget" })
                                : t("budget.underBudget", { defaultValue: "Under Budget" })
                            }
                            variant={delta < 0 ? "error" : "success"}
                          />
                        ) : null}
                      </View>
                      <View style={styles.historyStats}>
                        <View style={styles.historyStat}>
                          <Text style={styles.historyStatLabel}>
                            {t("budget.budgetLimitShort", { defaultValue: "Budget limit" })}
                          </Text>
                          <Text style={styles.historyStatValue}>
                            {limit > 0 ? fmt(limit) : t("budget.notSet", { defaultValue: "Not set" })}
                          </Text>
                        </View>
                        <View style={styles.historyStat}>
                          <Text style={styles.historyStatLabel}>
                            {t("budget.actualSpent", { defaultValue: "Actual spent" })}
                          </Text>
                          <Text style={styles.historyStatValue}>
                            {actualSnapshot > 0
                              ? fmt(actualSnapshot)
                              : t("budget.notLogged", { defaultValue: "Not logged" })}
                          </Text>
                        </View>
                        <View style={styles.historyStat}>
                          <Text style={styles.historyStatLabel}>
                            {t("budget.savingsRateLabel", { defaultValue: "Savings rate" })}
                          </Text>
                          <Text
                            style={[
                              styles.historyStatValue,
                              rate !== null && rate !== undefined
                                ? { color: rate >= 0 ? theme.colors.emerald.text : theme.colors.rose.text }
                                : null,
                            ]}
                          >
                            {rate === null || rate === undefined ? "—" : `${Math.round(rate * 100)}%`}
                          </Text>
                        </View>
                      </View>
                      {Object.keys(limits).length > 0 ? (
                        <View style={styles.limitChips}>
                          {Object.entries(limits).map(([category, amount]) => (
                            <Text key={category} style={styles.limitChip}>
                              {category}: {fmt(amount || 0)}
                            </Text>
                          ))}
                        </View>
                      ) : null}
                      {budget.notes ? (
                        <Text style={styles.historyNotes} numberOfLines={2}>
                          {budget.notes}
                        </Text>
                      ) : null}
                    </View>
                  </ListEntrance>
                );
              })}
            </View>
          )}
        </CollapsibleCard>
        </>
        )}
      </ScrollView>
      <SuccessToast
        visible={showActualSaved}
        message={t("budget.actualSavedToast", { defaultValue: "Cost logged" })}
        detail={t("budget.actualSavedToastDetail", { defaultValue: "Your real savings just got more accurate." })}
        onHide={() => setShowActualSaved(false)}
      />
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    backBtn: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { fontSize: 20, fontWeight: "700", color: theme.colors.text },
    addBtn: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: theme.colors.primary,
      alignItems: "center",
      justifyContent: "center",
      ...theme.shadow.glow,
    },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

    errorBanner: {
      marginBottom: 12,
      padding: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.rose.border,
      backgroundColor: theme.colors.rose.bg,
    },
    errorBannerText: { color: theme.colors.rose.text, fontSize: 12, textAlign: "center" },

    filterRow: { marginBottom: 10 },
    monthStepper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.lg,
      padding: 4,
    },
    stepBtn: {
      width: 38,
      height: 38,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    flip: { transform: [{ rotate: "180deg" }] },
    monthLabelWrap: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
    monthLabelText: { fontSize: 14, fontWeight: "700", color: theme.colors.text },

    addressPickerWrap: { marginBottom: 14, zIndex: 10 },
    addressPicker: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.lg,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    addressPickerText: { flex: 1, fontSize: 14, fontWeight: "600", color: theme.colors.text },
    addressMenu: {
      marginTop: 6,
      backgroundColor: theme.colors.elevated,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.lg,
      overflow: "hidden",
      ...theme.shadow.md,
    },
    addressMenuItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    addressMenuText: { fontSize: 14, color: theme.colors.textSecondary, flex: 1, paddingRight: 8 },
    addressMenuActive: { color: theme.colors.text, fontWeight: "700" },

    nudge: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      padding: 12,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      marginBottom: 14,
    },
    nudgeWarn: { backgroundColor: theme.colors.amber.bg, borderColor: theme.colors.amber.border },
    nudgeInfo: { backgroundColor: theme.colors.cyan.bg, borderColor: theme.colors.cyan.border },
    nudgeText: { flex: 1, fontSize: 12.5, lineHeight: 18 },

    // ── Aurora glass hero ──
    heroCard: {
      marginBottom: 14,
      padding: 16,
      borderRadius: theme.radius["2xl"],
      backgroundColor: theme.colors.glass.bg,
      borderWidth: 1,
      borderColor: theme.colors.glass.border,
      ...theme.shadow.glow,
    },
    heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 },
    heroKicker: { fontSize: 10, letterSpacing: 1.4, fontWeight: "700", color: theme.colors.textTertiary },
    heroBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      maxWidth: "55%",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: theme.colors.warningFaded,
      borderWidth: 1,
      borderColor: theme.colors.amber.border,
    },
    heroBadgeText: { flexShrink: 1, fontSize: 9, letterSpacing: 1, fontWeight: "700", color: theme.colors.accent },
    heroBig: { fontSize: 32, fontWeight: "800", letterSpacing: -1, color: theme.colors.text, fontVariant: ["tabular-nums"] },
    heroSub: { fontSize: 11, color: theme.colors.textTertiary, marginTop: 4, lineHeight: 16 },
    heroBar: { marginTop: 12 },

    statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
    statCard: {
      width: "47.8%",
      flexGrow: 1,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      padding: 12,
      gap: 3,
    },
    statValue: { fontSize: 18, fontWeight: "800", marginTop: 4, letterSpacing: -0.5 },
    statLabel: { fontSize: 11.5, color: theme.colors.textSecondary, fontWeight: "600" },
    statSub: { fontSize: 10.5, color: theme.colors.textTertiary },

    section: { marginBottom: 14 },
    sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
    sectionTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.text },
    sectionSub: { fontSize: 12, color: theme.colors.textTertiary, marginTop: -6, marginBottom: 12, lineHeight: 17 },
    emptyHint: { fontSize: 12.5, color: theme.colors.textTertiary, textAlign: "center", paddingVertical: 18 },

    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    mutedSm: { fontSize: 13, color: theme.colors.textSecondary },
    valueSm: { fontSize: 14, fontWeight: "700", color: theme.colors.text },
    progressSpacing: { marginTop: 10, marginBottom: 14 },

    splitRow: { flexDirection: "row", gap: 10 },
    splitCell: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      paddingVertical: 10,
      paddingHorizontal: 8,
      alignItems: "center",
    },
    splitLabel: { fontSize: 10.5, color: theme.colors.textTertiary, marginBottom: 3 },
    splitValue: { fontSize: 13.5, fontWeight: "700", color: theme.colors.text },

    catList: { gap: 14 },
    catRow: {},
    catName: { fontSize: 13, color: theme.colors.textSecondary, flex: 1, paddingRight: 8 },
    catAmount: { fontSize: 13, fontWeight: "700", color: theme.colors.text },
    catBarSpacing: { marginTop: 7 },

    savingsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    savingsCell: {
      width: "47.5%",
      flexGrow: 1,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: 12,
    },
    savingsLabelRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 },
    savingsLabel: { fontSize: 11, color: theme.colors.textTertiary, marginBottom: 4 },
    savingsValue: { fontSize: 19, fontWeight: "800", letterSpacing: -0.5 },
    savingsHeadline: { fontSize: 13, fontWeight: "700", color: theme.colors.text },
    savingsConfirmed: { fontSize: 10.5, color: theme.colors.textTertiary, marginTop: 3 },

    logList: { gap: 10 },
    logRow: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: 12,
      gap: 10,
    },
    logName: { fontSize: 14, fontWeight: "600", color: theme.colors.text },
    logMeta: { fontSize: 11.5, color: theme.colors.textTertiary, marginTop: 2 },
    logInputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    logInputWrap: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    logInput: { flex: 1, fontSize: 13, color: theme.colors.text, padding: 0 },
    saveActualBtn: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.md,
      paddingHorizontal: 14,
      paddingVertical: 9,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 56,
    },
    saveActualText: { fontSize: 12.5, fontWeight: "700", color: "#fff" },
    looksRightBtn: {
      width: 38,
      height: 36,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.emerald.border,
      backgroundColor: theme.colors.emerald.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    clearActualBtn: {
      width: 34,
      height: 36,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
    },

    varRow: {},
    varMetaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 5 },
    varMeta: { fontSize: 10.5, color: theme.colors.textTertiary },

    simpleList: { gap: 8 },
    simpleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: 12,
    },
    simpleName: { fontSize: 14, fontWeight: "600", color: theme.colors.text },
    simpleMeta: { fontSize: 11, color: theme.colors.textTertiary, marginTop: 2 },
    simpleAmount: { fontSize: 14, fontWeight: "700", color: theme.colors.text },
    addCostLink: { fontSize: 12.5, fontWeight: "700", color: theme.colors.primary },
    moreHint: { fontSize: 11, color: theme.colors.textTertiary, marginTop: 2 },

    historyList: { gap: 12 },
    historyRow: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: 14,
      gap: 12,
    },
    historyMonth: { fontSize: 14, fontWeight: "700", color: theme.colors.text },
    historyAddr: { fontSize: 11.5, color: theme.colors.textTertiary, marginTop: 2 },
    historyStats: { flexDirection: "row", gap: 10 },
    historyStat: { flex: 1 },
    historyStatLabel: { fontSize: 10.5, color: theme.colors.textTertiary },
    historyStatValue: { fontSize: 13.5, fontWeight: "700", color: theme.colors.text, marginTop: 3 },
    limitChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
    limitChip: {
      fontSize: 10,
      color: theme.colors.textTertiary,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.full,
      paddingHorizontal: 8,
      paddingVertical: 3,
      overflow: "hidden",
    },
    historyNotes: { fontSize: 11.5, color: theme.colors.textTertiary, fontStyle: "italic", lineHeight: 16 },
  });
