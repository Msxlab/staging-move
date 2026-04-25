import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  getOAuthRedirectUri,
  getOAuthResponseUrl,
  normalizeOAuthRedirectPath,
} from "./oauth";

describe("OAuth URL helpers", () => {
  it("builds callback and response URLs from forwarded host behind a proxy", async () => {
    const request = new NextRequest("https://localhost:8080/api/auth/oauth/google/callback", {
      headers: {
        "x-forwarded-host": "locateflow-staging-owew7.ondigitalocean.app",
        "x-forwarded-proto": "https",
      },
    });

    await expect(
      getOAuthRedirectUri(request, "/api/auth/oauth/google/callback"),
    ).resolves.toBe(
      "https://locateflow-staging-owew7.ondigitalocean.app/api/auth/oauth/google/callback",
    );

    await expect(
      getOAuthResponseUrl(request, "/sign-in?error=missing-code").then((url) => url.toString()),
    ).resolves.toBe("https://locateflow-staging-owew7.ondigitalocean.app/sign-in?error=missing-code");
  });

  it("keeps post-login redirects same-site and relative", () => {
    expect(normalizeOAuthRedirectPath("/dashboard")).toBe("/dashboard");
    expect(normalizeOAuthRedirectPath("//evil.example")).toBe("/dashboard");
    expect(normalizeOAuthRedirectPath("https://evil.example")).toBe("/dashboard");
  });
});
