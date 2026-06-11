import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";
import {
  MapPin,
  Zap,
  DollarSign,
  Truck,
  ArrowRight,
  Bell,
  BellRing,
  Check,
  Rocket,
  Sparkles,
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
import {
  persistLastPlanHint,
  readLastPlanHint,
} from "@/lib/last-plan-cache";
import {
  buildAndPersistDashboardSnapshot,
  readDashboardSnapshot,
  snapshotRelativeAge,
  type DashboardSnapshot,
} from "@/lib/dashboard-snapshot";
import { Card } from "@/components/ui/Card";
import { OfflineChip } from "@/components/ui/OfflineChip";
import { MoveBriefingCard } from "@/components/ui/MoveBriefingCard";
import { PlanHero } from "@/components/ui/PlanHero";
import { MoveCommandCenter, type CommandCenterAction } from "@/components/ui/MoveCommandCenter";
import { FreeMoveUpsellCard } from "@/components/ui/FreeMoveUpsellCard";
import { UpNext } from "@/components/ui/UpNext";
import { SavingsInsightsCard } from "@/components/ui/SavingsInsightsCard";
import { computeSavingsInsights, type ServiceLike } from "@/lib/service-insights";
import { getCategoryIcon, getMergedDisplayCategoryIcon } from "@/lib/recommendation-engine";
import { Badge as UiBadge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonBlock, SkeletonCard, SkeletonStatGrid } from "@/components/ui/Skeleton";
import { CountUp } from "@/components/ui/CountUp";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { formatCurrency } from "@/lib/format";
import type { DashboardStats } from "@locateflow/shared";
import {
  generateChecklist,
  getMoveCountdown,
  formatDateOnlyUtc,
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

// ──────────────────────────────────────────────────────────────────────
// Aurora "card module" helpers (Edition VII home regroup)
// ──────────────────────────────────────────────────────────────────────

// Cold-start momentum floor (%) — identical to MoveCommandCenter's. Having an
// active plan WITH origin + destination set is real, user-completed setup, so
// the hero ring starts at a low non-zero instead of a demotivating 0%.
const COLD_START_FLOOR = 6;

/**
 * Readiness blend — mirrors MoveCommandCenter.computeReadiness exactly so the
 * Aurora hero ring shows the same number the command center showed: checklist
 * %-done blended with critical-providers set-up-vs-needed, floored only when
 * origin + destination are genuinely set. Kept in lockstep manually (the
 * command-center copy is module-private).
 */
function computeReadiness(
  checklist: RelocationChecklist | null,
  completedCritical: number,
  missingCritical: number,
  hasOriginDestination = false,
): number {
  const signals: number[] = [];
  if (checklist && checklist.totalItems > 0) {
    signals.push(checklist.completedItems / checklist.totalItems);
  }
  const criticalTotal = completedCritical + missingCritical;
  if (criticalTotal > 0) {
    signals.push(completedCritical / criticalTotal);
  }
  const computed =
    signals.length === 0
      ? 0
      : Math.round((signals.reduce((a, b) => a + b, 0) / signals.length) * 100);
  const floored = hasOriginDestination ? Math.max(computed, COLD_START_FLOOR) : computed;
  return Math.max(0, Math.min(100, floored));
}

const AnimatedRingCircle = Animated.createAnimatedComponent(Circle);

/**
 * Big Aurora hero ring — same animated-dasharray pattern as the command
 * center's ReadinessRing (sweeps when percent changes; snaps under
 * reduce-motion), sized up for the hero module per the Edition VII design.
 */
function AuroraHeroRing({
  percent,
  color,
  track,
  label,
  size = 96,
}: {
  percent: number;
  color: string;
  track: string;
  label: string;
  size?: number;
}) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const reduceMotion = useReducedMotion();

  const clamped = Math.max(0, Math.min(100, percent));
  const progress = useSharedValue(clamped / 100);

  useEffect(() => {
    const target = clamped / 100;
    if (reduceMotion) {
      progress.value = target;
      return;
    }
    progress.value = withTiming(target, {
      duration: 650,
      easing: Easing.out(Easing.cubic),
    });
    return () => cancelAnimation(progress);
  }, [clamped, reduceMotion, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDasharray: `${progress.value * c}, ${c}`,
  }));

  return (
    <View
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
      accessibilityLabel={label}
    >
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <AnimatedRingCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          animatedProps={animatedProps}
        />
      </Svg>
      <Text style={{ fontSize: 21, fontWeight: "800", color }}>{percent}%</Text>
    </View>
  );
}

/**
 * NEUTRAL hero placeholder shown while the entitlement is still resolving and we
 * have no active plan to paint. Tier-agnostic on purpose: it must NOT hint FREE
 * or PRO (that swap-after-reveal IS the flash we're killing). Just a calm,
 * card-shaped block matching the hero footprint. Reduce-motion is honoured by the
 * shared SkeletonBlock shimmer.
 */
function HeroSkeleton({ theme }: { theme: Theme }) {
  return (
    <View
      style={{
        marginBottom: 16,
        borderRadius: theme.radius.xl,
        padding: theme.spacing.lg,
        backgroundColor: theme.colors.card,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel=""
      importantForAccessibility="no-hide-descendants"
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <SkeletonBlock width={110} height={11} />
        <SkeletonBlock width={92} height={22} radius={theme.radius.full} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 20 }}>
        <SkeletonBlock width={96} height={96} radius={48} />
        <View style={{ flex: 1 }}>
          <SkeletonBlock width="55%" height={28} />
          <SkeletonBlock width="40%" height={11} style={{ marginTop: 10 }} />
        </View>
      </View>
      <SkeletonBlock width="70%" height={12} style={{ marginTop: 20 }} />
    </View>
  );
}

/**
 * Tone bucket for a service category — theme tone objects only (bg/border/
 * text), so the Connected Utilities tiles stay token-pure across plan accents
 * and light/dark.
 */
function serviceTone(category: string | null | undefined, theme: Theme) {
  const key = (category || "OTHER").split("_")[0].toUpperCase();
  switch (key) {
    case "UTILITY":
    case "FITNESS":
      return theme.colors.amber;
    case "FINANCIAL":
      return theme.colors.emerald;
    case "HOUSING":
      return theme.colors.sky;
    case "GOVERNMENT":
    case "HEALTHCARE":
    case "SHOPPING":
      return theme.colors.rose;
    case "TRANSPORTATION":
      return theme.colors.cyan;
    default:
      return theme.colors.orange;
  }
}

/** Emoji key for CategoryIcon (resolved to a Lucide glyph via lib/icon-map) —
 *  mirrors the services screen's fallback chain. */
function serviceCategoryEmoji(category: string | null | undefined): string {
  const key = category || "OTHER";
  return getMergedDisplayCategoryIcon(key) || getCategoryIcon(key);
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
  // Whether the LIVE entitlement has resolved at least once this mount. Until it
  // does we render a NEUTRAL hero skeleton instead of guessing FREE vs PRO — this
  // is what kills the launch flash (FREE upsell card → Pro layout swap). The
  // cached hint below seeds isPremium/planTier toward the likely-correct layout,
  // but the skeleton still owns the hero until the live entitlement is authoritative.
  const [entitlementResolved, setEntitlementResolved] = useState(false);
  // Mirror of entitlementResolved readable synchronously inside the cache-hint
  // seed effect, so a hint read that finishes AFTER the live entitlement resolved
  // never clobbers the authoritative isPremium/planTier with a stale guess.
  const entitlementResolvedRef = useRef(false);
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
  // OFFLINE COLD-START: the last-known snapshot we hydrated the screen from, plus
  // a flag set when the live fetch fails so we keep showing the hydrated data
  // (instead of the error wall) under an "Offline · last updated …" chip. The
  // snapshot is set the moment we hydrate; `offline` only flips true if the live
  // reconcile fails AND we have something hydrated to keep showing.
  const [offline, setOffline] = useState(false);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  // Mirror of `snapshot` in a ref so fetchDashboard's error branch can decide
  // "offline (keep last-known)" vs "hard error wall" without a stale closure.
  const snapshotRef = useRef<DashboardSnapshot | null>(null);
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);
  // Budget/savings rollup for the Budget Tracker module — derived from the
  // same services list SavingsInsightsCard consumes (no extra fetch).
  const insights = useMemo(() => computeSavingsInsights(services), [services]);
  // Utility quick-look sheet: the tapped service from the Connected Utilities
  // module (null = closed). Purely presentational over already-fetched data.
  const [utilSheet, setUtilSheet] = useState<ServiceLike | null>(null);
  const reduceMotion = useReducedMotion();
  // One-shot latch for the milestone celebration haptic (parity with the old
  // MoveCommandCenter hero, which latched its pop+haptic per mount).
  const celebratedRef = useRef(false);

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
      // OFFLINE FALLBACK: the live fetch failed (no signal mid-move). If we have a
      // hydrated last-known snapshot on screen, KEEP it and switch to the quiet
      // "Offline · last updated …" chip instead of blanking to the error wall.
      // Only show the hard error when there's nothing useful to fall back to.
      if (snapshotRef.current) {
        setOffline(true);
        setError(null);
      } else {
        setOffline(false);
        setError(t("dashboard.loadFailed"));
      }
      return false;
    }
    if (res.data) {
      // Live data landed → we're back online; drop any offline/error state.
      setError(null);
      setOffline(false);
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
      // The LIVE entitlement is now authoritative: stop showing the neutral hero
      // skeleton and let the resolved isPremium/activePlan branch decide which
      // hero to paint. This is the override the cached hint defers to.
      entitlementResolvedRef.current = true;
      setEntitlementResolved(true);
      // Persist the resolved entitlement as a HINT for the next cold start so a
      // returning Pro user seeds the correct layout instead of flashing the FREE
      // upsell. Best-effort + fire-and-forget — never blocks or throws.
      void persistLastPlanHint({ premium: !!hasPremium, planTier: planValue });
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
          const primaryState =
            addresses.find((a: any) => a.isPrimary)?.state || addresses[0]?.state || null;
          await computeAndPersistWidgetSnapshot({
            moveDate: activePlan?.moveDate ?? null,
            state: primaryState,
            tasks: openTasks,
            checklist: widgetChecklist,
            completedCritical: widgetCompletedCritical,
            missingCritical: widgetMissingCritical,
          });

          // OFFLINE COLD-START SNAPSHOT — additive, best-effort, NEVER blocking.
          // Persist a compact echo of everything the dashboard just rendered so a
          // no-signal cold start can hydrate the screen instead of a blank wall.
          // Built from the SAME readiness blend the command center/widget use so
          // the hydrated number agrees with the live UI.
          const readinessSignals: number[] = [];
          if (widgetChecklist && widgetChecklist.totalItems > 0) {
            readinessSignals.push(widgetChecklist.completedItems / widgetChecklist.totalItems);
          }
          const criticalTotal = widgetCompletedCritical + widgetMissingCritical;
          if (criticalTotal > 0) readinessSignals.push(widgetCompletedCritical / criticalTotal);
          const readinessPercent =
            readinessSignals.length > 0
              ? Math.round((readinessSignals.reduce((a, b) => a + b, 0) / readinessSignals.length) * 100)
              : 0;
          // Nearest-due OPEN tasks, sorted the same way UpNext sorts them.
          const OPEN = new Set(["SUGGESTED", "ACCEPTED", "IN_PROGRESS", "REOPENED"]);
          const snapTasks = openTasks
            .filter((tk) => OPEN.has(tk.status) && typeof tk.title === "string" && tk.title.trim())
            .sort((a, b) => {
              const at = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
              const bt = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
              const av = Number.isNaN(at) ? Number.POSITIVE_INFINITY : at;
              const bv = Number.isNaN(bt) ? Number.POSITIVE_INFINITY : bt;
              if (av !== bv) return av - bv;
              return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
            })
            .map((tk) => {
              let due: string | null = null;
              if (tk.dueDate) {
                const d = new Date(tk.dueDate);
                if (!Number.isNaN(d.getTime())) {
                  due = d.toLocaleDateString(i18n.language || "en", { month: "short", day: "numeric" });
                }
              }
              return { title: tk.title, due };
            });
          // Primary saved addresses (nickname/city/state chips only — no street).
          const snapAddresses = addresses
            .filter((a: any) => a.isPrimary)
            .concat(addresses.filter((a: any) => !a.isPrimary))
            .map((a: any) => ({ nickname: a.nickname ?? null, city: a.city ?? null, state: a.state ?? null }));
          // Saved providers the dashboard already shows: name + phone the user
          // entered on their own tracked services. No data the user can't see.
          const snapProviders = addresses
            .flatMap((a: any) => (Array.isArray(a.services) ? a.services : []))
            .map((sv: any) => ({ name: sv?.providerName ?? null, phone: sv?.phone ?? null }))
            .filter((p: { name: string | null }) => p.name);
          await buildAndPersistDashboardSnapshot({
            firstName: profileData?.firstName ?? profileData?.name ?? null,
            moveDate: activePlan?.moveDate ?? null,
            state: primaryState,
            route: activePlan
              ? { from: activePlan.fromAddress?.city ?? null, to: activePlan.toAddress?.city ?? null }
              : null,
            tasks: snapTasks,
            readinessPercent,
            addresses: snapAddresses,
            providers: snapProviders,
            budget: { monthlyExpenses, serviceCount: totalServices },
          });
        } catch {
          /* non-blocking: the widget + offline snapshots are purely additive */
        }
      })();
    }
    return true;
  }, [t, i18n.language]);

  // HYDRATE FROM SNAPSHOT — paint the dashboard's visible state from the
  // last-known offline snapshot so a no-signal cold start shows real info
  // instantly instead of a blank wall. Best-effort + idempotent: it only fills
  // state and is always immediately reconciled (overwritten) by the live fetch.
  const hydrateFromSnapshot = useCallback(async (): Promise<boolean> => {
    try {
      const snap = await readDashboardSnapshot();
      if (!snap) return false;
      // Set the ref synchronously too so the live fetch's error branch can see it
      // immediately (the state→ref mirror effect hasn't flushed yet at this point).
      snapshotRef.current = snap;
      setSnapshot(snap);
      // Reconstruct the `stats` shape the UI reads. We carry only what the
      // snapshot has; the live fetch will replace this wholesale momentarily.
      const hasRoute = !!(snap.route && (snap.route.from || snap.route.to));
      setStats({
        addressCount: snap.addresses.length,
        serviceCount: snap.budget?.serviceCount ?? 0,
        monthlyExpenses: snap.budget?.monthlyExpenses ?? 0,
        activePlan:
          snap.moveDate && hasRoute
            ? {
                // No real plan id offline → empty string; UpNext keys off this and
                // self-hides (it never fetches with an empty id), and the plan card
                // tap routes to the moving tab fallback.
                id: "",
                fromCity: snap.route?.from || "—",
                toCity: snap.route?.to || "—",
                moveDate: snap.moveDate,
                status: "PLANNING",
              }
            : null,
      });
      setPrimaryState(
        snap.addresses.find((a) => a.state)?.state ?? snap.addresses[0]?.state ?? null,
      );
      setHasOriginDestination(hasRoute);
      // Map the snapshot's readiness % back into the same critical-count shape the
      // command center's readiness formula consumes, so the hydrated ring matches
      // exactly (completed/(completed+missing) === readiness/100).
      setCriticalReadiness({ completed: snap.readinessPercent, missing: 100 - snap.readinessPercent });
      return true;
    } catch {
      return false;
    }
  }, []);

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

  // Mount: seed the plan hint from the last-known cache BEFORE the entitlement
  // resolves, so a returning Pro user leans into the correct (Pro) hero instead
  // of flashing the FREE upsell. The hint is purely a HINT — the live fetch's
  // setEntitlementResolved(true) + setIsPremium(...) override it authoritatively.
  // Until the live entitlement resolves, the hero renders a neutral skeleton
  // (see the hero gate below), never a tier-specific card.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const hint = await readLastPlanHint();
      if (cancelled) return;
      // If the live entitlement already resolved while we were reading the cache,
      // it's authoritative — don't let a stale hint clobber it.
      if (hint && !entitlementResolvedRef.current) {
        // Seed toward the cached layout. Still gated by entitlementResolved so we
        // never commit to FreeMoveUpsellCard on a stale hint; a premium hint only
        // biases the eventual reveal, the skeleton holds until the live resolve.
        setIsPremium(hint.premium);
        setPlanTier(hint.planTier);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Mount: hydrate from the snapshot FIRST (instant paint), THEN kick off the
  // live fetch which reconciles + overwrites + re-persists. The hydrate is
  // awaited so the live fetch's error branch can already see the snapshot ref.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await hydrateFromSnapshot();
      if (cancelled) return;
      await load();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // MILESTONE CELEBRATION — parity with the old MoveCommandCenter hero: one
  // success haptic when readiness hits 100% or move day arrives. Latched per
  // mount so it never re-fires; skipped under reduce-motion (the old component
  // gated its celebration pop + haptic together the same way).
  useEffect(() => {
    const plan = stats?.activePlan;
    if (!plan || celebratedRef.current || reduceMotion) return;
    const cd = getMoveCountdown(plan.moveDate, { state: primaryState });
    const readiness = computeReadiness(
      checklist,
      criticalReadiness.completed,
      criticalReadiness.missing,
      hasOriginDestination,
    );
    if (readiness >= 100 || cd.phase !== "upcoming") {
      celebratedRef.current = true;
      hapticSuccess();
    }
  }, [stats, checklist, criticalReadiness, hasOriginDestination, primaryState, reduceMotion]);

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

  // Only show the skeleton wall on a TRUE cold start — i.e. we're loading AND
  // have no hydrated snapshot to paint. When a snapshot hydrated, we skip the
  // skeleton entirely and render the (stale-but-real) dashboard while the live
  // fetch reconciles in the background.
  if (loading && !snapshot) {
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
      return { label: t("dashboard.familyBadge", "Family"), fg: "#4FD1B5", bg: "rgba(79,209,181,0.12)", border: "rgba(79,209,181,0.32)", glyph: "❖" };
    if (p === "PRO")
      return { label: t("dashboard.proBadge", "Pro"), fg: "#F2C46C", bg: "rgba(242,196,108,0.12)", border: "rgba(242,196,108,0.34)", glyph: "✦" };
    return { label: t("dashboard.premiumBadge"), fg: "#F2C46C", bg: "rgba(242,196,108,0.12)", border: "rgba(242,196,108,0.3)", glyph: "✦" };
  })();

  // HERO derivations — same data sources + readiness blend the old command
  // center used; only the presentation is regrouped into the Aurora hero card.
  const heroPlan = stats?.activePlan ?? null;
  const heroCountdown = heroPlan ? getMoveCountdown(heroPlan.moveDate, { state: primaryState }) : null;
  const heroReadiness = heroPlan
    ? computeReadiness(checklist, criticalReadiness.completed, criticalReadiness.missing, hasOriginDestination)
    : 0;
  const heroDateLabel = heroPlan ? formatDateOnlyUtc(heroPlan.moveDate) : "";
  const heroBadgeLabel =
    heroPlan?.status === "IN_PROGRESS"
      ? t("dashboard.heroBadge_inProgress")
      : t("dashboard.heroBadge_planning");

  // DUO derivations — both modules render the services list this screen
  // already fetches (no new API calls). Active services first, biggest spend
  // first, capped at three compact rows.
  const duoServices = [...services]
    .sort((a, b) => {
      const aInactive = a.isActive === false ? 1 : 0;
      const bInactive = b.isActive === false ? 1 : 0;
      if (aInactive !== bInactive) return aInactive - bInactive;
      return (b.monthlyCost || 0) - (a.monthlyCost || 0);
    })
    .slice(0, 3);
  const budgetSegs = insights.byCategory.filter((c) => c.total > 0).slice(0, 3);
  const budgetSegTones = [theme.colors.amber, theme.colors.emerald, theme.colors.sky];
  const budgetRest = Math.max(
    0,
    insights.totalMonthly - budgetSegs.reduce((sum, c) => sum + c.total, 0),
  );
  const categoryLabel = (category?: string | null) => {
    const key = (category || "OTHER").toUpperCase();
    return t(`categories.${key}`, { defaultValue: key.replace(/_/g, " ") });
  };

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
        {/* OFFLINE CHIP — shown when the live fetch failed but we hydrated the
            last-known snapshot. Replaces the error wall with the stale-but-real
            dashboard under an honest "Offline · last updated …" marker. */}
        {offline && snapshot && (
          <OfflineChip
            relativeAge={snapshotRelativeAge(
              snapshot,
              (i18n.language || "en").toLowerCase().startsWith("es") ? "es-ES" : "en-US",
            )}
          />
        )}

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
        {/* MOVE HERO — branches on entitlement (freemium re-architecture):
            • FREE with no plan → the value-first upsell card. The moving plan is
              a paid unlock, so a free user never sees the "Start a move" CTA that
              would 403 on /api/moving — they get an honest free-vs-paid card that
              routes to the subscription page (where, after upgrading, the normal
              plan-creation flow becomes available).
            • PAID with no plan → the command center's warm "start your move"
              raccoon hero, unchanged.
            • ACTIVE PLAN → the Aurora hero module (Edition VII): move-status
              badge + big readiness ring + days-left numeral, carrying the same
              next-critical-action and view-plan navigation the command center
              provided.

            FLASH GUARD: when there's no active plan to paint AND the live
            entitlement hasn't resolved yet, render a NEUTRAL skeleton — never the
            FREE upsell or the paid start-hero. Committing to a tier-specific card
            before we KNOW the tier is exactly the launch flash this fixes ("önce
            unlock çıkıyor, sonra Pro olduğunu fark edip" → FREE→PRO swap). An
            active plan IS real data, so that path skips the skeleton and paints
            the Aurora hero immediately even mid-resolve. Offline (live fetch gave
            up, showing last-known) also exits the skeleton so it never spins. */}
        {!heroPlan && !offline && !entitlementResolved ? (
          <HeroSkeleton theme={theme} />
        ) : !isPremium && !stats?.activePlan ? (
          <View style={{ marginBottom: 16 }}>
            <FreeMoveUpsellCard onUnlock={() => router.push("/settings/subscription")} />
          </View>
        ) : !heroPlan ? (
          <View style={{ marginBottom: 16 }}>
            <MoveCommandCenter
              activePlan={null}
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
        ) : (
          <View style={styles.heroCard} accessibilityRole="summary">
            <LinearGradient
              colors={[`${theme.colors.primary}26`, `${theme.colors.primary}00`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1.1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.heroTop}>
              <Text style={styles.heroKicker}>{t("dashboard.heroKicker").toUpperCase()}</Text>
              <LinearGradient
                colors={[theme.colors.success, theme.colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroBadge}
              >
                <Text style={styles.heroBadgeText}>{heroBadgeLabel}</Text>
              </LinearGradient>
            </View>
            <View style={styles.heroMid}>
              <AuroraHeroRing
                percent={heroReadiness}
                color={theme.colors.primary}
                track={`${theme.colors.text}1A`}
                label={t("dashboard.commandCenter_readinessLabel", { percent: heroReadiness })}
              />
              {heroCountdown?.phase === "today" ? (
                <Text style={styles.heroMovingDay}>{t("dashboard.commandCenter_movingDay")}</Text>
              ) : (
                <View>
                  <Text style={styles.heroDaysNum}>{heroCountdown?.absDays ?? 0}</Text>
                  <Text style={styles.heroDaysLbl}>
                    {(heroCountdown?.phase === "past"
                      ? t("dashboard.heroDaysAgo")
                      : t("dashboard.heroDaysLeft")
                    ).toUpperCase()}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.heroGhostBtn}
                onPress={() => {
                  hapticLight();
                  router.push("/(tabs)/moving");
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={t("dashboard.commandCenter_viewPlan")}
              >
                <Text style={styles.heroGhostText}>{t("dashboard.commandCenter_viewPlan")}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.heroRoute} numberOfLines={1}>
              {heroPlan.fromCity} → {heroPlan.toCity}
              {heroDateLabel ? ` · ${heroDateLabel}` : ""}
            </Text>

            {/* Single Next Critical Action CTA (or "all set") — same behavior
                the command center carried. */}
            {topAction ? (
              <TouchableOpacity
                style={styles.heroActionRow}
                onPress={() => {
                  hapticLight();
                  router.push(`/providers/${topAction.id}` as Href);
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={topAction.name}
              >
                <View style={styles.heroActionIcon}>
                  <Sparkles size={16} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroActionEyebrow}>
                    {t("dashboard.commandCenter_nextAction").toUpperCase()}
                  </Text>
                  <Text style={styles.heroActionName} numberOfLines={1}>
                    {topAction.name}
                  </Text>
                  {(topAction.deadline || topAction.reason) && (
                    <Text style={styles.heroActionSub} numberOfLines={1}>
                      {topAction.deadline ? `${topAction.deadline} · ` : ""}
                      {topAction.reason || (topAction.category || "").replace(/_/g, " ")}
                    </Text>
                  )}
                </View>
                <ArrowRight size={16} color={theme.colors.primary} />
              </TouchableOpacity>
            ) : heroReadiness >= 100 ? (
              <View style={[styles.heroActionRow, styles.heroAllSet]}>
                <Rocket size={16} color={theme.colors.success} />
                <Text style={styles.heroAllSetText}>{t("dashboard.commandCenter_allSet")}</Text>
              </View>
            ) : null}

            <Text style={styles.heroFoot}>
              {checklist
                ? t("dashboard.commandCenter_readinessDetail", {
                    done: checklist.completedItems,
                    total: checklist.totalItems,
                  })
                : criticalReadiness.missing > 0
                  ? t("dashboard.commandCenter_readinessProviders", {
                      count: criticalReadiness.missing,
                    })
                  : t("dashboard.commandCenter_readiness")}
            </Text>
          </View>
        )}

        {/* MOVING CHECKLIST MODULE — the relocation checklist reframed as one
            bordered Aurora card module with colored status dots (overdue /
            up-next / done). Same data + the same next-action navigation as
            before; moved up under the hero per the Edition VII grouping. */}
        {checklist && (() => {
          const phaseInfo = RELOCATION_PHASES.find((p) => p.phase === checklist.currentPhase);
          return (
            <View style={styles.groupCard}>
              <Text style={styles.groupKicker}>{t("dashboard.checklistKicker").toUpperCase()}</Text>
              <View style={styles.groupHeadRow}>
                <CategoryIcon emoji={phaseInfo?.icon || ""} size={18} color={theme.colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.groupTitle}>{t("moving.checklist")}</Text>
                  <Text style={styles.groupSub}>
                    {checklist.currentPhase + 1}: {phaseInfo?.label || ""}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.groupPct}>{checklist.progressPercent}%</Text>
                  <Text style={styles.groupCount}>
                    {checklist.completedItems}/{checklist.totalItems}
                  </Text>
                </View>
              </View>

              <View style={styles.groupBarTrack}>
                <View style={[styles.groupBarFill, { width: `${checklist.progressPercent}%` }]} />
              </View>

              {checklist.overdueItems.length > 0 && (
                <View style={styles.ckRow}>
                  <View style={[styles.ckDot, { borderColor: theme.colors.error }]} />
                  <Text style={[styles.ckRowText, { color: theme.colors.error }]} numberOfLines={2}>
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
                  style={styles.ckRow}
                  onPress={() => router.push("/(tabs)/services" as any)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={checklist.nextAction.title}
                >
                  <View style={[styles.ckDot, { borderColor: theme.colors.warning }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ckRowTitle} numberOfLines={1}>{checklist.nextAction.title}</Text>
                    {checklist.nextAction.stateNote ? (
                      <Text style={styles.ckRowNote} numberOfLines={2}>{checklist.nextAction.stateNote}</Text>
                    ) : null}
                    {checklist.nextAction.estimatedMinutes ? (
                      <Text style={styles.ckRowMeta}>~{checklist.nextAction.estimatedMinutes} min</Text>
                    ) : null}
                  </View>
                  <ArrowRight size={14} color={theme.colors.primary} />
                </TouchableOpacity>
              )}

              {checklist.completedItems > 0 && (
                <View style={styles.ckRow}>
                  <View style={[styles.ckDot, styles.ckDotDone]}>
                    <Check size={11} color={theme.colors.background} />
                  </View>
                  <Text style={[styles.ckRowText, { color: theme.colors.success }]}>
                    {t("dashboard.commandCenter_readinessDetail", {
                      done: checklist.completedItems,
                      total: checklist.totalItems,
                    })}
                  </Text>
                </View>
              )}
            </View>
          );
        })()}

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

        {/* CONNECTED UTILITIES + BUDGET TRACKER — the Edition VII paired duo of
            compact card modules, rendered entirely from the services list this
            screen already fetched. Utilities rows open the quick-look sheet;
            both modules deep-link into the Services tab. */}
        {services.length > 0 && (
          <View style={styles.duoRow}>
            <TouchableOpacity
              style={[styles.groupCard, styles.duoCard]}
              onPress={() => router.push("/(tabs)/services")}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t("dashboard.utilitiesKicker")}
            >
              <Text style={styles.groupKicker}>{t("dashboard.utilitiesKicker").toUpperCase()}</Text>
              {duoServices.map((svc) => {
                const tone = serviceTone(svc.category, theme);
                const active = svc.isActive !== false;
                return (
                  <TouchableOpacity
                    key={svc.id}
                    style={styles.utilRow}
                    onPress={() => {
                      hapticLight();
                      setUtilSheet(svc);
                    }}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={svc.providerName || categoryLabel(svc.category)}
                  >
                    <View style={[styles.utilIcon, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                      <CategoryIcon emoji={serviceCategoryEmoji(svc.category)} size={14} color={tone.text} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.utilName} numberOfLines={1}>
                        {svc.providerName || categoryLabel(svc.category)}
                      </Text>
                      <Text style={styles.utilSub} numberOfLines={1}>
                        {active ? t("services.statusActive") : t("services.statusInactive")}
                      </Text>
                    </View>
                    <View style={[styles.utilDot, active && styles.utilDotOn]} />
                  </TouchableOpacity>
                );
              })}
              {services.length > duoServices.length && (
                <Text style={styles.utilMore}>
                  {t("dashboard.utilitiesMore", { count: services.length - duoServices.length })}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.groupCard, styles.duoCard]}
              onPress={() => router.push("/(tabs)/services")}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t("dashboard.budgetKicker")}
            >
              <Text style={styles.groupKicker}>{t("dashboard.budgetKicker").toUpperCase()}</Text>
              <Text style={styles.budgetNum}>
                {currencyFmt(insights.totalMonthly)}
                <Text style={styles.budgetNumUnit}> {t("dashboard.budgetPerMonth")}</Text>
              </Text>
              {insights.totalMonthly > 0 ? (
                <>
                  <View style={styles.budgetBar}>
                    {budgetSegs.map((c, i) => (
                      <View
                        key={c.category}
                        style={[styles.budgetSeg, { flex: c.total, backgroundColor: budgetSegTones[i].text }]}
                      />
                    ))}
                    {budgetRest > 0 && (
                      <View style={[styles.budgetSeg, { flex: budgetRest, backgroundColor: theme.colors.border }]} />
                    )}
                  </View>
                  <View style={styles.budgetTiles}>
                    {budgetSegs.map((c, i) => (
                      <View
                        key={c.category}
                        style={[
                          styles.budgetTile,
                          { backgroundColor: budgetSegTones[i].bg, borderColor: budgetSegTones[i].border },
                        ]}
                      >
                        <View style={[styles.budgetSwatch, { backgroundColor: budgetSegTones[i].text }]} />
                        <Text style={styles.budgetTileLbl} numberOfLines={1}>
                          {categoryLabel(c.category)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : insights.missingCostCount > 0 ? (
                <Text style={styles.budgetMeta} numberOfLines={2}>
                  {t("services.missingCostHint", { count: insights.missingCostCount })}
                </Text>
              ) : null}
            </TouchableOpacity>
          </View>
        )}

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

      {/* UTILITY QUICK-LOOK SHEET — bottom sheet over the tapped Connected
          Utilities row. Purely presentational (data already on screen);
          "Manage service" deep-links to the existing service detail route. */}
      {utilSheet && (() => {
        const tone = serviceTone(utilSheet.category, theme);
        const active = utilSheet.isActive !== false;
        const catLabel = categoryLabel(utilSheet.category);
        const place = utilSheet.address?.nickname || utilSheet.address?.city || null;
        return (
          <Modal
            transparent
            visible
            animationType={reduceMotion ? "none" : "slide"}
            onRequestClose={() => setUtilSheet(null)}
          >
            <Pressable
              style={styles.sheetScrim}
              onPress={() => setUtilSheet(null)}
              accessibilityRole="button"
              accessibilityLabel={t("common.close")}
            >
              <Pressable style={styles.sheet} onPress={() => {}}>
                <View style={styles.sheetHead}>
                  <View style={[styles.utilIcon, styles.sheetIcon, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                    <CategoryIcon emoji={serviceCategoryEmoji(utilSheet.category)} size={16} color={tone.text} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.sheetTitle} numberOfLines={1}>
                      {utilSheet.providerName || catLabel}
                    </Text>
                    <Text style={styles.sheetSub} numberOfLines={1}>
                      {catLabel}
                      {place ? ` · ${place}` : ""}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.sheetClose}
                    onPress={() => setUtilSheet(null)}
                    accessibilityRole="button"
                    accessibilityLabel={t("common.close")}
                  >
                    <X size={14} color={theme.colors.textTertiary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.sheetStats}>
                  <View style={styles.sheetStat}>
                    <Text style={styles.sheetStatK}>{t("services.monthlyCost").toUpperCase()}</Text>
                    <Text style={styles.sheetStatV}>
                      {typeof utilSheet.monthlyCost === "number" && utilSheet.monthlyCost > 0
                        ? currencyFmt(utilSheet.monthlyCost)
                        : "—"}
                    </Text>
                  </View>
                  <View style={styles.sheetStat}>
                    <Text style={styles.sheetStatK}>{t("services.category").toUpperCase()}</Text>
                    <Text style={styles.sheetStatV} numberOfLines={1}>{catLabel}</Text>
                  </View>
                  <View style={styles.sheetStat}>
                    <Text style={styles.sheetStatK}>{t("dashboard.utilityStatus").toUpperCase()}</Text>
                    <Text
                      style={[
                        styles.sheetStatV,
                        { color: active ? theme.colors.success : theme.colors.textTertiary },
                      ]}
                      numberOfLines={1}
                    >
                      {active ? t("services.statusActive") : t("services.statusInactive")}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.sheetCta}
                  onPress={() => {
                    const id = utilSheet.id;
                    setUtilSheet(null);
                    router.push(`/services/${id}` as Href);
                  }}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={t("dashboard.manageService")}
                >
                  <Text style={styles.sheetCtaText}>{t("dashboard.manageService")}</Text>
                </TouchableOpacity>
              </Pressable>
            </Pressable>
          </Modal>
        );
      })()}
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

  // ── Aurora hero module (Edition VII) ──
  heroCard: {
    marginBottom: 16,
    padding: 18,
    borderRadius: theme.radius["2xl"],
    overflow: "hidden",
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: `${theme.colors.primary}3D`,
    ...theme.shadow.glow,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  heroKicker: {
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: "700",
    color: theme.colors.textTertiary,
  },
  heroBadge: {
    borderRadius: 999,
    height: 26,
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadow.glow,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
    color: theme.colors.background,
  },
  heroMid: { flexDirection: "row", alignItems: "center", gap: 16 },
  heroDaysNum: {
    fontSize: 38,
    fontWeight: "800",
    letterSpacing: -1,
    lineHeight: 42,
    color: theme.colors.text,
  },
  heroDaysLbl: {
    fontSize: 9,
    letterSpacing: 1.2,
    fontWeight: "700",
    color: theme.colors.textTertiary,
    marginTop: 4,
  },
  heroMovingDay: {
    flex: 1,
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: theme.colors.text,
  },
  heroGhostBtn: {
    marginLeft: "auto",
    height: 40,
    paddingHorizontal: 14,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  heroGhostText: { fontSize: 12.5, fontWeight: "700", color: theme.colors.text },
  heroRoute: { fontSize: 12.5, color: theme.colors.textSecondary, marginTop: 12 },
  heroActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
    padding: 12,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.glass.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  heroActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: theme.colors.primaryFaded,
    alignItems: "center",
    justifyContent: "center",
  },
  heroActionEyebrow: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 1,
    color: theme.colors.primary,
  },
  heroActionName: { fontSize: 14, fontWeight: "700", color: theme.colors.text, marginTop: 1 },
  heroActionSub: { fontSize: 11, color: theme.colors.textTertiary, marginTop: 1 },
  heroAllSet: {
    backgroundColor: theme.colors.successFaded,
    borderColor: `${theme.colors.success}3D`,
  },
  heroAllSetText: { fontSize: 14, fontWeight: "700", color: theme.colors.success },
  heroFoot: { fontSize: 11, color: theme.colors.textMuted, marginTop: 10, textAlign: "right" },

  // ── Aurora group card module (checklist / utilities / budget) ──
  groupCard: {
    padding: 15,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.glass.bg,
    borderWidth: 1,
    borderColor: theme.colors.glass.border,
    marginBottom: 16,
  },
  groupKicker: {
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: "700",
    color: theme.colors.textTertiary,
  },
  groupHeadRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  groupTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.text },
  groupSub: { fontSize: 11, color: theme.colors.textTertiary, marginTop: 1 },
  groupPct: { fontSize: 18, fontWeight: "800", color: theme.colors.text },
  groupCount: { fontSize: 10, color: theme.colors.textMuted },
  groupBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.glass.highlight,
    marginTop: 12,
    marginBottom: 4,
    overflow: "hidden",
  },
  groupBarFill: { height: "100%", borderRadius: 3, backgroundColor: theme.colors.primary },
  ckRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: 2,
  },
  ckDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  ckDotDone: { backgroundColor: theme.colors.success, borderColor: theme.colors.success },
  ckRowText: { flex: 1, fontSize: 12, fontWeight: "600" },
  ckRowTitle: { fontSize: 13, fontWeight: "600", color: theme.colors.text },
  ckRowNote: { fontSize: 10, color: theme.colors.info, marginTop: 1 },
  ckRowMeta: { fontSize: 10, color: theme.colors.textMuted, marginTop: 1 },

  // ── Connected Utilities + Budget Tracker duo ──
  duoRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  duoCard: { flex: 1, padding: 13, marginBottom: 0 },
  utilRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: 2,
  },
  utilIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  utilName: { fontSize: 12, fontWeight: "600", color: theme.colors.text },
  utilSub: { fontSize: 10, color: theme.colors.textTertiary, marginTop: 1 },
  utilDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.textMuted },
  utilDotOn: {
    backgroundColor: theme.colors.success,
    shadowColor: theme.colors.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 2,
  },
  utilMore: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
    color: theme.colors.textTertiary,
    paddingTop: 8,
  },
  budgetNum: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: theme.colors.text,
    marginTop: 10,
  },
  budgetNumUnit: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0,
    color: theme.colors.textTertiary,
  },
  budgetBar: { flexDirection: "row", gap: 3, height: 7, marginTop: 10 },
  budgetSeg: { borderRadius: 3, minWidth: 4 },
  budgetMeta: { fontSize: 10, color: theme.colors.textTertiary, marginTop: 8, lineHeight: 14 },
  budgetTiles: { flexDirection: "row", gap: 6, marginTop: 10 },
  budgetTile: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: "center",
    gap: 5,
  },
  budgetSwatch: { width: 18, height: 18, borderRadius: 6 },
  budgetTileLbl: {
    fontSize: 7.5,
    letterSpacing: 0.3,
    fontWeight: "600",
    textTransform: "uppercase",
    color: theme.colors.textSecondary,
  },

  // ── Utility quick-look sheet ──
  sheetScrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    backgroundColor: theme.colors.elevated,
    borderTopLeftRadius: theme.radius["2xl"],
    borderTopRightRadius: theme.radius["2xl"],
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 18,
    paddingBottom: 30,
  },
  sheetHead: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 14 },
  sheetIcon: { width: 36, height: 36, borderRadius: 11 },
  sheetTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.text },
  sheetSub: { fontSize: 11, color: theme.colors.textTertiary, marginTop: 1 },
  sheetClose: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetStats: { flexDirection: "row", gap: 8 },
  sheetStat: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    backgroundColor: theme.colors.glass.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sheetStatK: {
    fontSize: 8,
    letterSpacing: 1,
    fontWeight: "700",
    color: theme.colors.textTertiary,
  },
  sheetStatV: { fontSize: 13, fontWeight: "700", color: theme.colors.text, marginTop: 4 },
  sheetCta: {
    height: 44,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    ...theme.shadow.glow,
  },
  sheetCtaText: { fontSize: 14, fontWeight: "700", color: theme.colors.background },
});
