"use client";

import { useEffect, useRef, useState, type CSSProperties, type MutableRefObject, type ReactNode } from "react";
import { DossierRaccoon, type DossierRaccoonMood } from "./dossier-raccoon";

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

export type SourceDossierSceneType =
  | "weather"
  | "air"
  | "water"
  | "area"
  | "transit"
  | "cost"
  | "housing"
  | "flood"
  | "radon"
  | "school"
  | "ev"
  | "hood";

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

/**
 * OPTIONAL raw-narration payload threaded from the row's real data down to the
 * scene so EV / Air can compute their OWN fine-grained sub-state WITHOUT
 * touching the 0|1|2 intensity contract. This is purely ADDITIVE — data-intensity
 * stays 0-2 and data-ds-level stays good/mid/bad (still derived from intensity
 * for tone/tag/mood/band-meter). When `detail` is absent (e.g. the marketing
 * showcase, or any caller that doesn't pass it) the scenes fall back to the
 * current level-based rendering with no crash.
 */
export type SceneDetail = {
  /** Uncapped area EV-station count (NREL total_results); drives the 5 EV sub-states. */
  evCount?: number;
  /** DC-fast port count near the address (kept for parity / future use). */
  evDcFast?: number;
  /** Raw current AQI; drives the 6 air bands (Good … Hazardous). */
  aqi?: number;
  /** AirNow category string fallback when a numeric AQI is absent. */
  aqiCategory?: string;
};

export interface SourceDossierSceneSpec {
  type: SourceDossierSceneType;
  level: SourceDossierSceneLevel;
  /** Optional raw data enriching the in-scene visual (see SceneDetail). */
  detail?: SceneDetail;
}

/**
 * RACCOON-LITE dossier scenes (no-gold + "less raccoon" direction).
 *
 * The dossier scenes used to render a <SourceCharacter>/<DossierRaccoon> mascot
 * ON TOP of their data-derived background + particle + glow layers. User
 * feedback was "too much raccoon" in the dossier, so this flag gates EVERY
 * in-scene mascot at a single point: when false, SourceCharacter renders
 * nothing and the scene reads purely from its tone + particle density +
 * GOOD/CHECK/ALERT tag + sibling status glyphs (ds-alert-symbol, ds-air-wary,
 * ds-spark, ds-warning-triangle, …). The background / particle / glow / tone
 * layers (ds-ground, ds-radial, ds-leaf, ds-mote, ds-rain, ds-snow, ds-cloud,
 * ds-fogband, ds-streak, ds-ray, ds-glow, ds-flood, ds-ev-node, …) all stay.
 *
 * It is deliberately a module-level constant (not deleted code): flip it back
 * to `true` to restore the mascot in all scenes at once. The DossierRaccoon /
 * SourceCharacter definitions are KEPT for the app's other raccoon uses (logo,
 * dashboard greeting mascot, RaccoonMark) and for this reversibility.
 *
 * Scope: the in-scene mascot ONLY. The foreground AqiGauge / EvMeter (air, EV)
 * never used SourceCharacter, so they are unaffected.
 */
const SCENE_RACCOON = false;

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
 * DossierScene(type, level) matrix so web renders the prototype scene states
 * explicitly rather than an unrelated row-art approximation.
 */
export function sourceDossierSceneFor(
  { kind, intensity, variant }: AmbientSpec,
  detail?: SceneDetail,
): SourceDossierSceneSpec {
  switch (kind) {
    case "weather":
      return { type: "weather", level: weatherSourceLevel(variant) };
    case "air":
      // intensity still drives level (tone/tag/mood/band-meter); detail.aqi (or
      // aqiCategory) lets the AIR scene split "mid" into the 6 distinct bands.
      return { type: "air", level: riskSourceLevel(intensity), detail };
    case "water":
      return { type: "water", level: riskSourceLevel(intensity) };
    case "housing":
      return { type: "housing", level: "mid" };
    case "evCharging":
      // Dedicated EV scene: charging post + a pulsing bolt + charge nodes (denser with
      // more stations); the empty/"bad" state simply drops the bolt and nodes. detail
      // (evCount) lets the scene pick one of 5 escalating density sub-states.
      return { type: "ev", level: positiveSourceLevel(intensity), detail };
    case "neighborhood":
      // Dedicated neighbourhood scene: a lit skyline + a stroller whose liveliness tracks
      // walkability. Never an alarming state (walkability is not a risk signal).
      return { type: "hood", level: intensity === 2 ? "good" : "mid" };
    case "school":
      // Dedicated school scene: kid silhouettes strolling a path past a flag. A school
      // district carries no risk signal, so it always reads as the calm, friendly state.
      return { type: "school", level: "good" };
    case "hazard":
      return { type: "weather", level: weatherSourceLevel(variant) };
    case "flood":
      // Flood risk -> dedicated flood scene: drifting parallax water bands that rise
      // toward the raccoon as risk climbs (calm at low risk, alert + rain at high).
      return { type: "flood", level: riskSourceLevel(intensity) };
    case "radon":
      // Dedicated radon scene: gas bubbles rising from the ground, density scaling with
      // the EPA zone (zone 3 calm -> zone 1 dense + alert).
      return { type: "radon", level: riskSourceLevel(intensity) };
  }
}

type SourceSceneVariables = CSSProperties & {
  "--ds-tone": string;
  "--ds-glow": string;
  "--rc-head": string;
  "--rc-mask": string;
  "--rc-ear": string;
  "--rc-eye": string;
  "--rc-pupil": string;
};

export function sourceSceneVars({ type, level }: SourceDossierSceneSpec): SourceSceneVariables {
  const isBad =
    level === "bad" ||
    level === "storm" ||
    level === "heat" ||
    level === "wind" ||
    level === "cold";
  const isGood = level === "good" || level === "sun";
  const tone =
    type === "air" && isGood
      ? "var(--sage)"
      : type === "water" && isGood
        ? "var(--info)"
        : type === "transit" && isGood
          ? "var(--info)"
          : type === "flood"
            ? isBad
              ? "var(--danger)"
              : "var(--info)"
            : isBad
              ? "var(--danger)"
              : "var(--foil-b)";
  return {
    "--ds-tone": tone,
    "--ds-glow": `color-mix(in srgb, ${tone} 22%, transparent)`,
    "--rc-head": "var(--lf-rc-head, #8C9AB2)",
    "--rc-mask": "var(--lf-rc-mask, #0C1525)",
    "--rc-ear": "#C4A090",
    "--rc-eye": "var(--lf-rc-eye, var(--foil-b))",
    "--rc-pupil": "var(--lf-rc-pupil, #04080F)",
  };
}

export function sourceSceneTag({ type, level }: SourceDossierSceneSpec): string {
  if (type === "housing") return "AREA";
  if (level === "good" || level === "sun") return "GOOD";
  if (level === "bad" || level === "storm" || level === "heat" || level === "cold") return "ALERT";
  return "CHECK";
}

function SourceCharacter({
  mood,
  size = 29,
  style,
  headStyle,
  bodyStyle,
  headChildren,
  children,
}: {
  mood: DossierRaccoonMood;
  size?: number;
  style?: CSSProperties;
  headStyle?: CSSProperties;
  bodyStyle?: CSSProperties;
  headChildren?: ReactNode;
  children?: ReactNode;
}) {
  // Raccoon-lite: the in-scene mascot (head + body + its attached props such as
  // arms / signs / status pop) is removed at this single gate. The scene's
  // sibling background + particle + glow + tone layers and the GOOD/CHECK/ALERT
  // tag still render, so each state stays legible without the character.
  if (!SCENE_RACCOON) return null;
  return (
    <div className="ds-char" style={style}>
      <div className="ds-hd" style={headStyle}>
        <DossierRaccoon mood={mood} size={size} />
        {headChildren}
      </div>
      <div className="ds-bd" style={bodyStyle}>
        <div className="ds-belly" />
        <div className="ds-foot" style={{ left: 5 }} />
        <div className="ds-foot" style={{ right: 5 }} />
      </div>
      {children}
    </div>
  );
}

function MiniVehicle({ delay = "0s", variant = "bus" }: { delay?: string; variant?: "bus" | "train" }) {
  const width = variant === "bus" ? 50 : 58;
  return (
    <div className="ds-vehicle" data-variant={variant} style={{ width, animationDelay: delay }}>
      <div className="ds-vehicle-body" />
      {[0, 1, 2, 3, 4].slice(0, variant === "bus" ? 4 : 5).map((i) => (
        <div key={i} className="ds-vehicle-window" style={{ left: 5 + i * 10 }} />
      ))}
      <div className="ds-wheel" style={{ left: 8 }} />
      <div className="ds-wheel" style={{ right: 9 }} />
    </div>
  );
}

function TransitSourceScene({ level }: { level: SourceDossierSceneLevel }) {
  if (level === "bad") {
    return (
      <>
        <div className="ds-ground ds-ground-warn" />
        <div className="ds-road ds-road-warn" />
        <div className="ds-tumble" />
        <SourceCharacter mood="happy" style={{ left: "46%", animation: "ds-bob 2.8s ease-in-out infinite" }}>
          <div className="ds-arm" style={{ right: -6, bottom: 12, transform: "rotate(-34deg)", transformOrigin: "left center" }} />
          <div className="ds-thumb" />
          <div className="ds-sign">NY?</div>
        </SourceCharacter>
      </>
    );
  }
  if (level === "mid") {
    return (
      <>
        <div className="ds-ground" />
        <div className="ds-road ds-road-mid" />
        <div className="ds-stop" />
        <MiniVehicle variant="bus" />
        <SourceCharacter
          mood="thinking"
          style={{ left: "34%", animation: "ds-bob 2.8s ease-in-out infinite" }}
          headStyle={{ transformOrigin: "bottom center", animation: "ds-look 3.4s ease-in-out infinite" }}
        >
          <div className="ds-arm" style={{ right: -3, bottom: 15, transform: "rotate(-58deg)", transformOrigin: "left center" }} />
          <div className="ds-watch" />
        </SourceCharacter>
      </>
    );
  }
  return (
    <>
      <div className="ds-ground" />
      <div className="ds-road" />
      <div className="ds-stop" />
      <SourceCharacter mood="happy" style={{ left: 26, animation: "ds-bob 2.4s ease-in-out infinite" }}>
        <div className="ds-arm ds-wave-arm" style={{ right: 1, bottom: 11, transformOrigin: "left center" }} />
      </SourceCharacter>
      <MiniVehicle variant="bus" />
      <MiniVehicle variant="train" delay="3s" />
    </>
  );
}

/**
 * The six EPA AQI bands the AIR scene narrates. The #1 fix: "Moderate" must
 * read CLEARLY different from "Good" (a visible amber wash + amber motes + a
 * wary raccoon), and the mask appears from USG (101) onward as the air turns
 * genuinely unhealthy. Each step up adds haze opacity, mote count, and a
 * darker palette so the band is self-evident at a glance.
 */
type AirBand = "good" | "moderate" | "usg" | "unhealthy" | "veryUnhealthy" | "hazardous";

/**
 * Resolve the air band from raw detail. Prefers a numeric AQI; falls back to
 * the AirNow category string; finally falls back to the coarse 0|1|2 level so a
 * detail-less caller still renders sensibly (good / moderate / unhealthy).
 */
export function airBandFor(level: SourceDossierSceneLevel, detail?: SceneDetail): AirBand {
  const aqi = detail?.aqi;
  if (typeof aqi === "number" && Number.isFinite(aqi)) {
    if (aqi <= 50) return "good";
    if (aqi <= 100) return "moderate";
    if (aqi <= 150) return "usg";
    if (aqi <= 200) return "unhealthy";
    if (aqi <= 300) return "veryUnhealthy";
    return "hazardous";
  }
  const c = (detail?.aqiCategory ?? "").toLowerCase();
  if (c) {
    if (c.includes("hazard")) return "hazardous";
    if (c.includes("very unhealthy")) return "veryUnhealthy";
    if (c.includes("sensitive")) return "usg";
    if (c.includes("unhealthy")) return "unhealthy";
    if (c.includes("moderate")) return "moderate";
    if (c.includes("good")) return "good";
  }
  // No detail → coarse level (keeps the marketing showcase + legacy callers).
  return level === "bad" ? "unhealthy" : level === "mid" ? "moderate" : "good";
}

// Per-band mote layouts (left%, bottom px) — count escalates with severity so
// the haze visibly thickens. Reused for amber and grey motes.
const AIR_MOTE_SLOTS = [14, 30, 44, 58, 70, 82, 22, 50, 66, 78] as const;

function airMotes(count: number, amber: boolean): ReactNode {
  return AIR_MOTE_SLOTS.slice(0, count).map((left, i) => (
    <span
      key={`${left}-${i}`}
      className={amber ? "ds-mote ds-mote-amber" : "ds-mote"}
      style={{ left: `${left}%`, bottom: 8 + ((i * 7) % 22), animationDelay: `${i * 0.32}s` }}
    />
  ));
}

function AirSourceScene({ level, detail }: { level: SourceDossierSceneLevel; detail?: SceneDetail }) {
  const band = airBandFor(level, detail);
  const hasAqi = typeof detail?.aqi === "number" && Number.isFinite(detail.aqi);
  const hasDetail = hasAqi || Boolean(detail?.aqiCategory);

  // GOOD (0–50): clear radial, leaves drifting up, breathing raccoon. Bright.
  if (band === "good") {
    return (
      <div className="ds-air" data-air-band="good">
        <div className="ds-radial" />
        {[24, 56, 72].map((left, i) => (
          <span key={left} className="ds-leaf" style={{ left: `${left}%`, bottom: 14 + i * 3, animationDelay: `${i}s` }} />
        ))}
        <SourceCharacter
          mood="approved"
          size={30}
          style={{ left: "50%", marginLeft: -17, animation: "ds-bob 3s ease-in-out infinite" }}
          bodyStyle={{ transformOrigin: "bottom center", animation: "ds-breathe 3.4s ease-in-out infinite" }}
        />
      </div>
    );
  }

  // MODERATE (51–100): a CLEARLY visible amber wash (ds-air-amber, bumped
  // opacity) + 3 amber motes + a visibly WARY raccoon — NO mask yet, but it
  // must NOT look like Good. The amber haze is the unambiguous "this is not
  // Good" cue. NOTE: when no raw detail was threaded (legacy / marketing
  // showcase) we keep the prior level-1 look — amber wash + amber motes + mask
  // — so detail-less callers degrade to the familiar moderate scene.
  if (band === "moderate") {
    return (
      <div className="ds-air" data-air-band="moderate">
        <div className={hasDetail ? "ds-amber-bg ds-air-amber" : "ds-amber-bg"} />
        {airMotes(3, true)}
        {hasDetail && <span className="ds-air-wary">?</span>}
        <SourceCharacter
          mood="thinking"
          style={{ left: "50%", marginLeft: -17, animation: "ds-bob 3s ease-in-out infinite" }}
          headStyle={hasDetail ? { transformOrigin: "bottom center", animation: "ds-look 3.4s ease-in-out infinite" } : undefined}
          headChildren={hasDetail ? undefined : <div className="ds-mask" />}
        />
      </div>
    );
  }

  // USG (101–150): amber-orange haze + more motes; the raccoon dons the mask.
  if (band === "usg") {
    return (
      <div className="ds-air" data-air-band="usg">
        <div className="ds-amber-bg ds-air-haze ds-air-haze-usg" />
        {airMotes(5, true)}
        <SourceCharacter
          mood="thinking"
          style={{ left: "50%", marginLeft: -17, animation: "ds-bob 3s ease-in-out infinite" }}
          headChildren={<div className="ds-mask" />}
        />
      </div>
    );
  }

  // UNHEALTHY (151–200): grey-orange haze, denser motes, mask, alert.
  if (band === "unhealthy") {
    return (
      <div className="ds-air" data-air-band="unhealthy">
        <div className="ds-haze-bg ds-air-haze ds-air-haze-unhealthy" />
        {airMotes(7, false)}
        <SourceCharacter
          mood="alert"
          style={{ left: "50%", marginLeft: -17, animation: "ds-heave 1.2s ease-in-out infinite" }}
          headChildren={<div className="ds-mask" />}
        >
          <span className="ds-popmark">~</span>
        </SourceCharacter>
      </div>
    );
  }

  // VERY UNHEALTHY (201–300): heavy grey haze, swarm of motes, mask, alert.
  if (band === "veryUnhealthy") {
    return (
      <div className="ds-air" data-air-band="veryUnhealthy">
        <div className="ds-haze-bg ds-air-haze ds-air-haze-very" />
        {airMotes(9, false)}
        <SourceCharacter
          mood="alert"
          style={{ left: "50%", marginLeft: -17, animation: "ds-heave 1s ease-in-out infinite" }}
          headChildren={<div className="ds-mask" />}
        >
          <span className="ds-popmark">~</span>
        </SourceCharacter>
      </div>
    );
  }

  // HAZARDOUS (301+): dark red-grey haze, max motes, mask + an alert glyph.
  return (
    <div className="ds-air" data-air-band="hazardous">
      <div className="ds-haze-bg ds-air-haze ds-air-haze-hazard" />
      {airMotes(10, false)}
      <span className="ds-alert-symbol ds-air-hazard-glyph">!</span>
      <SourceCharacter
        mood="alert"
        style={{ left: "50%", marginLeft: -17, animation: "ds-heave 0.9s ease-in-out infinite" }}
        headChildren={<div className="ds-mask" />}
      >
        <span className="ds-popmark">~</span>
      </SourceCharacter>
    </div>
  );
}

function WaterSourceScene({ level }: { level: SourceDossierSceneLevel }) {
  if (level === "bad") {
    return (
      <>
        <div className="ds-haze-bg" />
        {[60, 66].map((left, i) => (
          <span key={left} className="ds-mote ds-mote-amber" style={{ left: `${left}%`, bottom: 18 + i * 4, animationDelay: `${i * 0.6}s` }} />
        ))}
        <span className="ds-alert-symbol">!</span>
        <SourceCharacter mood="alert" style={{ left: "40%", animation: "ds-bob 3s ease-in-out infinite" }}>
          <div className="ds-arm" style={{ left: "50%", marginLeft: -5, bottom: 20, transform: "rotate(-50deg)", transformOrigin: "right center" }} />
        </SourceCharacter>
      </>
    );
  }
  if (level === "mid") {
    return (
      <>
        <div className="ds-amber-bg" />
        <SourceCharacter mood="thinking" style={{ left: "40%", animation: "ds-bob 3.2s ease-in-out infinite" }}>
          <div className="ds-filter" />
          <span className="ds-drip" />
        </SourceCharacter>
      </>
    );
  }
  return (
    <>
      <div className="ds-radial" />
      <span className="ds-spark">+</span>
      <SourceCharacter
        mood="happy"
        style={{ left: "42%", animation: "ds-bob 3s ease-in-out infinite" }}
        headStyle={{ transformOrigin: "bottom center", animation: "ds-sip 4s ease-in-out infinite" }}
      >
        <div className="ds-glass"><div /></div>
      </SourceCharacter>
    </>
  );
}

function FloodSourceScene({ level }: { level: SourceDossierSceneLevel }) {
  const water = (
    <div className={level === "bad" ? "ds-flood ds-flood-bad" : "ds-flood"}>
      <div className="ds-flood-band ds-flood-band-3" />
      <div className="ds-flood-band ds-flood-band-2" />
      <div className="ds-flood-band ds-flood-band-1" />
    </div>
  );
  if (level === "bad") {
    return (
      <>
        <div className="ds-radial" />
        {[30, 60, 84].map((left, i) => (
          <span
            key={left}
            className="ds-rain"
            style={{ left: `${left}%`, top: 6 + (i % 2) * 5, animationDelay: `${i * 0.3}s` }}
          />
        ))}
        <span className="ds-alert-symbol">!</span>
        {water}
        <SourceCharacter mood="alert" style={{ left: "42%", animation: "ds-bob 2.2s ease-in-out infinite" }}>
          <div
            className="ds-arm"
            style={{ right: -4, bottom: 17, transform: "rotate(-54deg)", transformOrigin: "left center" }}
          />
        </SourceCharacter>
      </>
    );
  }
  if (level === "mid") {
    return (
      <>
        <div className="ds-radial" />
        {water}
        <SourceCharacter
          mood="thinking"
          style={{ left: "42%", animation: "ds-bob 3.2s ease-in-out infinite" }}
          headStyle={{ transformOrigin: "bottom center", animation: "ds-look 3.4s ease-in-out infinite" }}
        />
      </>
    );
  }
  return (
    <>
      <div className="ds-radial" />
      <span className="ds-spark">+</span>
      {water}
      <SourceCharacter mood="happy" style={{ left: "42%", animation: "ds-bob 3s ease-in-out infinite" }}>
        <div className="ds-arm ds-wave-arm" style={{ right: 1, bottom: 12, transformOrigin: "left center" }} />
      </SourceCharacter>
    </>
  );
}

const RADON_BUBBLE_SPECS = [
  { left: "20%", dur: "3.2s", delay: "0s" },
  { left: "38%", dur: "3.8s", delay: "-1.2s" },
  { left: "56%", dur: "3.4s", delay: "-2s" },
  { left: "70%", dur: "4s", delay: "-0.6s" },
  { left: "84%", dur: "3.6s", delay: "-1.6s" },
] as const;

function RadonSourceScene({ level }: { level: SourceDossierSceneLevel }) {
  const count = level === "bad" ? 5 : level === "mid" ? 3 : 2;
  const mood: DossierRaccoonMood = level === "bad" ? "alert" : level === "good" ? "happy" : "thinking";
  return (
    <>
      <div className="ds-radon-haze" />
      {RADON_BUBBLE_SPECS.slice(0, count).map((b) => (
        <span
          key={b.left}
          className="ds-radon-bubble"
          style={{ left: b.left, animationDuration: b.dur, animationDelay: b.delay }}
        />
      ))}
      {level === "bad" && <span className="ds-alert-symbol">!</span>}
      <SourceCharacter mood={mood} style={{ left: "40%", animation: "ds-bob 3s ease-in-out infinite" }}>
        <div className="ds-detector" />
      </SourceCharacter>
    </>
  );
}

const HOOD_BUILDING_SPECS = [
  { h: 14, win: false },
  { h: 22, win: true },
  { h: 12, win: false },
  { h: 19, win: true },
  { h: 16, win: true },
] as const;

function NeighborhoodSourceScene({ level }: { level: SourceDossierSceneLevel }) {
  const lively = level === "good";
  const mood: DossierRaccoonMood = lively ? "approved" : "happy";
  return (
    <>
      <div className="ds-radial" />
      <div className="ds-hood-skyline">
        {HOOD_BUILDING_SPECS.map((b, i) => (
          <div key={i} className="ds-hood-bld" style={{ height: b.h }}>
            {b.win && <span className="ds-hood-win" style={{ animationDelay: `${i * 0.5}s` }} />}
          </div>
        ))}
      </div>
      {lively && <div className="ds-walker" style={{ animation: "ds-stroll 11s linear infinite" }} />}
      <SourceCharacter mood={mood} style={{ left: "20%", animation: "ds-bob 3s ease-in-out infinite" }} />
    </>
  );
}

// Extended to 6 deterministic charge-node positions so the busiest sub-states
// (s3 "charging hub", s4 "EV paradise") can swarm with nodes. The first three
// match the original layout so the existing scene reads identically at low
// density; the latter three fan out around the charger.
const EV_NODE_SPECS = [
  { right: "40%", bottom: 30, delay: "0s" },
  { right: "52%", bottom: 22, delay: "-0.5s" },
  { right: "64%", bottom: 34, delay: "-1s" },
  { right: "46%", bottom: 42, delay: "-1.5s" },
  { right: "58%", bottom: 14, delay: "-0.8s" },
  { right: "70%", bottom: 26, delay: "-1.3s" },
] as const;

/**
 * EV METRIC + THRESHOLDS — chosen to give 5 GENUINELY distinct states.
 *
 * We bucket on `detail.evCount`, which is threaded from the row's UNCAPPED area
 * station count (NREL `total_results` → HomeDossierView.evCharging.totalResults
 * → the `evCount` detail). That count realistically spans 0..100+ and matches
 * the user's mental model of area density (0 / 1–20 / 20–40 / 40–60 / 60–80 /
 * 80–100), so the five sub-states map cleanly onto it:
 *
 *   s0  evCount === 0            "charging desert"  — empty post, raccoon snoozing
 *   s1  1–14                     "one lonely plug"  — 1 node, faint slow bolt
 *   s2  15–34                    "some juice"       — 2 nodes, steady bolt
 *   s3  35–69                    "charging hub"     — 4 nodes buzzing, bright bolt
 *   s4  70+                      "EV paradise"      — 6 nodes swarming, glow halo
 *
 * FALLBACK: when no detail is threaded (marketing showcase / legacy callers) we
 * derive the sub-state from the coarse level instead — bad→s0, mid→s2, good→s4
 * — so the scene still renders sensibly and the non-empty states keep showing
 * ds-ev-node / ds-ev-bolt for the guardrail tests. (We deliberately bucket on
 * the uncapped area count, NOT the API-limited `stationCount` which saturates
 * at ~20 and would collapse s3+s4 into one bucket for dense metros.)
 */
function evSubState(level: SourceDossierSceneLevel, detail?: SceneDetail): 0 | 1 | 2 | 3 | 4 {
  const count = detail?.evCount;
  if (typeof count === "number" && Number.isFinite(count)) {
    if (count <= 0) return 0;
    if (count < 15) return 1;
    if (count < 35) return 2;
    if (count < 70) return 3;
    return 4;
  }
  // No detail → map the coarse positive level onto the sub-state scale.
  return level === "good" ? 4 : level === "mid" ? 2 : 0;
}

const EV_SUBSTATE_NODES: Record<0 | 1 | 2 | 3 | 4, number> = { 0: 0, 1: 1, 2: 2, 3: 4, 4: 6 };

function EvSourceScene({ level, detail }: { level: SourceDossierSceneLevel; detail?: SceneDetail }) {
  const sub = evSubState(level, detail);
  const nodeCount = EV_SUBSTATE_NODES[sub];
  const active = sub > 0;
  // Mood escalates with density: desert → calm/snoozing, lonely/some → happy,
  // hub/paradise → approved.
  const mood: DossierRaccoonMood = sub >= 3 ? "approved" : sub >= 1 ? "happy" : "calm";
  return (
    <div className="ds-ev" data-ev-state={sub}>
      <div className="ds-radial" />
      {/* s4 paradise: a soft glow halo behind the charger. */}
      {sub >= 4 && <div className="ds-ev-halo" />}
      <div className="ds-charger" />
      {active && <span className="ds-ev-bolt" />}
      {EV_NODE_SPECS.slice(0, nodeCount).map((n, i) => (
        <span key={i} className="ds-ev-node" style={{ right: n.right, bottom: n.bottom, animationDelay: n.delay }} />
      ))}
      {/* s4 paradise: an extra spark sells the "swarming" peak. */}
      {sub >= 4 && <span className="ds-ev-spark">+</span>}
      <SourceCharacter mood={mood} style={{ left: "20%", animation: "ds-bob 3s ease-in-out infinite" }}>
        {/* s0 desert: a tiny sleepy "z" over the snoozing raccoon. */}
        {sub === 0 && <span className="ds-ev-zzz">z</span>}
      </SourceCharacter>
    </div>
  );
}

function SchoolSourceScene() {
  return (
    <>
      <div className="ds-schoolpath" />
      <div className="ds-flag" />
      <div className="ds-kid" style={{ left: "6%", animationDuration: "9s" }} />
      <div className="ds-kid" style={{ left: "6%", animationDuration: "11s", animationDelay: "-5s" }} />
      <SourceCharacter mood="happy" style={{ left: "46%", animation: "ds-bob 3s ease-in-out infinite" }}>
        <div className="ds-arm ds-wave-arm" style={{ right: 1, bottom: 12, transformOrigin: "left center" }} />
      </SourceCharacter>
    </>
  );
}

function AreaSourceScene({ level }: { level: SourceDossierSceneLevel }) {
  if (level === "bad") {
    return (
      <>
        <div className="ds-ground ds-ground-dark" />
        <div className="ds-dark-wash" />
        <div className="ds-flicker" />
        <span className="ds-alert-symbol ds-alert-right">!</span>
        <div className="ds-chase-pack">
          <SourceCharacter mood="alert" size={26} style={{ left: 0, bottom: 0, animation: "ds-run .32s ease-in-out infinite" }} />
          <div className="ds-shadow-runner" />
          <div className="ds-shadow-runner ds-shadow-runner-b" />
        </div>
      </>
    );
  }
  if (level === "mid") {
    return (
      <>
        <div className="ds-ground" />
        <div className="ds-streetlight" />
        <div className="ds-lamp-glow" />
        <SourceCharacter
          mood="thinking"
          style={{ left: "28%", animation: "ds-bob 2.2s ease-in-out infinite" }}
          headStyle={{ transformOrigin: "bottom center", animation: "ds-look 3.2s ease-in-out infinite" }}
        />
      </>
    );
  }
  return (
    <>
      <div className="ds-ground" />
      <div className="ds-streetlight" />
      <div className="ds-lamp-glow" />
      <MiniVehicle variant="bus" />
      <SourceCharacter mood="approved" style={{ left: "30%", animation: "ds-bob 3s ease-in-out infinite" }}>
        <div className="ds-badge" />
      </SourceCharacter>
    </>
  );
}

function CostSourceScene({ level }: { level: SourceDossierSceneLevel }) {
  if (level === "good") {
    return (
      <>
        <div className="ds-radial" />
        <span className="ds-dollar">$</span>
        <SourceCharacter mood="happy" style={{ left: "40%", animation: "ds-bob 2.8s ease-in-out infinite" }}>
          <div className="ds-arm" style={{ right: -4, bottom: 14, transform: "rotate(-34deg)", transformOrigin: "left center" }} />
        </SourceCharacter>
      </>
    );
  }
  return (
    <>
      <div className="ds-amber-bg" />
      <span className="ds-price-arrow">↑</span>
      <div className="ds-bill-stack" />
      <SourceCharacter mood="alert" style={{ left: "24%" }} bodyStyle={{ transformOrigin: "bottom center", animation: "ds-tug 1.4s ease-in-out infinite" }}>
        <div className="ds-arm" style={{ right: -4, bottom: 13, transform: "rotate(-46deg)", transformOrigin: "left center" }} />
        <span className="ds-sweat" />
      </SourceCharacter>
    </>
  );
}

function HousingSourceScene() {
  return (
    <>
      <div className="ds-ground" />
      <div className="ds-house-row">
        {[0, 1, 2].map((i) => (
          <div key={i} className="ds-house" style={{ left: `${i * 34}%`, animationDelay: `${i * 0.4}s` }}>
            <div className="ds-house-roof" />
            <div className="ds-house-body" />
            <div className="ds-house-window" />
          </div>
        ))}
      </div>
      <div className="ds-key-post" />
      <SourceCharacter mood="happy" style={{ left: "14%", animation: "ds-bob 3s ease-in-out infinite" }}>
        <div className="ds-arm" style={{ right: -4, bottom: 13, transform: "rotate(-30deg)", transformOrigin: "left center" }} />
        <div className="ds-key" />
      </SourceCharacter>
    </>
  );
}

function WeatherSourceScene({ level }: { level: SourceDossierSceneLevel }) {
  switch (level) {
    case "rain":
      return (
        <>
          <div className="ds-cloud ds-cloud-rain" />
          {[20, 36, 78, 90].map((left, i) => (
            <span key={left} className="ds-rain" style={{ left: `${left}%`, animationDelay: `${i * 0.18}s` }} />
          ))}
          <SourceCharacter mood="calm" style={{ left: "28%", animation: "ds-bob 3s ease-in-out infinite" }}>
            <div className="ds-arm" style={{ right: -3, bottom: 14, transform: "rotate(-44deg)", transformOrigin: "left center" }} />
          </SourceCharacter>
          <div className="ds-umbrella"><span /></div>
        </>
      );
    case "snow":
      return (
        <>
          <div className="ds-snow-bg" />
          {[18, 40, 62, 82].map((left, i) => (
            <span key={left} className="ds-snow" style={{ left: `${left}%`, animationDelay: `${i * 0.45}s` }} />
          ))}
          <div className="ds-snowman" />
          <SourceCharacter mood="thinking" style={{ left: "24%", animation: "ds-shiver .25s ease-in-out infinite" }}>
            <div className="ds-scarf" />
          </SourceCharacter>
        </>
      );
    case "storm":
      return (
        <>
          <div className="ds-flash" />
          <div className="ds-cloud ds-cloud-storm" />
          {[22, 42, 72].map((left, i) => (
            <span key={left} className="ds-rain ds-rain-hard" style={{ left: `${left}%`, animationDelay: `${i * 0.2}s` }} />
          ))}
          <svg className="ds-lightning" viewBox="0 0 20 30"><path d="M11 0 L3 17 L9 16 L6 30 L18 11 L11 12 Z" /></svg>
          <SourceCharacter mood="alert" style={{ left: "24%", animation: "ds-shiver .2s ease-in-out infinite" }}>
            <div className="ds-arm" style={{ right: -3, bottom: 15, transform: "rotate(-44deg)", transformOrigin: "left center" }} />
          </SourceCharacter>
        </>
      );
    case "fog":
      return (
        <>
          <div className="ds-fog-bg" />
          {[16, 34, 52].map((top, i) => (
            <div key={top} className="ds-fogband" style={{ top, animationDelay: `${i * 0.4}s` }} />
          ))}
          <span className="ds-warning-triangle">!</span>
          <SourceCharacter mood="thinking" style={{ left: "32%", animation: "ds-bob 3.4s ease-in-out infinite" }} headChildren={<div className="ds-shades" />}>
            <div className="ds-arm" style={{ right: -2, bottom: 12, transform: "rotate(-30deg)", transformOrigin: "left center" }} />
            <div className="ds-cane" />
          </SourceCharacter>
        </>
      );
    case "wind":
      return (
        <>
          {[20, 34, 48].map((top, i) => (
            <div key={top} className="ds-streak" style={{ top, animationDelay: `${i * 0.35}s` }} />
          ))}
          <span className="ds-leaf ds-leaf-wind" />
          <SourceCharacter mood="alert" style={{ left: "34%", animation: "ds-lean 1.4s ease-in-out infinite", transformOrigin: "bottom center" }}>
            <div className="ds-arm" style={{ right: -4, bottom: 18, transform: "rotate(-58deg)", transformOrigin: "left center" }} />
          </SourceCharacter>
        </>
      );
    case "heat":
      return (
        <>
          <div className="ds-hot-sun" />
          {[30, 50].map((left, i) => (
            <div key={left} className="ds-heatline" style={{ left: `${left}%`, animationDelay: `${i * 0.6}s` }} />
          ))}
          <div className="ds-ac" />
          <span className="ds-impact">*</span>
          <SourceCharacter mood="alert" style={{ left: "22%", animation: "ds-bob 2.6s ease-in-out infinite" }}>
            <div className="ds-kick-leg" />
            <span className="ds-sweat" />
          </SourceCharacter>
        </>
      );
    case "cold":
      return (
        <>
          <div className="ds-cold-bg" />
          <SourceCharacter mood="thinking" style={{ left: "32%", animation: "ds-shiver .22s ease-in-out infinite" }}>
            <span className="ds-breath" />
            <div className="ds-scarf" />
            <div className="ds-arm" style={{ left: 0, bottom: 9, transform: "rotate(34deg)", transformOrigin: "right center" }} />
            <div className="ds-arm" style={{ right: 0, bottom: 9, transform: "rotate(-34deg)", transformOrigin: "left center" }} />
          </SourceCharacter>
        </>
      );
    case "sun":
      return (
        <>
          <div className="ds-sun-rays" />
          <div className="ds-sun-core" />
          <SourceCharacter mood="approved" size={30} style={{ left: "26%", animation: "ds-bob 3.2s ease-in-out infinite" }} />
        </>
      );
    case "cloud":
    default:
      return (
        <>
          <div className="ds-cloud ds-cloud-a" />
          <div className="ds-cloud ds-cloud-b" />
          <SourceCharacter mood="calm" size={30} style={{ left: "24%", animation: "ds-bob 3.2s ease-in-out infinite" }} />
        </>
      );
  }
}

function SourceDossierScene({ scene }: { scene: SourceDossierSceneSpec }) {
  return (
    <div className="ds-root" data-ds-type={scene.type} data-ds-level={scene.level} style={sourceSceneVars(scene)}>
      {scene.type === "transit" && <TransitSourceScene level={scene.level} />}
      {scene.type === "air" && <AirSourceScene level={scene.level} detail={scene.detail} />}
      {scene.type === "water" && <WaterSourceScene level={scene.level} />}
      {scene.type === "flood" && <FloodSourceScene level={scene.level} />}
      {scene.type === "radon" && <RadonSourceScene level={scene.level} />}
      {scene.type === "school" && <SchoolSourceScene />}
      {scene.type === "hood" && <NeighborhoodSourceScene level={scene.level} />}
      {scene.type === "ev" && <EvSourceScene level={scene.level} detail={scene.detail} />}
      {scene.type === "area" && <AreaSourceScene level={scene.level} />}
      {scene.type === "cost" && <CostSourceScene level={scene.level} />}
      {scene.type === "housing" && <HousingSourceScene />}
      {scene.type === "weather" && <WeatherSourceScene level={scene.level} />}
    </div>
  );
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
function useAmbientPause(enabled = true): MutableRefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const node = ref.current;
    if (!enabled) {
      node?.classList.remove("da-paused");
      return;
    }
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      node.classList.toggle("da-paused", !entry?.isIntersecting);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled]);
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
  detail,
  showTag = true,
  pauseOffscreen = true,
}: {
  kind: AmbientKind;
  intensity: number;
  variant?: AmbientVariant;
  /**
   * Optional raw-narration payload (EV count / AQI). ADDITIVE only: it enriches
   * the in-scene visual without altering the 0|1|2 intensity contract or any of
   * the data-* attributes. Omit it (marketing showcase) and the scene falls
   * back to the level-based rendering.
   */
  detail?: SceneDetail;
  showTag?: boolean;
  pauseOffscreen?: boolean;
}) {
  const ref = useAmbientPause(pauseOffscreen);
  const level = clampIntensity(intensity);
  const sourceScene = sourceDossierSceneFor({ kind, intensity: level, variant }, detail);
  const sourceSceneStyle = sourceSceneVars(sourceScene);
  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-kind={kind}
      data-intensity={level}
      data-pause-offscreen={pauseOffscreen ? "true" : "false"}
      data-source-type={sourceScene.type}
      data-source-level={sourceScene.level}
      data-variant={variant}
      // Keep the scene on a visible foreground plane; globals.css masks it to
      // the right side and lifts row copy above it.
      style={{ zIndex: 0, ...sourceSceneStyle }}
      className="da-layer pointer-events-none absolute inset-y-0 right-0 w-[72%] overflow-hidden rounded-r-xl"
    >
      {showTag && <span className="lf-dossier-scene-tag">{sourceSceneTag(sourceScene)}</span>}
      <SourceDossierScene scene={sourceScene} />
    </div>
  );
}
