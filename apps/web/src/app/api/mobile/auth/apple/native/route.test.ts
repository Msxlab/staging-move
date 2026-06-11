import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  jwtVerify: vi.fn(),
  getRuntimeConfigValue: vi.fn((key: string) =>
    Promise.resolve(key === "APPLE_BUNDLE_ID" ? "com.locateflow.mobile" : null),
  ),
  isAppleEmailVerifiedClaim: vi.fn(() => true),
  findOrLinkOAuthUserWithStatus: vi.fn(() =>
    Promise.resolve({ userId: "user-1", isNewUser: false, wasLinkedNow: false }),
  ),
  normalizeAcceptedLegalConsents: vi.fn((value) => value),
  recordLegalAcceptance: vi.fn(() => Promise.resolve()),
  createUserSession: vi.fn(() => Promise.resolve("mobile-session-token")),
  generateMobileFingerprint: vi.fn(() => Promise.resolve("mobile-fingerprint")),
  enforceRateLimitPolicy: vi.fn(() =>
    Promise.resolve({
      success: true,
      retryAfterSeconds: 0,
      policy: { userFacingErrorCode: "MOBILE_OAUTH_RATE_LIMITED" },
    }),
  ),
  prismaOAuthAccountFindUnique: vi.fn(
    () => Promise.resolve(null) as Promise<{ user: { email: string } } | null>,
  ),
  prismaUserFindUnique: vi.fn(() =>
    Promise.resolve({
      id: "user-1",
      email: "user@example.com",
      firstName: "First",
      lastName: "Last",
      imageUrl: null,
      emailVerifiedAt: new Date("2026-04-27T12:00:00Z"),
      mfaEnabled: false,
    }),
  ),
}));

vi.mock("jose", async () => ({
  jwtVerify: (...args: any[]) => (mocks.jwtVerify as any)(...args),
  createRemoteJWKSet: () => () => null,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    oAuthAccount: {
      findUnique: (...args: any[]) => (mocks.prismaOAuthAccountFindUnique as any)(...args),
    },
    user: {
      findUnique: (...args: any[]) => (mocks.prismaUserFindUnique as any)(...args),
    },
  },
}));

vi.mock("@/lib/oauth", () => ({
  isAppleEmailVerifiedClaim: (v: any) => (mocks.isAppleEmailVerifiedClaim as any)(v),
  hashForOAuthLog: (v: string) => `hash:${v.slice(0, 3)}`,
  logSafeOAuthEvent: vi.fn(),
  summarizeOAuthError: (e: unknown) => ({ message: (e as Error)?.message || "err" }),
}));

vi.mock("@/lib/runtime-config", () => ({
  getRuntimeConfigValue: (key: string) => (mocks.getRuntimeConfigValue as any)(key),
}));

vi.mock("@/lib/legal-acceptance", () => ({
  normalizeAcceptedLegalConsents: (value: any) => (mocks.normalizeAcceptedLegalConsents as any)(value),
  recordLegalAcceptance: (input: any) => (mocks.recordLegalAcceptance as any)(input),
}));

vi.mock("@/lib/user-auth", () => ({
  createUserSession: (input: any) => (mocks.createUserSession as any)(input),
  findOrLinkOAuthUserWithStatus: (input: any) => (mocks.findOrLinkOAuthUserWithStatus as any)(input),
  generateMobileFingerprint: (ua: string) => (mocks.generateMobileFingerprint as any)(ua),
}));

vi.mock("@/lib/rate-limit", () => ({
  resolveClientIP: vi.fn(() => "203.0.113.10"),
}));

vi.mock("@/lib/rate-limit-policy", () => ({
  enforceRateLimitPolicy: (...args: any[]) => (mocks.enforceRateLimitPolicy as any)(...args),
}));

import { POST } from "./route";

function request(body: unknown) {
  return new NextRequest("https://app.locateflow.com/api/mobile/auth/apple/native", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "LocateFlowMobile/1.0",
    },
    body: JSON.stringify(body),
  });
}

const VALID_TOKEN = "a".repeat(80);
const VALID_BODY = {
  identityToken: VALID_TOKEN,
  authorizationCode: "auth-code",
  nonce: null,
  user: "apple-sub-123",
  fullName: { givenName: "Ada", familyName: "Lovelace" },
  email: "user@example.com",
};

const VALID_LEGAL_CONSENTS = {
  termsAccepted: true,
  disclaimerAccepted: true,
  termsVersion: "2026-04-01",
  disclaimerVersion: "2026-04-01",
  acceptedAt: "2026-05-12T12:00:00.000Z",
};

describe("native Apple Sign-In mobile route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.jwtVerify.mockResolvedValue({
      payload: {
        sub: "apple-sub-123",
        email: "user@example.com",
        email_verified: true,
      },
    });
    mocks.prismaOAuthAccountFindUnique.mockResolvedValue(null);
    mocks.findOrLinkOAuthUserWithStatus.mockResolvedValue({
      userId: "user-1",
      isNewUser: false,
      wasLinkedNow: false,
    });
    mocks.normalizeAcceptedLegalConsents.mockImplementation((value) => value);
    mocks.recordLegalAcceptance.mockResolvedValue(undefined);
    mocks.prismaUserFindUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      firstName: "First",
      lastName: "Last",
      imageUrl: null,
      emailVerifiedAt: new Date("2026-04-27T12:00:00Z"),
      mfaEnabled: false,
    });
  });

  it("issues a mobile bearer token on valid Apple identity token", async () => {
    const response = await POST(request(VALID_BODY));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.token).toBe("mobile-session-token");
    expect(body.user).toMatchObject({ id: "user-1", email: "user@example.com" });
    expect(mocks.findOrLinkOAuthUserWithStatus).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "apple", providerId: "apple-sub-123", email: "user@example.com" }),
    );
    expect(mocks.createUserSession).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", clientType: "mobile", deviceType: "Mobile" }),
    );
  });

  it("records legal acceptance when native Apple sign-up sends consent metadata", async () => {
    const response = await POST(request({
      ...VALID_BODY,
      legalConsents: VALID_LEGAL_CONSENTS,
    }));

    expect(response.status).toBe(200);
    expect(mocks.normalizeAcceptedLegalConsents).toHaveBeenCalledWith(VALID_LEGAL_CONSENTS);
    expect(mocks.recordLegalAcceptance).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        page: "/sign-up?provider=apple",
        source: "mobile_apple_native_signup",
        consents: VALID_LEGAL_CONSENTS,
      }),
    );
  });

  it("rejects an invalid identity token", async () => {
    mocks.jwtVerify.mockRejectedValueOnce(new Error("bad signature"));
    const response = await POST(request(VALID_BODY));
    expect(response.status).toBe(401);
    expect(mocks.findOrLinkOAuthUserWithStatus).not.toHaveBeenCalled();
    expect(mocks.createUserSession).not.toHaveBeenCalled();
  });

  it("rejects when client subject mismatches the verified token", async () => {
    mocks.jwtVerify.mockResolvedValueOnce({
      payload: {
        sub: "apple-sub-real",
        email: "user@example.com",
        email_verified: true,
      },
    });
    const response = await POST(request({ ...VALID_BODY, user: "apple-sub-spoofed" }));
    expect(response.status).toBe(401);
    expect(mocks.findOrLinkOAuthUserWithStatus).not.toHaveBeenCalled();
  });

  it("reuses the stored email for a returning user when Apple omits the email claim", async () => {
    mocks.jwtVerify.mockResolvedValueOnce({
      payload: { sub: "apple-sub-123" },
    });
    mocks.prismaOAuthAccountFindUnique.mockResolvedValueOnce({
      user: { email: "returning@example.com" },
    });
    const response = await POST(request({ ...VALID_BODY, email: null }));
    expect(response.status).toBe(200);
    expect(mocks.findOrLinkOAuthUserWithStatus).toHaveBeenCalledWith(
      expect.objectContaining({ email: "returning@example.com" }),
    );
  });

  it("rejects first-sign-in when email_verified is not true", async () => {
    mocks.jwtVerify.mockResolvedValueOnce({
      payload: {
        sub: "apple-sub-123",
        email: "user@example.com",
        email_verified: false,
      },
    });
    mocks.isAppleEmailVerifiedClaim.mockReturnValueOnce(false);
    mocks.prismaOAuthAccountFindUnique.mockResolvedValueOnce(null);
    const response = await POST(request(VALID_BODY));
    expect(response.status).toBe(400);
    expect(mocks.findOrLinkOAuthUserWithStatus).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limited", async () => {
    mocks.enforceRateLimitPolicy.mockResolvedValueOnce({
      success: false,
      retryAfterSeconds: 30,
      policy: { userFacingErrorCode: "MOBILE_OAUTH_RATE_LIMITED" },
    });
    const response = await POST(request(VALID_BODY));
    expect(response.status).toBe(429);
  });

  it("returns 503 when Apple OAuth is not configured", async () => {
    mocks.getRuntimeConfigValue.mockResolvedValueOnce(null);
    const response = await POST(request(VALID_BODY));
    expect(response.status).toBe(503);
  });

  it("returns 403 when the Apple account is soft-deleted", async () => {
    mocks.findOrLinkOAuthUserWithStatus.mockRejectedValueOnce(
      new Error("OAUTH_EXISTING_DELETED_USER_BLOCKED"),
    );
    const response = await POST(request(VALID_BODY));
    const body = await response.json();
    expect(response.status).toBe(403);
    expect(body.code).toBe("ACCOUNT_UNAVAILABLE");
  });

  it("returns 409 when legal acceptance is required", async () => {
    mocks.findOrLinkOAuthUserWithStatus.mockRejectedValueOnce(
      new Error("LEGAL_ACCEPTANCE_REQUIRED"),
    );
    const response = await POST(request(VALID_BODY));
    const body = await response.json();
    expect(response.status).toBe(409);
    expect(body.code).toBe("LEGAL_ACCEPTANCE_REQUIRED");
  });

  it("returns a polite 503 when the KILL_SIGNUPS switch pauses new-account creation", async () => {
    mocks.findOrLinkOAuthUserWithStatus.mockRejectedValueOnce(
      new Error("SIGNUPS_PAUSED"),
    );
    const response = await POST(request(VALID_BODY));
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.code).toBe("SIGNUPS_PAUSED");
    expect(body.error).toContain("temporarily paused");
    expect(response.headers.get("Retry-After")).toBe("3600");
    expect(mocks.createUserSession).not.toHaveBeenCalled();
  });
});
