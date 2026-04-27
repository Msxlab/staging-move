import { describe, expect, it } from "vitest";
import {
  buildEmailVerificationGateRedirect,
  needsEmailVerificationGate,
} from "./email-verification-gate";

describe("email verification gate", () => {
  it("gates unverified email/password users", () => {
    expect(
      needsEmailVerificationGate({
        emailVerifiedAt: null,
        passwordHash: "hash",
        oauthAccounts: [],
      }),
    ).toBe(true);
  });

  it("allows verified email/password users", () => {
    expect(
      needsEmailVerificationGate({
        emailVerifiedAt: new Date(),
        passwordHash: "hash",
        oauthAccounts: [],
      }),
    ).toBe(false);
  });

  it("allows verified OAuth users without requiring password verification flow", () => {
    expect(
      needsEmailVerificationGate({
        emailVerifiedAt: null,
        passwordHash: null,
        oauthAccounts: [{ id: "oauth-1" }],
      }),
    ).toBe(false);
  });

  it("normalizes verify-email redirect paths", () => {
    expect(buildEmailVerificationGateRedirect("/onboarding")).toBe(
      "/verify-email?redirect=%2Fonboarding",
    );
    expect(buildEmailVerificationGateRedirect("/dashboard")).toBe(
      "/verify-email?redirect=%2Fdashboard",
    );
    expect(buildEmailVerificationGateRedirect("//evil.example")).toBe(
      "/verify-email?redirect=%2Fonboarding",
    );
  });
});
