import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserSession: vi.fn(),
  getRuntimeConfigValue: vi.fn(),
  findMany: vi.fn(),
  userHasApiConnectorEntitlement: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { connectorConfig: { findMany: mocks.findMany } } }));
vi.mock("@/lib/user-auth", () => ({ getUserSession: mocks.getUserSession }));
vi.mock("@/lib/runtime-config", () => ({ getRuntimeConfigValue: mocks.getRuntimeConfigValue }));
vi.mock("@/lib/connector-oauth", () => ({
  userHasApiConnectorEntitlement: (...a: unknown[]) => mocks.userHasApiConnectorEntitlement(...a),
}));
vi.mock("@/lib/connector-registry", () => ({
  connectorRegistry: {
    list: () => [
      {
        manifest: {
          key: "usps",
          displayName: "USPS",
          capabilities: { addressUpdatePush: true },
          fallbackActionKey: "usps:MAIL_FORWARDING:DEEP_LINK",
        },
      },
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
    mocks.userHasApiConnectorEntitlement.mockResolvedValue(false);
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
    expect(body.entitlement).toEqual({ apiSync: false });
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.userHasApiConnectorEntitlement).not.toHaveBeenCalled();
  });

  it("lists connectors with their derived mode, omitting DISABLED (un-configured/kill-switched)", async () => {
    mocks.userHasApiConnectorEntitlement.mockResolvedValue(true);
    const { GET } = await import("./route");
    const res = await GET();
    const body = await res.json();
    // ups has no config → enabled false → DISABLED → filtered out. usps kept.
    expect(body.connectors).toEqual([
      {
        connectorKey: "usps",
        displayName: "USPS",
        mode: "GUIDED_UPDATE",
        guidedAction: {
          key: "usps:MAIL_FORWARDING:DEEP_LINK",
          label: "Open update",
          url: "https://moversguide.usps.com/",
          helperText: "Continue on USPS to submit and verify your mail-forwarding request.",
        },
      },
    ]);
    expect(body.entitlement).toEqual({ apiSync: true });
  });

  it("keeps the guided catalog visible when entitlement lookup fails", async () => {
    mocks.userHasApiConnectorEntitlement.mockRejectedValue(new Error("subscription read failed"));
    const { GET } = await import("./route");
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.connectors[0]).toMatchObject({
      connectorKey: "usps",
      displayName: "USPS",
      mode: "GUIDED_UPDATE",
      guidedAction: { url: "https://moversguide.usps.com/" },
    });
    expect(body.entitlement).toEqual({ apiSync: false });
  });

  it("merges operator-defined no-code GUIDED partners from runtime-config", async () => {
    mocks.getRuntimeConfigValue.mockImplementation((k: string) => {
      if (k === "FEATURE_API_CONNECTORS") return Promise.resolve("true");
      if (k === "GUIDED_PARTNERS")
        return Promise.resolve(
          JSON.stringify([
            { key: "acme-utility", name: "Acme Utility" },
            { key: "comingco", name: "Coming Co", comingSoon: true },
          ]),
        );
      return Promise.resolve(null);
    });
    const { GET } = await import("./route");
    const res = await GET();
    const body = await res.json();
    expect(body.connectors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          connectorKey: "usps",
          displayName: "USPS",
          mode: "GUIDED_UPDATE",
          guidedAction: expect.objectContaining({ url: "https://moversguide.usps.com/" }),
        }),
        { connectorKey: "acme-utility", displayName: "Acme Utility", mode: "GUIDED_UPDATE", guidedAction: null },
        { connectorKey: "comingco", displayName: "Coming Co", mode: "COMING_SOON", guidedAction: null },
      ]),
    );
  });

  it("ignores malformed GUIDED_PARTNERS json without crashing", async () => {
    mocks.getRuntimeConfigValue.mockImplementation((k: string) =>
      k === "FEATURE_API_CONNECTORS" ? Promise.resolve("true") : k === "GUIDED_PARTNERS" ? Promise.resolve("{not json") : Promise.resolve(null),
    );
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.connectors[0]).toMatchObject({ connectorKey: "usps", displayName: "USPS", mode: "GUIDED_UPDATE" });
  });
});
