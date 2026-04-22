"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus, Zap, Search, Globe, ChevronRight, Star, MapPin, Home, Briefcase, Palmtree,
  AlertTriangle, Clock, ArrowRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { useTranslations } from "next-intl";
import {
  generateChecklist,
  RELOCATION_PHASES,
  type UserChecklistProfile,
  type RelocationChecklist,
  type ChecklistStateRuleContext,
} from "@/lib/shared-relocation";
import { getMergedDisplayCategoryIcon, getMergedDisplayCategoryLabel } from "@/lib/recommendation-engine";

const filterGroups = [
  { label: "All", value: "", icon: "📋" },
  { label: "Government", value: "GOVERNMENT", icon: "🏛️" },
  { label: "Utilities", value: "UTILITY", icon: "⚡" },
  { label: "Financial", value: "FINANCIAL", icon: "💳" },
  { label: "Housing", value: "HOUSING", icon: "🏠" },
  { label: "Healthcare", value: "HEALTHCARE", icon: "🏥" },
  { label: "Transport", value: "TRANSPORTATION", icon: "🚗" },
  { label: "Kids", value: "KIDS", icon: "👶" },
  { label: "Fitness", value: "FITNESS", icon: "💪" },
  { label: "Shopping", value: "SHOPPING", icon: "🛒" },
];

const groupLabels: Record<string, string> = {
  GOVERNMENT: "Government & Official", UTILITY: "Utilities", FINANCIAL: "Financial",
  HOUSING: "Housing", HEALTHCARE: "Healthcare", TRANSPORTATION: "Transportation",
  KIDS: "Kids & Education", FITNESS: "Fitness", SHOPPING: "Shopping & Other",
};
const groupIcons: Record<string, string> = {
  GOVERNMENT: "🏛️", UTILITY: "⚡", FINANCIAL: "💳", HOUSING: "🏠", HEALTHCARE: "🏥",
  TRANSPORTATION: "🚗", KIDS: "👶", FITNESS: "💪", SHOPPING: "🛒",
};
const typeIcons: Record<string, React.ElementType> = { HOME: Home, WORK: Briefcase, VACATION: Palmtree };

export interface ServicesAddress {
  id: string; nickname?: string; street: string; city: string; state: string; zip: string;
  type: string; isPrimary: boolean; ownership: string; startDate: string;
}

export interface ServicesItem {
  id: string; category: string; providerName: string;
  website?: string | null; phone?: string | null;
  monthlyCost: number; billingDay?: number | null; isActive?: boolean;
  addressId: string;
  address?: { nickname?: string; city?: string; state?: string };
  createdAt?: string;
}

export function ServicesClient({
  initialServices,
  initialAddresses,
}: {
  initialServices: ServicesItem[];
  initialAddresses: ServicesAddress[];
}) {
  const t = useTranslations("services");
  const tAddr = useTranslations("addresses");
  const tCommon = useTranslations("common");
  const [services] = useState<ServicesItem[]>(initialServices);
  const [addresses] = useState<ServicesAddress[]>(initialAddresses);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [addressFilter, setAddressFilter] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "cost-desc" | "cost-asc" | "newest" | "oldest">("name");
  const [showInactive, setShowInactive] = useState(true);
  const [checklist, setChecklist] = useState<RelocationChecklist | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [movingData, profileData] = await Promise.all([
          fetch("/api/moving").then((r) => r.json()),
          fetch("/api/profile").then((r) => r.json()),
        ]);
        const plans = movingData.plans || [];
        const activePlan = plans.find((p: any) => p.status === "PLANNING" || p.status === "IN_PROGRESS");
        if (!activePlan) return;
        const prof = profileData?.profile || profileData || {};
        const checklistProfile: UserChecklistProfile = {
          hasChildren: prof.hasChildren ?? false,
          childrenCount: prof.childrenCount ?? 0,
          hasPets: prof.hasPets ?? false,
          hasSenior: prof.hasSenior ?? false,
          carCount: prof.carCount ?? 0,
          hasDisability: prof.hasDisability ?? false,
          needsStorage: prof.needsStorage ?? false,
          hasMotorcycle: prof.hasMotorcycle ?? false,
          hasBoatRV: prof.hasBoatRV ?? false,
          isImmigrant: prof.isImmigrant ?? false,
          isBusinessOwner: prof.isBusinessOwner ?? false,
          moveType: prof.moveType || "PERSONAL",
        };
        const completedCats = new Set<string>(services.map((s) => s.category));
        const completedTemplates = new Set<string>(
          (activePlan.tasks || []).filter((t: any) => t.completed && t.templateId).map((t: any) => t.templateId as string)
        );
        const toState = activePlan.toAddress?.state || "";
        let stateRule: ChecklistStateRuleContext | null = null;
        if (toState) {
          try {
            const stateRuleRes = await fetch(`/api/state-rules?state=${toState}`).then((r) => r.json());
            stateRule = stateRuleRes.stateRule || null;
          } catch { stateRule = null; }
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
    })();
  }, [services]);

  const filtered = services
    .filter((s) => {
      if (search && !s.providerName.toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryFilter && !s.category.startsWith(categoryFilter)) return false;
      if (addressFilter && s.addressId !== addressFilter) return false;
      if (!showInactive && s.isActive === false) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "cost-desc": return (b.monthlyCost || 0) - (a.monthlyCost || 0);
        case "cost-asc": return (a.monthlyCost || 0) - (b.monthlyCost || 0);
        case "newest": return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        case "oldest": return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        default: return a.providerName.localeCompare(b.providerName);
      }
    });

  const totalMonthlyCost = filtered.reduce((sum, s) => sum + (s.monthlyCost || 0), 0);

  const grouped: Record<string, ServicesItem[]> = {};
  for (const s of filtered) {
    const prefix = s.category.split("_")[0];
    if (!grouped[prefix]) grouped[prefix] = [];
    grouped[prefix].push(s);
  }
  const groupOrder = ["GOVERNMENT", "UTILITY", "FINANCIAL", "HOUSING", "HEALTHCARE", "TRANSPORTATION", "KIDS", "FITNESS", "SHOPPING", "OTHER"];
  const sortedGroups = Object.keys(grouped).sort((a, b) => groupOrder.indexOf(a) - groupOrder.indexOf(b));

  const currentPhaseInfo = checklist ? RELOCATION_PHASES.find((p) => p.phase === checklist.currentPhase) : null;

  return (
    <div className="space-y-6">
      {checklist && (
        <div className="rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-transparent p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">{currentPhaseInfo?.icon || ""}</span>
              <div>
                <h2 className="text-sm font-bold text-white">Your Relocation Checklist</h2>
                <p className="text-xs text-white/40">
                  {checklist.fromState} → {checklist.toState} · Phase {checklist.currentPhase + 1}: {currentPhaseInfo?.label || ""}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-white">{checklist.progressPercent}%</p>
              <p className="text-[10px] text-white/30">{checklist.completedItems}/{checklist.totalItems} done</p>
            </div>
          </div>

          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-500" style={{ width: `${checklist.progressPercent}%` }} />
          </div>

          {checklist.overdueItems.length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-red-400">Overdue ({checklist.overdueItems.length})</p>
                <p className="text-xs text-red-300/70 mt-0.5">
                  {checklist.overdueItems.slice(0, 3).map((i) => i.title).join(" · ")}
                  {checklist.overdueItems.length > 3 && ` +${checklist.overdueItems.length - 3} more`}
                </p>
              </div>
            </div>
          )}

          {checklist.urgentItems.filter((i) => !i.isOverdue).length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-400">Deadline Soon</p>
                <p className="text-xs text-amber-300/70 mt-0.5">
                  {checklist.urgentItems.filter((i) => !i.isOverdue).slice(0, 3).map((i) => {
                    const dl = i.daysUntilDeadline !== null ? ` (${i.daysUntilDeadline}d)` : "";
                    return `${i.title}${dl}`;
                  }).join(" · ")}
                </p>
              </div>
            </div>
          )}

          {checklist.nextAction && !checklist.nextAction.isCompleted && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
              <span className="text-base">{checklist.nextAction.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{checklist.nextAction.title}</p>
                {checklist.nextAction.stateNote && (
                  <p className="text-[11px] text-amber-300/70 truncate">{checklist.nextAction.stateNote}</p>
                )}
                <p className="text-[11px] text-white/35 truncate">{checklist.nextAction.description}</p>
                {checklist.nextAction.estimatedMinutes && (
                  <span className="text-[10px] text-white/25">~{checklist.nextAction.estimatedMinutes} min</span>
                )}
              </div>
              <Link href="/services/new">
                <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-medium hover:bg-orange-600 transition whitespace-nowrap">
                  Do it <ArrowRight className="h-3 w-3" />
                </button>
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">{t("title")}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-white/40 text-sm">
              {filtered.length}
            </span>
            {totalMonthlyCost > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium">
                {formatCurrency(totalMonthlyCost)}/mo
              </span>
            )}
          </div>
        </div>
        <Link href="/services/new">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition">
            <Plus className="h-4 w-4" />{t("newTitle")}
          </button>
        </Link>
      </div>

      {addresses.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-white/30 uppercase tracking-wider">{tCommon("filter")}</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setAddressFilter("")}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                !addressFilter ? "bg-orange-500 text-white shadow-sm" : "bg-white/5 text-white/40 border border-white/[0.06] hover:bg-white/10"
              }`}
            >{tCommon("all")}</button>
            {addresses.map((addr) => {
              const TypeIcon = typeIcons[addr.type] || MapPin;
              const isActive = addressFilter === addr.id;
              const svcCount = services.filter((s) => s.addressId === addr.id).length;
              return (
                <button key={addr.id} onClick={() => setAddressFilter(isActive ? "" : addr.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? "bg-orange-500/10 text-orange-300 border border-orange-500/30 ring-1 ring-orange-500/20"
                      : "bg-white/[0.03] text-white/50 border border-white/[0.06] hover:bg-white/[0.06]"
                  }`}
                >
                  <TypeIcon className={`h-3.5 w-3.5 ${isActive ? "text-orange-400" : "text-white/25"}`} />
                  <span>{addr.nickname || `${addr.city}, ${addr.state}`}</span>
                  {addr.isPrimary && <Star className="h-3 w-3 text-amber-400 fill-amber-400" />}
                  <span className={`px-1.5 py-0 rounded-full text-[10px] ${isActive ? "bg-orange-500/20 text-orange-300" : "bg-white/5 text-white/25"}`}>{svcCount}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <input
              aria-label={tCommon("search")}
              placeholder={tCommon("search")}
              className="w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label={t("sortBy")}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/60 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition min-w-[140px]"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="name">{t("sort_name")}</option>
            <option value="cost-desc">{t("sort_costHigh")}</option>
            <option value="cost-asc">{t("sort_costLow")}</option>
            <option value="newest">{t("sort_newest")}</option>
            <option value="oldest">{t("sort_oldest")}</option>
          </select>
          <button
            onClick={() => setShowInactive(!showInactive)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-medium transition whitespace-nowrap ${
              showInactive
                ? "border-white/10 text-white/40 hover:bg-white/5"
                : "border-orange-500/30 bg-orange-500/10 text-orange-400"
            }`}
          >
            {showInactive ? tCommon("all") : tCommon("active")}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {filterGroups.map((g) => {
            const count = g.value ? services.filter((s) => s.category.startsWith(g.value)).length : services.length;
            if (g.value && count === 0) return null;
            return (
              <button
                key={g.value}
                onClick={() => setCategoryFilter(categoryFilter === g.value ? "" : g.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  categoryFilter === g.value
                    ? "bg-orange-500 text-white shadow-sm"
                    : "bg-white/5 text-white/40 hover:bg-white/10"
                }`}
              >
                <span>{g.icon}</span>
                {g.label}
                <span className={`px-1.5 py-0 rounded-full text-[10px] ${categoryFilter === g.value ? "bg-orange-500/20 text-orange-300" : "bg-white/5 text-white/25"}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Zap}
          title={services.length === 0 ? "No services yet" : "No matching services"}
          description={services.length === 0 ? "Add your first service to start tracking." : "Try a different search or filter."}
          actionLabel={services.length === 0 ? "Add Service" : undefined}
          actionHref={services.length === 0 ? "/services/new" : undefined}
        />
      ) : (
        <div className="space-y-5">
          {sortedGroups.map((prefix) => {
            const items = grouped[prefix];
            return (
              <div key={prefix} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-base">{groupIcons[prefix] || ""}</span>
                  <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wide">{groupLabels[prefix] || prefix}</h2>
                  <span className="text-[10px] text-white/20">{items.length}</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((service) => (
                    <Link key={service.id} href={`/services/${service.id}`}>
                      <div className="group rounded-xl border border-white/5 bg-white/[0.02] p-4 hover:bg-white/[0.05] hover:border-white/10 transition-all cursor-pointer">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg shrink-0">
                              {getMergedDisplayCategoryIcon(service.category)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h3 className="font-medium text-sm text-white truncate group-hover:text-orange-300 transition">{service.providerName}</h3>
                                <ChevronRight className="h-3.5 w-3.5 text-white/20 opacity-0 group-hover:opacity-100 transition shrink-0" />
                              </div>
                              <p className="text-[11px] text-white/35 mt-0.5">
                                {getMergedDisplayCategoryLabel(service.category)}
                              </p>
                              <div className="flex items-center gap-3 mt-2 text-xs text-white/30">
                                {service.address && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-2.5 w-2.5" />
                                    {service.address.nickname || `${service.address.city}, ${service.address.state}`}
                                  </span>
                                )}
                                {service.website && (
                                  <span className="flex items-center gap-1">
                                    <Globe className="h-2.5 w-2.5" />
                                    {service.website.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
                                  </span>
                                )}
                                {service.monthlyCost > 0 && (
                                  <span className="font-semibold text-emerald-400/70">{formatCurrency(service.monthlyCost)}/mo</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
