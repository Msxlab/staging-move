/**
 * Client-side derivations over the user's tracked services + reminders.
 *
 * Everything here is computed from fields the existing API already returns —
 * NO schema change. The Service row carries `monthlyCost`, `category`,
 * `billingCycle`, `billingDay`, `contractEndDate` and `autoRenewal`, and the
 * single-service GET also includes `reminders[]`. We turn those into:
 *   - a savings/insights summary for the dashboard,
 *   - a "next renewal" date per service for the detail screen,
 *   - a unified "what's coming up" feed for the reminders center.
 *
 * Renewal date resolution (best-effort, in priority order):
 *   1. `contractEndDate` — an explicit contract/renewal date the user entered.
 *   2. `billingDay` (+ `billingCycle`) — the next occurrence of that day-of-month,
 *      advanced by the billing cycle. This is a recurring bill, so it always has
 *      a "next" date in the future.
 * If neither is present we simply have no renewal date for that service — we
 * never fabricate one.
 */

export interface ServiceLike {
  id: string;
  providerName?: string | null;
  category?: string | null;
  monthlyCost?: number | null;
  billingCycle?: string | null;
  billingDay?: number | null;
  contractEndDate?: string | null;
  autoRenewal?: boolean | null;
  isActive?: boolean | null;
  address?: { id?: string; nickname?: string | null; city?: string | null; state?: string | null } | null;
}

export interface ReminderLike {
  id: string;
  serviceId?: string | null;
  type?: string | null;
  title?: string | null;
  message?: string | null;
  remindAt: string;
  sent?: boolean | null;
}

/** ms in a day — for whole-day diffing. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** Start-of-day for a date, so "days until" counts calendar days, not hours. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Whole calendar days from `now` until `target` (negative if in the past).
 * 0 == due today.
 */
export function daysUntil(target: Date, now: Date = new Date()): number {
  return Math.round((startOfDay(target).getTime() - startOfDay(now).getTime()) / DAY_MS);
}

/** Months to advance per billing cycle (defaults to monthly when unknown). */
function cycleMonths(cycle?: string | null): number {
  switch ((cycle || "MONTHLY").toUpperCase()) {
    case "YEARLY":
    case "ANNUAL":
      return 12;
    case "QUARTERLY":
      return 3;
    case "ONE_TIME":
      return 0; // no recurrence
    case "MONTHLY":
    default:
      return 1;
  }
}

/**
 * Next billing date from a day-of-month (`billingDay`) + cycle, strictly in the
 * future (or today). Clamps the day to the target month's length (e.g. day 31
 * in a 30-day month lands on the 30th). Returns null when there's no usable
 * recurring signal.
 */
export function nextBillingDate(
  billingDay?: number | null,
  cycle?: string | null,
  now: Date = new Date(),
): Date | null {
  if (billingDay == null || !Number.isFinite(billingDay) || billingDay < 1 || billingDay > 31) {
    return null;
  }
  const step = cycleMonths(cycle);
  const today = startOfDay(now);

  const clampedFor = (year: number, month: number): Date => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(billingDay, lastDay));
  };

  // Candidate in the current month.
  let candidate = clampedFor(today.getFullYear(), today.getMonth());
  if (candidate.getTime() >= today.getTime()) return candidate;

  // Otherwise advance by the cycle until we're at/after today. For a one-time
  // (step 0) bill whose day already passed this month, there's no future date.
  if (step === 0) return null;
  let guard = 0;
  while (candidate.getTime() < today.getTime() && guard < 60) {
    candidate = clampedFor(today.getFullYear(), today.getMonth() + step * (guard + 1));
    guard += 1;
  }
  return candidate;
}

export interface ServiceRenewal {
  /** The resolved upcoming date. */
  date: Date;
  /** Whole calendar days until `date` (0 = today). */
  days: number;
  /** Which field the date came from — drives copy ("contract ends" vs "renews"). */
  source: "contract" | "billing";
}

/**
 * Resolve a single service's next renewal/billing date, or null if the service
 * carries no date signal. `contractEndDate` wins over the recurring billing day
 * because it's the more specific, user-entered commitment.
 */
export function resolveServiceRenewal(
  service: ServiceLike,
  now: Date = new Date(),
): ServiceRenewal | null {
  if (service.contractEndDate) {
    const d = new Date(service.contractEndDate);
    if (!Number.isNaN(d.getTime())) {
      return { date: d, days: daysUntil(d, now), source: "contract" };
    }
  }
  const billing = nextBillingDate(service.billingDay, service.billingCycle, now);
  if (billing) {
    return { date: billing, days: daysUntil(billing, now), source: "billing" };
  }
  return null;
}

/** "Soon" threshold (days) for highlighting an imminent renewal. */
export const RENEWAL_SOON_DAYS = 7;

export interface CategoryTotal {
  category: string;
  total: number;
  count: number;
}

export interface SavingsInsights {
  /** Sum of monthlyCost across active, costed services. */
  totalMonthly: number;
  /** Annualized (×12) — a more tangible "you spend $X/yr" framing. */
  totalYearly: number;
  /** Count of active services considered. */
  serviceCount: number;
  /** Count of active services missing a cost (so the user can be nudged). */
  missingCostCount: number;
  /** Per-category totals, sorted by spend desc. */
  byCategory: CategoryTotal[];
  /** The single most-expensive category, if any spend exists. */
  topCategory: CategoryTotal | null;
}

/**
 * Compute the dashboard savings/insights summary from the user's tracked
 * services. Only active services count toward spend; inactive ones are ignored
 * so the total reflects what the user is actually paying now.
 */
export function computeSavingsInsights(services: ServiceLike[]): SavingsInsights {
  const active = services.filter((s) => s.isActive !== false);
  let totalMonthly = 0;
  let missingCostCount = 0;
  const catMap = new Map<string, CategoryTotal>();

  for (const s of active) {
    const cost = typeof s.monthlyCost === "number" && s.monthlyCost > 0 ? s.monthlyCost : 0;
    if (cost === 0) missingCostCount += 1;
    totalMonthly += cost;

    const key = (s.category || "OTHER").toUpperCase();
    const entry = catMap.get(key) || { category: key, total: 0, count: 0 };
    entry.total += cost;
    entry.count += 1;
    catMap.set(key, entry);
  }

  const byCategory = [...catMap.values()].sort((a, b) => b.total - a.total || b.count - a.count);
  const topCategory = byCategory.find((c) => c.total > 0) || null;

  return {
    totalMonthly,
    totalYearly: totalMonthly * 12,
    serviceCount: active.length,
    missingCostCount,
    byCategory,
    topCategory,
  };
}

export type UpcomingKind = "renewal" | "reminder";

export interface UpcomingItem {
  /** Stable key for list rendering. */
  key: string;
  kind: UpcomingKind;
  title: string;
  subtitle?: string;
  date: Date;
  /** Whole calendar days until `date` (negative = overdue). */
  days: number;
  /** For renewals: whether it came from a contract date or a billing day. */
  source?: ServiceRenewal["source"];
  /** Originating service id, when applicable (for navigation). */
  serviceId?: string;
}

/**
 * Build a unified, date-sorted "what's coming up" feed from services
 * (their next renewal/billing dates) + standalone reminders. Past-dated,
 * already-sent reminders are dropped; renewals are always future by
 * construction (billing) or shown with their real date (contracts, which may be
 * overdue and are surfaced as such).
 *
 * @param horizonDays  Only include items at most this many days out (default 60).
 *                     Overdue contract renewals (days < 0) are always included.
 */
export function buildUpcomingFeed(
  services: ServiceLike[],
  reminders: ReminderLike[],
  now: Date = new Date(),
  horizonDays = 60,
): UpcomingItem[] {
  const items: UpcomingItem[] = [];

  for (const s of services) {
    if (s.isActive === false) continue;
    const renewal = resolveServiceRenewal(s, now);
    if (!renewal) continue;
    // Keep overdue (contract) items + anything within the horizon.
    if (renewal.days > horizonDays) continue;
    const place = s.address?.nickname || s.address?.city || null;
    items.push({
      key: `svc-${s.id}`,
      kind: "renewal",
      title: s.providerName || "Service",
      subtitle: place || undefined,
      date: renewal.date,
      days: renewal.days,
      source: renewal.source,
      serviceId: s.id,
    });
  }

  for (const r of reminders) {
    if (r.sent) continue;
    const d = new Date(r.remindAt);
    if (Number.isNaN(d.getTime())) continue;
    const days = daysUntil(d, now);
    if (days < 0 || days > horizonDays) continue; // drop stale + far-future
    items.push({
      key: `rem-${r.id}`,
      kind: "reminder",
      title: r.title || "Reminder",
      subtitle: r.message || undefined,
      date: d,
      days,
      serviceId: r.serviceId || undefined,
    });
  }

  return items.sort((a, b) => a.date.getTime() - b.date.getTime());
}
