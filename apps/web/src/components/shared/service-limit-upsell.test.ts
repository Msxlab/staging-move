import { describe, expect, it } from "vitest";
import { buildServiceLimitCopy } from "./service-limit-upsell";

describe("buildServiceLimitCopy", () => {
  it("uses active campaign copy for eligible Free Access users", () => {
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
    expect(copy.title).toBe("You've reached your service limit");
    expect(copy.body).toContain("Free Access includes up to 10 active services");
    expect(copy.body).toContain("Start with 14 days free");
    expect(copy.body).toContain("$24/year after trial");
    expect(copy.primary).toBe("Start with 14 days free");
    expect(copy.secondary).toBe("Maybe later");
  });

  it("falls back to Free Access labelling when access type is unspecified", () => {
    // The unauthenticated / unknown path should never claim the user is on
    // a trial they have not started - Free Access is the safer default and
    // matches the API's eligibleForTrial=true assumption for new accounts.
    const copy = buildServiceLimitCopy(null);
    expect(copy.body).toContain("Free Access includes up to 10 active services");
    expect(copy.body).not.toContain("Free Trial");
    expect(copy.primary).toBe("Upgrade to Individual Annual");
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
    expect(copy.body).toContain("Free Trial includes up to 10");
    expect(copy.primary).toBe("Start with 14 days free");
  });

  it("falls back safely when no campaign is available", () => {
    const copy = buildServiceLimitCopy({ accessType: "FREE_ACCESS", limit: 10 });
    expect(copy.body).toContain("Upgrade to Individual Annual");
    expect(copy.body).not.toContain("90 days free");
    expect(copy.primary).toBe("Upgrade to Individual Annual");
  });

  it("uses monthly paid offer copy when no annual trial campaign is active", () => {
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

    expect(copy.body).toContain("Free Access includes up to 10 active services");
    expect(copy.body).toContain("Subscribe monthly to keep adding services");
    expect(copy.body).toContain("$4.99/month");
    expect(copy.body).not.toContain("after trial");
    expect(copy.primary).toBe("Subscribe monthly");
  });

  it("uses move-plan upsell copy for MOVING_PLAN_UPGRADE_REQUIRED (not a service-limit message)", () => {
    // Reused as the move paywall: the free tier has unlimited services, so this
    // branch must NOT talk about a service-count limit and must steer to the
    // Individual move-plan unlock.
    const copy = buildServiceLimitCopy({ code: "MOVING_PLAN_UPGRADE_REQUIRED" });
    expect(copy.title).not.toContain("service limit");
    expect(copy.body).not.toContain("active services");
    expect(copy.body).toMatch(/Individual/);
    expect(copy.primary).toContain("Individual");
  });
});
