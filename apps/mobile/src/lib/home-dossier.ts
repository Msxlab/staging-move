// Pure presentation logic for the mobile "New Home Dossier" card
// (src/components/ui/HomeDossierCard.tsx). Kept free of react-native imports
// so it can be unit-tested under the node vitest environment, mirroring the
// graceful-degradation style of apps/web/src/lib/fcc-isp.ts: status unions in,
// render-or-hide decisions out, never a throw in the user path.
//
// HERMES NOTE: no Intl.RelativeTimeFormat / ListFormat / PluralRules here.
// Date labels use Date#toLocaleDateString, which the app already relies on.

/** Section statuses from GET /api/addresses/{id}/dossier (shared contract). */
export type DossierSectionStatus = "ok" | "no_location" | "error";
export type DossierWeatherStatus = "ok" | "no_location" | "too_far" | "error";

export interface HomeDossierResponse {
  configured: boolean;
  address: { id: string; city: string; state: string };
  flood: {
    status: DossierSectionStatus;
    zone: string | null;
    isHighRisk: boolean | null;
  };
  school: {
    status: DossierSectionStatus;
    districtName: string | null;
    ncesId: string | null;
  };
  weather: {
    status: DossierWeatherStatus;
    forecastDate: string | null;
    summary: string | null;
    tempHighF: number | null;
    tempLowF: number | null;
    precipChancePct: number | null;
  };
}

export interface FloodRow {
  zone: string;
  isHighRisk: boolean;
}

export interface SchoolRow {
  districtName: string;
  ncesId: string | null;
}

export interface WeatherRow {
  forecastDate: string | null;
  summary: string | null;
  /** Rounded integer temps; null when the API had no reading. */
  tempHighF: number | null;
  tempLowF: number | null;
  /** Clamped 0–100 integer; null when the API had no reading. */
  precipChancePct: number | null;
}

export interface HomeDossierRows {
  flood: FloodRow | null;
  school: SchoolRow | null;
  weather: WeatherRow | null;
  /** False ⇒ the card renders nothing at all. */
  hasContent: boolean;
}

const EMPTY_ROWS: HomeDossierRows = {
  flood: null,
  school: null,
  weather: null,
  hasContent: false,
};

function nonEmpty(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Round a Fahrenheit reading to a whole degree; null for absent/invalid. */
export function roundTemp(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value);
}

/** Clamp a precipitation chance to an integer 0–100; null for absent/invalid. */
export function clampPct(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/**
 * Flood row renders only when FEMA answered with a concrete zone. A missing
 * location, an upstream error, or a null zone all hide the row — never an
 * error state in the card (fail-open, the move plan is the primary content).
 */
export function getFloodRow(d: HomeDossierResponse): FloodRow | null {
  if (d.flood.status !== "ok" || !nonEmpty(d.flood.zone)) return null;
  return { zone: d.flood.zone.trim(), isHighRisk: d.flood.isHighRisk === true };
}

/** School row renders only with a concrete district name from NCES data. */
export function getSchoolRow(d: HomeDossierResponse): SchoolRow | null {
  if (d.school.status !== "ok" || !nonEmpty(d.school.districtName)) return null;
  return {
    districtName: d.school.districtName.trim(),
    ncesId: nonEmpty(d.school.ncesId) ? d.school.ncesId.trim() : null,
  };
}

/**
 * Weather row renders only when the forecast window applies (status "ok" —
 * the server already enforces "moveDate within 7 days AND this address is the
 * destination"; "too_far" stays hidden) AND there is something honest to show:
 * a summary or a complete high/low pair. A lone temperature renders nothing.
 */
export function getWeatherRow(d: HomeDossierResponse): WeatherRow | null {
  if (d.weather.status !== "ok") return null;
  const high = roundTemp(d.weather.tempHighF);
  const low = roundTemp(d.weather.tempLowF);
  const hasTempPair = high !== null && low !== null;
  if (!nonEmpty(d.weather.summary) && !hasTempPair) return null;
  return {
    forecastDate: nonEmpty(d.weather.forecastDate) ? d.weather.forecastDate : null,
    summary: nonEmpty(d.weather.summary) ? d.weather.summary.trim() : null,
    tempHighF: hasTempPair ? high : null,
    tempLowF: hasTempPair ? low : null,
    precipChancePct: clampPct(d.weather.precipChancePct),
  };
}

/**
 * Build the card's render model from a dossier response. Tolerates null /
 * undefined / unconfigured payloads by returning "render nothing" — the card
 * disappears rather than erroring (offline, 404, half-rolled-out server).
 */
export function deriveHomeDossier(
  dossier: HomeDossierResponse | null | undefined,
): HomeDossierRows {
  if (!dossier || dossier.configured !== true) return EMPTY_ROWS;
  if (!dossier.flood || !dossier.school || !dossier.weather) return EMPTY_ROWS;
  const flood = getFloodRow(dossier);
  const school = getSchoolRow(dossier);
  const weather = getWeatherRow(dossier);
  return {
    flood,
    school,
    weather,
    hasContent: Boolean(flood || school || weather),
  };
}

/**
 * Format the forecast date ("YYYY-MM-DD" or ISO datetime) as a short local
 * label, e.g. "Fri, Jun 12". Date-only strings are parsed as LOCAL calendar
 * dates — `new Date("2026-06-12")` would parse UTC midnight and can render
 * the previous day west of Greenwich. Returns null when unparseable so the
 * caller simply omits the label.
 */
export function formatForecastDate(
  value: string | null | undefined,
  locale: string,
): string | null {
  if (!nonEmpty(value)) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return date.toLocaleDateString(locale, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    // Defensive: an invalid locale tag must not crash the card.
    return null;
  }
}
