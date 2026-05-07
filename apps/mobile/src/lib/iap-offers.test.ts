import { describe, expect, it } from "vitest";
import {
  buildSubscriptionPurchaseRequest,
  IAP_ANDROID_OFFER_TOKEN_MISSING_MESSAGE,
  normalizeSubscriptionProduct,
  selectAndroidSubscriptionOffer,
} from "./iap-offers";

function androidProduct(productId: string, billingPeriod: string, offerToken: string) {
  return normalizeSubscriptionProduct({
    id: productId,
    title: productId,
    description: "",
    subscriptionOfferDetailsAndroid: [
      {
        basePlanId: billingPeriod === "P1Y" ? "annual" : "monthly",
        offerId: null,
        offerToken,
        pricingPhases: {
          pricingPhaseList: [
            {
              billingPeriod,
              formattedPrice: billingPeriod === "P1Y" ? "$99.99" : "$9.99",
            },
          ],
        },
      },
    ],
  });
}

describe("Android subscription offer handling", () => {
  it("keeps the monthly product offerToken from Google Play product details", () => {
    const product = androidProduct("locateflow_individual_monthly", "P1M", "monthly-token");

    expect(product.offerToken).toBe("monthly-token");
    expect(selectAndroidSubscriptionOffer(product, "monthly")?.offerToken).toBe("monthly-token");
  });

  it("keeps the annual product offerToken from Google Play product details", () => {
    const product = androidProduct("locateflow_individual_yearly", "P1Y", "annual-token");

    expect(product.offerToken).toBe("annual-token");
    expect(selectAndroidSubscriptionOffer(product, "yearly")?.offerToken).toBe("annual-token");
  });

  it("adds subscriptionOffers to Android subscription purchase requests", () => {
    expect(
      buildSubscriptionPurchaseRequest({
        platform: "android",
        productId: "locateflow_individual_monthly",
        offerToken: "monthly-token",
      }),
    ).toEqual({
      request: {
        android: {
          skus: ["locateflow_individual_monthly"],
          subscriptionOffers: [
            { sku: "locateflow_individual_monthly", offerToken: "monthly-token" },
          ],
        },
      },
      type: "subs",
    });
  });

  it("fails safely when Android subscription offerToken is missing", () => {
    expect(() =>
      buildSubscriptionPurchaseRequest({
        platform: "android",
        productId: "locateflow_individual_monthly",
      }),
    ).toThrow(IAP_ANDROID_OFFER_TOKEN_MISSING_MESSAGE);
  });

  it("keeps iOS subscription purchase requests independent of Android offers", () => {
    expect(
      buildSubscriptionPurchaseRequest({
        platform: "ios",
        productId: "locateflow_individual_ios",
      }),
    ).toEqual({
      request: { ios: { sku: "locateflow_individual_ios" } },
      type: "subs",
    });
  });
});

