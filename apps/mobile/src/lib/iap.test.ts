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

vi.mock("@/lib/billing-flags", () => ({
  isMobileStorePurchasesEnabledForPlatform: vi.fn(() => true),
}));

vi.mock("@/lib/sentry", () => ({
  captureException: vi.fn(),
}));

import { buildVerifyBodyForPurchase } from "./iap";

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
