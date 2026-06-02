import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserSession: vi.fn(),
  getRuntimeConfigValue: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { connectorConfig: { findMany: mocks.findMany } } }));
vi.mock("@/lib/user-auth", () => ({ getUserSession: mocks.getUserSession }));
vi.mock("@/lib/runtime-config", () => ({ getRuntimeConfigValue: mocks.getRuntimeConfigValue }));
vi.mock("@/lib/connector-registry", () => ({
  connectorRegistry: {
    list: () => [
      { manifest: { key: "usps", displayName: "USPS", capabilities: { addressUpdatePush: true } } },
      { manifest: { key: "ups", displayName: "UPS", capabilities: { addressUpdatePush: true } } },
    ],
  },
}));
// Stub the resolver (its logic is unit-tested in the connectors package): a
// connector with an enabled config resolves to GUIDED_UPDATE, otherwise DISABLED.
vi.mock("@locateflow/connectors", () => ({
  resolveConnectorMode: (input: { enabled: boolean }) =>
    input.enabled
      ? { mode: "GUIDED_UPDATE", reason: "x", canApiSync: false }
      : { mode: "DISABLED", reason: "x", canApiSync: false },
}));

describe("GET /api/connectors/catalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserSession.mockResolvedValue({ userId: "user_1" });
    mocks.getRuntimeConfigValue.mockResolvedValue("true");
    // Only usps is enabled in the control plane; ups has no config row.
    mocks.findMany.mockResolvedValue([{ connectorKey: "usps", enabled: true, stage: "GA" }]);
  });

  it("returns 401 for an unauthenticated caller", async () => {
    mocks.getUserSession.mockResolvedValue(null);
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("is inert (empty catalog) when the master flag is off", async () => {
    mocks.getRuntimeConfigValue.mockResolvedValue(null);
    const { GET } = await import("./route");
    const res = await GET();
    const body = await res.json();
    expect(body.connectors).toEqual([]);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("lists connectors with their derived mode, omitting DISABLED (un-configured/kill-switched)", async () => {
    const { GET } = await import("./route");
    const res = await GET();
    const body = await res.json();
    // ups has no config → enabled false → DISABLED → filtered out. usps kept.
    expect(body.connectors).toEqual([{ connectorKey: "usps", displayName: "USPS", mode: "GUIDED_UPDATE" }]);
  });
});
