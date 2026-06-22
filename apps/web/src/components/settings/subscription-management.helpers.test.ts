import { describe, expect, it } from "vitest";
import { shouldShowConsumerFreePanel } from "./subscription-management.helpers";

describe("shouldShowConsumerFreePanel", () => {
  it("shows the free panel for a loaded non-paying consumer (managementKind none)", () => {
    expect(shouldShowConsumerFreePanel({
      consumerFree: true,
      loading: false,
      managementKind: "none",
      effectivePlanKey: "PRO",
      effectiveActive: true,
    })).toBe(true);
  });

  it("never shows for a real or lapsed stripe/store payer (they keep management)", () => {
    expect(shouldShowConsumerFreePanel({
      consumerFree: true,
      loading: false,
      managementKind: "stripe",
      effectivePlanKey: "PRO",
      effectiveActive: true,
    })).toBe(false);
    expect(shouldShowConsumerFreePanel({
      consumerFree: true,
      loading: false,
      managementKind: "store",
      effectivePlanKey: "PRO",
      effectiveActive: true,
    })).toBe(false);
  });

  it("never shows while loading or before the entitlement loads", () => {
    expect(shouldShowConsumerFreePanel({
      consumerFree: true,
      loading: true,
      managementKind: "none",
      effectivePlanKey: "PRO",
      effectiveActive: true,
    })).toBe(false);
    expect(shouldShowConsumerFreePanel({
      consumerFree: true,
      loading: false,
      managementKind: null,
      effectivePlanKey: "PRO",
      effectiveActive: true,
    })).toBe(false);
    expect(shouldShowConsumerFreePanel({
      consumerFree: true,
      loading: false,
      managementKind: undefined,
      effectivePlanKey: "PRO",
      effectiveActive: true,
    })).toBe(false);
  });

  it("never shows when the flag is off (default behavior preserved)", () => {
    expect(shouldShowConsumerFreePanel({
      consumerFree: false,
      loading: false,
      managementKind: "none",
      effectivePlanKey: "PRO",
      effectiveActive: true,
    })).toBe(false);
  });

  it("shows for active included access without billing management", () => {
    expect(shouldShowConsumerFreePanel({
      consumerFree: true,
      loading: false,
      managementKind: "none",
      effectivePlanKey: "FAMILY",
      effectiveActive: true,
    })).toBe(true);
  });

  it("does not show when the effective entitlement is inactive or free-tier", () => {
    expect(shouldShowConsumerFreePanel({
      consumerFree: true,
      loading: false,
      managementKind: "none",
      effectivePlanKey: "PRO",
      effectiveActive: false,
    })).toBe(false);
    expect(shouldShowConsumerFreePanel({
      consumerFree: true,
      loading: false,
      managementKind: "none",
      effectivePlanKey: "FREE_TRIAL",
      effectiveActive: true,
    })).toBe(false);
  });
});
