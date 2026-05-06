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
  getRuntimeConfigValue: vi.fn(async (key: string) => {
    if (key.includes("IOS")) return "individual.ios";
    if (key.includes("ANDROID")) return "individual.android";
    return null;
  }),
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

import { applyIapStateToUser, normalizeAppleResult, normalizeGoogleResult, type NormalizedIapState } from "./iap-common";
import { prisma } from "@/lib/db";
import { mapAppleStatus } from "@/lib/iap-apple";

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

  it("maps Apple free-trial offers to TRIALING while preserving the store period end", async () => {
    vi.mocked(mapAppleStatus).mockReturnValue("ACTIVE");
    const expiresDate = Date.now() + 14 * 24 * 60 * 60 * 1000;

    const normalized = await normalizeAppleResult({
      environment: "Sandbox",
      rawStatus: 1,
      renewal: null,
      transaction: {
        transactionId: "1000000000002",
        originalTransactionId: "1000000000001",
        bundleId: "com.locateflow",
        productId: "individual.ios",
        purchaseDate: Date.now(),
        originalPurchaseDate: Date.now(),
        expiresDate,
        quantity: 1,
        type: "Auto-Renewable Subscription",
        inAppOwnershipType: "PURCHASED",
        signedDate: Date.now(),
        environment: "Sandbox",
        offerDiscountType: "FREE_TRIAL",
      },
    });

    expect(normalized).toMatchObject({
      status: "TRIALING",
      provider: "APP_STORE",
      billingInterval: "MONTH",
      expiresAt: new Date(expiresDate),
    });
  });

  it("maps original transaction unique races to a controlled ownership error", async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.subscription.upsert).mockRejectedValue({
      code: "P2002",
      meta: { target: ["originalTransactionId"] },
    });

    const state: NormalizedIapState = {
      platform: "ios",
      plan: "INDIVIDUAL",
      status: "ACTIVE",
      provider: "APP_STORE",
      productId: "individual.ios",
      billingInterval: "MONTH",
      originalTransactionId: "1000000000001",
      latestTransactionId: "1000000000002",
      purchaseToken: null,
      expiresAt: new Date(Date.now() + 86_400_000),
      gracePeriodEndsAt: null,
      environment: "Sandbox",
      raw: {},
    };

    await expect(applyIapStateToUser({ userId: "user-1", state }))
      .rejects
      .toThrow("IAP_TXN_OWNED_BY_ANOTHER_USER");
  });
});
