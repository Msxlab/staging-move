import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  writeAdminAudit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSession: mocks.getSession,
  shouldUseSecureAdminCookies: vi.fn(() => false),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    adminMfaTrustedDevice: {
      findMany: mocks.findMany,
      findFirst: mocks.findFirst,
      updateMany: mocks.updateMany,
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  getAuditRequestMeta: () => ({ ipAddress: "203.0.113.10", userAgent: "vitest" }),
  writeAdminAudit: mocks.writeAdminAudit,
}));

import { hashAdminMfaTrustToken } from "@/lib/admin-mfa-trusted-device";
import { GET, POST } from "./route";

const SESSION = {
  adminId: "admin_1",
  email: "admin@example.com",
  role: "SUPER_ADMIN",
  sessionId: "session_1",
};

function request(body?: Record<string, unknown>, cookie?: string) {
  return new NextRequest("https://admin.locateflow.com/api/auth/mfa/trusted-devices", {
    method: body ? "POST" : "GET",
    headers: {
      "content-type": "application/json",
      host: "admin.locateflow.com",
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("admin MFA trusted devices route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue(SESSION);
    mocks.findMany.mockResolvedValue([]);
    mocks.findFirst.mockResolvedValue(null);
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.writeAdminAudit.mockResolvedValue(undefined);
  });

  it("lists current trusted devices without leaking token hashes", async () => {
    const token = "trusted-token-value-that-is-long-enough";
    mocks.findMany.mockResolvedValue([
      {
        id: "device_1",
        tokenHash: hashAdminMfaTrustToken(token),
        deviceLabel: "Chrome on Windows",
        ipAddress: "203.0.113.10",
        userAgent: "Vitest Browser",
        lastUsedAt: new Date("2026-06-14T12:00:00Z"),
        expiresAt: new Date("2026-07-14T12:00:00Z"),
        createdAt: new Date("2026-06-14T11:00:00Z"),
      },
    ]);

    const response = await GET(request(undefined, `admin_mfa_trust=${token}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body.devices[0]).toMatchObject({
      id: "device_1",
      deviceLabel: "Chrome on Windows",
      isCurrent: true,
    });
    expect(body.devices[0]).not.toHaveProperty("tokenHash");
    expect(JSON.stringify(body)).not.toContain(hashAdminMfaTrustToken(token));
  });

  it("revokes the current trusted device and expires the trust cookie", async () => {
    const token = "trusted-token-value-that-is-long-enough";
    mocks.findFirst.mockResolvedValue({
      id: "device_1",
      tokenHash: hashAdminMfaTrustToken(token),
    });

    const response = await POST(request(
      { action: "revoke", deviceId: "device_1" },
      `admin_mfa_trust=${token}`,
    ));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toMatchObject({ success: true, revoked: 1, currentDeviceRevoked: true });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "device_1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(response.headers.get("set-cookie")).toContain("admin_mfa_trust=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(mocks.writeAdminAudit).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "admin_1" }),
      expect.objectContaining({ action: "MFA_TRUSTED_DEVICE_REVOKED" }),
    );
  });
});
