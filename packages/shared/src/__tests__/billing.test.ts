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
    expect(BILLING_PLAN_DEFINITIONS.INDIVIDUAL).toMatchObject({
      id: "INDIVIDUAL",
      displayName: "Individual",
      primaryBillingInterval: "YEAR",
      monthlyPriceUsd: 4.99,
      monthlyPriceLabel: "$4.99/month",
      yearlyPriceUsd: 24,
      yearlyPriceLabel: "$24/year",
      isPaid: true,
    });
    expect(BILLING_PLAN_DEFINITIONS.FAMILY).toMatchObject({
      id: "FAMILY",
      displayName: "Family",
      primaryBillingInterval: "YEAR",
      monthlyPriceUsd: 7.99,
      monthlyPriceLabel: "$7.99/month",
      yearlyPriceUsd: 39,
      yearlyPriceLabel: "$39/year",
      isPaid: true,
    });
    expect(BILLING_PLAN_DEFINITIONS.PRO).toMatchObject({
      id: "PRO",
      displayName: "Pro",
      primaryBillingInterval: "YEAR",
      monthlyPriceUsd: 11.99,
      monthlyPriceLabel: "$11.99/month",
      yearlyPriceUsd: 59,
      yearlyPriceLabel: "$59/year",
      isPaid: true,
    });
  });

  it("keeps New Home Dossier PDF export copy on Pro only", () => {
    expect(BILLING_PLAN_DEFINITIONS.FREE_TRIAL.features.join("\n")).toContain("PDF export is Pro");
    expect(BILLING_PLAN_DEFINITIONS.FREE_TRIAL.features.join("\n")).not.toContain("full report and PDF");
    expect(BILLING_PLAN_DEFINITIONS.INDIVIDUAL.features.join("\n")).not.toContain("New Home Dossier PDF");
    expect(BILLING_PLAN_DEFINITIONS.FAMILY.features.join("\n")).not.toContain("New Home Dossier PDF");
    expect(BILLING_PLAN_DEFINITIONS.PRO.features.join("\n")).toContain("New Home Dossier PDF exports");
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
