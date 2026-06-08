/**
 * User-timezone resolution + display formatting for emails, notifications,
 * and reminders.
 *
 * LocateFlow is US-only. Stored timestamps stay UTC; only DISPLAY is localized.
 * The bug this fixes: user-facing date/time strings were produced with
 * `Date.prototype.toLocaleString` WITHOUT an explicit `timeZone`, so they
 * inherited the Node process-local timezone of whatever box rendered them
 * (e.g. an owner testing from Turkey saw Europe/Istanbul times). Every
 * user-facing render must pass an EXPLICIT US `timeZone`.
 *
 * Resolution rule (priority order):
 *   (a) the user's own stored profile timezone, if valid;
 *   (b) else derive from their primary-address STATE via STATE_TIME_ZONE;
 *   (c) else default to America/New_York (Eastern).
 *
 * Two value classes are handled separately because they format differently:
 *   - True timestamps (created-at, "now", renewal instants): render in the
 *     user's resolved zone with `formatInUserTimeZone`.
 *   - Date-only values stored at UTC midnight (moveDate, dueDate,
 *     contractEndDate, billing days): render with `formatDateOnlyUtc` so the
 *     calendar day NEVER shifts across zones. Resolving a user zone for these
 *     is wrong — UTC-midnight in a US zone is the *previous* evening, which
 *     would render the day before.
 */

/** App-wide fallback when no user timezone and no state mapping is available. */
export const DEFAULT_US_TIME_ZONE = "America/New_York";

/**
 * US state / territory (2-letter) → predominant IANA timezone.
 * States that span multiple zones map to the zone covering the larger share of
 * population (e.g. FL/MI/KY/TN → Eastern; ND/SD/NE/KS/TX → Central; ID/OR →
 * the zone holding the metro areas). Display-only, so the predominant-zone
 * approximation is acceptable; the user's own profile timezone always wins
 * when set.
 */
export const STATE_TIME_ZONE: Record<string, string> = {
  AL: "America/Chicago",
  AK: "America/Anchorage",
  AZ: "America/Phoenix", // no DST
  AR: "America/Chicago",
  CA: "America/Los_Angeles",
  CO: "America/Denver",
  CT: "America/New_York",
  DE: "America/New_York",
  DC: "America/New_York",
  FL: "America/New_York", // panhandle is Central; peninsula (most pop.) Eastern
  GA: "America/New_York",
  HI: "Pacific/Honolulu",
  ID: "America/Boise", // north panhandle is Pacific; most pop. Mountain
  IL: "America/Chicago",
  IN: "America/Indiana/Indianapolis",
  IA: "America/Chicago",
  KS: "America/Chicago", // far west is Mountain
  KY: "America/New_York", // west (Louisville is Eastern) — Eastern predominant
  LA: "America/Chicago",
  ME: "America/New_York",
  MD: "America/New_York",
  MA: "America/New_York",
  MI: "America/New_York", // four UP counties are Central
  MN: "America/Chicago",
  MS: "America/Chicago",
  MO: "America/Chicago",
  MT: "America/Denver",
  NE: "America/Chicago", // panhandle is Mountain
  NV: "America/Los_Angeles", // West Wendover is Mountain
  NH: "America/New_York",
  NJ: "America/New_York",
  NM: "America/Denver",
  NY: "America/New_York",
  NC: "America/New_York",
  ND: "America/Chicago", // southwest is Mountain
  OH: "America/New_York",
  OK: "America/Chicago",
  OR: "America/Los_Angeles", // most of Malheur County is Mountain
  PA: "America/New_York",
  RI: "America/New_York",
  SC: "America/New_York",
  SD: "America/Chicago", // west river is Mountain
  TN: "America/Chicago", // east TN (Knoxville) is Eastern; most pop. Central
  TX: "America/Chicago", // far west (El Paso) is Mountain
  UT: "America/Denver",
  VT: "America/New_York",
  VA: "America/New_York",
  WA: "America/Los_Angeles",
  WV: "America/New_York",
  WI: "America/Chicago",
  WY: "America/Denver",
  // Territories
  PR: "America/Puerto_Rico",
  VI: "America/Puerto_Rico",
  GU: "Pacific/Guam",
  AS: "Pacific/Pago_Pago",
  MP: "Pacific/Guam",
};

/** True if `tz` is an IANA zone the runtime's Intl can format with. */
export function isValidTimeZone(tz?: string | null): boolean {
  if (!tz) return false;
  try {
    // Throws RangeError for an unknown/invalid timezone.
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve the US timezone to render a given user's dates in.
 *   1. `timezone` (the user's stored profile timezone) if valid;
 *   2. else the predominant zone for `state` (2-letter, case-insensitive);
 *   3. else America/New_York.
 * Never throws; always returns a usable IANA zone.
 */
export function resolveUserTimeZone(opts?: {
  timezone?: string | null;
  state?: string | null;
}): string {
  const tz = opts?.timezone;
  if (isValidTimeZone(tz)) return tz as string;

  const state = opts?.state?.trim().toUpperCase();
  if (state && STATE_TIME_ZONE[state]) return STATE_TIME_ZONE[state];

  return DEFAULT_US_TIME_ZONE;
}

function toDate(value: Date | string | number): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

/**
 * Format a TRUE timestamp in the user's resolved timezone. Use for instants
 * (created-at, renewal time, "now"), NOT for date-only UTC-midnight values
 * (use `formatDateOnlyUtc` for those).
 *
 * `tzOrUser` accepts either a resolved IANA zone string or the
 * `{ timezone?, state? }` shape (which is resolved here). Returns "" for an
 * unparseable date so callers can fall back to a literal.
 */
export function formatInUserTimeZone(
  value: Date | string | number,
  tzOrUser: string | { timezone?: string | null; state?: string | null },
  options: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTIONS,
  locale = "en-US",
): string {
  const date = toDate(value);
  if (!date) return "";
  const timeZone =
    typeof tzOrUser === "string" ? resolveUserTimeZone({ timezone: tzOrUser }) : resolveUserTimeZone(tzOrUser);
  return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(date);
}

/**
 * Format a DATE-ONLY value stored at UTC midnight (moveDate, dueDate,
 * contractEndDate, billing dates) so the calendar day is stable across zones.
 * Always formats in UTC — that's what keeps "the 21st" reading as the 21st for
 * everyone. Do NOT pass true timestamps here.
 */
export function formatDateOnlyUtc(
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTIONS,
  locale = "en-US",
): string {
  const date = toDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(date);
}

/** ms in a whole calendar day. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The calendar-day ordinal (days since the Unix epoch) of an instant *as seen in
 * `timeZone`*. Two instants share an ordinal iff they fall on the same wall-clock
 * date in that zone. Implemented via the `en-CA` ISO formatter (YYYY-MM-DD),
 * which renders the local date in the target zone without any DST/offset math.
 */
function calendarDayOrdinalInZone(date: Date, timeZone: string): number {
  // en-CA yields a stable "2026-06-21" shape we can split deterministically.
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  // Date.UTC of the rendered Y-M-D, divided by a day, is the calendar ordinal.
  return Math.floor(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

/**
 * Whole calendar days from "today" until a move/due date, computed tz-correctly.
 *
 * `moveDate` is a DATE-ONLY value stored at UTC midnight, so its calendar day is
 * its UTC day (never shift it into a US zone — that lands the prior evening).
 * "Today" is the user's wall-clock day in their resolved US timezone, so the
 * countdown flips at the user's local midnight, not the server's. The two days
 * are then differenced as plain integers.
 *
 * Returns: positive = days remaining, 0 = the move is today, negative = days
 * since the move (past). Returns `null` for an unparseable date.
 */
export function daysUntilMove(
  moveDate: Date | string | number,
  opts?: { timezone?: string | null; state?: string | null; now?: Date },
): number | null {
  const move = toDate(moveDate);
  if (!move) return null;
  const now = opts?.now ?? new Date();
  const userZone = resolveUserTimeZone({ timezone: opts?.timezone, state: opts?.state });
  // Move day is read in UTC (date-only convention); "today" is read in the
  // user's zone. Subtracting the two calendar ordinals yields whole days.
  const moveOrdinal = calendarDayOrdinalInZone(move, "UTC");
  const todayOrdinal = calendarDayOrdinalInZone(now, userZone);
  return moveOrdinal - todayOrdinal;
}

/** A move's countdown phase — drives copy + celebration state. */
export type MoveCountdownPhase = "upcoming" | "today" | "past";

export interface MoveCountdown {
  /** Whole calendar days until the move (>0), 0 today, <0 after. null if unknown. */
  days: number | null;
  /** Absolute day count for display ("N days to go" / "N days ago"). */
  absDays: number;
  phase: MoveCountdownPhase;
  /** true when the move is today — the celebration / "moving day!" trigger. */
  isMovingDay: boolean;
}

/**
 * Resolve a full move-countdown descriptor (days + phase + moving-day flag) for
 * a date-only UTC-midnight move date, tz-correct via {@link daysUntilMove}.
 */
export function getMoveCountdown(
  moveDate: Date | string | number,
  opts?: { timezone?: string | null; state?: string | null; now?: Date },
): MoveCountdown {
  const days = daysUntilMove(moveDate, opts);
  if (days === null) {
    return { days: null, absDays: 0, phase: "upcoming", isMovingDay: false };
  }
  const phase: MoveCountdownPhase = days > 0 ? "upcoming" : days === 0 ? "today" : "past";
  return { days, absDays: Math.abs(days), phase, isMovingDay: days === 0 };
}
