"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  X,
  Loader2,
  AlertTriangle,
  Check,
  Minus,
  Flag,
  MapPin,
  Users,
  ExternalLink,
  Phone,
  Trophy,
} from "lucide-react";
import {
  getMergedDisplayCategoryIcon,
  getMergedDisplayCategoryLabel,
  getMergedDisplaySubcategoryLabel,
} from "@/lib/recommendation-engine";
import type { ProviderCoverageConfidence, ProviderTrustSummary } from "@locateflow/shared";
import { resolveLogoUrl } from "@/lib/logo-url";
import { trackEvent } from "@/lib/analytics";

export interface CompareProvider {
  id: string;
  name: string;
  slug: string;
  category: string;
  subCategory: string | null;
  description: string | null;
  website: string | null;
  websiteHost: string | null;
  phone: string | null;
  logoUrl: string | null;
  scope: string;
  states: string[];
  zipCodes: string[];
  tags: string[];
  popularityScore: number;
  popularityRank: number | null;
  userCount: number;
  affiliateActive: boolean;
  hasWebsite: boolean;
  hasPhone: boolean;
  coverageModel: string;
  coverageMatchLevel: string;
  coverageConfidence: ProviderCoverageConfidence;
  coverageNote: string | null;
  coverageSourceUrl: string | null;
  trust?: ProviderTrustSummary;
}

interface CompareResponse {
  mode: "compare";
  providers: CompareProvider[];
  comparedCount: number;
  sameCategory: boolean;
  categories: string[];
  allTags: string[];
  address: { id: string; state: string; zip: string; city: string; nickname: string | null } | null;
}

const CONFIDENCE_TONE: Record<string, string> = {
  high: "bg-tone-sage-bg text-tone-sage-fg border-tone-sage-br",
  medium: "bg-tone-sky-bg text-tone-sky-fg border-tone-sky-br",
  low: "bg-tone-honey-bg text-tone-honey-fg border-tone-honey-br",
  unknown: "bg-foreground/10 text-muted-foreground border-border",
};

function formatCount(n: number | undefined): string {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function YesNo({ value }: { value: boolean }) {
  return value ? (
    <span className="inline-flex items-center gap-1 text-tone-sage-fg">
      <Check className="h-3.5 w-3.5" /> Yes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <Minus className="h-3.5 w-3.5" /> No
    </span>
  );
}

/**
 * Full-screen overlay that fetches /api/providers/compare for the picked ids
 * and renders an aligned side-by-side table over the REAL provider attributes.
 * No ratings/reviews/price — those don't exist on the model and would be
 * fabricated data.
 */
export function CompareView({
  ids,
  addressId,
  onClose,
  onRemove,
}: {
  ids: string[];
  addressId: string | null;
  onClose: () => void;
  onRemove: (id: string) => void;
}) {
  const [data, setData] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    const params = new URLSearchParams({ ids: ids.join(",") });
    if (addressId) params.set("addressId", addressId);
    fetch(`/api/providers/compare?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Compare request failed (${res.status})`);
        return (await res.json()) as CompareResponse;
      })
      .then((res) => {
        if (!active) return;
        setData(res);
        trackEvent("provider_compare_view", { count: res.comparedCount });
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [ids, addressId]);

  const providers = data?.providers ?? [];

  const addressLabel = useMemo(() => {
    if (!data?.address) return null;
    const a = data.address;
    return a.nickname || [a.city, a.state].filter(Boolean).join(", ") || a.state;
  }, [data]);

  // Per-attribute "highlight" helpers so the best value in a row stands out.
  const bestUserCount = useMemo(() => Math.max(0, ...providers.map((p) => p.userCount)), [providers]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-foreground sm:text-lg">Compare providers</h2>
          {addressLabel ? (
            <p className="text-[11px] text-muted-foreground">
              Coverage confidence shown for <span className="font-medium text-foreground/80">{addressLabel}</span>
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">Add a primary address to see coverage at your address.</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close comparison"
          className="rounded-lg border border-border bg-foreground/5 p-2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-4 sm:px-6">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading comparison…
          </div>
        ) : error || providers.length < 2 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center text-muted-foreground">
            <AlertTriangle className="h-6 w-6 text-tone-honey-fg" />
            <p className="text-sm">Couldn&apos;t load the comparison. Pick at least two providers and try again.</p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-foreground/5"
            >
              Back to providers
            </button>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-5xl">
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-tone-honey-br bg-tone-honey-bg p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-tone-honey-fg" />
              <p className="text-[11px] leading-relaxed text-tone-honey-fg/85">
                These are unverified directory listings compared on real catalog attributes — coverage confidence at your
                address, relative popularity, category, tags, and whether an official link is available. There are no
                ratings, reviews, or prices here; confirm details with each provider before acting.
              </p>
            </div>

            {/* Comparison grid. Aligned rows render with a sticky left label
                column on wider screens; the providers form the columns. */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 w-36 bg-background p-2 text-left align-bottom text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Attribute
                    </th>
                    {providers.map((p) => {
                      const logoUrl = resolveLogoUrl(p.logoUrl);
                      return (
                        <th key={p.id} className="min-w-[160px] p-2 align-bottom">
                          <div className="flex flex-col items-center gap-2 text-center">
                            <div className="relative">
                              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-border bg-foreground/5">
                                {logoUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={logoUrl}
                                    alt={`${p.name} logo`}
                                    className="h-full w-full object-contain p-1"
                                    loading="lazy"
                                  />
                                ) : (
                                  <span className="text-xl">{getMergedDisplayCategoryIcon(p.category)}</span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => onRemove(p.id)}
                                aria-label={`Remove ${p.name} from comparison`}
                                className="absolute -right-2 -top-2 rounded-full border border-border bg-background p-0.5 text-muted-foreground shadow-sm hover:text-foreground"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                            <Link
                              href={`/providers/${p.id}`}
                              className="text-xs font-semibold leading-tight text-foreground hover:underline"
                            >
                              {p.name}
                            </Link>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  <CompareRow label="Coverage at your address">
                    {providers.map((p) => (
                      <Cell key={p.id}>
                        <span
                          className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                            CONFIDENCE_TONE[p.coverageConfidence.level] || CONFIDENCE_TONE.unknown
                          }`}
                        >
                          {p.coverageConfidence.label}
                        </span>
                        <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                          {p.coverageConfidence.message}
                        </p>
                      </Cell>
                    ))}
                  </CompareRow>

                  <CompareRow label="Popularity (in this set)">
                    {providers.map((p) => (
                      <Cell key={p.id}>
                        {p.popularityRank ? (
                          <span className="inline-flex items-center gap-1 text-foreground/80">
                            {p.popularityRank === 1 && <Trophy className="h-3.5 w-3.5 text-tone-honey-fg" />}#
                            {p.popularityRank}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </Cell>
                    ))}
                  </CompareRow>

                  <CompareRow label="Scope">
                    {providers.map((p) => (
                      <Cell key={p.id}>
                        {p.scope === "FEDERAL" ? (
                          <span className="inline-flex items-center gap-1 text-foreground/80">
                            <Flag className="h-3 w-3" /> National
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-foreground/80">
                            <MapPin className="h-3 w-3" /> State
                            {p.states.length > 0 ? ` · ${p.states.slice(0, 4).join(", ")}` : ""}
                          </span>
                        )}
                      </Cell>
                    ))}
                  </CompareRow>

                  <CompareRow label="Category">
                    {providers.map((p) => (
                      <Cell key={p.id}>
                        <span className="text-foreground/80">{getMergedDisplayCategoryLabel(p.category)}</span>
                        {getMergedDisplaySubcategoryLabel(p.category) && (
                          <p className="text-[10px] text-muted-foreground">
                            {getMergedDisplaySubcategoryLabel(p.category)}
                          </p>
                        )}
                      </Cell>
                    ))}
                  </CompareRow>

                  <CompareRow label="Community users">
                    {providers.map((p) => (
                      <Cell key={p.id}>
                        {p.userCount > 0 ? (
                          <span
                            className={`inline-flex items-center gap-1 ${
                              p.userCount === bestUserCount && bestUserCount > 0
                                ? "font-semibold text-foreground"
                                : "text-foreground/80"
                            }`}
                          >
                            <Users className="h-3 w-3" /> {formatCount(p.userCount)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </Cell>
                    ))}
                  </CompareRow>

                  <CompareRow label="Official link">
                    {providers.map((p) => (
                      <Cell key={p.id}>
                        <YesNo value={p.affiliateActive} />
                      </Cell>
                    ))}
                  </CompareRow>

                  <CompareRow label="Website">
                    {providers.map((p) => (
                      <Cell key={p.id}>
                        {p.website ? (
                          <a
                            href={p.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-full items-center gap-1 truncate text-tone-sky-fg hover:underline"
                          >
                            <ExternalLink className="h-3 w-3 shrink-0" /> {p.websiteHost || "Visit"}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </Cell>
                    ))}
                  </CompareRow>

                  <CompareRow label="Phone">
                    {providers.map((p) => (
                      <Cell key={p.id}>
                        {p.phone ? (
                          <a href={`tel:${p.phone}`} className="inline-flex items-center gap-1 text-foreground/80 hover:underline">
                            <Phone className="h-3 w-3" /> {p.phone}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </Cell>
                    ))}
                  </CompareRow>

                  <CompareRow label="Tags / features">
                    {providers.map((p) => (
                      <Cell key={p.id}>
                        {p.tags.length > 0 ? (
                          <div className="flex flex-wrap justify-center gap-1">
                            {p.tags.slice(0, 6).map((tag) => (
                              <span
                                key={tag}
                                className="rounded border border-border bg-foreground/5 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </Cell>
                    ))}
                  </CompareRow>

                  <CompareRow label="" last>
                    {providers.map((p) => (
                      <Cell key={p.id}>
                        <Link
                          href={`/services/new?providerId=${encodeURIComponent(p.id)}&category=${encodeURIComponent(p.category)}`}
                          className="inline-block rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground hover:opacity-90"
                        >
                          Track this
                        </Link>
                      </Cell>
                    ))}
                  </CompareRow>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CompareRow({
  label,
  children,
  last,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <tr>
      <th
        scope="row"
        className={`sticky left-0 z-10 bg-background p-2 text-left align-top text-[11px] font-medium text-muted-foreground ${
          last ? "" : "border-b border-border/60"
        }`}
      >
        {label}
      </th>
      {/* children already render <Cell> per provider; clone borders via class on Cell */}
      {Array.isArray(children)
        ? children.map((child, i) => (
            <td key={i} className={`p-2 text-center align-top ${last ? "" : "border-b border-border/60"}`}>
              {child}
            </td>
          ))
        : children}
    </tr>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px]">{children}</div>;
}
