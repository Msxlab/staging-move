import { describe, expect, it } from "vitest";
import { resolvePostAuthRedirect, type PostAuthUserState } from "./post-auth-redirect";

const baseState: PostAuthUserState = {
  needsEmailVerification: false,
  hasRequiredLegalConsents: true,
  onboardingCompleted: true,
};

describe("resolvePostAuthRedirect", () => {
  it("routes unverified email/password users to email verification", () => {
    expect(resolvePostAuthRedirect({
      ...baseState,
      needsEmailVerification: true,
    }, "/dashboard")).toBe("/verify-email?redirect=%2Fdashboard");
  });

  it("routes verified users without legal consent to the onboarding legal gate", () => {
    expect(resolvePostAuthRedirect({
      ...baseState,
      hasRequiredLegalConsents: false,
      onboardingCompleted: false,
    }, "/dashboard")).toBe("/onboarding?step=legal");
  });

  it("routes legal-accepted incomplete users to onboarding", () => {
    expect(resolvePostAuthRedirect({
      ...baseState,
      onboardingCompleted: false,
    }, "/dashboard")).toBe("/onboarding");
  });

  it("routes complete users to a safe requested app path", () => {
    expect(resolvePostAuthRedirect(baseState, "/services")).toBe("/services");
  });

  it("falls back from unsafe redirect params", () => {
    expect(resolvePostAuthRedirect(baseState, "https://evil.example/dashboard")).toBe("/dashboard");
    expect(resolvePostAuthRedirect(baseState, "/api/auth/me")).toBe("/dashboard");
  });

  it("keeps completed sign-up or onboarding starts out of onboarding", () => {
    expect(resolvePostAuthRedirect(baseState, "/onboarding")).toBe("/dashboard");
    expect(resolvePostAuthRedirect(baseState, "/onboarding?step=legal")).toBe("/dashboard");
  });
});
