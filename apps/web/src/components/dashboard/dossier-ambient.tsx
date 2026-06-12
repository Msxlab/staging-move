"use client";

import { useEffect, useRef, useState, type CSSProperties, type MutableRefObject } from "react";

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
  | "air"
  | "neighborhood"
  | "weather";

export type AmbientIntensity = 0 | 1 | 2;

export type AmbientVariant = "lightning" | "wind" | "winter" | "sun" | "cloud" | "rain";

export interface AmbientSpec {
  kind: AmbientKind;
  intensity: AmbientIntensity;
  variant?: AmbientVariant;
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
  | { kind: "air"; aqi: number }
  | { kind: "neighborhood"; walkBand: string | null }
  | { kind: "weather"; summary: string | null; precipChancePct: number | null };

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
    case "air":
      return { kind: "air", intensity: section.aqi <= 50 ? 0 : section.aqi <= 100 ? 1 : 2 };
    case "neighborhood": {
      const band = section.walkBand;
      return {
        kind: "neighborhood",
        intensity: band === "most" ? 2 : band === "above_average" ? 1 : 0,
      };
    }
    case "weather": {
      const precip = section.precipChancePct;
      if (typeof precip === "number" && precip >= 50) {
        return { kind: "weather", intensity: precip >= 80 ? 2 : 1, variant: "rain" };
      }
      if ((section.summary ?? "").toLowerCase().includes("cloud")) {
        return { kind: "weather", intensity: 1, variant: "cloud" };
      }
      return { kind: "weather", intensity: 0, variant: "sun" };
    }
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
    case "air":
      return <AirScene intensity={intensity} />;
    case "neighborhood":
      return <NeighborhoodScene />;
    case "weather":
      if (variant === "rain") return <RainScene intensity={intensity} />;
      if (variant === "cloud") return <CloudScene />;
      return <SunScene />;
  }
}

// ── Layer component ───────────────────────────────────────────────────────────

function clampIntensity(value: number): AmbientIntensity {
  const n = Math.round(value);
  return n <= 0 ? 0 : n >= 2 ? 2 : 1;
}

/**
 * The ambient layer for one dossier section row. The host row must be
 * `relative isolate`; this layer fills its right 55%, masked so the left text
 * zone stays clean, stacked under the row content (z-index -1 via .da-layer),
 * and paused while offscreen.
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
  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-kind={kind}
      data-intensity={level}
      className="da-layer pointer-events-none absolute inset-y-0 right-0 w-[55%] overflow-hidden rounded-r-xl"
    >
      <AmbientScene kind={kind} intensity={level} variant={variant} />
    </div>
  );
}
