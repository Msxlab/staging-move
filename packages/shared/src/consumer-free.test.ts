import { describe, expect, it } from "vitest";
import type { EffectiveEntitlement } from "./entitlement";
import { applyConsumerFreeOverride } from "./consumer-free";

/** Minimal EffectiveEntitlement fixture; override only the fields a case needs. */
function eff(over: Partial<EffectiveEntitlement>): EffectiveEntitlement {
  return {
    hasAccess: false,
    hasPremium: false,
    effectivePlan: "FREE_TRIAL",
    effectiveStatus: "FREE_ACCESS_ACTIVE",
    accessSource: "DEFAULT_FREE_ACCESS",
    billingProvider: "UNKNOWN",
    accessType: "FREE_ACCESS",
    rawStatus: null,
    platform: null,
    expiresAt: null,
    renewsAt: null,
    autoRenew: false,
    cancelAtPeriodEnd: false,
    managementKind: "none",
    isManualOverride: false,
    reason: "base",
    warnings: [],
    ...over,
  } as EffectiveEntitlement;
}

describe("applyConsumerFreeOverride", () => {
  it("returns the input unchanged when disabled (reversible)", () => {
    const input = eff({});
    expect(applyConsumerFreeOverride(input, false)).toBe(input);
  });

  it("upgrades a pure free / no-management consumer to PRO when enabled", () => {
    const res = applyConsumerFreeOverride(eff({ managementKind: "none", hasPremium: false }), true);
    expect(res).toMatchObject({
      hasAccess: true,
      hasPremium: true,
      effectivePlan: "PRO",
      effectiveStatus: "PAID_ACTIVE",
      accessType: "PAID",
    });
  });

  it("upgrades the no-subscription-row result (managementKind none)", () => {
    const res = applyConsumerFreeOverride(eff({ reason: "No subscription row" }), true);
    expect(res.hasPremium).toBe(true);
    expect(res.effectivePlan).toBe("PRO");
  });

  it("leaves an active payer untouched (already premium)", () => {
    const input = eff({ hasPremium: true, hasAccess: true, effectivePlan: "INDIVIDUAL", managementKind: "stripe", effectiveStatus: "PAID_ACTIVE" });
    expect(applyConsumerFreeOverride(input, true)).toBe(input);
  });

  it("does NOT upgrade a lapsed/canceled Stripe payer (H3 — keeps no access)", () => {
    const input = eff({ hasPremium: false, hasAccess: false, managementKind: "stripe", effectiveStatus: "CANCELED" });
    const res = applyConsumerFreeOverride(input, true);
    expect(res).toBe(input);
    expect(res.hasAccess).toBe(false);
  });

  it("does NOT upgrade a refunded Stripe payer (H3)", () => {
    const input = eff({ managementKind: "stripe", effectiveStatus: "REFUNDED" });
    expect(applyConsumerFreeOverride(input, true)).toBe(input);
  });

  it("does NOT upgrade a lapsed store (Apple/Play) payer (H3)", () => {
    const input = eff({ managementKind: "store", effectiveStatus: "PROVIDER_TRIAL_EXPIRED" });
    expect(applyConsumerFreeOverride(input, true)).toBe(input);
  });

  it("does NOT upgrade an admin-managed row (left to the admin layer)", () => {
    const input = eff({ managementKind: "admin", effectiveStatus: "MANUAL_PREMIUM_EXPIRED" });
    expect(applyConsumerFreeOverride(input, true)).toBe(input);
  });
});
