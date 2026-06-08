import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  MapPin,
  Zap,
  DollarSign,
  Truck,
  ArrowRight,
  Bell,
  BellRing,
  AlertTriangle,
  Users,
  Mail,
  X,
  CalendarClock,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import {
  getPushSoftPromptDecision,
  registerForPushNotifications,
} from "@/lib/push";
import {
  fetchPendingInvitations,
  acceptPendingInvitation,
  declinePendingInvitation,
  type PendingInvitation,
} from "@/lib/workspace-invite";
import { computeAndPersistWidgetSnapshot } from "@/lib/widget-data";
import { Card } from "@/components/ui/Card";
import { MoveBriefingCard } from "@/components/ui/MoveBriefingCard";
import { PlanHero } from "@/components/ui/PlanHero";
import { MoveCommandCenter, type CommandCenterAction } from "@/components/ui/MoveCommandCenter";
import { UpNext } from "@/components/ui/UpNext";
import { SavingsInsightsCard } from "@/components/ui/SavingsInsightsCard";
import type { ServiceLike } from "@/lib/service-insights";
import { Badge as UiBadge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonCard, SkeletonStatGrid } from "@/components/ui/Skeleton";
import { CountUp } from "@/components/ui/CountUp";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { formatCurrency } from "@/lib/format";
import type { DashboardStats } from "@locateflow/shared";
import {
  generateChecklist,
  RELOCATION_PHASES,
  type UserChecklistProfile,
  type RelocationChecklist,
  type ChecklistStateRuleContext,
} from "@locateflow/shared";

// Once the user dismisses the in-app push re-prompt card we don't nag again.
// The soft-prompt decision ("accepted"/"deferred"/"declined"/null) lives in
// push.ts; this flag is purely about whether the *card* was waved away.
const PUSH_PROMPT_CARD_DISMISSED_KEY = "locateflow.pushPromptCardDismissed";

// Once the user dismisses the first-run AI move-briefing card we don't show it
// again on this install. The briefing is a one-time welcome surface, not a
// persistent dashboard widget.
const BRIEFING_CARD_DISMISSED_KEY = "locateflow.moveBriefingDismissed";

interface MoveBriefingState {
  briefing: string;
  aiGenerated: boolean;
}

export default function DashboardScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  // Full tracked-services list — powers the client-side savings/insights card.
  // Fetched alongside the dashboard payload (no new endpoint).
  const [services, setServices] = useState<ServiceLike[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checklist, setChecklist] = useState<RelocationChecklist | null>(null);
  // Move Command Center readiness signal: top next-critical action + how many
  // CRITICAL provider categories are still missing vs. set up. Sourced from the
  // recommendations engine (nextCriticalActions / stats.missingCritical).
  const [topAction, setTopAction] = useState<CommandCenterAction | null>(null);
  const [criticalReadiness, setCriticalReadiness] = useState<{ missing: number; completed: number }>({
    missing: 0,
    completed: 0,
  });
  // Primary address state → tz-correct move countdown (US-only zone mapping).
  const [primaryState, setPrimaryState] = useState<string | null>(null);
  // COLD-START momentum: true when the active plan has BOTH a real origin and a
  // real destination address. That is genuine, user-completed setup, so the
  // Move Command Center readiness ring starts at a low non-zero instead of 0%.
  // Credits ONLY setup the user actually did — never a fabricated task.
  const [hasOriginDestination, setHasOriginDestination] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [planTier, setPlanTier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<{
    id: string;
    name: string;
    planLabel: string;
    role: string;
    memberCount: number;
    seatLimit: number;
  } | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingInvitation[]>([]);
  // id of the invite currently being accepted/declined (disables its buttons).
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null);
  // Bumped on a successful invite-accept to fire the PlanHero crew's one-shot
  // celebration bounce. A plain counter keeps the trigger decoupled from PlanHero.
  const [celebrateTick, setCelebrateTick] = useState(0);
  // Push re-prompt card: shown only to users who never accepted push and
  // haven't dismissed the card. `null` = still deciding (render nothing).
  const [showPushPrompt, setShowPushPrompt] = useState<boolean | null>(null);
  const [pushPromptBusy, setPushPromptBusy] = useState(false);
  // First-run AI move briefing. `null` = not loaded / hidden (the feature gate
  // is off server-side, the user dismissed it, or the fetch failed). Best-effort
  // and fully decoupled from the core dashboard payload.
  const [briefing, setBriefing] = useState<MoveBriefingState | null>(null);

  const fetchDashboard = useCallback(async () => {
    // Captured during this load so the home-screen widget snapshot (computed at
    // the end, best-effort) can read the same critical-readiness counts the
    // command center uses without depending on async React state updates.
    let widgetCompletedCritical = 0;
    let widgetMissingCritical = 0;
    const [res, addrRes, movingRes, svcRes, invites, recoRes] = await Promise.all([
      api.get<any>("/api/profile"),
      api.get<any>("/api/addresses", { limit: "200" }),
      api.get<any>("/api/moving"),
      // Full tracked-services list for the savings/insights card. Best-effort:
      // an error here just leaves the card hidden, never blocks the dashboard.
      api.get<any>("/api/services", { limit: "200" }),
      // Best-effort: never blocks the dashboard. Empty when the feature gate is
      // off or the user has no actionable invites, in which case the banner hides.
      fetchPendingInvitations(),
      // Best-effort: powers the Move Command Center's readiness (missingCritical)
      // + single next-critical action. An error just leaves those at their empty
      // defaults; it never blocks the dashboard.
      api.get<any>("/api/providers/recommendations").catch(() => ({ data: null, error: true })),
    ]);
    // Move Command Center readiness — surfaced independently so it renders even
    // if the core payload partially failed.
    {
      const reco = (recoRes as any)?.data;
      const next = Array.isArray(reco?.nextCriticalActions) ? reco.nextCriticalActions[0] : null;
      setTopAction(
        next
          ? {
              id: next.id,
              name: next.name,
              category: next.category,
              reason: next.explanation?.reason || next.explanation?.headline || "",
              deadline: next.explanation?.deadline,
            }
          : null,
      );
      const missing: string[] = Array.isArray(reco?.stats?.missingCritical) ? reco.stats.missingCritical : [];
      const missingSet = new Set(missing);
      // `completedCritical` comes straight from the engine (CRITICAL cluster's
      // completedCount), so optional categories (gym/streaming) never inflate the
      // readiness ring the way the old completedCategories heuristic did.
      const completedCritical =
        typeof reco?.stats?.completedCritical === "number" ? reco.stats.completedCritical : 0;
      setCriticalReadiness({ missing: missingSet.size, completed: completedCritical });
      widgetCompletedCritical = completedCritical;
      widgetMissingCritical = missingSet.size;
    }
    // Surface services independently of the core payload so the insights card
    // still renders even if profile/addresses errored (and vice-versa).
    setServices(svcRes.data?.services || []);
    // Pending invites are independent of the core dashboard payload, so surface
    // them even when the rest of the dashboard errors out.
    setPendingInvites(invites);
    if (res.error || addrRes.error || movingRes.error) {
      setError(t("dashboard.loadFailed"));
      return false;
    }
    if (res.data) {
      setError(null);
      const profileData = res.data.profile || res.data;
      // Premium = the EFFECTIVE entitlement (an inherited Family/Pro member has
      // no own paid row but inherits access). Fall back to the own-subscription
      // heuristic only when the resolved entitlement is absent.
      const ent = res.data.entitlement;
      const sub = res.data.subscription || {};
      const hasPremium = ent
        ? ent.isActive === true && ent.plan && ent.plan !== "FREE_TRIAL"
        : Boolean(sub.plan && sub.plan !== "FREE_TRIAL" && (sub.status === "ACTIVE" || (sub.premiumUntil && new Date(sub.premiumUntil) > new Date())));
      const planValue = (ent?.plan ?? sub.plan ?? null) as string | null;
      setIsPremium(!!hasPremium);
      setPlanTier(planValue);
      // Mirror into the global auth store so ThemeProvider applies the
      // Family/Pro accent palette app-wide (not just on this screen).
      useAuthStore.getState().setPlanTier(planValue);

      // Household / Workspace card (Family/Pro). Best-effort and gated
      // server-side: when WORKSPACE_MODEL_ENABLED is off the API returns 404
      // (no data) so wsList is empty and the card hides. Only a real multi-seat
      // household (Family/Pro, seatLimit > 1) surfaces the card — a solo
      // Individual workspace stays hidden.
      const wsRes = await api.get<{ workspaces: any[] }>("/api/workspaces");
      const wsList = wsRes.data?.workspaces ?? [];
      const primaryWs =
        wsList.filter((w: any) => !w.deletedAt).find((w: any) => (w.seatLimit ?? 1) > 1) ?? null;
      setWorkspace(primaryWs ?? null);

      const addresses = addrRes.data?.addresses || [];
      setPrimaryState(
        addresses.find((a: any) => a.isPrimary)?.state || addresses[0]?.state || null,
      );
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

      // Real setup signal for the cold-start ring floor: both endpoints exist
      // with an actual city (not a placeholder). No fabrication — this only
      // reflects that the user genuinely set an origin and a destination.
      setHasOriginDestination(
        !!activePlan?.fromAddress?.city && !!activePlan?.toAddress?.city,
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

      // Generate relocation checklist for active plan.
      // Captured here (outside the try) so the home-screen widget snapshot — a
      // best-effort step at the end of this load — can blend it into readiness.
      let widgetChecklist: RelocationChecklist | null = null;
      if (activePlan) {
        try {
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
          // A generated MoveTask persists `templateId` (the checklist item it maps
          // to). A COMPLETED task with a non-null templateId marks that item DONE.
          // Without this, the readiness ring + checklist % are permanently 0% on
          // mobile (parity break with web dashboard-client.tsx).
          const completedTemplates = new Set<string>();
          try {
            const moveTasksRes = await api.get<any>("/api/move-tasks", {
              movingPlanId: activePlan.id,
              status: "COMPLETED",
            });
            for (const tk of moveTasksRes.data?.tasks || []) {
              if (tk?.templateId && tk?.status === "COMPLETED") completedTemplates.add(tk.templateId);
            }
          } catch {
            /* non-blocking: fall back to empty set */
          }
          const cl = generateChecklist(
            checklistProfile,
            new Date(activePlan.moveDate),
            activePlan.fromAddress?.state || "",
            toState,
            completedTemplates,
            stateRule,
          );
          setChecklist(cl);
          widgetChecklist = cl;
        } catch { /* non-blocking */ }
      }

      // HOME-SCREEN WIDGET SNAPSHOT — additive, best-effort, NEVER blocking.
      // Computes the glanceable { daysToGo, nextTaskTitle, readinessPercent, … }
      // from the data this load already produced and persists it to the shared
      // store the native widget reads. Wrapped + fire-and-forget so any failure
      // (storage, missing native dep) can't disturb the dashboard. We fetch the
      // OPEN tasks here only to surface the single next-task title; an error
      // just leaves nextTaskTitle null. The actual on-device widget render still
      // requires the owner's native EAS build (see apps/mobile/WIDGET-SETUP.md).
      void (async () => {
        try {
          let openTasks: { id: string; title: string; status: string; dueDate?: string | null }[] = [];
          if (activePlan?.id) {
            try {
              const openRes = await api.get<any>("/api/move-tasks", {
                movingPlanId: activePlan.id,
              });
              openTasks = (openRes.data?.tasks || []).map((tk: any) => ({
                id: tk.id,
                title: tk.title,
                status: tk.status,
                dueDate: tk.dueDate ?? null,
              }));
            } catch {
              /* non-blocking: leave nextTaskTitle to the checklist fallback */
            }
          }
          await computeAndPersistWidgetSnapshot({
            moveDate: activePlan?.moveDate ?? null,
            state:
              addresses.find((a: any) => a.isPrimary)?.state || addresses[0]?.state || null,
            tasks: openTasks,
            checklist: widgetChecklist,
            completedCritical: widgetCompletedCritical,
            missingCritical: widgetMissingCritical,
          });
        } catch {
          /* non-blocking: the widget snapshot is purely additive */
        }
      })();
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

  // Decide whether to surface the push re-prompt card. The onboarding
  // soft-prompt (maybeOfferPushSoftPrompt) only runs at onboarding completion,
  // so users who onboarded earlier — or deferred then — never see a prompt.
  // Show the card when the decision is null ("never asked") or "deferred",
  // and the user hasn't already dismissed the card this install.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const dismissed = await AsyncStorage.getItem(PUSH_PROMPT_CARD_DISMISSED_KEY);
        if (cancelled) return;
        if (dismissed === "true") {
          setShowPushPrompt(false);
          return;
        }
        const decision = await getPushSoftPromptDecision();
        if (cancelled) return;
        setShowPushPrompt(decision === null || decision === "deferred");
      } catch {
        if (!cancelled) setShowPushPrompt(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleEnablePush = useCallback(async () => {
    if (pushPromptBusy) return;
    setPushPromptBusy(true);
    try {
      // requireSoftPrompt:false → this card IS the soft prompt, so go straight
      // to the OS permission dialog + token registration.
      await registerForPushNotifications({ requireSoftPrompt: false });
    } finally {
      // Either way, retire the card: granted → no longer needed; denied →
      // don't nag (the OS prompt is one-shot anyway).
      setPushPromptBusy(false);
      setShowPushPrompt(false);
      void AsyncStorage.setItem(PUSH_PROMPT_CARD_DISMISSED_KEY, "true").catch(() => {});
    }
  }, [pushPromptBusy]);

  const handleDismissPushPrompt = useCallback(() => {
    setShowPushPrompt(false);
    void AsyncStorage.setItem(PUSH_PROMPT_CARD_DISMISSED_KEY, "true").catch(() => {});
  }, []);

  // First-run AI move briefing. Best-effort, gated, and graceful:
  //   - Skip entirely once the user has dismissed the card on this install.
  //   - POST /api/onboarding/briefing returns { configured: false } when the
  //     server has no ANTHROPIC_API_KEY — in that case we render nothing.
  //   - Any error (network, timeout, non-2xx) just leaves the card hidden; it
  //     never blocks or disturbs the rest of the dashboard.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const dismissed = await AsyncStorage.getItem(BRIEFING_CARD_DISMISSED_KEY);
        if (cancelled || dismissed === "true") return;
        const res = await api.post<{
          configured?: boolean;
          briefing?: string;
          aiGenerated?: boolean;
        }>("/api/onboarding/briefing");
        if (cancelled) return;
        if (res.error || !res.data || res.data.configured === false || !res.data.briefing) {
          return; // hide gracefully
        }
        setBriefing({
          briefing: res.data.briefing,
          aiGenerated: res.data.aiGenerated === true,
        });
      } catch {
        // Non-blocking: leave the briefing hidden.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDismissBriefing = useCallback(() => {
    setBriefing(null);
    void AsyncStorage.setItem(BRIEFING_CARD_DISMISSED_KEY, "true").catch(() => {});
  }, []);

  const handleAcceptInvite = useCallback(
    async (invite: PendingInvitation) => {
      if (inviteBusyId) return;
      setInviteBusyId(invite.id);
      try {
        const result = await acceptPendingInvitation(invite.id);
        if (result.ok) {
          // Celebrate: success haptic + bump the tick so the PlanHero crew does a
          // one-shot bounce. Haptics are best-effort (no-op on web / unsupported
          // devices) and reduce-motion-safe (notification haptics are tactile,
          // not motion, so they're appropriate even when animations are off).
          hapticSuccess();
          setCelebrateTick((n) => n + 1);
          // Drop the accepted invite immediately, then refresh the dashboard.
          // acceptPendingInvitation already wrote the resolved plan tier into the
          // auth store (via refreshPlanTierFromProfile) so ThemeProvider repaints
          // the Family/Pro accent + raccoon mascots app-wide; the refresh also
          // surfaces the new Household/Workspace card.
          setPendingInvites((prev) => prev.filter((i) => i.id !== invite.id));
          await fetchDashboard();
        } else {
          Alert.alert(t("dashboard.inviteHeading"), t("dashboard.inviteAcceptFailed"));
        }
      } finally {
        setInviteBusyId(null);
      }
    },
    [inviteBusyId, fetchDashboard, t],
  );

  const handleDeclineInvite = useCallback(
    async (invite: PendingInvitation) => {
      if (inviteBusyId) return;
      setInviteBusyId(invite.id);
      try {
        const ok = await declinePendingInvitation(invite.id);
        if (ok) {
          setPendingInvites((prev) => prev.filter((i) => i.id !== invite.id));
        } else {
          Alert.alert(t("dashboard.inviteHeading"), t("dashboard.inviteDeclineFailed"));
        }
      } finally {
        setInviteBusyId(null);
      }
    },
    [inviteBusyId, t],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{t("dashboard.welcome")}</Text>
            <Text style={styles.title}>{t("tabs.dashboard")}</Text>
          </View>
          <View style={styles.notifButton}>
            <Bell size={22} color={theme.colors.textSecondary} />
          </View>
        </View>
        <View style={styles.scrollContent}>
          <SkeletonStatGrid />
          <View style={{ height: 20 }} />
          <SkeletonCard lines={2} showFooter />
        </View>
      </SafeAreaView>
    );
  }

  const currencyFmt = (n: number) => formatCurrency(n, i18n.language);

  const statCards: Array<{
    icon: typeof MapPin;
    label: string;
    // Raw numeric value drives the count-up animation; `format` renders it.
    value: number;
    format?: (n: number) => string;
    color: { bg: string; border: string; text: string };
    route: Href;
  }> = [
    {
      icon: MapPin,
      label: t("dashboard.stat_addresses"),
      value: stats?.addressCount || 0,
      color: theme.colors.orange,
      route: "/(tabs)/addresses",
    },
    {
      icon: Zap,
      label: t("dashboard.stat_services"),
      value: stats?.serviceCount || 0,
      color: theme.colors.cyan,
      route: "/(tabs)/services",
    },
    {
      icon: DollarSign,
      label: t("dashboard.stat_monthly"),
      value: stats?.monthlyExpenses || 0,
      format: currencyFmt,
      color: theme.colors.emerald,
      route: "/(tabs)/services",
    },
  ];

  // Plan-aware header badge: Family = crystal green, Pro = premium gold, else generic Premium.
  const planBadge = (() => {
    const p = (planTier ?? "").toUpperCase();
    if (p === "FAMILY")
      return { label: t("dashboard.familyBadge", "Family"), fg: "#34D8A6", bg: "rgba(52,216,166,0.12)", border: "rgba(52,216,166,0.32)", glyph: "❖" };
    if (p === "PRO")
      return { label: t("dashboard.proBadge", "Pro"), fg: "#E9C46A", bg: "rgba(233,196,106,0.12)", border: "rgba(233,196,106,0.34)", glyph: "✦" };
    return { label: t("dashboard.premiumBadge"), fg: "#B49BFF", bg: "rgba(242,196,108,0.12)", border: "rgba(242,196,108,0.3)", glyph: "✦" };
  })();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{t("dashboard.welcome")}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={styles.title}>{t("tabs.dashboard")}</Text>
            {isPremium && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: planBadge.bg, borderWidth: 1, borderColor: planBadge.border }}>
                <Text style={{ fontSize: 10, color: planBadge.fg }}>{planBadge.glyph}</Text>
                <Text style={{ fontSize: 10, fontWeight: "700", color: planBadge.fg, letterSpacing: 0.3 }}>{planBadge.label}</Text>
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
        {/* Pending workspace invitations — rendered near the top, even if the
            rest of the dashboard payload failed, so the user can always act. */}
        {pendingInvites.map((invite) => {
          const busy = inviteBusyId === invite.id;
          const inviter = invite.inviterName?.trim() || null;
          const ws = invite.workspaceName?.trim() || null;
          const body =
            inviter && ws
              ? t("dashboard.inviteBody", { inviter, workspace: ws })
              : inviter
                ? t("dashboard.inviteBodyNoWorkspace", { inviter })
                : ws
                  ? t("dashboard.inviteBodyNoInviter", { workspace: ws })
                  : t("dashboard.inviteBodyGeneric");
          return (
            <Card key={invite.id} variant="glow" style={{ marginBottom: 16 }}>
              <View style={styles.inviteRow}>
                <View style={styles.inviteIcon}>
                  <Mail size={18} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inviteHeading}>{t("dashboard.inviteHeading")}</Text>
                  <Text style={styles.inviteBody} numberOfLines={3}>
                    {body}
                  </Text>
                </View>
              </View>
              <View style={styles.inviteActions}>
                <TouchableOpacity
                  style={[styles.inviteBtn, styles.inviteDeclineBtn, busy && styles.inviteBtnDisabled]}
                  onPress={() => handleDeclineInvite(invite)}
                  disabled={busy}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={t("dashboard.inviteDecline")}
                >
                  <Text style={styles.inviteDeclineText}>{t("dashboard.inviteDecline")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.inviteBtn, styles.inviteAcceptBtn, busy && styles.inviteBtnDisabled]}
                  onPress={() => handleAcceptInvite(invite)}
                  disabled={busy}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={t("dashboard.inviteAccept")}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color={theme.colors.background} />
                  ) : (
                    <Text style={styles.inviteAcceptText}>{t("dashboard.inviteAccept")}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </Card>
          );
        })}

        {/* Push re-prompt: dismissible card for users who never enabled push.
            Onboarding's soft-prompt only fires at completion, so this is the
            only nudge already-onboarded users get. */}
        {showPushPrompt === true && (
          <Card variant="default" style={{ marginBottom: 16 }}>
            <View style={styles.pushPromptRow}>
              <View style={styles.pushPromptIcon}>
                <BellRing size={18} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pushPromptTitle}>{t("dashboard.pushPromptTitle")}</Text>
                <Text style={styles.pushPromptBody} numberOfLines={3}>
                  {t("dashboard.pushPromptBody")}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleDismissPushPrompt}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={t("dashboard.pushPromptDismiss")}
              >
                <X size={18} color={theme.colors.textTertiary} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.pushPromptBtn, pushPromptBusy && styles.pushPromptBtnDisabled]}
              onPress={handleEnablePush}
              disabled={pushPromptBusy}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t("dashboard.pushPromptEnable")}
            >
              {pushPromptBusy ? (
                <ActivityIndicator size="small" color={theme.colors.background} />
              ) : (
                <Text style={styles.pushPromptBtnText}>{t("dashboard.pushPromptEnable")}</Text>
              )}
            </TouchableOpacity>
          </Card>
        )}

        {/* First-run AI move briefing — a subtle, dismissible welcome card.
            Rendered above the error gate so a returning user still sees it even
            if the core dashboard payload errored. Hidden entirely when the
            briefing feature is unconfigured server-side ({ configured:false }),
            on fetch failure, or once dismissed. */}
        {briefing && (
          <MoveBriefingCard
            briefing={briefing.briefing}
            aiGenerated={briefing.aiGenerated}
            onDismiss={handleDismissBriefing}
          />
        )}

        {error ? (
          <ErrorState title={t("dashboard.loadFailed")} message={error} onRetry={load} />
        ) : (
          <>
        {/* MOVE COMMAND CENTER — pinned hero: countdown + readiness + next
            action. Its no-plan state is the warm "start your move" hero, so it
            replaces the old cold empty path for users without an active move. */}
        <View style={{ marginBottom: 16 }}>
          <MoveCommandCenter
            activePlan={stats?.activePlan ?? null}
            checklist={checklist}
            topAction={topAction}
            missingCriticalCount={criticalReadiness.missing}
            completedCriticalCount={criticalReadiness.completed}
            state={primaryState}
            hasOriginDestination={hasOriginDestination}
            onOpenPlan={() => router.push("/(tabs)/moving")}
            onOpenAction={(action) => router.push(`/providers/${action.id}` as Href)}
            onStartMove={() => router.push("/moving/new")}
          />
        </View>

        {/* UP NEXT — the 2-3 nearest-due open tasks for the active plan, each
            with a one-tap inline checkbox that completes via the same
            PATCH /api/move-tasks { event: "COMPLETE" } the plan screen uses.
            Self-hides with no active plan / no open tasks. onCompleted refreshes
            the dashboard so the readiness ring bumps. */}
        <UpNext
          planId={stats?.activePlan?.id ?? null}
          locale={(i18n.language || "").toLowerCase().startsWith("es") ? "es-ES" : "en-US"}
          onViewAll={() => {
            const pid = stats?.activePlan?.id;
            if (pid) router.push(`/moving/${pid}` as Href);
            else router.push("/(tabs)/moving");
          }}
          onCompleted={async () => {
            await fetchDashboard();
          }}
        />

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
                <CountUp
                  value={card.value}
                  format={card.format}
                  style={[styles.statValue, { color: card.color.text }]}
                />
                <Text style={styles.statLabel}>{card.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Plan welcome hero — mascots + plan identity (Family/Pro only).
            celebrateTick fires a one-shot bounce when an invite is accepted. */}
        <PlanHero celebrateTick={celebrateTick} />

        {/* Savings / insights — computed client-side from tracked services.
            Self-hides when there are no active services to summarize. */}
        <SavingsInsightsCard services={services} />

        {/* Household / Workspace (Family & Pro) */}
        {workspace && (
          <Card
            variant="default"
            onPress={() => router.push("/settings/workspace")}
            style={{ marginTop: 20 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={styles.planIcon}>
                <Users size={18} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.planTitle}>{workspace.name}</Text>
                <Text style={styles.planDate}>
                  {workspace.planLabel} · {workspace.memberCount}/{workspace.seatLimit}{" "}
                  {t("workspace.membersShort", "members")}
                </Text>
              </View>
              <UiBadge
                label={
                  ({ OWNER: "Owner", ADMIN: "Admin", MEMBER: "Member", CHILD: "Child", VIEW_ONLY: "View only" } as Record<string, string>)[
                    workspace.role
                  ] ?? workspace.role
                }
                variant={workspace.role === "OWNER" ? "primary" : "neutral"}
              />
              <ArrowRight size={16} color={theme.colors.textTertiary} />
            </View>
          </Card>
        )}

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
          </>
        )}

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>{t("dashboard.quickActions")}</Text>
        <View style={styles.quickActions}>
          {([
            { label: t("addresses.newTitle"), icon: MapPin, route: "/addresses/new" as Href },
            { label: t("services.newTitle"), icon: Zap, route: "/services/new" as Href },
            { label: t("moving.newPlan"), icon: Truck, route: "/moving/new" as Href },
            { label: t("reminders.title", { defaultValue: "Reminders" }), icon: CalendarClock, route: "/reminders" as Href },
          ]).map((action) => {
            const Icon = action.icon;
            return (
              <TouchableOpacity
                key={action.label}
                style={styles.quickAction}
                onPress={() => {
                  // Light tactile confirmation on the primary "create" entry
                  // points. Best-effort + reduce-motion-safe (impact haptics
                  // are tactile, not visual motion); no-op on web.
                  hapticLight();
                  router.push(action.route);
                }}
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
    // A touch more depth on the dashboard's hero stat tiles so they lift
    // off the canvas as the primary surface. Subtle (sm) — not a drop card.
    ...theme.shadow.sm,
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
  inviteRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  inviteIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryFaded,
    alignItems: "center",
    justifyContent: "center",
  },
  inviteHeading: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.primary,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  inviteBody: { fontSize: 15, fontWeight: "600", color: theme.colors.text, marginTop: 2 },
  inviteActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  inviteBtn: {
    flex: 1,
    height: 42,
    borderRadius: theme.radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  inviteBtnDisabled: { opacity: 0.6 },
  inviteDeclineBtn: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  inviteDeclineText: { fontSize: 14, fontWeight: "600", color: theme.colors.textSecondary },
  inviteAcceptBtn: { backgroundColor: theme.colors.primary },
  inviteAcceptText: { fontSize: 14, fontWeight: "700", color: theme.colors.background },
  pushPromptRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  pushPromptIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryFaded,
    alignItems: "center",
    justifyContent: "center",
  },
  pushPromptTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.text },
  pushPromptBody: {
    fontSize: 13,
    color: theme.colors.textTertiary,
    marginTop: 4,
    lineHeight: 18,
  },
  pushPromptBtn: {
    height: 42,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  pushPromptBtnDisabled: { opacity: 0.6 },
  pushPromptBtnText: { fontSize: 14, fontWeight: "700", color: theme.colors.background },
});
