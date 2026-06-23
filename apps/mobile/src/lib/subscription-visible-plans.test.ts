import { describe, expect, it } from "vitest";
import {
  isMobileConsumerFreeEntitlement,
  shouldShowMobileConsumerFreePanel,
  shouldRenderMobileSubscriptionPlanCard,
  shouldShowMobileSubscriptionPlan,
} from "./subscription-visible-plans";

describe("isMobileConsumerFreeEntitlement", () => {
  it("is true for an active full-access consumer without billing management", () => {
    expect(isMobileConsumerFreeEntitlement({
      managementKind: "none",
      effectivePlanKey: "PRO",
      effectiveActive: true,
    })).toBe(true);
    expect(isMobileConsumerFreeEntitlement({
      managementKind: "none",
      effectivePlanKey: "FREE_TRIAL",
      effectiveStatus: "FREE_ACCESS",
      effectiveActive: true,
    })).toBe(true);
  });

  it("is false for real stripe/store payers and inactive entitlements (flag-off parity)", () => {
    for (const managementKind of ["stripe", "store"]) {
      expect(isMobileConsumerFreeEntitlement({
        managementKind,
        effectivePlanKey: "PRO",
        effectiveActive: true,
      })).toBe(false);
    }
    // managementKind == null is the flag-OFF / not-loaded shape → never free.
    expect(isMobileConsumerFreeEntitlement({
      managementKind: null,
      effectivePlanKey: "PRO",
      effectiveActive: true,
    })).toBe(false);
    expect(isMobileConsumerFreeEntitlement({
      managementKind: "none",
      effectivePlanKey: "PRO",
      effectiveActive: false,
    })).toBe(false);
  });
});

describe("shouldShowMobileConsumerFreePanel", () => {
  it("shows the included-access panel for an active paid entitlement without billing management", () => {
    expect(shouldShowMobileConsumerFreePanel({
      loading: false,
      managementKind: "none",
      effectivePlanKey: "PRO",
      effectiveActive: true,
    })).toBe(true);
  });

  it("shows the included-access panel for active free-access consumer accounts on staging", () => {
    expect(shouldShowMobileConsumerFreePanel({
      loading: false,
      managementKind: "none",
      effectivePlanKey: "FREE_TRIAL",
      effectiveStatus: "FREE_ACCESS",
      effectiveActive: true,
    })).toBe(true);
  });

  it("waits until the entitlement has loaded", () => {
    expect(shouldShowMobileConsumerFreePanel({
      loading: true,
      managementKind: "none",
      effectivePlanKey: "PRO",
      effectiveActive: true,
    })).toBe(false);
    expect(shouldShowMobileConsumerFreePanel({
      loading: false,
      managementKind: null,
      effectivePlanKey: "PRO",
      effectiveActive: true,
    })).toBe(false);
  });

  it("keeps real Stripe and store subscriptions on the billing-management screen", () => {
    for (const managementKind of ["stripe", "store"]) {
      expect(shouldShowMobileConsumerFreePanel({
        loading: false,
        managementKind,
        effectivePlanKey: "PRO",
        effectiveActive: true,
      })).toBe(false);
    }
  });

  it("does not show for inactive or free-trial entitlements", () => {
    expect(shouldShowMobileConsumerFreePanel({
      loading: false,
      managementKind: "none",
      effectivePlanKey: "PRO",
      effectiveActive: false,
    })).toBe(false);
    expect(shouldShowMobileConsumerFreePanel({
      loading: false,
      managementKind: "none",
      effectivePlanKey: "FREE_TRIAL",
      effectiveActive: true,
    })).toBe(false);
  });
});

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
