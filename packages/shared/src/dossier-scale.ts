/**
 * DossierScale — turns each dossier parameter's real API value into a uniform
 * 5-level result that drives the 5-segment scale, the Lottie character segment,
 * the narration line, and the data number. Pure + framework-free so web and
 * mobile share one source of truth. See
 * docs/superpowers/specs/2026-06-26-dossier-scale-design.md.
 *
 * Honesty: the score is a documented derivation of the real source data; the
 * level is its quintile (or a native band). Missing data returns
 * `available: false` rather than a faked level.
 */

export type DossierLevel = 1 | 2 | 3 | 4 | 5;

export interface DossierScaleResult {
  /** False when the source had no usable reading (no_location / error / degraded). */
  available: boolean;
  level: DossierLevel;
  /** 0-100, for the segment fill + any continuous needle. */
  score: number;
  /** Short data figure for the card chip, e.g. "AQI 75" or "Zone AE". */
  displayValue: string;
  /** Human band name, e.g. "Moderate". */
  bandLabel: string;
  /** i18n key for the narration line (tone gradient per level). */
  narrationKey: string;
  /** i18n key for the mandatory source caveat. */
  caveatKey: string;
  /** Optional categorical type (weather only) for the Lottie/Meteocons glyph. */
  typeKey?: string;
}

const clamp = (n: number, lo = 0, hi = 100): number => Math.max(lo, Math.min(hi, n));

const levelFromScore = (s: number): DossierLevel =>
  (s < 20 ? 1 : s < 40 ? 2 : s < 60 ? 3 : s < 80 ? 4 : 5) as DossierLevel;

function unavailable(narrationKey: string, caveatKey: string): DossierScaleResult {
  return {
    available: false,
    level: 1,
    score: 0,
    displayValue: "—",
    bandLabel: "No data",
    narrationKey,
    caveatKey,
  };
}

const AIR_BANDS = ["Good", "Moderate", "Sensitive", "Unhealthy", "Hazardous"] as const;

/** AirNow AQI (0-500+) → EPA bands → 5 levels. */
export function scoreForAir(input: { aqi: number | null }): DossierScaleResult {
  const { aqi } = input;
  if (aqi == null || Number.isNaN(aqi)) {
    return unavailable("dossier.air.unavailable", "dossier.air.caveat");
  }
  const level: DossierLevel = aqi <= 50 ? 1 : aqi <= 100 ? 2 : aqi <= 150 ? 3 : aqi <= 200 ? 4 : 5;
  return {
    available: true,
    level,
    score: clamp(Math.round(aqi / 2)),
    displayValue: `AQI ${Math.round(aqi)}`,
    bandLabel: AIR_BANDS[level - 1],
    narrationKey: `dossier.air.l${level}`,
    caveatKey: "dossier.air.caveat",
  };
}

const FLOOD_BANDS = ["Minimal", "Low", "Moderate", "High", "Very high"] as const;

/**
 * FEMA flood zone (categorical) → documented risk score → 5 levels.
 * Rubric is intentionally explicit (zones are not natively ordinal). Falls back
 * to the isHighRisk flag when the precise zone is unknown.
 */
export function scoreForFlood(input: { zone: string | null; isHighRisk: boolean | null }): DossierScaleResult {
  const zone = (input.zone || "").toUpperCase();
  let score: number | null = null;
  if (zone === "X" || zone === "D" || zone === "C" || zone === "B") score = 10;
  else if (zone === "AH" || zone === "AO") score = 50;
  else if (zone === "A" || zone === "AE" || zone === "AR" || zone === "A99") score = 75;
  else if (zone === "V" || zone === "VE") score = 95;
  else if (input.isHighRisk === true) score = 75;
  else if (input.isHighRisk === false) score = 10;

  if (score == null) {
    return unavailable("dossier.flood.unavailable", "dossier.flood.caveat");
  }
  const level = levelFromScore(score);
  return {
    available: true,
    level,
    score,
    displayValue: input.zone
      ? `Zone ${input.zone}`
      : input.isHighRisk
        ? "High-risk zone"
        : "Low-risk zone",
    bandLabel: FLOOD_BANDS[level - 1],
    narrationKey: `dossier.flood.l${level}`,
    caveatKey: "dossier.flood.caveat",
  };
}

const WEATHER_BANDS = ["Clear", "Mild", "Watch", "Rough", "Severe"] as const;
const WEATHER_BASE: Record<string, number> = {
  sun: 0,
  cloud: 10,
  fog: 35,
  wind: 40,
  rain: 45,
  snow: 70,
  storm: 85,
};

function weatherType(summary: string): string {
  const s = summary.toLowerCase();
  if (/storm|thunder/.test(s)) return "storm";
  if (/snow|blizzard|sleet|ice/.test(s)) return "snow";
  if (/rain|shower|drizzle/.test(s)) return "rain";
  if (/fog|haze|smoke/.test(s)) return "fog";
  if (/wind|gust/.test(s)) return "wind";
  if (/cloud|overcast/.test(s)) return "cloud";
  return "sun";
}

/**
 * NWS move-day forecast → a "moving-day disruption" score (0-100) → 5 levels,
 * plus a categorical `typeKey` for the weather glyph. The score blends the
 * condition keyword, precipitation chance, and temperature extremity.
 */
export function scoreForWeather(input: {
  summary: string | null;
  precipChancePct: number | null;
  tempHighF: number | null;
  tempLowF: number | null;
}): DossierScaleResult {
  const { summary, precipChancePct, tempHighF, tempLowF } = input;
  if (!summary && precipChancePct == null && tempHighF == null && tempLowF == null) {
    return unavailable("dossier.weather.unavailable", "dossier.weather.caveat");
  }
  const type = weatherType(summary || "");
  let score = WEATHER_BASE[type] ?? 0;
  if (precipChancePct != null) score += precipChancePct * 0.3;
  if ((tempHighF != null && tempHighF >= 100) || (tempLowF != null && tempLowF <= 25)) score += 25;
  else if ((tempHighF != null && tempHighF >= 95) || (tempLowF != null && tempLowF <= 32)) score += 12;
  score = clamp(Math.round(score));
  const level = levelFromScore(score);
  const temps =
    tempHighF != null ? `${Math.round(tempHighF)}°/${tempLowF != null ? Math.round(tempLowF) : "—"}°` : "";
  return {
    available: true,
    level,
    score,
    displayValue: [summary, temps].filter(Boolean).join(" · ") || WEATHER_BANDS[level - 1],
    bandLabel: WEATHER_BANDS[level - 1],
    narrationKey: `dossier.weather.l${level}`,
    caveatKey: "dossier.weather.caveat",
    typeKey: type,
  };
}
