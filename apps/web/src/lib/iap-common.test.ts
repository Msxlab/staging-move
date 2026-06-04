import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/runtime-config", () => ({
  getRuntimeConfigValue: vi.fn(async (key: string) => {
    const productIds: Record<string, string> = {
      MOBILE_IOS_PRODUCT_INDIVIDUAL: "individual.ios",
      MOBILE_IOS_PRODUCT_INDIVIDUAL_YEARLY: "individual.ios.yearly",
      MOBILE_IOS_PRODUCT_FAMILY: "family.ios",
      MOBILE_IOS_PRODUCT_FAMILY_YEARLY: "family.ios.yearly",
      MOBILE_IOS_PRODUCT_PRO: "pro.ios",
      MOBILE_IOS_PRODUCT_PRO_YEARLY: "pro.ios.yearly",
      MOBILE_ANDROID_PRODUCT_INDIVIDUAL: "individual.android",
      MOBILE_ANDROID_PRODUCT_INDIVIDUAL_YEARLY: "individual.android.yearly",
      MOBILE_ANDROID_PRODUCT_FAMILY: "family.android",
      MOBILE_ANDROID_PRODUCT_FAMILY_YEARLY: "family.android.yearly",
      MOBILE_ANDROID_PRODUCT_PRO: "pro.android",
      MOBILE_ANDROID_PRODUCT_PRO_YEARLY: "pro.android.yearly",
    };
    if (key === "APPLE_BUNDLE_ID") return "com.locateflow";
    if (key === "QA_RESETTABLE_ACCOUNT_EMAIL") return process.env.QA_RESETTABLE_ACCOUNT_EMAIL || null;
    if (key === "GOOGLE_PLAY_TEST_PURCHASE_USER_EMAILS") return process.env.GOOGLE_PLAY_TEST_PURCHASE_USER_EMAILS || null;
    return productIds[key] || null;
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

import {
  applyIapStateToUser,
  hashPurchaseToken,
  normalizeAppleResult,
  normalizeAppleTransactionPayload,
  normalizeGoogleResult,
  mapProductIdToPlan,
  refreshGoogleSubscriptionFor,
  type NormalizedIapState,
} from "./iap-common";
import { prisma } from "@/lib/db";
import { mapAppleStatus } from "@/lib/iap-apple";
import { acknowledgeGoogleSubscription, getGoogleSubscription, mapGoogleSubscriptionState } from "@/lib/iap-google";

const originalEnv = { ...process.env };

describe("IAP normalization", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
    vi.mocked(mapGoogleSubscriptionState).mockReturnValue("ACTIVE");
  });

  it("maps configured Family and Pro store product IDs to internal plans", async () => {
    await expect(mapProductIdToPlan("ios", "family.ios.yearly")).resolves.toEqual({
      plan: "FAMILY",
      billingInterval: "YEAR",
    });
    await expect(mapProductIdToPlan("android", "pro.android")).resolves.toEqual({
      plan: "PRO",
      billingInterval: "MONTH",
    });
  });

  it("rejects store product IDs that are not configured", async () => {
    await expect(mapProductIdToPlan("ios", "family.ios.fake")).resolves.toBeNull();
  });

  it("preserves Google Play test purchases as sandbox state after store verification", async () => {
    process.env.APP_ENV = "production";

    const normalized = await normalizeGoogleResult({
      packageName: "com.locateflow",
      purchaseToken: "purchase-token",
      response: {
        testPurchase: {},
        latestOrderId: "GPA.123",
        subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
        lineItems: [{ productId: "individual.android" }],
      },
    });

    expect(normalized).toMatchObject({
      provider: "PLAY_STORE",
      productId: "individual.android",
      environment: "Sandbox",
    });
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

  it("keeps canceled Apple auto-renewal active until the store period ends", async () => {
    vi.mocked(mapAppleStatus).mockReturnValue("ACTIVE");
    const expiresDate = Date.now() + 10 * 24 * 60 * 60 * 1000;

    const normalized = await normalizeAppleResult({
      environment: "Sandbox",
      rawStatus: 1,
      renewal: {
        originalTransactionId: "1000000000001",
        autoRenewProductId: "individual.ios",
        productId: "individual.ios",
        autoRenewStatus: 0,
        environment: "Sandbox",
      },
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
      },
    });

    expect(normalized).toMatchObject({
      status: "CANCEL_AT_PERIOD_END",
      expiresAt: new Date(expiresDate),
    });
  });

  it("normalizes a locally verified Apple signed transaction when server lookup is unavailable", async () => {
    const expiresDate = Date.now() + 90 * 24 * 60 * 60 * 1000;

    const normalized = await normalizeAppleTransactionPayload({
      transactionId: "1000000000003",
      originalTransactionId: "1000000000001",
      bundleId: "com.locateflow",
      productId: "individual.ios.yearly",
      purchaseDate: Date.now(),
      originalPurchaseDate: Date.now(),
      expiresDate,
      quantity: 1,
      type: "Auto-Renewable Subscription",
      inAppOwnershipType: "PURCHASED",
      signedDate: Date.now(),
      environment: "Sandbox",
      offerDiscountType: "FREE_TRIAL",
    });

    expect(normalized).toMatchObject({
      status: "TRIALING",
      provider: "APP_STORE",
      productId: "individual.ios.yearly",
      billingInterval: "YEAR",
      originalTransactionId: "1000000000001",
      latestTransactionId: "1000000000003",
      expiresAt: new Date(expiresDate),
    });
  });

  it("rejects locally verified Apple transactions for another bundle", async () => {
    await expect(
      normalizeAppleTransactionPayload({
        transactionId: "1000000000003",
        originalTransactionId: "1000000000001",
        bundleId: "com.other.app",
        productId: "individual.ios",
        purchaseDate: Date.now(),
        originalPurchaseDate: Date.now(),
        expiresDate: Date.now() + 86_400_000,
        quantity: 1,
        type: "Auto-Renewable Subscription",
        inAppOwnershipType: "PURCHASED",
        signedDate: Date.now(),
        environment: "Sandbox",
      }),
    ).rejects.toThrow("APPLE_JWS_BUNDLE_MISMATCH");
  });

  it("maps Google Play canceled subscriptions to cancel-at-period-end while expiry remains", async () => {
    vi.mocked(mapGoogleSubscriptionState).mockReturnValueOnce("CANCEL_AT_PERIOD_END");

    const normalized = await normalizeGoogleResult({
      packageName: "com.locateflow.mobile",
      purchaseToken: "purchase-token",
      response: {
        latestOrderId: "GPA.123",
        subscriptionState: "SUBSCRIPTION_STATE_CANCELED",
        lineItems: [{ productId: "individual.android", expiryTime: "2027-01-01T00:00:00Z" }],
      },
    });

    expect(normalized).toMatchObject({
      status: "CANCEL_AT_PERIOD_END",
      provider: "PLAY_STORE",
      expiresAt: new Date("2027-01-01T00:00:00Z"),
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

  it("prevents restoring a Google Play purchase token onto another account", async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
      id: "sub-owned",
      userId: "user-owner",
    } as any);

    const state: NormalizedIapState = {
      platform: "android",
      plan: "INDIVIDUAL",
      status: "ACTIVE",
      provider: "PLAY_STORE",
      productId: "individual.android",
      billingInterval: "MONTH",
      originalTransactionId: "GPA.123",
      latestTransactionId: "GPA.123",
      purchaseToken: "purchase-token",
      expiresAt: new Date(Date.now() + 86_400_000),
      gracePeriodEndsAt: null,
      environment: "Sandbox",
      raw: {},
    };

    await expect(applyIapStateToUser({ userId: "user-other", state }))
      .rejects
      .toThrow("IAP_TXN_OWNED_BY_ANOTHER_USER");
    expect(prisma.subscription.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { purchaseTokenHash: hashPurchaseToken("purchase-token") },
          { purchaseToken: "purchase-token" },
        ],
      },
      select: { id: true, userId: true },
    });
  });

  it("maps Google Play purchase-token unique races to a controlled ownership error", async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.subscription.upsert).mockRejectedValue({
      code: "P2002",
      meta: { target: ["purchaseTokenHash"] },
    });

    const state: NormalizedIapState = {
      platform: "android",
      plan: "INDIVIDUAL",
      status: "ACTIVE",
      provider: "PLAY_STORE",
      productId: "individual.android",
      billingInterval: "MONTH",
      originalTransactionId: "GPA.123",
      latestTransactionId: "GPA.123",
      purchaseToken: "purchase-token",
      expiresAt: new Date(Date.now() + 86_400_000),
      gracePeriodEndsAt: null,
      environment: "Sandbox",
      raw: {},
    };

    await expect(applyIapStateToUser({ userId: "user-1", state }))
      .rejects
      .toThrow("IAP_TXN_OWNED_BY_ANOTHER_USER");
  });

  it("allows the same user to refresh an already-owned Google Play purchase token", async () => {
    vi.mocked(prisma.subscription.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "sub-owned",
        userId: "user-1",
        status: "ACTIVE",
        provider: "PLAY_STORE",
        accessType: "PAID",
      } as any);
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
      id: "sub-owned",
      userId: "user-1",
    } as any);
    vi.mocked(prisma.subscription.upsert).mockResolvedValue({
      id: "sub-owned",
      userId: "user-1",
      status: "ACTIVE",
    } as any);

    const state: NormalizedIapState = {
      platform: "android",
      plan: "INDIVIDUAL",
      status: "ACTIVE",
      provider: "PLAY_STORE",
      productId: "individual.android",
      billingInterval: "MONTH",
      originalTransactionId: "GPA.123",
      latestTransactionId: "GPA.123",
      purchaseToken: "purchase-token",
      expiresAt: new Date(Date.now() + 86_400_000),
      gracePeriodEndsAt: null,
      environment: "Sandbox",
      raw: {},
    };

    await expect(applyIapStateToUser({ userId: "user-1", state })).resolves.toMatchObject({
      userId: "user-1",
    });
    expect(prisma.subscription.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({
        purchaseTokenHash: hashPurchaseToken("purchase-token"),
      }),
    }));
  });

  it("rejects Google Play test purchases for non-allowlisted users in production billing environments", async () => {
    process.env.APP_ENV = "production";
    process.env.QA_RESETTABLE_ACCOUNT_EMAIL = "mobile.qa@locateflow.com";
    vi.mocked(prisma.subscription.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ email: "customer@example.com" } as any);

    const state: NormalizedIapState = {
      platform: "android",
      plan: "INDIVIDUAL",
      status: "ACTIVE",
      provider: "PLAY_STORE",
      productId: "individual.android",
      billingInterval: "YEAR",
      originalTransactionId: "GPA.123",
      latestTransactionId: "GPA.123",
      purchaseToken: "purchase-token",
      expiresAt: new Date(Date.now() + 86_400_000),
      gracePeriodEndsAt: null,
      environment: "Sandbox",
      raw: { testPurchase: {} },
    };

    await expect(applyIapStateToUser({ userId: "user-1", state }))
      .rejects
      .toThrow("GOOGLE_TEST_PURCHASE_IN_PRODUCTION");
    expect(prisma.subscription.upsert).not.toHaveBeenCalled();
  });

  it("allows Google Play test purchases for the configured QA account in production billing environments", async () => {
    process.env.APP_ENV = "production";
    process.env.QA_RESETTABLE_ACCOUNT_EMAIL = "mobile.qa@locateflow.com";
    vi.mocked(prisma.subscription.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ email: "mobile.qa@locateflow.com" } as any);
    vi.mocked(prisma.subscription.upsert).mockResolvedValue({
      id: "sub-test",
      userId: "user-1",
      status: "ACTIVE",
    } as any);

    const state: NormalizedIapState = {
      platform: "android",
      plan: "INDIVIDUAL",
      status: "ACTIVE",
      provider: "PLAY_STORE",
      productId: "individual.android",
      billingInterval: "YEAR",
      originalTransactionId: "GPA.123",
      latestTransactionId: "GPA.123",
      purchaseToken: "purchase-token",
      expiresAt: new Date(Date.now() + 86_400_000),
      gracePeriodEndsAt: null,
      environment: "Sandbox",
      raw: { testPurchase: {} },
    };

    await expect(applyIapStateToUser({ userId: "user-1", state })).resolves.toMatchObject({
      userId: "user-1",
    });
    expect(prisma.subscription.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({
        appStoreEnvironment: "Sandbox",
        provider: "PLAY_STORE",
      }),
    }));
  });

  it("blocks a new store purchase when an active Stripe subscription already exists", async () => {
    vi.mocked(prisma.subscription.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "sub-stripe",
        userId: "user-1",
        status: "ACTIVE",
        provider: "STRIPE",
        accessType: "PAID",
        stripeSubscriptionId: "sub_123",
      } as any);
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null);

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
      .toThrow("ACTIVE_SUBSCRIPTION_MANAGED_ELSEWHERE");
    expect(prisma.subscription.upsert).not.toHaveBeenCalled();
  });

  it("clears stale Stripe fields when an expired Stripe user starts a store subscription", async () => {
    vi.mocked(prisma.subscription.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "sub-expired",
        userId: "user-1",
        status: "EXPIRED",
        provider: "STRIPE",
        accessType: "PAID",
        stripeSubscriptionId: "sub_old",
      } as any);
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.subscription.upsert).mockResolvedValue({
      id: "sub-expired",
      userId: "user-1",
      status: "ACTIVE",
    } as any);

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

    await applyIapStateToUser({ userId: "user-1", state });

    expect(prisma.subscription.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({
        provider: "APP_STORE",
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        stripePriceId: null,
        stripeCurrentPeriodEnd: null,
      }),
    }));
  });

  it("acknowledges pending active Google Play subscriptions before returning entitlement state", async () => {
    vi.mocked(getGoogleSubscription).mockResolvedValue({
      packageName: "com.locateflow.mobile",
      purchaseToken: "purchase-token",
      response: {
        latestOrderId: "GPA.123",
        subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
        acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
        lineItems: [{ productId: "individual.android" }],
      },
    });
    vi.mocked(acknowledgeGoogleSubscription).mockResolvedValue();

    const normalized = await refreshGoogleSubscriptionFor("purchase-token");

    expect(acknowledgeGoogleSubscription).toHaveBeenCalledWith({
      purchaseToken: "purchase-token",
      productId: "individual.android",
    });
    expect(normalized).toMatchObject({
      provider: "PLAY_STORE",
      productId: "individual.android",
      status: "ACTIVE",
    });
  });

  it("does not return durable Google Play entitlement state when acknowledgement fails", async () => {
    vi.mocked(getGoogleSubscription).mockResolvedValue({
      packageName: "com.locateflow.mobile",
      purchaseToken: "purchase-token",
      response: {
        latestOrderId: "GPA.123",
        subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
        acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
        lineItems: [{ productId: "individual.android" }],
      },
    });
    vi.mocked(acknowledgeGoogleSubscription).mockRejectedValue(new Error("GOOGLE_ACK_503:down"));

    await expect(refreshGoogleSubscriptionFor("purchase-token")).rejects.toThrow("GOOGLE_ACK_503");
  });
});
