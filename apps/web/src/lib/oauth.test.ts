import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  getOAuthRedirectUri,
  getOAuthResponseUrl,
  normalizeOAuthRedirectPath,
} from "./oauth";

describe("OAuth URL helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

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

  it("falls back to configured origin when the request host is not trusted", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.locateflow.com");

    const request = new NextRequest("https://evil.example/api/auth/oauth/google/callback", {
      headers: {
        host: "evil.example",
        "x-forwarded-proto": "https",
      },
    });

    await expect(
      getOAuthResponseUrl(request, "/sign-in?error=missing-code").then((url) => url.toString()),
    ).resolves.toBe("https://app.locateflow.com/sign-in?error=missing-code");
  });
});
