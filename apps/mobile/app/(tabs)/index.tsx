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
  MapPin,
  Zap,
  CheckSquare,
  DollarSign,
  Truck,
  Trophy,
  ArrowRight,
  Bell,
  TrendingUp,
  Star,
  AlertTriangle,
  Clock,
} from "lucide-react-native";
import { theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge as UiBadge } from "@/components/ui/Badge";
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
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checklist, setChecklist] = useState<RelocationChecklist | null>(null);
  const [isPremium, setIsPremium] = useState(false);

  const fetchDashboard = useCallback(async () => {
    const res = await api.get<any>("/api/profile");
    if (res.data) {
      const profileData = res.data.profile || res.data;
      const sub = res.data.subscription || {};
      const hasPremium = sub.plan && sub.plan !== "FREE_TRIAL" && (sub.status === "ACTIVE" || (sub.premiumUntil && new Date(sub.premiumUntil) > new Date()));
      setIsPremium(!!hasPremium);
      const addrRes = await api.get<any>("/api/addresses");
      const taskRes = await api.get<any>("/api/tasks");
      const movingRes = await api.get<any>("/api/moving");

      const addresses = addrRes.data?.addresses || [];
      const tasks = taskRes.data?.tasks || [];
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
      const pendingTasks = tasks.filter((t: any) => t.completed !== true).length;
      const activePlan = plans.find(
        (p: any) => p.status === "PLANNING" || p.status === "IN_PROGRESS"
      );

      setStats({
        addressCount: addresses.length,
        serviceCount: totalServices,
        pendingTasks,
        monthlyExpenses,
        currentStreak: profileData.currentStreak || 0,
        longestStreak: profileData.longestStreak || 0,
        totalPoints: profileData.totalPoints || 0,
        activePlan: activePlan
          ? {
              id: activePlan.id,
              fromCity: activePlan.fromAddress?.city || "—",
              toCity: activePlan.toAddress?.city || "—",
              moveDate: activePlan.moveDate,
              totalTasks: activePlan.tasks?.length || 0,
              completedTasks:
                activePlan.tasks?.filter(
                  (t: any) => t.completed === true
                ).length || 0,
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
          const completedCats = new Set<string>(svcs.map((s: any) => s.category as string));
          const completedTemplates = new Set<string>(
            (activePlan.tasks || []).filter((t: any) => t.completed && t.templateId).map((t: any) => t.templateId as string)
          );
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
            completedCats,
            completedTemplates,
            stateRule,
          );
          setChecklist(cl);
        } catch { /* non-blocking */ }
      }
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    await fetchDashboard();
    setLoading(false);
  }, [fetchDashboard]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDashboard();
    setRefreshing(false);
  }, [fetchDashboard]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingScreen />;

  const statCards = [
    {
      icon: MapPin,
      label: "Addresses",
      value: String(stats?.addressCount || 0),
      color: theme.colors.orange,
      route: "/(tabs)/addresses",
    },
    {
      icon: Zap,
      label: "Services",
      value: String(stats?.serviceCount || 0),
      color: theme.colors.cyan,
      route: "/(tabs)/services",
    },
    {
      icon: CheckSquare,
      label: "Tasks",
      value: String(stats?.pendingTasks || 0),
      color: theme.colors.amber,
      route: "/(tabs)/moving",
    },
    {
      icon: DollarSign,
      label: "Monthly",
      value: `$${(stats?.monthlyExpenses || 0).toLocaleString()}`,
      color: theme.colors.emerald,
      route: "/(tabs)/services",
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={styles.title}>Dashboard</Text>
            {isPremium && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: "rgba(245,158,11,0.12)", borderWidth: 1, borderColor: "rgba(245,158,11,0.3)" }}>
                <Text style={{ fontSize: 10, color: "#fbbf24" }}>{"\u2726"}</Text>
                <Text style={{ fontSize: 10, fontWeight: "700", color: "#fbbf24", letterSpacing: 0.3 }}>Premium</Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity style={styles.notifButton}>
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
                onPress={() => router.push(card.route as any)}
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
                    "en-US",
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
            {/* Progress bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBg}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${
                        stats.activePlan.totalTasks > 0
                          ? (stats.activePlan.completedTasks /
                              stats.activePlan.totalTasks) *
                            100
                          : 0
                      }%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {stats.activePlan.completedTasks}/{stats.activePlan.totalTasks}{" "}
                tasks
              </Text>
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
                    <Text style={{ fontSize: 13, fontWeight: "700", color: theme.colors.text }}>Relocation Checklist</Text>
                    <Text style={{ fontSize: 11, color: theme.colors.textTertiary }}>
                      Phase {checklist.currentPhase + 1}: {phaseInfo?.label || ""}
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
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: "rgba(239,68,68,0.08)", borderWidth: 1, borderColor: "rgba(239,68,68,0.2)" }}>
                  <AlertTriangle size={14} color="#ef4444" />
                  <Text style={{ fontSize: 11, color: "#f87171", flex: 1 }} numberOfLines={2}>
                    Overdue: {checklist.overdueItems.slice(0, 2).map((i) => i.title).join(", ")}
                    {checklist.overdueItems.length > 2 ? ` +${checklist.overdueItems.length - 2}` : ""}
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
                      <Text style={{ fontSize: 10, color: "#fbbf24" }} numberOfLines={2}>{checklist.nextAction.stateNote}</Text>
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

        {/* Streak & Points */}
        <View style={styles.streakRow}>
          <Card variant="default" style={{ flex: 1 }}>
            <View style={styles.streakContent}>
              <TrendingUp size={18} color={theme.colors.emerald.text} />
              <Text style={styles.streakValue}>
                {stats?.currentStreak || 0}
              </Text>
              <Text style={styles.streakLabel}>Day Streak</Text>
            </View>
          </Card>
          <Card variant="default" style={{ flex: 1 }}>
            <View style={styles.streakContent}>
              <Trophy size={18} color={theme.colors.amber.text} />
              <Text style={styles.streakValue}>
                {stats?.totalPoints || 0}
              </Text>
              <Text style={styles.streakLabel}>Points</Text>
            </View>
          </Card>
          <Card variant="default" style={{ flex: 1 }}>
            <View style={styles.streakContent}>
              <Star size={18} color={theme.colors.orange.text} />
              <Text style={styles.streakValue}>
                {stats?.longestStreak || 0}
              </Text>
              <Text style={styles.streakLabel}>Best Streak</Text>
            </View>
          </Card>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          {[
            { label: "Add Address", icon: MapPin, route: "/addresses/new" },
            { label: "New Service", icon: Zap, route: "/services/new" },
            { label: "Plan Move", icon: Truck, route: "/moving/new" },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <TouchableOpacity
                key={action.label}
                style={styles.quickAction}
                onPress={() => router.push(action.route as any)}
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

const styles = StyleSheet.create({
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
  progressContainer: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 },
  progressBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
  },
  progressText: { fontSize: 12, color: theme.colors.textTertiary, fontWeight: "500" },
  streakRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  streakContent: { alignItems: "center", gap: 6 },
  streakValue: { fontSize: 22, fontWeight: "800", color: theme.colors.text },
  streakLabel: { fontSize: 11, color: theme.colors.textTertiary },
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
