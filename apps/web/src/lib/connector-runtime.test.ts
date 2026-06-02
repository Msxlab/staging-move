import { describe, expect, it, vi, beforeEach } from "vitest";

const rcMock = vi.hoisted(() => ({ getRuntimeConfigValue: vi.fn() }));
const dbMocks = vi.hoisted(() => ({
  prisma: {
    connectorConfig: { findUnique: vi.fn() },
    connectorDispatch: { update: vi.fn() },
    partnerConsent: { findUnique: vi.fn() },
    notificationPreference: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/runtime-config", () => ({ getRuntimeConfigValue: rcMock.getRuntimeConfigValue }));
vi.mock("@/lib/db", () => ({ prisma: dbMocks.prisma }));
vi.mock("@/lib/shared-encryption", () => ({
  decrypt: (value: string) => value,
  encrypt: (value: string) => value,
}));
vi.mock("@/lib/connector-oauth", () => ({ refreshConsentAccessToken: vi.fn() }));
vi.mock("@/lib/in-app-notifications", () => ({ createInAppNotification: vi.fn() }));
vi.mock("@/lib/email-service", () => ({ sendConnectorActionNeededEmail: vi.fn() }));
vi.mock("@/lib/notification-preferences", () => ({ isWebNotificationEnabled: vi.fn(() => false) }));

import { connectorRegistry } from "./connector-registry";
import { toCanonicalAddress, isApiSyncConnector, runDispatchRow } from "./connector-runtime";

describe("toCanonicalAddress", () => {
  it("maps DB address fields and normalizes USA → US", () => {
    expect(
      toCanonicalAddress({ street: "1 New St", street2: null, city: "Boston", state: "MA", zip: "02101", country: "USA" }),
    ).toEqual({ street1: "1 New St", street2: null, city: "Boston", state: "MA", zip: "02101", country: "US" });
  });

  it("passes through a non-USA country and keeps street2", () => {
    const out = toCanonicalAddress({ street: "x", street2: "Apt 4", city: "Toronto", state: "ON", zip: "M5V", country: "CA" });
    expect(out.country).toBe("CA");
    expect(out.street2).toBe("Apt 4");
  });
});

describe("connectorRegistry", () => {
  it("registers the USPS connector", () => {
    expect(connectorRegistry.has("usps")).toBe(true);
    expect(connectorRegistry.get("usps")?.manifest.fallbackActionKey).toBeTruthy();
  });
});

describe("isApiSyncConnector — server push only with a real agreement + credentials", () => {
  beforeEach(() => vi.clearAllMocks());

  it("false for usps with no production agreement (the default)", async () => {
    rcMock.getRuntimeConfigValue.mockResolvedValue(null);
    expect(await isApiSyncConnector("usps", { enabled: true, stage: "GA" })).toBe(false);
  });

  it("true for usps with a PRODUCTION agreement + credentials", async () => {
    rcMock.getRuntimeConfigValue.mockImplementation((k: string) => {
      if (k.endsWith("_AGREEMENT_STATUS")) return Promise.resolve("PRODUCTION");
      if (k.endsWith("_OAUTH_CLIENT_ID") || k.endsWith("_OAUTH_CLIENT_SECRET")) return Promise.resolve("x");
      if (k.endsWith("_OAUTH_AUTHORIZE_URL")) return Promise.resolve("https://apis.usps.com/oauth/authorize");
      if (k.endsWith("_OAUTH_TOKEN_URL")) return Promise.resolve("https://apis.usps.com/oauth/token");
      return Promise.resolve(null);
    });
    expect(await isApiSyncConnector("usps", { enabled: true, stage: "GA" })).toBe(true);
  });

  it("false with an agreement but missing full OAuth credentials", async () => {
    rcMock.getRuntimeConfigValue.mockImplementation((k: string) =>
      k.endsWith("_AGREEMENT_STATUS") ? Promise.resolve("PRODUCTION") :
        k.endsWith("_OAUTH_CLIENT_ID") || k.endsWith("_OAUTH_CLIENT_SECRET") ? Promise.resolve("x") :
          Promise.resolve(null),
    );
    expect(await isApiSyncConnector("usps", { enabled: true, stage: "GA" })).toBe(false);
  });

  it("false when OAuth URLs are outside the connector host allowlist", async () => {
    rcMock.getRuntimeConfigValue.mockImplementation((k: string) => {
      if (k.endsWith("_AGREEMENT_STATUS")) return Promise.resolve("PRODUCTION");
      if (k.endsWith("_OAUTH_CLIENT_ID") || k.endsWith("_OAUTH_CLIENT_SECRET")) return Promise.resolve("x");
      if (k.endsWith("_OAUTH_AUTHORIZE_URL")) return Promise.resolve("https://evil.example.com/oauth/authorize");
      if (k.endsWith("_OAUTH_TOKEN_URL")) return Promise.resolve("https://apis.usps.com/oauth/token");
      return Promise.resolve(null);
    });
    expect(await isApiSyncConnector("usps", { enabled: true, stage: "GA" })).toBe(false);
  });

  it("false for an unregistered connector", async () => {
    rcMock.getRuntimeConfigValue.mockResolvedValue("PRODUCTION");
    expect(await isApiSyncConnector("nope", { enabled: true, stage: "GA" })).toBe(false);
  });
});

describe("runDispatchRow mode gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rcMock.getRuntimeConfigValue.mockResolvedValue(null);
    dbMocks.prisma.connectorConfig.findUnique.mockResolvedValue({
      enabled: true,
      circuitState: "CLOSED",
      stage: "GA",
    });
    dbMocks.prisma.connectorDispatch.update.mockResolvedValue({});
    dbMocks.prisma.user.findUnique.mockResolvedValue({ email: null, firstName: null });
    dbMocks.prisma.notificationPreference.findMany.mockResolvedValue([]);
  });

  it("does not push an already-queued row when the connector is no longer API_SYNC", async () => {
    const status = await runDispatchRow({
      id: "dispatch_1",
      connectorKey: "usps",
      userId: "user_1",
      consentId: "consent_1",
      idempotencyKey: "idem_1",
      attemptCount: 0,
      payloadEncrypted: JSON.stringify({
        eventId: "event_1",
        from: { street1: "1 Old St", city: "Austin", state: "TX", zip: "78701", country: "US" },
        to: { street1: "2 New St", city: "Austin", state: "TX", zip: "78702", country: "US" },
        fullName: "User One",
        fields: {},
      }),
    });

    expect(status).toBe("NEEDS_USER");
    expect(dbMocks.prisma.partnerConsent.findUnique).not.toHaveBeenCalled();
    expect(dbMocks.prisma.connectorDispatch.update).toHaveBeenCalledWith({
      where: { id: "dispatch_1" },
      data: expect.objectContaining({
        status: "NEEDS_USER",
        lastErrorCode: "NOT_SUPPORTED",
        resultMetadataJson: JSON.stringify({ reason: "MODE_NOT_API_SYNC" }),
      }),
    });
  });

  it("does not push when the stored consent was revoked before dispatch", async () => {
    rcMock.getRuntimeConfigValue.mockImplementation((k: string) => {
      if (k.endsWith("_AGREEMENT_STATUS")) return Promise.resolve("PRODUCTION");
      if (k.endsWith("_OAUTH_CLIENT_ID") || k.endsWith("_OAUTH_CLIENT_SECRET")) return Promise.resolve("x");
      if (k.endsWith("_OAUTH_AUTHORIZE_URL")) return Promise.resolve("https://apis.usps.com/oauth/authorize");
      if (k.endsWith("_OAUTH_TOKEN_URL")) return Promise.resolve("https://apis.usps.com/oauth/token");
      return Promise.resolve(null);
    });
    dbMocks.prisma.partnerConsent.findUnique.mockResolvedValue({
      status: "REVOKED",
      tokenEncrypted: "access-token",
      refreshTokenEncrypted: null,
      tokenExpiresAt: new Date(Date.now() + 60_000),
    });

    const status = await runDispatchRow({
      id: "dispatch_revoked",
      connectorKey: "usps",
      userId: "user_1",
      consentId: "consent_1",
      idempotencyKey: "idem_1",
      attemptCount: 0,
      payloadEncrypted: JSON.stringify({
        eventId: "event_1",
        from: { street1: "1 Old St", city: "Austin", state: "TX", zip: "78701", country: "US" },
        to: { street1: "2 New St", city: "Austin", state: "TX", zip: "78702", country: "US" },
        fullName: "User One",
        fields: {},
      }),
    });

    expect(status).toBe("NEEDS_USER");
    expect(dbMocks.prisma.connectorDispatch.update).toHaveBeenCalledWith({
      where: { id: "dispatch_revoked" },
      data: { status: "NEEDS_USER", lastErrorCode: "REVOKED" },
    });
    expect(dbMocks.prisma.connectorDispatch.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DISPATCHING" }),
      }),
    );
  });

  it("re-checks consent after token load and stops if the user revoked it", async () => {
    rcMock.getRuntimeConfigValue.mockImplementation((k: string) => {
      if (k.endsWith("_AGREEMENT_STATUS")) return Promise.resolve("PRODUCTION");
      if (k.endsWith("_OAUTH_CLIENT_ID") || k.endsWith("_OAUTH_CLIENT_SECRET")) return Promise.resolve("x");
      if (k.endsWith("_OAUTH_AUTHORIZE_URL")) return Promise.resolve("https://apis.usps.com/oauth/authorize");
      if (k.endsWith("_OAUTH_TOKEN_URL")) return Promise.resolve("https://apis.usps.com/oauth/token");
      return Promise.resolve(null);
    });
    dbMocks.prisma.partnerConsent.findUnique
      .mockResolvedValueOnce({
        status: "GRANTED",
        tokenEncrypted: "access-token",
        refreshTokenEncrypted: null,
        tokenExpiresAt: new Date(Date.now() + 60_000),
      })
      .mockResolvedValueOnce({ status: "REVOKED" });

    const status = await runDispatchRow({
      id: "dispatch_revoked_after_read",
      connectorKey: "usps",
      userId: "user_1",
      consentId: "consent_1",
      idempotencyKey: "idem_1",
      attemptCount: 0,
      payloadEncrypted: JSON.stringify({
        eventId: "event_1",
        from: { street1: "1 Old St", city: "Austin", state: "TX", zip: "78701", country: "US" },
        to: { street1: "2 New St", city: "Austin", state: "TX", zip: "78702", country: "US" },
        fullName: "User One",
        fields: {},
      }),
    });

    expect(status).toBe("NEEDS_USER");
    expect(dbMocks.prisma.connectorDispatch.update).toHaveBeenCalledWith({
      where: { id: "dispatch_revoked_after_read" },
      data: { status: "NEEDS_USER", lastErrorCode: "REVOKED" },
    });
    expect(dbMocks.prisma.connectorDispatch.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DISPATCHING" }),
      }),
    );
  });
});
