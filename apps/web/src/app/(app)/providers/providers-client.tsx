"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Search,
  Sparkles,
  ExternalLink,
  Phone,
  Building2,
  Flag,
  MapPin,
  Users,
  AlertTriangle,
  Loader2,
  X,
  Scale,
  Star,
  ArrowRight,
} from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { AffiliateCtaButton } from "@/components/affiliate/affiliate-cta-button";
import { CompareView } from "./compare-view";
import {
  getMergedDisplayCategoryKey,
  getMergedDisplayCategoryLabel,
  getMergedDisplayCategoryOrder,
  getMergedDisplaySubcategoryLabel,
  type ScoredProvider,
  type UrgencyTier,
} from "@/lib/recommendation-engine";
import {
  getProviderTrustSummary,
  type ProviderCoverageConfidence,
  type ProviderTrustSummary,
} from "@locateflow/shared";
import { getProviderEmptyStateCopy } from "@/lib/provider-empty-state";
import { trackEvent } from "@/lib/analytics";
import { resolveLogoUrl } from "@/lib/logo-url";
import { CategoryIcon } from "@/components/ui/category-icon";

export interface AddressOption {
  id: string;
  nickname?: string;
  city: string;
  state: string;
  zip: string;
  isPrimary: boolean;
  latitude?: number | null;
  longitude?: number | null;
}

export interface ProviderItem {
  id: string;
  name: string;
  slug: string;
  category: string;
  subCategory: string | null;
  description: string | null;
  website: string | null;
  /** Stable grouping key for sibling services of the same company (e.g. Chase). */
  brandKey?: string;
  /** Human brand label for the cluster chip ("Chase"). */
  brandLabel?: string;
  phone: string | null;
  logoUrl: string | null;
  scope: string;
  states: string[];
  zipCodes?: string[];
  tags: string[];
  popularityScore: number;
  displayOrder: number;
  userCount?: number;
  affiliateActive?: boolean;
  coverageModel?: "state" | "zip_prefix" | "polygon" | "live_address" | string;
  coverageMatchLevel?: "exact" | "prefix" | "polygon" | "state" | "live_address" | string;
  coverageNote?: string | null;
  coverageSourceUrl?: string | null;
  requiresAddressCheck?: boolean;
  requiresPolygonCheck?: boolean;
  coverageConfidence?: ProviderCoverageConfidence;
  trust?: ProviderTrustSummary;
}

interface RecommendationsResponse {
  clusters: Array<{
    tier: UrgencyTier;
    label: string;
    icon: string;
    color: string;
    description: string;
    providers: ScoredProvider[];
    completedCount: number;
    totalCount: number;
  }>;
  nextCriticalActions: ScoredProvider[];
  /** The user's region (from their address city/state) — heads the recommendations. */
  region?: { city: string | null; state: string | null; label: string | null };
  /** Top-N region-relevant providers per pending CRITICAL/IMPORTANT category. */
  regionGroups?: Array<{ category: string; label: string; tier: UrgencyTier; providers: ScoredProvider[] }>;
  recommendationGuide?: {
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
      providers?: ScoredProvider[] | null;
    }> | null;
    setupPlan?: {
      sections?: Array<{
        key: string;
        title: string;
        description?: string | null;
        providerCount?: number | null;
        categories?: Array<{
          category: string;
          label: string;
          reason?: string | null;
          providerId?: string | null;
          providerName?: string | null;
        }> | null;
      }> | null;
      primaryNextCategory?: string | null;
      primaryNextLabel?: string | null;
      totalOpenCategories?: number | null;
    } | null;
  } | null;
  meta?: {
    state?: string;
    currentPhase?: number;
    stateRule?: {
      dmvRules?: string | null;
      voterRegistration?: string | null;
      taxInfo?: string | null;
    } | null;
  };
}

const MAX_COMPARE = 4;

const TIER_BADGE: Record<UrgencyTier, { label: string; className: string }> = {
  CRITICAL: { label: "Critical", className: "bg-destructive text-destructive-foreground border-destructive" },
  IMPORTANT: { label: "Important", className: "bg-tone-honey-bg text-tone-honey-fg border-tone-honey-br" },
  RECOMMENDED: { label: "Recommended", className: "bg-tone-sky-bg text-tone-sky-fg border-tone-sky-br" },
  OPTIONAL: { label: "Optional", className: "bg-foreground/10 text-muted-foreground border-border" },
};

function formatCount(n: number | undefined): string {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function trustFor(provider: ProviderItem | ScoredProvider): ProviderTrustSummary {
  if ("trust" in provider && provider.trust) return provider.trust;
  return getProviderTrustSummary(provider);
}

type ProviderLogoSource = {
  name: string;
  category: string;
  website?: string | null;
  logoUrl?: string | null;
};

export function shouldShowProviderLogo(logoUrl: string | null | undefined, failedLogoUrl: string | null): logoUrl is string {
  return Boolean(logoUrl && logoUrl !== failedLogoUrl);
}

export function ProviderLogoMark({
  provider,
  className,
  fallbackClassName,
}: {
  provider: ProviderLogoSource;
  className: string;
  fallbackClassName: string;
}) {
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const logoUrl = resolveLogoUrl(provider.logoUrl);
  const showLogo = shouldShowProviderLogo(logoUrl, failedLogoUrl);

  return (
    <div className={`${className} shrink-0 bg-foreground/5 border border-border flex items-center justify-center overflow-hidden`}>
      {showLogo ? (
        <img
          src={logoUrl}
          alt={`${provider.name} logo`}
          className="h-full w-full rounded-[inherit] object-contain p-1"
          loading="lazy"
          decoding="async"
          onError={() => setFailedLogoUrl(logoUrl)}
        />
      ) : (
        <span className={fallbackClassName} aria-hidden="true">
          <CategoryIcon category={provider.category} className="h-[1em] w-[1em]" />
        </span>
      )}
    </div>
  );
}

export function ProvidersClient({
  initialProviders,
  addresses,
  initialState,
  initialZip,
  initialAddressId,
}: {
  initialProviders: ProviderItem[];
  addresses: AddressOption[];
  initialState: string | null;
  initialZip: string | null;
  initialAddressId: string | null;
}) {
  const [providers, setProviders] = useState<ProviderItem[]>(initialProviders);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [selectedState, setSelectedState] = useState<string | null>(initialState);
  const [selectedZip, setSelectedZip] = useState<string | null>(initialZip);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(initialAddressId);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [recs, setRecs] = useState<RecommendationsResponse | null>(null);
  const [recsLoading, setRecsLoading] = useState(false);
  const lastTrackedSearchRef = useRef("");

  // Compare tray: up to MAX_COMPARE providers picked for a side-by-side view.
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  // Shortlist: "saved for later" set. Persisted server-side (survives device
  // switches) with localStorage as an instant, offline cache. Toggles are
  // optimistic and best-effort-synced to /api/providers/saved.
  const [shortlist, setShortlist] = useState<string[]>([]);
  const [showSavedOnly, setShowSavedOnly] = useState(false);

  const persistShortlistLocal = useCallback((next: string[]) => {
    setShortlist(next);
    try {
      window.localStorage.setItem("provider-shortlist", JSON.stringify(next));
    } catch {
      // Non-fatal offline cache.
    }
  }, []);

  // Load localStorage first (instant), then reconcile with the authoritative
  // server store, migrating any legacy local-only saves up to the server once.
  useEffect(() => {
    let localIds: string[] = [];
    try {
      const raw = window.localStorage.getItem("provider-shortlist");
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) localIds = parsed.filter((x): x is string => typeof x === "string");
    } catch {
      // ignore unavailable storage
    }
    if (localIds.length) setShortlist(localIds);

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/providers/saved");
        if (!res.ok) return;
        const data = await res.json();
        const serverIds: string[] = Array.isArray(data?.providerIds) ? data.providerIds : [];
        if (cancelled) return;
        const serverSet = new Set(serverIds);
        for (const id of localIds) {
          if (!serverSet.has(id)) {
            void fetch("/api/providers/saved", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ providerId: id }),
            }).catch(() => {});
          }
        }
        persistShortlistLocal(Array.from(new Set([...serverIds, ...localIds])));
      } catch {
        // offline / not signed in — keep the localStorage list
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [persistShortlistLocal]);

  const toggleShortlist = useCallback(
    (id: string) => {
      const adding = !shortlist.includes(id);
      persistShortlistLocal(adding ? [...shortlist, id] : shortlist.filter((x) => x !== id));
      void fetch("/api/providers/saved", {
        method: adding ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId: id }),
      }).catch(() => {
        // optimistic — the localStorage cache keeps the UI consistent on failure
      });
    },
    [shortlist, persistShortlistLocal],
  );

  const toggleCompare = useCallback((id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_COMPARE) return prev; // cap — tray surfaces the limit
      return [...prev, id];
    });
  }, []);

  const providerById = useMemo(() => {
    const map = new Map<string, ProviderItem>();
    for (const p of providers) map.set(p.id, p);
    return map;
  }, [providers]);

  // Coordinates of the currently selected address (if any) — passed to the
  // providers API so the server applies coverage matching + distance-aware
  // ranking to the full catalog rather than the client filtering a single page.
  const selectedCoords = useMemo(() => {
    const a = addresses.find((x) => x.id === selectedAddressId);
    return {
      lat: typeof a?.latitude === "number" ? a.latitude : null,
      lng: typeof a?.longitude === "number" ? a.longitude : null,
    };
  }, [addresses, selectedAddressId]);

  // Load providers for selected state/zip via the public API (cached/revalidated server-side)
  const fetchProviders = useCallback(async (state: string | null, zip: string | null, q: string, lat?: number | null, lng?: number | null) => {
    setLoading(true);
    setLoadError(false);
    try {
      const params = new URLSearchParams();
      if (state) params.set("state", state);
      if (zip) params.set("zip", zip);
      if (q) params.set("q", q);
      // Destination coordinates unlock the server's coverage-match + distance
      // ranking ("providers near your new place") over the whole catalog.
      if (typeof lat === "number" && Number.isFinite(lat)) params.set("lat", String(lat));
      if (typeof lng === "number" && Number.isFinite(lng)) params.set("lng", String(lng));
      const res = await fetch(`/api/providers?${params.toString()}`);
      if (!res.ok) throw new Error(`Providers request failed (${res.status})`);
      const data = await res.json();
      setProviders((data.providers || []) as ProviderItem[]);
    } catch {
      // Surface the failure instead of rendering an empty list that reads as
      // "no providers found" — the user gets an explicit retry.
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load personalized recommendations for selected address (only if logged-in user has an address)
  const fetchRecommendations = useCallback(async (addressId: string | null) => {
    if (!addressId) {
      setRecs(null);
      return;
    }
    setRecsLoading(true);
    try {
      const res = await fetch(`/api/providers/recommendations?addressId=${encodeURIComponent(addressId)}`);
      if (!res.ok) throw new Error(`Recommendations request failed (${res.status})`);
      const data = (await res.json()) as RecommendationsResponse;
      setRecs(data);
    } catch {
      // Recommendations are a bonus panel — degrade silently to no highlights
      // rather than blocking the page.
      setRecs(null);
    } finally {
      setRecsLoading(false);
    }
  }, []);

  // Fetch recommendations on mount + whenever address changes
  useEffect(() => {
    fetchRecommendations(selectedAddressId);
  }, [selectedAddressId, fetchRecommendations]);

  // Debounced server-side search when q or category or state/zip change
  useEffect(() => {
    const t = setTimeout(() => fetchProviders(selectedState, selectedZip, search.trim(), selectedCoords.lat, selectedCoords.lng), 250);
    return () => clearTimeout(t);
  }, [selectedState, selectedZip, search, selectedCoords, fetchProviders]);

  useEffect(() => {
    const normalized = search.trim().toLowerCase();
    if (normalized.length < 2 || normalized === lastTrackedSearchRef.current) return;
    const t = window.setTimeout(() => {
      lastTrackedSearchRef.current = normalized;
      trackEvent("provider_search", {
        query_length: normalized.length,
        has_category_filter: Boolean(categoryFilter),
      });
    }, 700);
    return () => window.clearTimeout(t);
  }, [categoryFilter, search]);

  // Build distinct categories from visible providers, sorted by provider count
  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of providers) {
      const key = getMergedDisplayCategoryKey(p.category);
      map[key] = (map[key] || 0) + 1;
    }
    return Object.entries(map).sort(
      (a, b) =>
        getMergedDisplayCategoryOrder(a[0]) - getMergedDisplayCategoryOrder(b[0]) ||
        b[1] - a[1],
    );
  }, [providers]);

  const visibleProviders = useMemo(() => {
    let list = providers;
    if (categoryFilter) {
      list = list.filter((provider) => getMergedDisplayCategoryKey(provider.category) === categoryFilter);
    }
    if (showSavedOnly) {
      const saved = new Set(shortlist);
      list = list.filter((provider) => saved.has(provider.id));
    }
    return list;
  }, [providers, categoryFilter, showSavedOnly, shortlist]);

  // Brand keys shared by 2+ currently-visible providers, so sibling services of
  // one company (e.g. "Chase" + "Chase Credit Cards") get a small brand chip and
  // read as one brand's offerings rather than an accidental duplicate.
  const siblingBrandKeys = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of visibleProviders) {
      if (p.brandKey) counts.set(p.brandKey, (counts.get(p.brandKey) ?? 0) + 1);
    }
    const keys = new Set<string>();
    for (const [key, n] of counts) if (n >= 2) keys.add(key);
    return keys;
  }, [visibleProviders]);

  // Per-user "not relevant" dismissals — optimistically hidden here and persisted
  // server-side so the engine stops re-surfacing them on future loads.
  const [dismissedRecIds, setDismissedRecIds] = useState<Set<string>>(new Set());
  const dismissRecommendation = useCallback((providerId: string) => {
    setDismissedRecIds((prev) => new Set(prev).add(providerId));
    trackEvent("recommendation_dismiss", { provider_id: providerId, surface: "providers_strip" });
    void fetch("/api/providers/recommendations/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerId, action: "NOT_RELEVANT" }),
    }).catch(() => {});
  }, []);

  const highlightProviders = useMemo(() => {
    const critical = recs?.clusters.find((c) => c.tier === "CRITICAL");
    const important = recs?.clusters.find((c) => c.tier === "IMPORTANT");
    // Filter dismissed BEFORE slicing so a dismissal promotes the next pick in.
    const crit = (critical?.providers || []).filter((p) => !dismissedRecIds.has(p.id)).slice(0, 3);
    const imp = (important?.providers || []).filter((p) => !dismissedRecIds.has(p.id)).slice(0, 3);
    return [...crit, ...imp].slice(0, 6);
  }, [recs, dismissedRecIds]);

  // Fire one impression per recommended provider so the recommendation engine's
  // runtime-tunable scoring weights become measurable via CTR. Deduped by id
  // across re-renders so scrolling/typing doesn't double-count.
  const trackedRecImpressionsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const p of highlightProviders) {
      if (trackedRecImpressionsRef.current.has(p.id)) continue;
      trackedRecImpressionsRef.current.add(p.id);
      trackEvent("recommendation_impression", {
        provider_id: p.id,
        tier: p.urgencyTier,
        category: p.category,
        score: Math.round(p.recommendationScore),
        surface: "providers_strip",
      });
    }
  }, [highlightProviders]);
  const emptyStateCopy = getProviderEmptyStateCopy({
    state: selectedState,
    search,
    hasCategoryFilter: Boolean(categoryFilter),
  });
  const setupLane = recs?.recommendationGuide?.lanes?.find((lane) => lane.key === "setup_first");
  const setupLaneProviders = (setupLane?.providers || []).slice(0, 4);
  const setupLaneParams = new URLSearchParams();
  if (selectedAddressId) setupLaneParams.set("addressId", selectedAddressId);
  if (setupLaneProviders.length > 0) setupLaneParams.set("providerIds", setupLaneProviders.map((provider) => provider.id).join(","));
  if (setupLaneProviders[0]?.category || recs?.recommendationGuide?.completion?.nextBestCategory) {
    setupLaneParams.set("category", setupLaneProviders[0]?.category || recs?.recommendationGuide?.completion?.nextBestCategory || "");
  }
  setupLaneParams.set("guide", "providers_smart_plan");
  const setupLaneHref = `/services/new?${setupLaneParams.toString()}`;

  const onAddressChange = (addressId: string) => {
    const match = addresses.find((a) => a.id === addressId) || null;
    setSelectedAddressId(match?.id ?? null);
    setSelectedState(match?.state ?? null);
    setSelectedZip(match?.zip ?? null);
  };

  const onStateChange = (state: string) => {
    setSelectedState(state || null);
    setSelectedZip(null);
  };

  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 space-y-5 overflow-x-hidden">
      {/* Header */}
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="h1 text-2xl md:text-3xl text-foreground"><em>Providers</em></h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Browse listed providers. Providers are directory entries and are not your tracked services until you add them.
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap gap-2">
          {addresses.length > 0 && (
            <select
              value={selectedAddressId ?? ""}
              onChange={(e) => onAddressChange(e.target.value)}
              className="min-w-0 max-w-full px-3 py-2 rounded-xl border border-border bg-foreground/[0.02] text-sm text-foreground/80 focus:outline-none focus:border-tone-orange-br"
              aria-label="Choose address"
            >
              <option value="">All locations</option>
              {addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {(a.nickname || `${a.city}, ${a.state}`) + (a.isPrimary ? " (Primary)" : "")}
                </option>
              ))}
            </select>
          )}
          <input
            type="text"
            placeholder="State (e.g. CA)"
            maxLength={2}
            value={selectedState ?? ""}
            onChange={(e) => onStateChange(e.target.value.toUpperCase())}
            className="w-24 px-3 py-2 rounded-xl border border-border bg-foreground/[0.02] text-sm text-foreground/80 focus:outline-none focus:border-tone-orange-br"
            aria-label="State code filter"
          />
        </div>
      </div>

      <div className="rounded-xl border border-tone-honey-br bg-tone-honey-bg p-3 flex gap-3">
        <AlertTriangle className="h-4 w-4 text-tone-honey-fg dark:text-tone-honey-fg shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-tone-honey-fg dark:text-tone-honey-fg">Listed providers, manual tracking only</p>
          <p className="text-[11px] text-tone-honey-fg/80 dark:text-tone-honey-fg/75 mt-1 leading-relaxed">
            Provider details are unverified directory data. Availability may vary by address; confirm with the official provider before acting. Adding this provider creates a LocateFlow service record; it does not update your address with the provider.
          </p>
        </div>
      </div>

      {recs?.recommendationGuide && (
        <div className="rounded-xl border border-tone-orange-br bg-gradient-to-br from-primary/5 to-transparent p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Sparkles className="h-4 w-4 text-tone-orange-fg" />
                <h2 className="text-sm font-semibold text-foreground">Smart setup plan</h2>
                {recs.recommendationGuide.completion ? (
                  <span className="rounded-full border border-tone-orange-br bg-background px-2 py-0.5 text-[10px] font-semibold text-tone-orange-fg">
                    {recs.recommendationGuide.completion.score}% ready
                  </span>
                ) : null}
                {recs.recommendationGuide.completion?.missingCritical ? (
                  <span className="rounded-full border border-tone-honey-br bg-tone-honey-bg px-2 py-0.5 text-[10px] font-semibold text-tone-honey-fg">
                    {recs.recommendationGuide.completion.missingCritical} gaps
                  </span>
                ) : null}
              </div>
              <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">
                {recs.recommendationGuide.summary}
              </p>
              {recs.recommendationGuide.decisionModel?.learningSignals?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {recs.recommendationGuide.decisionModel.learningSignals.slice(0, 4).map((signal) => (
                    <span key={signal} className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground">
                      {signal}
                    </span>
                  ))}
                </div>
              ) : null}
              {recs.recommendationGuide.setupPlan?.sections?.length ? (
                <div className="mt-4 grid gap-2 md:grid-cols-3">
                  {recs.recommendationGuide.setupPlan.sections.slice(0, 3).map((section) => (
                    <div key={section.key} className="rounded-xl border border-border bg-background/70 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-semibold text-foreground">{section.title}</p>
                        {typeof section.providerCount === "number" ? (
                          <span className="font-mono text-[10px] font-semibold text-primary">{section.providerCount}</span>
                        ) : null}
                      </div>
                      {section.description ? (
                        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                          {section.description}
                        </p>
                      ) : null}
                      {section.categories?.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {section.categories.slice(0, 3).map((item) => (
                            <span key={item.category} className="rounded-full border border-primary/15 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold text-primary">
                              {item.label}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            {setupLaneProviders.length > 0 && (
              <Link href={setupLaneHref} className="shrink-0">
                <button className="inline-flex items-center gap-2 rounded-xl bg-tone-orange-fg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">
                  Add setup picks <ArrowRight className="h-4 w-4" />
                </button>
              </Link>
            )}
          </div>
          {recs.recommendationGuide.decisionModel?.factors?.length ? (
            <div className="mt-4 grid gap-2 md:grid-cols-3">
              {recs.recommendationGuide.decisionModel.factors.slice(0, 3).map((factor) => (
                <div key={factor} className="rounded-xl border border-border bg-foreground/[0.03] p-3 text-[11px] leading-relaxed text-muted-foreground">
                  {factor}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* Recommended for you */}
      {highlightProviders.length > 0 && (
        <div className="rounded-xl border border-tone-orange-br bg-gradient-to-br from-primary/5 to-transparent p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-tone-orange-fg" />
            <h2 className="text-sm font-semibold text-foreground">
              {recs?.region?.label ? `Top picks for ${recs.region.label}` : "Recommended for you"}
            </h2>
            {recsLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
          {recs?.region?.label && (
            <p className="text-[11px] text-muted-foreground -mt-1.5">
              Ranked for your area — locally-confirmed providers first.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {highlightProviders.map((p) => (
              <Link
                key={p.id}
                href={`/providers/${p.id}`}
                onClick={() =>
                  trackEvent("recommendation_click", {
                    provider_id: p.id,
                    tier: p.urgencyTier,
                    category: p.category,
                    score: Math.round(p.recommendationScore),
                    surface: "providers_strip",
                  })
                }
                className="group relative min-w-0 rounded-xl border border-border bg-foreground/5 hover:bg-foreground/10 transition p-3 pr-7 flex items-start gap-3 overflow-hidden"
              >
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Not relevant"
                  title="Not relevant — hide this recommendation"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dismissRecommendation(p.id);
                  }}
                  className="absolute top-1.5 right-1.5 p-1 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-foreground/10 transition"
                >
                  <X className="h-3.5 w-3.5" />
                </span>
                <ProviderLogoMark provider={p} className="h-10 w-10 rounded-lg" fallbackClassName="text-xl" />
                <div className="min-w-0 flex-1">
                  {(() => {
                    const trust = trustFor(p);
                    return (
                      <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded border ${TIER_BADGE[p.urgencyTier].className}`}
                    >
                      {TIER_BADGE[p.urgencyTier].label}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                      {trust.coverageConfidence.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {[getMergedDisplayCategoryLabel(p.category), getMergedDisplaySubcategoryLabel(p.category)]
                      .filter(Boolean)
                      .join(" - ")}
                  </p>
                  {p.explanation?.reason && (
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{p.explanation.reason}</p>
                  )}
                  {p.affiliateActive && (
                    <div className="mt-2">
                      <AffiliateCtaButton providerId={p.id} source="recommendation" stopPropagation />
                    </div>
                  )}
                      </>
                    );
                  })()}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative min-w-0">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
        <input
          type="text"
          placeholder="Search listed providers, tags, or descriptions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-border bg-foreground/[0.02] text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:border-tone-orange-br"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Category chips */}
      {categoryCounts.length > 0 && (
        <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setCategoryFilter(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
              categoryFilter === null
                ? "border-tone-orange-br bg-tone-orange-bg text-tone-orange-fg"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            All · {providers.length}
          </button>
          {shortlist.length > 0 && (
            <button
              onClick={() => setShowSavedOnly((v) => !v)}
              aria-pressed={showSavedOnly}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition flex items-center gap-1.5 ${
                showSavedOnly
                  ? "border-tone-honey-br bg-tone-honey-bg text-tone-honey-fg"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Star className={`h-3 w-3 ${showSavedOnly ? "fill-current" : ""}`} />
              <span>Saved</span>
              <span className="text-muted-foreground">· {shortlist.length}</span>
            </button>
          )}
          {categoryCounts.map(([cat, count]) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition flex items-center gap-1.5 ${
                categoryFilter === cat
                  ? "border-tone-orange-br bg-tone-orange-bg text-tone-orange-fg"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <CategoryIcon category={cat} className="h-3.5 w-3.5" />
              <span>{getMergedDisplayCategoryLabel(cat)}</span>
              <span className="text-muted-foreground">· {count}</span>
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading providers…
        </div>
      ) : loadError ? (
        <EmptyState
          icon={AlertTriangle}
          title="Couldn't load providers"
          description="Something went wrong loading providers. Check your connection and try again."
          actionLabel="Try again"
          onAction={() => fetchProviders(selectedState, selectedZip, search.trim(), selectedCoords.lat, selectedCoords.lng)}
        />
      ) : visibleProviders.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={emptyStateCopy.title}
          description={emptyStateCopy.description}
          actionLabel={search || categoryFilter ? "Clear filters" : undefined}
          onAction={
            search || categoryFilter
              ? () => {
                  setSearch("");
                  setCategoryFilter(null);
                }
              : undefined
          }
        />
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-2.5 lg:grid-cols-2">
          {visibleProviders.map((p) => {
            const isComparing = compareIds.includes(p.id);
            const isShortlisted = shortlist.includes(p.id);
            const compareDisabled = !isComparing && compareIds.length >= MAX_COMPARE;
            return (
            <div
              key={p.id}
              className={`group relative min-w-0 rounded-xl border bg-foreground/5 transition overflow-hidden ${
                isComparing ? "border-tone-orange-br ring-1 ring-tone-orange-br/40" : "border-border hover:bg-foreground/[0.08]"
              }`}
            >
              {/* Card controls (above the link so clicks don't navigate) */}
              <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleShortlist(p.id)}
                  aria-pressed={isShortlisted}
                  aria-label={isShortlisted ? `Remove ${p.name} from shortlist` : `Save ${p.name} to shortlist`}
                  title={isShortlisted ? "Saved" : "Save for later"}
                  className={`rounded-lg border p-1.5 ${
                    isShortlisted
                      ? "border-tone-honey-br bg-tone-honey-bg text-tone-honey-fg"
                      : "border-border bg-background/70 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Star className={`h-3.5 w-3.5 ${isShortlisted ? "fill-current" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={() => toggleCompare(p.id)}
                  disabled={compareDisabled}
                  aria-pressed={isComparing}
                  aria-label={isComparing ? `Remove ${p.name} from comparison` : `Add ${p.name} to comparison`}
                  title={compareDisabled ? `Compare up to ${MAX_COMPARE}` : isComparing ? "In comparison" : "Add to compare"}
                  className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-medium disabled:opacity-40 ${
                    isComparing
                      ? "border-tone-orange-br bg-tone-orange-bg text-tone-orange-fg"
                      : "border-border bg-background/70 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Scale className="h-3.5 w-3.5" /> {isComparing ? "Added" : "Compare"}
                </button>
              </div>
            <Link
              href={`/providers/${p.id}`}
              className="flex gap-3 p-3 pr-24"
            >
              {(() => {
                const trust = trustFor(p);
                return (
                  <>
              <ProviderLogoMark provider={p} className="h-10 w-10 rounded-lg" fallbackClassName="text-xl" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-foreground truncate">{p.name}</h3>
                  {p.scope === "FEDERAL" ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-tone-sky-br bg-tone-sky-bg text-tone-sky-fg flex items-center gap-1">
                      <Flag className="h-2.5 w-2.5" /> National listing
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-2.5 w-2.5" /> State-level
                    </span>
                  )}
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-tone-honey-br bg-tone-honey-bg text-tone-honey-fg">
                    Listed provider
                  </span>
                  {p.brandKey && p.brandLabel && siblingBrandKeys.has(p.brandKey) && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-foreground/5 text-muted-foreground"
                      title={`Part of ${p.brandLabel} — one of several ${p.brandLabel} services`}
                    >
                      {p.brandLabel}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {[getMergedDisplayCategoryLabel(p.category), getMergedDisplaySubcategoryLabel(p.category)]
                    .filter(Boolean)
                    .join(" - ")}
                </p>
                {p.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                )}
                <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2">
                  {trust.coverageConfidence.label}: {trust.coverageConfidence.message} Manual tracking only.
                </p>
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-muted-foreground">
                  {p.userCount && p.userCount > 0 ? (
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {formatCount(p.userCount)} users
                    </span>
                  ) : null}
                  {p.website ? (
                    <span className="flex min-w-0 max-w-full items-center gap-1 truncate">
                      <ExternalLink className="h-3 w-3" /> {new URL(p.website).hostname.replace(/^www\./, "")}
                    </span>
                  ) : null}
                  {p.phone ? (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {p.phone}
                    </span>
                  ) : null}
                </div>
                {p.affiliateActive && (
                  <div className="mt-2.5">
                    <AffiliateCtaButton providerId={p.id} source="providers" stopPropagation />
                  </div>
                )}
              </div>
                  </>
                );
              })()}
            </Link>
            </div>
            );
          })}
        </div>
      )}

      {/* State rule info (bottom, reference) */}
      {recs?.meta?.stateRule?.dmvRules && (
        <div className="rounded-2xl border border-tone-honey-br bg-tone-honey-bg p-4 flex gap-3">
          <AlertTriangle className="h-4 w-4 text-tone-honey-fg shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-tone-honey-fg">Know your state deadlines</p>
            <p className="text-[11px] text-tone-honey-fg/80 mt-1">{recs.meta.stateRule.dmvRules}</p>
          </div>
        </div>
      )}

      {/* Floating compare tray */}
      {compareIds.length > 0 && !showCompare && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4">
          <div className="mx-auto flex max-w-3xl flex-col gap-2 rounded-2xl border border-border bg-background/95 p-3 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
              <Scale className="h-4 w-4 shrink-0 text-tone-orange-fg" />
              <span className="shrink-0 text-xs font-semibold text-foreground">
                Compare ({compareIds.length}/{MAX_COMPARE})
              </span>
              <div className="flex min-w-0 items-center gap-1.5">
                {compareIds.map((id) => {
                  const p = providerById.get(id);
                  return (
                    <span
                      key={id}
                      className="flex shrink-0 items-center gap-1 rounded-full border border-border bg-foreground/5 py-0.5 pl-2 pr-1 text-[11px] text-foreground/80"
                    >
                      <span className="max-w-[120px] truncate">{p?.name || "Provider"}</span>
                      <button
                        type="button"
                        onClick={() => toggleCompare(id)}
                        aria-label={`Remove ${p?.name || "provider"} from comparison`}
                        className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setCompareIds([])}
                className="rounded-lg px-2.5 py-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setShowCompare(true)}
                disabled={compareIds.length < 2}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {compareIds.length < 2 ? "Pick 2+ to compare" : "Compare side by side"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCompare && compareIds.length >= 2 && (
        <CompareView
          ids={compareIds}
          addressId={selectedAddressId}
          onClose={() => setShowCompare(false)}
          onRemove={(id) => {
            const next = compareIds.filter((x) => x !== id);
            setCompareIds(next);
            if (next.length < 2) setShowCompare(false);
          }}
        />
      )}
    </div>
  );
}
