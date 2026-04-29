import { describe, expect, it } from "vitest";
import { buildServiceLimitCopy } from "./service-limit-upsell";

describe("buildServiceLimitCopy", () => {
  it("produces the exact contract title and CTAs for the service-limit prompt", () => {
    const copy = buildServiceLimitCopy({ accessType: "FREE_ACCESS", limit: 10 });
    expect(copy.title).toBe("You've reached your service limit");
    expect(copy.body).toContain("Free Access includes up to 10 active services");
    expect(copy.body).toContain("Start Individual Annual with 3 months free");
    expect(copy.primary).toBe("Start 3 months free");
    expect(copy.secondary).toBe("Maybe later");
  });

  it("falls back to Free Access labelling when access type is unspecified", () => {
    // The unauthenticated / unknown path should never claim the user is on
    // a trial they have not started — Free Access is the safer default and
    // matches the API's eligibleForTrial=true assumption for new accounts.
    const copy = buildServiceLimitCopy(null);
    expect(copy.body).toContain("Free Access includes up to 10 active services");
    expect(copy.body).not.toContain("Free Trial");
  });

  it("uses the API-provided limit instead of the default", () => {
    const copy = buildServiceLimitCopy({ accessType: "FREE_ACCESS", limit: 5 });
    expect(copy.body).toContain("up to 5 active services");
  });

  it("does not relabel paid users as Free Trial when they hit the Individual cap", () => {
    const copy = buildServiceLimitCopy({ accessType: "PAID", limit: 100 });
    expect(copy.body).not.toContain("Free Trial");
    expect(copy.body).not.toContain("Free Access");
    expect(copy.body).toContain("Individual Annual plan");
    expect(copy.body).toContain("up to 100 active services");
    expect(copy.primary).toBe("Manage subscription");
  });

  it("treats trialing/active users (eligibleForTrial=false) as paid for upsell purposes", () => {
    // Stripe-backed paid users hit a different ceiling and there is no
    // higher tier to sell — the upsell modal must not advertise the
    // 3-months-free trial back to them.
    const copy = buildServiceLimitCopy({
      accessType: "FREE_TRIAL",
      eligibleForTrial: false,
      limit: 100,
    });
    expect(copy.primary).toBe("Manage subscription");
    expect(copy.body).toContain("Individual Annual plan");
  });

  it("labels Free Trial users with the Free Trial tier when still eligible", () => {
    const copy = buildServiceLimitCopy({ accessType: "FREE_TRIAL", limit: 10 });
    expect(copy.body).toContain("Free Trial includes up to 10");
    expect(copy.primary).toBe("Start 3 months free");
  });
});
