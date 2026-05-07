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
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Truck,
  MapPin,
  Calendar,
  ArrowRight,
  Trash2,
  ArrowRightLeft,
  Repeat,
  PlusCircle,
  XCircle,
  Shield,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from "lucide-react-native";
import { theme } from "@/lib/theme";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge as UiBadge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { hapticSuccess, hapticError, hapticWarning } from "@/lib/haptics";
import { normalizeMovingPlanStatus } from "@locateflow/shared";

const statusVariant: Record<string, "primary" | "success" | "warning" | "error" | "neutral"> = {
  PLANNING: "neutral",
  IN_PROGRESS: "primary",
  COMPLETED: "success",
  CANCELED: "error",
  CANCELLED: "error",
};

export default function MovingDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [migration, setMigration] = useState<any>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [stateRules, setStateRules] = useState<any>(null);
  const [stateGuideOpen, setStateGuideOpen] = useState(false);
  const [moveTasks, setMoveTasks] = useState<any[]>([]);
  const [taskBusy, setTaskBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchMigration = useCallback(async (planId: string) => {
    const mRes = await api.get<any>("/api/moving/migration", { planId });
    if (mRes.data?.analysis) setMigration(mRes.data.analysis);
  }, []);

  const fetchMoveTasks = useCallback(async (planId: string) => {
    const taskRes = await api.get<any>("/api/move-tasks", { movingPlanId: planId });
    if (taskRes.data?.tasks) setMoveTasks(taskRes.data.tasks);
  }, []);

  const fetch_ = useCallback(async () => {
    const res = await api.get<any>(`/api/moving/${id}`);
    if (res.error) {
      setError(res.error);
      return false;
    }
    if (res.data) {
      const p = res.data.plan || res.data;
      const normalizedPlan = p ? { ...p, status: normalizeMovingPlanStatus(p.status) } : p;
      setPlan(normalizedPlan);
      if (normalizedPlan && (normalizedPlan.status === "PLANNING" || normalizedPlan.status === "IN_PROGRESS")) {
        await fetchMigration(normalizedPlan.id);
        await fetchMoveTasks(normalizedPlan.id);
      }
      if (normalizedPlan?.toAddress?.state) {
        const srRes = await api.get<any>("/api/state-rules", { state: normalizedPlan.toAddress.state });
        if (srRes.data?.rules?.length) setStateRules(srRes.data.rules[0]);
      }
      setError(null);
    }
    return true;
  }, [id, fetchMigration, fetchMoveTasks]);

  const generateMoveTasks = async () => {
    if (!plan) return;
    setTaskBusy("generate");
    const res = await api.post<any>("/api/move-tasks", { movingPlanId: plan.id });
    setTaskBusy(null);
    if (res.error) {
      hapticError();
      Alert.alert(t("moving.moveTasksAlert"), res.error);
      return;
    }
    hapticSuccess();
    setMoveTasks(res.data?.tasks || []);
  };

  const updateMoveTask = async (taskId: string, event: "ACCEPT" | "COMPLETE" | "DISMISS" | "REOPEN") => {
    setTaskBusy(taskId);
    const res = await api.patch<any>("/api/move-tasks", { id: taskId, event });
    setTaskBusy(null);
    if (res.error) {
      hapticError();
      Alert.alert(t("moving.moveTasksAlert"), res.error);
      return;
    }
    hapticSuccess();
    if (plan) await fetchMoveTasks(plan.id);
  };

  const confirmCompleteMoveTask = (taskId: string) => {
    Alert.alert(
      t("moving.completeTaskTitle"),
      t("moving.completeTaskBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("moving.completeLocally"), onPress: () => updateMoveTask(taskId, "COMPLETE") },
      ],
    );
  };

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
        Alert.alert(t("tickets.errorTitle"), t("moving.saveChoiceFailed"));
      }
    } catch {
      hapticError();
      Alert.alert(t("tickets.errorTitle"), t("moving.saveChoiceFailed"));
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
    try {
      await fetch_();
    } finally {
      setLoading(false);
    }
  }, [fetch_]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetch_();
    } finally {
      setRefreshing(false);
    }
  }, [fetch_]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = () => {
    hapticWarning();
    Alert.alert(t("moving.deleteTitle"), t("moving.deleteConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          const res = await api.delete(`/api/moving/${id}`);
          if (!res.error) {
            hapticSuccess();
            router.back();
          } else {
            hapticError();
            Alert.alert(t("tickets.errorTitle"), res.error);
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingScreen />;
  if (!plan) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t("common.notFound")}</Text>
          <View style={{ width: 44 }} />
        </View>
        <ErrorState
          title={error ? t("moving.unavailable") : t("moving.notFound")}
          message={error || t("moving.removed")}
          onRetry={load}
        />
      </SafeAreaView>
    );
  }

  const daysUntil = Math.ceil((new Date(plan.moveDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const isInterstateMove = plan.fromAddress?.state !== plan.toAddress?.state;
  const dateLocale = (i18n.language || "").toLowerCase().startsWith("es") ? "es-ES" : "en-US";
  const moveScopeLabel = isInterstateMove ? t("moving.interstateMove") : t("moving.intrastateMove");
  const scopeDetail = isInterstateMove
    ? t("moving.interstateDetail")
    : t("moving.intrastateDetail");
  const migrationSummaryLabel = migration
    ? t("moving.migrationSummary", { count: migration.transitionPlans?.length || migration.summary.total })
    : t("moving.migrationEmpty");

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("moving.detailTitle")}</Text>
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
                {plan.fromAddress?.city || t("moving.origin")} → {plan.toAddress?.city || t("moving.destination")}
              </Text>
              <View style={styles.heroMeta}>
                <Calendar size={12} color={theme.colors.textMuted} />
                <Text style={styles.heroDate}>
                  {new Date(plan.moveDate).toLocaleDateString(dateLocale, {
                    month: "long", day: "numeric", year: "numeric",
                  })}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.heroBadges}>
            <UiBadge label={t(`moving.status_${plan.status}`, { defaultValue: plan.status.replace("_", " ") })} variant={statusVariant[plan.status] || "neutral"} />
            {daysUntil > 0 && <UiBadge label={t("moving.daysLeft", { count: daysUntil })} variant="warning" />}
            {plan.isTemporary && <UiBadge label={t("moving.temporary")} variant="info" />}
            <UiBadge label={moveScopeLabel} variant={isInterstateMove ? "warning" : "success"} />
          </View>
        </Card>

        {/* Addresses */}
        <View style={styles.addressCards}>
          <Card variant="default" style={{ flex: 1 }}>
            <MapPin size={16} color={theme.colors.orange.text} />
            <Text style={styles.addrLabel}>{t("moving.from")}</Text>
            <Text style={styles.addrValue} numberOfLines={2}>
              {plan.fromAddress?.street || "—"}{"\n"}
              {plan.fromAddress?.city}, {plan.fromAddress?.state}
            </Text>
          </Card>
          <Card variant="default" style={{ flex: 1 }}>
            <MapPin size={16} color={theme.colors.emerald.text} />
            <Text style={styles.addrLabel}>{t("moving.to")}</Text>
            <Text style={styles.addrValue} numberOfLines={2}>
              {plan.toAddress?.street || "—"}{"\n"}
              {plan.toAddress?.city}, {plan.toAddress?.state}
            </Text>
          </Card>
        </View>

        {/* Move Scope */}
        <Text style={styles.sectionTitle}>{t("moving.moveScope")}</Text>
        <Card variant="default">
          <View style={styles.scopeHeader}>
            <View>
              <Text style={styles.scopeTitle}>{moveScopeLabel}</Text>
              <Text style={styles.scopeSubtitle}>{plan.fromAddress?.state} → {plan.toAddress?.state}</Text>
            </View>
          </View>
          <Text style={styles.scopeBody}>{scopeDetail}</Text>
          <View style={styles.scopeGrid}>
            <View style={styles.scopeCard}>
              <Text style={styles.scopeCardLabel}>{t("moving.route")}</Text>
              <Text style={styles.scopeCardValue}>{plan.fromAddress?.city}, {plan.fromAddress?.state} → {plan.toAddress?.city}, {plan.toAddress?.state}</Text>
            </View>
            <View style={styles.scopeCard}>
              <Text style={styles.scopeCardLabel}>{t("moving.migration")}</Text>
              <Text style={styles.scopeCardValue}>{migrationSummaryLabel}</Text>
            </View>
          </View>
        </Card>

        <Text style={styles.sectionTitle}>{t("moving.moveTasks")}</Text>
        <Card variant="default">
          <View style={styles.transitionHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.transitionTitle}>{t("moving.taskTracking")}</Text>
              <Text style={styles.transitionIntro}>
                {t("moving.taskTrackingHint")}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.migBtnPrimary}
              onPress={generateMoveTasks}
              disabled={taskBusy === "generate"}
            >
              <Text style={styles.migBtnPrimaryText}>{taskBusy === "generate" ? t("moving.syncing") : t("moving.generate")}</Text>
            </TouchableOpacity>
          </View>
          {moveTasks.length === 0 ? (
            <Text style={styles.emptyText}>{t("moving.noMoveTasks")}</Text>
          ) : (
            moveTasks.map((task, index) => {
              const done = task.status === "COMPLETED";
              const dismissed = task.status === "DISMISSED";
              return (
                <View key={task.id} style={[styles.taskRow, index > 0 && styles.migRowDivider]}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.taskBadges}>
                      <UiBadge label={t(`moving.taskStatus_${task.status}`, { defaultValue: task.status.replace(/_/g, " ") })} variant={done ? "success" : dismissed ? "neutral" : "warning"} />
                      <UiBadge label={t(`moving.confidence_${task.confidence}`, { defaultValue: `${task.confidence} confidence` })} variant="neutral" />
                    </View>
                    <Text style={styles.taskTitle}>{task.title}</Text>
                    {!!task.description && <Text style={styles.taskDescription}>{task.description}</Text>}
                    <Text style={styles.taskCaveat}>{t("providers.manualTrackingCaveat")}</Text>
                  </View>
                  <View style={styles.taskActions}>
                    {!done && !dismissed && task.status === "SUGGESTED" && (
                      <TouchableOpacity
                        style={styles.migBtn}
                        disabled={taskBusy === task.id}
                        onPress={() => updateMoveTask(task.id, "ACCEPT")}
                      >
                        <Text style={styles.migBtnText}>{t("moving.accept")}</Text>
                      </TouchableOpacity>
                    )}
                    {!done && !dismissed && (
                      <TouchableOpacity
                        style={styles.migBtnPrimary}
                        disabled={taskBusy === task.id}
                        onPress={() => confirmCompleteMoveTask(task.id)}
                      >
                        <Text style={styles.migBtnPrimaryText}>{t("moving.complete")}</Text>
                      </TouchableOpacity>
                    )}
                    {!done && !dismissed && (
                      <TouchableOpacity
                        style={styles.migBtn}
                        disabled={taskBusy === task.id}
                        onPress={() => updateMoveTask(task.id, "DISMISS")}
                      >
                        <Text style={styles.migBtnText}>{t("moving.dismiss")}</Text>
                      </TouchableOpacity>
                    )}
                    {(done || dismissed) && (
                      <TouchableOpacity
                        style={styles.migBtn}
                        disabled={taskBusy === task.id}
                        onPress={() => updateMoveTask(task.id, "REOPEN")}
                      >
                        <Text style={styles.migBtnText}>{t("moving.reopen")}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </Card>

        {/* Migration Panel */}
        {migration && migration.summary.total > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.sectionTitle}>{t("moving.serviceMigration")}</Text>
            <Card variant="glow">
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <ArrowRightLeft size={16} color={theme.colors.primary} />
                <Text style={{ fontSize: 14, fontWeight: "700", color: theme.colors.text }}>
                  {plan?.fromAddress?.state} → {plan?.toAddress?.state}
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: theme.colors.textTertiary, marginBottom: 12 }}>
                {t("moving.manualGuidanceItems", { count: migration.transitionPlans?.length || 0 })}
              </Text>

              {(migration.transitionPlans || []).length > 0 && (
                <View style={styles.transitionPanel}>
                  <View style={styles.transitionHeader}>
                    <Text style={styles.transitionTitle}>{t("moving.transitionPlan")}</Text>
                    <UiBadge label={t("providers.manualTrackingOnly")} variant="warning" />
                  </View>
                  <Text style={styles.transitionIntro}>
                    {t("moving.transitionIntro")}
                  </Text>
                  {migration.transitionPlans.map((planItem: any, i: number) => (
                    <View key={`tp-${planItem.serviceId || i}`} style={[styles.transitionItem, i > 0 && styles.migRowDivider]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.transitionAction}>
                          {planItem.actionLabel || String(planItem.actionType || "").replace(/_/g, " ")}
                        </Text>
                        <Text style={styles.transitionReason}>{planItem.primaryReason}</Text>
                        <Text style={styles.transitionStep}>{planItem.suggestedNextStep}</Text>
                        {planItem.destinationProviderCandidates?.length > 0 && (
                          <View style={styles.transitionCandidates}>
                            {planItem.destinationProviderCandidates.slice(0, 2).map((candidate: any) => (
                              <Text key={`${planItem.serviceId || i}-${candidate.id || candidate.name}`} style={styles.transitionCandidate}>
                                {candidate.name} · {candidate.coverageLabel}
                              </Text>
                            ))}
                          </View>
                        )}
                      </View>
                      <Text style={styles.transitionConfidence}>{planItem.confidence}</Text>
                    </View>
                  ))}
                </View>
              )}

              {(migration.transfers || []).length > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <View style={styles.migSectionHeader}>
                    <Repeat size={14} color={theme.colors.primary} />
                    <Text style={[styles.migSectionLabel, { color: theme.colors.primary }]}>{t("moving.transfer")} ({migration.transfers.length})</Text>
                  </View>
                  {migration.transfers.map((item: any, i: number) => {
                    const sid = item.currentService?.id;
                    const confirmed = item.currentService?.migrationAction === "TRANSFER";
                    return (
                      <View key={`tr-${i}`} style={[styles.migRow, i > 0 && styles.migRowDivider]}>
                        <CategoryIcon emoji={item.icon} size={16} color={theme.colors.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.migRowText}>{item.currentService?.providerName}</Text>
                          <Text style={styles.migRowSub}>{t("moving.sameProviderServesDestination")}</Text>
                        </View>
                        {sid && (
                          <TouchableOpacity
                            style={[styles.migBtn, confirmed && styles.migBtnConfirmed]}
                            onPress={() => !confirmed && confirmAction(sid, "TRANSFER")}
                            disabled={confirmed || confirming === sid}
                          >
                            <Text style={[styles.migBtnText, confirmed && styles.migBtnTextConfirmed]}>{confirmed ? t("moving.confirmed") : t("moving.confirm")}</Text>
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
                    <Text style={[styles.migSectionLabel, { color: theme.colors.amber.text }]}>{t("moving.switch")} ({migration.switches.length})</Text>
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
                            <Text style={{ fontSize: 13, fontWeight: "600", color: theme.colors.amber.text }}>{item.recommendedProvider?.name || t("moving.findNew")}</Text>
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
                              <Text style={styles.migBtnPrimaryText}>{t("moving.select")}</Text>
                            </TouchableOpacity>
                          )}
                          {sid && (
                            <TouchableOpacity
                              style={[styles.migBtn, confirmed && styles.migBtnConfirmed]}
                              onPress={() => !confirmed && confirmAction(sid, "SWITCH")}
                              disabled={confirmed || confirming === sid}
                            >
                              <Text style={[styles.migBtnText, confirmed && styles.migBtnTextConfirmed]}>{confirmed ? t("moving.confirmed") : t("moving.confirm")}</Text>
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
                    <Text style={[styles.migSectionLabel, { color: theme.colors.primary }]}>{t("moving.newNeeded")} ({migration.newNeeded.length})</Text>
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
                        <Text style={styles.migBtnPrimaryText}>{t("common.add")}</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {migration.keeps.length > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <View style={styles.migSectionHeader}>
                    <Shield size={14} color={theme.colors.emerald.text} />
                    <Text style={[styles.migSectionLabel, { color: theme.colors.emerald.text }]}>{t("moving.keep")} ({migration.keeps.length})</Text>
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
                            <Text style={[styles.migBtnText, confirmed && styles.migBtnTextConfirmed]}>{confirmed ? t("moving.confirmed") : t("moving.confirm")}</Text>
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
                    <Text style={[styles.migSectionLabel, { color: theme.colors.error }]}>{t("moving.cancel")} ({migration.cancels.length})</Text>
                  </View>
                  {migration.cancels.map((item: any, i: number) => {
                    const sid = item.currentService?.id;
                    const confirmed = item.currentService?.migrationAction === "CANCEL";
                    return (
                      <View key={`ca-${i}`} style={[styles.migRow, i > 0 && styles.migRowDivider]}>
                        <CategoryIcon emoji={item.icon} size={16} color={theme.colors.error} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.migRowText}>{item.currentService?.providerName}</Text>
                          <Text style={styles.migRowSub}>{t("moving.noLongerNeeded")}</Text>
                        </View>
                        {sid && (
                          <TouchableOpacity
                            style={[styles.migBtn, confirmed && styles.migBtnConfirmed]}
                            onPress={() => !confirmed && confirmAction(sid, "CANCEL")}
                            disabled={confirmed || confirming === sid}
                          >
                            <Text style={[styles.migBtnText, confirmed && styles.migBtnTextConfirmed]}>{confirmed ? t("moving.confirmed") : t("moving.confirm")}</Text>
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

        {/* State Guide */}
        {stateRules && (
          <View style={styles.stateGuideCard}>
            <TouchableOpacity
              style={styles.stateGuideHeader}
              activeOpacity={0.7}
              onPress={() => setStateGuideOpen(!stateGuideOpen)}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <BookOpen size={16} color={theme.colors.primary} />
                <Text style={styles.stateGuideTitle}>{t("moving.stateGuide", { state: plan.toAddress?.state })}</Text>
              </View>
              {stateGuideOpen
                ? <ChevronUp size={16} color={theme.colors.textMuted} />
                : <ChevronDown size={16} color={theme.colors.textMuted} />
              }
            </TouchableOpacity>
            {stateGuideOpen && (
              <View style={styles.stateGuideBody}>
                {stateRules.dmvRules && (
                  <View style={styles.stateGuideSection}>
                    <Text style={styles.stateGuideSectionLabel}>{t("moving.dmvVehicle")}</Text>
                    <Text style={styles.stateGuideSectionText}>{stateRules.dmvRules}</Text>
                  </View>
                )}
                {stateRules.voterRegistration && (
                  <View style={styles.stateGuideSection}>
                    <Text style={styles.stateGuideSectionLabel}>{t("moving.voterRegistration")}</Text>
                    <Text style={styles.stateGuideSectionText}>{stateRules.voterRegistration}</Text>
                  </View>
                )}
                {stateRules.taxInfo && (
                  <View style={styles.stateGuideSection}>
                    <Text style={styles.stateGuideSectionLabel}>{t("moving.stateTax")}</Text>
                    <Text style={styles.stateGuideSectionText}>{stateRules.taxInfo}</Text>
                  </View>
                )}
                {stateRules.utilityInfo && (
                  <View style={styles.stateGuideSection}>
                    <Text style={styles.stateGuideSectionLabel}>{t("moving.utilities")}</Text>
                    <Text style={styles.stateGuideSectionText}>{stateRules.utilityInfo}</Text>
                  </View>
                )}
                {stateRules.insuranceRules && (
                  <View style={styles.stateGuideSection}>
                    <Text style={styles.stateGuideSectionLabel}>{t("moving.insurance")}</Text>
                    <Text style={styles.stateGuideSectionText}>{stateRules.insuranceRules}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Delete */}
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Trash2 size={16} color={theme.colors.error} />
          <Text style={styles.deleteText}>{t("moving.deletePlan")}</Text>
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
  deleteBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 32, paddingVertical: 14, borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.errorFaded, borderWidth: 1, borderColor: "rgba(240, 140, 142, 0.20)",
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
  transitionPanel: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: theme.radius.lg,
    padding: 12,
    marginBottom: 14,
  },
  transitionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 6,
  },
  transitionTitle: { fontSize: 14, fontWeight: "700", color: theme.colors.text },
  transitionIntro: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    lineHeight: 18,
    marginBottom: 8,
  },
  transitionItem: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
  },
  transitionAction: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.text,
    textTransform: "capitalize",
  },
  transitionReason: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 3,
    lineHeight: 16,
  },
  transitionStep: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 5,
    lineHeight: 17,
  },
  transitionCandidates: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  transitionCandidate: {
    fontSize: 10,
    color: theme.colors.textMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  transitionConfidence: {
    fontSize: 10,
    fontWeight: "800",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    marginTop: 2,
  },
  emptyText: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    lineHeight: 18,
  },
  taskRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 12,
  },
  taskBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
  },
  taskTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.colors.text,
  },
  taskDescription: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    lineHeight: 17,
    marginTop: 4,
  },
  taskCaveat: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 6,
    lineHeight: 15,
  },
  taskActions: {
    alignItems: "flex-end",
    gap: 6,
    maxWidth: 92,
  },
  stateGuideCard: {
    marginTop: 16,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  stateGuideHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
  },
  stateGuideTitle: { fontSize: 14, fontWeight: "700", color: theme.colors.text },
  stateGuideBody: { paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: theme.colors.border },
  stateGuideSection: { marginTop: 12 },
  stateGuideSectionLabel: { fontSize: 10, fontWeight: "700", color: theme.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  stateGuideSectionText: { fontSize: 13, color: theme.colors.textTertiary, lineHeight: 20 },
});
