import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  appleAuthorizeUrl: vi.fn(() => "https://appleid.apple.com/auth/authorize"),
  oAuthStateCreate: vi.fn(),
}));

vi.mock("@/lib/oauth", () => ({
  appleAuthorizeUrl: (...args: unknown[]) => (mocks.appleAuthorizeUrl as any)(...args),
  generateState: vi.fn(() => "oauth-state"),
  getAppleOAuthCredentials: vi.fn(() => Promise.resolve({ clientId: "apple-client-id" })),
  getOAuthRedirectUri: vi.fn(() => Promise.resolve("https://app.locateflow.com/api/auth/oauth/apple/callback")),
  normalizeOAuthRedirectPath: vi.fn((value: string) => value || "/dashboard"),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    oAuthState: {
      create: (...args: unknown[]) => mocks.oAuthStateCreate(...args),
    },
  },
}));

vi.mock("@/lib/user-auth", () => ({
  shouldUseSecureSessionCookies: vi.fn(() => true),
}));

import { GET } from "./route";

describe("Apple OAuth mobile init", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.appleAuthorizeUrl.mockReturnValue("https://appleid.apple.com/auth/authorize");
    mocks.oAuthStateCreate.mockResolvedValue({ id: "oauth-state-1" });
  });

  it("rejects mobile OAuth init without a PKCE challenge", async () => {
    const response = await GET(new NextRequest(
      "https://app.locateflow.com/api/auth/oauth/apple?client=mobile&mobileRedirectUri=locateflow%3A%2F%2Foauth",
    ));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("PKCE challenge");
  });

  it("stores a hashed nonce and includes the raw nonce in the Apple authorization request", async () => {
    const response = await GET(new NextRequest("https://app.locateflow.com/api/auth/oauth/apple"));

    expect(response.status).toBe(307);
    expect(mocks.appleAuthorizeUrl).toHaveBeenCalledWith(expect.objectContaining({
      clientId: "apple-client-id",
      redirectUri: "https://app.locateflow.com/api/auth/oauth/apple/callback",
      state: "oauth-state",
      nonce: expect.any(String),
    }));
    const authorizeInput = (mocks.appleAuthorizeUrl as any).mock.calls[0][0] as { nonce: string };
    const nonce = authorizeInput.nonce;
    expect(nonce.length).toBeGreaterThanOrEqual(20);
    expect(mocks.oAuthStateCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        provider: "apple",
        stateHash: expect.any(String),
        nonceHash: expect.any(String),
        redirectUri: "https://app.locateflow.com/api/auth/oauth/apple/callback",
        expiresAt: expect.any(Date),
      }),
    });
    expect(response.headers.get("set-cookie")).toContain("oauth_nonce_apple=");
  });
});
