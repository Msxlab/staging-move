import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  MapPin,
  Zap,
  DollarSign,
  Truck,
  ArrowRight,
  Bell,
  AlertTriangle,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge as UiBadge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import type { DashboardStats } from "@locateflow/shared";
import {
  generateChecklist,
  RELOCATION_PHASES,
  type UserChecklistProfile,
  type RelocationChecklist,
  type ChecklistStateRuleContext,
} from "@locateflow/shared";

export default function DashboardScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checklist, setChecklist] = useState<RelocationChecklist | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    const [res, addrRes, movingRes] = await Promise.all([
      api.get<any>("/api/profile"),
      api.get<any>("/api/addresses"),
      api.get<any>("/api/moving"),
    ]);
    if (res.error || addrRes.error || movingRes.error) {
      setError(t("dashboard.loadFailed"));
      return false;
    }
    if (res.data) {
      setError(null);
      const profileData = res.data.profile || res.data;
      const sub = res.data.subscription || {};
      const hasPremium = sub.plan && sub.plan !== "FREE_TRIAL" && (sub.status === "ACTIVE" || (sub.premiumUntil && new Date(sub.premiumUntil) > new Date()));
      setIsPremium(!!hasPremium);

      const addresses = addrRes.data?.addresses || [];
      const plans = movingRes.data?.plans || [];
      const totalServices = addresses.reduce(
        (sum: number, a: any) => sum + (a.services?.length || 0),
        0
      );
      const monthlyExpenses = addresses.reduce(
        (sum: number, a: any) =>
          sum +
          (a.services?.reduce(
            (s: number, sv: any) => s + (sv.monthlyCost || 0),
            0
          ) || 0),
        0
      );
      const activePlan = plans.find(
        (p: any) => p.status === "PLANNING" || p.status === "IN_PROGRESS"
      );

      setStats({
        addressCount: addresses.length,
        serviceCount: totalServices,
        monthlyExpenses,
        activePlan: activePlan
          ? {
              id: activePlan.id,
              fromCity: activePlan.fromAddress?.city || "—",
              toCity: activePlan.toAddress?.city || "—",
              moveDate: activePlan.moveDate,
              status: activePlan.status,
            }
          : null,
      });

      // Generate relocation checklist for active plan
      if (activePlan) {
        try {
          const svcRes = await api.get<any>("/api/services");
          const svcs = svcRes.data?.services || [];
          const checklistProfile: UserChecklistProfile = {
            hasChildren: profileData.hasChildren ?? false,
            childrenCount: profileData.childrenCount ?? 0,
            hasPets: profileData.hasPets ?? false,
            hasSenior: profileData.hasSenior ?? false,
            carCount: profileData.carCount ?? 0,
            hasDisability: profileData.hasDisability ?? false,
            needsStorage: profileData.needsStorage ?? false,
            hasMotorcycle: profileData.hasMotorcycle ?? false,
            hasBoatRV: profileData.hasBoatRV ?? false,
            isImmigrant: profileData.isImmigrant ?? false,
            isBusinessOwner: profileData.isBusinessOwner ?? false,
            moveType: profileData.moveType || "PERSONAL",
          };
          const toState = activePlan.toAddress?.state || "";
          let stateRule: ChecklistStateRuleContext | null = null;
          if (toState) {
            try {
              const stateRuleRes = await api.get<any>("/api/state-rules", { state: toState });
              stateRule = stateRuleRes.data?.stateRule || null;
            } catch {
              stateRule = null;
            }
          }
          const cl = generateChecklist(
            checklistProfile,
            new Date(activePlan.moveDate),
            activePlan.fromAddress?.state || "",
            toState,
            new Set<string>(),
            stateRule,
          );
          setChecklist(cl);
        } catch { /* non-blocking */ }
      }
    }
    return true;
  }, [t]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await fetchDashboard();
    } finally {
      setLoading(false);
    }
  }, [fetchDashboard]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchDashboard();
    } finally {
      setRefreshing(false);
    }
  }, [fetchDashboard]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingScreen />;

  const statCards: Array<{
    icon: typeof MapPin;
    label: string;
    value: string;
    color: { bg: string; border: string; text: string };
    route: Href;
  }> = [
    {
      icon: MapPin,
      label: t("dashboard.stat_addresses"),
      value: String(stats?.addressCount || 0),
      color: theme.colors.orange,
      route: "/(tabs)/addresses",
    },
    {
      icon: Zap,
      label: t("dashboard.stat_services"),
      value: String(stats?.serviceCount || 0),
      color: theme.colors.cyan,
      route: "/(tabs)/services",
    },
    {
      icon: DollarSign,
      label: t("dashboard.stat_monthly"),
      value: new Intl.NumberFormat(i18n.language || "en", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(stats?.monthlyExpenses || 0),
      color: theme.colors.emerald,
      route: "/(tabs)/services",
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{t("dashboard.welcome")}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={styles.title}>{t("tabs.dashboard")}</Text>
            {isPremium && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: "rgba(242, 196, 108,0.12)", borderWidth: 1, borderColor: "rgba(242, 196, 108,0.3)" }}>
                <Text style={{ fontSize: 10, color: "#B49BFF" }}>{"✦"}</Text>
                <Text style={{ fontSize: 10, fontWeight: "700", color: "#B49BFF", letterSpacing: 0.3 }}>{t("dashboard.premiumBadge")}</Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity style={styles.notifButton} onPress={() => router.push("/notifications")}>
          <Bell size={22} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      >
        {error ? (
          <ErrorState title={t("dashboard.loadFailed")} message={error} onRetry={load} />
        ) : null}

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <TouchableOpacity
                key={card.label}
                style={[
                  styles.statCard,
                  {
                    backgroundColor: card.color.bg,
                    borderColor: card.color.border,
                  },
                ]}
                onPress={() => router.push(card.route)}
                activeOpacity={0.7}
              >
                <Icon size={20} color={card.color.text} />
                <Text style={[styles.statValue, { color: card.color.text }]}>
                  {card.value}
                </Text>
                <Text style={styles.statLabel}>{card.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Active Moving Plan */}
        {stats?.activePlan && (
          <Card
            variant="glow"
            onPress={() => router.push("/(tabs)/moving")}
            style={{ marginTop: 20 }}
          >
            <View style={styles.planHeader}>
              <View style={styles.planIcon}>
                <Truck size={18} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.planTitle}>
                  {stats.activePlan.fromCity} → {stats.activePlan.toCity}
                </Text>
                <Text style={styles.planDate}>
                  {new Date(stats.activePlan.moveDate).toLocaleDateString(
                    i18n.language || "en",
                    { month: "short", day: "numeric", year: "numeric" }
                  )}
                </Text>
              </View>
              <UiBadge
                label={stats.activePlan.status}
                variant={
                  stats.activePlan.status === "IN_PROGRESS"
                    ? "primary"
                    : "neutral"
                }
              />
            </View>
          </Card>
        )}

        {/* Relocation Checklist Progress */}
        {checklist && (() => {
          const phaseInfo = RELOCATION_PHASES.find((p) => p.phase === checklist.currentPhase);
          return (
            <Card variant="default" style={{ marginTop: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <CategoryIcon emoji={phaseInfo?.icon || ""} size={18} color={theme.colors.primary} />
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: theme.colors.text }}>{t("moving.checklist")}</Text>
                    <Text style={{ fontSize: 11, color: theme.colors.textTertiary }}>
                      {checklist.currentPhase + 1}: {phaseInfo?.label || ""}
                    </Text>
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: theme.colors.text }}>{checklist.progressPercent}%</Text>
                  <Text style={{ fontSize: 10, color: theme.colors.textMuted }}>{checklist.completedItems}/{checklist.totalItems}</Text>
                </View>
              </View>

              <View style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.05)", marginTop: 12, overflow: "hidden" }}>
                <View style={{ height: "100%", borderRadius: 3, backgroundColor: theme.colors.primary, width: `${checklist.progressPercent}%` }} />
              </View>

              {checklist.overdueItems.length > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: theme.colors.errorFaded, borderWidth: 1, borderColor: "rgba(240, 140, 142, 0.30)" }}>
                  <AlertTriangle size={14} color={theme.colors.error} />
                  <Text style={{ fontSize: 11, color: theme.colors.error, flex: 1 }} numberOfLines={2}>
                    {t("moving.overdueSummary", {
                      count: checklist.overdueItems.length,
                      title: `${checklist.overdueItems.slice(0, 2).map((i) => i.title).join(", ")}${
                        checklist.overdueItems.length > 2 ? ` +${checklist.overdueItems.length - 2}` : ""
                      }`,
                    })}
                  </Text>
                </View>
              )}

              {checklist.nextAction && !checklist.nextAction.isCompleted && (
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.03)", borderWidth: 1, borderColor: theme.colors.border }}
                  onPress={() => router.push("/(tabs)/services" as any)}
                  activeOpacity={0.7}
                >
                  <CategoryIcon emoji={checklist.nextAction.icon} size={16} color={theme.colors.textSecondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: theme.colors.text }} numberOfLines={1}>{checklist.nextAction.title}</Text>
                    {checklist.nextAction.stateNote ? (
                      <Text style={{ fontSize: 10, color: "#B49BFF" }} numberOfLines={2}>{checklist.nextAction.stateNote}</Text>
                    ) : null}
                    {checklist.nextAction.estimatedMinutes ? (
                      <Text style={{ fontSize: 10, color: theme.colors.textMuted }}>~{checklist.nextAction.estimatedMinutes} min</Text>
                    ) : null}
                  </View>
                  <ArrowRight size={14} color={theme.colors.primary} />
                </TouchableOpacity>
              )}
            </Card>
          );
        })()}

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>{t("dashboard.quickActions")}</Text>
        <View style={styles.quickActions}>
          {([
            { label: t("addresses.newTitle"), icon: MapPin, route: "/addresses/new" as Href },
            { label: t("services.newTitle"), icon: Zap, route: "/services/new" as Href },
            { label: t("moving.newPlan"), icon: Truck, route: "/moving/new" as Href },
          ]).map((action) => {
            const Icon = action.icon;
            return (
              <TouchableOpacity
                key={action.label}
                style={styles.quickAction}
                onPress={() => router.push(action.route)}
                activeOpacity={0.7}
              >
                <View style={styles.quickActionIcon}>
                  <Icon size={18} color={theme.colors.primary} />
                </View>
                <Text style={styles.quickActionLabel}>{action.label}</Text>
                <ArrowRight size={14} color={theme.colors.textMuted} />
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  greeting: { fontSize: 14, color: theme.colors.textTertiary },
  title: { fontSize: 28, fontWeight: "800", color: theme.colors.text, letterSpacing: -0.5 },
  notifButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 32 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: {
    width: "47%",
    flexGrow: 1,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  statValue: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  statLabel: { fontSize: 12, color: theme.colors.textTertiary, fontWeight: "500" },
  planHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  planIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryFaded,
    alignItems: "center",
    justifyContent: "center",
  },
  planTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.text },
  planDate: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 2 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.text,
    marginTop: 28,
    marginBottom: 12,
  },
  quickActions: { gap: 8 },
  quickAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
  },
  quickActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.primaryFaded,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: theme.colors.text },
});
