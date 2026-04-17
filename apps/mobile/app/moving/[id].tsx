import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Truck,
  MapPin,
  Calendar,
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock,
  Trash2,
  ArrowRightLeft,
  Repeat,
  PlusCircle,
  XCircle,
  Shield,
} from "lucide-react-native";
import { theme } from "@/lib/theme";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge as UiBadge } from "@/components/ui/Badge";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { hapticSuccess, hapticError, hapticWarning } from "@/lib/haptics";

const statusVariant: Record<string, "primary" | "success" | "warning" | "error" | "neutral"> = {
  PLANNING: "neutral",
  IN_PROGRESS: "primary",
  COMPLETED: "success",
  CANCELLED: "error",
};

const taskStatusIcon: Record<string, any> = {
  COMPLETED: CheckCircle2,
  IN_PROGRESS: Clock,
  PENDING: Circle,
};

function getTaskDisplayStatus(task: any) {
  return task.completed ? "COMPLETED" : "PENDING";
}

export default function MovingDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [migration, setMigration] = useState<any>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const fetchMigration = useCallback(async (planId: string) => {
    const mRes = await api.get<any>("/api/moving/migration", { planId });
    if (mRes.data?.analysis) setMigration(mRes.data.analysis);
  }, []);

  const fetch_ = useCallback(async () => {
    const res = await api.get<any>(`/api/moving/${id}`);
    if (res.data) {
      const p = res.data.plan || res.data;
      setPlan(p);
      if (p && (p.status === "PLANNING" || p.status === "IN_PROGRESS")) {
        await fetchMigration(p.id);
      }
    }
  }, [id, fetchMigration]);

  const confirmAction = async (
    serviceId: string,
    action: "KEEP" | "TRANSFER" | "SWITCH" | "CANCEL",
  ) => {
    setConfirming(serviceId);
    try {
      const res = await api.patch(`/api/services/${serviceId}`, { migrationAction: action });
      if (!res.error) {
        hapticSuccess();
        if (plan) await fetchMigration(plan.id);
      } else {
        hapticError();
        Alert.alert("Error", "Failed to save choice.");
      }
    } catch {
      hapticError();
      Alert.alert("Error", "Failed to save choice.");
    } finally {
      setConfirming(null);
    }
  };

  const goToNewService = (params: {
    fromServiceId?: string;
    providerId?: string;
    category?: string;
  }) => {
    const clean: Record<string, string> = {};
    if (params.fromServiceId) clean.fromServiceId = params.fromServiceId;
    if (params.providerId) clean.providerId = params.providerId;
    if (params.category) clean.category = params.category;
    router.push({ pathname: "/services/new", params: clean });
  };

  const load = useCallback(async () => {
    setLoading(true);
    await fetch_();
    setLoading(false);
  }, [fetch_]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetch_();
    setRefreshing(false);
  }, [fetch_]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = () => {
    hapticWarning();
    Alert.alert("Delete Plan", "Are you sure? This will delete the plan and all its tasks.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const res = await api.delete(`/api/moving/${id}`);
          if (!res.error) {
            hapticSuccess();
            router.back();
          } else {
            hapticError();
            Alert.alert("Error", "Failed to delete plan.");
          }
        },
      },
    ]);
  };

  const toggleTask = async (taskId: string, isCompleted: boolean) => {
    const res = await api.patch(`/api/tasks/${taskId}`, { completed: !isCompleted });
    if (!res.error) {
      hapticSuccess();
      await fetch_();
    } else {
      hapticError();
      Alert.alert("Error", res.error || "Failed to update task.");
    }
  };

  if (loading) return <LoadingScreen />;
  if (!plan) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Not Found</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: theme.colors.textTertiary }}>Plan not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const tasks = plan.tasks || [];
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t: any) => t.completed === true).length;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  const daysUntil = Math.ceil((new Date(plan.moveDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const isInterstateMove = plan.fromAddress?.state !== plan.toAddress?.state;
  const moveScopeLabel = isInterstateMove ? "Interstate Move" : "Intrastate Move";
  const scopeDetail = isInterstateMove
    ? "Expect DMV, voter registration, tax, and provider switching tasks across states."
    : "Expect utility transfers, local updates, and scheduling tasks within the same state.";
  const upcomingTasks = tasks.filter((task: any) => {
    if (task.completed || !task.dueDate) return false;
    return new Date(task.dueDate).getTime() <= Date.now() + (14 * 24 * 60 * 60 * 1000);
  }).length;
  const migrationSummaryLabel = migration
    ? `${migration.summary.switches} switch · ${migration.summary.newNeeded} new · ${migration.summary.keeps} keep`
    : "Migration guidance appears automatically after your origin services are analyzed.";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Moving Plan</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
      >
        {/* Hero Card */}
        <Card variant="glow">
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <Truck size={24} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>
                {plan.fromAddress?.city || "Origin"} → {plan.toAddress?.city || "Destination"}
              </Text>
              <View style={styles.heroMeta}>
                <Calendar size={12} color={theme.colors.textMuted} />
                <Text style={styles.heroDate}>
                  {new Date(plan.moveDate).toLocaleDateString("en-US", {
                    month: "long", day: "numeric", year: "numeric",
                  })}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.heroBadges}>
            <UiBadge label={plan.status.replace("_", " ")} variant={statusVariant[plan.status] || "neutral"} />
            {daysUntil > 0 && <UiBadge label={`${daysUntil} days left`} variant="warning" />}
            {plan.isTemporary && <UiBadge label="Temporary" variant="info" />}
            <UiBadge label={moveScopeLabel} variant={isInterstateMove ? "warning" : "success"} />
          </View>
        </Card>

        {/* Addresses */}
        <View style={styles.addressCards}>
          <Card variant="default" style={{ flex: 1 }}>
            <MapPin size={16} color={theme.colors.orange.text} />
            <Text style={styles.addrLabel}>From</Text>
            <Text style={styles.addrValue} numberOfLines={2}>
              {plan.fromAddress?.street || "—"}{"\n"}
              {plan.fromAddress?.city}, {plan.fromAddress?.state}
            </Text>
          </Card>
          <Card variant="default" style={{ flex: 1 }}>
            <MapPin size={16} color={theme.colors.emerald.text} />
            <Text style={styles.addrLabel}>To</Text>
            <Text style={styles.addrValue} numberOfLines={2}>
              {plan.toAddress?.street || "—"}{"\n"}
              {plan.toAddress?.city}, {plan.toAddress?.state}
            </Text>
          </Card>
        </View>

        {/* Progress */}
        <Card variant="default" style={{ marginTop: 16 }}>
          <Text style={styles.progressTitle}>Progress</Text>
          <View style={styles.progressRow}>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressText}>{completedTasks}/{totalTasks}</Text>
          </View>
        </Card>

        {/* Move Scope */}
        <Text style={styles.sectionTitle}>Move Scope</Text>
        <Card variant="default">
          <View style={styles.scopeHeader}>
            <View>
              <Text style={styles.scopeTitle}>{moveScopeLabel}</Text>
              <Text style={styles.scopeSubtitle}>{plan.fromAddress?.state} → {plan.toAddress?.state}</Text>
            </View>
            <UiBadge label={`${upcomingTasks} due soon`} variant={upcomingTasks > 0 ? "warning" : "neutral"} />
          </View>
          <Text style={styles.scopeBody}>{scopeDetail}</Text>
          <View style={styles.scopeGrid}>
            <View style={styles.scopeCard}>
              <Text style={styles.scopeCardLabel}>Route</Text>
              <Text style={styles.scopeCardValue}>{plan.fromAddress?.city}, {plan.fromAddress?.state} → {plan.toAddress?.city}, {plan.toAddress?.state}</Text>
            </View>
            <View style={styles.scopeCard}>
              <Text style={styles.scopeCardLabel}>Migration</Text>
              <Text style={styles.scopeCardValue}>{migrationSummaryLabel}</Text>
            </View>
          </View>
        </Card>

        {/* Migration Panel */}
        {migration && migration.summary.total > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.sectionTitle}>Service Migration</Text>
            <Card variant="glow">
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <ArrowRightLeft size={16} color={theme.colors.primary} />
                <Text style={{ fontSize: 14, fontWeight: "700", color: theme.colors.text }}>
                  {plan?.fromAddress?.state} → {plan?.toAddress?.state}
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: theme.colors.textTertiary, marginBottom: 12 }}>
                {(migration.summary.transfers || 0)} transfer · {migration.summary.switches} switch · {migration.summary.newNeeded} new · {migration.summary.keeps} keep · {(migration.summary.cancels || 0)} cancel
              </Text>

              {(migration.transfers || []).length > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <View style={styles.migSectionHeader}>
                    <Repeat size={14} color={theme.colors.primary} />
                    <Text style={[styles.migSectionLabel, { color: theme.colors.primary }]}>Transfer ({migration.transfers.length})</Text>
                  </View>
                  {migration.transfers.map((item: any, i: number) => {
                    const sid = item.currentService?.id;
                    const confirmed = item.currentService?.migrationAction === "TRANSFER";
                    return (
                      <View key={`tr-${i}`} style={[styles.migRow, i > 0 && styles.migRowDivider]}>
                        <CategoryIcon emoji={item.icon} size={16} color={theme.colors.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.migRowText}>{item.currentService?.providerName}</Text>
                          <Text style={styles.migRowSub}>Same provider serves destination</Text>
                        </View>
                        {sid && (
                          <TouchableOpacity
                            style={[styles.migBtn, confirmed && styles.migBtnConfirmed]}
                            onPress={() => !confirmed && confirmAction(sid, "TRANSFER")}
                            disabled={confirmed || confirming === sid}
                          >
                            <Text style={[styles.migBtnText, confirmed && styles.migBtnTextConfirmed]}>{confirmed ? "Confirmed" : "Confirm"}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {migration.switches.length > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <View style={styles.migSectionHeader}>
                    <ArrowRightLeft size={14} color={theme.colors.amber.text} />
                    <Text style={[styles.migSectionLabel, { color: theme.colors.amber.text }]}>Switch ({migration.switches.length})</Text>
                  </View>
                  {migration.switches.map((item: any, i: number) => {
                    const sid = item.currentService?.id;
                    const confirmed = item.currentService?.migrationAction === "SWITCH";
                    return (
                      <View key={`sw-${i}`} style={[styles.migRow, i > 0 && styles.migRowDivider]}>
                        <CategoryIcon emoji={item.icon} size={16} color={theme.colors.amber.text} />
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                            <Text style={{ fontSize: 13, color: theme.colors.textMuted, textDecorationLine: "line-through" }}>{item.currentService?.providerName}</Text>
                            <ArrowRight size={12} color={theme.colors.amber.text} />
                            <Text style={{ fontSize: 13, fontWeight: "600", color: theme.colors.amber.text }}>{item.recommendedProvider?.name || "Find new"}</Text>
                          </View>
                        </View>
                        <View style={{ flexDirection: "row", gap: 6 }}>
                          {sid && (
                            <TouchableOpacity
                              style={styles.migBtnPrimary}
                              onPress={() => goToNewService({
                                fromServiceId: sid,
                                category: item.category,
                                providerId: item.recommendedProvider?.id,
                              })}
                            >
                              <Text style={styles.migBtnPrimaryText}>Select</Text>
                            </TouchableOpacity>
                          )}
                          {sid && (
                            <TouchableOpacity
                              style={[styles.migBtn, confirmed && styles.migBtnConfirmed]}
                              onPress={() => !confirmed && confirmAction(sid, "SWITCH")}
                              disabled={confirmed || confirming === sid}
                            >
                              <Text style={[styles.migBtnText, confirmed && styles.migBtnTextConfirmed]}>{confirmed ? "Confirmed" : "Confirm"}</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {migration.newNeeded.length > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <View style={styles.migSectionHeader}>
                    <PlusCircle size={14} color={theme.colors.primary} />
                    <Text style={[styles.migSectionLabel, { color: theme.colors.primary }]}>New Needed ({migration.newNeeded.length})</Text>
                  </View>
                  {migration.newNeeded.map((item: any, i: number) => (
                    <View key={`new-${i}`} style={[styles.migRow, i > 0 && styles.migRowDivider]}>
                      <CategoryIcon emoji={item.icon} size={16} color={theme.colors.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.migRowText}>{item.categoryLabel}</Text>
                        {item.recommendedProvider && (
                          <Text style={styles.migRowSub}>{item.recommendedProvider.name}</Text>
                        )}
                      </View>
                      <TouchableOpacity
                        style={styles.migBtnPrimary}
                        onPress={() => goToNewService({
                          category: item.category,
                          providerId: item.recommendedProvider?.id,
                        })}
                      >
                        <Text style={styles.migBtnPrimaryText}>Add</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {migration.keeps.length > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <View style={styles.migSectionHeader}>
                    <Shield size={14} color={theme.colors.emerald.text} />
                    <Text style={[styles.migSectionLabel, { color: theme.colors.emerald.text }]}>Keep ({migration.keeps.length})</Text>
                  </View>
                  {migration.keeps.map((item: any, i: number) => {
                    const sid = item.currentService?.id;
                    const confirmed = item.currentService?.migrationAction === "KEEP";
                    return (
                      <View key={`keep-${i}`} style={[styles.migRow, i > 0 && styles.migRowDivider]}>
                        <CategoryIcon emoji={item.icon} size={16} color={theme.colors.emerald.text} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.migRowText}>{item.currentService?.providerName}</Text>
                        </View>
                        {sid && (
                          <TouchableOpacity
                            style={[styles.migBtn, confirmed && styles.migBtnConfirmed]}
                            onPress={() => !confirmed && confirmAction(sid, "KEEP")}
                            disabled={confirmed || confirming === sid}
                          >
                            <Text style={[styles.migBtnText, confirmed && styles.migBtnTextConfirmed]}>{confirmed ? "Confirmed" : "Confirm"}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {(migration.cancels || []).length > 0 && (
                <View>
                  <View style={styles.migSectionHeader}>
                    <XCircle size={14} color={theme.colors.error} />
                    <Text style={[styles.migSectionLabel, { color: theme.colors.error }]}>Cancel ({migration.cancels.length})</Text>
                  </View>
                  {migration.cancels.map((item: any, i: number) => {
                    const sid = item.currentService?.id;
                    const confirmed = item.currentService?.migrationAction === "CANCEL";
                    return (
                      <View key={`ca-${i}`} style={[styles.migRow, i > 0 && styles.migRowDivider]}>
                        <CategoryIcon emoji={item.icon} size={16} color={theme.colors.error} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.migRowText}>{item.currentService?.providerName}</Text>
                          <Text style={styles.migRowSub}>No longer needed at destination</Text>
                        </View>
                        {sid && (
                          <TouchableOpacity
                            style={[styles.migBtn, confirmed && styles.migBtnConfirmed]}
                            onPress={() => !confirmed && confirmAction(sid, "CANCEL")}
                            disabled={confirmed || confirming === sid}
                          >
                            <Text style={[styles.migBtnText, confirmed && styles.migBtnTextConfirmed]}>{confirmed ? "Confirmed" : "Confirm"}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </Card>
          </View>
        )}

        {/* Tasks */}
        <Text style={styles.sectionTitle}>Tasks ({totalTasks})</Text>
        {tasks.length === 0 ? (
          <Card variant="default">
            <Text style={{ color: theme.colors.textTertiary, textAlign: "center", paddingVertical: 16 }}>
              No tasks yet. Tasks will appear here once added.
            </Text>
          </Card>
        ) : (
          <View style={{ gap: 8 }}>
            {tasks.map((task: any) => {
              const taskStatus = getTaskDisplayStatus(task);
              const StatusIcon = taskStatusIcon[taskStatus] || Circle;
              const isDone = task.completed === true;
              const tid = task.templateId || "";
              const migType = tid.startsWith("MIG_KEEP_") ? { label: "Keep", color: "#10b981", bg: "rgba(16,185,129,0.12)" }
                : tid.startsWith("MIG_TRANSFER_") ? { label: "Transfer", color: "#06b6d4", bg: "rgba(6,182,212,0.12)" }
                : tid.startsWith("MIG_SWITCH_") ? { label: "Switch", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" }
                : tid.startsWith("MIG_CANCEL_") ? { label: "Cancel", color: "#ef4444", bg: "rgba(239,68,68,0.12)" }
                : null;
              return (
                <TouchableOpacity
                  key={task.id}
                  style={styles.taskRow}
                  onPress={() => toggleTask(task.id, isDone)}
                  activeOpacity={0.6}
                >
                  <StatusIcon
                    size={20}
                    color={isDone ? theme.colors.emerald.text : theme.colors.textMuted}
                    fill={isDone ? theme.colors.emerald.text : "transparent"}
                  />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <Text style={[styles.taskTitle, isDone && styles.taskDone, { flexShrink: 1 }]} numberOfLines={2}>
                        {task.title}
                      </Text>
                      {migType && (
                        <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: migType.bg }}>
                          <Text style={{ fontSize: 9, fontWeight: "700", color: migType.color, letterSpacing: 0.3 }}>{migType.label}</Text>
                        </View>
                      )}
                    </View>
                    {task.dueDate && (
                      <Text style={styles.taskDue}>
                        Due: {new Date(task.dueDate).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                  <UiBadge
                    label={task.priority || "MEDIUM"}
                    variant={task.priority === "HIGH" || task.priority === "URGENT" ? "error" : "neutral"}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Delete */}
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Trash2 size={16} color={theme.colors.error} />
          <Text style={styles.deleteText}>Delete Plan</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 12,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 20, fontWeight: "700", color: theme.colors.text },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  heroIcon: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: theme.colors.primaryFaded, alignItems: "center", justifyContent: "center",
  },
  heroTitle: { fontSize: 18, fontWeight: "800", color: theme.colors.text },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  heroDate: { fontSize: 13, color: theme.colors.textTertiary },
  heroBadges: { flexDirection: "row", gap: 6, marginTop: 14, flexWrap: "wrap" },
  addressCards: { flexDirection: "row", gap: 12, marginTop: 16 },
  addrLabel: { fontSize: 11, color: theme.colors.textTertiary, marginTop: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  addrValue: { fontSize: 13, fontWeight: "600", color: theme.colors.text, marginTop: 4 },
  progressTitle: { fontSize: 14, fontWeight: "600", color: theme.colors.textSecondary, marginBottom: 10 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  progressBg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.05)" },
  progressFill: { height: "100%", borderRadius: 4, backgroundColor: theme.colors.primary },
  progressText: { fontSize: 13, fontWeight: "600", color: theme.colors.textTertiary },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: theme.colors.text, marginTop: 24, marginBottom: 12 },
  scopeHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  scopeTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.text },
  scopeSubtitle: { fontSize: 12, color: theme.colors.textMuted, marginTop: 4 },
  scopeBody: { fontSize: 13, color: theme.colors.textTertiary, marginTop: 12, lineHeight: 20 },
  scopeGrid: { gap: 10, marginTop: 14 },
  scopeCard: {
    padding: 12,
    borderRadius: theme.radius.lg,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  scopeCardLabel: { fontSize: 10, fontWeight: "700", color: theme.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  scopeCardValue: { fontSize: 13, color: theme.colors.text, lineHeight: 19 },
  taskRow: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16,
    backgroundColor: theme.colors.card, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  taskTitle: { fontSize: 14, fontWeight: "600", color: theme.colors.text },
  taskDone: { textDecorationLine: "line-through", color: theme.colors.textMuted },
  taskDue: { fontSize: 11, color: theme.colors.textTertiary, marginTop: 2 },
  deleteBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 32, paddingVertical: 14, borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.errorFaded, borderWidth: 1, borderColor: "rgba(239,68,68,0.2)",
  },
  deleteText: { fontSize: 14, fontWeight: "600", color: theme.colors.error },
  migSectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  migSectionLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  migRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  migRowDivider: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  migRowText: { fontSize: 13, color: theme.colors.text, fontWeight: "500" },
  migRowSub: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  migBtn: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border,
  },
  migBtnText: { fontSize: 11, fontWeight: "700", color: theme.colors.textSecondary },
  migBtnConfirmed: {
    backgroundColor: "rgba(16,185,129,0.15)", borderColor: "rgba(16,185,129,0.4)",
  },
  migBtnTextConfirmed: { color: theme.colors.emerald.text },
  migBtnPrimary: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: theme.colors.primary,
  },
  migBtnPrimaryText: { fontSize: 11, fontWeight: "700", color: "#fff" },
});
