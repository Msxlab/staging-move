import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRuntimeConfigValue: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/runtime-config", () => ({
  getRuntimeConfigValue: mocks.getRuntimeConfigValue,
}));

import {
  buildUnifiedEntitlementSnapshot,
  getStripeAnnualTrialDays,
  getStripePriceIdForPlan,
  getStripePriceIdForPlanAndInterval,
  mapStripePriceIdToPlanAndInterval,
} from "./billing";

describe("billing helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves the monthly Individual Stripe price from the primary monthly env key", async () => {
    mocks.getRuntimeConfigValue.mockImplementation(async (key: string) =>
      key === "STRIPE_PRICE_INDIVIDUAL_MONTHLY" ? "price_monthly_new" : null,
    );

    await expect(getStripePriceIdForPlanAndInterval("INDIVIDUAL", "MONTH"))
      .resolves.toBe("price_monthly_new");
  });

  it("resolves the yearly Individual Stripe price from the primary yearly env key", async () => {
    mocks.getRuntimeConfigValue.mockImplementation(async (key: string) =>
      key === "STRIPE_PRICE_INDIVIDUAL_YEARLY" ? "price_yearly_new" : null,
    );

    await expect(getStripePriceIdForPlanAndInterval("INDIVIDUAL", "YEAR"))
      .resolves.toBe("price_yearly_new");
  });

  it("does not let the legacy Individual price override primary monthly or yearly keys", async () => {
    const values: Record<string, string> = {
      STRIPE_PRICE_INDIVIDUAL_MONTHLY: "price_monthly_new",
      STRIPE_PRICE_INDIVIDUAL_YEARLY: "price_yearly_new",
      STRIPE_PRICE_INDIVIDUAL: "price_legacy",
    };
    mocks.getRuntimeConfigValue.mockImplementation(async (key: string) =>
      values[key] || null,
    );

    await expect(getStripePriceIdForPlanAndInterval("INDIVIDUAL", "MONTH"))
      .resolves.toBe("price_monthly_new");
    await expect(getStripePriceIdForPlanAndInterval("INDIVIDUAL", "YEAR"))
      .resolves.toBe("price_yearly_new");
  });

  it("uses the legacy Individual price only as a monthly fallback", async () => {
    mocks.getRuntimeConfigValue.mockImplementation(async (key: string) =>
      key === "STRIPE_PRICE_INDIVIDUAL" ? "price_legacy_monthly" : null,
    );

    await expect(getStripePriceIdForPlanAndInterval("INDIVIDUAL", "MONTH"))
      .resolves.toBe("price_legacy_monthly");
    await expect(getStripePriceIdForPlan("INDIVIDUAL", "yearly")).resolves.toBeNull();
    expect(mocks.getRuntimeConfigValue).toHaveBeenCalledWith("STRIPE_PRICE_INDIVIDUAL_YEARLY");
  });

  it("maps Stripe monthly and yearly price IDs back to plan and interval", async () => {
    const values: Record<string, string> = {
      STRIPE_PRICE_INDIVIDUAL_MONTHLY: "price_monthly_new",
      STRIPE_PRICE_INDIVIDUAL_YEARLY: "price_yearly_new",
    };
    mocks.getRuntimeConfigValue.mockImplementation(async (key: string) =>
      values[key] || null,
    );

    await expect(mapStripePriceIdToPlanAndInterval("price_monthly_new")).resolves.toEqual({
      plan: "INDIVIDUAL",
      billingInterval: "MONTH",
    });
    await expect(mapStripePriceIdToPlanAndInterval("price_yearly_new")).resolves.toEqual({
      plan: "INDIVIDUAL",
      billingInterval: "YEAR",
    });
  });

  it("defaults annual Stripe trials to 90 days when the env key is missing", async () => {
    mocks.getRuntimeConfigValue.mockResolvedValue(null);

    await expect(getStripeAnnualTrialDays()).resolves.toBe(90);
  });

  it("treats free-trial subscriptions with null trialEndsAt as inactive", () => {
    const entitlement = buildUnifiedEntitlementSnapshot({
      plan: "FREE_TRIAL",
      status: "TRIALING",
      provider: "TRIAL",
      platform: "web",
      trialEndsAt: null,
    });

    expect(entitlement.isActive).toBe(false);
  });

  it("treats active Free Access as non-card access until its end date", () => {
    const entitlement = buildUnifiedEntitlementSnapshot({
      plan: "INDIVIDUAL",
      status: "ACTIVE",
      provider: "ADMIN",
      platform: "web",
      accessType: "FREE_ACCESS",
      freeAccessEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    expect(entitlement).toMatchObject({
      accessType: "FREE_ACCESS",
      isActive: true,
      isTrial: false,
      autoRenew: false,
    });
  });

  it("keeps canceled trials active until the trial end date when renewal is off", () => {
    const entitlement = buildUnifiedEntitlementSnapshot({
      plan: "INDIVIDUAL",
      status: "TRIAL_CANCELED",
      provider: "STRIPE",
      platform: "web",
      accessType: "FREE_TRIAL",
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: true,
    });

    expect(entitlement).toMatchObject({
      accessType: "FREE_TRIAL",
      isActive: true,
      isTrial: true,
      autoRenew: false,
      cancelAtPeriodEnd: true,
    });
  });

  it("treats missing subscription rows as inactive Free Access until the canonical row exists", () => {
    const entitlement = buildUnifiedEntitlementSnapshot(null);

    expect(entitlement).toMatchObject({
      plan: "FREE_TRIAL",
      status: "UNKNOWN",
      accessType: "FREE_ACCESS",
      isActive: false,
      isTrial: false,
    });
  });
});
