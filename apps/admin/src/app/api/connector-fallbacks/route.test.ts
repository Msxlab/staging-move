import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  findMany: vi.fn(),
  upsert: vi.fn(),
  deleteMany: vi.fn(),
  auditCreate: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/db", () => ({
  prisma: {
    connectorFallbackAction: { findMany: mocks.findMany, upsert: mocks.upsert, deleteMany: mocks.deleteMany },
    adminAuditLog: { create: mocks.auditCreate },
  },
}));

function jsonReq(url: string, body?: unknown) {
  return {
    url,
    headers: new Headers({ "x-forwarded-for": "203.0.113.9" }),
    json: async () => body,
  } as unknown as Parameters<typeof import("./route").POST>[0];
}

describe("admin /api/connector-fallbacks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "a1", email: "admin@example.test", role: "ADMIN" });
    mocks.auditCreate.mockResolvedValue({});
  });

  it("GET lists actions for an authorized admin", async () => {
    mocks.findMany.mockResolvedValue([{ actionKey: "usps:MAIL_FORWARDING:DEEP_LINK", connectorKey: "usps" }]);
    const { GET } = await import("./route");
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.actions).toHaveLength(1);
    expect(mocks.requirePermission).toHaveBeenCalledWith("connectors", "canRead", expect.any(Object));
  });

  it("GET returns 401 when the permission check rejects", async () => {
    mocks.requirePermission.mockRejectedValue(new Error("UNAUTHORIZED"));
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(401);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("GET returns 403 for a forbidden role", async () => {
    mocks.requirePermission.mockRejectedValue(new Error("FORBIDDEN"));
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("POST upserts a valid action by actionKey", async () => {
    mocks.upsert.mockResolvedValue({ id: "fallback_1", actionKey: "acme:MAILTO" });
    const { POST } = await import("./route");
    const res = await POST(
      jsonReq("http://x", {
        actionKey: "acme:MAILTO",
        connectorKey: "acme",
        type: "MAILTO",
        label: "Email Acme",
        helperText: "We prefilled an email.",
        urlTemplate: "mailto:support@acme.com",
      }),
    );
    expect(res.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { actionKey: "acme:MAILTO" },
        create: expect.objectContaining({ actionKey: "acme:MAILTO", connectorKey: "acme", type: "MAILTO" }),
      }),
    );
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminUserId: "a1",
        action: "UPSERT_CONNECTOR_FALLBACK_ACTION",
        entityType: "ConnectorFallbackAction",
        entityId: "fallback_1",
        ipAddress: "203.0.113.9",
      }),
    });
  });

  it("POST rejects a missing/invalid actionKey before touching the DB", async () => {
    const { POST } = await import("./route");
    const res = await POST(jsonReq("http://x", { connectorKey: "acme", label: "x", helperText: "y" }));
    expect(res.status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("POST rejects an invalid connectorKey before touching the DB", async () => {
    const { POST } = await import("./route");
    const res = await POST(jsonReq("http://x", { actionKey: "acme:MAILTO", connectorKey: "bad key", label: "x", helperText: "y" }));
    expect(res.status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("POST rejects an uppercase connectorKey before touching the DB", async () => {
    const { POST } = await import("./route");
    const res = await POST(jsonReq("http://x", { actionKey: "acme:MAILTO", connectorKey: "Acme", label: "x", helperText: "y" }));
    expect(res.status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("POST rejects a urlTemplate that cannot be rendered as the selected action type", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      jsonReq("http://x", {
        actionKey: "acme:MAILTO",
        connectorKey: "acme",
        type: "MAILTO",
        label: "Email Acme",
        helperText: "Email support.",
        urlTemplate: "https://acme.example.test/support",
      }),
    );
    expect(res.status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminUserId: "a1",
        action: "REJECT_CONNECTOR_FALLBACK_ACTION",
        entityType: "ConnectorFallbackAction",
        entityId: "acme:MAILTO",
        ipAddress: "203.0.113.9",
      }),
    });
  });

  it("POST rejects unsafe urlTemplate protocols before touching the DB", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      jsonReq("http://x", {
        actionKey: "acme:WEB",
        connectorKey: "acme",
        type: "DEEP_LINK",
        label: "Open Acme",
        helperText: "Open Acme.",
        urlTemplate: "javascript:alert(1)",
      }),
    );
    expect(res.status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminUserId: "a1",
        action: "REJECT_CONNECTOR_FALLBACK_ACTION",
        entityType: "ConnectorFallbackAction",
        entityId: "acme:WEB",
        ipAddress: "203.0.113.9",
      }),
    });
  });

  it("POST defaults an unknown type to DEEP_LINK", async () => {
    mocks.upsert.mockResolvedValue({ id: "fallback_2" });
    const { POST } = await import("./route");
    await POST(
      jsonReq("http://x", { actionKey: "k:DL", connectorKey: "k", type: "NONSENSE", label: "l", helperText: "h" }),
    );
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ type: "DEEP_LINK" }) }),
    );
  });

  it("DELETE removes by actionKey", async () => {
    mocks.deleteMany.mockResolvedValue({ count: 1 });
    const { DELETE } = await import("./route");
    const res = await DELETE(jsonReq("http://x/api/connector-fallbacks?actionKey=acme:MAILTO"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.deleted).toBe(true);
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { actionKey: "acme:MAILTO" } });
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminUserId: "a1",
        action: "DELETE_CONNECTOR_FALLBACK_ACTION",
        entityType: "ConnectorFallbackAction",
        entityId: "acme:MAILTO",
        ipAddress: "203.0.113.9",
      }),
    });
  });

  it("DELETE requires an actionKey", async () => {
    const { DELETE } = await import("./route");
    const res = await DELETE(jsonReq("http://x/api/connector-fallbacks"));
    expect(res.status).toBe(400);
    expect(mocks.deleteMany).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("DELETE rejects an invalid actionKey before touching the DB", async () => {
    const { DELETE } = await import("./route");
    const res = await DELETE(jsonReq("http://x/api/connector-fallbacks?actionKey=%20bad%20key%20"));
    expect(res.status).toBe(400);
    expect(mocks.deleteMany).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });
});
