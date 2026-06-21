import { describe, expect, it, vi, beforeEach } from "vitest";

const rcMock = vi.hoisted(() => ({ getRuntimeConfigValue: vi.fn() }));
const dbMocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    address: { findFirst: vi.fn() },
    addressChangeEvent: { create: vi.fn(), update: vi.fn() },
    connectorConfig: { findMany: vi.fn(), findUnique: vi.fn() },
    connectorDispatch: { create: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    partnerConsent: { findMany: vi.fn(), findUnique: vi.fn() },
    notificationPreference: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
    workspace: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/runtime-config", () => ({ getRuntimeConfigValue: rcMock.getRuntimeConfigValue }));
vi.mock("@/lib/db", () => ({ prisma: dbMocks.prisma }));
vi.mock("@/lib/shared-encryption", () => ({
  decrypt: (value: string) => value,
  encrypt: (value: string) => value,
}));
const connectorOAuthMocks = vi.hoisted(() => ({
  isApiConnectorsEnabled: vi.fn(),
  refreshConsentAccessToken: vi.fn(),
  userHasApiConnectorEntitlement: vi.fn(),
}));
vi.mock("@/lib/connector-oauth", () => ({
  isApiConnectorsEnabled: connectorOAuthMocks.isApiConnectorsEnabled,
  refreshConsentAccessToken: connectorOAuthMocks.refreshConsentAccessToken,
  userHasApiConnectorEntitlement: connectorOAuthMocks.userHasApiConnectorEntitlement,
}));
vi.mock("@/lib/in-app-notifications", () => ({ createInAppNotification: vi.fn() }));
vi.mock("@/lib/email-service", () => ({ sendConnectorActionNeededEmail: vi.fn() }));
vi.mock("@/lib/notification-preferences", () => ({ isWebNotificationEnabled: vi.fn(() => false) }));

import { connectorRegistry } from "./connector-registry";
import { toCanonicalAddress, enqueueAddressChange, isApiSyncConnector, runDispatchRow, runDueDispatches } from "./connector-runtime";

beforeEach(() => {
  connectorOAuthMocks.isApiConnectorsEnabled.mockResolvedValue(true);
  connectorOAuthMocks.userHasApiConnectorEntitlement.mockResolvedValue(true);
});

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
    connectorOAuthMocks.isApiConnectorsEnabled.mockResolvedValue(true);
    connectorOAuthMocks.userHasApiConnectorEntitlement.mockResolvedValue(true);
    rcMock.getRuntimeConfigValue.mockResolvedValue(null);
    dbMocks.prisma.connectorConfig.findUnique.mockResolvedValue({
      enabled: true,
      circuitState: "CLOSED",
      stage: "GA",
    });
    dbMocks.prisma.connectorDispatch.findMany.mockResolvedValue([]);
    dbMocks.prisma.connectorDispatch.update.mockResolvedValue({});
    dbMocks.prisma.connectorDispatch.updateMany.mockResolvedValue({ count: 0 });
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

  it("keeps a shadow-created row in dry-run even if the connector is later promoted", async () => {
    dbMocks.prisma.connectorConfig.findUnique.mockResolvedValue({
      enabled: true,
      circuitState: "CLOSED",
      stage: "GA",
    });

    const status = await runDispatchRow({
      id: "dispatch_shadow",
      connectorKey: "usps",
      userId: "user_1",
      consentId: "consent_1",
      idempotencyKey: "idem_shadow",
      attemptCount: 0,
      isShadow: true,
      payloadEncrypted: JSON.stringify({
        eventId: "event_1",
        from: { street1: "1 Old St", city: "Austin", state: "TX", zip: "78701", country: "US" },
        to: { street1: "2 New St", city: "Austin", state: "TX", zip: "78702", country: "US" },
        fullName: "User One",
        fields: {},
      }),
    });

    expect(status).toBe("CONFIRMED");
    expect(dbMocks.prisma.partnerConsent.findUnique).not.toHaveBeenCalled();
    expect(dbMocks.prisma.connectorDispatch.update).toHaveBeenCalledWith({
      where: { id: "dispatch_shadow" },
      data: expect.objectContaining({
        status: "CONFIRMED",
        isShadow: true,
        resultMetadataJson: expect.stringContaining('"shadow":true'),
      }),
    });
  });

  it("fails an unreadable shadow row without handing it to the user fallback", async () => {
    const status = await runDispatchRow({
      id: "dispatch_shadow_bad_payload",
      connectorKey: "usps",
      userId: "user_1",
      consentId: "consent_1",
      idempotencyKey: "idem_shadow_bad",
      attemptCount: 0,
      isShadow: true,
      payloadEncrypted: "not-json",
    });

    expect(status).toBe("FAILED");
    expect(dbMocks.prisma.connectorConfig.findUnique).not.toHaveBeenCalled();
    expect(dbMocks.prisma.partnerConsent.findUnique).not.toHaveBeenCalled();
    expect(dbMocks.prisma.user.findUnique).not.toHaveBeenCalled();
    expect(dbMocks.prisma.connectorDispatch.update).toHaveBeenCalledWith({
      where: { id: "dispatch_shadow_bad_payload" },
      data: expect.objectContaining({
        status: "FAILED",
        isShadow: true,
        lastErrorCode: "NOT_SUPPORTED",
      }),
    });
  });

  it("marks stale shadow dry-run claims failed instead of notifying users", async () => {
    dbMocks.prisma.connectorDispatch.findMany
      .mockResolvedValueOnce([{ id: "shadow_stale" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    dbMocks.prisma.connectorDispatch.updateMany.mockResolvedValue({ count: 1 });

    await expect(runDueDispatches()).resolves.toEqual({ processed: 0, failed: 0 });

    expect(dbMocks.prisma.connectorDispatch.updateMany).toHaveBeenCalledWith({
      where: { id: "shadow_stale", status: "DISPATCHING", isShadow: true },
      data: {
        status: "FAILED",
        resultMetadataJson: JSON.stringify({ reason: "SHADOW_WORKER_TIMEOUT", shadow: true }),
      },
    });
    expect(dbMocks.prisma.user.findUnique).not.toHaveBeenCalled();
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

describe("enqueueAddressChange entitlement gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connectorOAuthMocks.isApiConnectorsEnabled.mockResolvedValue(true);
    connectorOAuthMocks.userHasApiConnectorEntitlement.mockResolvedValue(true);
    dbMocks.prisma.address.findFirst.mockResolvedValue({
      id: "addr_1",
      street: "1 New St",
      street2: null,
      city: "Austin",
      state: "TX",
      zip: "78701",
      country: "USA",
    });
    dbMocks.prisma.user.findUnique.mockResolvedValue({ firstName: "User", lastName: "One" });
    dbMocks.prisma.partnerConsent.findMany.mockResolvedValue([]);
    dbMocks.prisma.connectorConfig.findMany.mockResolvedValue([]);
    dbMocks.prisma.addressChangeEvent.create.mockResolvedValue({ id: "event_row_1" });
    dbMocks.prisma.addressChangeEvent.update.mockResolvedValue({});
    dbMocks.prisma.$transaction.mockImplementation(async (fn: any) => fn(dbMocks.prisma));
  });

  it("refuses to enqueue when the feature flag is disabled", async () => {
    connectorOAuthMocks.isApiConnectorsEnabled.mockResolvedValue(false);

    await expect(enqueueAddressChange({ userId: "user_1", toAddressId: "addr_1" })).rejects.toThrow(
      "CONNECTORS_DISABLED",
    );
    expect(dbMocks.prisma.address.findFirst).not.toHaveBeenCalled();
  });

  it("checks the workspace owner's connector entitlement for workspace sync", async () => {
    dbMocks.prisma.workspace.findFirst.mockResolvedValue({ ownerUserId: "owner_1" });
    connectorOAuthMocks.userHasApiConnectorEntitlement.mockResolvedValue(false);

    await expect(
      enqueueAddressChange({ userId: "member_1", workspaceId: "ws_1", toAddressId: "addr_1" }),
    ).rejects.toThrow("CONNECTORS_NOT_ENTITLED");
    expect(connectorOAuthMocks.userHasApiConnectorEntitlement).toHaveBeenCalledWith("owner_1");
    expect(dbMocks.prisma.address.findFirst).not.toHaveBeenCalled();
  });
});
