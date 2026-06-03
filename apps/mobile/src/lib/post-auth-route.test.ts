import { describe, expect, it } from "vitest";
import { getPostAuthMobileRoute } from "./post-auth-route";

describe("getPostAuthMobileRoute", () => {
  it("sends OAuth-only users to onboarding instead of forcing password setup", () => {
    expect(getPostAuthMobileRoute({ needsPasswordSetup: true })).toBe("/onboarding");
  });

  it("sends users without the password setup gate to onboarding", () => {
    expect(getPostAuthMobileRoute({ needsPasswordSetup: false })).toBe("/onboarding");
    expect(getPostAuthMobileRoute({})).toBe("/onboarding");
    expect(getPostAuthMobileRoute(null)).toBe("/onboarding");
  });
});
