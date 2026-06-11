"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  MapPin, Zap, DollarSign, Truck, ArrowRight,
  Home, Briefcase, Palmtree, TrendingUp, Edit, Plus,
  Calendar, PieChart, Loader2, SlidersHorizontal, X, GripVertical,
  AlertTriangle, Clock, Sparkles, Star, ChevronDown,
} from "lucide-react";
import { StatsCard } from "@/components/dashboard/stats-card";
import { UpcomingBills } from "@/components/dashboard/upcoming-bills";
import { BudgetDonut } from "@/components/dashboard/budget-donut";
import { MonthlySpark } from "@/components/dashboard/monthly-spark";
import { MilestoneTimeline } from "@/components/dashboard/milestone-timeline";
import { RouteMapCard } from "@/components/dashboard/route-map-card";
import { HomeDossier } from "@/components/dashboard/home-dossier";
import { MoveCommandCenter, type CommandCenterAction } from "./move-command-center";
import { MoveBriefingCard } from "@/components/dashboard/move-briefing-card";
import { HouseholdActivationCard } from "@/components/dashboard/household-activation-card";
import { UpNext } from "./up-next";
import { formatCurrency } from "@/lib/utils";
import { monthlyAmountForCycle, cycleLabel } from "@/lib/budget-planning";
import { DashboardSkeleton } from "@/components/shared/loading-state";
import { toast } from "sonner";
import Link from "next/link";
import {
  generateChecklist,
  RELOCATION_PHASES,
  type UserChecklistProfile,
  type RelocationChecklist,
  type ChecklistStateRuleContext,
} from "@/lib/shared-relocation";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { planFeatures } from "@locateflow/shared";

const typeIcons: Record<string, React.ElementType> = { HOME: Home, WORK: Briefcase, VACATION: Palmtree };
const categoryColors: Record<string, string> = {
  GOVERNMENT: "bg-destructive", UTILITY: "bg-tone-honey-fg", FINANCIAL: "bg-tone-emerald-fg",
  HOUSING: "bg-tone-sky-fg", HEALTHCARE: "bg-destructive", TRANSPORTATION: "bg-tone-sky-fg",
  KIDS: "bg-tone-foil-fg", FITNESS: "bg-tone-orange-fg", SHOPPING: "bg-destructive", OTHER: "bg-tone-slate-fg",
};
const CATEGORY_KEYS = ["GOVERNMENT", "UTILITY", "FINANCIAL", "HOUSING", "HEALTHCARE", "TRANSPORTATION", "KIDS", "FITNESS", "SHOPPING", "OTHER"] as const;

interface AddressInfo {
  id: string; type: string; nickname?: string; street: string; city: string; state: string; isPrimary: boolean;
  services?: { id: string; providerName: string; category: string; monthlyCost: number; billingCycle?: string | null; createdAt?: string; website?: string }[];
}

interface DashboardStats {
  addressCount: number; serviceCount: number; monthlyExpenses: number;
  activePlan: { id: string; fromCity: string; toCity: string; moveDate: string; status: string } | null;
}

// Aurora (Edition VII) additions: routeMap + milestones slot in after the
// moving/checklist widget on the left; budgetDonut + monthlySpark join the
// right column. `normaliseOrder` appends any key missing from a user's saved
// order, so existing persisted layouts pick the new widgets up automatically
// (they land at the end of their column until the user re-orders).
// Default order leads each column with the high-signal widgets (the ones that
// also start expanded — see DEFAULT_COLLAPSED); `normaliseOrder` keeps any
// saved order intact, so only fresh dashboards see the new arrangement.
const WIDGET_KEYS = [
  { key: "stats", default: true },
  { key: "nextCritical", default: true },
  { key: "spending", default: true },
  { key: "moving", default: true },
  { key: "homeDossier", default: true },
  { key: "routeMap", default: true },
  { key: "milestones", default: true },
  { key: "recent", default: true },
  { key: "bills", default: true },
  { key: "budgetDonut", default: true },
  { key: "monthlySpark", default: true },
  { key: "categories", default: true },
  { key: "topSpending", default: true },
] as const;

type WidgetKey = typeof WIDGET_KEYS[number]["key"];

const DEFAULT_ORDER: WidgetKey[] = WIDGET_KEYS.map((w) => w.key);
const DEFAULT_VISIBILITY = Object.fromEntries(
  WIDGET_KEYS.map((w) => [w.key, w.default])
) as Record<WidgetKey, boolean>;

// Smart collapse defaults: action-oriented widgets start expanded; secondary
// analytics start as a header strip. These only apply when a user has no saved
// `collapsed` prefs (existing users get the smart default exactly once); after
// the first toggle their choices persist via persistPrefs.
const DEFAULT_COLLAPSED: Record<WidgetKey, boolean> = {
  stats: false,
  nextCritical: false,
  spending: false,
  moving: false,
  homeDossier: false,
  bills: false,
  routeMap: true,
  milestones: true,
  recent: true,
  budgetDonut: true,
  monthlySpark: true,
  categories: true,
  topSpending: true,
};

export interface DashboardWidgetPrefs {
  order?: string[];
  visibility?: Record<string, boolean>;
  collapsed?: Record<string, boolean>;
}

function normaliseOrder(incoming: string[] | undefined): WidgetKey[] {
  const allowed = new Set<string>(DEFAULT_ORDER);
  const filtered = (incoming || []).filter((k): k is WidgetKey => allowed.has(k));
  const missing = DEFAULT_ORDER.filter((k) => !filtered.includes(k));
  return [...filtered, ...missing];
}

function normaliseVisibility(incoming: Record<string, boolean> | undefined): Record<WidgetKey, boolean> {
  const merged = { ...DEFAULT_VISIBILITY };
  if (incoming) {
    for (const key of DEFAULT_ORDER) {
      if (typeof incoming[key] === "boolean") merged[key] = incoming[key];
    }
  }
  return merged;
}

function normaliseCollapsed(incoming: Record<string, boolean> | undefined): Record<WidgetKey, boolean> {
  const merged = { ...DEFAULT_COLLAPSED };
  if (incoming) {
    for (const key of DEFAULT_ORDER) {
      if (typeof incoming[key] === "boolean") merged[key] = incoming[key];
    }
  }
  return merged;
}

function SortableItem({ id, label, dragLabel, enabled, onToggle }: { id: string; label: string; dragLabel: string; enabled: boolean; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      <button {...attributes} {...listeners} className="p-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-muted-foreground touch-none" aria-label={dragLabel}>
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onToggle}
        aria-pressed={enabled}
        className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium border transition text-left ${
          enabled
            ? "border-tone-orange-br bg-tone-orange-bg text-tone-orange-fg"
            : "border-border text-muted-foreground hover:text-foreground/80"
        }`}
      >
        {label}
      </button>
    </div>
  );
}

// Shared collapsible shell wrapped around every dashboard widget at the
// central render dispatch — one uniform header strip (title + chevron) instead
// of 13 bespoke ones. Collapsed renders only the strip; the widget body is
// unmounted entirely, so heavier cards (maps, charts, self-fetching widgets)
// cost nothing while closed. Chevron rotation is transform-only and disabled
// under prefers-reduced-motion via the motion-reduce variant.
function CollapsibleWidget({ title, expanded, onToggle, toggleLabel, children }: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  toggleLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between gap-2 px-4 py-2 rounded-xl border border-border bg-foreground/[0.03] text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] transition"
      >
        <span className="text-xs font-semibold">{title}</span>
        <span className="sr-only">{toggleLabel}</span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ease-in-out motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && children}
    </section>
  );
}

export default function DashboardClient({ initialPrefs }: { initialPrefs: DashboardWidgetPrefs | null }) {
  const t = useTranslations("services");
  const td = useTranslations("dashboard");
  const widgetLabels: Record<WidgetKey, string> = {
    stats: td("widget_stats"),
    nextCritical: td("widget_nextCritical"),
    spending: td("widget_spending"),
    moving: td("widget_moving"),
    routeMap: td("widget_routeMap"),
    milestones: td("widget_milestones"),
    homeDossier: td("widget_homeDossier"),
    recent: td("widget_recent"),
    bills: td("widget_bills"),
    budgetDonut: td("widget_budgetDonut"),
    monthlySpark: td("widget_monthlySpark"),
    categories: td("widget_categories"),
    topSpending: td("widget_topSpending"),
  };
  const categoryLabels: Record<string, string> = Object.fromEntries(
    CATEGORY_KEYS.map((k) => [k, td(`categoryLabel_${k}` as const)])
  );
  const [stats, setStats] = useState<DashboardStats>({
    addressCount: 0, serviceCount: 0, monthlyExpenses: 0, activePlan: null,
  });
  const [addresses, setAddresses] = useState<AddressInfo[]>([]);
  const [allServices, setAllServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWidgetPanel, setShowWidgetPanel] = useState(false);
  const [checklist, setChecklist] = useState<RelocationChecklist | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [premiumPlan, setPremiumPlan] = useState("");
  // Resume nudge for users who bounced out of onboarding before finishing.
  const [onboarding, setOnboarding] = useState<{ completed: boolean; stepIndex: number } | null>(null);
  const [resumeDismissed, setResumeDismissed] = useState(false);
  const [widgets, setWidgets] = useState<Record<WidgetKey, boolean>>(() => normaliseVisibility(initialPrefs?.visibility));
  const [widgetOrder, setWidgetOrder] = useState<WidgetKey[]>(() => normaliseOrder(initialPrefs?.order));
  // Per-widget collapse state. When the user has never toggled (prefs.collapsed
  // undefined) the smart defaults from DEFAULT_COLLAPSED apply once; every
  // toggle thereafter is persisted alongside order/visibility.
  const [collapsed, setCollapsed] = useState<Record<WidgetKey, boolean>>(() => normaliseCollapsed(initialPrefs?.collapsed));
  // Address the New Home Dossier card looks up: the active move's destination
  // when one exists (that's where flood/school/weather matter most), otherwise
  // the primary address. Null hides the widget entirely.
  const [dossierAddressId, setDossierAddressId] = useState<string | null>(null);
  const [criticalActions, setCriticalActions] = useState<Array<{
    id: string;
    name: string;
    category: string;
    reason: string;
    deadline?: string;
  }>>([]);
  // Critical-provider readiness signal for the Move Command Center: how many
  // CRITICAL provider categories are still missing vs. already set up. Sourced
  // from the recommendations engine's stats (missingCritical / completedCategories).
  const [criticalReadiness, setCriticalReadiness] = useState<{ missing: number; completed: number }>({
    missing: 0,
    completed: 0,
  });
  // Inputs captured during the main load so the readiness ring can be re-derived
  // after an inline task completion (UpNext) without re-running the whole
  // dashboard load. Holds the active plan, the checklist profile, and the
  // resolved destination state-rule context used by generateChecklist.
  const checklistInputsRef = useRef<{
    plan: any;
    profile: UserChecklistProfile;
    stateRule: ChecklistStateRuleContext | null;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // PUT replaces the whole dashboardWidgetPrefs JSON blob server-side, so every
  // caller must send all three fields — omitting `collapsed` here would wipe a
  // user's saved collapse state on the next visibility/order change.
  const persistPrefs = useCallback((next: { visibility?: Record<WidgetKey, boolean>; order?: WidgetKey[]; collapsed?: Record<WidgetKey, boolean> }) => {
    const body: DashboardWidgetPrefs = {};
    if (next.visibility) body.visibility = next.visibility;
    if (next.order) body.order = next.order;
    if (next.collapsed) body.collapsed = next.collapsed;
    fetch("/api/user/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  }, []);

  const toggleWidget = (key: WidgetKey) => {
    setWidgets((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      persistPrefs({ visibility: next, order: widgetOrder, collapsed });
      return next;
    });
  };

  const toggleCollapsed = (key: WidgetKey) => {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      persistPrefs({ visibility: widgets, order: widgetOrder, collapsed: next });
      return next;
    });
  };

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setWidgetOrder((prev) => {
        const oldIndex = prev.indexOf(active.id as WidgetKey);
        const newIndex = prev.indexOf(over.id as WidgetKey);
        const next = arrayMove(prev, oldIndex, newIndex);
        persistPrefs({ visibility: widgets, order: next, collapsed });
        return next;
      });
    }
  }, [persistPrefs, widgets, collapsed]);

  const w = (key: WidgetKey) => widgets[key] !== false;

  // Which column each widget belongs to
  const leftWidgets: WidgetKey[] = ["nextCritical", "spending", "moving", "routeMap", "milestones", "homeDossier", "recent"];
  const rightWidgets: WidgetKey[] = ["bills", "budgetDonut", "monthlySpark", "categories", "topSpending"];
  const orderedLeft = widgetOrder.filter((k) => leftWidgets.includes(k));
  const orderedRight = widgetOrder.filter((k) => rightWidgets.includes(k));

  useEffect(() => {
    Promise.allSettled([
      fetch("/api/addresses").then((r) => r.json()),
      fetch("/api/services").then((r) => r.json()),
      fetch("/api/moving").then((r) => r.json()),
      fetch("/api/profile").then((r) => r.json()),
    ])
      .then(async ([addrResult, svcResult, movingResult, profileResult]) => {
        const addrData = addrResult.status === "fulfilled" ? addrResult.value : {};
        const svcData = svcResult.status === "fulfilled" ? svcResult.value : {};
        const movingData = movingResult.status === "fulfilled" ? movingResult.value : {};
        const profileData = profileResult.status === "fulfilled" ? profileResult.value : {};

        const failedApis = [addrResult, svcResult, movingResult, profileResult].filter((r) => r.status === "rejected");
        if (failedApis.length > 0) {
          toast.error(td("loadPartial", { failed: failedApis.length, total: 4 }));
        }

        const addrs: AddressInfo[] = addrData.addresses || [];
        const services = svcData.services || [];
        const plans = movingData.plans || [];

        setAddresses(addrs);
        setAllServices(services);

        // Normalize each per-cycle cost to its true monthly value (yearly/12,
        // quarterly/3, ONE_TIME → 0) so a yearly service doesn't inflate
        // "Monthly Expenses" ~12x and this matches the /budget figure.
        const monthlyExpenses = services.reduce((sum: number, s: any) => sum + monthlyAmountForCycle(s.monthlyCost || 0, s.billingCycle), 0);

        let activePlan: DashboardStats["activePlan"] = null;

        // Only surface a genuinely active move on the dashboard. The /api/moving
        // feed returns ALL non-deleted plans (including COMPLETED / CANCELED)
        // ordered by moveDate desc, so a blind `plans[0]` fallback would light up
        // the "active move" banner + checklist for a finished or canceled plan.
        // Prefer an IN_PROGRESS plan, then fall back to any non-terminal (PLANNING)
        // plan — never a COMPLETED / CANCELED one.
        const inProgressPlan =
          plans.find((p: any) => p.status === "IN_PROGRESS") ||
          plans.find((p: any) => p.status === "PLANNING") ||
          null;
        if (inProgressPlan) {
          activePlan = {
            id: inProgressPlan.id, fromCity: inProgressPlan.fromAddress?.city || "Origin",
            toCity: inProgressPlan.toAddress?.city || "Destination", moveDate: inProgressPlan.moveDate,
            status: inProgressPlan.status,
          };
        }

        const profile = profileData.profile || {};
        const sub = profileData.subscription || {};
        // Prefer the EFFECTIVE entitlement (mirrors mobile): an inherited
        // Family/Pro member has no own paid subscription row but inherits the
        // owner's tier, so the raw own-subscription heuristic would wrongly read
        // FREE_TRIAL and hide the premium badge. Fall back to the own-subscription
        // heuristic only when the resolved entitlement is absent.
        const ent = profileData.entitlement;
        const hasPremium = ent
          ? ent.isActive === true && ent.plan && ent.plan !== "FREE_TRIAL"
          : sub.plan && sub.plan !== "FREE_TRIAL" && (sub.status === "ACTIVE" || (sub.premiumUntil && new Date(sub.premiumUntil) > new Date()));
        setIsPremium(!!hasPremium);
        setPremiumPlan((ent?.plan ?? sub.plan) || "");
        setOnboarding({
          completed: profileData.onboardingCompleted === true,
          stepIndex: typeof profileData.onboardingStepIndex === "number" ? profileData.onboardingStepIndex : 0,
        });
        setStats({
          addressCount: addrs.length, serviceCount: services.length, monthlyExpenses,
          activePlan,
        });

        // New Home Dossier target: the active plan's destination address id
        // (the /api/moving feed spreads the full plan record, so toAddressId is
        // present) — else the primary address, else the first one.
        const primaryAddressId = addrs.find((a) => a.isPrimary)?.id || addrs[0]?.id || null;
        setDossierAddressId((inProgressPlan as any)?.toAddressId || primaryAddressId);

        // Generate relocation checklist if active plan exists
        if (inProgressPlan) {
          try {
            const checklistProfile: UserChecklistProfile = {
              hasChildren: profile.hasChildren ?? false,
              childrenCount: profile.childrenCount ?? 0,
              hasPets: profile.hasPets ?? false,
              hasSenior: profile.hasSenior ?? false,
              carCount: profile.carCount ?? 0,
              hasDisability: profile.hasDisability ?? false,
              needsStorage: profile.needsStorage ?? false,
              hasMotorcycle: profile.hasMotorcycle ?? false,
              hasBoatRV: profile.hasBoatRV ?? false,
              isImmigrant: profile.isImmigrant ?? false,
              isBusinessOwner: profile.isBusinessOwner ?? false,
              moveType: profile.moveType || "PERSONAL",
            };
            // A generated MoveTask now persists `templateId` (the checklist item
            // it maps to). A COMPLETED task with a non-null templateId marks that
            // checklist item DONE; tasks without a templateId are skipped.
            const completedTemplates: Set<string> = new Set<string>();
            try {
              const moveTasksRes = await fetch(
                `/api/move-tasks?movingPlanId=${inProgressPlan.id}&status=COMPLETED`,
              ).then((r) => r.json());
              for (const t of moveTasksRes?.tasks || []) {
                if (t?.templateId && t?.status === "COMPLETED") completedTemplates.add(t.templateId);
              }
            } catch { /* non-blocking: fall back to empty set */ }
            const toState = (inProgressPlan as any).toAddress?.state || "";
            let stateRule: ChecklistStateRuleContext | null = null;
            if (toState) {
              try {
                const stateRuleRes = await fetch(`/api/state-rules?state=${toState}`).then((r) => r.json());
                stateRule = stateRuleRes.stateRule || null;
              } catch {
                stateRule = null;
              }
            }
            const cl = generateChecklist(
              checklistProfile,
              new Date(inProgressPlan.moveDate),
              (inProgressPlan as any).fromAddress?.state || "",
              toState,
              completedTemplates,
              stateRule,
            );
            setChecklist(cl);
            // Capture the inputs so UpNext can re-derive the ring after a
            // completion without re-running the whole dashboard load.
            checklistInputsRef.current = {
              plan: inProgressPlan,
              profile: checklistProfile,
              stateRule,
            };
          } catch { /* non-blocking */ }
        }
      })
      .catch(() => { toast.error(td("loadFailed")); })
      .finally(() => setLoading(false));
  }, []);

  // Fetch the recommendations payload. It powers BOTH the always-on Move Command
  // Center (countdown readiness needs missingCritical / completed) and the
  // optional "Next Critical Actions" widget — so it runs regardless of the widget
  // toggle (the widget just hides its own render when disabled). Extracted as a
  // callback so UpNext can re-sync the readiness ring after a completion.
  const fetchRecommendations = useCallback(async () => {
    try {
      const r = await fetch("/api/providers/recommendations");
      const data = r.ok ? await r.json() : null;
      if (!data) return;
      if (data.nextCriticalActions) {
        setCriticalActions(
          data.nextCriticalActions.slice(0, 3).map((p: any) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            reason: p.explanation?.reason || p.explanation?.headline || "",
            deadline: p.explanation?.deadline,
          }))
        );
      }
      // Readiness signal: count of CRITICAL provider categories still missing
      // vs. set up. Both come straight from the engine's stats: `missingCritical`
      // is the list of pending CRITICAL categories, and `completedCritical` is
      // the count of satisfied CRITICAL categories (CRITICAL cluster's
      // completedCount). Using completedCritical avoids inflating the ring with
      // optional categories (gym/streaming) the way the old heuristic did.
      const missingCritical: string[] = Array.isArray(data.stats?.missingCritical)
        ? data.stats.missingCritical
        : [];
      const missingSet = new Set(missingCritical);
      const completedCriticalCount =
        typeof data.stats?.completedCritical === "number" ? data.stats.completedCritical : 0;
      setCriticalReadiness({ missing: missingSet.size, completed: completedCriticalCount });
    } catch {
      /* non-blocking */
    }
  }, []);

  useEffect(() => {
    void fetchRecommendations();
  }, [fetchRecommendations]);

  // Re-derive the readiness ring after an inline task completion (UpNext): the
  // checklist's completed-count and the providers signal may both have changed.
  // Re-fetches recommendations and regenerates the checklist from the inputs
  // captured during the main load. Best-effort + non-blocking.
  const refreshReadiness = useCallback(async () => {
    await fetchRecommendations();
    const inputs = checklistInputsRef.current;
    if (!inputs?.plan) return;
    try {
      const completedTemplates = new Set<string>();
      try {
        const moveTasksRes = await fetch(
          `/api/move-tasks?movingPlanId=${inputs.plan.id}&status=COMPLETED`,
        ).then((r) => r.json());
        for (const tk of moveTasksRes?.tasks || []) {
          if (tk?.templateId && tk?.status === "COMPLETED") completedTemplates.add(tk.templateId);
        }
      } catch { /* non-blocking: fall back to empty set */ }
      const cl = generateChecklist(
        inputs.profile,
        new Date(inputs.plan.moveDate),
        inputs.plan.fromAddress?.state || "",
        inputs.plan.toAddress?.state || "",
        completedTemplates,
        inputs.stateRule,
      );
      setChecklist(cl);
    } catch { /* non-blocking */ }
  }, [fetchRecommendations]);

  const progress = checklist && checklist.totalItems > 0
    ? Math.round((checklist.completedItems / checklist.totalItems) * 100) : 0;

  // Compute spending by category
  const catBreakdown: Record<string, number> = {};
  allServices.forEach((s: any) => {
    const prefix = (s.category || "OTHER").split("_")[0];
    catBreakdown[prefix] = (catBreakdown[prefix] || 0) + monthlyAmountForCycle(s.monthlyCost || 0, s.billingCycle);
  });
  const sortedCats = Object.entries(catBreakdown).sort((a, b) => b[1] - a[1]);
  const maxCatAmount = sortedCats.length > 0 ? sortedCats[0][1] : 1;

  // Top spending services — rank by true monthly-equivalent so a yearly bill
  // doesn't outrank a higher monthly one purely because its raw figure is bigger.
  const topServices = [...allServices]
    .sort((a: any, b: any) => monthlyAmountForCycle(b.monthlyCost || 0, b.billingCycle) - monthlyAmountForCycle(a.monthlyCost || 0, a.billingCycle))
    .slice(0, 5);

  // Recent services
  const recentServices = [...allServices]
    .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 5);

  if (loading) return <DashboardSkeleton />;

  // Primary address state drives a tz-correct move countdown (US-only: the
  // shared helper maps state → predominant US zone, falling back to Eastern).
  const primaryState =
    addresses.find((a) => a.isPrimary)?.state || addresses[0]?.state || null;
  const topAction: CommandCenterAction | null = criticalActions[0]
    ? {
        id: criticalActions[0].id,
        name: criticalActions[0].name,
        category: criticalActions[0].category,
        reason: criticalActions[0].reason,
        deadline: criticalActions[0].deadline,
      }
    : null;

  // Real setup signal for the cold-start ring floor: the active plan has both a
  // genuine origin and destination city (not the "Origin"/"Destination"
  // placeholders). No fabrication — only reflects setup the user actually did.
  const hasOriginDestination =
    !!stats.activePlan &&
    stats.activePlan.fromCity !== "Origin" &&
    stats.activePlan.toCity !== "Destination";

  // Central widget render dispatch — every column widget body lives in this
  // one switch. A null body keeps each widget's existing self-hide behavior
  // (no data => nothing renders, not even the collapse strip).
  const renderWidgetBody = (key: WidgetKey): React.ReactNode => {
    switch (key) {
      case "nextCritical":
        return criticalActions.length > 0 ? (
          <div key={key} className="rounded-2xl border border-destructive bg-gradient-to-br from-primary/5 to-transparent p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-destructive" />
                <h3 className="text-sm font-bold text-foreground">{td("widget_nextCritical")}</h3>
              </div>
              <Link href="/providers">
                <button className="text-[10px] text-foreground/40 hover:text-foreground transition">{td("browseAll")}</button>
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">
              {td("nextCritical_help")}
            </p>
            <div className="space-y-2">
              {criticalActions.map((action) => (
                <Link
                  key={action.id}
                  href={`/providers/${action.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border bg-foreground/[0.03] hover:bg-foreground/[0.06] transition group"
                >
                  <div className="h-9 w-9 rounded-lg bg-destructive/15 border border-destructive flex items-center justify-center shrink-0">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{action.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {(action.category || "").replace(/_/g, " ")}
                      {action.deadline ? ` · ${action.deadline}` : ""}
                    </p>
                    {action.reason && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{action.reason}</p>
                    )}
                  </div>
                  <ArrowRight className="h-4 w-4 text-foreground/40 group-hover:text-tone-orange-fg transition shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        ) : null;
      case "spending":
        return !loading && addresses.length > 0 ? (
          <div key={key} className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4 text-tone-orange-fg" />
                <h3 className="text-sm font-semibold text-foreground">{td("widget_spending")}</h3>
              </div>
              <Link href="/addresses"><button className="text-[10px] text-foreground/40 hover:text-foreground transition">{td("viewAll")}</button></Link>
            </div>
            <div className="px-5 pb-5 space-y-2">
              {addresses.map((addr) => {
                const TypeIcon = typeIcons[addr.type] || MapPin;
                const svcCount = addr.services?.length || 0;
                const addrCost = addr.services?.reduce((sum: number, s: any) => sum + monthlyAmountForCycle(s.monthlyCost || 0, s.billingCycle), 0) || 0;
                const pct = stats.monthlyExpenses > 0 ? (addrCost / stats.monthlyExpenses) * 100 : 0;
                return (
                  <Link key={addr.id} href={`/addresses/${addr.id}`}>
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-foreground/[0.02] hover:bg-foreground/[0.05] transition-all group cursor-pointer">
                      <div className="p-2 rounded-lg bg-tone-orange-bg border border-tone-orange-br group-hover:bg-tone-orange-fg group-hover:border-tone-orange-br transition-colors shrink-0">
                        <TypeIcon className="h-4 w-4 text-tone-orange-fg group-hover:text-foreground transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">{addr.nickname || addr.street}</p>
                          {addr.isPrimary && <Star className="h-3 w-3 text-tone-honey-fg fill-warning shrink-0" />}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-foreground/5 rounded-full overflow-hidden" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${addr.nickname || addr.street} spending percentage`}>
                            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">{Math.round(pct)}%</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-tone-emerald-fg">{formatCurrency(addrCost)}</p>
                        <p className="text-xs text-muted-foreground">{td("servicesCount", { count: svcCount })}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null;
      case "moving": {
        const phaseInfo = checklist ? RELOCATION_PHASES.find((ph: any) => ph.phase === checklist.currentPhase) : null;
        return stats.activePlan ? (
          <div key={key} className="rounded-2xl border border-tone-orange-br bg-gradient-to-br from-primary/5 to-transparent p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">{phaseInfo?.icon || "🚚"}</span>
                <div>
                  <h3 className="text-sm font-bold text-foreground">{td("section_moving")}</h3>
                  <p className="text-xs text-muted-foreground">
                    {stats.activePlan.fromCity} → {stats.activePlan.toCity}
                    {checklist ? ` · ${td("moving_phase", { phase: checklist.currentPhase + 1, label: phaseInfo?.label || "" })}` : ""}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-foreground">{checklist ? `${checklist.progressPercent}%` : `${progress}%`}</p>
                <p className="text-[10px] text-foreground/40">
                  {checklist ? `${checklist.completedItems}/${checklist.totalItems}` : `${progress}%`} {td("moving_done")}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 rounded-full bg-foreground/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${checklist?.progressPercent ?? progress}%` }}
              />
            </div>

            {/* Overdue items */}
            {checklist && checklist.overdueItems.length > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-destructive">{td("moving_overdue")} ({checklist.overdueItems.length})</p>
                  <p className="text-xs text-destructive/70 mt-0.5">
                    {checklist.overdueItems.slice(0, 2).map((i: any) => i.title).join(" · ")}
                    {checklist.overdueItems.length > 2 && ` ${td("moving_overdueMore", { count: checklist.overdueItems.length - 2 })}`}
                  </p>
                </div>
              </div>
            )}

            {/* Urgent deadlines */}
            {checklist && checklist.urgentItems.filter((i: any) => !i.isOverdue).length > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-tone-honey-bg border border-tone-honey-br">
                <Clock className="h-4 w-4 text-tone-honey-fg shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-tone-honey-fg">{td("moving_deadlineSoon")}</p>
                  <p className="text-xs text-tone-honey-fg/70 mt-0.5">
                    {checklist.urgentItems.filter((i: any) => !i.isOverdue).slice(0, 2).map((i: any) => {
                      const dl = i.daysUntilDeadline !== null ? ` (${i.daysUntilDeadline}d)` : "";
                      return `${i.title}${dl}`;
                    }).join(" · ")}
                  </p>
                </div>
              </div>
            )}

            {/* Next Action */}
            {checklist?.nextAction && !checklist.nextAction.isCompleted && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-foreground/[0.03] border border-border">
                <span className="text-base">{checklist.nextAction.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{checklist.nextAction.title}</p>
                  {checklist.nextAction.stateNote && (
                    <p className="text-[11px] text-tone-honey-fg/70 truncate">{checklist.nextAction.stateNote}</p>
                  )}
                  {checklist.nextAction.estimatedMinutes && (
                    <span className="text-xs text-muted-foreground">~{checklist.nextAction.estimatedMinutes} {td("moving_minute")}</span>
                  )}
                </div>
                <Link href="/services">
                  <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-tone-orange-fg text-white text-xs font-medium hover:opacity-90 transition whitespace-nowrap">
                    {t("doIt")} <ArrowRight className="h-3 w-3" />
                  </button>
                </Link>
              </div>
            )}

            <div className="flex gap-2">
              <Link href={`/moving/plan/${stats.activePlan.id}`} className="flex-1">
                <button className="w-full py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-foreground/5 transition">{td("moving_viewPlan")}</button>
              </Link>
              <Link href="/services" className="flex-1">
                <button className="w-full py-2 rounded-xl border border-tone-orange-br bg-tone-orange-bg text-sm text-tone-orange-fg hover:bg-tone-orange-bg transition">{td("moving_checklist")}</button>
              </Link>
            </div>
          </div>
        ) : !loading ? (
          <div key={key} className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl p-6 text-center">
            <Truck className="h-10 w-10 mx-auto text-foreground/40 mb-2" />
            <p className="text-sm text-foreground/40 mb-3">{td("moving_noPlan")}</p>
            <Link href={isPremium ? "/moving/new" : "/settings/subscription?returnTo=%2Fdashboard"}>
              <button className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-foreground/5 transition">
                {isPremium ? td("moving_planMove") : td("commandCenter_freeCta")}
              </button>
            </Link>
          </div>
        ) : null;
      }
      case "routeMap":
        // Stylized route card — only meaningful with a genuine
        // origin AND destination (no "Origin"/"Destination" stubs).
        return !loading && stats.activePlan && hasOriginDestination ? (
          <RouteMapCard
            key={key}
            fromCity={stats.activePlan.fromCity}
            toCity={stats.activePlan.toCity}
            // Real (Google Static) basemap is Family/Pro; Free/Individual
            // get the stylized canvas fallback. premiumPlan already flows
            // from the entitlement resolved at load — no extra fetch.
            realMap={planFeatures(premiumPlan).realMap}
          />
        ) : null;
      case "milestones":
        return !loading && checklist ? (
          <MilestoneTimeline key={key} checklist={checklist} />
        ) : null;
      case "homeDossier":
        // New Home Dossier — flood zone / school district / moving-day
        // weather for the destination (or primary) address. The card
        // self-hides when every section degrades (no empty shell).
        return !loading && dossierAddressId ? (
          <HomeDossier key={key} addressId={dossierAddressId} />
        ) : null;
      case "recent":
        return !loading && recentServices.length > 0 ? (
          <div key={key} className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-tone-cyan-fg" />
                <h3 className="text-sm font-semibold text-foreground">{td("section_recent")}</h3>
              </div>
              <Link href="/services"><button className="text-[10px] text-foreground/40 hover:text-foreground transition">{td("viewAll")}</button></Link>
            </div>
            <div className="px-5 pb-5 space-y-1.5">
              {recentServices.map((svc: any) => (
                <div key={svc.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-foreground/[0.02] hover:bg-foreground/[0.05] transition group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{svc.providerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {(svc.category || "").replace(/_/g, " ")}
                      {svc.address && ` · ${svc.address.city || ""}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(svc.monthlyCost || 0) > 0 && (
                      <span className="text-xs font-medium text-muted-foreground">{formatCurrency(svc.monthlyCost)}{cycleLabel(svc.billingCycle)}</span>
                    )}
                    <Link href={`/services/${svc.id}`}>
                      <button className="p-1 rounded-md text-muted-foreground hover:text-tone-orange-fg hover:bg-tone-orange-bg transition opacity-0 group-hover:opacity-100" aria-label={td("recent_editService")}>
                        <Edit className="h-3 w-3" />
                      </button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null;
      case "bills":
        return <UpcomingBills key={key} />;
      case "budgetDonut":
        return !loading && sortedCats.length > 0 ? (
          <BudgetDonut
            key={key}
            categories={sortedCats}
            total={stats.monthlyExpenses}
            labels={categoryLabels}
          />
        ) : null;
      case "monthlySpark":
        return !loading && allServices.length > 0 ? (
          <MonthlySpark key={key} services={allServices} />
        ) : null;
      case "categories":
        return !loading && sortedCats.length > 0 ? (
          <div key={key} className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <PieChart className="h-4 w-4 text-tone-emerald-fg" />
                <h3 className="text-sm font-semibold text-foreground">{td("widget_categories")}</h3>
              </div>
              <span className="text-lg font-bold text-foreground">{formatCurrency(stats.monthlyExpenses)}</span>
            </div>
            <div className="px-5 pb-5 space-y-2.5">
              {sortedCats.map(([cat, amount]) => (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground text-xs">{categoryLabels[cat] || cat}</span>
                    <span className="font-medium text-foreground/80 text-xs">{formatCurrency(amount)}</span>
                  </div>
                  <div className="h-1.5 bg-foreground/5 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${categoryColors[cat] || "bg-tone-slate-fg"} transition-all`} style={{ width: `${(amount / maxCatAmount) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null;
      case "topSpending":
        return !loading && topServices.length > 0 ? (
          <div key={key} className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-tone-honey-fg" />
                <h3 className="text-sm font-semibold text-foreground">{td("widget_topSpending")}</h3>
              </div>
            </div>
            <div className="px-5 pb-5 space-y-1.5">
              {topServices.map((svc: any, i: number) => (
                <div key={svc.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-foreground/[0.03] transition">
                  <span className="text-xs font-bold text-muted-foreground w-4 text-center">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground/80 truncate">{svc.providerName}</p>
                  </div>
                  <span className="text-xs font-semibold text-tone-emerald-fg shrink-0">{formatCurrency(svc.monthlyCost)}{cycleLabel(svc.billingCycle)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null;
      default: return null;
    }
  };

  // Uniform collapsible shell around every column widget. Collapsed widgets
  // render only the header strip; the body stays unmounted until expanded.
  const renderColumnWidget = (key: WidgetKey) => {
    if (!w(key)) return null;
    const body = renderWidgetBody(key);
    if (!body) return null;
    const isCollapsed = collapsed[key] === true;
    return (
      <CollapsibleWidget
        key={key}
        title={widgetLabels[key]}
        expanded={!isCollapsed}
        onToggle={() => toggleCollapsed(key)}
        toggleLabel={isCollapsed ? td("widget_expand") : td("widget_collapse")}
      >
        {body}
      </CollapsibleWidget>
    );
  };

  return (
    <div className="space-y-6">
      {/* Resume nudge: the lifecycle-nudge cron only re-engages users with NO plan
          and NO services, so someone who added an address then bounced out of the
          wizard gets no prompt. This closes that gap using onboardingStepIndex. */}
      {onboarding && !onboarding.completed && !resumeDismissed && (
        <div className="rounded-2xl border border-tone-orange-br bg-tone-orange-bg/40 p-4 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Finish setting up your move</p>
            <p className="text-xs text-muted-foreground">
              You&apos;re on step {Math.min(onboarding.stepIndex + 1, 4)} of 4 — pick up where you left off.
            </p>
          </div>
          <Link
            href="/onboarding"
            className="shrink-0 rounded-lg border border-tone-orange-br bg-tone-orange-bg text-tone-orange-fg text-xs font-semibold px-3 py-2 hover:opacity-90 transition"
          >
            Resume
          </Link>
          <button
            type="button"
            onClick={() => setResumeDismissed(true)}
            aria-label="Dismiss"
            className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {/* AI move briefing — plain-English situation summary + top next actions.
          Parity with mobile; renders nothing when not configured or already seen
          for this move stage. */}
      <MoveBriefingCard />
      {/* HOUSEHOLD ACTIVATION — Family/Pro owners with a member-empty household
          get a one-time guided "invite your household" card. A top-level card
          like the pending-invite banner, NOT a widget key (never part of the
          order/visibility/collapse prefs). Self-hides when the workspace flag
          is off, members or invites already exist, or after dismissal
          (localStorage, same pattern as the briefing card). Also handles the
          ?household=setup deep link from checkout success. */}
      <HouseholdActivationCard plan={premiumPlan} />
      {/* MOVE COMMAND CENTER — pinned hero: countdown + readiness + next action.
          When there's no active move it renders a warm "start your move" hero
          instead of a cold empty grid. */}
      <MoveCommandCenter
        activePlan={stats.activePlan}
        checklist={checklist}
        topAction={topAction}
        missingCriticalCount={criticalReadiness.missing}
        completedCriticalCount={criticalReadiness.completed}
        state={primaryState}
        hasOriginDestination={hasOriginDestination}
        isPremium={isPremium}
        t={td}
      />

      {/* UP NEXT — the 2-3 nearest-due open tasks for the active plan, each with
          a one-tap inline checkbox that completes via the same
          PATCH /api/move-tasks { event: "COMPLETE" } the plan screen uses (with
          Undo). Self-hides with no active plan / no open tasks. onCompleted
          re-syncs the readiness ring. Parity with the mobile UpNext strip. */}
      <UpNext
        planId={stats.activePlan?.id ?? null}
        locale="en-US"
        onCompleted={refreshReadiness}
        t={td}
      />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            {/* Aurora serif greeting — display face with ONE italic <em>
                accent (cool gradient via the .h1 helper in globals.css). */}
            <h1 className="h1 text-3xl md:text-4xl text-foreground">
              {td.rich("title_serif", { em: (chunks) => <em>{chunks}</em> })}
            </h1>
            {isPremium && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-primary/20 via-primary/20 to-transparent border border-tone-honey-br text-tone-honey-fg animate-pulse">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                {td("premiumBadge")}
              </span>
            )}
          </div>
          <p className="text-muted-foreground mt-1">{td("welcome")}. {td("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowWidgetPanel(!showWidgetPanel)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition ${
              showWidgetPanel ? "border-tone-orange-br bg-tone-orange-bg text-tone-orange-fg" : "border-border text-muted-foreground hover:bg-foreground/5"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" /> {td("customize")}
          </button>
          <Link href="/addresses/new">
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-foreground/5 transition">
              <MapPin className="h-4 w-4" /> {td("addAddressBtn")}
            </button>
          </Link>
          {/* Free users can't create a MovingPlan — route the move CTA to the
              upgrade path instead of /moving/new (which 403s for them). */}
          {/* Primary CTA wears the PLAN ACCENT (bg-primary), not the always-cool
              tone-orange token — so Pro renders honey, Free renders pink, etc.,
              matching the sibling primary-button convention. */}
          <Link href={isPremium ? "/moving/new" : "/settings/subscription?returnTo=%2Fdashboard"}>
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition">
              <Truck className="h-4 w-4" /> {isPremium ? td("planMoveBtn") : td("commandCenter_freeCta")}
            </button>
          </Link>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="flex flex-wrap gap-2">
        <Link href="/services/new">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-foreground/[0.06] bg-foreground/[0.02] text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition">
            <Plus className="h-3 w-3" /> {td("addServiceBtn")}
          </button>
        </Link>
        <Link href="/budget">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-foreground/[0.06] bg-foreground/[0.02] text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition">
            <DollarSign className="h-3 w-3" /> {td("budgetBtn")}
          </button>
        </Link>
      </div>

      {/* Widget Customization Panel */}
      {showWidgetPanel && (
        <div className="rounded-2xl border border-tone-orange-br bg-foreground/5 backdrop-blur-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">{td("widget_panel_title")}</h3>
            <button onClick={() => setShowWidgetPanel(false)} className="p-1 rounded-lg text-foreground/40 hover:text-foreground hover:bg-foreground/5 transition">
              <X className="h-4 w-4" />
            </button>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={widgetOrder} strategy={verticalListSortingStrategy}>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {widgetOrder.map((key) => {
                  const wk = WIDGET_KEYS.find((w) => w.key === key);
                  if (!wk) return null;
                  return (
                    <SortableItem
                      key={wk.key}
                      id={wk.key}
                      label={widgetLabels[wk.key]}
                      dragLabel={td("widget_drag_label")}
                      enabled={widgets[wk.key] !== false}
                      onToggle={() => toggleWidget(wk.key)}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Stats Grid — same collapsible shell as the column widgets so the
          header affordance is uniform across all 13. */}
      {w("stats") && (
        <CollapsibleWidget
          title={widgetLabels.stats}
          expanded={collapsed.stats !== true}
          onToggle={() => toggleCollapsed("stats")}
          toggleLabel={collapsed.stats === true ? td("widget_expand") : td("widget_collapse")}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <StatsCard title={td("stat_addresses")} value={stats.addressCount} icon={MapPin} description={stats.addressCount > 0 ? td("stat_addresses_primary", { count: addresses.filter(a => a.isPrimary).length }) : undefined} />
            <StatsCard title={td("stat_services")} value={stats.serviceCount} description={stats.monthlyExpenses > 0 ? td("stat_services_total", { amount: formatCurrency(stats.monthlyExpenses) }) : td("stat_services_acrossAll")} icon={Zap} />
            <Link href="/budget"><StatsCard title={td("stat_monthly")} value={formatCurrency(stats.monthlyExpenses)} icon={DollarSign} description={sortedCats.length > 0 ? td("stat_monthly_categories", { count: sortedCats.length }) : undefined} /></Link>
          </div>
        </CollapsibleWidget>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column — rendered in user's drag order, each widget wrapped
            in the shared collapsible shell by renderColumnWidget */}
        <div className="lg:col-span-2 space-y-5">
          {orderedLeft.map((key) => renderColumnWidget(key))}
        </div>

        {/* Right Column — rendered in user's drag order, each widget wrapped
            in the shared collapsible shell by renderColumnWidget */}
        <div className="space-y-5">
          {orderedRight.map((key) => renderColumnWidget(key))}
        </div>
      </div>
    </div>
  );
}
