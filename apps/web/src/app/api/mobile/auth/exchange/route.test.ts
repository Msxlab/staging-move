import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  consumeMobileOAuthExchangeCode: vi.fn(),
  createUserSession: vi.fn(() => Promise.resolve("mobile-session-token")),
  generateMobileFingerprint: vi.fn(() => Promise.resolve("mobile-fingerprint")),
  rateLimit: vi.fn(() =>
    Promise.resolve({
      success: true,
      retryAfterSeconds: 0,
      policy: { userFacingErrorCode: "MOBILE_OAUTH_RATE_LIMITED" },
    }),
  ),
}));

vi.mock("@/lib/mobile-oauth", () => ({
  consumeMobileOAuthExchangeCode: (code: string, options?: any) => (mocks.consumeMobileOAuthExchangeCode as any)(code, options),
}));

vi.mock("@/lib/user-auth", () => ({
  createUserSession: (input: any) => (mocks.createUserSession as any)(input),
  generateMobileFingerprint: (ua: string) => (mocks.generateMobileFingerprint as any)(ua),
}));

vi.mock("@/lib/rate-limit", () => ({
  resolveClientIP: vi.fn(() => "203.0.113.10"),
}));

vi.mock("@/lib/rate-limit-policy", () => ({
  stableRateLimitHash: vi.fn((value: string) => `hash:${value.slice(0, 4)}`),
  enforceRateLimitPolicy: (...args: any[]) => (mocks.rateLimit as any)(...args),
}));

import { POST } from "./route";

function request(body: unknown) {
  return new NextRequest("https://app.locateflow.com/api/mobile/auth/exchange", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "LocateFlowMobile/1.0",
    },
    body: JSON.stringify(body),
  });
}

describe("mobile OAuth exchange route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumeMobileOAuthExchangeCode.mockResolvedValue({
      ok: true,
      user: {
        id: "user-1",
        email: "mobile@example.com",
        firstName: "Mobile",
        lastName: "User",
        imageUrl: null,
        emailVerifiedAt: new Date("2026-04-27T12:00:00Z"),
        mfaEnabled: false,
      },
    });
  });

  it("exchanges a one-time code for a mobile bearer token in the response body", async () => {
    const response = await POST(request({ code: "a".repeat(32), code_verifier: "A".repeat(43) }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.token).toBe("mobile-session-token");
    expect(body.user).toMatchObject({ id: "user-1", email: "mobile@example.com" });
    expect(mocks.createUserSession).toHaveBeenCalledWith({
      userId: "user-1",
      email: "mobile@example.com",
      fingerprint: "mobile-fingerprint",
      clientType: "mobile",
      ipAddress: "203.0.113.10",
      userAgent: "LocateFlowMobile/1.0",
      deviceType: "Mobile",
      browser: "LocateFlow app",
      os: "Mobile",
    });
    expect(mocks.rateLimit).toHaveBeenCalledTimes(2);
    expect(mocks.rateLimit).toHaveBeenCalledWith(
      expect.anything(),
      "mobile_oauth_exchange",
      expect.objectContaining({ clientType: "mobile" }),
    );
  });

  it("tolerates safe mobile retry bursts under the exchange policy", async () => {
    await POST(request({ code: "a".repeat(32) }));
    await POST(request({ code: "b".repeat(32) }));

    expect(mocks.createUserSession).toHaveBeenCalledTimes(2);
  });

  it("blocks abusive mobile OAuth exchange bursts", async () => {
    (mocks.rateLimit as any).mockResolvedValueOnce({
      success: false,
      retryAfterSeconds: 45,
      policy: { userFacingErrorCode: "MOBILE_OAUTH_RATE_LIMITED" },
    });

    const response = await POST(request({ code: "a".repeat(32) }));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(body.code).toBe("MOBILE_OAUTH_RATE_LIMITED");
    expect(mocks.consumeMobileOAuthExchangeCode).not.toHaveBeenCalled();
  });

  it("rejects replayed or expired codes with a structured code", async () => {
    (mocks.consumeMobileOAuthExchangeCode as Mock).mockResolvedValue({
      ok: false,
      error: "REPLAYED_CODE",
    });

    const response = await POST(request({ code: "a".repeat(32), code_verifier: "A".repeat(43) }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("REPLAYED_CODE");
    expect(mocks.createUserSession).not.toHaveBeenCalled();
  });

  it("rejects exchanges without a PKCE verifier", async () => {
    (mocks.consumeMobileOAuthExchangeCode as Mock).mockResolvedValue({
      ok: false,
      error: "PKCE_VERIFIER_REQUIRED",
    });

    const response = await POST(request({ code: "a".repeat(32) }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("PKCE_VERIFIER_REQUIRED");
    expect(mocks.createUserSession).not.toHaveBeenCalled();
  });
});
