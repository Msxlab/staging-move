/**
 * Pure billing-metric helpers. No I/O, no Prisma — callers pass the
 * already-fetched subscription rows in. Lives in @locateflow/shared so BOTH the
 * admin app (dashboard / subscriptions analytics) and the web app (the
 * admin-daily-digest cron) share ONE definition of "monthly equivalent revenue".
 */

import { BILLING_PLAN_DEFINITIONS } from "./billing";

interface DatedSub {
  createdAt: Date | string;
}

/**
 * Monthly churn rate (%) measured against the start-of-month cohort.
 *
 * The base is every subscription that existed at the start of the month —
 * i.e. created before `monthStart` — split into:
 *   - survivors: still active now, and
 *   - churned:   canceled during the month.
 *
 * Both are restricted to the pre-month cohort so a subscription created *and*
 * canceled inside the same month doesn't distort the rate. Crucially the
 * churned subscriptions are part of the denominator: the previous inline
 * version divided by survivors only, which systematically inflated churn
 * (e.g. 10 lost out of 100 reported as 10/90 = 11.1% instead of 10/100 = 10%).
 *
 * Note: "survivors" uses the *current* active set as a proxy for "active at
 * month start and still active", which is exact for the current month and a
 * close approximation for prior months (we don't snapshot daily state).
 */
export function computeMonthlyChurnRate(params: {
  activeSubs: DatedSub[];
  canceledInMonth: DatedSub[];
  monthStart: Date;
}): number {
  const createdBeforeMonth = (s: DatedSub) => new Date(s.createdAt) < params.monthStart;
  const survivors = params.activeSubs.filter(createdBeforeMonth).length;
  const churned = params.canceledInMonth.filter(createdBeforeMonth).length;
  const base = survivors + churned;
  return base > 0 ? (churned / base) * 100 : 0;
}

/**
 * Lifetime-value estimate = ARPU ÷ monthly churn rate.
 *
 * Returns 0 when there are no active subscriptions or churn is 0, so the
 * result can never be NaN/Infinity. This guard matters because fixing the
 * churn denominator above makes "churn > 0 with zero active subs" reachable
 * (a month where everyone canceled), which would otherwise divide by zero.
 */
export function computeLtv(params: {
  mrr: number;
  activeCount: number;
  churnRatePct: number;
}): number {
  if (params.activeCount <= 0 || params.churnRatePct <= 0) return 0;
  const arpu = params.mrr / params.activeCount;
  return arpu / (params.churnRatePct / 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// MRR / churn drill-down helpers (Subscriptions analytics tab)
//
// These mirror the realized-revenue rules already used by the /api/billing
// dashboard, but live here as pure functions so the drill-down (ARPU by plan,
// new-vs-churned MRR, trial→paid conversion, MRR trend) is independently
// unit-testable and shares ONE definition of "monthly equivalent revenue".
// ─────────────────────────────────────────────────────────────────────────────

/** Minimal shape the MRR helpers read off a Subscription row. */
export interface RevenueSub {
  plan: string;
  status: string;
  provider: string;
  accessType?: string | null;
  billingInterval?: string | null;
  createdAt: Date | string;
  canceledAt?: Date | string | null;
  trialEndsAt?: Date | string | null;
  updatedAt?: Date | string | null;
}

/**
 * Monthly-equivalent realized revenue for a single subscription, in dollars.
 *
 * Identical policy to the inline copy in /api/billing/route.ts (kept in sync
 * deliberately): annual plans amortize to monthly; admin-granted Free Access,
 * provider ADMIN/TRIAL, trials, and FREE_TRIAL access generate $0 so they
 * never inflate MRR. Unknown plans contribute $0.
 */
export function monthlyEquivalentUsd(sub: RevenueSub): number {
  if (sub.accessType === "FREE_ACCESS") return 0;
  if (sub.provider === "ADMIN" || sub.provider === "TRIAL") return 0;
  if (sub.status === "TRIALING" || sub.accessType === "FREE_TRIAL") return 0;
  const def = (BILLING_PLAN_DEFINITIONS as any)[sub.plan];
  if (!def) return 0;
  if (sub.billingInterval === "YEAR") {
    if (typeof def.yearlyPriceUsd === "number") return def.yearlyPriceUsd / 12;
    return def.monthlyPriceUsd || 0;
  }
  return def.monthlyPriceUsd || 0;
}

const ACTIVE_STATUSES = new Set(["ACTIVE", "TRIALING"]);
const isActive = (s: RevenueSub) => ACTIVE_STATUSES.has(s.status);

/** Total realized MRR (dollars) across the active, paying subscriptions. */
export function computeMrr(subs: RevenueSub[]): number {
  return subs.filter(isActive).reduce((sum, s) => sum + monthlyEquivalentUsd(s), 0);
}

export interface PlanArpuRow {
  plan: string;
  activeCount: number; // active subs on this plan (incl. trials)
  payingCount: number; // active subs contributing non-zero MRR
  mrr: number; // realized monthly revenue from this plan
  arpu: number; // mrr / payingCount (0 when no payers)
}

/**
 * Per-plan ARPU breakdown. ARPU divides realized plan MRR by the number of
 * *paying* active subs on that plan (a non-zero monthly equivalent), so trials
 * and free grants on the plan don't dilute the figure — matching how the
 * dashboard computes the global ARPU.
 */
export function computeArpuByPlan(subs: RevenueSub[]): PlanArpuRow[] {
  const acc = new Map<string, { activeCount: number; payingCount: number; mrr: number }>();
  for (const s of subs) {
    if (!isActive(s)) continue;
    const row = acc.get(s.plan) ?? { activeCount: 0, payingCount: 0, mrr: 0 };
    row.activeCount += 1;
    const me = monthlyEquivalentUsd(s);
    if (me > 0) {
      row.payingCount += 1;
      row.mrr += me;
    }
    acc.set(s.plan, row);
  }
  return Array.from(acc.entries())
    .map(([plan, r]) => ({
      plan,
      activeCount: r.activeCount,
      payingCount: r.payingCount,
      mrr: Math.round(r.mrr * 100) / 100,
      arpu: r.payingCount > 0 ? Math.round((r.mrr / r.payingCount) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.mrr - a.mrr);
}

export interface MrrMovement {
  newMrr: number; // MRR added by subs created during the window
  churnedMrr: number; // MRR lost from subs canceled during the window
  netMrr: number; // newMrr − churnedMrr
}

/**
 * New vs churned MRR for a [windowStart, windowEnd) window.
 *
 *  - new MRR: monthly equivalent of currently-active subscriptions created in
 *    the window (the realized recurring revenue those new signups now carry).
 *  - churned MRR: monthly equivalent that canceled subscriptions *would* still
 *    be contributing had they not churned in the window. Because a canceled sub
 *    no longer carries a billing interval reliably, we price it with its last
 *    known plan/interval — an estimate, consistent with the trend sparkline.
 *
 * Both numbers are non-negative; netMrr can be negative (contraction).
 */
export function computeMrrMovement(params: {
  subs: RevenueSub[];
  windowStart: Date;
  windowEnd: Date;
}): MrrMovement {
  const { subs, windowStart, windowEnd } = params;
  const inWindow = (d: Date | string | null | undefined) => {
    if (!d) return false;
    const t = new Date(d).getTime();
    return t >= windowStart.getTime() && t < windowEnd.getTime();
  };

  let newMrr = 0;
  let churnedMrr = 0;
  for (const s of subs) {
    if (isActive(s) && inWindow(s.createdAt)) {
      newMrr += monthlyEquivalentUsd(s);
    }
    if (s.status === "CANCELED" && inWindow(s.canceledAt)) {
      // Price the churned sub as if it were still active (ignore the CANCELED
      // status that would otherwise zero a trial-state contribution).
      churnedMrr += monthlyEquivalentUsd({ ...s, status: "ACTIVE" });
    }
  }
  newMrr = Math.round(newMrr * 100) / 100;
  churnedMrr = Math.round(churnedMrr * 100) / 100;
  return { newMrr, churnedMrr, netMrr: Math.round((newMrr - churnedMrr) * 100) / 100 };
}

export interface TrialConversion {
  trialsStarted: number; // subs that ever entered a trial in the window
  converted: number; // of those, now on a paying plan/status
  conversionRatePct: number; // converted / trialsStarted (0 when none)
}

/**
 * Trial → paid conversion over a window, cohorted by trial start.
 *
 * A subscription is counted as a started trial when it has a trialEndsAt and
 * was created in the window (best available proxy for "trial started" — there
 * is no separate trialStartedAt column). It counts as converted when it is now
 * an active, paying subscription (non-zero monthly equivalent and not still
 * TRIALING). Subs still inside their trial are neither converted nor lost yet,
 * so they stay in the denominator but not the numerator.
 */
export function computeTrialConversion(params: {
  subs: RevenueSub[];
  windowStart: Date;
  windowEnd: Date;
}): TrialConversion {
  const { subs, windowStart, windowEnd } = params;
  const cohort = subs.filter((s) => {
    if (!s.trialEndsAt) return false;
    const created = new Date(s.createdAt).getTime();
    return created >= windowStart.getTime() && created < windowEnd.getTime();
  });
  const converted = cohort.filter(
    (s) => s.status === "ACTIVE" && monthlyEquivalentUsd({ ...s, status: "ACTIVE" }) > 0,
  ).length;
  const trialsStarted = cohort.length;
  return {
    trialsStarted,
    converted,
    conversionRatePct:
      trialsStarted > 0 ? Math.round((converted / trialsStarted) * 1000) / 10 : 0,
  };
}

export interface MrrTrendPoint {
  month: string; // YYYY-MM
  mrr: number; // estimated realized MRR active at month end
}

/**
 * Estimated month-by-month MRR for the trailing `months` months (oldest first).
 *
 * For each month boundary we sum the monthly equivalent of every subscription
 * that (a) was created on/before the month end and (b) had not canceled by the
 * month end. Like the dashboard's daily sparkline, this prices history with
 * each sub's *current* plan/interval (no historical price snapshot), so it is a
 * trend estimate, not a ledger.
 */
export function computeMrrTrend(params: {
  subs: RevenueSub[];
  now: Date;
  months: number;
}): MrrTrendPoint[] {
  const { subs, now, months } = params;
  const points: MrrTrendPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    // The month this point represents (i months back from the current month).
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthLabel = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
    // End-of-month boundary: first day of the *next* month at 00:00.
    const boundary = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    let mrr = 0;
    for (const s of subs) {
      const created = new Date(s.createdAt).getTime();
      if (created > boundary.getTime()) continue;
      if (s.status === "CANCELED" && s.canceledAt && new Date(s.canceledAt).getTime() <= boundary.getTime()) {
        continue;
      }
      // Price as if active at the boundary (ignore terminal status zeroing).
      mrr += monthlyEquivalentUsd({ ...s, status: "ACTIVE" });
    }
    points.push({ month: monthLabel, mrr: Math.round(mrr * 100) / 100 });
  }
  return points;
}
