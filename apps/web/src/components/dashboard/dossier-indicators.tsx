"use client";

import { useEffect, useRef } from "react";
import { METEOCONS_FILL, type MeteoconsKey } from "./meteocons-data";

/**
 * Foreground dossier indicators for the AIR and EV rows.
 *
 * These replace the decorative <DossierAmbient> raccoon scenes for those two
 * sections only: an AQI gauge and an EV density meter that read the data state
 * at a glance. They are foreground content (not a masked background ambient),
 * so they must be fully visible and legible — no overflow mask, no absolute
 * positioning behind the row text.
 *
 * Constraints:
 *  - Dependency-free (inline SVG/divs), so they render under the static test
 *    renderer and in SSR with no client libs.
 *  - Tuned for the LIGHT theme (the app's default target).
 *  - prefers-reduced-motion safe: no essential information is conveyed by
 *    motion (there is no motion here — the state is fully static).
 *  - Defensive: a null AQI falls back to the category band (or a muted "—"
 *    "No reading" state); a null EV count renders the 0 / "Charging desert"
 *    state. Neither ever throws.
 *
 * Promoted, unchanged in spirit, from the approved /dev/dossier-preview
 * prototype (AqiGauge, EvMeter, aqiBand).
 */

/* ----------------------------- shared tokens ------------------------------ */

const INK = "#0b1422";
const MUTED = "#5a6478";
const FAINT = "#94a0b4";
const ACCENT = "#2563eb";

/* ------------------------------- AQI gauge -------------------------------- */

const AQI_COLORS = ["#16a34a", "#ca8a04", "#ea580c", "#dc2626", "#7c3aed", "#881337"];
const AQI_RANGES: [number, number][] = [
  [0, 50],
  [51, 100],
  [101, 150],
  [151, 200],
  [201, 300],
  [301, 500],
];
const AQI_LABELS = ["Good", "Moderate", "Unhealthy (sensitive)", "Unhealthy", "Very unhealthy", "Hazardous"];
/** Stable band keys for test hooks / styling — index-aligned with the arrays above. */
const AQI_BANDS = ["good", "moderate", "unhealthy_sensitive", "unhealthy", "very_unhealthy", "hazardous"] as const;
type AqiBandKey = (typeof AQI_BANDS)[number];

export interface AqiBand {
  i: number;
  band: AqiBandKey;
  label: string;
  color: string;
}

/** Map a numeric AQI to its EPA band (index, band key, label, color). */
export function aqiBand(aqi: number): AqiBand {
  const i = aqi <= 50 ? 0 : aqi <= 100 ? 1 : aqi <= 150 ? 2 : aqi <= 200 ? 3 : aqi <= 300 ? 4 : 5;
  return { i, band: AQI_BANDS[i], label: AQI_LABELS[i], color: AQI_COLORS[i] };
}

/**
 * Best-effort band from an AirNow category string when no numeric AQI is
 * present (e.g. the API returned a category only). Returns null when the
 * string doesn't map to a known band, so the caller renders the muted state.
 */
function bandFromCategory(category: string | null | undefined): AqiBand | null {
  if (typeof category !== "string") return null;
  const c = category.trim().toLowerCase();
  if (!c) return null;
  if (c.includes("hazard")) return bandAt(5);
  if (c.includes("very") && c.includes("unhealthy")) return bandAt(4);
  if (c.includes("sensitive")) return bandAt(2);
  if (c.includes("unhealthy")) return bandAt(3);
  if (c.includes("moderate")) return bandAt(1);
  if (c.includes("good")) return bandAt(0);
  return null;
}

function bandAt(i: number): AqiBand {
  return { i, band: AQI_BANDS[i], label: AQI_LABELS[i], color: AQI_COLORS[i] };
}

export function AqiGauge({ aqi, category }: { aqi: number | null; category?: string | null }) {
  const hasReading = typeof aqi === "number" && Number.isFinite(aqi);
  const band = hasReading ? aqiBand(aqi as number) : bandFromCategory(category);

  // No numeric reading AND no recognizable category → muted "no reading" state.
  if (!band) {
    return (
      <div
        data-testid="aqi-gauge"
        data-aqi-band="none"
        style={{ width: "100%" }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, justifyContent: "flex-end", marginBottom: 8 }}>
          <span style={{ fontSize: 30, fontWeight: 800, lineHeight: 1, color: FAINT }}>—</span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: MUTED }}>No reading</span>
        </div>
        <div style={{ display: "flex", height: 9, borderRadius: 6, overflow: "hidden" }}>
          {AQI_COLORS.map((c, i) => (
            <span key={i} style={{ flex: 1, background: c, opacity: 0.18 }} />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: FAINT, marginTop: 6 }}>
          <span>0</span>
          <span>AQI</span>
          <span>300+</span>
        </div>
      </div>
    );
  }

  const [lo, hi] = AQI_RANGES[band.i];
  // With a numeric AQI we can place the marker precisely within the band;
  // category-only readings sit at the band's midpoint (no false precision).
  const within = hasReading ? Math.min(Math.max((Math.min(aqi as number, hi) - lo) / (hi - lo), 0), 1) : 0.5;
  const pos = ((band.i + within) / 6) * 100;

  return (
    <div data-testid="aqi-gauge" data-aqi-band={band.band} style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, justifyContent: "flex-end", marginBottom: 8 }}>
        {hasReading && (
          <span
            style={{ fontSize: 30, fontWeight: 800, lineHeight: 1, color: band.color, fontVariantNumeric: "tabular-nums" }}
          >
            {aqi}
          </span>
        )}
        <span style={{ fontSize: 12.5, fontWeight: 700, color: band.color }}>{band.label}</span>
      </div>
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", height: 9, borderRadius: 6, overflow: "hidden" }}>
          {AQI_COLORS.map((c, i) => (
            <span key={i} style={{ flex: 1, background: c, opacity: i === band.i ? 1 : 0.28 }} />
          ))}
        </div>
        <span
          style={{
            position: "absolute",
            top: -3,
            left: `${pos}%`,
            transform: "translateX(-50%)",
            width: 3,
            height: 15,
            borderRadius: 2,
            background: INK,
            boxShadow: "0 0 0 2px #fff",
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: FAINT, marginTop: 6 }}>
        <span>0</span>
        <span>AQI</span>
        <span>300+</span>
      </div>
    </div>
  );
}

/* ------------------------------- EV meter --------------------------------- */

const EV_LABELS = ["Charging desert", "Barely any", "Getting there", "Solid network", "Great coverage", "EV paradise"];

/** Filled bars for a station count (user's ~20-per-bucket mental model). */
export function evMeterBars(count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.min(Math.ceil(count / 20), 5);
}

export function EvMeter({ count }: { count: number | null }) {
  const safeCount = typeof count === "number" && Number.isFinite(count) && count > 0 ? Math.round(count) : 0;
  const bars = evMeterBars(safeCount);
  const dead = safeCount === 0;
  const tone = dead ? FAINT : ACCENT;
  return (
    <div data-testid="ev-meter" data-ev-bars={bars} style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, justifyContent: "flex-end", marginBottom: 8 }}>
        <span style={{ fontSize: 30, fontWeight: 800, lineHeight: 1, color: tone, fontVariantNumeric: "tabular-nums" }}>
          {safeCount}
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: MUTED }}>stations</span>
      </div>
      <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            style={{
              width: 24,
              height: 16,
              borderRadius: 4,
              background: i < bars ? ACCENT : "#e6eaf1",
              opacity: i < bars ? 0.55 + 0.09 * i : 1,
            }}
          />
        ))}
      </div>
      <div style={{ textAlign: "right", fontSize: 12.5, fontWeight: 700, color: tone, marginTop: 8 }}>
        {EV_LABELS[bars]}
      </div>
    </div>
  );
}

/* ----------------------------- weather glyph ------------------------------ */

/**
 * Foreground Meteocons weather glyph for the dossier WEATHER row — the same
 * clean-indicator direction as AqiGauge / EvMeter (a legible, animated mark in
 * place of the decorative masked ambient scene).
 *
 * The weather ambient `variant` (sun|cloud|rain|snow|storm|fog|wind|heat|cold,
 * from ambientForSection) maps to a Meteocons "fill" icon; null/unknown falls
 * back to a sensible clear-day default. The icons are SMIL-animated SVGs
 * inlined verbatim (see meteocons-data.ts) — SMIL plays when the markup is in
 * the DOM, which a plain <img src> would not do, so we inject the raw string.
 *
 * prefers-reduced-motion: no information is conveyed by motion (the variant is
 * the signal, identical when frozen), so we freeze the SVG's SMIL timeline via
 * the SVG DOM `pauseAnimations()` after mount. SSR / no-JS render the first
 * animation frame statically, which is already a complete, legible icon.
 */
const WEATHER_VARIANT_ICON: Record<string, MeteoconsKey> = {
  sun: "clearDay",
  cloud: "cloudy",
  rain: "rain",
  snow: "snow",
  storm: "thunderstormsRain",
  fog: "fog",
  wind: "wind",
  heat: "thermometerWarmer",
  cold: "thermometerColder",
};

const WEATHER_DEFAULT_ICON: MeteoconsKey = "clearDay";

/** Resolve a weather ambient variant to its Meteocons icon key (default: clear-day). */
export function weatherGlyphIconKey(variant: string | null | undefined): MeteoconsKey {
  return (typeof variant === "string" && WEATHER_VARIANT_ICON[variant]) || WEATHER_DEFAULT_ICON;
}

export function WeatherGlyph({ variant, size = 56 }: { variant?: string | null; size?: number }) {
  const iconKey = weatherGlyphIconKey(variant);
  // The markup is a static, build-time-embedded Meteocons SVG (vendored MIT
  // asset, never user input) — dangerouslySetInnerHTML carries no XSS surface.
  const svg = METEOCONS_FILL[iconKey];
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) return;
    // Freeze the SMIL timeline at its first frame — the icon stays a complete,
    // legible mark; no essential meaning is lost (the variant is the signal).
    const el = ref.current?.querySelector("svg") as (SVGSVGElement & { pauseAnimations?: () => void }) | null;
    if (el && typeof el.pauseAnimations === "function") {
      el.setCurrentTime?.(0);
      el.pauseAnimations();
    }
  }, [iconKey]);

  return (
    <div
      data-testid="weather-glyph"
      data-weather-variant={typeof variant === "string" && variant ? variant : "default"}
      data-weather-icon={iconKey}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", minHeight: size }}
    >
      <span
        ref={ref}
        aria-hidden="true"
        style={{ display: "inline-flex", width: size, height: size, lineHeight: 0 }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}
