"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Activity, MapPin, Sparkles, ThumbsDown } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminPanel } from "@/components/admin-panel";
import { MinistatStrip } from "@/components/ministat-strip";
import { Sparkline } from "@/components/aurora";
import type {
  AreaPreferenceRow,
  BriefingTrend,
  FeedbackByCategory,
  SourceHealth,
  SourceStatus,
} from "./insights-data";

export interface InsightsClientProps {
  health: SourceHealth[];
  briefing: BriefingTrend;
  feedback: FeedbackByCategory[];
  area: AreaPreferenceRow[];
  windows: { healthDays: number; feedbackDays: number; floor: number };
}

/** Health-bucket → color. Always --au-* vars — never raw hex (tone tokens). */
const BUCKET_COLORS = {
  ok: "var(--au-mint)",
  error: "var(--au-danger)",
  notConfigured: "var(--au-ink-3)",
  other: "var(--au-amber)",
} as const;

const AI_SERIES_COLORS = {
  generated: "var(--au-mint)",
  cached: "var(--au-cool)",
  gated: "var(--au-amber)",
} as const;

const STATUS_PILL_CLASS: Record<SourceStatus, string> = {
  healthy: "bg-tone-sage-bg text-tone-sage-fg",
  degraded: "bg-tone-orange-bg text-tone-orange-fg",
  off: "bg-muted text-muted-foreground",
};

/**
 * Translate a dynamic key, falling back to the raw value when the catalog has
 * no entry (same contract as the sidebar's navLabel — next-intl either throws
 * or returns the message path depending on env).
 */
function safeT(
  t: ReturnType<typeof useTranslations>,
  key: string,
  fallback: string,
): string {
  let value: string;
  try {
    value = t(key);
  } catch {
    return fallback;
  }
  return value === `insights.${key}` ? fallback : value;
}

function StatusPill({ status }: { status: SourceStatus }) {
  const t = useTranslations("insights");
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STATUS_PILL_CLASS[status]}`}
    >
      {t(`health.status.${status}`)}
    </span>
  );
}

/** Compact stacked ratio bar over a source's 14-day bucket totals. */
function RatioBar({ totals }: { totals: SourceHealth["totals"] }) {
  const total =
    totals.ok + totals.error + totals.notConfigured + totals.other;
  if (total === 0) {
    return <div className="h-2 flex-1 rounded-full bg-muted" />;
  }
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-muted">
      <div style={{ width: pct(totals.ok), backgroundColor: BUCKET_COLORS.ok }} />
      <div style={{ width: pct(totals.error), backgroundColor: BUCKET_COLORS.error }} />
      <div style={{ width: pct(totals.notConfigured), backgroundColor: BUCKET_COLORS.notConfigured }} />
      <div style={{ width: pct(totals.other), backgroundColor: BUCKET_COLORS.other }} />
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

export function InsightsClient({
  health,
  briefing,
  feedback,
  area,
  windows,
}: InsightsClientProps) {
  const t = useTranslations("insights");
  const [stateFilter, setStateFilter] = useState("");

  const stateOptions = useMemo(
    () => [...new Set(area.map((r) => r.state))].sort(),
    [area],
  );
  const filteredArea = useMemo(
    () => (stateFilter ? area.filter((r) => r.state === stateFilter) : area),
    [area, stateFilter],
  );

  const healthyCount = health.filter((h) => h.status === "healthy").length;
  const briefingsServed = briefing.totals.generated + briefing.totals.cached;
  const feedbackTotal = feedback.reduce((sum, f) => sum + f.total, 0);
  const hasBriefingActivity =
    briefingsServed + briefing.totals.gated > 0;

  return (
    <div className="space-y-6">
      {/* The <em> segment gets the brand foil gradient (AdminPageHeader
          parses it) — composed here so the message catalog stays plain text
          and never trips next-intl's rich-text handling. */}
      <AdminPageHeader
        eyebrow={t("eyebrow")}
        title={`<em>${t("title")}</em>`}
        subtitle={t("subtitle")}
      />

      <MinistatStrip
        items={[
          {
            key: "healthy",
            icon: Activity,
            label: t("kpi.healthy"),
            value: `${healthyCount}/${health.length}`,
            tone: "mint",
          },
          {
            key: "briefings",
            icon: Sparkles,
            label: t("kpi.briefings", { days: windows.healthDays }),
            value: briefingsServed.toLocaleString(),
            sub: t("kpi.briefingsGated", {
              count: briefing.totals.gated,
            }),
            tone: "cool",
          },
          {
            key: "feedback",
            icon: ThumbsDown,
            label: t("kpi.feedback", { days: windows.feedbackDays }),
            value: feedbackTotal.toLocaleString(),
            tone: "amber",
          },
          {
            key: "cohorts",
            icon: MapPin,
            label: t("kpi.cohorts"),
            value: area.length.toLocaleString(),
            tone: "coral",
          },
        ]}
      />

      {/* ── Panel 1 · Data source health ───────────────────────── */}
      <AdminPanel
        title={t("health.title")}
        caption={t("health.caption", { days: windows.healthDays })}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <LegendSwatch color={BUCKET_COLORS.ok} label={t("health.ok")} />
            <LegendSwatch color={BUCKET_COLORS.error} label={t("health.error")} />
            <LegendSwatch
              color={BUCKET_COLORS.notConfigured}
              label={t("health.notConfigured")}
            />
            <LegendSwatch color={BUCKET_COLORS.other} label={t("health.other")} />
          </div>
        }
      >
        {health.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("health.empty")}
          </p>
        ) : (
          <div className="space-y-3">
            {health.map((source) => (
              <div key={source.source} className="flex items-center gap-4">
                <span
                  className="w-32 shrink-0 truncate text-xs font-medium text-foreground"
                  title={source.source}
                >
                  {safeT(t, `health.sources.${source.source}`, source.source)}
                </span>
                <RatioBar totals={source.totals} />
                <span className="w-36 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                  {source.totals.ok.toLocaleString()} ·{" "}
                  {source.totals.error.toLocaleString()} ·{" "}
                  {source.totals.notConfigured.toLocaleString()}
                </span>
                <span className="w-24 shrink-0 text-right">
                  <StatusPill status={source.status} />
                </span>
              </div>
            ))}
          </div>
        )}
      </AdminPanel>

      {/* ── Panel 2 · AI metrics (briefing outcomes) ───────────── */}
      <AdminPanel
        title={t("ai.title")}
        caption={t("ai.caption", { days: windows.healthDays })}
      >
        {!hasBriefingActivity ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("ai.empty")}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {(["generated", "cached", "gated"] as const).map((series) => (
              <div key={series} className="rounded-lg bg-muted/30 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t(`ai.${series}`)}
                  </span>
                  <span className="font-mono text-lg font-semibold tabular-nums text-foreground">
                    {briefing.totals[series].toLocaleString()}
                  </span>
                </div>
                <div className="mt-2">
                  <Sparkline
                    values={briefing[series]}
                    color={AI_SERIES_COLORS[series]}
                    width={220}
                    height={36}
                  />
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>{briefing.days[0]?.slice(5)}</span>
                  <span>{briefing.days[briefing.days.length - 1]?.slice(5)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminPanel>

      {/* ── Panel 3 · Recommendation quality ───────────────────── */}
      <AdminPanel
        title={t("reco.title")}
        caption={t("reco.caption", { days: windows.feedbackDays })}
      >
        {feedback.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("reco.empty")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="py-2 pr-4">{t("reco.category")}</th>
                  <th scope="col" className="py-2 pr-4 text-right">{t("reco.dismissed")}</th>
                  <th scope="col" className="py-2 pr-4 text-right">{t("reco.notRelevant")}</th>
                  <th scope="col" className="py-2 pr-4 text-right">{t("reco.snoozed")}</th>
                  <th scope="col" className="py-2 text-right">{t("reco.total")}</th>
                </tr>
              </thead>
              <tbody>
                {feedback.map((row) => (
                  <tr key={row.category ?? "∅"} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-medium text-foreground">
                      {row.category ?? t("reco.uncategorized")}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono tabular-nums text-foreground">
                      {row.dismissed.toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono tabular-nums text-foreground">
                      {row.notRelevant.toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono tabular-nums text-foreground">
                      {row.snoozed.toLocaleString()}
                    </td>
                    <td className="py-2 text-right font-mono font-semibold tabular-nums text-foreground">
                      {row.total.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>

      {/* ── Panel 4 · Area preferences (ZIP intelligence) ──────── */}
      <AdminPanel
        title={t("area.title")}
        caption={t("area.caption", { floor: windows.floor })}
        actions={
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              {t("area.rows", { count: filteredArea.length })}
            </span>
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
              aria-label={t("area.filterLabel")}
            >
              <option value="">{t("area.allStates")}</option>
              {stateOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        }
      >
        {filteredArea.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("area.empty", { floor: windows.floor })}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="py-2 pr-4">{t("area.state")}</th>
                  <th scope="col" className="py-2 pr-4">{t("area.category")}</th>
                  <th scope="col" className="py-2 pr-4">{t("area.provider")}</th>
                  <th scope="col" className="py-2 pr-4 text-right">{t("area.users")}</th>
                  <th scope="col" className="py-2 text-right">{t("area.services")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredArea.map((row) => (
                  <tr
                    key={`${row.state}-${row.category}-${row.providerId}`}
                    className="border-b border-border/50"
                  >
                    <td className="py-2 pr-4 font-mono text-xs text-foreground">
                      {row.state}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {row.category}
                    </td>
                    <td className="py-2 pr-4 font-medium text-foreground">
                      {row.providerName}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono tabular-nums text-foreground">
                      {row.userCount.toLocaleString()}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums text-foreground">
                      {row.serviceCount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>
    </div>
  );
}
