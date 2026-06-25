"use client";

import Link from "next/link";
import {
  ArrowRight,
  CloudSun,
  Compass,
  FlaskConical,
  GraduationCap,
  Home,
  Mountain,
  Waves,
  Wind,
} from "lucide-react";
import { type ComponentType, type ReactNode, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DossierAmbient,
  useDossierCountUp,
  type AmbientSpec,
} from "@/components/dashboard/dossier-ambient";

/**
 * Dossier showcase — homepage marketing section for the "New home dossier".
 *
 * Presents a DEMO dossier card with SAMPLE data (Wayne, NJ-style figures) and
 * the same source-style ambient scene system the real dashboard card renders
 * (dossier-ambient.tsx). Because this is an explicitly labelled demo, rows
 * cycle through their possible scene states so visitors can see the animation
 * range rather than one frozen sample reading.
 *
 * HONESTY RULES (Edition VII, owner-ratified):
 *  - the card is labelled an EXAMPLE three times over (kicker, body copy, and
 *    a "Sample data" pill on the card itself) — it never implies a real
 *    valuation or a real report for the visitor;
 *  - figures are plausible suburban-NJ numbers in the style of the real
 *    product, sourced-data categories only — no invented scores;
 *  - the source line names the REAL upstream sources (FEMA · EPA · NCES ·
 *    US Census Bureau);
 *  - Sapphire foil accents are allowed here as a marketing finish for the
 *    dossier feature (which is free, like every feature) without drifting back
 *    to legacy plan palettes.
 *
 * Motion: everything animated is inside DossierAmbient / useDossierCountUp,
 * which are transform/opacity only, pause offscreen, and fully disable under
 * prefers-reduced-motion (static scenes stay intentional; medians render
 * their final values on first paint). Hardcoded English per the marketing
 * mock convention (see moving-moment-mock.tsx's checklist strings).
 */

// ── Sample report (Wayne, NJ-style figures) ──────────────────────────────────

const SAMPLE = {
  place: "Wayne, NJ",
  flood: { zone: "X", isHighRisk: false },
  school: { districtName: "Wayne Township Public Schools" },
  weather: { summary: "Partly sunny", tempHighF: 74, tempLowF: 58, precipChancePct: 20 },
  hazards: {
    overallRating: "Relatively low",
    topRisks: [
      { hazard: "Winter weather", rating: "Relatively moderate" },
      { hazard: "Strong wind", rating: "Relatively moderate" },
    ],
  },
  radon: { zone: 2 },
  air: { aqi: 42, category: "Good" },
  neighborhood: {
    medianHomeValue: 598300,
    medianGrossRent: 1860,
    medianHouseholdIncome: 134700,
    ownerOccupiedPct: 82,
    walkBand: "below_average",
    walkLabel: "8.6/20 · Below average",
  },
} as const;

/** Whole-dollar USD — marketing copy is hardcoded English, so en-US grouping. */
function usd(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

// ── Demo row (mirrors the dashboard dossier row chrome) ──────────────────────

function DemoRow({
  ambient,
  icon: Icon,
  boxClass,
  iconClass,
  title,
  value,
  fine,
  aside,
  children,
}: {
  ambient: AmbientSpec;
  icon: ComponentType<{ className?: string }>;
  boxClass: string;
  iconClass: string;
  title: string;
  value: string;
  fine?: string;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="lf-dossier-row lf-dossier-scene-card relative isolate p-3 rounded-xl border border-border">
      <DossierAmbient {...ambient} />
      <div className="flex items-center gap-3">
        <div
          className={`h-9 w-9 rounded-lg border flex items-center justify-center shrink-0 ${boxClass}`}
        >
          <Icon className={`h-4 w-4 ${iconClass}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-sm font-semibold text-foreground truncate">{value}</p>
          {children}
        </div>
        {aside}
      </div>
      {fine && <p className="mt-2 text-[10px] leading-4 text-muted-foreground">{fine}</p>}
    </div>
  );
}

// ── Demo cycle ────────────────────────────────────────────────────────────────
// The showcase card is a DEMO, so each row rotates through its possible scene
// states — a visitor sees the full range of dossier animations rather than one
// frozen reading. Each state holds ~3s; rows are staggered by their index (1s)
// so the change ripples top -> bottom and reads as a lively, mixed cascade. Under
// prefers-reduced-motion (and during SSR / first paint) the tick stays 0, so every
// row shows state[0] — the honest sample reading that matches its copy.

const DEMO_INTERVAL_S = 3;

const FLOOD_CYCLE: readonly AmbientSpec[] = [
  { kind: "flood", intensity: 0 },
  { kind: "flood", intensity: 1 },
  { kind: "flood", intensity: 2 },
];
const SCHOOL_CYCLE: readonly AmbientSpec[] = [{ kind: "school", intensity: 1 }];
const WEATHER_CYCLE: readonly AmbientSpec[] = [
  { kind: "weather", intensity: 0, variant: "sun" },
  { kind: "weather", intensity: 1, variant: "cloud" },
  { kind: "weather", intensity: 1, variant: "rain" },
  { kind: "weather", intensity: 2, variant: "snow" },
  { kind: "weather", intensity: 2, variant: "storm" },
  { kind: "weather", intensity: 1, variant: "fog" },
  { kind: "weather", intensity: 2, variant: "wind" },
  { kind: "weather", intensity: 2, variant: "heat" },
  { kind: "weather", intensity: 2, variant: "cold" },
];
const HAZARD_CYCLE: readonly AmbientSpec[] = [
  { kind: "hazard", intensity: 1, variant: "winter" },
  { kind: "hazard", intensity: 2, variant: "wind" },
  { kind: "hazard", intensity: 2, variant: "lightning" },
];
const RADON_CYCLE: readonly AmbientSpec[] = [
  { kind: "radon", intensity: 1 },
  { kind: "radon", intensity: 0 },
  { kind: "radon", intensity: 2 },
];
const AIR_CYCLE: readonly AmbientSpec[] = [
  { kind: "air", intensity: 0 },
  { kind: "air", intensity: 1 },
  { kind: "air", intensity: 2 },
];
const HOOD_CYCLE: readonly AmbientSpec[] = [
  { kind: "neighborhood", intensity: 0 },
  { kind: "neighborhood", intensity: 2 },
  { kind: "neighborhood", intensity: 1 },
];

/** Seconds counter that ticks once per second on the client; stays 0 under
 *  prefers-reduced-motion and during SSR so the demo is fully motion-safe. */
function useDemoCycle(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  return tick;
}

/** The row's current demo state: each state holds DEMO_INTERVAL_S seconds and the
 *  rows are offset by rowIndex, so the cascade ripples top -> bottom. */
function cycleAmbient(states: readonly AmbientSpec[], tick: number, rowIndex: number): AmbientSpec {
  if (states.length <= 1) return states[0];
  const step = Math.max(0, Math.floor((tick - rowIndex) / DEMO_INTERVAL_S));
  return states[step % states.length];
}

// ── Section ───────────────────────────────────────────────────────────────────

export function DossierShowcase() {
  // Medians count up (~800ms ease-out) when the demo card scrolls into view —
  // same hook as the dashboard card; final values on first paint, static under
  // prefers-reduced-motion.
  const counts = useDossierCountUp([
    SAMPLE.neighborhood.medianHomeValue,
    SAMPLE.neighborhood.medianGrossRent,
    SAMPLE.neighborhood.medianHouseholdIncome,
    SAMPLE.neighborhood.ownerOccupiedPct,
  ]);
  // Drives the demo state rotation for every row (motion-safe; 0 means "honest sample").
  const tick = useDemoCycle();

  return (
    <section className="container py-20 border-t md:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 md:gap-16 lg:grid-cols-[1fr_1.05fr]">
        {/* Pitch column */}
        <div>
          <p className="kicker">New home dossier · Example report</p>
          <h2 className="mt-5 display-tight font-display text-3xl font-bold leading-[1.08] tracking-tight md:text-5xl">
            The facts behind an address,{" "}
            <span className="foil-text italic">before</span> it&apos;s yours
          </h2>
          <p className="mt-6 max-w-[48ch] text-base leading-relaxed text-muted-foreground md:text-lg">
            Add your next address and LocateFlow assembles a dossier from public federal
            records — flood zone, school district, natural hazards, radon, air quality, and
            area medians. No invented score: sourced facts, each with its caveat.
          </p>
          <p className="mt-4 max-w-[48ch] text-sm leading-relaxed text-muted-foreground">
            The card shown here is an example with sample data for a New Jersey suburb — your
            dossier is built for your own address. Neighborhood medians and PDF export are
            included free, like every other feature.
          </p>
          <p className="mt-6 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            FEMA · EPA · NCES · US Census Bureau
          </p>
          <div className="mt-7">
            <Button asChild size="lg" className="text-base px-8">
              <Link href="/sign-up">
                Start your move — free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Demo card — same chrome as the dashboard HomeDossierCard, with the
            glass-card + hairline marketing finish. Ambient states rotate through
            the scene matrix while the visible copy stays sample-data honest. */}
        <div className="lf-dossier-shell glass-card hairline overflow-hidden">
          <div className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-3">
            <div className="flex items-center gap-2 min-w-0">
              <Compass className="h-4 w-4 shrink-0 text-tone-sky-fg" />
              <p className="h2 text-xl text-foreground truncate">
                Your <em>new home</em> dossier
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center rounded-full border border-tone-foil-br bg-tone-foil-bg px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-tone-foil-fg">
                Sample data
              </span>
              <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {SAMPLE.place}
              </span>
            </div>
          </div>

          <div className="px-5 pb-5 space-y-2">
            {/* Flood — Zone X => calm cool waves (intensity 0) */}
            <DemoRow
              ambient={cycleAmbient(FLOOD_CYCLE, tick, 0)}
              icon={Waves}
              boxClass="bg-tone-sky-bg border-tone-sky-br"
              iconClass="text-tone-sky-fg"
              title="Flood zone"
              value={`Zone ${SAMPLE.flood.zone} — minimal flood risk`}
              fine="FEMA flood maps — informational, not an insurance determination."
            />

            {/* School district — fixed moderate ambience (walking silhouettes) */}
            <DemoRow
              ambient={cycleAmbient(SCHOOL_CYCLE, tick, 1)}
              icon={GraduationCap}
              boxClass="bg-tone-sage-bg border-tone-sage-br"
              iconClass="text-tone-sage-fg"
              title="School district"
              value={`Served by ${SAMPLE.school.districtName}`}
              fine="District boundaries (NCES) — school assignment may differ."
            />

            {/* Moving-day weather — 20% precip + sunny summary => sun scene */}
            <DemoRow
              ambient={cycleAmbient(WEATHER_CYCLE, tick, 2)}
              icon={CloudSun}
              boxClass="bg-tone-cyan-bg border-tone-cyan-br"
              iconClass="text-tone-cyan-fg"
              title="Moving-day weather"
              value={`${SAMPLE.weather.summary} — High ${SAMPLE.weather.tempHighF}°F · Low ${SAMPLE.weather.tempLowF}°F · ${SAMPLE.weather.precipChancePct}% precip`}
              fine="National Weather Service forecast — appears when your move is close."
            />

            {/* Hazards — top risk "Winter weather · Relatively moderate" => snow */}
            <DemoRow
              ambient={cycleAmbient(HAZARD_CYCLE, tick, 3)}
              icon={Mountain}
              boxClass="bg-tone-umber-bg border-tone-umber-br"
              iconClass="text-tone-umber-fg"
              title="Natural hazard profile"
              value={`Overall: ${SAMPLE.hazards.overallRating}`}
              fine="FEMA National Risk Index — relative context, not a property score."
            >
              <div className="mt-1 flex flex-wrap gap-1">
                {SAMPLE.hazards.topRisks.map((risk) => (
                  <span
                    key={risk.hazard}
                    className="inline-flex items-center rounded-full border border-border bg-foreground/[0.04] px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
                  >
                    {risk.hazard} · {risk.rating}
                  </span>
                ))}
              </div>
            </DemoRow>

            {/* Radon — zone 2 => moderate Sapphire bubbles */}
            <DemoRow
              ambient={cycleAmbient(RADON_CYCLE, tick, 4)}
              icon={FlaskConical}
              boxClass="bg-tone-slate-bg border-tone-slate-br"
              iconClass="text-tone-slate-fg"
              title="Radon"
              value="EPA Radon Zone 2 — moderate radon potential"
              fine="EPA county radon zones — the EPA recommends testing every home."
            />

            {/* Air — AQI 42 (Good) => calm mint breeze + tumbling leaf */}
            <DemoRow
              ambient={cycleAmbient(AIR_CYCLE, tick, 5)}
              icon={Wind}
              boxClass="bg-tone-sage-bg border-tone-sage-br"
              iconClass="text-tone-sage-fg"
              title="Air quality"
              value={`Air quality now: AQI ${SAMPLE.air.aqi} (${SAMPLE.air.category})`}
              fine="AirNow (EPA) — a current snapshot, not a long-term average."
            />

            {/* Neighborhood — skyline + counting medians. The ref drives
                the count-up; displayed values come from the hook (finals on
                first paint, brief 0 -> target once visible). Badged "Included"
                to reinforce the free model (medians ship free, like every
                feature). */}
            <div
              ref={counts.ref}
              className="lf-dossier-row lf-dossier-scene-card relative isolate p-3 rounded-xl border border-border"
            >
              <DossierAmbient {...cycleAmbient(HOOD_CYCLE, tick, 6)} />
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-tone-foil-bg border border-tone-foil-br flex items-center justify-center shrink-0">
                  <Home className="h-4 w-4 text-tone-foil-fg" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Neighborhood</p>
                  <p className="text-sm font-semibold text-foreground truncate">
                    Area medians for the surrounding census tract
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full border border-tone-foil-br bg-tone-foil-bg px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-tone-foil-fg shrink-0">
                  Included
                </span>
              </div>
              <div className="mt-2 space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-muted-foreground">Median home value</span>
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    {usd(counts.values[0] ?? SAMPLE.neighborhood.medianHomeValue)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-muted-foreground">Median gross rent</span>
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    {usd(counts.values[1] ?? SAMPLE.neighborhood.medianGrossRent)}/mo
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-muted-foreground">Median household income</span>
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    {usd(counts.values[2] ?? SAMPLE.neighborhood.medianHouseholdIncome)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-muted-foreground">Owner-occupied homes</span>
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    {counts.values[3] ?? SAMPLE.neighborhood.ownerOccupiedPct}%
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-muted-foreground">Walkability</span>
                  <span className="text-sm font-semibold text-foreground">
                    {SAMPLE.neighborhood.walkLabel}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
                US Census Bureau (ACS) tract medians — area context, not a valuation of this
                home.
              </p>
            </div>

            {/* Honest footer — restates that this is an example, not a report */}
            <p className="pt-1 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Example report · Sample data
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
