"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus, Zap, Search, Globe, ChevronRight, Star, MapPin, Home, Briefcase, Palmtree,
  AlertTriangle, Clock, ArrowRight, Baby, Car, ClipboardList, CreditCard, Dumbbell,
  Hospital, Landmark, ShoppingCart,
  Sparkles,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { AffiliateCtaButton } from "@/components/affiliate/affiliate-cta-button";
import { AffiliateDisclosure } from "@/components/affiliate/affiliate-disclosure";
import { useTranslations } from "next-intl";
import {
  generateChecklist,
  RELOCATION_PHASES,
  type UserChecklistProfile,
  type RelocationChecklist,
  type ChecklistStateRuleContext,
} from "@/lib/shared-relocation";
import { getMergedDisplayCategoryKey, getMergedDisplayCategoryLabel } from "@/lib/recommendation-engine";
import { monthlyAmountForCycle, cycleLabel } from "@/lib/budget-planning";
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
  { label: "filterGroups.all", value: "" },
  { label: "filterGroups.government", value: "GOVERNMENT" },
  { label: "filterGroups.utilities", value: "UTILITY" },
  { label: "filterGroups.financial", value: "FINANCIAL" },
  { label: "filterGroups.housing", value: "HOUSING" },
  { label: "filterGroups.healthcare", value: "HEALTHCARE" },
  { label: "filterGroups.transport", value: "TRANSPORTATION" },
  { label: "filterGroups.kids", value: "KIDS" },
  { label: "filterGroups.fitness", value: "FITNESS" },
  { label: "filterGroups.shopping", value: "SHOPPING" },
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
const groupIconComponents: Record<string, React.ElementType> = {
  "": ClipboardList,
  GOVERNMENT: Landmark,
  UTILITY: Zap,
  FINANCIAL: CreditCard,
  HOUSING: Home,
  HEALTHCARE: Hospital,
  TRANSPORTATION: Car,
  KIDS: Baby,
  FITNESS: Dumbbell,
  SHOPPING: ShoppingCart,
  OTHER: ClipboardList,
};
const typeIcons: Record<string, React.ElementType> = { HOME: Home, WORK: Briefcase, VACATION: Palmtree };

const GROUP_ORDER = ["GOVERNMENT", "UTILITY", "FINANCIAL", "HOUSING", "HEALTHCARE", "TRANSPORTATION", "KIDS", "FITNESS", "SHOPPING", "OTHER"];

// Solid tone fills for the stacked by-category cost bar + its legend dots.
// Full literal class names (Tailwind can't see interpolated ones). Cool tones
// only — honey/foil stay reserved for premium moments. Adjacent categories in
// GROUP_ORDER never share a tone.
const CATEGORY_TONE_BG: Record<string, string> = {
  GOVERNMENT: "bg-tone-slate-fg",
  UTILITY: "bg-tone-sky-fg",
  FINANCIAL: "bg-tone-sage-fg",
  HOUSING: "bg-tone-rose-fg",
  HEALTHCARE: "bg-tone-cyan-fg",
  TRANSPORTATION: "bg-tone-umber-fg",
  KIDS: "bg-tone-rose-fg",
  FITNESS: "bg-tone-sage-fg",
  SHOPPING: "bg-tone-slate-fg",
  OTHER: "bg-tone-umber-fg",
};

/* ── Renewal derivation ─────────────────────────────────────────────────────
 * Mirrors apps/mobile/src/lib/service-insights.ts (resolveServiceRenewal →
 * nextBillingDate + RENEWAL_SOON_DAYS). The web list payload now carries
 * `contractEndDate`/`autoRenewal` alongside `billingDay`/`billingCycle`
 * (see ./page.tsx mapping), so — exactly like mobile — an explicit contract
 * end date wins over the recurring billing day. Contract dates may be in the
 * past (overdue); billing-derived dates are always today-or-future by
 * construction. When neither signal exists we have no renewal date — we
 * never fabricate one.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
/** "Soon" threshold (days) for flagging an imminent renewal — same as mobile. */
const RENEWAL_SOON_DAYS = 7;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysUntil(target: Date, now: Date): number {
  return Math.round((startOfDay(target).getTime() - startOfDay(now).getTime()) / DAY_MS);
}

/** Months to advance per billing cycle (defaults to monthly when unknown). */
function cycleMonths(cycle?: string | null): number {
  switch ((cycle || "MONTHLY").toUpperCase()) {
    case "YEARLY":
    case "ANNUAL":
      return 12;
    case "QUARTERLY":
      return 3;
    case "ONE_TIME":
      return 0; // no recurrence
    case "MONTHLY":
    default:
      return 1;
  }
}

/**
 * Next billing date from `billingDay` + `billingCycle`, strictly today or in
 * the future. Clamps the day to the target month's length (day 31 in a 30-day
 * month lands on the 30th). Returns null when there's no usable signal.
 */
function nextBillingRenewal(
  service: Pick<ServicesItem, "billingDay" | "billingCycle">,
  now: Date,
): { date: Date; days: number } | null {
  const billingDay = service.billingDay;
  if (billingDay == null || !Number.isFinite(billingDay) || billingDay < 1 || billingDay > 31) {
    return null;
  }
  const step = cycleMonths(service.billingCycle);
  const today = startOfDay(now);

  const clampedFor = (year: number, month: number): Date => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(billingDay, lastDay));
  };

  let candidate = clampedFor(today.getFullYear(), today.getMonth());
  if (candidate.getTime() >= today.getTime()) {
    return { date: candidate, days: daysUntil(candidate, now) };
  }
  // One-time bill whose day already passed this month has no future date.
  if (step === 0) return null;
  let guard = 0;
  while (candidate.getTime() < today.getTime() && guard < 60) {
    candidate = clampedFor(today.getFullYear(), today.getMonth() + step * (guard + 1));
    guard += 1;
  }
  return { date: candidate, days: daysUntil(candidate, now) };
}

export interface ServiceRenewalSignal {
  date: Date;
  /** Whole calendar days until `date` (negative = overdue contract end). */
  days: number;
  /** Which field the date came from — drives the honest label choice. */
  source: "contract" | "billing";
}

/**
 * Resolve a service's next renewal/end date — `contractEndDate` wins over the
 * recurring billing day because it's the more specific, user-entered
 * commitment (same priority as mobile's `resolveServiceRenewal`). Returns null
 * when the service carries no usable date signal. Exported for tests.
 */
export function resolveServiceRenewalSignal(
  service: Pick<ServicesItem, "billingDay" | "billingCycle" | "contractEndDate">,
  now: Date,
): ServiceRenewalSignal | null {
  if (service.contractEndDate) {
    const d = new Date(service.contractEndDate);
    if (!Number.isNaN(d.getTime())) {
      return { date: d, days: daysUntil(d, now), source: "contract" };
    }
  }
  const billing = nextBillingRenewal(service, now);
  if (billing) {
    return { date: billing.date, days: billing.days, source: "billing" };
  }
  return null;
}

export interface ServicesAddress {
  id: string; nickname?: string; street: string; city: string; state: string; zip: string;
  type: string; isPrimary: boolean; ownership: string; startDate: string;
}

export interface ServicesItem {
  id: string; category: string; providerName: string;
  website?: string | null; phone?: string | null;
  monthlyCost: number; billingCycle?: string | null; billingDay?: number | null; isActive?: boolean;
  /** ISO date — explicit contract end/renewal date the user entered, if any. */
  contractEndDate?: string | null;
  /** Whether the user marked the service as auto-renewing (null = unknown). */
  autoRenewal?: boolean | null;
  addressId: string;
  address?: { nickname?: string; city?: string; state?: string };
  provider?: { id?: string; name?: string | null; logoUrl?: string | null; website?: string | null; affiliateActive?: boolean } | null;
  customProvider?: { id?: string; name?: string | null; website?: string | null } | null;
  providerLogoUrl?: string | null;
  logoUrl?: string | null;
  createdAt?: string;
}

interface RecommendationProviderPayload {
  id: string;
  name: string;
  category: string;
  matchReasons?: string[] | null;
  explanation?: { reason?: string | null; profileMatch?: string | null } | null;
}

interface RecommendationGuidePayload {
  summary?: string | null;
  completion?: {
    score: number;
    completedCritical: number;
    missingCritical: number;
    missingLabels: string[];
    nextBestCategory: string | null;
  } | null;
  decisionModel?: {
    title: string;
    factors: string[];
    learningSignals: string[];
    coverageWarnings: string[];
  } | null;
  lanes?: Array<{
    key: string;
    title: string;
    description?: string | null;
    providers?: RecommendationProviderPayload[] | null;
  }> | null;
}

interface ProviderPlanPayload {
  stats?: { missingCritical?: string[]; completedCritical?: number };
  recommendationGuide?: RecommendationGuidePayload | null;
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
  const [providerPlan, setProviderPlan] = useState<ProviderPlanPayload | null>(null);

  // Build filter groups with translated labels
  const filterGroups = FILTER_GROUPS_KEYS.map((g) => ({
    label: t(g.label as any),
    value: g.value,
    Icon: groupIconComponents[g.value] ?? ClipboardList,
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
        // Reflect completed MoveTasks in the checklist: a generated task now
        // persists `templateId` (the checklist item it maps to), so a COMPLETED
        // task with a non-null templateId marks that checklist item DONE. Tasks
        // without a templateId (no matching checklist item) are simply skipped.
        const completedTemplates = new Set<string>();
        try {
          const moveTasksRes = await fetch(
            `/api/move-tasks?movingPlanId=${activePlan.id}&status=COMPLETED`,
          ).then((r) => r.json());
          for (const t of moveTasksRes?.tasks || []) {
            if (t?.templateId && t?.status === "COMPLETED") completedTemplates.add(t.templateId);
          }
        } catch { /* non-blocking: fall back to empty set */ }
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

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const params = new URLSearchParams();
        if (addressFilter) params.set("addressId", addressFilter);
        const response = await fetch(`/api/providers/recommendations?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          setProviderPlan(null);
          return;
        }
        const json = (await response.json()) as ProviderPlanPayload;
        setProviderPlan(json);
      } catch (error: any) {
        if (error?.name !== "AbortError") setProviderPlan(null);
      }
    })();
    return () => controller.abort();
  }, [addressFilter]);

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

  // Normalize each per-cycle cost to its true monthly value (yearly/12, quarterly/3,
  // ONE_TIME → 0) so the "/mo" total isn't inflated by non-monthly services and
  // matches the budget page. The per-card amount below keeps its own cycle label.
  const totalMonthlyCost = filtered.reduce((sum, s) => sum + monthlyAmountForCycle(s.monthlyCost || 0, s.billingCycle), 0);

  const grouped: Record<string, ServicesItem[]> = {};
  for (const s of filtered) {
    const prefix = s.category.split("_")[0];
    if (!grouped[prefix]) grouped[prefix] = [];
    grouped[prefix].push(s);
  }
  const sortedGroups = Object.keys(grouped).sort((a, b) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b));

  const currentPhaseInfo = checklist ? RELOCATION_PHASES.find((p) => p.phase === checklist.currentPhase) : null;

  // ── Aurora stat-row derivations (mirrors the mobile services hero) ──
  // Computed over ALL services, not `filtered`, so the overview stays stable
  // while the user pivots the search/category/address filters below it.
  // Costs are cycle-normalized exactly like `totalMonthlyCost` above.
  const now = new Date();
  const overviewMonthly = services.reduce(
    (sum, s) => sum + monthlyAmountForCycle(s.monthlyCost || 0, s.billingCycle),
    0,
  );
  const activeCount = services.filter((s) => s.isActive !== false).length;

  const categoryTotalMap = new Map<string, number>();
  for (const s of services) {
    const prefix = s.category.split("_")[0];
    const key = GROUP_ORDER.includes(prefix) ? prefix : "OTHER";
    categoryTotalMap.set(
      key,
      (categoryTotalMap.get(key) || 0) + monthlyAmountForCycle(s.monthlyCost || 0, s.billingCycle),
    );
  }
  const categoryTotals = [...categoryTotalMap.entries()]
    .map(([prefix, total]) => ({ prefix, total }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);

  // "Needs attention" — derived ONLY from existing renewal signals
  // (contractEndDate, or recurring billingDay + billingCycle), the exact
  // derivation mobile uses. Includes overdue contract ends (days < 0). No new
  // data concepts.
  const attentionItems: { service: ServicesItem; renewal: ServiceRenewalSignal }[] = [];
  for (const s of services) {
    if (s.isActive === false) continue;
    const renewal = resolveServiceRenewalSignal(s, now);
    if (renewal && renewal.days <= RENEWAL_SOON_DAYS) {
      attentionItems.push({ service: s, renewal });
    }
  }
  attentionItems.sort((a, b) => a.renewal.days - b.renewal.days);
  const providerMissingCategories = Array.from(new Set(providerPlan?.stats?.missingCritical || []));
  const providerMissingKeys = new Set(providerMissingCategories.map((category) => getMergedDisplayCategoryKey(category)));
  const providerGapItems = (providerPlan?.recommendationGuide?.lanes || [])
    .filter((lane) => lane.key === "setup_first" || lane.key === "best_matches")
    .flatMap((lane) => lane.providers || [])
    .filter((provider, index, providers) => {
      if (!provider?.id || !provider.category) return false;
      if (!providerMissingKeys.has(getMergedDisplayCategoryKey(provider.category))) return false;
      return providers.findIndex((item) => item.id === provider.id) === index;
    })
    .slice(0, 4);
  const providerGapCount = providerMissingCategories.length;
  const providerGapLabels = providerMissingCategories.slice(0, 5).map((category) => getMergedDisplayCategoryLabel(category));
  const gapAddressId = addressFilter || addresses.find((address) => address.isPrimary)?.id || addresses[0]?.id || "";
  const providerGapParams = new URLSearchParams();
  if (gapAddressId) providerGapParams.set("addressId", gapAddressId);
  if (providerGapItems.length > 0) providerGapParams.set("providerIds", providerGapItems.map((provider) => provider.id).join(","));
  if (providerGapItems[0]?.category || providerMissingCategories[0]) {
    providerGapParams.set("category", providerGapItems[0]?.category || providerMissingCategories[0]);
  }
  providerGapParams.set("guide", "services_health");
  const providerGapHref = `/services/new?${providerGapParams.toString()}`;

  const renewalCopy = (days: number) =>
    days <= 0
      ? t("attention.renewsToday")
      : days === 1
        ? t("attention.renewsTomorrow")
        : t("attention.renewsInDays", { days });

  // Honest label per signal: recurring billing dates (always today-or-future)
  // and auto-renewing contracts genuinely "renew", so they use the relative
  // renews-in copy. A contract that is NOT marked auto-renew (or whose end
  // date already passed) only tells us when the contract ends — for those we
  // state the factual end date instead of claiming a renewal. Reuses existing
  // catalog keys only; date format mirrors the service detail page (en-US,
  // US-only product).
  const attentionLabel = (service: ServicesItem, renewal: ServiceRenewalSignal) => {
    if (renewal.source === "billing" || (service.autoRenewal === true && renewal.days >= 0)) {
      return renewalCopy(renewal.days);
    }
    const dateLabel = renewal.date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `${t("contractEndDate")}: ${dateLabel}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-primary">{t("eyebrow")}</p>
          <h1 className="font-display h2 mt-1 text-3xl md:text-4xl text-foreground">
            {t.rich("heroTitle", { em: (chunks) => <em>{chunks}</em> })}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-foreground/45">{t("subtitle")}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="font-mono text-muted-foreground text-sm">
              {filtered.length}
            </span>
            {totalMonthlyCost > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-tone-emerald-bg text-tone-emerald-fg text-xs font-mono font-medium">
                {formatCurrency(totalMonthlyCost)}/mo
              </span>
            )}
          </div>
        </div>
        <Link
          href="/services/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-br from-primary to-primary/85 text-primary-foreground text-sm font-medium shadow-sm hover:opacity-90 transition"
        >
          <Plus className="h-4 w-4" />{t("newTitle")}
        </Link>
      </div>

      {/* Aurora stat row — overall numbers, stable while filters pivot the list */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_1.6fr]">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{t("stats.perMonth")}</p>
          <p className="mt-2 font-mono text-2xl font-bold text-foreground leading-none">{formatCurrency(overviewMonthly)}</p>
          <p className="mt-2 text-[11px] text-foreground/45">{t("stats.acrossServices", { count: services.length })}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{t("stats.active")}</p>
          <p className="mt-2 font-mono text-2xl font-bold text-foreground leading-none">{activeCount}</p>
          <p className="mt-2 text-[11px] text-foreground/45">{t("stats.activeHint")}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{t("stats.needsAttention")}</p>
          <p className={`mt-2 font-mono text-2xl font-bold leading-none ${attentionItems.length > 0 ? "text-destructive" : "text-foreground"}`}>{attentionItems.length}</p>
          <p className="mt-2 text-[11px] text-foreground/45">
            {attentionItems.length > 0 ? t("stats.attentionHint", { days: RENEWAL_SOON_DAYS }) : t("stats.allClear")}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Setup gaps</p>
          <p className={`mt-2 font-mono text-2xl font-bold leading-none ${providerGapCount > 0 ? "text-tone-honey-fg" : "text-foreground"}`}>
            {providerGapCount}
          </p>
          <p className="mt-2 text-[11px] text-foreground/45">
            {providerGapCount > 0 ? "Critical providers still missing" : "Core provider setup looks covered"}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 sm:col-span-2 xl:col-span-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{t("stats.byCategory")}</p>
          {categoryTotals.length > 0 ? (
            <>
              <div className="mt-3 flex h-2 gap-[3px]" aria-hidden>
                {categoryTotals.map((c) => (
                  <span
                    key={c.prefix}
                    className={`rounded-full ${CATEGORY_TONE_BG[c.prefix] || "bg-tone-slate-fg"}`}
                    style={{ flex: c.total }}
                  />
                ))}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
                {categoryTotals.slice(0, 4).map((c) => (
                  <span key={c.prefix} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className={`h-2 w-2 rounded-[3px] ${CATEGORY_TONE_BG[c.prefix] || "bg-tone-slate-fg"}`} aria-hidden />
                    {groupLabels[c.prefix] || c.prefix}
                    <span className="font-mono text-foreground/60">{formatCurrency(c.total)}</span>
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-3 text-[11px] text-foreground/45">{t("stats.noCosts")}</p>
          )}
        </div>
      </div>

      {providerGapCount > 0 && (
        <div className="rounded-2xl border border-tone-honey-br bg-tone-honey-bg p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-tone-honey-fg" />
                <h2 className="font-display text-sm font-bold text-foreground">Missing essentials</h2>
                {providerPlan?.recommendationGuide?.completion ? (
                  <span className="rounded-full border border-tone-honey-br bg-background px-2 py-0.5 font-mono text-[10px] font-semibold text-tone-honey-fg">
                    {providerPlan.recommendationGuide.completion.score}% ready
                  </span>
                ) : null}
              </div>
              <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">
                {providerPlan?.recommendationGuide?.summary ||
                  `Your setup is missing ${providerGapLabels.join(", ")}. Add the right providers now so Services reflects the real move plan.`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {providerGapLabels.map((label) => (
                  <span key={label} className="rounded-full border border-tone-honey-br bg-background px-2.5 py-1 text-xs text-tone-honey-fg">
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <Link
              href={providerGapHref}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-tone-honey-br bg-background px-4 py-2 text-sm font-semibold text-tone-honey-fg transition hover:bg-tone-honey-bg"
            >
              Add recommended picks <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {providerGapItems.length > 0 && (
            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {providerGapItems.map((provider) => (
                <Link
                  key={provider.id}
                  href={`/services/new?addressId=${encodeURIComponent(gapAddressId)}&providerId=${encodeURIComponent(provider.id)}&category=${encodeURIComponent(provider.category)}&guide=services_health`}
                  className="rounded-xl border border-border bg-card p-3 transition hover:bg-background"
                >
                  <p className="truncate text-sm font-semibold text-foreground">{provider.name}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{getMergedDisplayCategoryLabel(provider.category)}</p>
                  <p className="mt-2 line-clamp-2 text-[11px] text-muted-foreground">
                    {provider.explanation?.reason || provider.explanation?.profileMatch || provider.matchReasons?.[0] || "Recommended for this setup gap."}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {checklist && (
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
                <ClipboardList className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-display text-sm font-bold text-foreground">{t("checklist.heading")}</h2>
                <p className="text-xs text-muted-foreground">
                  {checklist.fromState} → {checklist.toState} · Phase {checklist.currentPhase + 1}: {currentPhaseInfo?.label || ""}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-mono text-lg font-bold text-foreground">{checklist.progressPercent}%</p>
              <p className="text-[10px] text-foreground/40">{t("checklist.progressDone", { percent: checklist.progressPercent })}</p>
            </div>
          </div>

          <div className="h-2 rounded-full bg-foreground/5 overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${checklist.progressPercent}%` }} />
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
              <Link
                href="/services/new"
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-br from-primary to-primary/85 text-primary-foreground text-xs font-medium shadow-sm hover:opacity-90 transition whitespace-nowrap"
              >
                {t("doIt")} <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>
      )}

      {addresses.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-foreground/40 uppercase tracking-wider">{tCommon("filter")}</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setAddressFilter("")}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                !addressFilter ? "bg-primary text-primary-foreground shadow-sm" : "bg-foreground/5 text-muted-foreground border border-border hover:bg-foreground/10"
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
                      ? "bg-primary/10 text-primary border border-primary/30 ring-1 ring-primary/20"
                      : "bg-foreground/[0.03] text-muted-foreground border border-border hover:bg-foreground/[0.06]"
                  }`}
                >
                  <TypeIcon className={`h-3.5 w-3.5 ${isActive ? "text-primary" : "text-foreground/35"}`} />
                  <span>{addr.nickname || `${addr.city}, ${addr.state}`}</span>
                  {addr.isPrimary && <Star className="h-3 w-3 text-tone-honey-fg fill-warning" />}
                  <span className={`px-1.5 py-0 rounded-full font-mono text-[10px] ${isActive ? "bg-primary/15 text-primary" : "bg-foreground/5 text-foreground/35"}`}>{svcCount}</span>
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
            const Icon = g.Icon;
            return (
              <button
                key={g.value}
                onClick={() => setCategoryFilter(categoryFilter === g.value ? "" : g.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  categoryFilter === g.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {g.label}
                <span className={`px-1.5 py-0 rounded-full font-mono text-[10px] ${categoryFilter === g.value ? "bg-primary-foreground/20 text-primary-foreground" : "bg-foreground/5 text-foreground/35"}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Attention strip — services with an imminent (or, for contract end
          dates, overdue) renewal signal, each card actionable (links to the
          service detail). Billing-derived dates are never past-due; contract
          end dates may be, and are sorted first. */}
      {attentionItems.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-destructive">{t("attention.kicker")}</h2>
            <span className="font-mono text-[10px] text-destructive/70">{attentionItems.length}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {attentionItems.map(({ service, renewal }) => (
              <Link
                key={service.id}
                href={`/services/${service.id}`}
                className="group flex items-center gap-3 rounded-xl border border-destructive/25 bg-destructive/10 p-3 transition-all hover:bg-destructive/15"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
                  {renewal.days <= 1 ? <AlertTriangle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-foreground">{service.providerName}</span>
                  <span className="block truncate text-[11px] text-destructive">
                    {attentionLabel(service, renewal)}
                    {service.address ? ` · ${service.address.nickname || `${service.address.city}, ${service.address.state}`}` : ""}
                  </span>
                </span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-destructive/60 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </div>
      )}

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
            const GroupIcon = groupIconComponents[prefix] ?? ClipboardList;
            return (
              <div key={prefix} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <GroupIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <h2 className="font-display text-xs font-semibold text-muted-foreground uppercase tracking-wide">{groupLabels[prefix] || prefix}</h2>
                  <span className="font-mono text-[10px] text-foreground/30">{items.length}</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((service) => (
                    <Link key={service.id} href={`/services/${service.id}`}>
                      <div className="group rounded-2xl border border-border bg-card p-4 hover:bg-foreground/[0.05] hover:border-primary/30 transition-all cursor-pointer">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <ServiceLogoMark service={service} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h3 className="font-medium text-sm text-foreground truncate group-hover:text-primary transition">{service.providerName}</h3>
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
                                  <span className="font-mono font-semibold text-tone-emerald-fg/70">{formatCurrency(service.monthlyCost)}{cycleLabel(service.billingCycle)}</span>
                                )}
                              </div>
                              {service.provider?.affiliateActive && service.provider.id && (
                                <div className="mt-2.5">
                                  <AffiliateCtaButton
                                    providerId={service.provider.id}
                                    source="services"
                                    addressId={service.addressId}
                                    stopPropagation
                                  />
                                </div>
                              )}
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
          <AffiliateDisclosure className="mt-3 px-1" />
        </div>
      )}
    </div>
  );
}
