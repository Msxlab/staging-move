// Timezone-aware day math for reminder crons.
//
// Reminder fields (MoveTask.dueDate, MovingPlan.moveDate, Service.contractEndDate)
// are date-only values stored at UTC midnight. The crons decide whether to fire
// on an exact lead-day match (e.g. "3 days before"), so the definition of
// "today" matters: computing it in server time makes a user in a far timezone
// get a reminder on the wrong calendar day, or — because the match is an exact
// integer — miss it entirely. These helpers evaluate "today" from the user's
// own timezone while reading the target's calendar day from its UTC components.

const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_REMINDER_TIMEZONE = "America/New_York";

/** Validate an IANA timezone string; fall back to the app default if unusable. */
export function resolveReminderTimeZone(timezone?: string | null): string {
  if (!timezone) return DEFAULT_REMINDER_TIMEZONE;
  try {
    // Throws RangeError for an invalid timezone.
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone });
    return timezone;
  } catch {
    return DEFAULT_REMINDER_TIMEZONE;
  }
}

/** Epoch-day index (days since 1970-01-01) of an instant, as seen in `timeZone`. */
export function epochDayInTimeZone(date: Date, timeZone: string): number {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .split("-")
    .map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

/** Epoch-day index of a date-only value stored at UTC midnight. */
export function epochDayUtc(date: Date): number {
  return Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / DAY_MS,
  );
}

/**
 * Whole calendar days from the user's local "today" until a date-only target
 * stored at UTC midnight. Negative = in the past, 0 = the target's calendar day
 * is the user's today.
 */
export function daysUntilDateOnly(target: Date, now: Date, timeZone: string): number {
  return epochDayUtc(target) - epochDayInTimeZone(now, timeZone);
}

/** Day-of-month (1–31) of the user's local "today". */
export function localDayOfMonth(now: Date, timeZone: string): number {
  const d = new Intl.DateTimeFormat("en-CA", { timeZone, day: "2-digit" }).format(now);
  return Number(d);
}

function clampDayToMonth(year: number, monthIndex: number, day: number): number {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return Math.min(day, lastDay);
}

/**
 * The next occurrence of `billingDay` (day-of-month) on or after the user's
 * local today, counted in the user's timezone. Returns the date as a UTC-midnight
 * value (for display/dedupe — format it with timeZone "UTC") and the whole-day
 * distance from the user's today. Mirrors getNextBillingDate's roll-forward, but
 * evaluated in the user's calendar so a far-timezone user isn't off by a day.
 */
export function nextBillingOccurrence(
  billingDay: number,
  now: Date,
  timeZone: string,
): { date: Date; daysUntil: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")!.value);
  const m = Number(parts.find((p) => p.type === "month")!.value); // 1-12
  const d = Number(parts.find((p) => p.type === "day")!.value);

  const todayEpochDay = Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);

  let billYear = y;
  let billMonthIdx = m - 1;
  let billDay = clampDayToMonth(billYear, billMonthIdx, billingDay);
  let billEpochDay = Math.floor(Date.UTC(billYear, billMonthIdx, billDay) / DAY_MS);
  if (billEpochDay < todayEpochDay) {
    billMonthIdx += 1;
    if (billMonthIdx > 11) {
      billMonthIdx = 0;
      billYear += 1;
    }
    billDay = clampDayToMonth(billYear, billMonthIdx, billingDay);
    billEpochDay = Math.floor(Date.UTC(billYear, billMonthIdx, billDay) / DAY_MS);
  }

  return {
    date: new Date(Date.UTC(billYear, billMonthIdx, billDay)),
    daysUntil: billEpochDay - todayEpochDay,
  };
}
