import { normalizeAppRedirectPath } from "@/lib/safe-redirect";

export interface EmailVerificationGateUser {
  emailVerifiedAt?: Date | string | null;
  passwordHash?: string | null;
  oauthAccounts?: Array<unknown> | null;
}

export function needsEmailVerificationGate(
  user: EmailVerificationGateUser | null | undefined,
): boolean {
  if (!user) return true;
  const hasVerifiedEmail = Boolean(user.emailVerifiedAt);
  const hasPasswordLogin = Boolean(user.passwordHash);
  const hasVerifiedOAuthLogin = (user.oauthAccounts?.length || 0) > 0;

  return !hasVerifiedEmail && hasPasswordLogin && !hasVerifiedOAuthLogin;
}

export function buildEmailVerificationGateRedirect(
  requestedRedirect = "/onboarding",
): string {
  const redirectPath = normalizeAppRedirectPath(requestedRedirect, "/onboarding");
  return `/verify-email?redirect=${encodeURIComponent(redirectPath)}`;
}
