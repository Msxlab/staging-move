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

  it("falls back to Free Trial labelling when access type is unspecified", () => {
    const copy = buildServiceLimitCopy(null);
    expect(copy.body).toContain("Free Trial includes up to 10 active services");
  });

  it("uses the API-provided limit instead of the default", () => {
    const copy = buildServiceLimitCopy({ accessType: "FREE_ACCESS", limit: 5 });
    expect(copy.body).toContain("up to 5 active services");
  });
});
