import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  jwtVerify: vi.fn(),
  rateLimit: vi.fn(),
  exchangeGoogleCode: vi.fn(),
  getGoogleOAuthCredentials: vi.fn(),
  getOAuthRedirectUri: vi.fn(),
  getOAuthResponseUrl: vi.fn(),
  findOrLinkOAuthUserWithStatus: vi.fn(),
  createUserSession: vi.fn(),
  generateFingerprint: vi.fn(),
  getPostAuthUserState: vi.fn(),
  resolvePostAuthRedirect: vi.fn(),
  oAuthStateUpdateMany: vi.fn(),
  userFindUnique: vi.fn(),
  sendWelcomeEmail: vi.fn(),
  sendSecurityNoticeEmail: vi.fn(),
}));

vi.mock("jose", () => ({
  createRemoteJWKSet: vi.fn(() => ({})),
  jwtVerify: (...args: unknown[]) => mocks.jwtVerify(...args),
}));

vi.mock("@/lib/oauth", () => ({
  exchangeGoogleCode: (...args: unknown[]) => mocks.exchangeGoogleCode(...args),
  getGoogleOAuthCredentials: () => mocks.getGoogleOAuthCredentials(),
  getOAuthRedirectUri: (...args: unknown[]) => mocks.getOAuthRedirectUri(...args),
  getOAuthResponseUrl: (...args: unknown[]) => mocks.getOAuthResponseUrl(...args),
  hashForOAuthLog: (value: string) => `hash:${value}`,
  logSafeOAuthEvent: vi.fn(),
  normalizeOAuthRedirectPath: (value: string | null | undefined) => value || "/dashboard",
  oauthUserIdHint: (value: string) => value,
  summarizeOAuthError: () => ({}),
}));

vi.mock("@/lib/user-auth", () => ({
  createUserSession: (...args: unknown[]) => mocks.createUserSession(...args),
  findOrLinkOAuthUserWithStatus: (...args: unknown[]) => mocks.findOrLinkOAuthUserWithStatus(...args),
  generateFingerprint: (...args: unknown[]) => mocks.generateFingerprint(...args),
  shouldUseSecureSessionCookies: vi.fn(() => true),
}));

vi.mock("@/lib/email-service", () => ({
  sendSecurityNoticeEmail: (...args: unknown[]) => mocks.sendSecurityNoticeEmail(...args),
  sendWelcomeEmail: (...args: unknown[]) => mocks.sendWelcomeEmail(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    oAuthState: {
      updateMany: (...args: unknown[]) => mocks.oAuthStateUpdateMany(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mocks.userFindUnique(...args),
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "google-callback-key"),
  rateLimit: (...args: unknown[]) => mocks.rateLimit(...args),
  resolveClientIP: vi.fn(() => "203.0.113.10"),
}));

vi.mock("@/lib/post-auth-redirect", () => ({
  getPostAuthUserState: (...args: unknown[]) => mocks.getPostAuthUserState(...args),
  resolvePostAuthRedirect: (...args: unknown[]) => mocks.resolvePostAuthRedirect(...args),
}));

vi.mock("@/lib/mobile-oauth", () => ({
  MOBILE_OAUTH_CLIENT_COOKIE: "mobile_oauth_client",
  MOBILE_OAUTH_PKCE_CHALLENGE_COOKIE: "mobile_oauth_pkce_challenge",
  MOBILE_OAUTH_REDIRECT_COOKIE: "mobile_oauth_redirect",
  MOBILE_OAUTH_STATE_COOKIE: "mobile_oauth_state",
  buildMobileOAuthRedirectUrl: vi.fn(),
  createMobileOAuthExchangeCode: vi.fn(),
  isMobileOAuthClient: vi.fn(() => false),
  normalizeMobileOAuthCodeChallenge: vi.fn(),
  normalizeMobileOAuthRedirectUri: vi.fn(),
  normalizeMobileOAuthState: vi.fn(),
}));

import { GET } from "./route";

function callbackRequest(options: { state?: string; pkce?: string; code?: string } = {}) {
  const state = options.state ?? "oauth-state";
  const pkce = options.pkce ?? "pkce-verifier";
  const code = options.code ?? "code-1";
  const cookies = [
    `oauth_state_google=${state}`,
    `oauth_pkce_google=${pkce}`,
    "oauth_redirect_uri_google=https://app.locateflow.com/api/auth/oauth/google/callback",
    "oauth_redirect=/dashboard",
  ].join("; ");

  return new NextRequest(
    `https://app.locateflow.com/api/auth/oauth/google/callback?code=${code}&state=${state}`,
    { headers: { cookie: cookies, "user-agent": "vitest" } },
  );
}

describe("Google OAuth callback replay protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rateLimit.mockResolvedValue({ success: true });
    mocks.getGoogleOAuthCredentials.mockResolvedValue({ clientId: "client-id", clientSecret: "client-secret" });
    mocks.getOAuthRedirectUri.mockResolvedValue("https://app.locateflow.com/api/auth/oauth/google/callback");
    mocks.getOAuthResponseUrl.mockImplementation((_request: NextRequest, path: string) =>
      Promise.resolve(new URL(path, "https://app.locateflow.com")),
    );
    mocks.oAuthStateUpdateMany.mockResolvedValue({ count: 1 });
    mocks.exchangeGoogleCode.mockResolvedValue({ idToken: "id-token" });
    mocks.jwtVerify.mockResolvedValue({
      payload: { sub: "google-sub", email: "user@example.com", email_verified: true },
    });
    mocks.findOrLinkOAuthUserWithStatus.mockResolvedValue({ userId: "user-1", isNewUser: false, wasLinkedNow: false });
    mocks.generateFingerprint.mockResolvedValue("fingerprint");
    mocks.createUserSession.mockResolvedValue("session-token");
    mocks.getPostAuthUserState.mockResolvedValue({
      needsEmailVerification: false,
      needsPasswordSetup: false,
      hasRequiredLegalConsents: true,
      onboardingCompleted: true,
    });
    mocks.resolvePostAuthRedirect.mockReturnValue("/dashboard");
  });

  it("atomically consumes the state record and finishes login (count === 1)", async () => {
    const response = await GET(callbackRequest());

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.locateflow.com/dashboard");
    expect(mocks.oAuthStateUpdateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        provider: "google",
        stateHash: expect.any(String),
        nonceHash: expect.any(String),
        consumedAt: null,
      }),
      data: { consumedAt: expect.any(Date) },
    });
    expect(mocks.createUserSession).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1" }));
  });

  it("rejects a replayed / already-consumed state BEFORE exchanging the code (count === 0)", async () => {
    mocks.oAuthStateUpdateMany.mockResolvedValue({ count: 0 });

    const response = await GET(callbackRequest());

    expect(response.headers.get("location")).toContain("state-mismatch");
    expect(mocks.exchangeGoogleCode).not.toHaveBeenCalled();
    expect(mocks.createUserSession).not.toHaveBeenCalled();
  });
});
