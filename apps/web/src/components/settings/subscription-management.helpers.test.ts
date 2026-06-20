import { describe, expect, it } from "vitest";
import { shouldShowConsumerFreePanel } from "./subscription-management.helpers";

describe("shouldShowConsumerFreePanel", () => {
  it("shows the free panel for a loaded non-paying consumer (managementKind none)", () => {
    expect(shouldShowConsumerFreePanel({ consumerFree: true, loading: false, managementKind: "none" })).toBe(true);
  });

  it("never shows for a real or lapsed stripe/store payer (they keep management)", () => {
    expect(shouldShowConsumerFreePanel({ consumerFree: true, loading: false, managementKind: "stripe" })).toBe(false);
    expect(shouldShowConsumerFreePanel({ consumerFree: true, loading: false, managementKind: "store" })).toBe(false);
  });

  it("never shows while loading or before the entitlement loads", () => {
    expect(shouldShowConsumerFreePanel({ consumerFree: true, loading: true, managementKind: "none" })).toBe(false);
    expect(shouldShowConsumerFreePanel({ consumerFree: true, loading: false, managementKind: null })).toBe(false);
    expect(shouldShowConsumerFreePanel({ consumerFree: true, loading: false, managementKind: undefined })).toBe(false);
  });

  it("never shows when the flag is off (default behavior preserved)", () => {
    expect(shouldShowConsumerFreePanel({ consumerFree: false, loading: false, managementKind: "none" })).toBe(false);
  });

  it("shows for an admin-granted free row (not a payer)", () => {
    expect(shouldShowConsumerFreePanel({ consumerFree: true, loading: false, managementKind: "admin" })).toBe(true);
  });
});
