import { describe, expect, it } from "vitest";
import {
  BILLING_PLAN_ORDER,
  PAID_BILLING_PLANS,
  BILLING_PLAN_DEFINITIONS,
  BILLING_PRODUCT_CONFIG_KEYS,
  getBillingPlanDefinition,
  isBillingPlan,
  isPaidBillingPlan,
} from "../billing";

describe("billing plan catalog (doc 62 cascade)", () => {
  it("includes FREE_TRIAL, INDIVIDUAL, FAMILY, and PRO in plan order", () => {
    expect(BILLING_PLAN_ORDER).toEqual(["FREE_TRIAL", "INDIVIDUAL", "FAMILY", "PRO"]);
  });

  it("treats INDIVIDUAL, FAMILY, and PRO as paid plans (FREE_TRIAL is not)", () => {
    expect(PAID_BILLING_PLANS).toEqual(["INDIVIDUAL", "FAMILY", "PRO"]);
    expect(isPaidBillingPlan("FAMILY")).toBe(true);
    expect(isPaidBillingPlan("PRO")).toBe(true);
    expect(isPaidBillingPlan("INDIVIDUAL")).toBe(true);
    expect(isPaidBillingPlan("FREE_TRIAL")).toBe(false);
  });

  it("defines Family and Pro with their canonical prices", () => {
    expect(BILLING_PLAN_DEFINITIONS.FAMILY).toMatchObject({
      id: "FAMILY",
      displayName: "Family",
      monthlyPriceUsd: 9.99,
      yearlyPriceUsd: 99,
      isPaid: true,
    });
    expect(BILLING_PLAN_DEFINITIONS.PRO).toMatchObject({
      id: "PRO",
      displayName: "Pro",
      monthlyPriceUsd: 19.99,
      yearlyPriceUsd: 199,
      isPaid: true,
    });
  });

  it("resolves Family/Pro through getBillingPlanDefinition and falls back to Free Trial for unknowns", () => {
    expect(getBillingPlanDefinition("FAMILY").displayName).toBe("Family");
    expect(getBillingPlanDefinition("PRO").displayName).toBe("Pro");
    expect(getBillingPlanDefinition("BUSINESS").id).toBe("FREE_TRIAL");
    expect(getBillingPlanDefinition(null).id).toBe("FREE_TRIAL");
  });

  it("exposes Stripe config keys for Family and Pro", () => {
    expect(BILLING_PRODUCT_CONFIG_KEYS.web).toMatchObject({
      FAMILY_MONTHLY: "STRIPE_PRICE_FAMILY_MONTHLY",
      FAMILY_YEARLY: "STRIPE_PRICE_FAMILY_YEARLY",
      PRO_MONTHLY: "STRIPE_PRICE_PRO_MONTHLY",
      PRO_YEARLY: "STRIPE_PRICE_PRO_YEARLY",
    });
  });

  it("isBillingPlan accepts known tiers and rejects unknown strings", () => {
    expect(isBillingPlan("FAMILY")).toBe(true);
    expect(isBillingPlan("PRO")).toBe(true);
    expect(isBillingPlan("INDIVIDUAL")).toBe(true);
    expect(isBillingPlan("FREE_TRIAL")).toBe(true);
    expect(isBillingPlan("BUSINESS")).toBe(false);
    expect(isBillingPlan("")).toBe(false);
    expect(isBillingPlan(null)).toBe(false);
    expect(isBillingPlan(undefined)).toBe(false);
  });
});
