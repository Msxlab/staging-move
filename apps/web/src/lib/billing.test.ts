import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRuntimeConfigValue: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: {
      findUnique: vi.fn(),
      create: vi.fn(),
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
});
