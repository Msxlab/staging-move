import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    connectorConfig: { findMany: vi.fn() },
    connectorDispatch: { groupBy: vi.fn(), findMany: vi.fn() },
    partnerConsent: { groupBy: vi.fn() },
  },
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({
  requirePermission: mocks.requirePermission,
  requirePasswordConfirm: mocks.requirePasswordConfirm,
}));
// Resolver logic is unit-tested in the connectors package; here we stub it to
// assert the GET plumbs the per-connector mode through (and so the package
// import resolves under the admin test runner).
vi.mock("@locateflow/connectors", () => ({
  uspsConnector: {
    manifest: {
      capabilities: { addressUpdatePush: true },
      auth: { type: "OAUTH" },
      allowedHosts: ["apis.usps.com"],
    },
  },
  resolveConnectorMode: () => ({ mode: "GUIDED_UPDATE", reason: "test-guided", canApiSync: false }),
}));
// GET now reads runtime-config for the agreement/credential gate inputs.
vi.mock("@/lib/runtime-config", () => ({ getAdminRuntimeConfigValue: vi.fn().mockResolvedValue(null) }));

describe("admin connectors GET — per-connector ops health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1" });
    mocks.prisma.connectorConfig.findMany.mockResolvedValue([
      { id: "c1", connectorKey: "usps", version: "1.0.0", enabled: true, rolloutPercent: 10, circuitState: "CLOSED", stage: "ROLLOUT", notes: null, updatedAt: new Date() },
    ]);
    // groupBy is called twice: once by ["status"] (global) and once by
    // ["connectorKey","status"] (per-connector). Distinguish on the `by` arity.
    mocks.prisma.connectorDispatch.groupBy.mockImplementation(({ by }: any) =>
      by.length === 1
        ? Promise.resolve([
            { status: "CONFIRMED", _count: { _all: 5 } },
            { status: "FAILED", _count: { _all: 2 } },
          ])
        : Promise.resolve([
            { connectorKey: "usps", status: "CONFIRMED", _count: { _all: 5 } },
            { connectorKey: "usps", status: "FAILED", _count: { _all: 2 } },
          ]),
    );
    mocks.prisma.partnerConsent.groupBy.mockResolvedValue([
      { connectorKey: "usps", status: "GRANTED", _count: { _all: 12 } },
      { connectorKey: "usps", status: "REVOKED", _count: { _all: 3 } },
    ]);
    // Newest-first; GET keeps the first errored row per connector as "last error".
    mocks.prisma.connectorDispatch.findMany.mockResolvedValue([
      { connectorKey: "usps", lastErrorCode: "PARTNER_DOWN", status: "NEEDS_USER", updatedAt: new Date("2026-05-30T10:00:00Z") },
      { connectorKey: "usps", lastErrorCode: "RATE_LIMITED", status: "QUEUED", updatedAt: new Date("2026-05-29T10:00:00Z") },
    ]);
  });

  it("aggregates dispatch breakdown, consent counts, and last failure per connector", async () => {
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.dispatchByConnector).toEqual({ usps: { CONFIRMED: 5, FAILED: 2 } });
    expect(body.consentsByConnector).toEqual({ usps: { GRANTED: 12, REVOKED: 3 } });
    // First (newest) errored row wins for the last-failure readout.
    expect(body.lastFailureByConnector.usps).toMatchObject({ errorCode: "PARTNER_DOWN", status: "NEEDS_USER" });
    // Global summary strip preserved for backward-compat with the client.
    expect(body.dispatchHealth).toEqual({ CONFIRMED: 5, FAILED: 2 });
    // Honest per-connector operating mode is plumbed through from the resolver.
    expect(body.modeByConnector.usps).toEqual({ mode: "GUIDED_UPDATE", reason: "test-guided" });

    // Only the bounded recent-failure scan is used (no unbounded history query).
    expect(mocks.prisma.connectorDispatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { lastErrorCode: { not: null } },
        orderBy: { updatedAt: "desc" },
        take: 200,
      }),
    );
  });

  it("returns empty maps when there is no connector activity", async () => {
    mocks.prisma.connectorDispatch.groupBy.mockResolvedValue([]);
    mocks.prisma.partnerConsent.groupBy.mockResolvedValue([]);
    mocks.prisma.connectorDispatch.findMany.mockResolvedValue([]);

    const { GET } = await import("./route");
    const res = await GET();
    const body = await res.json();

    expect(body.dispatchByConnector).toEqual({});
    expect(body.consentsByConnector).toEqual({});
    expect(body.lastFailureByConnector).toEqual({});
  });

  it("denies non-permitted callers (does not leak connector data)", async () => {
    mocks.requirePermission.mockRejectedValue(new Error("FORBIDDEN"));
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(403);
  });
});
