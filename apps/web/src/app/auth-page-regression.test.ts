import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("auth page regressions", () => {
  it("keeps the sign-up page free of the blocking legal acknowledgement panel", () => {
    const signUp = read("src/app/sign-up/page.tsx");

    expect(signUp).not.toContain("LegalConsentPanel");
    expect(signUp).not.toContain("legalAcknowledgementsTitle");
    expect(signUp).not.toContain("Required acknowledgements");
    expect(signUp).not.toContain("Accept these before creating your LocateFlow account.");
    expect(signUp).toContain("You will review and accept LocateFlow");
    expect(signUp).toContain('href="/terms"');
    expect(signUp).toContain('href="/disclaimer"');
  });

  it("guards sign-in and sign-up auth-state checks against render retry loops", () => {
    const signIn = read("src/app/sign-in/page.tsx");
    const signUp = read("src/app/sign-up/page.tsx");
    const sessionTracker = read("src/components/tracking/session-tracker.tsx");

    expect(signIn).toContain("authCheckStarted");
    expect(signUp).toContain("authCheckStarted");
    expect(signIn).toContain("/api/auth/me?optional=1");
    expect(signUp).toContain("/api/auth/me?optional=1");
    expect(sessionTracker).toContain('pathname === "/verify-email"');
    expect(sessionTracker).toContain('pathname?.startsWith("/verify-email/")');
    expect(sessionTracker).toContain("useCurrentUser({ enabled: !authPage })");
  });

  it("has a real pending email verification page for guarded app redirects", () => {
    const page = read("src/app/verify-email/page.tsx");
    const resend = read("src/app/verify-email/resend-verification-button.tsx");

    expect(page).toContain("Verify your email");
    expect(page).toContain("normalizeAppRedirectPath");
    expect(page).toContain("ResendVerificationButton");
    expect(resend).toContain("/api/auth/resend-verification");
  });

  it("maps known OAuth failures to specific safe user-facing copy", () => {
    const signIn = read("src/app/sign-in/page.tsx");
    const messages = read("src/i18n/messages/en.json");

    expect(signIn).toContain('"oauth-account-unavailable": "error_account_unavailable"');
    expect(signIn).toContain('"oauth-account-deleted": "error_account_unavailable"');
    expect(signIn).toContain('"email-unverified": "error_oauth_email_unverified"');
    expect(signIn).toContain('"apple-email-not-verified": "error_oauth_email_unverified"');
    expect(signIn).toContain('"oauth-provider-disabled": "error_provider_disabled"');
    expect(messages).toContain("This account is unavailable. Contact support if you believe this is a mistake.");
    expect(messages).toContain("Your Google account email could not be verified. Try another sign-in method.");
    expect(messages).toContain("This sign-in method is currently unavailable.");
    expect(messages).not.toContain("this email was deleted");
  });
});
