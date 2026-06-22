import { describe, expect, it } from "vitest";
import { buildServiceLimitCopy } from "./service-limit-upsell";

describe("buildServiceLimitCopy", () => {
  it("uses access-review copy for eligible Free Access users even when a campaign is present", () => {
    const copy = buildServiceLimitCopy({
      accessType: "FREE_ACCESS",
      limit: 10,
      campaign: {
        code: "SPRING90",
        publicHeadline: "Start with 14 days free",
        displayPriceLabel: "$24/year",
        trialDays: 14,
      },
    });
    expect(copy.title).toBe("Your service access needs review");
    expect(copy.body).toContain("Free Access currently reports up to 10 active services");
    expect(copy.body).toContain("Full-access staging");
    expect(copy.primary).toBe("Review access");
    expect(copy.secondary).toBe("Maybe later");
  });

  it("falls back to Free Access labelling when access type is unspecified", () => {
    // The unauthenticated / unknown path should never claim the user is on
    // a trial they have not started - Free Access is the safer default and
    // matches the API's eligibleForTrial=true assumption for new accounts.
    const copy = buildServiceLimitCopy(null);
    expect(copy.body).toContain("Free Access currently reports up to 10 active services");
    expect(copy.body).not.toContain("Free Trial");
    expect(copy.primary).toBe("Review access");
  });

  it("uses the API-provided limit instead of the default", () => {
    const copy = buildServiceLimitCopy({ accessType: "FREE_ACCESS", limit: 5 });
    expect(copy.body).toContain("up to 5 active services");
  });

  it("does not relabel paid users as Free Trial when they hit the Individual cap", () => {
    const copy = buildServiceLimitCopy({ accessType: "PAID", limit: 100 });
    expect(copy.body).not.toContain("Free Trial");
    expect(copy.body).not.toContain("Free Access");
    expect(copy.body).toContain("Individual plan");
    expect(copy.body).toContain("up to 100 active services");
    expect(copy.primary).toBe("Manage subscription");
  });

  it("treats trialing/active users (eligibleForTrial=false) as paid for upsell purposes", () => {
    // Stripe-backed paid users hit a different ceiling and there is no
    // higher tier to sell - the upsell modal must not advertise the
    // free trial back to them.
    const copy = buildServiceLimitCopy({
      accessType: "FREE_TRIAL",
      eligibleForTrial: false,
      limit: 100,
    });
    expect(copy.primary).toBe("Manage subscription");
    expect(copy.body).toContain("Individual plan");
  });

  it("labels Free Trial users with the Free Trial tier when still eligible", () => {
    const copy = buildServiceLimitCopy({
      accessType: "FREE_TRIAL",
      limit: 10,
      campaign: {
        code: "SPRING90",
        publicHeadline: "Start with 14 days free",
        displayPriceLabel: "$24/year",
        trialDays: 14,
      },
    });
    expect(copy.body).toContain("Free Trial currently reports up to 10");
    expect(copy.primary).toBe("Review access");
  });

  it("falls back safely when no campaign is available", () => {
    const copy = buildServiceLimitCopy({ accessType: "FREE_ACCESS", limit: 10 });
    expect(copy.body).toContain("Full-access staging");
    expect(copy.body).not.toContain("90 days free");
    expect(copy.primary).toBe("Review access");
  });

  it("uses access-review copy when a monthly paid offer is present", () => {
    const copy = buildServiceLimitCopy({
      accessType: "FREE_ACCESS",
      limit: 10,
      monthlyOffer: {
        code: "MONTHLY",
        publicHeadline: "Subscribe monthly",
        displayPriceLabel: "$4.99/month",
        trialDays: null,
        accessType: "PAID",
        billingInterval: "MONTH",
      },
    });

    expect(copy.body).toContain("Free Access currently reports up to 10 active services");
    expect(copy.body).toContain("Full-access staging");
    expect(copy.body).not.toContain("after trial");
    expect(copy.primary).toBe("Review access");
  });

  it("uses move-plan access copy for MOVING_PLAN_UPGRADE_REQUIRED (not a service-limit message)", () => {
    // Reused as the move gate fallback. In consumer-free staging this should not
    // appear, but if it does the copy must not imply a paid package purchase.
    const copy = buildServiceLimitCopy({ code: "MOVING_PLAN_UPGRADE_REQUIRED" });
    expect(copy.title).not.toContain("service limit");
    expect(copy.body).not.toContain("active services");
    expect(copy.body).toContain("Full-access staging");
    expect(copy.primary).toBe("Review access");
  });
});
