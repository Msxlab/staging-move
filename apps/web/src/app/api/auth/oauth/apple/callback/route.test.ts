import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  jwtVerify: vi.fn(),
  rateLimit: vi.fn(),
  exchangeAppleCode: vi.fn(),
  getAppleOAuthCredentials: vi.fn(),
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
  exchangeAppleCode: (...args: unknown[]) => mocks.exchangeAppleCode(...args),
  getAppleOAuthCredentials: () => mocks.getAppleOAuthCredentials(),
  getOAuthRedirectUri: (...args: unknown[]) => mocks.getOAuthRedirectUri(...args),
  getOAuthResponseUrl: (...args: unknown[]) => mocks.getOAuthResponseUrl(...args),
  hashForOAuthLog: (value: string) => `hash:${value}`,
  isAppleEmailVerifiedClaim: (value: unknown) => value === true || value === "true",
  logSafeOAuthEvent: vi.fn(),
  normalizeOAuthRedirectPath: (value: string | null | undefined) => value || "/dashboard",
  oauthUserIdHint: (value: string) => value,
  summarizeOAuthError: () => ({}),
}));

vi.mock("@/lib/user-auth", () => ({
  createUserSession: (...args: unknown[]) => mocks.createUserSession(...args),
  findOrLinkOAuthUserWithStatus: (...args: unknown[]) => mocks.findOrLinkOAuthUserWithStatus(...args),
  generateFingerprint: (...args: unknown[]) => mocks.generateFingerprint(...args),
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
  getRateLimitKey: vi.fn(() => "apple-callback-key"),
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

import { POST } from "./route";

function callbackRequest(options: {
  state?: string;
  nonceCookie?: string;
  code?: string;
} = {}) {
  const state = options.state ?? "state-1";
  const code = options.code ?? "code-1";
  const body = new URLSearchParams({ code, state });
  const cookies = [
    `oauth_state_apple=${state}`,
    options.nonceCookie ? `oauth_nonce_apple=${options.nonceCookie}` : null,
    "oauth_redirect_uri_apple=https://app.locateflow.com/api/auth/oauth/apple/callback",
    "oauth_redirect=/dashboard",
  ].filter(Boolean).join("; ");

  return new NextRequest("https://app.locateflow.com/api/auth/oauth/apple/callback", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookies,
      "user-agent": "vitest",
    },
    body,
  });
}

describe("Apple OAuth callback nonce protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rateLimit.mockResolvedValue({ success: true });
    mocks.getAppleOAuthCredentials.mockResolvedValue({
      clientId: "apple-client-id",
      teamId: "team-id",
      keyId: "key-id",
      privateKeyPem: "private-key",
    });
    mocks.getOAuthRedirectUri.mockResolvedValue("https://app.locateflow.com/api/auth/oauth/apple/callback");
    mocks.getOAuthResponseUrl.mockImplementation((_request: NextRequest, path: string) =>
      Promise.resolve(new URL(path, "https://app.locateflow.com")),
    );
    mocks.oAuthStateUpdateMany.mockResolvedValue({ count: 1 });
    mocks.exchangeAppleCode.mockResolvedValue({ idToken: "id-token" });
    mocks.jwtVerify.mockResolvedValue({
      payload: {
        sub: "apple-sub",
        email: "user@example.com",
        email_verified: true,
        nonce: "nonce-1",
      },
    });
    mocks.findOrLinkOAuthUserWithStatus.mockResolvedValue({
      userId: "user-1",
      isNewUser: false,
      wasLinkedNow: false,
    });
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

  it("accepts a callback with matching state and nonce", async () => {
    const response = await POST(callbackRequest({ nonceCookie: "nonce-1" }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.locateflow.com/dashboard");
    expect(mocks.oAuthStateUpdateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        provider: "apple",
        stateHash: expect.any(String),
        nonceHash: expect.any(String),
        consumedAt: null,
      }),
      data: { consumedAt: expect.any(Date) },
    });
    expect(mocks.createUserSession).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
      email: "user@example.com",
    }));
  });

  it("rejects a callback with a missing nonce cookie", async () => {
    const response = await POST(callbackRequest());

    expect(response.headers.get("location")).toContain("state-mismatch");
    expect(mocks.oAuthStateUpdateMany).not.toHaveBeenCalled();
    expect(mocks.exchangeAppleCode).not.toHaveBeenCalled();
  });

  it("rejects a callback when the verified Apple nonce does not match", async () => {
    mocks.jwtVerify.mockResolvedValue({
      payload: {
        sub: "apple-sub",
        email: "user@example.com",
        email_verified: true,
        nonce: "other-nonce",
      },
    });

    const response = await POST(callbackRequest({ nonceCookie: "nonce-1" }));

    expect(response.headers.get("location")).toContain("invalid-nonce");
    expect(mocks.findOrLinkOAuthUserWithStatus).not.toHaveBeenCalled();
    expect(mocks.createUserSession).not.toHaveBeenCalled();
  });

  it("rejects replay after the state and nonce have already been consumed", async () => {
    mocks.oAuthStateUpdateMany.mockResolvedValue({ count: 0 });

    const response = await POST(callbackRequest({ nonceCookie: "nonce-1" }));

    expect(response.headers.get("location")).toContain("state-mismatch");
    expect(mocks.exchangeAppleCode).not.toHaveBeenCalled();
    expect(mocks.jwtVerify).not.toHaveBeenCalled();
  });
});
