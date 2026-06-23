import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/oauth", () => ({
  googleAuthorizeUrl: vi.fn(() => new URL("https://accounts.google.com/o/oauth2/v2/auth")),
  generateState: vi.fn(() => "oauth-state"),
  generatePkce: vi.fn(() => ({ verifier: "pkce-verifier", challenge: "server-pkce-challenge" })),
  getGoogleOAuthCredentials: vi.fn(() => Promise.resolve({ clientId: "client-id", clientSecret: "client-secret" })),
  getOAuthRedirectUri: vi.fn(() => Promise.resolve("https://app.locateflow.com/api/auth/oauth/google/callback")),
  normalizeOAuthRedirectPath: vi.fn((value: string) => value || "/dashboard"),
}));

vi.mock("@/lib/user-auth", () => ({
  shouldUseSecureSessionCookies: vi.fn(() => true),
}));

vi.mock("@/lib/db", () => ({
  prisma: { oAuthState: { create: vi.fn(() => Promise.resolve({ id: "state-1" })) } },
}));

import { prisma } from "@/lib/db";
import { GET } from "./route";

describe("Google OAuth mobile init", () => {
  it("rejects mobile OAuth init without a PKCE challenge", async () => {
    const response = await GET(new NextRequest(
      "https://app.locateflow.com/api/auth/oauth/google?client=mobile&mobileRedirectUri=locateflow%3A%2F%2Foauth",
    ));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("PKCE challenge");
  });

  it("persists a single-use OAuthState record on a web init (replay guard)", async () => {
    const response = await GET(new NextRequest(
      "https://app.locateflow.com/api/auth/oauth/google?redirect=/dashboard",
    ));

    expect(response.status).toBe(307); // redirect to Google
    expect(prisma.oAuthState.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ provider: "google", stateHash: expect.any(String) }),
      }),
    );
  });
});
