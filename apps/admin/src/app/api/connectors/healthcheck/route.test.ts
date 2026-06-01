import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createConnectorHttpClient: vi.fn(() => ({ request: vi.fn() })),
  healthCheck: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: mocks.requirePermission,
  requirePasswordConfirm: vi.fn(),
}));
vi.mock("@locateflow/connectors", () => ({
  createConnectorHttpClient: mocks.createConnectorHttpClient,
  uspsConnector: {
    manifest: { allowedHosts: ["apis.usps.com"] },
    healthCheck: mocks.healthCheck,
  },
}));

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/connectors/healthcheck", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

describe("admin connector health-check canary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1" });
  });

  it("returns ok for a healthy connector", async () => {
    mocks.healthCheck.mockResolvedValue({ ok: true });
    const { POST } = await import("./route");
    const res = await POST(jsonRequest({ connectorKey: "usps" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ connectorKey: "usps", ok: true });
    expect(typeof body.checkedAt).toBe("string");
    // Egress client built from the manifest allowlist (drift canary actually ran).
    expect(mocks.createConnectorHttpClient).toHaveBeenCalledWith(
      expect.objectContaining({ allowedHosts: ["apis.usps.com"] }),
    );
    expect(mocks.healthCheck).toHaveBeenCalled();
  });

  it("surfaces a drift result verbatim", async () => {
    mocks.healthCheck.mockResolvedValue({ ok: false, reason: "SCHEMA_DRIFT", detail: "status 500" });
    const { POST } = await import("./route");
    const res = await POST(jsonRequest({ connectorKey: "usps" }));
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, reason: "SCHEMA_DRIFT", detail: "status 500" });
  });

  it("reports NOT_SUPPORTED for a key with no built-in adapter", async () => {
    const { POST } = await import("./route");
    const res = await POST(jsonRequest({ connectorKey: "ups" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ connectorKey: "ups", ok: false, reason: "NOT_SUPPORTED" });
    expect(mocks.healthCheck).not.toHaveBeenCalled();
  });

  it("rejects a malformed connectorKey", async () => {
    const { POST } = await import("./route");
    const res = await POST(jsonRequest({ connectorKey: "Not Valid!" }));
    expect(res.status).toBe(400);
    expect(mocks.createConnectorHttpClient).not.toHaveBeenCalled();
  });

  it("treats a thrown canary as PARTNER_DOWN, not a 500", async () => {
    mocks.healthCheck.mockRejectedValue(new Error("network boom"));
    const { POST } = await import("./route");
    const res = await POST(jsonRequest({ connectorKey: "usps" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: false, reason: "PARTNER_DOWN" });
  });

  it("denies callers without the connectors permission", async () => {
    mocks.requirePermission.mockRejectedValue(new Error("FORBIDDEN"));
    const { POST } = await import("./route");
    const res = await POST(jsonRequest({ connectorKey: "usps" }));
    expect(res.status).toBe(403);
    expect(mocks.healthCheck).not.toHaveBeenCalled();
  });
});
