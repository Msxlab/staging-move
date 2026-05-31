/**
 * Pure billing-metric helpers, extracted from the dashboard route so the
 * money math is unit-testable and can't silently regress. No I/O, no Prisma —
 * callers pass the already-fetched subscription rows in.
 */

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
