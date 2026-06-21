"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Home,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import type {
  ProviderGrowthPriorityItem,
  ProviderModelCount,
  ProviderQueryDiagnostics,
  ProviderQualitySnapshot,
  ProviderQueryMatchLevel,
} from "@locateflow/shared";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminPanel } from "@/components/admin-panel";
import { EmptyState } from "@/components/empty-state";
import { getCategoryLabel } from "@/lib/recommendation-engine";

type LiveDataStatus = "ready" | "missing" | "partial" | "disabled" | "keyless";

interface LiveDataReadinessItem {
  id: string;
  label: string;
  status: LiveDataStatus;
  configured: boolean;
  detail: string;
}

interface ProviderQualityResponse {
  snapshot: ProviderQualitySnapshot;
  queryDiagnostics: ProviderQueryDiagnostics;
  liveDataReadiness: LiveDataReadinessItem[];
}

const STATUS_STYLES: Record<LiveDataStatus, string> = {
  ready: "border-tone-sage-br bg-tone-sage-bg text-tone-sage-fg",
  keyless: "border-tone-sky-br bg-tone-sky-bg text-tone-sky-fg",
  partial: "border-tone-honey-br bg-tone-honey-bg text-tone-honey-fg",
  missing: "border-destructive/30 bg-destructive/10 text-destructive",
  disabled: "border-border bg-muted text-muted-foreground",
};

const PRIORITY_STYLES: Record<ProviderGrowthPriorityItem["priority"], string> = {
  P0: "border-destructive/30 bg-destructive/10 text-destructive",
  P1: "border-tone-honey-br bg-tone-honey-bg text-tone-honey-fg",
  P2: "border-tone-sky-br bg-tone-sky-bg text-tone-sky-fg",
  P3: "border-border bg-muted text-muted-foreground",
};

const MODEL_LABELS: Record<ProviderModelCount["model"], string> = {
  live_address: "Live address",
  zip_prefix: "ZIP",
  polygon: "Polygon",
  state: "State",
};

const MATCH_LABELS: Record<ProviderQueryMatchLevel, string> = {
  exact_zip: "Exact ZIP",
  zip_prefix: "ZIP prefix",
  mapped_area: "Mapped area",
  live_address: "Live address",
  state: "State",
  federal: "Federal",
  unknown: "Unknown",
};

const DOSSIER_READINESS_IDS = new Set([
  "airnow",
  "census",
  "hud-housing",
  "nlr-ev-charging",
]);

const NEW_DOSSIER_READINESS_IDS = new Set(["hud-housing", "nlr-ev-charging"]);

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function statusIcon(status: LiveDataStatus) {
  if (status === "ready" || status === "keyless") return CheckCircle2;
  if (status === "disabled") return XCircle;
  return AlertTriangle;
}

function dossierSourceIcon(id: string, status: LiveDataStatus) {
  if (id === "hud-housing") return Home;
  if (id === "nlr-ev-charging") return Zap;
  return statusIcon(status);
}

function countTotal(rows: Array<{ count: number }>): number {
  return rows.reduce((sum, row) => sum + row.count, 0);
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "good" | "warn" | "bad" | "info";
}) {
  const toneClass =
    tone === "good"
      ? "text-tone-sage-fg bg-tone-sage-bg border-tone-sage-br"
      : tone === "warn"
        ? "text-tone-honey-fg bg-tone-honey-bg border-tone-honey-br"
        : tone === "bad"
          ? "text-destructive bg-destructive/10 border-destructive/30"
          : tone === "info"
            ? "text-tone-sky-fg bg-tone-sky-bg border-tone-sky-br"
            : "text-foreground bg-card border-border";

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClass}`}>
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] opacity-75">{label}</p>
      <p className="mt-1.5 font-display text-3xl font-extrabold leading-none">{value}</p>
    </div>
  );
}

function DistributionBars({
  rows,
  labelFor,
}: {
  rows: Array<{ count: number }>;
  labelFor: (row: any) => string;
}) {
  const total = Math.max(countTotal(rows), 1);
  return (
    <div className="space-y-2">
      {rows.filter((row) => row.count > 0).map((row) => {
        const pct = Math.round((row.count / total) * 100);
        return (
          <div key={labelFor(row)} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-medium text-foreground">{labelFor(row)}</span>
              <span className="font-mono text-muted-foreground">{formatNumber(row.count)} ({pct}%)</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ProviderQualityClient() {
  const [data, setData] = useState<ProviderQualityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState("TX");
  const [zip, setZip] = useState("78701");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (state.trim()) params.set("state", state.trim().toUpperCase());
    if (zip.trim()) params.set("zip", zip.trim());
    if (lat.trim()) params.set("lat", lat.trim());
    if (lng.trim()) params.set("lng", lng.trim());

    try {
      const res = await fetch(`/api/provider-quality?${params.toString()}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to load provider quality");
      setData(json);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load provider quality");
    } finally {
      setLoading(false);
    }
  }, [lat, lng, state, zip]);

  useEffect(() => {
    load();
    // Run once on mount; form changes are applied by Run/Refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    load();
  };

  const liveReadyCount = useMemo(() => {
    return data?.liveDataReadiness.filter((item) => item.status === "ready" || item.status === "keyless").length ?? 0;
  }, [data]);

  const dossierReadiness = useMemo(() => {
    return data?.liveDataReadiness.filter((item) => DOSSIER_READINESS_IDS.has(item.id)) ?? [];
  }, [data]);

  const otherReadiness = useMemo(() => {
    return data?.liveDataReadiness.filter((item) => !DOSSIER_READINESS_IDS.has(item.id)) ?? [];
  }, [data]);

  const dossierReadyCount = useMemo(() => {
    return dossierReadiness.filter((item) => item.status === "ready" || item.status === "keyless").length;
  }, [dossierReadiness]);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Catalog"
        title="Provider <em>Quality</em>"
        subtitle="Recommendation precision, live data readiness, and catalog growth priorities."
        actions={
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
        }
      />

      {loading && !data ? (
        <div className="flex items-center gap-2 py-20 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading provider quality...
        </div>
      ) : !data ? (
        <EmptyState
          icon={Database}
          title="No provider quality data"
          description="The quality report could not be loaded."
          className="rounded-2xl border border-dashed border-border"
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <MetricCard label="Active providers" value={formatNumber(data.snapshot.summary.activeProviders)} />
            <MetricCard label="Categories" value={formatNumber(data.snapshot.summary.categoryCount)} tone="info" />
            <MetricCard
              label="Overbroad sensitive"
              value={formatNumber(data.snapshot.summary.stateScopedOverbroadProviders)}
              tone={data.snapshot.summary.stateScopedOverbroadProviders === 0 ? "good" : "bad"}
            />
            <MetricCard
              label="Live/ZIP sensitive"
              value={formatNumber(data.snapshot.summary.locationSensitiveNonStateCoverage)}
              tone="good"
            />
            <MetricCard
              label="Sparse categories"
              value={formatNumber(data.snapshot.summary.sparseCategoryCount)}
              tone={data.snapshot.summary.sparseCategoryCount === 0 ? "good" : "warn"}
            />
            <MetricCard
              label="Live sources"
              value={`${liveReadyCount}/${data.liveDataReadiness.length}`}
              tone={liveReadyCount === data.liveDataReadiness.length ? "good" : "warn"}
            />
          </div>

          {dossierReadiness.length > 0 && (
            <AdminPanel
              title="Dossier Source Readiness"
              caption="Runtime gates for air, Census, HUD housing, and public EV charging sections."
              flagship
            >
              <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                <div className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">New Home Dossier</p>
                      <p className="mt-1.5 font-display text-3xl font-extrabold leading-none text-foreground">
                        <span className="font-mono">{dossierReadyCount}</span>/<span className="font-mono">{dossierReadiness.length}</span>
                      </p>
                      <p className="mt-1.5 text-sm text-muted-foreground">source gates ready</p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-tone-sky-br bg-tone-sky-bg text-tone-sky-fg">
                      <Database className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.round((dossierReadyCount / Math.max(dossierReadiness.length, 1)) * 100)}%` }}
                    />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl border border-tone-sage-br bg-tone-sage-bg p-3 text-tone-sage-fg">
                      <p className="font-mono text-base font-semibold">{dossierReadyCount}</p>
                      <p className="mt-0.5 opacity-80">ready or keyless</p>
                    </div>
                    <div className="rounded-xl border border-tone-honey-br bg-tone-honey-bg p-3 text-tone-honey-fg">
                      <p className="font-mono text-base font-semibold">{dossierReadiness.length - dossierReadyCount}</p>
                      <p className="mt-0.5 opacity-80">needs config</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {dossierReadiness.map((item) => {
                    const SourceIcon = dossierSourceIcon(item.id, item.status);
                    const isNewDossierSource = NEW_DOSSIER_READINESS_IDS.has(item.id);
                    return (
                      <div key={item.id} className={`rounded-[1.1rem] border p-4 shadow-sm ${STATUS_STYLES[item.status]}`}>
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-current/20 bg-background/35">
                            <SourceIcon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold">{item.label}</p>
                              {isNewDossierSource ? (
                                <span className="rounded-full border border-current/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]">
                                  New dossier section
                                </span>
                              ) : null}
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-current/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]">
                                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                {item.status}
                              </span>
                            </div>
                            <p className="mt-1 text-xs opacity-80">{item.detail}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </AdminPanel>
          )}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <AdminPanel
              title="Other Live Data Readiness"
              caption="Runtime gates for provider recommendations, utilities, and mover verification."
              className="xl:col-span-2"
            >
              <div className="grid gap-3 md:grid-cols-2">
                {otherReadiness.map((item) => {
                  const Icon = statusIcon(item.status);
                  return (
                    <div key={item.id} className={`rounded-2xl border p-4 ${STATUS_STYLES[item.status]}`}>
                      <div className="flex items-start gap-3">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold">{item.label}</p>
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-current/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]">
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />
                              {item.status}
                            </span>
                          </div>
                          <p className="mt-1 text-xs opacity-80">{item.detail}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </AdminPanel>

            <AdminPanel title="Coverage Models" caption="Active provider catalog by effective precision.">
              <DistributionBars rows={data.snapshot.coverageModels} labelFor={(row) => MODEL_LABELS[row.model as ProviderModelCount["model"]]} />
            </AdminPanel>
          </div>

          <AdminPanel
            title="State + ZIP Recommendation Check"
            caption="Runs the catalog-side quality check for the selected market."
            flagship
            actions={
              <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
                <input
                  value={state}
                  onChange={(event) => setState(event.target.value.toUpperCase().slice(0, 2))}
                  placeholder="State"
                  maxLength={2}
                  className="h-9 w-20 rounded-xl border border-input bg-background px-3 font-mono text-sm text-foreground"
                />
                <input
                  value={zip}
                  onChange={(event) => setZip(event.target.value.replace(/\D/g, "").slice(0, 5))}
                  placeholder="ZIP"
                  maxLength={5}
                  className="h-9 w-24 rounded-xl border border-input bg-background px-3 font-mono text-sm text-foreground"
                />
                <input
                  value={lat}
                  onChange={(event) => setLat(event.target.value.slice(0, 12))}
                  placeholder="Lat"
                  className="h-9 w-24 rounded-xl border border-input bg-background px-3 font-mono text-sm text-foreground"
                />
                <input
                  value={lng}
                  onChange={(event) => setLng(event.target.value.slice(0, 12))}
                  placeholder="Lng"
                  className="h-9 w-24 rounded-xl border border-input bg-background px-3 font-mono text-sm text-foreground"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Run
                </button>
              </form>
            }
          >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Effective state</p>
                <p className="mt-1.5 font-display text-2xl font-extrabold leading-none text-foreground"><span className="font-mono">{data.queryDiagnostics.input.effectiveState || "Any"}</span></p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Candidate providers</p>
                <p className="mt-1.5 font-display text-2xl font-extrabold leading-none text-foreground"><span className="font-mono">{formatNumber(data.queryDiagnostics.candidateCount)}</span></p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Address-check candidates</p>
                <p className="mt-1.5 font-display text-2xl font-extrabold leading-none text-foreground"><span className="font-mono">{formatNumber(data.queryDiagnostics.addressCheckCandidateCount)}</span></p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Coordinates</p>
                <p className="mt-1.5 font-display text-2xl font-extrabold leading-none text-foreground">{data.queryDiagnostics.input.hasCoordinates ? "Yes" : "No"}</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div>
                <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" /> Model mix
                </h4>
                <DistributionBars rows={data.queryDiagnostics.modelCounts} labelFor={(row) => MODEL_LABELS[row.model as ProviderModelCount["model"]]} />
              </div>
              <div>
                <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <MapPin className="h-4 w-4 text-muted-foreground" /> Match levels
                </h4>
                <DistributionBars rows={data.queryDiagnostics.matchCounts} labelFor={(row) => MATCH_LABELS[row.matchLevel as ProviderQueryMatchLevel]} />
              </div>
              <div>
                <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" /> Confidence
                </h4>
                <DistributionBars rows={data.queryDiagnostics.confidenceCounts} labelFor={(row) => String(row.confidence).toUpperCase()} />
              </div>
            </div>

            <div className="mt-5 overflow-x-auto overscroll-x-contain rounded-2xl border border-border">
              <table className="w-full min-w-[640px]">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Provider</th>
                    <th className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Category</th>
                    <th className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Model</th>
                    <th className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Match</th>
                    <th className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Warnings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.queryDiagnostics.topProviders.map((provider) => (
                    <tr key={`${provider.id || provider.name}-${provider.category}`} className="bg-card">
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{provider.name}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{getCategoryLabel(provider.category)}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{MODEL_LABELS[provider.coverageModel]}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{MATCH_LABELS[provider.matchLevel]}</td>
                      <td className="px-4 py-3">
                        {provider.warningCodes.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {provider.warningCodes.slice(0, 3).map((warning) => (
                              <span key={warning} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                                {warning}
                              </span>
                            ))}
                            {provider.warningCodes.length > 3 ? (
                              <span className="font-mono text-[11px] text-muted-foreground">+{provider.warningCodes.length - 3}</span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-tone-sage-fg">Clean</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AdminPanel>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <AdminPanel title="Growth Priorities" caption="Ordered backlog for provider data expansion." className="xl:col-span-2">
              <div className="space-y-3">
                {data.snapshot.priorityItems.map((item) => (
                  <div key={`${item.priority}-${item.title}`} className={`rounded-2xl border p-4 ${PRIORITY_STYLES[item.priority]}`}>
                    <div className="flex items-start gap-3">
                      <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-current/25 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em]">
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {item.priority}
                          </span>
                          <h4 className="font-display text-sm font-bold">{item.title}</h4>
                          <span className="text-xs opacity-75">{item.affectedArea}</span>
                        </div>
                        <p className="mt-2 text-xs opacity-85">{item.recommendation}</p>
                        <p className="mt-1 text-xs font-medium opacity-75">{item.evidence}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </AdminPanel>

            <AdminPanel title="Warnings" caption="Most frequent catalog quality signals.">
              <div className="space-y-2">
                {data.snapshot.warningSummary.slice(0, 10).map((warning) => (
                  <div key={`${warning.code}-${warning.severity}`} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-medium text-foreground">{warning.code}</p>
                      <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{warning.severity}</p>
                    </div>
                    <span className="font-mono text-sm font-semibold text-foreground">{formatNumber(warning.count)}</span>
                  </div>
                ))}
              </div>
            </AdminPanel>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <AdminPanel title="Sparse Categories" caption="Categories with three or fewer active providers." dense>
              <div className="flex flex-wrap gap-2">
                {data.snapshot.sparseCategories.slice(0, 24).map((category) => (
                  <span key={category.category} className="rounded-full border border-tone-honey-br bg-tone-honey-bg px-2.5 py-1 text-xs text-tone-honey-fg">
                    {getCategoryLabel(category.category)}: <span className="font-mono">{category.count}</span>
                  </span>
                ))}
              </div>
            </AdminPanel>
            <AdminPanel title="Thin States" caption={`States below ${data.snapshot.summary.thinStateThreshold} state-specific providers.`} dense>
              <div className="flex flex-wrap gap-2">
                {data.snapshot.thinStates.slice(0, 24).map((stateRow) => (
                  <span key={stateRow.state} className="rounded-full border border-tone-sky-br bg-tone-sky-bg px-2.5 py-1 text-xs text-tone-sky-fg">
                    <span className="font-mono">{stateRow.state}</span>: <span className="font-mono">{stateRow.stateProviderCount}</span>
                  </span>
                ))}
              </div>
            </AdminPanel>
          </div>

          <p className="text-xs text-muted-foreground">
            Generated <span className="font-mono">{new Date(data.snapshot.generatedAt).toLocaleString()}</span>. Catalog quality is separate from live API availability.
          </p>
        </>
      )}
    </div>
  );
}
