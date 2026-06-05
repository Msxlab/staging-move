"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Phone,
  Users,
  Building2,
  MapPin,
  Flag,
  AlertTriangle,
} from "lucide-react";
import { AffiliateCtaButton } from "@/components/affiliate/affiliate-cta-button";
import {
  getMergedDisplayCategoryIcon,
  getMergedDisplayCategoryLabel,
  getMergedDisplaySubcategoryLabel,
} from "@/lib/recommendation-engine";
import { resolveLogoUrl } from "@/lib/logo-url";
import type {
  ProviderCoverageConfidence,
  ProviderTrustSummary,
} from "@locateflow/shared";

export interface ProviderDetail {
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
  zipCodes: string[];
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

interface AddressSummary {
  id: string;
  state: string;
  zip: string;
  city: string;
  nickname: string | null;
}

interface StateRuleSummary {
  stateCode: string;
  stateName: string;
  dmvRules: string | null;
  voterRegistration: string | null;
  taxInfo: string | null;
}

const GOVERNMENT_WITH_RULES = new Set([
  "GOVERNMENT_DMV",
  "GOVERNMENT_VOTER",
  "GOVERNMENT_TAX",
  "GOVERNMENT_ID",
  "GOVERNMENT_IMMIGRATION",
]);

function formatCount(n: number | undefined): string {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function ProviderDetailClient({
  provider,
  alternatives,
  primaryAddress,
  stateRule,
}: {
  provider: ProviderDetail;
  alternatives: ProviderDetail[];
  primaryAddress: AddressSummary | null;
  stateRule: StateRuleSummary | null;
}) {
  const addCta = useMemo(() => {
    const query = new URLSearchParams({
      providerId: provider.id,
      category: provider.category,
    });
    return `/services/new?${query.toString()}`;
  }, [provider.id, provider.category]);

  const showStateRule =
    GOVERNMENT_WITH_RULES.has(provider.category) &&
    stateRule &&
    (stateRule.dmvRules || stateRule.voterRegistration || stateRule.taxInfo);

  const stateRuleText = stateRule
    ? provider.category === "GOVERNMENT_VOTER"
      ? stateRule.voterRegistration
      : provider.category === "GOVERNMENT_TAX"
        ? stateRule.taxInfo
        : stateRule.dmvRules
    : null;
  const coverageConfidence = provider.trust?.coverageConfidence || provider.coverageConfidence;
  const categoryLabel = [
    getMergedDisplayCategoryLabel(provider.category),
    getMergedDisplaySubcategoryLabel(provider.category),
  ].filter(Boolean).join(" - ");
  const logoUrl = resolveLogoUrl(provider.logoUrl);

  return (
    <div className="space-y-6">
      <Link
        href="/providers"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
      >
        <ArrowLeft className="h-3 w-3" /> Back to providers
      </Link>

      {/* Header Card */}
      <div className="rounded-2xl border border-border bg-foreground/5 p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 shrink-0 rounded-2xl bg-foreground/5 border border-border flex items-center justify-center text-3xl overflow-hidden">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={`${provider.name} logo`} className="h-full w-full object-contain" />
            ) : (
              getMergedDisplayCategoryIcon(provider.category)
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-foreground">{provider.name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-muted-foreground">{categoryLabel}</span>
              {provider.scope === "FEDERAL" ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded border border-tone-sky-br bg-tone-sky-bg text-tone-sky-fg flex items-center gap-1">
                  <Flag className="h-2.5 w-2.5" /> Federal
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-2.5 w-2.5" /> State
                </span>
              )}
            </div>
            {!logoUrl && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Logo unavailable; category icon shown.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-tone-honey-br bg-tone-honey-bg p-3">
          <p className="text-xs font-semibold text-tone-honey-fg dark:text-tone-honey-fg">Listed provider, manual tracking only</p>
          <p className="mt-1 text-[11px] leading-relaxed text-tone-honey-fg/80 dark:text-tone-honey-fg/75">
            This is unverified directory data, not an official partnership or integration. Confirm details with the official provider before acting.
          </p>
        </div>

        {provider.description && (
          <p className="text-sm text-foreground/80 leading-relaxed">{provider.description}</p>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <Link
            href={addCta}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-primary0 to-accent text-white text-sm font-semibold hover:from-primary hover:to-accent transition"
          >
            Track manually as my service <ArrowRight className="h-4 w-4" />
          </Link>
          {provider.affiliateActive && (
            <AffiliateCtaButton
              providerId={provider.id}
              source="provider_detail"
              addressId={primaryAddress?.id ?? null}
              iconClassName="h-4 w-4"
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-primary/40 bg-primary/10 text-sm font-semibold text-primary hover:bg-primary/15 transition disabled:opacity-60"
            />
          )}
          {provider.website && (
            <a
              href={provider.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border bg-foreground/5 text-sm text-foreground/80 hover:bg-foreground/10 transition"
            >
              <ExternalLink className="h-4 w-4" /> Website
            </a>
          )}
          {provider.phone && (
            <a
              href={`tel:${provider.phone}`}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border bg-foreground/5 text-sm text-foreground/80 hover:bg-foreground/10 transition"
            >
              <Phone className="h-4 w-4" /> Call
            </a>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-foreground/[0.03] p-4 flex gap-3">
        <AlertTriangle className="h-4 w-4 text-tone-honey-fg shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-foreground">
            {coverageConfidence?.label || "Unverified coverage"}
          </p>
          <p className="text-[12px] text-foreground/55 mt-1 leading-relaxed">
            {coverageConfidence?.message || "Availability may vary by address. Confirm with the official provider before acting."}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Adding this provider only creates a LocateFlow service record; it does not update your address with the provider.
          </p>
          {provider.coverageNote && (
            <p className="text-[11px] text-muted-foreground mt-2">{provider.coverageNote}</p>
          )}
        </div>
      </div>

      {/* Community signal */}
      {(provider.userCount ?? 0) > 0 && (
        <div className="rounded-2xl border border-border bg-foreground/[0.03] p-4 flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-tone-cyan-bg border border-tone-cyan-br flex items-center justify-center">
            <Users className="h-5 w-5 text-tone-cyan-fg" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {formatCount(provider.userCount)} people
              {primaryAddress?.state ? ` in ${primaryAddress.state}` : ""} use this provider
            </p>
            <p className="text-xs text-muted-foreground">
              Popularity-based signal from LocateFlow users
            </p>
          </div>
        </div>
      )}

      {/* State rule card */}
      {showStateRule && stateRuleText && (
        <div className="rounded-2xl border border-tone-honey-br bg-tone-honey-bg p-4 flex gap-3">
          <AlertTriangle className="h-4 w-4 text-tone-honey-fg shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-tone-honey-fg">
              {stateRule!.stateName} deadline reminder
            </p>
            <p className="text-[13px] text-tone-honey-fg/90 mt-1 leading-relaxed">{stateRuleText}</p>
          </div>
        </div>
      )}

      {/* Alternatives */}
      {alternatives.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            Other {getMergedDisplayCategoryLabel(provider.category)} options
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {alternatives.map((a) => (
              <Link
                key={a.id}
                href={`/providers/${a.id}`}
                className="rounded-xl border border-border bg-foreground/5 hover:bg-foreground/[0.08] transition p-3 flex items-start gap-3"
              >
                <div className="h-10 w-10 shrink-0 rounded-lg bg-foreground/5 border border-border flex items-center justify-center text-xl">
                  {getMergedDisplayCategoryIcon(a.category)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{a.name}</p>
                  {a.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.description}</p>
                  )}
                  {a.userCount && a.userCount > 0 ? (
                    <span className="flex items-center gap-1 mt-1.5 text-[11px] text-muted-foreground">
                      <Users className="h-3 w-3" /> {formatCount(a.userCount)}
                    </span>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Details block */}
      <div className="rounded-2xl border border-border bg-foreground/5 p-4 space-y-3 text-sm">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" /> Provider details
        </h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
          <div>
            <p className="text-muted-foreground">Coverage</p>
            <p className="text-foreground/80 mt-0.5">
              {provider.scope === "FEDERAL"
                ? "National listing"
                : provider.states.length > 0
                  ? provider.states.join(", ")
                  : "State-scoped"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {coverageConfidence?.label || "Unverified coverage"}
            </p>
          </div>
          {provider.tags.length > 0 && (
            <div>
              <p className="text-muted-foreground">Tags</p>
              <p className="text-foreground/80 mt-0.5">{provider.tags.join(" · ")}</p>
            </div>
          )}
          {provider.subCategory && (
            <div>
              <p className="text-muted-foreground">Sub-category</p>
              <p className="text-foreground/80 mt-0.5">{provider.subCategory}</p>
            </div>
          )}
          {provider.popularityScore > 0 && (
            <div>
              <p className="text-muted-foreground">Popularity</p>
              <p className="text-foreground/80 mt-0.5">{provider.popularityScore}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
