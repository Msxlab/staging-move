import { describe, expect, it } from "vitest";
import {
  calculateBudgetPlan,
  getBudgetCategoryForService,
  getFriendlyServiceCategoryLabel,
  normalizeServiceCost,
  type ServiceCostInput,
} from "./budget-planning";

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
