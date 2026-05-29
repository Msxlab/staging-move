import { describe, expect, it } from "vitest";
import { computeLtv, computeMonthlyChurnRate } from "./billing-metrics";

const monthStart = new Date("2026-05-01T00:00:00.000Z");
const beforeMonth = { createdAt: new Date("2026-04-15T00:00:00.000Z") };
const earlier = { createdAt: new Date("2026-03-01T00:00:00.000Z") };
const inMonth = { createdAt: new Date("2026-05-10T00:00:00.000Z") };

describe("computeMonthlyChurnRate", () => {
  it("adds churned subscriptions back into the denominator (no inflation)", () => {
    // 9 survivors + 1 churned, all from before the month → 1 / 10 = 10%,
    // not the old 1 / 9 = 11.1%.
    const activeSubs = Array.from({ length: 9 }, () => beforeMonth);
    expect(
      computeMonthlyChurnRate({ activeSubs, canceledInMonth: [earlier], monthStart }),
    ).toBeCloseTo(10);
  });

  it("ignores subscriptions created within the month (both numerator and denominator)", () => {
    // 1 survivor from the cohort + 1 new active; the only cancellation is a
    // brand-new sub → it's not part of the start-of-month cohort → 0%.
    expect(
      computeMonthlyChurnRate({
        activeSubs: [beforeMonth, inMonth],
        canceledInMonth: [inMonth],
        monthStart,
      }),
    ).toBe(0);
  });

  it("returns 0 when there is no start-of-month cohort", () => {
    expect(
      computeMonthlyChurnRate({ activeSubs: [], canceledInMonth: [], monthStart }),
    ).toBe(0);
  });
});

describe("computeLtv", () => {
  it("computes ARPU divided by the churn fraction", () => {
    // mrr 1000 / 100 active = ARPU 10; churn 5% → 10 / 0.05 = 200.
    expect(computeLtv({ mrr: 1000, activeCount: 100, churnRatePct: 5 })).toBeCloseTo(200);
  });

  it("returns 0 (never NaN/Infinity) when there are no active subscriptions", () => {
    expect(computeLtv({ mrr: 0, activeCount: 0, churnRatePct: 10 })).toBe(0);
  });

  it("returns 0 when churn is 0 (avoids divide-by-zero)", () => {
    expect(computeLtv({ mrr: 1000, activeCount: 100, churnRatePct: 0 })).toBe(0);
  });
});
