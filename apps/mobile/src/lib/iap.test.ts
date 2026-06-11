import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: { android: { package: "com.locateflow.mobile" } },
    manifest: null,
  },
}));

vi.mock("@/lib/api", () => ({
  api: { post: vi.fn() },
}));

// Hoisted so the (hoisted) vi.mock factory below can reference it safely.
const { isEnabled } = vi.hoisted(() => ({ isEnabled: vi.fn(() => true) }));
vi.mock("@/lib/billing-flags", () => ({
  isMobileStorePurchasesEnabledForPlatform: isEnabled,
}));

vi.mock("@/lib/sentry", () => ({
  captureException: vi.fn(),
}));

import { buildReconcileVerifyBody, buildVerifyBodyForPurchase, reconcilePendingPurchases } from "./iap";

// NOTE: the native store calls (initConnection / getAvailablePurchases /
// finishTransaction) go through a CommonJS `require("expo-iap")` that can't be
// intercepted in the node test env, so the reconciler's per-purchase decision
// is covered via the extracted PURE helper `buildReconcileVerifyBody`, and the
// orchestration via its store-disabled early-return (no native call). The
// finish-after-verify ordering itself mirrors the reviewed restorePurchases path.
describe("buildReconcileVerifyBody — which pending purchases are recoverable", () => {
  it("keeps an iOS transaction that has a signed JWS payload", () => {
    expect(
      buildReconcileVerifyBody({ transactionId: "2000000123456789", purchaseToken: "signed-jws" }, "ios"),
    ).toEqual({
      platform: "ios",
      signedTransaction: "signed-jws",
      transactionId: "2000000123456789",
    });
  });

  it("returns null for an iOS transaction with no signed payload (must NOT be finished)", () => {
    // Skipping (null) leaves the transaction unfinished so the store re-delivers
    // it — finishing an unverified transaction would forfeit that retry.
    expect(buildReconcileVerifyBody({ transactionId: "x" }, "ios")).toBeNull();
  });

  it("backfills the Android productId from the purchase id list when absent", () => {
    expect(
      buildReconcileVerifyBody(
        { ids: ["locateflow_individual_monthly"], purchaseTokenAndroid: "play-token" },
        "android",
      ),
    ).toEqual({
      platform: "android",
      purchaseToken: "play-token",
      productId: "locateflow_individual_monthly",
    });
  });
});

describe("reconcilePendingPurchases — store-disabled guard", () => {
  it("no-ops (reconciled:0) without touching the store when purchases are disabled", async () => {
    isEnabled.mockReturnValueOnce(false);
    await expect(reconcilePendingPurchases()).resolves.toEqual({ reconciled: 0 });
  });
});

describe("IAP verification payloads", () => {
  it("uses the StoreKit purchaseToken JWS for iOS verification", () => {
    expect(
      buildVerifyBodyForPurchase(
        {
          id: "2000000123456789",
          originalTransactionIdentifierIOS: "2000000000000001",
          purchaseToken: "signed-transaction-jws",
        },
        "ios",
      ),
    ).toEqual({
      platform: "ios",
      signedTransaction: "signed-transaction-jws",
      transactionId: "2000000123456789",
    });
  });

  it("does not send the original iOS transaction id as the transaction id", () => {
    expect(
      buildVerifyBodyForPurchase(
        {
          originalTransactionIdentifierIOS: "2000000000000001",
          purchaseToken: "signed-transaction-jws",
        },
        "ios",
      ),
    ).toEqual({
      platform: "ios",
      signedTransaction: "signed-transaction-jws",
    });
  });

  it("accepts expo-iap's iOS JWS field variants", () => {
    expect(
      buildVerifyBodyForPurchase(
        {
          jwsRepresentationIOS: "signed-transaction-ios",
          transactionId: "2000000222222222",
        },
        "ios",
      ),
    ).toEqual({
      platform: "ios",
      signedTransaction: "signed-transaction-ios",
      transactionId: "2000000222222222",
    });
  });

  it("uses the Android purchase token and subscription id", () => {
    expect(
      buildVerifyBodyForPurchase(
        {
          ids: ["locateflow_individual_monthly"],
          purchaseTokenAndroid: "play-purchase-token",
        },
        "android",
      ),
    ).toEqual({
      platform: "android",
      purchaseToken: "play-purchase-token",
      productId: "locateflow_individual_monthly",
    });
  });
});
