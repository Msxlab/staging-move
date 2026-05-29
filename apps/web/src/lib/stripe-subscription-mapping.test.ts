import { describe, expect, it } from "vitest";
import {
  deriveStripeEntitlementFields,
  mapStripeStatus,
  mapStripeStatusWithRenewal,
} from "./stripe-subscription-mapping";

describe("mapStripeStatus", () => {
  it("maps known Stripe statuses, treating paused as canceled", () => {
    expect(mapStripeStatus("active")).toBe("ACTIVE");
    expect(mapStripeStatus("trialing")).toBe("TRIALING");
    expect(mapStripeStatus("past_due")).toBe("PAST_DUE");
    expect(mapStripeStatus("incomplete_expired")).toBe("EXPIRED");
    expect(mapStripeStatus("paused")).toBe("CANCELED");
    expect(mapStripeStatus("something_new")).toBe("UNKNOWN");
  });
});

describe("mapStripeStatusWithRenewal", () => {
  it("encodes cancel-at-period-end into the status", () => {
    expect(mapStripeStatusWithRenewal({ status: "active", cancel_at_period_end: true } as any)).toBe(
      "CANCEL_AT_PERIOD_END",
    );
    expect(mapStripeStatusWithRenewal({ status: "trialing", cancel_at_period_end: true } as any)).toBe(
      "TRIAL_CANCELED",
    );
    expect(mapStripeStatusWithRenewal({ status: "active", cancel_at_period_end: false } as any)).toBe(
      "ACTIVE",
    );
  });
});

describe("deriveStripeEntitlementFields", () => {
  it("an active paying subscription is PAID, renewing", () => {
    expect(deriveStripeEntitlementFields({ status: "active", cancel_at_period_end: false } as any)).toEqual({
      status: "ACTIVE",
      accessType: "PAID",
      cancelAtPeriodEnd: false,
      autoRenew: true,
    });
  });

  it("a canceling subscription keeps PAID but is not renewing", () => {
    expect(deriveStripeEntitlementFields({ status: "active", cancel_at_period_end: true } as any)).toEqual({
      status: "CANCEL_AT_PERIOD_END",
      accessType: "PAID",
      cancelAtPeriodEnd: true,
      autoRenew: false,
    });
  });

  it("a trial is FREE_TRIAL (not realized revenue)", () => {
    expect(deriveStripeEntitlementFields({ status: "trialing", cancel_at_period_end: false } as any)).toEqual({
      status: "TRIALING",
      accessType: "FREE_TRIAL",
      cancelAtPeriodEnd: false,
      autoRenew: true,
    });
  });

  it("a canceling trial is FREE_TRIAL and not renewing", () => {
    expect(deriveStripeEntitlementFields({ status: "trialing", cancel_at_period_end: true } as any)).toEqual({
      status: "TRIAL_CANCELED",
      accessType: "FREE_TRIAL",
      cancelAtPeriodEnd: true,
      autoRenew: false,
    });
  });
});
