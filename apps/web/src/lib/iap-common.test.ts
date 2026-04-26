import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/runtime-config", () => ({
  getRuntimeConfigValue: vi.fn(async () => "individual.android"),
}));

vi.mock("@/lib/iap-apple", () => ({
  getAppleSubscriptionStatus: vi.fn(),
  mapAppleStatus: vi.fn(),
}));

vi.mock("@/lib/iap-google", () => ({
  getGoogleSubscription: vi.fn(),
  acknowledgeGoogleSubscription: vi.fn(),
  mapGoogleSubscriptionState: vi.fn(() => "ACTIVE"),
}));

import { normalizeGoogleResult } from "./iap-common";

const originalEnv = { ...process.env };

describe("IAP normalization", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("rejects Google Play test purchases in production billing environments", async () => {
    process.env.APP_ENV = "production";

    await expect(
      normalizeGoogleResult({
        packageName: "com.locateflow",
        purchaseToken: "purchase-token",
        response: {
          testPurchase: {},
          latestOrderId: "GPA.123",
          subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
          lineItems: [{ productId: "individual.android" }],
        },
      }),
    ).rejects.toThrow("GOOGLE_TEST_PURCHASE_IN_PRODUCTION");
  });
});
