import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Linking,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView, Swipeable } from "react-native-gesture-handler";
import { LinearGradient } from "expo-linear-gradient";
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
  Check,
  UserPlus,
  AlertTriangle,
  ChevronRight,
  Mailbox,
  ExternalLink,
} from "lucide-react-native";
import { useAppTheme, fonts, type Theme } from "@/lib/theme";
import {
  MoveRaccoon,
  HeroCard,
  SectionHeader,
  MoveProgressBar,
  Pill,
} from "@/components/move";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Avatar } from "@/components/ui/Avatar";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { CollapsibleCard } from "@/components/ui/CollapsibleCard";
import { HomeDossierCard } from "@/components/ui/HomeDossierCard";
import { VehicleCheckCard } from "@/components/ui/VehicleCheckCard";
import { isVehicleRegistrationTask } from "@/components/ui/VehicleCheckCard.helpers";
import { StateRulesCard } from "@/components/provider/StateRulesCard";
import { TransitRouteMap } from "@/components/addresses/TransitRouteMap";
import { Badge as UiBadge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { hapticSuccess, hapticError, hapticWarning, hapticLight } from "@/lib/haptics";
import { asObject } from "@/lib/offline-cache";
import { detailCacheKey, useDetailOfflineCache } from "@/lib/use-detail-offline-cache";
import { formatDateOnlyUtc, getMoveCountdown, normalizeMovingPlanStatus, USPS_MOVERS_GUIDE_URL } from "@locateflow/shared";

// Move-design Pill tone for each plan status.
const pillTone: Record<string, "accent" | "success" | "warning" | "error" | "muted" | "info"> = {
  PLANNING: "muted",
  IN_PROGRESS: "accent",
  COMPLETED: "success",
  CANCELED: "error",
  CANCELLED: "error",
};

function readMovingDetailCache(raw: unknown): any | null {
  return asObject(raw) as any | null;
}

export default function MovingDetailScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const {
    data: plan,
    setCachedData: setPlan,
    loading,
    setLoading,
    startForegroundLoad,
  } = useDetailOfflineCache<any>(detailCacheKey("moving", id), readMovingDetailCache);
  const [refreshing, setRefreshing] = useState(false);
  const [migration, setMigration] = useState<any>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [moveTasks, setMoveTasks] = useState<any[]>([]);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
  const [taskBusy, setTaskBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Move-focused "what's still tied to the old address" — services on the from/to
  // addresses, fetched once the plan resolves (recreates the design's Direction C).
  const [moveAccounts, setMoveAccounts] = useState<{ atOld: any[]; atNew: any[] } | null>(null);
  // Full address list (with lat/lng) for the route-map preview below the from/to
  // cards. Populated from the same /api/addresses fetch used for moveAccounts.
  const [addresses, setAddresses] = useState<any[]>([]);
  // Task assignment (Family/Pro). Members + flag come from the move-tasks GET;
  // the Assign picker only shows when assignmentEnabled (2+ active members).
  const [workspaceMembers, setWorkspaceMembers] = useState<
    { userId: string; name: string | null; initials: string }[]
  >([]);
  const [assignmentEnabled, setAssignmentEnabled] = useState(false);

  const fetchMigration = useCallback(async (planId: string) => {
    const mRes = await api.get<any>("/api/moving/migration", { planId });
    if (mRes.data?.analysis) setMigration(mRes.data.analysis);
  }, []);

  const fetchMoveTasks = useCallback(async (planId: string) => {
    const taskRes = await api.get<any>("/api/move-tasks", { movingPlanId: planId });
    if (taskRes.data?.tasks) setMoveTasks(taskRes.data.tasks);
    setWorkspaceMembers(Array.isArray(taskRes.data?.workspaceMembers) ? taskRes.data.workspaceMembers : []);
    setAssignmentEnabled(Boolean(taskRes.data?.assignmentEnabled));
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
      setError(null);
    }
    return true;
  }, [id, fetchMigration, fetchMoveTasks]);

  // Correlate services to the move's old/new addresses. Services still on the
  // FROM address are the ones at risk of being forgotten after the move.
  useEffect(() => {
    const fromId = plan?.fromAddress?.id;
    const toId = plan?.toAddress?.id;
    if (!fromId && !toId) {
      setMoveAccounts(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await api.get<any>("/api/addresses", { limit: "200" });
      if (cancelled || res.error || !res.data) return;
      const list = (res.data.addresses || []) as any[];
      setAddresses(list);
      const byId = new Map<string, any>(list.map((a: any) => [a.id, a]));
      setMoveAccounts({
        atOld: (byId.get(fromId)?.services as any[]) || [],
        atNew: (byId.get(toId)?.services as any[]) || [],
      });
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [plan?.fromAddress?.id, plan?.toAddress?.id]);

  // Advance the moving plan through the same state machine the web exposes:
  // PLANNING -> IN_PROGRESS -> COMPLETED (PATCH /api/moving/[id]).
  const changeStatus = async (status: "IN_PROGRESS" | "COMPLETED") => {
    if (!plan) return;
    setTaskBusy("status");
    const res = await api.patch<any>(`/api/moving/${id}`, { status });
    setTaskBusy(null);
    if (res.error) {
      hapticError();
      Alert.alert(t("moving.title", { defaultValue: "Moving" }), res.error);
      return;
    }
    hapticSuccess();
    await fetch_();
  };

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
    setShowAllTasks(false);
    setExpandedTaskIds(new Set());
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

  const toggleTaskDetails = useCallback((taskId: string) => {
    setExpandedTaskIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  // Assign (or unassign) a task to a workspace member. Any active member may
  // assign within their workspace; the API validates the target before writing.
  const assignMoveTask = async (taskId: string, assignedToUserId: string | null) => {
    setTaskBusy(taskId);
    const res = await api.patch<any>("/api/move-tasks", { id: taskId, assignedToUserId });
    setTaskBusy(null);
    if (res.error) {
      hapticError();
      Alert.alert(t("moving.moveTasksAlert"), res.error);
      return;
    }
    hapticSuccess();
    if (plan) await fetchMoveTasks(plan.id);
  };

  // Native action sheet to pick an assignee. Multi-member only (the trigger is
  // gated on assignmentEnabled). Includes an Unassign option when assigned.
  const openAssignPicker = (task: any) => {
    const buttons: { text: string; onPress?: () => void; style?: "cancel" | "destructive" }[] =
      workspaceMembers.map((m) => ({
        text: task.assignee?.id === m.userId ? `✓ ${m.name || "Member"}` : m.name || "Member",
        onPress: () => assignMoveTask(task.id, m.userId),
      }));
    if (task.assignee) {
      buttons.push({
        text: t("moving.unassign", { defaultValue: "Unassign" }),
        style: "destructive",
        onPress: () => assignMoveTask(task.id, null),
      });
    }
    buttons.push({ text: t("common.cancel"), style: "cancel" });
    Alert.alert(t("moving.assignTo", { defaultValue: "Assign to" }), undefined, buttons);
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

  // SWIPE-TO-COMPLETE — fires the SAME complete event the buttons use
  // (PATCH /api/move-tasks { id, event: "COMPLETE" }) but optimistically:
  // the row flips to COMPLETED immediately so the swipe feels instant, then
  // we reconcile with the server. On API error we revert the row to its prior
  // state + error haptic. Non-blocking — never gates the screen.
  const completeMoveTaskOptimistic = useCallback(
    async (taskId: string) => {
      let prevStatus: string | undefined;
      setMoveTasks((curr) =>
        curr.map((tk) => {
          if (tk.id === taskId) {
            prevStatus = tk.status;
            return { ...tk, status: "COMPLETED" };
          }
          return tk;
        }),
      );
      const res = await api.patch<any>("/api/move-tasks", { id: taskId, event: "COMPLETE" });
      if (res.error) {
        hapticError();
        // Revert to the captured prior status.
        setMoveTasks((curr) =>
          curr.map((tk) => (tk.id === taskId && prevStatus ? { ...tk, status: prevStatus } : tk)),
        );
        Alert.alert(t("moving.moveTasksAlert"), res.error);
        return;
      }
      hapticSuccess();
      // Best-effort reconcile so dueDate/templateId-driven state is authoritative.
      if (plan) await fetchMoveTasks(plan.id);
    },
    [plan, fetchMoveTasks, t],
  );

  const formatTaskDueDate = (value?: string | Date | null) => {
    if (!value) return null;
    const dueDate = new Date(value);
    if (Number.isNaN(dueDate.getTime())) return null;
    return dueDate.toLocaleDateString(dateLocale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Compact gutter label for the timeline date rail — "OCT 26" (wraps to two
  // mono-uppercase lines in the 38px gutter, matching the Aurora spec).
  const formatTaskDueShort = (value?: string | Date | null) => {
    if (!value) return null;
    const dueDate = new Date(value);
    if (Number.isNaN(dueDate.getTime())) return null;
    return dueDate
      .toLocaleDateString(dateLocale, { month: "short", day: "numeric" })
      .toUpperCase();
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
    startForegroundLoad();
    try {
      await fetch_();
    } finally {
      setLoading(false);
    }
  }, [fetch_, setLoading, startForegroundLoad]);

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

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>{t("moving.title")}</Text>
            <Text style={styles.title}>{t("moving.detailTitle")}</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>
        <View style={[styles.scrollContent, { gap: 16 }]}>
          <SkeletonCard lines={3} showFooter />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} showFooter />
        </View>
      </SafeAreaView>
    );
  }
  if (!plan) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>{t("moving.title")}</Text>
            <Text style={styles.title}>{t("common.notFound")}</Text>
          </View>
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

  const countdown = getMoveCountdown(plan.moveDate, {
    state: plan.toAddress?.state || plan.fromAddress?.state || null,
  });
  const daysUntil = countdown.days;
  const isInterstateMove = plan.fromAddress?.state !== plan.toAddress?.state;
  const dateLocale = (i18n.language || "").toLowerCase().startsWith("es") ? "es-ES" : "en-US";
  const moveDateLabel = formatDateOnlyUtc(
    plan.moveDate,
    { month: "long", day: "numeric", year: "numeric" },
    dateLocale,
  );
  const moveScopeLabel = isInterstateMove ? t("moving.interstateMove") : t("moving.intrastateMove");
  const scopeDetail = isInterstateMove
    ? t("moving.interstateDetail")
    : t("moving.intrastateDetail");
  const migrationSummaryLabel = migration
    ? t("moving.migrationSummary", { count: migration.transitionPlans?.length || migration.summary.total })
    : t("moving.migrationEmpty");
  const hasTransitionPlans = Boolean(migration?.transitionPlans?.length);

  // Timeline progress — dismissed tasks drop out of the denominator so the
  // celebration only fires when every tracked task is genuinely done.
  const doneTaskCount = moveTasks.filter((tk) => tk.status === "COMPLETED").length;
  const trackedTaskCount = moveTasks.filter((tk) => tk.status !== "DISMISSED").length;
  const taskProgressPct = trackedTaskCount > 0 ? Math.round((doneTaskCount / trackedTaskCount) * 100) : 0;
  const allTasksDone = trackedTaskCount > 0 && doneTaskCount === trackedTaskCount;
  const taskFocusLimit = 5;
  const taskDueTime = (task: any) => {
    const due = task.dueDate ? new Date(task.dueDate).getTime() : Number.POSITIVE_INFINITY;
    return Number.isNaN(due) ? Number.POSITIVE_INFINITY : due;
  };
  const focusMoveTasks = [...moveTasks]
    .filter((task) => task.status !== "COMPLETED" && task.status !== "DISMISSED")
    .sort((a, b) => taskDueTime(a) - taskDueTime(b));
  const fallbackMoveTasks = [...moveTasks]
    .filter((task) => task.status !== "DISMISSED")
    .sort((a, b) => taskDueTime(a) - taskDueTime(b));
  const focusedMoveTasks = focusMoveTasks.length > 0
    ? focusMoveTasks
    : fallbackMoveTasks.length > 0
      ? fallbackMoveTasks
      : [...moveTasks].sort((a, b) => taskDueTime(a) - taskDueTime(b));
  const visibleMoveTasks = showAllTasks ? moveTasks : focusedMoveTasks.slice(0, taskFocusLimit);
  const hasTaskOverflow = moveTasks.length > taskFocusLimit;
  const hiddenMoveTaskCount = Math.max(0, moveTasks.length - visibleMoveTasks.length);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>{t("moving.title")}</Text>
          <Text style={styles.title}>{t("moving.detailTitle")}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
      >
        {/* Hero Card — Move gradient surface with raccoon + serif route */}
        <HeroCard style={styles.heroCard} radius={24} padding={18}>
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <Truck size={24} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroEyebrow}>{t("moving.route")}</Text>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {plan.fromAddress?.city || t("moving.origin")} → {plan.toAddress?.city || t("moving.destination")}
              </Text>
              <View style={styles.heroMeta}>
                <Calendar size={12} color={theme.colors.dim} />
                <Text style={styles.heroDate}>
                  {moveDateLabel}
                </Text>
              </View>
            </View>
            <MoveRaccoon size={36} mood={plan.status === "IN_PROGRESS" ? "alert" : "calm"} />
          </View>
          <View style={styles.heroBadges}>
            <Pill
              label={t(`moving.status_${plan.status}`, { defaultValue: plan.status.replace("_", " ") })}
              tone={pillTone[plan.status] || "muted"}
            />
            {daysUntil !== null && daysUntil > 0 && (
              <Pill label={t("moving.daysLeft", { count: daysUntil })} tone="warning" />
            )}
            {plan.isTemporary && <Pill label={t("moving.temporary")} tone="info" />}
            <Pill label={moveScopeLabel} tone={isInterstateMove ? "warning" : "success"} />
          </View>
        </HeroCard>

        {/* Lifecycle action — Start moving (PLANNING) / Mark complete (IN_PROGRESS) */}
        {plan.status === "PLANNING" || plan.status === "IN_PROGRESS" ? (
          <TouchableOpacity
            onPress={() => changeStatus(plan.status === "PLANNING" ? "IN_PROGRESS" : "COMPLETED")}
            disabled={taskBusy === "status"}
            accessibilityRole="button"
            activeOpacity={0.85}
            style={{ marginTop: 14, opacity: taskBusy === "status" ? 0.6 : 1 }}
          >
            {plan.status === "PLANNING" ? (
              <LinearGradient
                colors={theme.colors.gradient.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.lifecycleBtn}
              >
                <Text style={[styles.lifecycleBtnText, { color: theme.colors.onAccent }]}>
                  {taskBusy === "status"
                    ? t("common.saving", { defaultValue: "Saving…" })
                    : t("moving.startMoving", { defaultValue: "Start moving" })}
                </Text>
              </LinearGradient>
            ) : (
              <View style={[styles.lifecycleBtn, { backgroundColor: theme.colors.success }]}>
                <Text style={[styles.lifecycleBtnText, { color: theme.colors.onAccent }]}>
                  {taskBusy === "status"
                    ? t("common.saving", { defaultValue: "Saving…" })
                    : t("moving.markComplete", { defaultValue: "Mark complete" })}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ) : null}

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

        {/* Route preview — real OSM/Google map between the from/to addresses.
            Self-hides if coordinates are missing or the proxy fails (graceful). */}
        <TransitRouteMap
          activeMove={plan}
          addresses={addresses}
          fromCity={plan.fromAddress?.city ?? ""}
          toCity={plan.toAddress?.city ?? ""}
        />

        {/* USPS mail forwarding — prominent, hardcoded, official-only link.
            Opens the IMMUTABLE USPS_MOVERS_GUIDE_URL in the OS browser (never an
            in-app WebView, no redirect, no interpolation). The destination host
            is shown in plain sight so the target is verifiable (anti-phishing). */}
        {(plan.status === "PLANNING" || plan.status === "IN_PROGRESS") && (
          <Card variant="default" style={{ marginTop: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  backgroundColor: theme.colors.primaryFaded,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Mailbox size={16} color={theme.colors.primary} />
              </View>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: "700", color: theme.colors.text }}>
                {t("moving.uspsTitle", { defaultValue: "USPS mail forwarding" })}
              </Text>
            </View>
            <Text style={{ fontSize: 12.5, lineHeight: 18, color: theme.colors.textSecondary }}>
              {t("moving.uspsBody", {
                defaultValue:
                  "Forward your mail to your new address — best done about 2 weeks before you move. You'll finish on the official USPS site, which charges a small one-time identity-verification fee. Move never collects it.",
              })}
            </Text>
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                void Linking.openURL(USPS_MOVERS_GUIDE_URL).catch(() => {});
              }}
              accessibilityRole="link"
              accessibilityLabel={t("moving.uspsCta", { defaultValue: "Open the official USPS site" })}
              activeOpacity={0.85}
              style={{ marginTop: 12 }}
            >
              <LinearGradient
                colors={theme.colors.gradient.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  borderRadius: 12,
                  paddingVertical: 12,
                }}
              >
                <Text style={{ fontSize: 14, fontFamily: fonts.sansBold, color: theme.colors.onAccent }}>
                  {t("moving.uspsCta", { defaultValue: "Open the official USPS site" })}
                </Text>
                <ExternalLink size={15} color={theme.colors.onAccent} />
              </LinearGradient>
            </TouchableOpacity>
            <Text style={{ fontSize: 11, color: theme.colors.textTertiary, textAlign: "center", marginTop: 6 }}>
              moversguide.usps.com
            </Text>
          </Card>
        )}

        {/* Move-focused: what's set up at the new place vs still tied to the old one */}
        {moveAccounts && (moveAccounts.atOld.length > 0 || moveAccounts.atNew.length > 0) && (
          <View style={{ marginBottom: 4 }}>
            <Text style={styles.moveLbl}>Catch what's still tied to your old address</Text>
            <View style={styles.moveSplits}>
              <View style={[styles.moveSplit, { borderColor: theme.colors.emerald.border }]}>
                <View style={styles.moveSplitH}>
                  <Check size={15} color={theme.colors.emerald.text} />
                  <Text style={[styles.moveSplitHT, { color: theme.colors.emerald.text }]}>Set up at new</Text>
                  <Text style={styles.moveSplitN}>{moveAccounts.atNew.length}</Text>
                </View>
                {moveAccounts.atNew.length === 0 ? (
                  <Text style={styles.moveEmpty}>Nothing yet</Text>
                ) : (
                  moveAccounts.atNew.slice(0, 6).map((s: any) => (
                    <View key={s.id} style={styles.moveRow}>
                      <View style={[styles.moveDot, { backgroundColor: theme.colors.emerald.text }]} />
                      <Text style={styles.moveName} numberOfLines={1}>{s.providerName || s.provider?.name || "Service"}</Text>
                      <Check size={13} color={theme.colors.emerald.text} />
                    </View>
                  ))
                )}
              </View>
              <View style={[styles.moveSplit, { borderColor: theme.colors.orange.border }]}>
                <View style={styles.moveSplitH}>
                  <AlertTriangle size={15} color={theme.colors.error} />
                  <Text style={[styles.moveSplitHT, { color: theme.colors.error }]}>Still at old</Text>
                  <Text style={styles.moveSplitN}>{moveAccounts.atOld.length}</Text>
                </View>
                {moveAccounts.atOld.length === 0 ? (
                  <Text style={styles.moveEmpty}>All clear</Text>
                ) : (
                  moveAccounts.atOld.slice(0, 6).map((s: any) => (
                    <TouchableOpacity
                      key={s.id}
                      style={styles.moveRow}
                      onPress={() => router.push({ pathname: "/services/[id]", params: { id: s.id } })}
                    >
                      <View style={[styles.moveDot, { backgroundColor: theme.colors.error }]} />
                      <Text style={styles.moveName} numberOfLines={1}>{s.providerName || s.provider?.name || "Service"}</Text>
                      <ChevronRight size={13} color={theme.colors.error} />
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </View>
          </View>
        )}

        {/* Move Scope — heavy secondary section, collapsed by default */}
        <CollapsibleCard
          title={t("moving.moveScope")}
          icon={<ArrowRightLeft size={16} color={theme.colors.primary} />}
        >
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
        </CollapsibleCard>

        <SectionHeader label={t("moving.moveTasks")} style={styles.sectionHeader} />
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
              accessibilityRole="button"
              accessibilityLabel={
                moveTasks.length > 0
                  ? t("moving.regenerateTasks", { defaultValue: "Regenerate tasks" })
                  : t("moving.generateTasks", { defaultValue: "Generate tasks" })
              }
            >
              <Text style={styles.migBtnPrimaryText}>
                {taskBusy === "generate"
                  ? t("moving.syncing")
                  : moveTasks.length > 0
                    ? t("moving.regenerate", { defaultValue: "Regenerate" })
                    : t("moving.generate")}
              </Text>
            </TouchableOpacity>
          </View>
          {/* Aurora progress strip — mono kicker + glow gradient bar (tl-prog) */}
          {moveTasks.length > 0 && (
            <View style={styles.tlProgress}>
              <View style={styles.tlProgressRow}>
                <Text style={styles.tlProgressPct}>
                  {t("moving.percentComplete", { pct: taskProgressPct }).toUpperCase()}
                </Text>
                <Text style={styles.tlProgressCount}>
                  {t("moving.taskCountOfTotal", { done: doneTaskCount, total: trackedTaskCount })}
                </Text>
              </View>
              <MoveProgressBar value={taskProgressPct / 100} height={7} />
            </View>
          )}
          {moveTasks.length === 0 ? (
            <Text style={styles.emptyText}>{t("moving.noMoveTasks")}</Text>
          ) : (
            <GestureHandlerRootView>
              {/* Aurora vertical timeline — date gutter · rail · node dot · glass card */}
              <View style={styles.timeline}>
                <View style={styles.timelineRail} />
                {visibleMoveTasks.map((task) => {
                const done = task.status === "COMPLETED";
                const dismissed = task.status === "DISMISSED";
                const open = !done && !dismissed;
                const expanded = expandedTaskIds.has(task.id);
                const dueShort = formatTaskDueShort(task.dueDate);
                const dueLabel = formatTaskDueDate(task.dueDate);
                const rowInner = (
                  <View
                    style={[styles.taskRow, done && styles.taskRowDone]}
                    accessibilityHint={open ? t("moving.swipeCompleteHint") : undefined}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={styles.taskBadges}>
                        <UiBadge label={t(`moving.taskStatus_${task.status}`, { defaultValue: task.status.replace(/_/g, " ") })} variant={done ? "success" : dismissed ? "neutral" : "warning"} />
                        <UiBadge label={t(`moving.confidence_${task.confidence}`, { defaultValue: `${task.confidence} confidence` })} variant="neutral" />
                      </View>
                      <View style={styles.taskTitleRow}>
                        <TouchableOpacity
                          style={styles.taskTitleToggle}
                          onPress={() => toggleTaskDetails(task.id)}
                          activeOpacity={0.75}
                          accessibilityRole="button"
                          accessibilityLabel={expanded
                            ? t("moving.hideTaskDetails", { defaultValue: "Hide task details" })
                            : t("moving.showTaskDetails", { defaultValue: "Show task details" })}
                        >
                          <Text style={[styles.taskTitle, { flex: 1 }]} numberOfLines={2}>{task.title}</Text>
                          <ChevronRight
                            size={15}
                            color={theme.colors.textTertiary}
                            style={{ transform: [{ rotate: expanded ? "90deg" : "0deg" }] }}
                          />
                        </TouchableOpacity>
                        {open && !expanded ? (
                          <TouchableOpacity
                            style={styles.taskQuickDone}
                            disabled={taskBusy === task.id}
                            onPress={() => confirmCompleteMoveTask(task.id)}
                            accessibilityRole="button"
                            accessibilityLabel={t("moving.complete")}
                          >
                            <Check size={14} color={theme.colors.background} />
                          </TouchableOpacity>
                        ) : null}
                        {/* Assignee avatar — multi-member workspaces only. */}
                        {assignmentEnabled && task.assignee ? (
                          <Avatar initials={task.assignee.initials} size={24} style={{ marginLeft: 8 }} />
                        ) : null}
                      </View>
                      <View style={styles.taskCompactMeta}>
                        {dueShort ? (
                          <View style={styles.taskDuePill}>
                            <Calendar size={11} color={theme.colors.primary} />
                            <Text style={styles.taskDuePillText}>{dueShort}</Text>
                          </View>
                        ) : null}
                        <TouchableOpacity
                          onPress={() => toggleTaskDetails(task.id)}
                          activeOpacity={0.75}
                          accessibilityRole="button"
                          accessibilityLabel={expanded
                            ? t("moving.hideTaskDetails", { defaultValue: "Hide task details" })
                            : t("moving.showTaskDetails", { defaultValue: "Show task details" })}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={styles.taskDetailHint}>
                            {expanded
                              ? t("moving.hideTaskDetails", { defaultValue: "Hide details" })
                              : t("moving.showTaskDetails", { defaultValue: "Details" })}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      {expanded && !!task.description && <Text style={styles.taskDescription}>{task.description}</Text>}
                      {expanded && dueLabel && (
                        <Text style={styles.taskDue}>{t("moving.dueDate", { date: dueLabel })}</Text>
                      )}
                      {expanded && <Text style={styles.taskCaveat}>{t("providers.manualTrackingCaveat")}</Text>}
                      {/* Vehicle-registration task only: compact VIN → specs/recalls
                          helper (NHTSA) with the destination state's DMV link. */}
                      {expanded && open && isVehicleRegistrationTask(task) && (
                        <VehicleCheckCard destinationState={plan.toAddress?.state} />
                      )}
                    </View>
                    {expanded && (
                    <View style={styles.taskActions}>
                      {assignmentEnabled && open && (
                        <TouchableOpacity
                          style={styles.assignBtn}
                          disabled={taskBusy === task.id}
                          onPress={() => openAssignPicker(task)}
                          accessibilityRole="button"
                        >
                          <UserPlus size={11} color={theme.colors.textSecondary} />
                          <Text style={styles.migBtnText}>
                            {task.assignee
                              ? t("moving.reassign", { defaultValue: "Reassign" })
                              : t("moving.assign", { defaultValue: "Assign" })}
                          </Text>
                        </TouchableOpacity>
                      )}
                      {open && (
                        <TouchableOpacity
                          style={styles.migBtnPrimary}
                          disabled={taskBusy === task.id}
                          onPress={() => confirmCompleteMoveTask(task.id)}
                        >
                          <Text style={styles.migBtnPrimaryText}>{t("moving.complete")}</Text>
                        </TouchableOpacity>
                      )}
                      {open && (
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
                    )}
                  </View>
                );

                // Open tasks get swipe-to-complete: swipe left to reveal a
                // "Done" action firing the SAME COMPLETE event the button uses
                // (optimistic + revert on error). Tap behavior is untouched.
                // Completed/dismissed rows render plain (no swipe).
                return (
                  <View key={task.id} style={styles.tlItem}>
                    <Text style={styles.tlDate} numberOfLines={2}>
                      {dueShort ?? ""}
                    </Text>
                    <View style={styles.tlDotCol}>
                      <View style={[styles.tlDot, done && styles.tlDotDone]} />
                    </View>
                    {!open ? (
                      <View style={styles.tlCardWrap}>{rowInner}</View>
                    ) : (
                      <Swipeable
                        containerStyle={styles.tlCardWrap}
                        friction={2}
                        rightThreshold={48}
                        overshootRight={false}
                        renderRightActions={() => (
                          <View style={styles.swipeAction}>
                            <Check size={18} color="#fff" />
                            <Text style={styles.swipeActionText}>{t("moving.swipeDone")}</Text>
                          </View>
                        )}
                        onSwipeableOpen={(direction, swipeable) => {
                          if (direction === "right") {
                            swipeable.close();
                            void completeMoveTaskOptimistic(task.id);
                          }
                        }}
                      >
                        {rowInner}
                      </Swipeable>
                    )}
                  </View>
                );
              })}
              </View>
              {hasTaskOverflow && (
                <TouchableOpacity
                  style={styles.taskRevealBtn}
                  onPress={() => setShowAllTasks((value) => !value)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                >
                  <Text style={styles.taskRevealText}>
                    {showAllTasks
                      ? t("moving.showFocusTasks", { defaultValue: "Show focus tasks" })
                      : t("moving.showAllTasks", {
                          count: hiddenMoveTaskCount,
                          defaultValue: `Show all ${moveTasks.length} tasks`,
                        })}
                  </Text>
                  <ChevronRight
                    size={14}
                    color={theme.colors.primary}
                    style={{ transform: [{ rotate: showAllTasks ? "-90deg" : "90deg" }] }}
                  />
                </TouchableOpacity>
              )}
            </GestureHandlerRootView>
          )}
          {/* 100% — every tracked task checked off: celebrate (Aurora ca-celebrate) */}
          {allTasksDone && (
            <View style={styles.celebrateCard}>
              <View style={styles.celebrateIcon}>
                <Check size={24} color={theme.colors.emerald.text} />
              </View>
              <Text style={styles.celebrateTitle}>{t("moving.celebrateTitle")}</Text>
              <Text style={styles.celebrateBody}>{t("moving.celebrateBody")}</Text>
            </View>
          )}
        </Card>

        {/* New Home Dossier — FEMA flood zone, NCES school district, and the
            moving-day forecast for the destination. Self-fetches
            /api/addresses/{toAddressId}/dossier and renders nothing when the
            lookups are unconfigured/degraded or the device is offline. */}
        <HomeDossierCard addressId={plan.toAddress?.id} />

        {/* Migration Panel — heavy secondary section, collapsed by default */}
        {migration && migration.summary.total > 0 && (
          <CollapsibleCard
            title={t("moving.serviceMigration")}
            icon={<ArrowRightLeft size={16} color={theme.colors.primary} />}
          >
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
                          {planItem.serviceProviderName
                            ? `${planItem.actionLabel || String(planItem.actionType || "").replace(/_/g, " ")} · ${planItem.serviceProviderName}`
                            : (planItem.actionLabel || String(planItem.actionType || "").replace(/_/g, " "))}
                        </Text>
                        {(planItem.serviceProviderName || planItem.serviceCategoryLabel) ? (
                          <Text style={styles.transitionService}>
                            {planItem.serviceProviderName || ""}
                            {planItem.serviceProviderName && planItem.serviceCategoryLabel ? " · " : ""}
                            {planItem.serviceCategoryLabel ? String(planItem.serviceCategoryLabel).replace(/_/g, " ") : ""}
                          </Text>
                        ) : null}
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

              {!hasTransitionPlans && (
                <>
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

                </>
              )}
          </CollapsibleCard>
        )}

        {/* State Guide — shared StateRulesCard, keyed on the destination state.
            Self-fetches /api/state-rules and renders nothing if no rule exists.
            Same component the providers browse header uses, so both stay in sync. */}
        <StateRulesCard state={plan.toAddress?.state} />

        {/* Delete */}
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Trash2 size={16} color={theme.colors.error} />
          <Text style={styles.deleteText}>{t("moving.deletePlan")}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  headerText: { flex: 1 },
  backBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border,
    alignItems: "center", justifyContent: "center",
  },
  eyebrow: {
    fontSize: 10, fontFamily: fonts.sansBold, letterSpacing: 1.8,
    textTransform: "uppercase", color: theme.colors.primary,
  },
  title: { fontSize: 22, fontFamily: fonts.serifBold, color: theme.colors.text, marginTop: 2, lineHeight: 26 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  heroCard: { marginBottom: 4 },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  heroIcon: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: theme.colors.primaryFaded, alignItems: "center", justifyContent: "center",
  },
  heroEyebrow: {
    fontSize: 9, fontFamily: fonts.sansBold, letterSpacing: 1.4,
    textTransform: "uppercase", color: theme.colors.primary,
  },
  heroTitle: { fontSize: 19, fontFamily: fonts.serifBold, color: theme.colors.text, marginTop: 3, lineHeight: 24 },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 },
  heroDate: { fontSize: 13, color: theme.colors.dim },
  heroBadges: { flexDirection: "row", gap: 6, marginTop: 14, flexWrap: "wrap" },
  lifecycleBtn: { paddingVertical: 14, borderRadius: 12, alignItems: "center", ...theme.shadow.glow },
  lifecycleBtnText: { fontFamily: fonts.sansBold, fontSize: 15 },
  sectionHeader: { marginTop: 24, marginBottom: 12 },
  addressCards: { flexDirection: "row", gap: 12, marginTop: 16 },
  addrLabel: { fontSize: 11, fontFamily: fonts.sansBold, color: theme.colors.faint, marginTop: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  addrValue: { fontSize: 13, fontFamily: fonts.sansSemibold, color: theme.colors.text, marginTop: 4 },
  // Move-focused split (Aurora Direction C)
  moveLbl: {
    fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", fontFamily: fonts.sansBold,
    color: theme.colors.faint, marginTop: 16, marginBottom: 9, marginLeft: 2,
  },
  moveSplits: { flexDirection: "row", gap: 10 },
  moveSplit: {
    flex: 1, padding: 13, borderRadius: 16,
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border,
  },
  moveSplitH: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  moveSplitHT: { fontSize: 12.5, fontWeight: "700" },
  moveSplitN: { marginLeft: "auto", fontSize: 11, fontWeight: "700", color: theme.colors.textTertiary },
  moveRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7, borderTopWidth: 1, borderTopColor: theme.colors.border },
  moveDot: { width: 7, height: 7, borderRadius: 4 },
  moveName: { flex: 1, fontSize: 12, color: theme.colors.text },
  moveEmpty: { fontSize: 12, color: theme.colors.textTertiary, paddingVertical: 6 },
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
    backgroundColor: theme.colors.errorFaded, borderWidth: 1, borderColor: "rgba(226, 92, 92, 0.20)",
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
    backgroundColor: theme.colors.successFaded, borderColor: theme.colors.success,
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
  transitionService: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.primary,
    marginTop: 4,
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
  // ── Aurora timeline (Edition VII) — date gutter · rail · node dot · card ──
  tlProgress: { marginTop: 2, marginBottom: 16 },
  tlProgressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 8,
  },
  tlProgressPct: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
    color: theme.colors.primary,
  },
  tlProgressCount: { fontSize: 12, color: theme.colors.textTertiary },
  timeline: { position: "relative", marginTop: 4 },
  // Rail centered under the dot column: date gutter 38 + half of the 28 dot
  // column = 52; the 2px rail spans 51–53.
  timelineRail: {
    position: "absolute",
    left: 51,
    top: 10,
    bottom: 14,
    width: 2,
    borderRadius: 1,
    backgroundColor: theme.colors.border,
  },
  tlItem: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  tlDate: {
    width: 38,
    paddingTop: 14,
    textAlign: "right",
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1,
    fontWeight: "700",
    textTransform: "uppercase",
    color: theme.colors.textTertiary,
  },
  tlDotCol: { width: 28, alignItems: "center", paddingTop: 14 },
  tlDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.colors.textMuted,
    backgroundColor: theme.colors.background,
  },
  tlDotDone: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  tlCardWrap: { flex: 1 },
  celebrateCard: {
    alignItems: "flex-start",
    gap: 8,
    marginTop: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: theme.colors.successFaded,
    borderWidth: 1,
    borderColor: theme.colors.emerald.border,
  },
  celebrateIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.emerald.bg,
    borderWidth: 1,
    borderColor: theme.colors.emerald.border,
  },
  celebrateTitle: {
    fontSize: 18,
    fontFamily: fonts.serifBold,
    letterSpacing: 0,
    color: theme.colors.text,
  },
  celebrateBody: {
    fontSize: 12.5,
    lineHeight: 19,
    color: theme.colors.textSecondary,
  },
  taskRow: {
    gap: 10,
    padding: 13,
    borderRadius: 14,
    backgroundColor: theme.colors.glass.bg,
    borderWidth: 1,
    borderColor: theme.colors.glass.border,
  },
  taskRowDone: {
    backgroundColor: theme.colors.successFaded,
    borderColor: theme.colors.emerald.border,
  },
  taskBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
  },
  taskTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  taskTitleToggle: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  taskTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.colors.text,
  },
  taskQuickDone: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
  },
  taskCompactMeta: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
  },
  taskDuePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: theme.colors.primaryFaded,
    borderWidth: 1,
    borderColor: theme.colors.borderFocus,
  },
  taskDuePillText: {
    fontSize: 10,
    fontWeight: "800",
    color: theme.colors.primary,
  },
  taskDetailHint: {
    fontSize: 10,
    fontWeight: "800",
    color: theme.colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  assignBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  taskDescription: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    lineHeight: 17,
    marginTop: 4,
  },
  taskDue: {
    fontSize: 11,
    color: theme.colors.primary,
    marginTop: 6,
    fontWeight: "700",
  },
  taskCaveat: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 6,
    lineHeight: 15,
  },
  taskActions: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  taskRevealBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginLeft: 66,
    marginTop: 4,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryFaded,
    borderWidth: 1,
    borderColor: "rgba(203, 164, 94,0.22)",
  },
  taskRevealText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.primary,
  },
  swipeAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 20,
    marginVertical: 6,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.emerald.text,
  },
  swipeActionText: { fontSize: 13, fontWeight: "800", color: "#fff" },
});
