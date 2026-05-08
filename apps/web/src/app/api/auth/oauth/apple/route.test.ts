import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/oauth", () => ({
  appleAuthorizeUrl: vi.fn(() => new URL("https://appleid.apple.com/auth/authorize")),
  generateState: vi.fn(() => "oauth-state"),
  getAppleOAuthCredentials: vi.fn(() => Promise.resolve({ clientId: "apple-client-id" })),
  getOAuthRedirectUri: vi.fn(() => Promise.resolve("https://app.locateflow.com/api/auth/oauth/apple/callback")),
  normalizeOAuthRedirectPath: vi.fn((value: string) => value || "/dashboard"),
}));

vi.mock("@/lib/user-auth", () => ({
  shouldUseSecureSessionCookies: vi.fn(() => true),
}));

import { GET } from "./route";

describe("Apple OAuth mobile init", () => {
  it("rejects mobile OAuth init without a PKCE challenge", async () => {
    const response = await GET(new NextRequest(
      "https://app.locateflow.com/api/auth/oauth/apple?client=mobile&mobileRedirectUri=locateflow%3A%2F%2Foauth",
    ));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("PKCE challenge");
  });
});
