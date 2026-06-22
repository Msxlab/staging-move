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
    expect(signUp).toContain("signUpLegalReviewNotice");
    expect(signUp).toContain('href="/terms"');
    expect(signUp).toContain('href="/disclaimer"');
  });

  it("keeps sign-in and sign-up free of client auth polling loops", () => {
    const signIn = read("src/app/sign-in/page.tsx");
    const signUp = read("src/app/sign-up/page.tsx");
    const sessionTracker = read("src/components/tracking/session-tracker.tsx");

    expect(signIn).not.toContain("/api/auth/me");
    expect(signUp).not.toContain("/api/auth/me");
    expect(signIn).not.toContain("authCheckStarted");
    expect(signUp).not.toContain("authCheckStarted");
    expect(sessionTracker).toContain('pathname === "/verify-email"');
    expect(sessionTracker).toContain('pathname === "/onboarding"');
    expect(sessionTracker).toContain("useCurrentUser({ enabled: !trackerDisabledPage })");
  });

  it("has a real pending email verification page for guarded app redirects", () => {
    const page = read("src/app/verify-email/page.tsx");
    const resend = read("src/app/verify-email/resend-verification-button.tsx");

    expect(page).toContain("verifyEmailTitle");
    expect(page).toContain("normalizeAppRedirectPath");
    expect(page).toContain("ResendVerificationButton");
    expect(resend).toContain("/api/auth/resend-verification");
  });

  it("does not show email verification copy for auto-verified sign-ups", () => {
    const signUp = read("src/app/sign-up/page.tsx");
    const messages = read("src/i18n/messages/en.json");

    expect(signUp).toContain("requiresEmailVerification");
    expect(signUp).toContain("data.requiresEmailVerification !== false");
    expect(signUp).toContain("accountReady");
    expect(signUp).toContain("accountReadyDescription");
    expect(messages).toContain("Your account is ready. Sign in to continue to onboarding.");
  });

  it("uses the post-auth state helper as the protected app gate", () => {
    const appLayout = read("src/app/(app)/layout.tsx");
    const postAuth = read("src/lib/post-auth-redirect.ts");

    expect(appLayout).toContain("getPostAuthUserState");
    expect(appLayout).toContain("resolvePostAuthRedirect");
    expect(appLayout).toContain("AUTH_STATE_USER_UNAVAILABLE");
    expect(appLayout).not.toContain("LEGAL_CONSENT_EVENT");
    expect(postAuth).toContain("needsEmailVerificationGate");
    expect(postAuth).toContain("resolveOnboardingGateRedirect");
    expect(postAuth).toContain('return "/onboarding?step=legal"');
    expect(postAuth).toContain('return "/onboarding"');
  });

  it("keeps the onboarding legal gate open until legal acceptance is saved", () => {
    const onboarding = read("src/app/onboarding/onboarding-client.tsx");

    expect(onboarding).toContain("legalAcceptedOnServer");
    expect(onboarding).toContain("setLegalAcceptedOnServer(hasLegal)");
    expect(onboarding).toContain("setLegalAcceptedOnServer(true)");
    expect(onboarding).toContain("const showLegalGate = legalStepRequested && !legalAcceptedOnServer");
    expect(onboarding).not.toContain("const showLegalGate = legalStepRequested && !hasRequiredLegalConsents(legalConsents)");
  });

  it("routes unverified password users directly to verify-email after login", () => {
    const signIn = read("src/app/sign-in/page.tsx");

    expect(signIn).toContain("data.user?.emailVerified === false");
    expect(signIn).toContain("/verify-email?redirect=");
  });

  it("does not silently swallow logout failures", () => {
    const hook = read("src/hooks/use-current-user.ts");
    const signIn = read("src/app/sign-in/page.tsx");

    expect(hook).toContain("logoutOk");
    expect(hook).toContain("/sign-in?error=logout-failed");
    expect(hook).toContain("signOutInFlight");
    expect(signIn).toContain('"logout-failed": "error_logout_failed"');
  });

  it("maps known OAuth failures to specific safe user-facing copy", () => {
    const signIn = read("src/app/sign-in/page.tsx");
    const messages = read("src/i18n/messages/en.json");

    expect(signIn).toContain('"oauth-account-unavailable": "error_account_unavailable"');
    expect(signIn).toContain('"oauth-account-deleted": "error_account_unavailable"');
    expect(signIn).toContain('"account-unavailable": "error_account_unavailable"');
    expect(signIn).toContain('"email-unverified": "error_oauth_email_unverified"');
    expect(signIn).toContain('"apple-email-not-verified": "error_oauth_email_unverified"');
    expect(signIn).toContain('"oauth-provider-disabled": "error_provider_disabled"');
    expect(messages).toContain("This account is unavailable. Contact support if you believe this is a mistake.");
    expect(messages).toContain("Your Google account email could not be verified. Try another sign-in method.");
    expect(messages).toContain("This sign-in method is currently unavailable.");
    expect(messages).not.toContain("this email was deleted");
  });

  it("has a real pending email verification page for guarded app redirects", () => {
    const page = read("src/app/verify-email/page.tsx");
    const resend = read("src/app/verify-email/resend-verification-button.tsx");

    expect(page).toContain("verifyEmailTitle");
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
