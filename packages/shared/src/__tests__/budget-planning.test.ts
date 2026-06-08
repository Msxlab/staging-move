import { describe, expect, it } from "vitest";
import {
  calculateBudgetActuals,
  calculateBudgetPlan,
  getBudgetCategoryForService,
  getFriendlyServiceCategoryLabel,
  normalizeActualServiceCost,
  normalizeServiceCost,
  type ServiceCostInput,
} from "../budget-planning";

const month = new Date("2026-04-01T00:00:00.000Z");

function service(overrides: Partial<ServiceCostInput>): ServiceCostInput {
  return {
    id: "service-1",
    providerName: "Test Provider",
    category: "UTILITY_ELECTRIC",
    addressId: "addr-1",
    monthlyCost: 120,
    billingCycle: "MONTHLY",
    isActive: true,
    createdAt: "2026-04-10T00:00:00.000Z",
    ...overrides,
  };
}

describe("budget planning service cost normalization", () => {
  it("keeps monthly costs as monthly committed cost", () => {
    expect(normalizeServiceCost(service({ monthlyCost: 75, billingCycle: "MONTHLY" }), month).monthlyCommitted).toBe(75);
  });

  it("normalizes annual costs to one twelfth per month", () => {
    expect(normalizeServiceCost(service({ monthlyCost: 1200, billingCycle: "YEARLY" }), month).monthlyCommitted).toBe(100);
  });

  it("normalizes weekly costs by 52 weeks over 12 months", () => {
    expect(normalizeServiceCost(service({ monthlyCost: 30, billingCycle: "WEEKLY" }), month).monthlyCommitted).toBe(130);
  });

  it("excludes one-time costs from monthly committed and shows them in their service month", () => {
    const normalized = normalizeServiceCost(service({ monthlyCost: 250, billingCycle: "ONE_TIME" }), month);

    expect(normalized.monthlyCommitted).toBe(0);
    expect(normalized.oneTimeThisMonth).toBe(250);
  });

  it("does not count one-time services outside the selected month", () => {
    const normalized = normalizeServiceCost(
      service({ monthlyCost: 250, billingCycle: "ONE_TIME", createdAt: "2026-03-10T00:00:00.000Z" }),
      month,
    );

    expect(normalized.monthlyCommitted).toBe(0);
    expect(normalized.oneTimeThisMonth).toBe(0);
  });
});

describe("budget planning category mapping", () => {
  it("uses friendly service category labels instead of raw enums", () => {
    expect(getFriendlyServiceCategoryLabel("GOVERNMENT_POSTAL")).toBe("Mail & Postal");
    expect(getFriendlyServiceCategoryLabel("UTILITY_WATER")).toBe("Water");
    expect(getFriendlyServiceCategoryLabel("UTILITY_ELECTRIC")).toBe("Electric");
    expect(getFriendlyServiceCategoryLabel("UTILITY_GAS")).toBe("Gas");
    expect(getFriendlyServiceCategoryLabel("UTILITY_INTERNET")).toBe("Internet");
    expect(getFriendlyServiceCategoryLabel("UTILITY_PHONE")).toBe("Phone");
    expect(getFriendlyServiceCategoryLabel("FINANCIAL_BANK")).toBe("Banking");
    expect(getFriendlyServiceCategoryLabel("FINANCIAL_INSURANCE_AUTO")).toBe("Insurance");
    expect(getFriendlyServiceCategoryLabel("SHOPPING_SUBSCRIPTION")).toBe("Subscriptions");
    expect(getFriendlyServiceCategoryLabel("SHOPPING_RETAIL")).toBe("Shopping");
    expect(getFriendlyServiceCategoryLabel("HOUSING_MOVING")).toBe("Moving");
    expect(getFriendlyServiceCategoryLabel("TRANSPORTATION_TRANSIT")).toBe("Transportation");
    expect(getFriendlyServiceCategoryLabel("GOVERNMENT_TAX")).toBe("Government");
    expect(getFriendlyServiceCategoryLabel("SOMETHING_ELSE")).toBe("Other");
  });

  it("maps provider categories into budget planning categories", () => {
    expect(getBudgetCategoryForService("UTILITY_ELECTRIC")).toBe("Utilities");
    expect(getBudgetCategoryForService("UTILITY_INTERNET")).toBe("Internet & Phone");
    expect(getBudgetCategoryForService("FINANCIAL_INSURANCE_RENTERS")).toBe("Insurance");
    expect(getBudgetCategoryForService("SHOPPING_SUBSCRIPTION")).toBe("Subscriptions");
    expect(getBudgetCategoryForService("FINANCIAL_BANK")).toBe("Banking / Financial");
    expect(getBudgetCategoryForService("GOVERNMENT_POSTAL")).toBe("Government");
    expect(getBudgetCategoryForService("HOUSING_MOVING")).toBe("Moving");
    expect(getBudgetCategoryForService("SHOPPING_RETAIL")).toBe("Shopping");
    expect(getBudgetCategoryForService("TRANSPORTATION_TOLL")).toBe("Transportation");
    expect(getBudgetCategoryForService("KIDS_SCHOOL")).toBe("Other");
  });
});

describe("calculateBudgetPlan", () => {
  it("respects address filtering", () => {
    const summary = calculateBudgetPlan(
      [
        service({ id: "a", addressId: "addr-1", monthlyCost: 100 }),
        service({ id: "b", addressId: "addr-2", monthlyCost: 200 }),
      ],
      { month, addressId: "addr-1" },
    );

    expect(summary.monthlyCommitted).toBe(100);
    expect(summary.costedRecurringServices.map((s) => s.id)).toEqual(["a"]);
  });

  it("tracks services missing cost data separately", () => {
    const summary = calculateBudgetPlan(
      [
        service({ id: "costed", monthlyCost: 100 }),
        service({ id: "missing", monthlyCost: null, providerName: "Missing Cost" }),
      ],
      { month },
    );

    expect(summary.monthlyCommitted).toBe(100);
    expect(summary.missingCostServices).toHaveLength(1);
    expect(summary.missingCostServices[0].providerName).toBe("Missing Cost");
  });

  it("uses friendly budget labels in category totals", () => {
    const summary = calculateBudgetPlan(
      [
        service({ id: "internet", category: "UTILITY_INTERNET", monthlyCost: 80 }),
        service({ id: "insurance", category: "FINANCIAL_INSURANCE_AUTO", monthlyCost: 120 }),
      ],
      { month },
    );

    expect(summary.byBudgetCategory.map((row) => row.category)).toEqual(["Insurance", "Internet & Phone"]);
    expect(summary.byBudgetCategory.map((row) => row.category)).not.toContain("UTILITY_INTERNET");
  });
});

describe("normalizeActualServiceCost", () => {
  it("returns null when no actual has been logged", () => {
    expect(normalizeActualServiceCost(service({ actualMonthlyCost: null }), month)).toBeNull();
    expect(normalizeActualServiceCost(service({ actualMonthlyCost: undefined }), month)).toBeNull();
  });

  it("normalizes a logged annual actual to a monthly figure", () => {
    const result = normalizeActualServiceCost(
      service({ actualMonthlyCost: 1200, billingCycle: "YEARLY" }),
      month,
    );
    expect(result).toEqual({ monthly: 100, oneTimeThisMonth: 0 });
  });

  it("counts a logged one-time actual only in its service month", () => {
    expect(
      normalizeActualServiceCost(service({ actualMonthlyCost: 250, billingCycle: "ONE_TIME" }), month),
    ).toEqual({ monthly: 0, oneTimeThisMonth: 250 });
    expect(
      normalizeActualServiceCost(
        service({ actualMonthlyCost: 250, billingCycle: "ONE_TIME", createdAt: "2026-03-01T00:00:00.000Z" }),
        month,
      ),
    ).toEqual({ monthly: 0, oneTimeThisMonth: 0 });
  });

  it("ignores inactive services and negative actuals", () => {
    expect(normalizeActualServiceCost(service({ actualMonthlyCost: 50, isActive: false }), month)).toBeNull();
    expect(normalizeActualServiceCost(service({ actualMonthlyCost: -5 }), month)).toBeNull();
  });
});

describe("calculateBudgetActuals", () => {
  it("substantiates savings only over services with a logged actual", () => {
    const summary = calculateBudgetActuals(
      [
        // Projected 100, actually paid 80 → 20 saved.
        service({ id: "electric", category: "UTILITY_ELECTRIC", monthlyCost: 100, actualMonthlyCost: 80 }),
        // Estimate only — projected 60, no actual → excluded from the savings math.
        service({ id: "internet", category: "UTILITY_INTERNET", monthlyCost: 60 }),
      ],
      { month },
    );

    expect(summary.projectedForLoggedServices).toBe(100);
    expect(summary.actualThisMonth).toBe(80);
    expect(summary.monthlySavings).toBe(20);
    expect(summary.annualSavings).toBe(240);
    expect(summary.savingsRate).toBeCloseTo(0.2, 5);
    expect(summary.loggedServiceCount).toBe(1);
    expect(summary.pendingServiceCount).toBe(1);
  });

  it("returns a null savings rate when nothing has been reconciled", () => {
    const summary = calculateBudgetActuals([service({ id: "x", monthlyCost: 100 })], { month });
    expect(summary.savingsRate).toBeNull();
    expect(summary.monthlySavings).toBe(0);
    expect(summary.loggedServiceCount).toBe(0);
    expect(summary.pendingServiceCount).toBe(1);
  });

  it("reports negative variance when the user paid more than estimated", () => {
    const summary = calculateBudgetActuals(
      [service({ id: "gas", category: "UTILITY_GAS", monthlyCost: 50, actualMonthlyCost: 70 })],
      { month },
    );
    expect(summary.monthlySavings).toBe(-20);
    expect(summary.savingsRate).toBeCloseTo(-0.4, 5);
  });

  it("computes per-category variance and ranks reconciled categories first", () => {
    const summary = calculateBudgetActuals(
      [
        service({ id: "electric", category: "UTILITY_ELECTRIC", monthlyCost: 100, actualMonthlyCost: 90 }),
        service({ id: "internet", category: "UTILITY_INTERNET", monthlyCost: 60 }),
      ],
      { month },
    );

    const utilities = summary.perCategory.find((row) => row.category === "Utilities");
    expect(utilities).toMatchObject({ projected: 100, actual: 90, variance: 10, loggedCount: 1, totalCount: 1 });
    // Reconciled category (Utilities) ranks ahead of estimate-only (Internet & Phone).
    expect(summary.perCategory[0].category).toBe("Utilities");
  });

  it("respects address filtering for actuals", () => {
    const summary = calculateBudgetActuals(
      [
        service({ id: "a", addressId: "addr-1", monthlyCost: 100, actualMonthlyCost: 80 }),
        service({ id: "b", addressId: "addr-2", monthlyCost: 200, actualMonthlyCost: 100 }),
      ],
      { month, addressId: "addr-1" },
    );
    expect(summary.actualThisMonth).toBe(80);
    expect(summary.loggedServiceCount).toBe(1);
  });
});
