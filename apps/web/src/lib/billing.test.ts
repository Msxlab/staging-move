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
  getStripePriceIdForPlan,
} from "./billing";

describe("billing helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not fall back to monthly price for yearly checkout", async () => {
    mocks.getRuntimeConfigValue.mockImplementation(async (key: string) =>
      key === "STRIPE_PRICE_INDIVIDUAL" ? "price_monthly" : null,
    );

    await expect(getStripePriceIdForPlan("INDIVIDUAL", "yearly")).resolves.toBeNull();
    expect(mocks.getRuntimeConfigValue).toHaveBeenCalledWith("STRIPE_PRICE_INDIVIDUAL_YEARLY");
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
