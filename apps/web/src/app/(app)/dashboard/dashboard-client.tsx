"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  MapPin, Zap, DollarSign, Truck, ArrowRight,
  Home, Briefcase, Palmtree, TrendingUp, Edit, Plus,
  Calendar, PieChart, Loader2, SlidersHorizontal, X, GripVertical,
  AlertTriangle, Clock, Sparkles, Star,
} from "lucide-react";
import { StatsCard } from "@/components/dashboard/stats-card";
import { UpcomingBills } from "@/components/dashboard/upcoming-bills";
import { formatCurrency } from "@/lib/utils";
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

const typeIcons: Record<string, React.ElementType> = { HOME: Home, WORK: Briefcase, VACATION: Palmtree };
const categoryColors: Record<string, string> = {
  GOVERNMENT: "bg-red-500", UTILITY: "bg-amber-500", FINANCIAL: "bg-emerald-500",
  HOUSING: "bg-sky-500", HEALTHCARE: "bg-rose-500", TRANSPORTATION: "bg-blue-500",
  KIDS: "bg-purple-500", FITNESS: "bg-orange-500", SHOPPING: "bg-pink-500", OTHER: "bg-gray-500",
};
const CATEGORY_KEYS = ["GOVERNMENT", "UTILITY", "FINANCIAL", "HOUSING", "HEALTHCARE", "TRANSPORTATION", "KIDS", "FITNESS", "SHOPPING", "OTHER"] as const;

interface AddressInfo {
  id: string; type: string; nickname?: string; street: string; city: string; state: string; isPrimary: boolean;
  services?: { id: string; providerName: string; category: string; monthlyCost: number; createdAt?: string; website?: string }[];
}

interface DashboardStats {
  addressCount: number; serviceCount: number; monthlyExpenses: number;
  activePlan: { id: string; fromCity: string; toCity: string; moveDate: string; status: string } | null;
}

const WIDGET_KEYS = [
  { key: "stats", default: true },
  { key: "nextCritical", default: true },
  { key: "spending", default: true },
  { key: "moving", default: true },
  { key: "recent", default: true },
  { key: "bills", default: true },
  { key: "categories", default: true },
  { key: "topSpending", default: true },
] as const;

type WidgetKey = typeof WIDGET_KEYS[number]["key"];

const DEFAULT_ORDER: WidgetKey[] = WIDGET_KEYS.map((w) => w.key);
const DEFAULT_VISIBILITY = Object.fromEntries(
  WIDGET_KEYS.map((w) => [w.key, w.default])
) as Record<WidgetKey, boolean>;

export interface DashboardWidgetPrefs {
  order?: string[];
  visibility?: Record<string, boolean>;
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

function SortableItem({ id, label, dragLabel, enabled, onToggle }: { id: string; label: string; dragLabel: string; enabled: boolean; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      <button {...attributes} {...listeners} className="p-1 cursor-grab active:cursor-grabbing text-white/40 hover:text-white/60 touch-none" aria-label={dragLabel}>
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onToggle}
        aria-pressed={enabled}
        className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium border transition text-left ${
          enabled
            ? "border-orange-500/30 bg-orange-500/10 text-orange-300"
            : "border-white/10 text-white/50 hover:text-white/70"
        }`}
      >
        {label}
      </button>
    </div>
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
    recent: td("widget_recent"),
    bills: td("widget_bills"),
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
  const [widgets, setWidgets] = useState<Record<WidgetKey, boolean>>(() => normaliseVisibility(initialPrefs?.visibility));
  const [widgetOrder, setWidgetOrder] = useState<WidgetKey[]>(() => normaliseOrder(initialPrefs?.order));
  const [criticalActions, setCriticalActions] = useState<Array<{
    id: string;
    name: string;
    category: string;
    reason: string;
    deadline?: string;
  }>>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const persistPrefs = useCallback((next: { visibility?: Record<WidgetKey, boolean>; order?: WidgetKey[] }) => {
    const body: DashboardWidgetPrefs = {};
    if (next.visibility) body.visibility = next.visibility;
    if (next.order) body.order = next.order;
    fetch("/api/user/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  }, []);

  const toggleWidget = (key: WidgetKey) => {
    setWidgets((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      persistPrefs({ visibility: next, order: widgetOrder });
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
        persistPrefs({ visibility: widgets, order: next });
        return next;
      });
    }
  }, [persistPrefs, widgets]);

  const w = (key: WidgetKey) => widgets[key] !== false;

  // Which column each widget belongs to
  const leftWidgets: WidgetKey[] = ["nextCritical", "spending", "moving", "recent"];
  const rightWidgets: WidgetKey[] = ["bills", "categories", "topSpending"];
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

        const monthlyExpenses = services.reduce((sum: number, s: any) => sum + (s.monthlyCost || 0), 0);

        let activePlan: DashboardStats["activePlan"] = null;

        const inProgressPlan = plans.find((p: any) => p.status === "IN_PROGRESS") || plans[0];
        if (inProgressPlan) {
          activePlan = {
            id: inProgressPlan.id, fromCity: inProgressPlan.fromAddress?.city || "Origin",
            toCity: inProgressPlan.toAddress?.city || "Destination", moveDate: inProgressPlan.moveDate,
            status: inProgressPlan.status,
          };
        }

        const profile = profileData.profile || {};
        const sub = profileData.subscription || {};
        const hasPremium = sub.plan && sub.plan !== "FREE_TRIAL" && (sub.status === "ACTIVE" || (sub.premiumUntil && new Date(sub.premiumUntil) > new Date()));
        setIsPremium(!!hasPremium);
        setPremiumPlan(sub.plan || "");
        setStats({
          addressCount: addrs.length, serviceCount: services.length, monthlyExpenses,
          activePlan,
        });

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
            const completedCats: Set<string> = new Set(services.map((s: any) => s.category as string));
            const completedTemplates: Set<string> = new Set<string>();
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
              completedCats,
              completedTemplates,
              stateRule,
            );
            setChecklist(cl);
          } catch { /* non-blocking */ }
        }
      })
      .catch(() => { toast.error(td("loadFailed")); })
      .finally(() => setLoading(false));
  }, []);

  // Fetch "Next Critical Actions" for the widget (only if enabled)
  useEffect(() => {
    if (widgets.nextCritical === false) return;
    fetch("/api/providers/recommendations")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.nextCriticalActions) return;
        setCriticalActions(
          data.nextCriticalActions.slice(0, 3).map((p: any) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            reason: p.explanation?.reason || p.explanation?.headline || "",
            deadline: p.explanation?.deadline,
          }))
        );
      })
      .catch(() => {});
  }, [widgets.nextCritical]);

  const progress = checklist && checklist.totalItems > 0
    ? Math.round((checklist.completedItems / checklist.totalItems) * 100) : 0;

  // Compute spending by category
  const catBreakdown: Record<string, number> = {};
  allServices.forEach((s: any) => {
    const prefix = (s.category || "OTHER").split("_")[0];
    catBreakdown[prefix] = (catBreakdown[prefix] || 0) + (s.monthlyCost || 0);
  });
  const sortedCats = Object.entries(catBreakdown).sort((a, b) => b[1] - a[1]);
  const maxCatAmount = sortedCats.length > 0 ? sortedCats[0][1] : 1;

  // Top spending services
  const topServices = [...allServices]
    .sort((a: any, b: any) => (b.monthlyCost || 0) - (a.monthlyCost || 0))
    .slice(0, 5);

  // Recent services
  const recentServices = [...allServices]
    .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 5);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold text-white">{td("title")}</h1>
            {isPremium && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 border border-amber-500/30 text-amber-300 animate-pulse">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                {td("premiumBadge")}
              </span>
            )}
          </div>
          <p className="text-white/40 mt-1">{td("welcome")}. {td("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowWidgetPanel(!showWidgetPanel)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition ${
              showWidgetPanel ? "border-orange-500/30 bg-orange-500/10 text-orange-400" : "border-white/10 text-white/40 hover:bg-white/5"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" /> {td("customize")}
          </button>
          <Link href="/addresses/new">
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-sm text-white/60 hover:bg-white/5 transition">
              <MapPin className="h-4 w-4" /> {td("addAddressBtn")}
            </button>
          </Link>
          <Link href="/moving/new">
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition">
              <Truck className="h-4 w-4" /> {td("planMoveBtn")}
            </button>
          </Link>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="flex flex-wrap gap-2">
        <Link href="/services/new">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] text-xs text-white/50 hover:text-white hover:bg-white/5 transition">
            <Plus className="h-3 w-3" /> {td("addServiceBtn")}
          </button>
        </Link>
        <Link href="/budget">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] text-xs text-white/50 hover:text-white hover:bg-white/5 transition">
            <DollarSign className="h-3 w-3" /> {td("budgetBtn")}
          </button>
        </Link>
      </div>

      {/* Widget Customization Panel */}
      {showWidgetPanel && (
        <div className="rounded-2xl border border-orange-500/20 bg-white/5 backdrop-blur-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">{td("widget_panel_title")}</h3>
            <button onClick={() => setShowWidgetPanel(false)} className="p-1 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition">
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

      {/* Stats Grid */}
      {w("stats") && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <StatsCard title={td("stat_addresses")} value={stats.addressCount} icon={MapPin} description={stats.addressCount > 0 ? td("stat_addresses_primary", { count: addresses.filter(a => a.isPrimary).length }) : undefined} />
        <StatsCard title={td("stat_services")} value={stats.serviceCount} description={stats.monthlyExpenses > 0 ? td("stat_services_total", { amount: formatCurrency(stats.monthlyExpenses) }) : td("stat_services_acrossAll")} icon={Zap} />
        <Link href="/budget"><StatsCard title={td("stat_monthly")} value={formatCurrency(stats.monthlyExpenses)} icon={DollarSign} description={sortedCats.length > 0 ? td("stat_monthly_categories", { count: sortedCats.length }) : undefined} /></Link>
      </div>}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column — rendered in user's drag order */}
        <div className="lg:col-span-2 space-y-5">
          {orderedLeft.map((key) => {
            if (!w(key)) return null;
            switch (key) {
              case "nextCritical":
                return criticalActions.length > 0 ? (
                  <div key={key} className="rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-500/5 to-orange-500/5 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-red-400" />
                        <h3 className="text-sm font-bold text-white">{td("widget_nextCritical")}</h3>
                      </div>
                      <Link href="/providers">
                        <button className="text-[10px] text-white/30 hover:text-white transition">{td("browseAll")}</button>
                      </Link>
                    </div>
                    <p className="text-xs text-white/40">
                      {td("nextCritical_help")}
                    </p>
                    <div className="space-y-2">
                      {criticalActions.map((action) => (
                        <Link
                          key={action.id}
                          href={`/providers/${action.id}`}
                          className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition group"
                        >
                          <div className="h-9 w-9 rounded-lg bg-red-500/15 border border-red-500/20 flex items-center justify-center shrink-0">
                            <AlertTriangle className="h-4 w-4 text-red-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{action.name}</p>
                            <p className="text-xs text-white/50 truncate">
                              {(action.category || "").replace(/_/g, " ")}
                              {action.deadline ? ` · ${action.deadline}` : ""}
                            </p>
                            {action.reason && (
                              <p className="text-[11px] text-white/40 mt-0.5 line-clamp-1">{action.reason}</p>
                            )}
                          </div>
                          <ArrowRight className="h-4 w-4 text-white/30 group-hover:text-orange-400 transition shrink-0" />
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null;
              case "spending":
                return !loading && addresses.length > 0 ? (
                  <div key={key} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 pt-5 pb-3">
                      <div className="flex items-center gap-2">
                        <Home className="h-4 w-4 text-orange-400" />
                        <h3 className="text-sm font-semibold text-white">{td("widget_spending")}</h3>
                      </div>
                      <Link href="/addresses"><button className="text-[10px] text-white/30 hover:text-white transition">{td("viewAll")}</button></Link>
                    </div>
                    <div className="px-5 pb-5 space-y-2">
                      {addresses.map((addr) => {
                        const TypeIcon = typeIcons[addr.type] || MapPin;
                        const svcCount = addr.services?.length || 0;
                        const addrCost = addr.services?.reduce((sum: number, s: any) => sum + (s.monthlyCost || 0), 0) || 0;
                        const pct = stats.monthlyExpenses > 0 ? (addrCost / stats.monthlyExpenses) * 100 : 0;
                        return (
                          <Link key={addr.id} href={`/addresses/${addr.id}`}>
                            <div className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-all group cursor-pointer">
                              <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 group-hover:bg-orange-500 group-hover:border-orange-500 transition-colors shrink-0">
                                <TypeIcon className="h-4 w-4 text-orange-400 group-hover:text-white transition-colors" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-white truncate">{addr.nickname || addr.street}</p>
                                  {addr.isPrimary && <Star className="h-3 w-3 text-amber-400 fill-amber-400 shrink-0" />}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${addr.nickname || addr.street} spending percentage`}>
                                    <div className="h-full bg-gradient-to-r from-orange-500 to-cyan-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-xs text-white/50 shrink-0">{Math.round(pct)}%</span>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-semibold text-emerald-400">{formatCurrency(addrCost)}</p>
                                <p className="text-xs text-white/50">{td("servicesCount", { count: svcCount })}</p>
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
                  <div key={key} className="rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-transparent p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{phaseInfo?.icon || "🚚"}</span>
                        <div>
                          <h3 className="text-sm font-bold text-white">{td("section_moving")}</h3>
                          <p className="text-xs text-white/40">
                            {stats.activePlan.fromCity} → {stats.activePlan.toCity}
                            {checklist ? ` · ${td("moving_phase", { phase: checklist.currentPhase + 1, label: phaseInfo?.label || "" })}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-white">{checklist ? `${checklist.progressPercent}%` : `${progress}%`}</p>
                        <p className="text-[10px] text-white/30">
                          {checklist ? `${checklist.completedItems}/${checklist.totalItems}` : `${progress}%`} {td("moving_done")}
                        </p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-orange-500 to-cyan-500 transition-all duration-500"
                        style={{ width: `${checklist?.progressPercent ?? progress}%` }}
                      />
                    </div>

                    {/* Overdue items */}
                    {checklist && checklist.overdueItems.length > 0 && (
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                        <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-red-400">{td("moving_overdue")} ({checklist.overdueItems.length})</p>
                          <p className="text-xs text-red-300/70 mt-0.5">
                            {checklist.overdueItems.slice(0, 2).map((i: any) => i.title).join(" · ")}
                            {checklist.overdueItems.length > 2 && ` ${td("moving_overdueMore", { count: checklist.overdueItems.length - 2 })}`}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Urgent deadlines */}
                    {checklist && checklist.urgentItems.filter((i: any) => !i.isOverdue).length > 0 && (
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-amber-400">{td("moving_deadlineSoon")}</p>
                          <p className="text-xs text-amber-300/70 mt-0.5">
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
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                        <span className="text-base">{checklist.nextAction.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{checklist.nextAction.title}</p>
                          {checklist.nextAction.stateNote && (
                            <p className="text-[11px] text-amber-300/70 truncate">{checklist.nextAction.stateNote}</p>
                          )}
                          {checklist.nextAction.estimatedMinutes && (
                            <span className="text-xs text-white/50">~{checklist.nextAction.estimatedMinutes} {td("moving_minute")}</span>
                          )}
                        </div>
                        <Link href="/services">
                          <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-medium hover:bg-orange-600 transition whitespace-nowrap">
                            {t("doIt")} <ArrowRight className="h-3 w-3" />
                          </button>
                        </Link>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Link href={`/moving/${stats.activePlan.id}`} className="flex-1">
                        <button className="w-full py-2 rounded-xl border border-white/10 text-sm text-white/60 hover:bg-white/5 transition">{td("moving_viewPlan")}</button>
                      </Link>
                      <Link href="/services" className="flex-1">
                        <button className="w-full py-2 rounded-xl border border-orange-500/30 bg-orange-500/10 text-sm text-orange-400 hover:bg-orange-500/20 transition">{td("moving_checklist")}</button>
                      </Link>
                    </div>
                  </div>
                ) : !loading ? (
                  <div key={key} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 text-center">
                    <Truck className="h-10 w-10 mx-auto text-white/30 mb-2" />
                    <p className="text-sm text-white/30 mb-3">{td("moving_noPlan")}</p>
                    <Link href="/moving/new"><button className="px-4 py-2 rounded-xl border border-white/10 text-sm text-white/60 hover:bg-white/5 transition">{td("moving_planMove")}</button></Link>
                  </div>
                ) : null;
              }
              case "recent":
                return !loading && recentServices.length > 0 ? (
                  <div key={key} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 pt-5 pb-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-cyan-400" />
                        <h3 className="text-sm font-semibold text-white">{td("section_recent")}</h3>
                      </div>
                      <Link href="/services"><button className="text-[10px] text-white/30 hover:text-white transition">{td("viewAll")}</button></Link>
                    </div>
                    <div className="px-5 pb-5 space-y-1.5">
                      {recentServices.map((svc: any) => (
                        <div key={svc.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition group">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{svc.providerName}</p>
                            <p className="text-xs text-white/50">
                              {(svc.category || "").replace(/_/g, " ")}
                              {svc.address && ` · ${svc.address.city || ""}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {(svc.monthlyCost || 0) > 0 && (
                              <span className="text-xs font-medium text-white/50">{formatCurrency(svc.monthlyCost)}/mo</span>
                            )}
                            <Link href={`/services/${svc.id}`}>
                              <button className="p-1 rounded-md text-white/40 hover:text-orange-400 hover:bg-orange-500/10 transition opacity-0 group-hover:opacity-100" aria-label={td("recent_editService")}>
                                <Edit className="h-3 w-3" />
                              </button>
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              default: return null;
            }
          })}
        </div>

        {/* Right Column — rendered in user's drag order */}
        <div className="space-y-5">
          {orderedRight.map((key) => {
            if (!w(key)) return null;
            switch (key) {
              case "bills":
                return <UpcomingBills key={key} />;
              case "categories":
                return !loading && sortedCats.length > 0 ? (
                  <div key={key} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 pt-5 pb-3">
                      <div className="flex items-center gap-2">
                        <PieChart className="h-4 w-4 text-emerald-400" />
                        <h3 className="text-sm font-semibold text-white">{td("widget_categories")}</h3>
                      </div>
                      <span className="text-lg font-bold text-white">{formatCurrency(stats.monthlyExpenses)}</span>
                    </div>
                    <div className="px-5 pb-5 space-y-2.5">
                      {sortedCats.map(([cat, amount]) => (
                        <div key={cat} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-white/50 text-xs">{categoryLabels[cat] || cat}</span>
                            <span className="font-medium text-white/70 text-xs">{formatCurrency(amount)}</span>
                          </div>
                          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${categoryColors[cat] || "bg-gray-500"} transition-all`} style={{ width: `${(amount / maxCatAmount) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              case "topSpending":
                return !loading && topServices.length > 0 ? (
                  <div key={key} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 pt-5 pb-3">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-amber-400" />
                        <h3 className="text-sm font-semibold text-white">{td("widget_topSpending")}</h3>
                      </div>
                    </div>
                    <div className="px-5 pb-5 space-y-1.5">
                      {topServices.map((svc: any, i: number) => (
                        <div key={svc.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.03] transition">
                          <span className="text-xs font-bold text-white/40 w-4 text-center">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-white/70 truncate">{svc.providerName}</p>
                          </div>
                          <span className="text-xs font-semibold text-emerald-400 shrink-0">{formatCurrency(svc.monthlyCost)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              default: return null;
            }
          })}
        </div>
      </div>
    </div>
  );
}
