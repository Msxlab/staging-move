import { describe, expect, it } from "vitest";
import {
  buildAuthorizeUrl,
  buildRefreshBody,
  buildTokenExchangeBody,
  codeChallengeFromVerifier,
  generateCodeVerifier,
  generateState,
  parseTokenResponse,
  tokenExpiryFrom,
  type OAuthProviderConfig,
} from "./oauth";

const config: OAuthProviderConfig = {
  authorizeUrl: "https://accounts.example.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.example.com/token",
  clientId: "client-123",
  clientSecret: "secret-xyz",
  redirectUri: "https://app.locateflow.com/api/partner-consents/oauth/callback",
  scopes: ["addresses", "change-of-address"],
};

describe("PKCE", () => {
  it("derives the S256 challenge per the RFC 7636 test vector", () => {
    // RFC 7636 Appendix B.
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    expect(codeChallengeFromVerifier(verifier)).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("produces url-safe verifiers and state from injected bytes", () => {
    const bytes = () => Buffer.from([251, 255, 191, 0, 1, 2]); // contains +,/,= triggers
    const verifier = generateCodeVerifier(bytes);
    const state = generateState(bytes);
    expect(verifier).not.toMatch(/[+/=]/);
    expect(state).not.toMatch(/[+/=]/);
  });
});

describe("buildAuthorizeUrl", () => {
  it("includes all required OAuth + PKCE params", () => {
    const url = new URL(
      buildAuthorizeUrl({
        config,
        state: "st-1",
        codeChallenge: "ch-1",
        extra: { access_type: "offline", prompt: "consent" },
      }),
    );
    expect(url.origin + url.pathname).toBe("https://accounts.example.com/o/oauth2/v2/auth");
    const q = url.searchParams;
    expect(q.get("response_type")).toBe("code");
    expect(q.get("client_id")).toBe("client-123");
    expect(q.get("redirect_uri")).toBe(config.redirectUri);
    expect(q.get("scope")).toBe("addresses change-of-address");
    expect(q.get("state")).toBe("st-1");
    expect(q.get("code_challenge")).toBe("ch-1");
    expect(q.get("code_challenge_method")).toBe("S256");
    expect(q.get("access_type")).toBe("offline");
    expect(q.get("prompt")).toBe("consent");
  });
});

describe("token exchange bodies", () => {
  it("builds the authorization_code body with the verifier and secret", () => {
    const body = buildTokenExchangeBody({ config, code: "auth-code", codeVerifier: "verifier" });
    expect(body).toMatchObject({
      grant_type: "authorization_code",
      code: "auth-code",
      redirect_uri: config.redirectUri,
      client_id: "client-123",
      client_secret: "secret-xyz",
      code_verifier: "verifier",
    });
  });

  it("builds the refresh_token body", () => {
    const body = buildRefreshBody({ config, refreshToken: "rt-1" });
    expect(body).toMatchObject({
      grant_type: "refresh_token",
      refresh_token: "rt-1",
      client_id: "client-123",
      client_secret: "secret-xyz",
    });
  });
});

describe("parseTokenResponse", () => {
  it("normalizes a snake_case provider response", () => {
    const tokens = parseTokenResponse({
      access_token: "at-1",
      refresh_token: "rt-1",
      expires_in: 3600,
      scope: "addresses",
      token_type: "Bearer",
    });
    expect(tokens).toEqual({
      accessToken: "at-1",
      refreshToken: "rt-1",
      expiresInSeconds: 3600,
      scope: "addresses",
      tokenType: "Bearer",
    });
  });

  it("tolerates a missing refresh_token but requires access_token", () => {
    expect(parseTokenResponse({ access_token: "at-1" }).refreshToken).toBeNull();
    expect(() => parseTokenResponse({})).toThrow(/access_token/);
  });
});

describe("tokenExpiryFrom", () => {
  it("computes an absolute expiry from expires_in", () => {
    const now = 1_000_000;
    expect(tokenExpiryFrom(3600, now)?.getTime()).toBe(now + 3_600_000);
    expect(tokenExpiryFrom(null, now)).toBeNull();
  });
});
