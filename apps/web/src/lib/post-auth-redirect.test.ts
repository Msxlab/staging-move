import { describe, expect, it } from "vitest";
import {
  resolveOnboardingGateRedirect,
  resolvePostAuthRedirect,
  type PostAuthUserState,
} from "./post-auth-redirect";

const baseState: PostAuthUserState = {
  needsEmailVerification: false,
  needsPasswordSetup: false,
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

  it("does not force OAuth-only users to password setup (SCOPE W-01/M-01)", () => {
    // OAuth-only accounts (no password) are no longer hard-redirected to the
    // setup-password screen; they flow through the normal onboarding gates.
    expect(resolvePostAuthRedirect({
      ...baseState,
      needsPasswordSetup: true,
      hasRequiredLegalConsents: false,
      onboardingCompleted: false,
    }, "/dashboard")).toBe("/onboarding?step=legal");

    expect(resolvePostAuthRedirect({
      ...baseState,
      needsPasswordSetup: true,
      onboardingCompleted: false,
    }, "/dashboard")).toBe("/onboarding");

    expect(resolvePostAuthRedirect({
      ...baseState,
      needsPasswordSetup: true,
    }, "/services")).toBe("/services");
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

  it("allows incomplete users into onboarding while still gating email verification", () => {
    expect(resolveOnboardingGateRedirect({ ...baseState, onboardingCompleted: false }, "/onboarding")).toBeNull();
    expect(resolveOnboardingGateRedirect({ ...baseState, needsEmailVerification: true }, "/onboarding")).toBe(
      "/verify-email?redirect=%2Fonboarding",
    );
    // OAuth-only users are not blocked at the onboarding gate (SCOPE W-01/M-01).
    expect(
      resolveOnboardingGateRedirect({ ...baseState, needsPasswordSetup: true, onboardingCompleted: false }, "/onboarding"),
    ).toBeNull();
    expect(resolveOnboardingGateRedirect(baseState, "/onboarding")).toBe("/dashboard");
  });
});
