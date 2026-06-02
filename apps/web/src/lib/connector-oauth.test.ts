import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OAuthProviderConfig } from "@locateflow/connectors";

const mocks = vi.hoisted(() => ({
  subscriptionFindUnique: vi.fn(),
  getRuntimeConfigValue: vi.fn(),
  consentFindMany: vi.fn(),
  consentUpdate: vi.fn(),
  consentUpdateMany: vi.fn(),
  consentCreate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: { findUnique: (...a: unknown[]) => mocks.subscriptionFindUnique(...a) },
    partnerConsent: {
      findMany: (...a: unknown[]) => mocks.consentFindMany(...a),
      update: (...a: unknown[]) => mocks.consentUpdate(...a),
      updateMany: (...a: unknown[]) => mocks.consentUpdateMany(...a),
      create: (...a: unknown[]) => mocks.consentCreate(...a),
    },
  },
}));
vi.mock("@/lib/runtime-config", () => ({
  getRuntimeConfigValue: (...a: unknown[]) => mocks.getRuntimeConfigValue(...a),
}));
vi.mock("@/lib/shared-encryption", () => ({ decrypt: (v: string) => v, encrypt: (v: string) => v }));

import {
  exchangeConnectorCode,
  getConnectorOAuthConfig,
  refreshConsentAccessToken,
  upsertGrantedConsent,
  userHasApiConnectorEntitlement,
} from "./connector-oauth";

const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000);

function mockConfig(values: Record<string, string | null>) {
  mocks.getRuntimeConfigValue.mockImplementation(async (key: string) => values[key] ?? null);
}

describe("userHasApiConnectorEntitlement - sync requires active annual Pro", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("allows an active annual Pro subscriber", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({
      plan: "PRO",
      status: "ACTIVE",
      accessType: "PAID",
      provider: "STRIPE",
      billingInterval: "YEAR",
      currentPeriodEndsAt: FUTURE,
    });
    await expect(userHasApiConnectorEntitlement("u1")).resolves.toBe(true);
  });

  it("blocks an active MONTHLY Pro subscriber (annual commitment required)", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({
      plan: "PRO",
      status: "ACTIVE",
      accessType: "PAID",
      provider: "STRIPE",
      billingInterval: "MONTH",
      currentPeriodEndsAt: FUTURE,
    });
    await expect(userHasApiConnectorEntitlement("u1")).resolves.toBe(false);
  });

  it.each([
    ["INDIVIDUAL", "MONTH", false],
    ["INDIVIDUAL", "YEAR", false],
    ["FAMILY", "MONTH", false],
    ["FAMILY", "YEAR", false],
    ["PRO", "MONTH", false],
    ["PRO", "YEAR", true],
  ] as const)("sync entitlement for %s %s is %s", async (plan, billingInterval, expected) => {
    mocks.subscriptionFindUnique.mockResolvedValue({
      plan,
      status: "ACTIVE",
      accessType: "PAID",
      provider: "STRIPE",
      billingInterval,
      currentPeriodEndsAt: FUTURE,
    });

    await expect(userHasApiConnectorEntitlement("u1")).resolves.toBe(expected);
  });

  it("blocks Family (tier without API connectors) even on annual", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({
      plan: "FAMILY",
      status: "ACTIVE",
      accessType: "PAID",
      provider: "STRIPE",
      billingInterval: "YEAR",
      currentPeriodEndsAt: FUTURE,
    });
    await expect(userHasApiConnectorEntitlement("u1")).resolves.toBe(false);
  });

  it("blocks a canceled annual Pro (no active access)", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({
      plan: "PRO",
      status: "CANCELED",
      accessType: "PAID",
      provider: "STRIPE",
      billingInterval: "YEAR",
      canceledAt: PAST,
      currentPeriodEndsAt: PAST,
    });
    await expect(userHasApiConnectorEntitlement("u1")).resolves.toBe(false);
  });

  it("exempts an admin-granted Pro (manual comp) from the annual requirement", async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({
      plan: "PRO",
      status: "ACTIVE",
      accessType: "PAID",
      provider: "ADMIN",
      premiumGrantedBy: "admin_1",
      premiumUntil: FUTURE,
    });
    await expect(userHasApiConnectorEntitlement("u1")).resolves.toBe(true);
  });
});

describe("getConnectorOAuthConfig", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllEnvs());

  it("returns config only when OAuth URLs are HTTPS and inside the connector manifest allowlist", async () => {
    mockConfig({
      CONNECTOR_USPS_OAUTH_CLIENT_ID: "client",
      CONNECTOR_USPS_OAUTH_CLIENT_SECRET: "secret",
      CONNECTOR_USPS_OAUTH_AUTHORIZE_URL: "https://apis.usps.com/oauth/authorize",
      CONNECTOR_USPS_OAUTH_TOKEN_URL: "https://apis.usps.com/oauth/token",
      CONNECTOR_USPS_OAUTH_SCOPES: "addresses change-of-address",
    });

    await expect(getConnectorOAuthConfig("usps", "https://app.example.com/callback")).resolves.toMatchObject({
      clientId: "client",
      tokenUrl: "https://apis.usps.com/oauth/token",
      scopes: ["addresses", "change-of-address"],
    });
  });

  it("rejects OAuth URLs outside the connector manifest allowlist", async () => {
    mockConfig({
      CONNECTOR_USPS_OAUTH_CLIENT_ID: "client",
      CONNECTOR_USPS_OAUTH_CLIENT_SECRET: "secret",
      CONNECTOR_USPS_OAUTH_AUTHORIZE_URL: "https://evil.example.com/oauth/authorize",
      CONNECTOR_USPS_OAUTH_TOKEN_URL: "https://apis.usps.com/oauth/token",
    });

    await expect(getConnectorOAuthConfig("usps", "https://app.example.com/callback")).resolves.toBeNull();
  });

  it("rejects non-HTTPS OAuth URLs", async () => {
    mockConfig({
      CONNECTOR_USPS_OAUTH_CLIENT_ID: "client",
      CONNECTOR_USPS_OAUTH_CLIENT_SECRET: "secret",
      CONNECTOR_USPS_OAUTH_AUTHORIZE_URL: "http://apis.usps.com/oauth/authorize",
      CONNECTOR_USPS_OAUTH_TOKEN_URL: "https://apis.usps.com/oauth/token",
    });

    await expect(getConnectorOAuthConfig("usps", "https://app.example.com/callback")).resolves.toBeNull();
  });

  it("falls back to process env OAuth settings when runtime config has no value", async () => {
    mocks.getRuntimeConfigValue.mockResolvedValue(null);
    vi.stubEnv("CONNECTOR_USPS_OAUTH_CLIENT_ID", "client-env");
    vi.stubEnv("CONNECTOR_USPS_OAUTH_CLIENT_SECRET", "secret-env");
    vi.stubEnv("CONNECTOR_USPS_OAUTH_AUTHORIZE_URL", "https://apis.usps.com/oauth/authorize");
    vi.stubEnv("CONNECTOR_USPS_OAUTH_TOKEN_URL", "https://apis.usps.com/oauth/token");
    vi.stubEnv("CONNECTOR_USPS_OAUTH_SCOPES", "addresses change-of-address");

    await expect(getConnectorOAuthConfig("usps", "https://app.example.com/callback")).resolves.toMatchObject({
      clientId: "client-env",
      clientSecret: "secret-env",
      scopes: ["addresses", "change-of-address"],
    });
  });
});

describe("exchangeConnectorCode", () => {
  const config: OAuthProviderConfig = {
    authorizeUrl: "https://apis.usps.com/oauth/authorize",
    tokenUrl: "https://apis.usps.com/oauth/token",
    clientId: "client",
    clientSecret: "secret",
    redirectUri: "https://app.example.com/callback",
    scopes: ["addresses"],
  };

  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("uses manual redirects and refuses redirected token responses", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(null, { status: 302, headers: { Location: "https://evil.example.com" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(exchangeConnectorCode(config, "code", "verifier")).resolves.toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ redirect: "manual" });
  });

  it("parses a successful token response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ access_token: "at", refresh_token: "rt", expires_in: 3600 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(exchangeConnectorCode(config, "code", "verifier")).resolves.toMatchObject({
      accessToken: "at",
      refreshToken: "rt",
    });
  });
});

describe("refreshConsentAccessToken", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("does not write refreshed tokens onto a consent revoked during refresh", async () => {
    mockConfig({
      CONNECTOR_USPS_OAUTH_CLIENT_ID: "client",
      CONNECTOR_USPS_OAUTH_CLIENT_SECRET: "secret",
      CONNECTOR_USPS_OAUTH_AUTHORIZE_URL: "https://apis.usps.com/oauth/authorize",
      CONNECTOR_USPS_OAUTH_TOKEN_URL: "https://apis.usps.com/oauth/token",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ access_token: "fresh-access", expires_in: 3600 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    mocks.consentUpdateMany.mockResolvedValue({ count: 0 });

    await expect(refreshConsentAccessToken("consent_1", "usps", "refresh-token")).resolves.toBeNull();

    expect(mocks.consentUpdateMany).toHaveBeenCalledWith({
      where: { id: "consent_1", status: "GRANTED" },
      data: expect.objectContaining({ tokenEncrypted: "fresh-access" }),
    });
  });

  it("returns the fresh access token only when the consent is still granted", async () => {
    mockConfig({
      CONNECTOR_USPS_OAUTH_CLIENT_ID: "client",
      CONNECTOR_USPS_OAUTH_CLIENT_SECRET: "secret",
      CONNECTOR_USPS_OAUTH_AUTHORIZE_URL: "https://apis.usps.com/oauth/authorize",
      CONNECTOR_USPS_OAUTH_TOKEN_URL: "https://apis.usps.com/oauth/token",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ access_token: "fresh-access", expires_in: 3600 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    mocks.consentUpdateMany.mockResolvedValue({ count: 1 });

    await expect(refreshConsentAccessToken("consent_1", "usps", "refresh-token")).resolves.toBe("fresh-access");
  });
});

describe("upsertGrantedConsent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps one active grant and revokes duplicate granted rows", async () => {
    const now = new Date("2026-06-01T12:00:00Z");
    mocks.consentFindMany.mockResolvedValue([{ id: "newest" }, { id: "older" }]);
    mocks.consentUpdate.mockResolvedValue({});
    mocks.consentUpdateMany.mockResolvedValue({ count: 1 });

    await expect(
      upsertGrantedConsent({
        userId: "u1",
        connectorKey: "usps",
        tokens: {
          accessToken: "at",
          refreshToken: "rt",
          expiresInSeconds: 3600,
          scope: "addresses",
          tokenType: "Bearer",
        },
        consentSnapshot: { connectorKey: "usps" },
        now,
      }),
    ).resolves.toBe("newest");

    expect(mocks.consentUpdateMany).toHaveBeenCalledWith({
      where: { userId: "u1", connectorKey: "usps", status: "GRANTED", id: { not: "newest" } },
      data: {
        status: "REVOKED",
        revokedAt: now,
        revocationReason: "SUPERSEDED",
        tokenEncrypted: null,
        refreshTokenEncrypted: null,
      },
    });
  });
});
