import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  prisma: {
    partnerConsent: { findMany: vi.fn(), updateMany: vi.fn() },
    connectorDispatch: { updateMany: vi.fn() },
    adminAuditLog: { create: vi.fn() },
  },
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({
  requirePermission: mocks.requirePermission,
  requirePasswordConfirm: mocks.requirePasswordConfirm,
}));

function post(body: Record<string, unknown>) {
  return new NextRequest("https://admin.locateflow.com/api/connectors/consents", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("admin connector consents bulk revoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1" });
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.prisma.partnerConsent.updateMany.mockResolvedValue({ count: 2 });
    mocks.prisma.connectorDispatch.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.adminAuditLog.create.mockResolvedValue({});
  });

  it("requires MFA before bulk-revoking partner consents", async () => {
    const { POST } = await import("./route");

    const res = await POST(
      post({
        connectorKey: "usps",
        reason: "SECURITY_INCIDENT",
        confirmPassword: "pw",
        mfaCode: "123456",
      }),
    );

    expect(res.status).toBe(200);
    expect(mocks.requirePasswordConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "admin_1" }),
      "pw",
      expect.objectContaining({
        operation: "connector_consent_bulk_revoke",
        requireMfa: true,
        mfaCode: "123456",
      }),
    );
    expect(mocks.prisma.partnerConsent.updateMany).toHaveBeenCalledWith({
      where: { connectorKey: "usps", status: "GRANTED" },
      data: expect.objectContaining({
        status: "REVOKED",
        tokenEncrypted: null,
        refreshTokenEncrypted: null,
      }),
    });
    expect(mocks.prisma.connectorDispatch.updateMany).toHaveBeenCalledWith({
      where: { connectorKey: "usps", status: { in: ["QUEUED", "DISPATCHING"] } },
      data: { status: "NEEDS_USER", lastErrorCode: "REVOKED" },
    });
  });

  it("does not revoke consents when MFA step-up fails", async () => {
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: false, error: "MFA required", requiresMfa: true });
    const { POST } = await import("./route");

    const res = await POST(
      post({
        connectorKey: "usps",
        confirmPassword: "pw",
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body).toMatchObject({ requiresPassword: true, requiresMfa: true });
    expect(mocks.prisma.partnerConsent.updateMany).not.toHaveBeenCalled();
    expect(mocks.prisma.connectorDispatch.updateMany).not.toHaveBeenCalled();
  });
});
