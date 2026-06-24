"use client";

import { useEffect, useRef, useState, type CSSProperties, type MutableRefObject } from "react";
import { DossierRaccoon, dossierRaccoonFor, type DossierRaccoonMood } from "./dossier-raccoon";

/**
 * DOSSIER AMBIENT — Aurora decorative scene layer for the home-dossier rows.
 *
 * Each dossier section row hosts one absolutely-positioned, aria-hidden layer
 * on its right side. The scene parameters are DERIVED FROM THE REAL section
 * data (see ambientForSection) — intensity 0 calm / 1 moderate / 2 elevated —
 * so the decoration is honest ambience, never fabricated information.
 *
 * Hard constraints (Edition VII Aurora):
 *  - transform/opacity animations only (GPU-cheap), keyframes live in
 *    globals.css under the "Dossier ambient" block;
 *  - every animation is disabled under prefers-reduced-motion, where the
 *    static scene still reads as an intentional illustration;
 *  - the layer is masked (transparent -> black 30%) so the left text zone of
 *    the row stays 100% clean, and z-indexed under the row content so copy is
 *    never impaired;
 *  - a tiny IntersectionObserver pauses all animation while offscreen;
 *  - deterministic particle layouts (no Math.random) so SSR and client render
 *    identical markup.
 */

// ── Shared contract ───────────────────────────────────────────────────────────

export type AmbientKind =
  | "flood"
  | "school"
  | "hazard"
  | "radon"
  | "water"
  | "air"
  | "housing"
  | "evCharging"
  | "neighborhood"
  | "weather";

export type AmbientIntensity = 0 | 1 | 2;

export type AmbientVariant =
  | "lightning"
  | "wind"
  | "winter"
  | "sun"
  | "cloud"
  | "rain"
  | "storm"
  | "snow"
  | "fog"
  | "heat"
  | "cold";

export interface AmbientSpec {
  kind: AmbientKind;
  intensity: AmbientIntensity;
  variant?: AmbientVariant;
}

export type SourceDossierSceneType = "weather" | "air" | "water" | "area" | "transit" | "cost" | "housing";

export type SourceDossierSceneLevel =
  | "good"
  | "mid"
  | "bad"
  | "sun"
  | "cloud"
  | "rain"
  | "snow"
  | "storm"
  | "fog"
  | "wind"
  | "heat"
  | "cold";

export interface SourceDossierSceneSpec {
  type: SourceDossierSceneType;
  level: SourceDossierSceneLevel;
}

function riskSourceLevel(intensity: AmbientIntensity): "good" | "mid" | "bad" {
  return intensity === 2 ? "bad" : intensity === 1 ? "mid" : "good";
}

function positiveSourceLevel(intensity: AmbientIntensity): "good" | "mid" | "bad" {
  return intensity === 2 ? "good" : intensity === 1 ? "mid" : "bad";
}

function weatherSourceLevel(variant: AmbientVariant | undefined): SourceDossierSceneLevel {
  switch (variant) {
    case "storm":
    case "snow":
    case "fog":
    case "wind":
    case "rain":
    case "cloud":
    case "heat":
    case "cold":
    case "sun":
      return variant;
    case "lightning":
      return "storm";
    case "winter":
      return "snow";
    default:
      return "sun";
  }
}

/**
 * Bridge the current row ambient contract to the source bundle's
 * DossierScene(type, level) matrix. Web still renders its existing row art, but
 * these source semantics keep the UI testable against the prototype and make
 * every source state explicit in the DOM.
 */
export function sourceDossierSceneFor({ kind, intensity, variant }: AmbientSpec): SourceDossierSceneSpec {
  switch (kind) {
    case "weather":
      return { type: "weather", level: weatherSourceLevel(variant) };
    case "air":
      return { type: "air", level: riskSourceLevel(intensity) };
    case "water":
      return { type: "water", level: riskSourceLevel(intensity) };
    case "housing":
      return { type: "cost", level: riskSourceLevel(intensity) };
    case "evCharging":
      return { type: "transit", level: positiveSourceLevel(intensity) };
    case "neighborhood":
      return { type: "area", level: positiveSourceLevel(intensity) };
    case "school":
      return { type: "area", level: "mid" };
    case "flood":
    case "hazard":
    case "radon":
      return { type: "area", level: riskSourceLevel(intensity) };
  }
}

/**
 * Per-section inputs for the pure mapper. Shapes mirror the derived dossier
 * view (home-dossier.tsx) without importing it — keeps the dependency one-way
 * (home-dossier -> dossier-ambient).
 */
export type AmbientSectionInput =
  | { kind: "flood"; isHighRisk: boolean | null }
  | { kind: "school" }
  | { kind: "hazard"; topRisks: ReadonlyArray<{ hazard: string; rating: string }> }
  | { kind: "radon"; zone: 1 | 2 | 3 }
  | { kind: "water"; violations5y: number | null }
  | { kind: "air"; aqi: number | null; category?: string | null }
  | {
      kind: "housing";
      twoBedroomFmr: number | null;
      medianIncome: number | null;
      lowIncome4Person: number | null;
    }
  | {
      kind: "evCharging";
      stationCount: number;
      dcFastPortCount: number;
      level2PortCount: number;
    }
  | { kind: "neighborhood"; walkBand: string | null }
  | {
      kind: "weather";
      summary: string | null;
      precipChancePct: number | null;
      tempHighF?: number | null;
      tempLowF?: number | null;
    };

// ── Pure mapper (exported for tests) ─────────────────────────────────────────

/** NRI rating -> intensity: Relatively/Very High => 2, *Moderate => 1, else 0. */
function hazardIntensity(rating: string | undefined): AmbientIntensity {
  const r = (rating ?? "").toLowerCase();
  if (r.includes("high")) return 2;
  if (r.includes("moderate")) return 1;
  return 0;
}

/** Top NRI hazard name -> scene variant. Wind streaks are the safe default. */
function hazardVariant(hazard: string | undefined): AmbientVariant {
  const h = (hazard ?? "").toLowerCase();
  if (h.includes("lightning") || h.includes("thunder")) return "lightning";
  if (
    h.includes("winter") ||
    h.includes("snow") ||
    h.includes("ice") ||
    h.includes("cold") ||
    h.includes("hail") ||
    h.includes("avalanche")
  ) {
    return "winter";
  }
  return "wind";
}

function textHasAny(text: string, needles: ReadonlyArray<string>): boolean {
  return needles.some((needle) => text.includes(needle));
}

function airCategoryIntensity(category: string | null | undefined): AmbientIntensity {
  const c = (category ?? "").toLowerCase();
  if (c.includes("hazard") || c.includes("very unhealthy") || c.includes("unhealthy")) return 2;
  if (c.includes("moderate") || c.includes("sensitive")) return 1;
  return 0;
}

function weatherSpec({
  summary,
  precipChancePct,
  tempHighF,
  tempLowF,
}: Extract<AmbientSectionInput, { kind: "weather" }>): AmbientSpec {
  const s = (summary ?? "").toLowerCase();
  const precip = precipChancePct;
  const high = typeof tempHighF === "number" && Number.isFinite(tempHighF) ? tempHighF : null;
  const low = typeof tempLowF === "number" && Number.isFinite(tempLowF) ? tempLowF : null;

  if (textHasAny(s, ["thunder", "storm", "lightning", "squall", "tornado"])) {
    return { kind: "weather", intensity: 2, variant: "storm" };
  }
  if (textHasAny(s, ["snow", "sleet", "freezing", "ice", "blizzard", "flurr"])) {
    return {
      kind: "weather",
      intensity: textHasAny(s, ["blizzard", "heavy", "freezing"]) || (precip ?? 0) >= 70 ? 2 : 1,
      variant: "snow",
    };
  }
  if (textHasAny(s, ["fog", "mist", "haze", "smoke"])) {
    return { kind: "weather", intensity: textHasAny(s, ["dense", "smoke"]) ? 2 : 1, variant: "fog" };
  }
  if (textHasAny(s, ["wind", "gust", "breez"])) {
    return { kind: "weather", intensity: textHasAny(s, ["high wind", "gust"]) ? 2 : 1, variant: "wind" };
  }
  if (typeof precip === "number" && precip >= 50) {
    return { kind: "weather", intensity: precip >= 80 ? 2 : 1, variant: "rain" };
  }
  if (textHasAny(s, ["cloud", "overcast"])) {
    return { kind: "weather", intensity: 1, variant: "cloud" };
  }
  if (textHasAny(s, ["heat", "hot", "excessive"]) || (high !== null && high >= 95)) {
    return {
      kind: "weather",
      intensity: textHasAny(s, ["excessive"]) || (high !== null && high >= 100) ? 2 : 1,
      variant: "heat",
    };
  }
  if (textHasAny(s, ["cold", "chill", "freeze"]) || (low !== null && low <= 32)) {
    return {
      kind: "weather",
      intensity: textHasAny(s, ["freeze"]) || (low !== null && low <= 25) ? 2 : 1,
      variant: "cold",
    };
  }
  return { kind: "weather", intensity: 0, variant: "sun" };
}

/**
 * Map a dossier section's REAL data to its ambient scene parameters:
 *  - flood: isHighRisk true => 2, false => 0, unknown => 1;
 *  - school: fixed moderate ambience (directory data carries no risk signal);
 *  - hazard: variant from the TOP risk chip, intensity from its NRI rating;
 *  - radon: zone 1 => 2, zone 2 => 1, zone 3 => 0;
 *  - air: AQI <= 50 => 0 (mint), 51-100 => 1 (amber), > 100 => 2 (coral);
 *  - neighborhood: walk band most => 2, above_average => 1, else 0 (cadence);
 *  - weather: precip >= 50 => rain (>= 80 elevated), summary mentions cloud
 *    => cloud, else sun.
 */
export function ambientForSection(section: AmbientSectionInput): AmbientSpec {
  switch (section.kind) {
    case "flood":
      return {
        kind: "flood",
        intensity: section.isHighRisk === true ? 2 : section.isHighRisk === false ? 0 : 1,
      };
    case "school":
      return { kind: "school", intensity: 1 };
    case "hazard": {
      const top = section.topRisks[0];
      return {
        kind: "hazard",
        intensity: hazardIntensity(top?.rating),
        variant: hazardVariant(top?.hazard),
      };
    }
    case "radon":
      return { kind: "radon", intensity: section.zone === 1 ? 2 : section.zone === 2 ? 1 : 0 };
    case "water":
      return {
        kind: "water",
        intensity: section.violations5y === null ? 1 : section.violations5y > 0 ? 2 : 0,
      };
    case "air":
      return {
        kind: "air",
        intensity:
          typeof section.aqi === "number"
            ? section.aqi <= 50
              ? 0
              : section.aqi <= 100
                ? 1
                : 2
            : airCategoryIntensity(section.category),
      };
    case "housing": {
      const fmr = section.twoBedroomFmr;
      const lowIncome = section.lowIncome4Person;
      const highCost =
        (typeof fmr === "number" && fmr >= 2500) ||
        (typeof lowIncome === "number" && lowIncome >= 95000);
      const moderateCost =
        (typeof fmr === "number" && fmr >= 1600) ||
        (typeof lowIncome === "number" && lowIncome >= 65000) ||
        (typeof section.medianIncome === "number" && section.medianIncome >= 85000);
      return { kind: "housing", intensity: highCost ? 2 : moderateCost ? 1 : 0 };
    }
    case "evCharging":
      return {
        kind: "evCharging",
        intensity:
          section.stationCount <= 0
            ? 0
            : section.dcFastPortCount > 0 || section.stationCount >= 8
              ? 2
              : 1,
      };
    case "neighborhood": {
      const band = section.walkBand;
      return {
        kind: "neighborhood",
        intensity: band === "most" ? 2 : band === "above_average" ? 1 : 0,
      };
    }
    case "weather":
      return weatherSpec(section);
  }
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Pause every scene animation while the layer is offscreen: toggles a
 * .da-paused class that sets animation-play-state: paused (globals.css).
 */
function useAmbientPause(): MutableRefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      node.classList.toggle("da-paused", !entry?.isIntersecting);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return ref;
}

const COUNT_UP_MS = 800;

/**
 * Count the neighborhood medians up (~800ms ease-out) the first time the row
 * enters the viewport. No dependencies — one IntersectionObserver plus rAF.
 * The first render (and SSR) shows the FINAL values, so static markup, no-JS,
 * and prefers-reduced-motion all read the honest figures immediately.
 */
export function useDossierCountUp(targets: ReadonlyArray<number | null>): {
  ref: MutableRefObject<HTMLDivElement | null>;
  values: ReadonlyArray<number | null>;
} {
  const [values, setValues] = useState<ReadonlyArray<number | null>>(targets);
  const ref = useRef<HTMLDivElement | null>(null);
  const targetsRef = useRef(targets);
  targetsRef.current = targets;
  const key = targets.map((t) => (t === null ? "x" : String(t))).join("|");

  useEffect(() => {
    const finals = targetsRef.current;
    const node = ref.current;
    const reduceMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (
      !node ||
      reduceMotion ||
      typeof IntersectionObserver === "undefined" ||
      finals.every((t) => t === null)
    ) {
      setValues(finals);
      return;
    }
    let raf = 0;
    let started = false;
    const observer = new IntersectionObserver((entries) => {
      if (started || !entries.some((e) => e.isIntersecting)) return;
      started = true;
      observer.disconnect();
      const startedAt = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - startedAt) / COUNT_UP_MS);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
        setValues(finals.map((v) => (v === null ? null : Math.round(v * eased))));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
    // Re-run only when the target figures actually change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { ref, values };
}

// ── Scenes ────────────────────────────────────────────────────────────────────

type SceneStyle = CSSProperties & Record<string, string | number>;

/**
 * Seamless sine band for the flood waves: period 120 over a 480-wide tile so
 * a translateX(-50%) loop on a 200%-wide SVG lands exactly two periods over.
 */
function wavePath(amplitude: number, height: number): string {
  const mid = Math.min(height / 2, amplitude + 2);
  const amp = Math.min(amplitude, Math.max(0.5, mid - 0.5));
  let d = `M0 ${mid} Q30 ${Math.round((mid - amp) * 10) / 10} 60 ${mid}`;
  for (let x = 120; x <= 480; x += 60) d += ` T${x} ${mid}`;
  d += ` L480 ${height} L0 ${height} Z`;
  return d;
}

function FloodScene({ intensity }: { intensity: AmbientIntensity }) {
  const amps = intensity === 2 ? [5.5, 4.5, 3.4] : intensity === 1 ? [3.5, 3, 2.4] : [1.4, 1.2, 1];
  return (
    <div className="da-flood-group">
      <svg className="da-wave da-wave-back" viewBox="0 0 480 16" preserveAspectRatio="none">
        <path d={wavePath(amps[0], 16)} />
      </svg>
      <svg className="da-wave da-wave-mid" viewBox="0 0 480 12" preserveAspectRatio="none">
        <path d={wavePath(amps[1], 12)} />
      </svg>
      <svg className="da-wave da-wave-front" viewBox="0 0 480 8" preserveAspectRatio="none">
        <path d={wavePath(amps[2], 8)} />
      </svg>
    </div>
  );
}

/** Walkers: --da-kid-x is the settled (reduced-motion) position on the path. */
const KID_WALKERS = [
  { h: 18, x: "16%", dur: "26s", delay: "-9s", op: 0.28 },
  { h: 14, x: "47%", dur: "31s", delay: "-22s", op: 0.22 },
  { h: 16, x: "74%", dur: "36s", delay: "-4s", op: 0.25 },
] as const;

function SchoolScene({ intensity }: { intensity: AmbientIntensity }) {
  const kids = intensity === 0 ? KID_WALKERS.slice(0, 2) : KID_WALKERS;
  return (
    <>
      <div className="da-sidewalk" />
      {kids.map((k, i) => (
        <div
          key={i}
          className="da-kid-track"
          style={
            { "--da-kid-x": k.x, animationDuration: k.dur, animationDelay: k.delay } as SceneStyle
          }
        >
          <svg
            className="da-kid"
            width={Math.round((k.h * 12) / 18)}
            height={k.h}
            viewBox="0 0 12 18"
            style={{ opacity: k.op }}
          >
            <circle cx="6.5" cy="2.6" r="2.4" />
            <rect x="4" y="5.6" width="5" height="9.6" rx="2.5" />
            <rect x="1.6" y="7" width="3.2" height="5.4" rx="1.2" />
          </svg>
        </div>
      ))}
    </>
  );
}

function LightningScene() {
  return (
    <>
      <svg className="da-cloud" viewBox="0 0 64 24" width="64" height="24">
        <ellipse cx="24" cy="14" rx="20" ry="9" />
        <ellipse cx="42" cy="11" rx="16" ry="8" />
      </svg>
      <svg className="da-bolt" viewBox="0 0 12 18" width="12" height="18">
        <polyline points="7.5,1 3.5,8 6.5,8 4.5,16" />
      </svg>
      <div className="da-flash" />
    </>
  );
}

const WIND_STREAKS = [
  { top: "22%", w: 72, dur: 8.5, delay: "-2s", x: "12%" },
  { top: "44%", w: 48, dur: 7.2, delay: "-5.4s", x: "42%" },
  { top: "62%", w: 88, dur: 10.6, delay: "-0.8s", x: "66%" },
  { top: "33%", w: 56, dur: 9.4, delay: "-7.6s", x: "26%" },
  { top: "74%", w: 40, dur: 11, delay: "-4.2s", x: "82%" },
] as const;

function WindScene({ intensity }: { intensity: AmbientIntensity }) {
  const speed = intensity === 2 ? 0.72 : intensity === 1 ? 0.88 : 1;
  return (
    <>
      {WIND_STREAKS.slice(0, 3 + intensity).map((s, i) => (
        <div
          key={i}
          className="da-streak-track"
          style={
            {
              top: s.top,
              "--da-streak-x": s.x,
              animationDuration: `${(s.dur * speed).toFixed(1)}s`,
              animationDelay: s.delay,
            } as SceneStyle
          }
        >
          <div className="da-streak" style={{ width: s.w }} />
        </div>
      ))}
    </>
  );
}

/** Deterministic scatter — sizes 1.5-2.5px, falls 9-14s, varied offsets. */
const SNOW_DOTS = Array.from({ length: 14 }, (_, i) => ({
  left: `${(i * 31 + 9) % 94}%`,
  top: `${(i * 23 + 7) % 55}%`,
  size: 1.5 + ((i * 7) % 5) * 0.25,
  dur: `${9 + ((i * 13) % 11) * 0.5}s`,
  delay: `${-((i * 17) % 12)}s`,
}));

function WinterScene({ intensity }: { intensity: AmbientIntensity }) {
  return (
    <>
      {SNOW_DOTS.slice(0, 8 + intensity * 3).map((d, i) => (
        <span
          key={i}
          className="da-snow"
          style={{
            left: d.left,
            top: d.top,
            width: d.size,
            height: d.size,
            animationDuration: d.dur,
            animationDelay: d.delay,
          }}
        />
      ))}
    </>
  );
}

/** Deterministic scatter — sizes 1.5-3px, rises 8-14s, honey 12-18% opacity. */
const RADON_BUBBLES = Array.from({ length: 14 }, (_, i) => ({
  left: `${(i * 37 + 11) % 92}%`,
  bottom: `${(i * 19 + 5) % 55}%`,
  size: 1.5 + ((i * 11) % 7) * 0.25,
  dur: `${8 + ((i * 13) % 13) * 0.5}s`,
  delay: `${-((i * 23) % 11)}s`,
  op: 0.12 + ((i * 5) % 7) * 0.01,
}));

function RadonScene({ intensity }: { intensity: AmbientIntensity }) {
  return (
    <>
      {RADON_BUBBLES.slice(0, 6 + intensity * 4).map((b, i) => (
        <span
          key={i}
          className="da-bubble"
          style={{
            left: b.left,
            bottom: b.bottom,
            width: b.size,
            height: b.size,
            opacity: b.op,
            animationDuration: b.dur,
            animationDelay: b.delay,
          }}
        />
      ))}
    </>
  );
}

const WATER_RIPPLES = [
  { left: "18%", bottom: "12px", w: 44, h: 10, dur: "4.8s", delay: "-0.5s" },
  { left: "48%", bottom: "24px", w: 58, h: 12, dur: "6.2s", delay: "-2.3s" },
  { left: "74%", bottom: "9px", w: 36, h: 8, dur: "5.4s", delay: "-3.5s" },
] as const;

function WaterScene({ intensity }: { intensity: AmbientIntensity }) {
  const drops = intensity === 2 ? ["28%", "62%", "82%"] : intensity === 1 ? ["52%"] : [];
  return (
    <>
      {WATER_RIPPLES.map((r, i) => (
        <svg
          key={i}
          className="da-water-ripple"
          viewBox={`0 0 ${r.w} ${r.h}`}
          width={r.w}
          height={r.h}
          style={{
            left: r.left,
            bottom: r.bottom,
            animationDuration: r.dur,
            animationDelay: r.delay,
          }}
        >
          <ellipse cx={r.w / 2} cy={r.h / 2} rx={r.w / 2 - 1} ry={r.h / 2 - 1} />
        </svg>
      ))}
      {drops.map((left, i) => (
        <span
          key={left}
          className="da-water-drop"
          style={{ left, animationDelay: `${-(i * 0.45).toFixed(2)}s` }}
        />
      ))}
    </>
  );
}

const AIR_STREAKS = [
  { top: "20%", w: 150, dur: "13s", delay: "-3s", x: "15%" },
  { top: "44%", w: 104, dur: "16s", delay: "-8s", x: "45%" },
  { top: "64%", w: 132, dur: "11s", delay: "-1s", x: "70%" },
  { top: "32%", w: 92, dur: "14.5s", delay: "-6s", x: "30%" },
] as const;

function AirScene({ intensity }: { intensity: AmbientIntensity }) {
  return (
    <>
      {AIR_STREAKS.slice(0, 2 + intensity).map((s, i) => (
        <div
          key={i}
          className="da-breeze-track"
          style={
            {
              top: s.top,
              "--da-streak-x": s.x,
              animationDuration: s.dur,
              animationDelay: s.delay,
            } as SceneStyle
          }
        >
          <div className="da-breeze" style={{ width: s.w }} />
        </div>
      ))}
      {intensity === 0 && (
        <div className="da-leaf-track" style={{ "--da-leaf-x": "58%" } as SceneStyle}>
          <svg className="da-leaf" viewBox="0 0 10 10" width="8" height="8">
            <path d="M1 9 Q1 3 9 1 Q7 9 1 9 Z" />
          </svg>
        </div>
      )}
      {intensity === 2 && <div className="da-haze" />}
    </>
  );
}

const HOUSING_BARS = [
  { x: "22%", h: 15, delay: "-0.2s" },
  { x: "44%", h: 24, delay: "-0.8s" },
  { x: "64%", h: 18, delay: "-1.4s" },
  { x: "82%", h: 30, delay: "-2.1s" },
] as const;

function HousingScene({ intensity }: { intensity: AmbientIntensity }) {
  return (
    <>
      <svg className="da-housing-homes" viewBox="0 0 180 30" width="180" height="30">
        <path d="M10 22 L24 12 L38 22 V29 H10 Z" />
        <rect x="18" y="22" width="6" height="7" rx="1.5" />
        <path d="M126 22 L140 12 L154 22 V29 H126 Z" />
        <rect x="134" y="22" width="6" height="7" rx="1.5" />
        <line x1="0" y1="29" x2="180" y2="29" />
      </svg>
      {HOUSING_BARS.map((bar, i) => (
        <span
          key={i}
          className="da-housing-bar"
          style={{
            left: bar.x,
            height: bar.h + intensity * 4,
            animationDelay: bar.delay,
          }}
        />
      ))}
    </>
  );
}

const EV_NODES = [
  { left: "24%", top: "36%", delay: "-0.2s" },
  { left: "48%", top: "62%", delay: "-0.9s" },
  { left: "72%", top: "32%", delay: "-1.5s" },
] as const;

function EvScene({ intensity }: { intensity: AmbientIntensity }) {
  const nodes = EV_NODES.slice(0, intensity === 0 ? 1 : intensity === 1 ? 2 : 3);
  return (
    <>
      <svg className="da-ev-path" viewBox="0 0 180 72" preserveAspectRatio="none">
        <path d="M28 36 C62 18 88 58 132 28" />
      </svg>
      {nodes.map((node, i) => (
        <span
          key={i}
          className="da-ev-node"
          style={{ left: node.left, top: node.top, animationDelay: node.delay }}
        />
      ))}
      <svg className="da-ev-bolt" viewBox="0 0 18 24" width="18" height="24">
        <polyline points="11,1 5,11 10,11 7,23" />
      </svg>
    </>
  );
}

/** Skyline rects (x, y, w, h in a 220x36 box) with honey window dots inside. */
const HOOD_BUILDINGS = [
  [0, 18, 28, 18],
  [32, 10, 22, 26],
  [58, 22, 30, 14],
  [92, 6, 24, 30],
  [120, 16, 28, 20],
  [152, 12, 26, 24],
  [182, 20, 30, 16],
] as const;

const HOOD_WINDOWS = [
  [9, 24],
  [19, 28],
  [38, 16],
  [45, 22],
  [97, 11],
  [104, 17],
  [158, 17],
  [190, 25],
] as const;

const HOOD_STEPS = ["38%", "52%", "66%"] as const;

function NeighborhoodScene() {
  return (
    <>
      <svg className="da-skyline" viewBox="0 0 220 36" preserveAspectRatio="none">
        {HOOD_BUILDINGS.map(([x, y, w, h], i) => (
          <rect key={`b${i}`} className="da-bld" x={x} y={y} width={w} height={h} />
        ))}
        {HOOD_WINDOWS.map(([x, y], i) => (
          <rect
            key={`w${i}`}
            className="da-window"
            x={x}
            y={y}
            width="1.6"
            height="1.6"
            style={{ animationDelay: `${(i * 1.3).toFixed(1)}s` }}
          />
        ))}
      </svg>
      <div className="da-walkpath" />
      {HOOD_STEPS.map((left, i) => (
        <span
          key={i}
          className="da-step"
          style={{ left, animationDelay: `calc(${i} * var(--da-cadence, 1.2s))` }}
        />
      ))}
    </>
  );
}

/** Eight rays at 45-degree steps around a 44x44 disc (r12 -> r17). */
const SUN_RAYS = [
  [34, 22, 39, 22],
  [30.5, 30.5, 34, 34],
  [22, 34, 22, 39],
  [13.5, 30.5, 10, 34],
  [10, 22, 5, 22],
  [13.5, 13.5, 10, 10],
  [22, 10, 22, 5],
  [30.5, 13.5, 34, 10],
] as const;

function SunScene() {
  return (
    <svg className="da-sun" viewBox="0 0 44 44" width="44" height="44">
      <g className="da-sun-rays">
        {SUN_RAYS.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
      <circle cx="22" cy="22" r="8" />
    </svg>
  );
}

function CloudScene() {
  return (
    <>
      <svg className="da-wcloud da-wcloud-a" viewBox="0 0 56 20" width="56" height="20">
        <ellipse cx="20" cy="12" rx="16" ry="7" />
        <ellipse cx="36" cy="10" rx="14" ry="8" />
      </svg>
      <svg className="da-wcloud da-wcloud-b" viewBox="0 0 56 20" width="44" height="16">
        <ellipse cx="20" cy="12" rx="16" ry="7" />
        <ellipse cx="36" cy="10" rx="14" ry="8" />
      </svg>
    </>
  );
}

/** Short 6px drops falling ~1.4s, staggered; count scales with intensity. */
const RAIN_DROPS = Array.from({ length: 12 }, (_, i) => ({
  left: `${(i * 29 + 6) % 92}%`,
  top: `${(i * 17 + 4) % 46}%`,
  dur: `${(1.3 + ((i * 7) % 3) * 0.1).toFixed(1)}s`,
  delay: `${(-(i * 0.17)).toFixed(2)}s`,
}));

function RainScene({ intensity }: { intensity: AmbientIntensity }) {
  return (
    <>
      {RAIN_DROPS.slice(0, 8 + intensity * 2).map((d, i) => (
        <span
          key={i}
          className="da-rain"
          style={{ left: d.left, top: d.top, animationDuration: d.dur, animationDelay: d.delay }}
        />
      ))}
    </>
  );
}

function FogScene() {
  return (
    <>
      <svg className="da-wcloud da-fog-cloud-a" viewBox="0 0 56 20" width="68" height="20">
        <ellipse cx="20" cy="12" rx="16" ry="7" />
        <ellipse cx="36" cy="10" rx="14" ry="8" />
      </svg>
      <svg className="da-wcloud da-fog-cloud-b" viewBox="0 0 56 20" width="72" height="18">
        <ellipse cx="20" cy="12" rx="16" ry="7" />
        <ellipse cx="36" cy="10" rx="14" ry="8" />
      </svg>
      {[0, 1, 2].map((i) => (
        <span key={i} className="da-fog-line" style={{ bottom: `${12 + i * 7}px`, opacity: 0.16 - i * 0.025 }} />
      ))}
    </>
  );
}

function HeatScene() {
  return (
    <>
      <SunScene />
      {["48%", "58%", "68%"].map((left, i) => (
        <span
          key={left}
          className="da-heat-line"
          style={{ left, height: 22 + i * 5, animationDelay: `${-(i * 0.42).toFixed(2)}s` }}
        />
      ))}
    </>
  );
}

function AmbientScene({ kind, intensity, variant }: AmbientSpec) {
  switch (kind) {
    case "flood":
      return <FloodScene intensity={intensity} />;
    case "school":
      return <SchoolScene intensity={intensity} />;
    case "hazard":
      if (variant === "lightning") return <LightningScene />;
      if (variant === "winter") return <WinterScene intensity={intensity} />;
      return <WindScene intensity={intensity} />;
    case "radon":
      return <RadonScene intensity={intensity} />;
    case "water":
      return <WaterScene intensity={intensity} />;
    case "air":
      return <AirScene intensity={intensity} />;
    case "housing":
      return <HousingScene intensity={intensity} />;
    case "evCharging":
      return <EvScene intensity={intensity} />;
    case "neighborhood":
      return <NeighborhoodScene />;
    case "weather":
      if (variant === "storm") return <LightningScene />;
      if (variant === "snow" || variant === "cold") return <WinterScene intensity={intensity} />;
      if (variant === "fog") return <FogScene />;
      if (variant === "heat") return <HeatScene />;
      if (variant === "wind") return <WindScene intensity={intensity} />;
      if (variant === "rain") return <RainScene intensity={intensity} />;
      if (variant === "cloud") return <CloudScene />;
      return <SunScene />;
  }
}

// ── Layer component ───────────────────────────────────────────────────────────

function storyPose(kind: AmbientKind, intensity: AmbientIntensity, variant?: AmbientVariant): string {
  if (kind === "weather") {
    if (variant === "storm" || variant === "lightning") return "storm";
    if (variant === "snow" || variant === "winter" || variant === "cold") return "cold";
    if (variant === "fog" || variant === "wind" || variant === "heat" || variant === "rain" || variant === "cloud") {
      return variant;
    }
    return "sun";
  }
  if (kind === "hazard") {
    if (variant === "lightning") return "storm";
    if (variant === "winter") return "cold";
    return "wind";
  }
  if (kind === "air") return intensity === 2 ? "air-bad" : intensity === 1 ? "air-mid" : "air-good";
  if (kind === "water") return intensity === 2 ? "water-bad" : intensity === 1 ? "water-mid" : "water-good";
  if (kind === "flood") return intensity === 2 ? "flood-bad" : intensity === 1 ? "flood-mid" : "flood-good";
  if (kind === "housing") return intensity === 2 ? "cost-bad" : "housing";
  if (kind === "school") return "wave";
  if (kind === "evCharging") return "spark";
  if (kind === "neighborhood") return intensity >= 1 ? "walk" : "calm";
  if (kind === "radon") return intensity >= 2 ? "alert" : "calm";
  return "calm";
}

function DossierStoryCharacter({
  kind,
  intensity,
  variant,
  mood,
}: {
  kind: AmbientKind;
  intensity: AmbientIntensity;
  variant?: AmbientVariant;
  mood: DossierRaccoonMood;
}) {
  const pose = storyPose(kind, intensity, variant);
  const showMask = pose === "air-mid" || pose === "air-bad";
  const showScarf = pose === "cold";
  const showShades = pose === "fog";
  const showGlass = pose === "water-good" || pose === "water-mid";
  const showSweat = pose === "air-bad" || pose === "heat" || pose === "cost-bad";
  const showPuff = pose === "cold" || pose === "air-bad";
  const showSpark = pose === "spark" || pose === "water-good";
  const showSign = pose === "storm" || pose === "cost-bad" || pose === "flood-bad" || pose === "alert";

  return (
    <div className="da-story" data-story={pose}>
      <div className="da-story-head">
        <DossierRaccoon mood={mood} size={30} />
        {showMask && <span className="da-story-mask" />}
        {showScarf && <span className="da-story-scarf" />}
        {showShades && (
          <span className="da-story-shades">
            <span />
            <span />
          </span>
        )}
        {showPuff && <span className="da-story-puff" />}
      </div>
      <div className="da-story-body">
        <span className="da-story-belly" />
        <span className="da-story-foot da-story-foot-left" />
        <span className="da-story-foot da-story-foot-right" />
      </div>
      <span className="da-story-arm da-story-arm-left" />
      <span className="da-story-arm da-story-arm-right" />
      {showGlass && (
        <span className="da-story-glass">
          <span />
        </span>
      )}
      {showSweat && <span className="da-story-sweat" />}
      {showSpark && <span className="da-story-spark" />}
      {showSign && <span className="da-story-sign" />}
    </div>
  );
}

function clampIntensity(value: number): AmbientIntensity {
  const n = Math.round(value);
  return n <= 0 ? 0 : n >= 2 ? 2 : 1;
}

/**
 * The ambient layer for one dossier section row. The host row must be
 * `relative isolate`; the scene layer fills its right side, masked so the left
 * text zone stays clean, stacked under the row content, and paused while
 * offscreen.
 *
 * On TOP of that data-derived scene sits the mood-driven raccoon character —
 * the same character the mobile DossierAmbient renders. It is a separate
 * foreground element anchored in the bottom-right corner where the row
 * carries no text. ambientForSection stays the data-honest source of truth for
 * the scene; dossierRaccoonFor only picks the expression that mirrors this
 * reading (good -> happy/approved, mid -> calm/thinking, bad -> alert). The
 * raccoon is a static SVG — no new motion — so it is inherently
 * reduced-motion safe and aria-hidden like the rest of the decoration.
 */
export function DossierAmbient({
  kind,
  intensity,
  variant,
}: {
  kind: AmbientKind;
  intensity: number;
  variant?: AmbientVariant;
}) {
  const ref = useAmbientPause();
  const level = clampIntensity(intensity);
  const mood = dossierRaccoonFor({ kind, intensity: level, variant });
  const sourceScene = sourceDossierSceneFor({ kind, intensity: level, variant });
  return (
    <>
      <div
        ref={ref}
        aria-hidden="true"
        data-kind={kind}
        data-intensity={level}
        data-source-type={sourceScene.type}
        data-source-level={sourceScene.level}
        data-variant={variant}
        // Keep the scene on a visible foreground plane; globals.css masks it to
        // the right side and lifts row copy above it.
        style={{ zIndex: 0 }}
        className="da-layer pointer-events-none absolute inset-y-0 right-0 w-[72%] overflow-hidden rounded-r-xl"
      >
        <AmbientScene kind={kind} intensity={level} variant={variant} />
      </div>
      <div
        aria-hidden="true"
        // The foreground character sits above the scene in the bottom-right
        // corner the row carries no text.
        className="da-raccoon pointer-events-none absolute bottom-0 right-2 z-[1] flex items-end"
      >
        <DossierStoryCharacter kind={kind} intensity={level} variant={variant} mood={mood} />
      </div>
    </>
  );
}
