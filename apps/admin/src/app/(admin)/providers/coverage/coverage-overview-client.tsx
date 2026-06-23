"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Globe,
  Loader2,
  MapPin,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin-page-header";
import { EmptyState } from "@/components/empty-state";
import { InfoHint } from "@/components/info-hint";
import { getCategoryLabel } from "@/lib/recommendation-engine";

interface StateRow {
  state: string;
  stateProviderCount: number;
  federalProviderCount: number;
  totalProviderCount: number;
  stateCategoryCount: number;
  effectiveCategoryCount: number;
  missingCategories: string[];
  isThin: boolean;
}

interface CategoryRow {
  category: string;
  isFederal: boolean;
  statesCovered: number;
  statesMissing: number;
  coveragePct: number;
}

interface OverviewData {
  summary: {
    totalStates: number;
    federalProviderCount: number;
    thinStateCount: number;
    thinStateThreshold: number;
    observedCategoryCount: number;
    fullyCoveredCategoryCount: number;
  };
  states: StateRow[];
  categories: CategoryRow[];
  thinStates: Array<{ state: string; stateProviderCount: number }>;
  thinCategories: CategoryRow[];
  priorityGaps: Array<{
    state: string;
    category: string;
    stateProviderCount: number;
    statesCovered: number;
    statesMissing: number;
    priorityScore: number;
    reason: string;
  }>;
}

export default function CoverageOverviewClient() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/providers/coverage-overview");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to load coverage overview");
      setData(json);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load coverage overview");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredStates = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toUpperCase();
    const rows = q ? data.states.filter((s) => s.state.includes(q)) : data.states;
    // Thinnest first so gaps float to the top.
    return [...rows].sort((a, b) => a.stateProviderCount - b.stateProviderCount);
  }, [data, search]);

  const coverageScore = data
    ? Math.round((data.summary.fullyCoveredCategoryCount / Math.max(data.summary.observedCategoryCount, 1)) * 100)
    : 0;
  const topGap = data?.priorityGaps?.[0] || null;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Catalog"
        title="Coverage <em>Overview</em>"
        subtitle="Per-state provider and category coverage, with the thin states and categories that need filling."
        actions={
          <button
            onClick={() => window.location.assign("/providers")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Providers
          </button>
        }
      />

      {loading ? (
        <div className="flex items-center gap-2 py-20 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading coverage overview…
        </div>
      ) : !data ? (
        <EmptyState
          icon={MapPin}
          title="No coverage data"
          description="Coverage overview could not be loaded."
          className="rounded-2xl border border-dashed border-border"
        />
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {[
              { label: "States + DC", value: data.summary.totalStates, color: "text-foreground", bg: "bg-card" },
              { label: "Federal providers", value: data.summary.federalProviderCount, color: "text-tone-sky-fg", bg: "bg-tone-sky-bg" },
              { label: "Categories tracked", value: data.summary.observedCategoryCount, color: "text-foreground", bg: "bg-card" },
              { label: "Fully covered categories", value: data.summary.fullyCoveredCategoryCount, color: "text-tone-sage-fg", bg: "bg-tone-sage-bg" },
              { label: `Thin states (<${data.summary.thinStateThreshold})`, value: data.summary.thinStateCount, color: "text-tone-honey-fg", bg: "bg-tone-honey-bg" },
            ].map((s) => (
              <div key={s.label} className={`rounded-2xl border border-border ${s.bg} p-4`}>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{s.label}</p>
                <p className={`mt-1.5 font-display text-3xl font-extrabold leading-none ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Operator cockpit</p>
                <div className="mt-3 flex items-end gap-3">
                  <p className="font-display text-4xl font-extrabold leading-none text-foreground">
                    <span className="font-mono">{coverageScore}</span>%
                  </p>
                  <p className="pb-1 text-sm text-muted-foreground">category coverage completeness</p>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${coverageScore}%` }} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl border border-tone-honey-br bg-tone-honey-bg p-3 text-tone-honey-fg">
                    <p className="font-mono text-base font-semibold">{data.priorityGaps.length}</p>
                    <p className="mt-0.5 opacity-80">priority gaps queued</p>
                  </div>
                  <div className="rounded-xl border border-tone-sky-br bg-tone-sky-bg p-3 text-tone-sky-fg">
                    <p className="font-mono text-base font-semibold">{data.summary.thinStateCount}</p>
                    <p className="mt-0.5 opacity-80">thin states</p>
                  </div>
                </div>
                {topGap ? (
                  <div className="mt-4 rounded-xl border border-border bg-background p-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Next best fill</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      <span className="font-mono text-primary">{topGap.state}</span> · {getCategoryLabel(topGap.category)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{topGap.reason}</p>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                {(data.priorityGaps || []).slice(0, 8).map((gap) => (
                  <div key={`${gap.state}-${gap.category}`} className="rounded-xl border border-border bg-background p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          <span className="font-mono text-primary">{gap.state}</span> · {getCategoryLabel(gap.category)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          <span className="font-mono">{gap.stateProviderCount}</span> state providers · category in <span className="font-mono">{gap.statesCovered}/{data.summary.totalStates}</span> states
                        </p>
                      </div>
                      <span className="rounded-full border border-tone-honey-br bg-tone-honey-bg px-2 py-0.5 font-mono text-[10px] font-semibold text-tone-honey-fg">
                        {gap.priorityScore}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Gap callouts */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-tone-honey-br bg-tone-honey-bg p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-tone-honey-fg" />
                <div className="min-w-0">
                  <h2 className="font-display text-base font-bold text-foreground">
                    Thin states
                    <InfoHint
                      label="Thin states"
                      text={`States with fewer than ${data.summary.thinStateThreshold} state-specific providers (federal providers apply everywhere and are not counted here).`}
                      className="ml-1"
                    />
                  </h2>
                  {data.thinStates.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {data.thinStates.map((s) => (
                        <span key={s.state} className="rounded-full border border-tone-honey-br bg-background px-2.5 py-1 text-xs font-medium text-tone-honey-fg">
                          <span className="font-mono">{s.state}</span>: <span className="font-mono">{s.stateProviderCount}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">No thin states — every state meets the provider floor.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-tone-honey-br bg-tone-honey-bg p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-tone-honey-fg" />
                <div className="min-w-0">
                  <h2 className="font-display text-base font-bold text-foreground">
                    Thin categories
                    <InfoHint
                      label="Thin categories"
                      text="Non-federal categories that have a state-specific provider in fewer than all 50+DC states. The number is how many states are covered."
                      className="ml-1"
                    />
                  </h2>
                  {data.thinCategories.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {data.thinCategories.slice(0, 12).map((c) => (
                        <span key={c.category} className="rounded-full border border-tone-honey-br bg-background px-2.5 py-1 text-xs font-medium text-tone-honey-fg">
                          {getCategoryLabel(c.category)}: <span className="font-mono">{c.statesCovered}/{data.summary.totalStates}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">No thin categories — every tracked category is fully covered.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Per-state table */}
          <div className="flex items-center gap-3">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value.toUpperCase().slice(0, 2))}
                placeholder="Filter by state (e.g. TX)"
                maxLength={2}
                className="w-full rounded-xl border border-input bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <p className="text-xs text-muted-foreground">Sorted by fewest state-specific providers first.</p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">State</th>
                  <th className="px-4 py-3 text-center text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    State providers
                  </th>
                  <th className="px-4 py-3 text-center text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    + Federal
                  </th>
                  <th className="px-4 py-3 text-center text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Categories</th>
                  <th className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Missing categories</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredStates.map((row) => (
                  <tr key={row.state} className={`bg-card transition-colors hover:bg-accent/40 ${row.isThin ? "bg-tone-honey-bg/30" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-foreground">{row.state}</span>
                        {row.isThin && (
                          <span className="rounded-full bg-tone-honey-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-tone-honey-fg">
                            thin
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-mono text-sm font-bold ${row.stateProviderCount === 0 ? "text-destructive" : "text-foreground"}`}>
                        {row.stateProviderCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Globe className="h-3 w-3" /> <span className="font-mono">{row.federalProviderCount}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-sm text-foreground">
                      {row.effectiveCategoryCount}
                    </td>
                    <td className="px-4 py-3">
                      {row.missingCategories.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {row.missingCategories.slice(0, 5).map((cat) => (
                            <span key={cat} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                              {getCategoryLabel(cat)}
                            </span>
                          ))}
                          {row.missingCategories.length > 5 && (
                            <span className="text-[11px] text-muted-foreground">
                              +{row.missingCategories.length - 5} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-tone-sage-fg">
                          <Building2 className="h-3 w-3" /> All tracked categories covered
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
