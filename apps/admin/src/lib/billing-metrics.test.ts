import { describe, expect, it } from "vitest";
import {
  computeArpuByPlan,
  computeLtv,
  computeMonthlyChurnRate,
  computeMrr,
  computeMrrMovement,
  computeMrrTrend,
  computeTrialConversion,
  monthlyEquivalentUsd,
  type RevenueSub,
} from "./billing-metrics";

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

// ── MRR / churn drill-down helpers ──────────────────────────────────────────

function sub(overrides: Partial<RevenueSub> = {}): RevenueSub {
  return {
    plan: "INDIVIDUAL",
    status: "ACTIVE",
    provider: "STRIPE",
    accessType: "PAID",
    billingInterval: "MONTH",
    createdAt: new Date("2026-05-10T00:00:00.000Z"),
    canceledAt: null,
    trialEndsAt: null,
    updatedAt: null,
    ...overrides,
  };
}

describe("monthlyEquivalentUsd", () => {
  it("prices a monthly paid plan at its monthly price", () => {
    expect(monthlyEquivalentUsd(sub({ plan: "FAMILY" }))).toBeCloseTo(7.99);
  });

  it("amortizes an annual plan to monthly", () => {
    expect(monthlyEquivalentUsd(sub({ plan: "INDIVIDUAL", billingInterval: "YEAR" }))).toBeCloseTo(24 / 12);
  });

  it("returns 0 for trials, free access, and admin/trial providers", () => {
    expect(monthlyEquivalentUsd(sub({ status: "TRIALING" }))).toBe(0);
    expect(monthlyEquivalentUsd(sub({ accessType: "FREE_ACCESS" }))).toBe(0);
    expect(monthlyEquivalentUsd(sub({ accessType: "FREE_TRIAL" }))).toBe(0);
    expect(monthlyEquivalentUsd(sub({ provider: "ADMIN" }))).toBe(0);
    expect(monthlyEquivalentUsd(sub({ provider: "TRIAL" }))).toBe(0);
  });

  it("returns 0 for an unknown plan", () => {
    expect(monthlyEquivalentUsd(sub({ plan: "MYSTERY" }))).toBe(0);
  });
});

describe("computeMrr", () => {
  it("sums monthly equivalents over active, paying subs only", () => {
    const subs = [
      sub({ plan: "INDIVIDUAL" }), // 4.99
      sub({ plan: "FAMILY" }), // 7.99
      sub({ status: "TRIALING" }), // 0
      sub({ status: "CANCELED" }), // not active → 0
    ];
    expect(computeMrr(subs)).toBeCloseTo(12.98);
  });
});

describe("computeArpuByPlan", () => {
  it("breaks ARPU down per plan, excluding trials from the paying denominator", () => {
    const subs = [
      sub({ plan: "INDIVIDUAL" }),
      sub({ plan: "INDIVIDUAL" }),
      sub({ plan: "INDIVIDUAL", status: "TRIALING" }), // active but not paying
      sub({ plan: "FAMILY" }),
    ];
    const rows = computeArpuByPlan(subs);
    const individual = rows.find((r) => r.plan === "INDIVIDUAL")!;
    expect(individual.activeCount).toBe(3);
    expect(individual.payingCount).toBe(2);
    expect(individual.mrr).toBeCloseTo(9.98);
    expect(individual.arpu).toBeCloseTo(4.99);
    // Sorted by MRR desc: INDIVIDUAL (9.98) before FAMILY (7.99).
    expect(rows[0].plan).toBe("INDIVIDUAL");
  });
});

describe("computeMrrMovement", () => {
  const windowStart = new Date("2026-05-01T00:00:00.000Z");
  const windowEnd = new Date("2026-06-01T00:00:00.000Z");

  it("counts new MRR from subs created in the window and churned MRR from those canceled in it", () => {
    const subs = [
      sub({ plan: "INDIVIDUAL", createdAt: new Date("2026-05-15T00:00:00.000Z") }), // +4.99 new
      sub({ plan: "FAMILY", createdAt: new Date("2026-04-01T00:00:00.000Z") }), // created before window → not new
      sub({
        plan: "PRO",
        status: "CANCELED",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        canceledAt: new Date("2026-05-20T00:00:00.000Z"),
      }), // -11.99 churned
    ];
    const m = computeMrrMovement({ subs, windowStart, windowEnd });
    expect(m.newMrr).toBeCloseTo(4.99);
    expect(m.churnedMrr).toBeCloseTo(11.99);
    expect(m.netMrr).toBeCloseTo(4.99 - 11.99);
  });
});

describe("computeTrialConversion", () => {
  const windowStart = new Date("2026-05-01T00:00:00.000Z");
  const windowEnd = new Date("2026-06-01T00:00:00.000Z");
  const created = new Date("2026-05-10T00:00:00.000Z");

  it("rates converted trials over the cohort that started a trial in the window", () => {
    const subs = [
      sub({ status: "ACTIVE", trialEndsAt: new Date("2026-05-20"), createdAt: created }), // converted
      sub({ status: "TRIALING", trialEndsAt: new Date("2026-06-20"), createdAt: created }), // still trialing
      sub({ status: "CANCELED", trialEndsAt: new Date("2026-05-15"), createdAt: created }), // lapsed
      sub({ status: "ACTIVE", trialEndsAt: null, createdAt: created }), // never a trial → not in cohort
    ];
    const c = computeTrialConversion({ subs, windowStart, windowEnd });
    expect(c.trialsStarted).toBe(3);
    expect(c.converted).toBe(1);
    expect(c.conversionRatePct).toBeCloseTo(33.3, 1);
  });

  it("returns 0% when no trials started in the window", () => {
    const c = computeTrialConversion({ subs: [], windowStart, windowEnd });
    expect(c).toEqual({ trialsStarted: 0, converted: 0, conversionRatePct: 0 });
  });
});

describe("computeMrrTrend", () => {
  it("returns one estimated point per trailing month, oldest first", () => {
    const now = new Date("2026-06-15T00:00:00.000Z");
    const subs = [
      sub({ plan: "INDIVIDUAL", createdAt: new Date("2026-04-10T00:00:00.000Z") }),
    ];
    const trend = computeMrrTrend({ subs, now, months: 3 });
    expect(trend).toHaveLength(3);
    expect(trend[0].month).toBe("2026-04");
    expect(trend[2].month).toBe("2026-06");
    // The sub existed across all three month-ends → priced each month.
    expect(trend[2].mrr).toBeCloseTo(4.99);
  });

  it("drops a sub from months after it canceled", () => {
    const now = new Date("2026-06-15T00:00:00.000Z");
    const subs = [
      sub({
        plan: "PRO",
        status: "CANCELED",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        canceledAt: new Date("2026-04-15T00:00:00.000Z"),
      }),
    ];
    const trend = computeMrrTrend({ subs, now, months: 3 });
    // Canceled mid-April: April month-end (May 1 boundary) is after cancel → 0.
    expect(trend[0].mrr).toBe(0);
    expect(trend[2].mrr).toBe(0);
  });
});
