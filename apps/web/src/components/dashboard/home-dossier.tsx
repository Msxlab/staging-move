"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CloudSun, Compass, GraduationCap, Lock, MapPin, Sparkles, Waves } from "lucide-react";

/**
 * NEW HOME DOSSIER — Aurora dashboard widget.
 *
 * Three honest, sourced facts about the user's next home (the active move's
 * destination address, else the primary address):
 *   1. FEMA flood zone (+ mandatory "not an insurance determination" fine print
 *      and a link to the official FEMA map service center),
 *   2. School district (NCES boundaries — assignment may differ), and
 *   3. Moving-day weather (NWS forecast; only when the move is ≤7 days out).
 *
 * GRACEFUL DEGRADATION (same contract style as apps/web/src/lib/fcc-isp.ts):
 * the card consumes GET /api/addresses/{id}/dossier, whose sections each carry
 * a status union. Anything non-"ok" simply hides that row; when EVERY section
 * is degraded (no_location/error) the whole card disappears — never an empty
 * shell. A location-less address with something still renderable (e.g. the
 * primary-address case where weather is merely "too_far") gets one honest
 * "add a precise address" hint row instead of fabricated rows. Fetch failures
 * never throw into the dashboard — they collapse to the hidden state.
 */

// ── Contract types (GET /api/addresses/{id}/dossier) ─────────────────────────

export type DossierSectionStatus = "ok" | "no_location" | "error";
export type DossierWeatherStatus = "ok" | "no_location" | "too_far" | "error";

export interface HomeDossierResponse {
  configured: boolean;
  /**
   * Plan gate (GATE-API contract, HTTP 200): `false` means the user's plan
   * (FREE/FREE_TRIAL) doesn't include the dossier — render the upgrade teaser.
   * Absent on older/entitled payloads, which keeps today's behavior.
   */
  entitled?: boolean;
  /** Companion gate signal — any truthy value is treated the same as entitled:false. */
  upgradeRequired?: boolean;
  /** Gate code (e.g. an *_UPGRADE_REQUIRED constant) — informational only here. */
  code?: string;
  /** Sections are absent on gated payloads; the teaser never reads them. */
  address?: { id: string; city: string; state: string };
  flood?: { status: DossierSectionStatus; zone: string | null; isHighRisk: boolean | null };
  school?: { status: DossierSectionStatus; districtName: string | null; ncesId: string | null };
  weather?: {
    status: DossierWeatherStatus;
    forecastDate: string | null;
    summary: string | null;
    tempHighF: number | null;
    tempLowF: number | null;
    precipChancePct: number | null;
  };
}

/**
 * True when the API answered 200 with a plan gate instead of data: the feature
 * is configured (key present) but the user's plan doesn't include it. The card
 * then renders the value-first upgrade teaser instead of hiding. configured:false
 * still hides everything — never tease a feature the deployment can't serve.
 */
export function isDossierGated(data: HomeDossierResponse | null | undefined): boolean {
  return !!data && data.configured === true && (data.entitled === false || data.upgradeRequired === true);
}

// ── Pure view derivation (exported for tests) ────────────────────────────────

export interface HomeDossierView {
  /** False → render nothing at all (never show an empty shell). */
  visible: boolean;
  flood: { zone: string; isHighRisk: boolean | null } | null;
  school: { districtName: string } | null;
  weather: {
    forecastDate: string | null;
    summary: string | null;
    tempHighF: number | null;
    tempLowF: number | null;
    precipChancePct: number | null;
  } | null;
  /** One honest "add a precise address to unlock local insights" row. */
  showLocationHint: boolean;
}

const HIDDEN_VIEW: HomeDossierView = {
  visible: false,
  flood: null,
  school: null,
  weather: null,
  showLocationHint: false,
};

/**
 * Decide what (if anything) the card shows. Defensive against partial/missing
 * payloads: a malformed response degrades to the hidden state, an "ok" section
 * missing its headline datum (zone / districtName / any weather figure) is
 * skipped rather than rendered empty.
 */
export function deriveDossierView(data: HomeDossierResponse | null | undefined): HomeDossierView {
  if (!data || data.configured !== true || !data.address || !data.flood || !data.school || !data.weather) {
    return HIDDEN_VIEW;
  }

  const statuses: string[] = [data.flood.status, data.school.status, data.weather.status];
  // Whole card hidden when EVERY section is no_location/error — there is
  // nothing honest to say and no actionable hint beyond what the address form
  // already communicates.
  if (statuses.every((s) => s === "no_location" || s === "error")) return HIDDEN_VIEW;

  const flood =
    data.flood.status === "ok" && typeof data.flood.zone === "string" && data.flood.zone.trim()
      ? { zone: data.flood.zone.trim(), isHighRisk: data.flood.isHighRisk ?? null }
      : null;

  const school =
    data.school.status === "ok" && typeof data.school.districtName === "string" && data.school.districtName.trim()
      ? { districtName: data.school.districtName.trim() }
      : null;

  const hasWeatherFigure =
    data.weather.status === "ok" &&
    (typeof data.weather.summary === "string" ||
      typeof data.weather.tempHighF === "number" ||
      typeof data.weather.tempLowF === "number" ||
      typeof data.weather.precipChancePct === "number");
  const weather = hasWeatherFigure
    ? {
        forecastDate: data.weather.forecastDate ?? null,
        summary: data.weather.summary ?? null,
        tempHighF: data.weather.tempHighF ?? null,
        tempLowF: data.weather.tempLowF ?? null,
        precipChancePct: data.weather.precipChancePct ?? null,
      }
    : null;

  // Honest hint when a section couldn't run for lack of a precise location
  // (e.g. primary address without lat/lng while weather is merely "too_far").
  const showLocationHint = statuses.some((s) => s === "no_location");

  const visible = Boolean(flood || school || weather || showLocationHint);
  if (!visible) return HIDDEN_VIEW;

  return { visible, flood, school, weather, showLocationHint };
}

/** Plain-English flood label key for a zone, driven by the API's isHighRisk. */
export function floodLabelKey(
  isHighRisk: boolean | null,
): "dossier_flood_high" | "dossier_flood_low" | "dossier_flood_unknown" {
  if (isHighRisk === true) return "dossier_flood_high";
  if (isHighRisk === false) return "dossier_flood_low";
  return "dossier_flood_unknown";
}

/**
 * Format the forecast date for display. Date-only ISO strings ("YYYY-MM-DD")
 * are parsed as LOCAL dates (naive `new Date("YYYY-MM-DD")` is UTC midnight
 * and renders the previous day in US timezones). Invalid input → "".
 */
export function formatForecastDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  const date = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric" }).format(date);
  } catch {
    return "";
  }
}

// ── Presentational card (exported for tests — render-pure, no fetching) ──────

export function HomeDossierCard({ data }: { data: HomeDossierResponse | null }) {
  const td = useTranslations("dashboard");
  const locale = useLocale();
  const view = deriveDossierView(data);

  // Plan-gated (entitled:false on a configured deployment) → value-first teaser
  // with the three insight rows shown as locked line-items. Checked BEFORE the
  // data-driven view so a gated payload never renders real-looking rows.
  if (isDossierGated(data)) {
    return <HomeDossierTeaser place={[data?.address?.city, data?.address?.state].filter(Boolean).join(", ")} />;
  }

  if (!view.visible || !data) return null;

  const place = [data.address?.city, data.address?.state].filter(Boolean).join(", ");

  const weatherStats: string[] = [];
  if (view.weather) {
    if (typeof view.weather.tempHighF === "number") {
      weatherStats.push(td("dossier_weather_highF", { temp: Math.round(view.weather.tempHighF) }));
    }
    if (typeof view.weather.tempLowF === "number") {
      weatherStats.push(td("dossier_weather_lowF", { temp: Math.round(view.weather.tempLowF) }));
    }
    if (typeof view.weather.precipChancePct === "number") {
      weatherStats.push(td("dossier_weather_precip", { percent: Math.round(view.weather.precipChancePct) }));
    }
  }
  const forecastDateLabel = view.weather ? formatForecastDate(view.weather.forecastDate, locale) : "";

  return (
    <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl overflow-hidden">
      <div className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Compass className="h-4 w-4 shrink-0 text-tone-sky-fg" />
          {/* Aurora serif heading — display face with ONE italic <em> accent,
              consistent with the sibling editorial headings (.h2 helper). */}
          <h3 className="h2 text-xl text-foreground truncate">
            {td.rich("dossier_title", { em: (chunks) => <em>{chunks}</em> })}
          </h3>
        </div>
        {place && (
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground shrink-0">
            {place}
          </span>
        )}
      </div>

      <div className="px-5 pb-5 space-y-2">
        {/* (1) Flood zone — FEMA */}
        {view.flood && (
          <div className="p-3 rounded-xl border border-border bg-foreground/[0.02]">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-tone-sky-bg border border-tone-sky-br flex items-center justify-center shrink-0">
                <Waves className="h-4 w-4 text-tone-sky-fg" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{td("dossier_flood_title")}</p>
                <p className="text-sm font-semibold text-foreground truncate">
                  {td(floodLabelKey(view.flood.isHighRisk), { zone: view.flood.zone })}
                </p>
              </div>
              {view.flood.isHighRisk === true && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-tone-honey-bg border border-tone-honey-br text-tone-honey-fg shrink-0">
                  {td("dossier_flood_highPill")}
                </span>
              )}
            </div>
            {/* MANDATORY fine print — informational, not an insurance determination */}
            <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
              {td("dossier_flood_disclaimer")}{" "}
              <a
                href="https://msc.fema.gov"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground transition"
              >
                {td("dossier_flood_link")}
              </a>
            </p>
          </div>
        )}

        {/* (2) School district — NCES boundaries */}
        {view.school && (
          <div className="p-3 rounded-xl border border-border bg-foreground/[0.02]">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-tone-sage-bg border border-tone-sage-br flex items-center justify-center shrink-0">
                <GraduationCap className="h-4 w-4 text-tone-sage-fg" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{td("dossier_school_title")}</p>
                <p className="text-sm font-semibold text-foreground truncate">
                  {td("dossier_school_served", { district: view.school.districtName })}
                </p>
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-muted-foreground">{td("dossier_school_disclaimer")}</p>
          </div>
        )}

        {/* (3) Moving-day weather — only when the API says "ok" (≤7 days out,
            destination address). "too_far" renders nothing by design. */}
        {view.weather && (
          <div className="p-3 rounded-xl border border-border bg-foreground/[0.02]">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-tone-cyan-bg border border-tone-cyan-br flex items-center justify-center shrink-0">
                <CloudSun className="h-4 w-4 text-tone-cyan-fg" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">
                  {forecastDateLabel
                    ? td("dossier_weather_movingDay", { date: forecastDateLabel })
                    : td("dossier_weather_title")}
                </p>
                <p className="text-sm font-semibold text-foreground truncate">
                  {[view.weather.summary, weatherStats.join(" · ")].filter(Boolean).join(" — ")}
                </p>
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-muted-foreground">{td("dossier_weather_disclaimer")}</p>
          </div>
        )}

        {/* Honest hint when a precise location is missing — no fabricated rows */}
        {view.showLocationHint && (
          <div className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-border bg-foreground/[0.02]">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">{td("dossier_hint_noLocation")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Plan-gate teaser (exported for tests — render-pure, no fetching) ─────────

/**
 * Value-first upgrade teaser for FREE/FREE_TRIAL (GATE-API entitled:false).
 * Same card chrome as the real dossier, with the three insight rows shown as
 * honest locked line-items (lock glyphs, no fabricated data) and an "Unlock
 * with Individual" CTA to /pricing. Visual language mirrors the existing
 * MOVING_PLAN upgrade teaser (move-command-center free hero).
 */
const TEASER_ROWS = [
  {
    Icon: Waves,
    boxClass: "bg-tone-sky-bg border-tone-sky-br",
    iconClass: "text-tone-sky-fg",
    titleKey: "dossier_flood_title",
    subKey: "dossier_teaser_flood_sub",
  },
  {
    Icon: GraduationCap,
    boxClass: "bg-tone-sage-bg border-tone-sage-br",
    iconClass: "text-tone-sage-fg",
    titleKey: "dossier_school_title",
    subKey: "dossier_teaser_school_sub",
  },
  {
    Icon: CloudSun,
    boxClass: "bg-tone-cyan-bg border-tone-cyan-br",
    iconClass: "text-tone-cyan-fg",
    titleKey: "dossier_weather_title",
    subKey: "dossier_teaser_weather_sub",
  },
] as const;

export function HomeDossierTeaser({ place }: { place?: string }) {
  const td = useTranslations("dashboard");
  return (
    <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl overflow-hidden">
      <div className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Compass className="h-4 w-4 shrink-0 text-tone-sky-fg" />
          <h3 className="h2 text-xl text-foreground truncate">
            {td.rich("dossier_title", { em: (chunks) => <em>{chunks}</em> })}
          </h3>
        </div>
        {place && (
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground shrink-0">
            {place}
          </span>
        )}
      </div>

      <div className="px-5 pb-5 space-y-2">
        <p className="text-[13.5px] leading-5 text-muted-foreground">{td("dossier_teaser_pitch")}</p>

        {TEASER_ROWS.map(({ Icon, boxClass, iconClass, titleKey, subKey }) => (
          <div
            key={titleKey}
            className="flex items-center gap-3 p-3 rounded-xl border border-border bg-foreground/[0.02]"
          >
            <div
              className={`h-9 w-9 rounded-lg border flex items-center justify-center shrink-0 ${boxClass}`}
            >
              <Icon className={`h-4 w-4 ${iconClass}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{td(titleKey)}</p>
              <p className="text-xs text-muted-foreground truncate">{td(subKey)}</p>
            </div>
            <Lock className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
          </div>
        ))}

        <div className="pt-1">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-tone-orange-fg text-white text-sm font-semibold hover:opacity-90 transition whitespace-nowrap"
          >
            <Sparkles className="h-4 w-4" /> {td("dossier_teaser_cta")}
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton (reduced-motion safe: pulse only when motion is allowed) ────────

function HomeDossierSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl p-5 space-y-3" aria-hidden="true">
      <div className="h-6 w-48 rounded-lg bg-foreground/5 motion-safe:animate-pulse" />
      <div className="h-16 w-full rounded-xl bg-foreground/5 motion-safe:animate-pulse" />
      <div className="h-16 w-full rounded-xl bg-foreground/5 motion-safe:animate-pulse" />
    </div>
  );
}

// ── Fetching wrapper (default dashboard entry) ───────────────────────────────

export function HomeDossier({ addressId }: { addressId: string | null }) {
  const [state, setState] = useState<{ status: "loading" | "done"; data: HomeDossierResponse | null }>({
    status: "loading",
    data: null,
  });

  useEffect(() => {
    if (!addressId) {
      setState({ status: "done", data: null });
      return;
    }
    let cancelled = false;
    setState({ status: "loading", data: null });
    (async () => {
      try {
        const res = await fetch(`/api/addresses/${encodeURIComponent(addressId)}/dossier`);
        if (!res.ok) {
          // 401/404/5xx → hide the card; external lookups never break the dashboard.
          if (!cancelled) setState({ status: "done", data: null });
          return;
        }
        const json = (await res.json()) as HomeDossierResponse;
        if (!cancelled) setState({ status: "done", data: json });
      } catch {
        if (!cancelled) setState({ status: "done", data: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [addressId]);

  if (!addressId) return null;
  if (state.status === "loading") return <HomeDossierSkeleton />;
  return <HomeDossierCard data={state.data} />;
}
