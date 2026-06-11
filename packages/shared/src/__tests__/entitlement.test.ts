import { describe, expect, it } from "vitest";
import { getEffectiveEntitlement } from "../entitlement";

const NOW = new Date("2026-05-08T12:00:00Z");
const PAST = new Date("2026-04-01T00:00:00Z");
const FUTURE = new Date("2026-08-01T00:00:00Z");

describe("getEffectiveEntitlement", () => {
  it("returns NONE for missing subscription rows", () => {
    const e = getEffectiveEntitlement(null, NOW);
    expect(e.hasAccess).toBe(false);
    expect(e.hasPremium).toBe(false);
    expect(e.effectiveStatus).toBe("UNKNOWN");
    expect(e.accessSource).toBe("NONE");
  });

  it("treats default Free Access (provider=TRIAL) before expiry as active free access", () => {
    const e = getEffectiveEntitlement(
      {
        plan: "FREE_TRIAL",
        status: "FREE_ACCESS",
        provider: "TRIAL",
        accessType: "FREE_ACCESS",
        freeAccessEndsAt: FUTURE,
      },
      NOW,
    );
    expect(e.hasAccess).toBe(true);
    expect(e.hasPremium).toBe(false);
    expect(e.effectiveStatus).toBe("FREE_ACCESS_ACTIVE");
    expect(e.accessSource).toBe("DEFAULT_FREE_ACCESS");
    expect(e.effectivePlan).toBe("FREE_TRIAL");
  });

  it("expires Free Access once freeAccessEndsAt passes", () => {
    const e = getEffectiveEntitlement(
      {
        plan: "FREE_TRIAL",
        status: "FREE_ACCESS",
        provider: "TRIAL",
        accessType: "FREE_ACCESS",
        freeAccessEndsAt: PAST,
      },
      NOW,
    );
    expect(e.hasAccess).toBe(false);
    expect(e.hasPremium).toBe(false);
    expect(e.effectiveStatus).toBe("FREE_ACCESS_EXPIRED");
  });

  it("treats Stripe trial with future trialEndsAt as PROVIDER_TRIAL_ACTIVE", () => {
    const e = getEffectiveEntitlement(
      {
        plan: "INDIVIDUAL",
        status: "TRIALING",
        provider: "STRIPE",
        accessType: "FREE_TRIAL",
        trialEndsAt: FUTURE,
        stripeSubscriptionId: "sub_x",
      },
      NOW,
    );
    expect(e.hasAccess).toBe(true);
    expect(e.hasPremium).toBe(true);
    expect(e.effectiveStatus).toBe("PROVIDER_TRIAL_ACTIVE");
    expect(e.accessSource).toBe("STRIPE");
    expect(e.autoRenew).toBe(true);
  });

  it("treats Stripe trial with past trialEndsAt as PROVIDER_TRIAL_EXPIRED", () => {
    const e = getEffectiveEntitlement(
      {
        plan: "INDIVIDUAL",
        status: "TRIALING",
        provider: "STRIPE",
        accessType: "FREE_TRIAL",
        trialEndsAt: PAST,
        stripeSubscriptionId: "sub_x",
      },
      NOW,
    );
    expect(e.hasAccess).toBe(false);
    expect(e.hasPremium).toBe(false);
    expect(e.effectiveStatus).toBe("PROVIDER_TRIAL_EXPIRED");
  });

  it("treats TRIAL_CANCELED with future trialEndsAt as still active until period end", () => {
    const e = getEffectiveEntitlement(
      {
        plan: "INDIVIDUAL",
        status: "TRIAL_CANCELED",
        provider: "STRIPE",
        accessType: "FREE_TRIAL",
        trialEndsAt: FUTURE,
        cancelAtPeriodEnd: true,
        stripeSubscriptionId: "sub_x",
      },
      NOW,
    );
    expect(e.hasAccess).toBe(true);
    expect(e.hasPremium).toBe(true);
    expect(e.effectiveStatus).toBe("PROVIDER_TRIAL_CANCELED");
    expect(e.autoRenew).toBe(false);
  });

  it("treats Stripe ACTIVE with provider=STRIPE as PAID_ACTIVE", () => {
    const e = getEffectiveEntitlement(
      {
        plan: "INDIVIDUAL",
        status: "ACTIVE",
        provider: "STRIPE",
        accessType: "PAID",
        currentPeriodEndsAt: FUTURE,
        stripeSubscriptionId: "sub_x",
      },
      NOW,
    );
    expect(e.hasAccess).toBe(true);
    expect(e.hasPremium).toBe(true);
    expect(e.effectiveStatus).toBe("PAID_ACTIVE");
    expect(e.accessSource).toBe("STRIPE");
    expect(e.managementKind).toBe("stripe");
  });

  it("treats Stripe ACTIVE + cancelAtPeriodEnd as PAID_CANCEL_AT_PERIOD_END while period remains", () => {
    const e = getEffectiveEntitlement(
      {
        plan: "INDIVIDUAL",
        status: "ACTIVE",
        provider: "STRIPE",
        accessType: "PAID",
        currentPeriodEndsAt: FUTURE,
        cancelAtPeriodEnd: true,
        stripeSubscriptionId: "sub_x",
      },
      NOW,
    );
    expect(e.hasAccess).toBe(true);
    expect(e.hasPremium).toBe(true);
    expect(e.effectiveStatus).toBe("PAID_CANCEL_AT_PERIOD_END");
    expect(e.autoRenew).toBe(false);
  });

  it("treats GRACE_PERIOD with future grace as still entitled", () => {
    const e = getEffectiveEntitlement(
      {
        plan: "INDIVIDUAL",
        status: "GRACE_PERIOD",
        provider: "PLAY_STORE",
        platform: "android",
        accessType: "PAID",
        gracePeriodEndsAt: FUTURE,
        purchaseTokenHash: "abc",
      },
      NOW,
    );
    expect(e.hasAccess).toBe(true);
    expect(e.hasPremium).toBe(true);
    expect(e.effectiveStatus).toBe("PAID_GRACE_PERIOD");
    expect(e.accessSource).toBe("PLAY_STORE");
  });

  it("keeps GRACE_PERIOD access via currentPeriodEndsAt when gracePeriodEndsAt is null (finding 4)", () => {
    // A paying Google grace-period customer whose row never got a
    // gracePeriodEndsAt must not be instantly locked out — fall back to the
    // period end so they keep access through the grace window.
    const e = getEffectiveEntitlement(
      {
        plan: "INDIVIDUAL",
        status: "GRACE_PERIOD",
        provider: "PLAY_STORE",
        platform: "android",
        accessType: "PAID",
        gracePeriodEndsAt: null,
        currentPeriodEndsAt: FUTURE,
        purchaseTokenHash: "abc",
      },
      NOW,
    );
    expect(e.hasAccess).toBe(true);
    expect(e.hasPremium).toBe(true);
    expect(e.effectiveStatus).toBe("PAID_GRACE_PERIOD");
  });

  it("revokes GRACE_PERIOD access when both grace and period end are past", () => {
    const e = getEffectiveEntitlement(
      {
        plan: "INDIVIDUAL",
        status: "GRACE_PERIOD",
        provider: "PLAY_STORE",
        platform: "android",
        accessType: "PAID",
        gracePeriodEndsAt: null,
        currentPeriodEndsAt: PAST,
        purchaseTokenHash: "abc",
      },
      NOW,
    );
    expect(e.hasAccess).toBe(false);
    expect(e.effectiveStatus).toBe("PAID_PAST_DUE");
  });

  it("treats PAST_DUE without grace as no access", () => {
    const e = getEffectiveEntitlement(
      {
        plan: "INDIVIDUAL",
        status: "PAST_DUE",
        provider: "STRIPE",
        accessType: "PAID",
        gracePeriodEndsAt: PAST,
        stripeSubscriptionId: "sub_x",
      },
      NOW,
    );
    expect(e.hasAccess).toBe(false);
    expect(e.effectiveStatus).toBe("PAID_PAST_DUE");
  });

  it("treats CANCELED Stripe sub as no access", () => {
    const e = getEffectiveEntitlement(
      {
        plan: "INDIVIDUAL",
        status: "CANCELED",
        provider: "STRIPE",
        accessType: "PAID",
        canceledAt: PAST,
        stripeSubscriptionId: "sub_x",
      },
      NOW,
    );
    expect(e.hasAccess).toBe(false);
    expect(e.effectiveStatus).toBe("CANCELED");
  });

  it("recognizes admin manual premium with future premiumUntil as MANUAL_PREMIUM_ACTIVE", () => {
    const e = getEffectiveEntitlement(
      {
        plan: "INDIVIDUAL",
        status: "ACTIVE",
        provider: "ADMIN",
        accessType: "FREE_ACCESS",
        premiumUntil: FUTURE,
        premiumGrantedBy: "admin_1",
      },
      NOW,
    );
    expect(e.hasAccess).toBe(true);
    expect(e.hasPremium).toBe(true);
    expect(e.effectiveStatus).toBe("MANUAL_PREMIUM_ACTIVE");
    expect(e.accessSource).toBe("ADMIN_MANUAL");
    expect(e.isManualOverride).toBe(true);
    expect(e.managementKind).toBe("admin");
    expect(e.effectivePlan).toBe("INDIVIDUAL");
  });

  it("expires admin manual premium when premiumUntil is past", () => {
    const e = getEffectiveEntitlement(
      {
        plan: "INDIVIDUAL",
        status: "ACTIVE",
        provider: "ADMIN",
        accessType: "FREE_ACCESS",
        premiumUntil: PAST,
        premiumGrantedBy: "admin_1",
      },
      NOW,
    );
    expect(e.hasAccess).toBe(false);
    expect(e.hasPremium).toBe(false);
    expect(e.effectiveStatus).toBe("MANUAL_PREMIUM_EXPIRED");
    expect(e.effectivePlan).toBe("FREE_TRIAL");
  });

  it("does not treat campaign-driven ADMIN row (no premiumGrantedBy) as manual premium", () => {
    const e = getEffectiveEntitlement(
      {
        plan: "INDIVIDUAL",
        status: "ACTIVE",
        provider: "ADMIN",
        accessType: "FREE_ACCESS",
        freeAccessEndsAt: FUTURE,
        // premiumGrantedBy intentionally null — this is the campaign path.
      },
      NOW,
    );
    expect(e.effectiveStatus).toBe("FREE_ACCESS_ACTIVE");
    expect(e.accessSource).toBe("CAMPAIGN");
    expect(e.isManualOverride).toBe(false);
    expect(e.hasPremium).toBe(false);
  });

  it("warns when admin manual premium has no premiumUntil set", () => {
    const e = getEffectiveEntitlement(
      {
        plan: "INDIVIDUAL",
        status: "ACTIVE",
        provider: "ADMIN",
        accessType: "FREE_ACCESS",
        premiumUntil: null,
        premiumGrantedBy: "admin_1",
      },
      NOW,
    );
    expect(e.warnings).toContain("Admin manual premium has no premiumUntil");
    expect(e.hasPremium).toBe(false);
  });

  it("warns when accessType=PAID is set on a non-payment provider", () => {
    const e = getEffectiveEntitlement(
      {
        plan: "INDIVIDUAL",
        status: "ACTIVE",
        provider: "ADMIN",
        accessType: "PAID",
        premiumUntil: FUTURE,
      },
      NOW,
    );
    expect(e.warnings.some((w) => w.includes("accessType=PAID"))).toBe(true);
  });

  it("warns when status=TRIALING but trialEndsAt is null", () => {
    const e = getEffectiveEntitlement(
      {
        plan: "INDIVIDUAL",
        status: "TRIALING",
        provider: "STRIPE",
        accessType: "FREE_TRIAL",
        trialEndsAt: null,
        stripeSubscriptionId: "sub_x",
      },
      NOW,
    );
    expect(e.warnings).toContain("status=TRIALING but trialEndsAt is null");
    expect(e.hasAccess).toBe(false);
  });

  it("warns when cancelAtPeriodEnd and autoRenew are both true", () => {
    const e = getEffectiveEntitlement(
      {
        plan: "INDIVIDUAL",
        status: "ACTIVE",
        provider: "STRIPE",
        accessType: "PAID",
        currentPeriodEndsAt: FUTURE,
        cancelAtPeriodEnd: true,
        autoRenew: true,
        stripeSubscriptionId: "sub_x",
      },
      NOW,
    );
    expect(e.warnings).toContain("cancelAtPeriodEnd=true but autoRenew=true (inconsistent)");
  });

  it("warns when provider=STRIPE in paid status without stripeSubscriptionId", () => {
    const e = getEffectiveEntitlement(
      {
        plan: "INDIVIDUAL",
        status: "ACTIVE",
        provider: "STRIPE",
        accessType: "PAID",
        currentPeriodEndsAt: FUTURE,
        stripeSubscriptionId: null,
      },
      NOW,
    );
    expect(e.warnings.some((w) => w.includes("stripeSubscriptionId is null"))).toBe(true);
  });

  it("treats REFUNDED as terminal no-access", () => {
    const e = getEffectiveEntitlement(
      {
        plan: "INDIVIDUAL",
        status: "REFUNDED",
        provider: "STRIPE",
        accessType: "PAID",
      },
      NOW,
    );
    expect(e.effectiveStatus).toBe("REFUNDED");
    expect(e.hasAccess).toBe(false);
  });

  it("PENDING_CHECKOUT with active free access underneath keeps free access", () => {
    const e = getEffectiveEntitlement(
      {
        plan: "FREE_TRIAL",
        status: "PENDING_CHECKOUT",
        provider: "STRIPE",
        accessType: "FREE_ACCESS",
        freeAccessEndsAt: FUTURE,
      },
      NOW,
    );
    expect(e.effectiveStatus).toBe("PENDING_CHECKOUT");
    expect(e.hasAccess).toBe(true);
    expect(e.hasPremium).toBe(false);
  });

  it("App Store paid active reports APP_STORE source", () => {
    const e = getEffectiveEntitlement(
      {
        plan: "INDIVIDUAL",
        status: "ACTIVE",
        provider: "APP_STORE",
        platform: "ios",
        accessType: "PAID",
        currentPeriodEndsAt: FUTURE,
        originalTransactionId: "txn_1",
      },
      NOW,
    );
    expect(e.accessSource).toBe("APP_STORE");
    expect(e.managementKind).toBe("store");
    expect(e.hasPremium).toBe(true);
  });

  it("legacy plan=FREE_TRIAL with future trialEndsAt grants free access only", () => {
    const e = getEffectiveEntitlement(
      {
        plan: "FREE_TRIAL",
        status: "TRIALING",
        provider: "TRIAL",
        accessType: null,
        trialEndsAt: FUTURE,
      },
      NOW,
    );
    // provider=TRIAL → treated as default free access; no provider-paid trial path.
    expect(e.hasAccess).toBe(true);
    expect(e.hasPremium).toBe(false);
  });
});
