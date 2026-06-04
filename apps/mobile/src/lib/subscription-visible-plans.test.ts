import { describe, expect, it } from "vitest";
import {
  shouldRenderMobileSubscriptionPlanCard,
  shouldShowMobileSubscriptionPlan,
} from "./subscription-visible-plans";

describe("shouldShowMobileSubscriptionPlan", () => {
  it("shows every plan in non-native environments", () => {
    expect(shouldShowMobileSubscriptionPlan({
      planKey: "FAMILY",
      currentPlanKey: null,
      isNativeStorePlatform: false,
      mobileStorePurchasesEnabled: false,
      hasConfiguredNativeSku: false,
    })).toBe(true);
  });

  it("keeps Family and Pro visible when native purchases are disabled for the build", () => {
    for (const planKey of ["INDIVIDUAL", "FAMILY", "PRO"]) {
      expect(shouldShowMobileSubscriptionPlan({
        planKey,
        currentPlanKey: null,
        isNativeStorePlatform: true,
        mobileStorePurchasesEnabled: false,
        hasConfiguredNativeSku: false,
      })).toBe(true);
    }
  });

  it("hides unavailable Family and Pro purchase cards when native purchases are enabled", () => {
    expect(shouldShowMobileSubscriptionPlan({
      planKey: "FAMILY",
      currentPlanKey: null,
      isNativeStorePlatform: true,
      mobileStorePurchasesEnabled: true,
      hasConfiguredNativeSku: false,
    })).toBe(false);
    expect(shouldShowMobileSubscriptionPlan({
      planKey: "PRO",
      currentPlanKey: null,
      isNativeStorePlatform: true,
      mobileStorePurchasesEnabled: true,
      hasConfiguredNativeSku: false,
    })).toBe(false);
  });

  it("shows active or configured Family and Pro plans when native purchases are enabled", () => {
    expect(shouldShowMobileSubscriptionPlan({
      planKey: "PRO",
      currentPlanKey: "PRO",
      isNativeStorePlatform: true,
      mobileStorePurchasesEnabled: true,
      hasConfiguredNativeSku: false,
    })).toBe(true);
    expect(shouldShowMobileSubscriptionPlan({
      planKey: "FAMILY",
      currentPlanKey: null,
      isNativeStorePlatform: true,
      mobileStorePurchasesEnabled: true,
      hasConfiguredNativeSku: true,
    })).toBe(true);
  });
});

describe("shouldRenderMobileSubscriptionPlanCard", () => {
  it("hides the duplicate Free Access card when the account summary already shows it", () => {
    expect(shouldRenderMobileSubscriptionPlanCard({
      planKey: "FREE_TRIAL",
      currentPlanKey: "FREE_TRIAL",
    })).toBe(false);
  });

  it("keeps paid and non-current free cards available", () => {
    expect(shouldRenderMobileSubscriptionPlanCard({
      planKey: "INDIVIDUAL",
      currentPlanKey: "FREE_TRIAL",
    })).toBe(true);
    expect(shouldRenderMobileSubscriptionPlanCard({
      planKey: "FREE_TRIAL",
      currentPlanKey: "INDIVIDUAL",
    })).toBe(true);
  });
});
