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
import { getMergedDisplayCategoryLabel } from "@/lib/recommendation-engine";
import {
  ServiceLogoMark,
  resolveServiceLogoUrl,
  shouldShowServiceLogo,
} from "@/components/services/service-logo-mark";
export {
  ServiceLogoMark,
  resolveServiceLogoUrl,
  shouldShowServiceLogo,
} from "@/components/services/service-logo-mark";

// filterGroups mapping — labels are keys to be translated
// Use getFilterGroups(t) to get translated version in the component
const FILTER_GROUPS_KEYS = [
  { label: "filterGroups.all", value: "", icon: "📋" },
  { label: "filterGroups.government", value: "GOVERNMENT", icon: "🏛️" },
  { label: "filterGroups.utilities", value: "UTILITY", icon: "⚡" },
  { label: "filterGroups.financial", value: "FINANCIAL", icon: "💳" },
  { label: "filterGroups.housing", value: "HOUSING", icon: "🏠" },
  { label: "filterGroups.healthcare", value: "HEALTHCARE", icon: "🏥" },
  { label: "filterGroups.transport", value: "TRANSPORTATION", icon: "🚗" },
  { label: "filterGroups.kids", value: "KIDS", icon: "👶" },
  { label: "filterGroups.fitness", value: "FITNESS", icon: "💪" },
  { label: "filterGroups.shopping", value: "SHOPPING", icon: "🛒" },
];

const GROUP_LABELS_KEYS: Record<string, string> = {
  GOVERNMENT: "groupLabels.government",
  UTILITY: "groupLabels.utilities",
  FINANCIAL: "groupLabels.financial",
  HOUSING: "groupLabels.housing",
  HEALTHCARE: "groupLabels.healthcare",
  TRANSPORTATION: "groupLabels.transport",
  KIDS: "groupLabels.kids",
  FITNESS: "groupLabels.fitness",
  SHOPPING: "groupLabels.shopping",
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
  provider?: { id?: string; name?: string | null; logoUrl?: string | null; website?: string | null } | null;
  customProvider?: { id?: string; name?: string | null; website?: string | null } | null;
  providerLogoUrl?: string | null;
  logoUrl?: string | null;
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
  const [checklist, setChecklist] = useState<RelocationChecklist | null>(null);

  // Build filter groups with translated labels
  const filterGroups = FILTER_GROUPS_KEYS.map((g) => ({
    label: t(g.label as any),
    value: g.value,
    icon: g.icon,
  }));

  // Build group labels record with translated values
  const groupLabels: Record<string, string> = Object.fromEntries(
    Object.entries(GROUP_LABELS_KEYS).map(([key, translationKey]) => [key, t(translationKey as any)])
  );

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
        <div className="rounded-2xl border border-tone-orange-br bg-gradient-to-br from-primary0/5 to-transparent p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">{currentPhaseInfo?.icon || ""}</span>
              <div>
                <h2 className="text-sm font-bold text-foreground">{t("checklist.heading")}</h2>
                <p className="text-xs text-muted-foreground">
                  {checklist.fromState} → {checklist.toState} · Phase {checklist.currentPhase + 1}: {currentPhaseInfo?.label || ""}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-foreground">{checklist.progressPercent}%</p>
              <p className="text-[10px] text-foreground/40">{t("checklist.progressDone", { percent: checklist.progressPercent })}</p>
            </div>
          </div>

          <div className="h-2 rounded-full bg-foreground/5 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-primary0 to-accent transition-all duration-500" style={{ width: `${checklist.progressPercent}%` }} />
          </div>

          {checklist.overdueItems.length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-destructive">{t("checklist.overdue", { count: checklist.overdueItems.length })}</p>
                <p className="text-xs text-destructive/70 mt-0.5">
                  {checklist.overdueItems.slice(0, 3).map((i) => i.title).join(" · ")}
                  {checklist.overdueItems.length > 3 && ` +${checklist.overdueItems.length - 3} more`}
                </p>
              </div>
            </div>
          )}

          {checklist.urgentItems.filter((i) => !i.isOverdue).length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-tone-honey-bg border border-tone-honey-br">
              <Clock className="h-4 w-4 text-tone-honey-fg shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-tone-honey-fg">{t("checklist.deadlineSoon")}</p>
                <p className="text-xs text-tone-honey-fg/70 mt-0.5">
                  {checklist.urgentItems.filter((i) => !i.isOverdue).slice(0, 3).map((i) => {
                    const dl = i.daysUntilDeadline !== null ? ` (${i.daysUntilDeadline}d)` : "";
                    return `${i.title}${dl}`;
                  }).join(" · ")}
                </p>
              </div>
            </div>
          )}

          {checklist.nextAction && !checklist.nextAction.isCompleted && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-foreground/[0.03] border border-border">
              <span className="text-base">{checklist.nextAction.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{checklist.nextAction.title}</p>
                {checklist.nextAction.stateNote && (
                  <p className="text-[11px] text-tone-honey-fg/70 truncate">{checklist.nextAction.stateNote}</p>
                )}
                <p className="text-[11px] text-foreground/35 truncate">{checklist.nextAction.description}</p>
                {checklist.nextAction.estimatedMinutes && (
                  <span className="text-[10px] text-foreground/35">~{checklist.nextAction.estimatedMinutes} min</span>
                )}
              </div>
              <Link href="/services/new">
                <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-tone-orange-fg text-white text-xs font-medium hover:bg-tone-orange-bg transition whitespace-nowrap">
                  {t("doIt")} <ArrowRight className="h-3 w-3" />
                </button>
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">{t("title")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground/45">
            Services are the actual accounts you track at an address. They can link to listed providers or private local/custom providers.
          </p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-muted-foreground text-sm">
              {filtered.length}
            </span>
            {totalMonthlyCost > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-tone-emerald-bg text-tone-emerald-fg text-xs font-medium">
                {formatCurrency(totalMonthlyCost)}/mo
              </span>
            )}
          </div>
        </div>
        <Link href="/services/new">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-tone-orange-fg text-white text-sm font-medium hover:bg-tone-orange-bg transition">
            <Plus className="h-4 w-4" />{t("newTitle")}
          </button>
        </Link>
      </div>

      {addresses.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-foreground/40 uppercase tracking-wider">{tCommon("filter")}</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setAddressFilter("")}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                !addressFilter ? "bg-tone-orange-fg text-white shadow-sm" : "bg-foreground/5 text-muted-foreground border border-foreground/[0.06] hover:bg-foreground/10"
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
                      ? "bg-tone-orange-bg text-tone-orange-fg border border-tone-orange-br ring-1 ring-primary/20"
                      : "bg-foreground/[0.03] text-muted-foreground border border-foreground/[0.06] hover:bg-foreground/[0.06]"
                  }`}
                >
                  <TypeIcon className={`h-3.5 w-3.5 ${isActive ? "text-tone-orange-fg" : "text-foreground/35"}`} />
                  <span>{addr.nickname || `${addr.city}, ${addr.state}`}</span>
                  {addr.isPrimary && <Star className="h-3 w-3 text-tone-honey-fg fill-amber-400" />}
                  <span className={`px-1.5 py-0 rounded-full text-[10px] ${isActive ? "bg-tone-orange-bg text-tone-orange-fg" : "bg-foreground/5 text-foreground/35"}`}>{svcCount}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
            <input
              aria-label={tCommon("search")}
              placeholder={tCommon("search")}
              className="w-full rounded-xl border border-border bg-foreground/5 pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label={t("sortBy")}
            className="rounded-xl border border-border bg-foreground/5 px-3 py-2.5 text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition min-w-[140px]"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="name">{t("sort_name")}</option>
            <option value="cost-desc">{t("sort_costHigh")}</option>
            <option value="cost-asc">{t("sort_costLow")}</option>
            <option value="newest">{t("sort_newest")}</option>
            <option value="oldest">{t("sort_oldest")}</option>
          </select>
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
                    ? "bg-tone-orange-fg text-white shadow-sm"
                    : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10"
                }`}
              >
                <span>{g.icon}</span>
                {g.label}
                <span className={`px-1.5 py-0 rounded-full text-[10px] ${categoryFilter === g.value ? "bg-tone-orange-bg text-tone-orange-fg" : "bg-foreground/5 text-foreground/35"}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (() => {
        const isFilteredEmpty = services.length > 0;
        const suggestParams = new URLSearchParams({ suggest: "1" });
        if (search.trim()) suggestParams.set("suggestName", search.trim().slice(0, 200));
        if (categoryFilter) suggestParams.set("category", categoryFilter);
        if (addressFilter) suggestParams.set("addressId", addressFilter);
        const suggestHref = `/services/new?${suggestParams.toString()}`;
        return (
          <EmptyState
            icon={Zap}
            title={isFilteredEmpty ? t("emptyStates.noMatchingServices") : t("emptyStates.noServices")}
            description={isFilteredEmpty ? t("emptyStates.tryDifferentFilter") : t("emptyStates.addFirstService")}
            actionLabel={isFilteredEmpty ? t("emptyStates.suggestProvider") : t("emptyStates.addService")}
            actionHref={isFilteredEmpty ? suggestHref : "/services/new"}
            secondaryActionLabel={isFilteredEmpty ? t("emptyStates.addService") : undefined}
            secondaryActionHref={isFilteredEmpty ? "/services/new" : undefined}
          />
        );
      })() : (
        <div className="space-y-5">
          {sortedGroups.map((prefix) => {
            const items = grouped[prefix];
            return (
              <div key={prefix} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-base">{groupIcons[prefix] || ""}</span>
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{groupLabels[prefix] || prefix}</h2>
                  <span className="text-[10px] text-foreground/30">{items.length}</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((service) => (
                    <Link key={service.id} href={`/services/${service.id}`}>
                      <div className="group rounded-xl border border-border bg-foreground/[0.02] p-4 hover:bg-foreground/[0.05] hover:border-border transition-all cursor-pointer">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <ServiceLogoMark service={service} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h3 className="font-medium text-sm text-foreground truncate group-hover:text-tone-orange-fg transition">{service.providerName}</h3>
                                <ChevronRight className="h-3.5 w-3.5 text-foreground/30 opacity-0 group-hover:opacity-100 transition shrink-0" />
                              </div>
                              <p className="text-[11px] text-foreground/35 mt-0.5">
                                {getMergedDisplayCategoryLabel(service.category)}
                              </p>
                              <div className="flex items-center gap-3 mt-2 text-xs text-foreground/40">
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
                                  <span className="font-semibold text-tone-emerald-fg/70">{formatCurrency(service.monthlyCost)}/mo</span>
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
