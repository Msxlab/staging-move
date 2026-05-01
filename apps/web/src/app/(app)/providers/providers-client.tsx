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
} from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import {
  getMergedDisplayCategoryIcon,
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

export interface AddressOption {
  id: string;
  nickname?: string;
  city: string;
  state: string;
  zip: string;
  isPrimary: boolean;
}

export interface ProviderItem {
  id: string;
  name: string;
  slug: string;
  category: string;
  subCategory: string | null;
  description: string | null;
  website: string | null;
  phone: string | null;
  logoUrl: string | null;
  scope: string;
  states: string[];
  zipCodes?: string[];
  tags: string[];
  popularityScore: number;
  displayOrder: number;
  userCount?: number;
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

const TIER_BADGE: Record<UrgencyTier, { label: string; className: string }> = {
  CRITICAL: { label: "Critical", className: "bg-red-500/20 text-red-300 border-red-500/30" },
  IMPORTANT: { label: "Important", className: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  RECOMMENDED: { label: "Recommended", className: "bg-sky-500/20 text-sky-300 border-sky-500/30" },
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
  const logoUrl = provider.logoUrl;
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
          {getMergedDisplayCategoryIcon(provider.category)}
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
  const [selectedState, setSelectedState] = useState<string | null>(initialState);
  const [selectedZip, setSelectedZip] = useState<string | null>(initialZip);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(initialAddressId);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [recs, setRecs] = useState<RecommendationsResponse | null>(null);
  const [recsLoading, setRecsLoading] = useState(false);
  const lastTrackedSearchRef = useRef("");

  // Load providers for selected state/zip via the public API (cached/revalidated server-side)
  const fetchProviders = useCallback(async (state: string | null, zip: string | null, q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (state) params.set("state", state);
      if (zip) params.set("zip", zip);
      if (q) params.set("q", q);
      const res = await fetch(`/api/providers?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      setProviders((data.providers || []) as ProviderItem[]);
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
      if (!res.ok) return;
      const data = (await res.json()) as RecommendationsResponse;
      setRecs(data);
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
    const t = setTimeout(() => fetchProviders(selectedState, selectedZip, search.trim()), 250);
    return () => clearTimeout(t);
  }, [selectedState, selectedZip, search, fetchProviders]);

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
    if (!categoryFilter) return providers;
    return providers.filter((provider) => getMergedDisplayCategoryKey(provider.category) === categoryFilter);
  }, [providers, categoryFilter]);

  const criticalCluster = recs?.clusters.find((c) => c.tier === "CRITICAL");
  const importantCluster = recs?.clusters.find((c) => c.tier === "IMPORTANT");
  const highlightProviders = [
    ...(criticalCluster?.providers || []).slice(0, 3),
    ...(importantCluster?.providers || []).slice(0, 3),
  ].slice(0, 6);
  const emptyStateCopy = getProviderEmptyStateCopy({
    state: selectedState,
    search,
    hasCategoryFilter: Boolean(categoryFilter),
  });

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Providers</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Browse listed providers. Providers are directory entries and are not your tracked services until you add them.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {addresses.length > 0 && (
            <select
              value={selectedAddressId ?? ""}
              onChange={(e) => onAddressChange(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border bg-foreground/[0.02] text-sm text-foreground/80 focus:outline-none focus:border-orange-500/50"
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
            className="w-24 px-3 py-2 rounded-xl border border-border bg-foreground/[0.02] text-sm text-foreground/80 focus:outline-none focus:border-orange-500/50"
            aria-label="State code filter"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 flex gap-3">
        <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">Listed providers, manual tracking only</p>
          <p className="text-[11px] text-amber-900/80 dark:text-amber-100/75 mt-1 leading-relaxed">
            Provider details are unverified directory data. Availability may vary by address; confirm with the official provider before acting. Adding this provider creates a LocateFlow service record; it does not update your address with the provider.
          </p>
        </div>
      </div>

      {/* Recommended for you */}
      {highlightProviders.length > 0 && (
        <div className="rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-cyan-500/5 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-orange-400" />
            <h2 className="text-sm font-semibold text-foreground">Recommended for you</h2>
            {recsLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {highlightProviders.map((p) => (
              <Link
                key={p.id}
                href={`/providers/${p.id}`}
                className="group rounded-xl border border-border bg-foreground/5 hover:bg-foreground/10 transition p-3 flex items-start gap-3"
              >
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
      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
        <input
          type="text"
          placeholder="Search listed providers, tags, or descriptions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-border bg-foreground/[0.02] text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:border-orange-500/50"
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
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setCategoryFilter(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
              categoryFilter === null
                ? "border-orange-500/40 bg-orange-500/15 text-orange-300"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            All · {providers.length}
          </button>
          {categoryCounts.map(([cat, count]) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition flex items-center gap-1.5 ${
                categoryFilter === cat
                  ? "border-orange-500/40 bg-orange-500/15 text-orange-300"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{getMergedDisplayCategoryIcon(cat)}</span>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visibleProviders.map((p) => (
            <Link
              key={p.id}
              href={`/providers/${p.id}`}
              className="group rounded-2xl border border-border bg-foreground/5 hover:bg-foreground/[0.08] transition p-4 flex gap-3"
            >
              {(() => {
                const trust = trustFor(p);
                return (
                  <>
              <ProviderLogoMark provider={p} className="h-12 w-12 rounded-xl" fallbackClassName="text-2xl" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-foreground truncate">{p.name}</h3>
                  {p.scope === "FEDERAL" ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-blue-500/30 bg-blue-500/10 text-blue-300 flex items-center gap-1">
                      <Flag className="h-2.5 w-2.5" /> National listing
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-2.5 w-2.5" /> State-level
                    </span>
                  )}
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-amber-500/20 bg-amber-500/10 text-amber-200">
                    Listed provider
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {[getMergedDisplayCategoryLabel(p.category), getMergedDisplaySubcategoryLabel(p.category)]
                    .filter(Boolean)
                    .join(" - ")}
                </p>
                {p.description && (
                  <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{p.description}</p>
                )}
                <p className="text-[11px] text-muted-foreground mt-2">
                  {trust.coverageConfidence.label}: {trust.coverageConfidence.message} Manual tracking only.
                </p>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                  {p.userCount && p.userCount > 0 ? (
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {formatCount(p.userCount)} users
                    </span>
                  ) : null}
                  {p.website ? (
                    <span className="flex items-center gap-1 truncate">
                      <ExternalLink className="h-3 w-3" /> {new URL(p.website).hostname.replace(/^www\./, "")}
                    </span>
                  ) : null}
                  {p.phone ? (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {p.phone}
                    </span>
                  ) : null}
                </div>
              </div>
                  </>
                );
              })()}
            </Link>
          ))}
        </div>
      )}

      {/* State rule info (bottom, reference) */}
      {recs?.meta?.stateRule?.dmvRules && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 flex gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-300">Know your state deadlines</p>
            <p className="text-[11px] text-amber-200/80 mt-1">{recs.meta.stateRule.dmvRules}</p>
          </div>
        </div>
      )}
    </div>
  );
}
