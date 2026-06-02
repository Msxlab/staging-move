import { afterEach, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync } from "crypto";
import { NextRequest } from "next/server";
import {
  exchangeAppleCode,
  getOAuthRedirectUri,
  getOAuthResponseUrl,
  isAppleEmailVerifiedClaim,
  normalizeApplePrivateKeyPem,
  normalizeOAuthRedirectPath,
  resolveOAuthPostAuthRedirectPath,
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
    expect(normalizeOAuthRedirectPath("/providers/provider_123")).toBe("/providers/provider_123");
    expect(normalizeOAuthRedirectPath("/api/auth/me")).toBe("/dashboard");
    expect(normalizeOAuthRedirectPath("/login")).toBe("/dashboard");
    expect(normalizeOAuthRedirectPath("//evil.example")).toBe("/dashboard");
    expect(normalizeOAuthRedirectPath("https://evil.example")).toBe("/dashboard");
  });

  it("sends fresh OAuth signups directly to the onboarding legal step", () => {
    expect(
      resolveOAuthPostAuthRedirectPath({
        isNewUser: true,
        redirectPath: "/dashboard",
      }),
    ).toBe("/onboarding?step=legal");
    expect(
      resolveOAuthPostAuthRedirectPath({
        isNewUser: false,
        redirectPath: "/providers/provider_123",
      }),
    ).toBe("/providers/provider_123");
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

describe("Apple OAuth email verification claim", () => {
  it("allows boolean true and string true claims", () => {
    expect(isAppleEmailVerifiedClaim(true)).toBe(true);
    expect(isAppleEmailVerifiedClaim("true")).toBe(true);
  });

  it("rejects false, string false, and missing claims", () => {
    expect(isAppleEmailVerifiedClaim(false)).toBe(false);
    expect(isAppleEmailVerifiedClaim("false")).toBe(false);
    expect(isAppleEmailVerifiedClaim(undefined)).toBe(false);
  });
});

describe("Apple OAuth private key handling", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function generatedPrivateKeyBody() {
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const pem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
    return pem
      .replace(/-----BEGIN PRIVATE KEY-----/g, "")
      .replace(/-----END PRIVATE KEY-----/g, "")
      .replace(/\s+/g, "");
  }

  it("wraps bare .p8 PEM body values before signing the Apple client secret", async () => {
    const privateKeyBody = generatedPrivateKeyBody();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ id_token: "apple-id-token" }),
      })),
    );

    await expect(
      exchangeAppleCode({
        code: "auth-code",
        redirectUri: "https://locateflow.com/api/auth/oauth/apple/callback",
        clientId: "com.locateflow.auth",
        teamId: "ABCDE12345",
        keyId: "ABCDE12345",
        privateKeyPem: privateKeyBody,
      }),
    ).resolves.toEqual({ idToken: "apple-id-token" });

    expect(normalizeApplePrivateKeyPem(privateKeyBody)).toContain("-----BEGIN PRIVATE KEY-----");
    expect(fetch).toHaveBeenCalledWith(
      "https://appleid.apple.com/auth/token",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
