import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  expireAdminSessionCookies: vi.fn((response) => response),
  shouldUseSecureAdminCookies: vi.fn(() => false),
  adminFindUnique: vi.fn(),
  adminUpdate: vi.fn(),
  adminSessionUpdateMany: vi.fn(),
  adminMfaTrustedDeviceUpdateMany: vi.fn(),
  writeAdminAudit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: mocks.requireAdmin,
  requirePasswordConfirm: mocks.requirePasswordConfirm,
  expireAdminSessionCookies: mocks.expireAdminSessionCookies,
  shouldUseSecureAdminCookies: mocks.shouldUseSecureAdminCookies,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    adminUser: {
      findUnique: mocks.adminFindUnique,
      update: mocks.adminUpdate,
    },
    adminSession: {
      updateMany: mocks.adminSessionUpdateMany,
    },
    adminMfaTrustedDevice: {
      updateMany: mocks.adminMfaTrustedDeviceUpdateMany,
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  getAuditRequestMeta: () => ({ ipAddress: "203.0.113.10", userAgent: "vitest" }),
  writeAdminAudit: mocks.writeAdminAudit,
}));

import { POST } from "./route";

function request(body: Record<string, unknown>) {
  return new NextRequest("https://admin.locateflow.com/api/auth/mfa/disable", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.10",
      "user-agent": "vitest",
      host: "admin.locateflow.com",
    },
    body: JSON.stringify(body),
  });
}

describe("admin MFA disable route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      adminId: "admin_1",
      email: "admin@example.com",
      role: "SUPER_ADMIN",
      sessionId: "session_1",
    });
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.adminFindUnique.mockResolvedValue({ mfaEnabled: true });
    mocks.adminUpdate.mockResolvedValue({});
    mocks.adminSessionUpdateMany.mockResolvedValue({ count: 2 });
    mocks.adminMfaTrustedDeviceUpdateMany.mockResolvedValue({ count: 1 });
    mocks.writeAdminAudit.mockResolvedValue(undefined);
  });

  it("requires password plus MFA or backup code when MFA is enabled", async () => {
    mocks.requirePasswordConfirm.mockResolvedValue({
      confirmed: false,
      error: "MFA verification required for this operation.",
      requiresMfa: true,
    });

    const response = await POST(request({ confirmPassword: "correct-password" }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.requiresMfa).toBe(true);
    expect(mocks.requirePasswordConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "admin_1" }),
      "correct-password",
      expect.objectContaining({
        operation: "admin_mfa_disable",
        requireMfa: true,
        ipAddress: "203.0.113.10",
        userAgent: "vitest",
      }),
    );
    expect(mocks.adminUpdate).not.toHaveBeenCalled();
  });

  it("revokes active sessions, expires the cookie, and writes MFA_DISABLED audit after success", async () => {
    const response = await POST(request({
      confirmPassword: "correct-password",
      mfaCode: "123456",
      backupCode: "BACKUP12",
    }));

    expect(response.status).toBe(200);
    expect(mocks.requirePasswordConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "admin_1" }),
      "correct-password",
      expect.objectContaining({
        operation: "admin_mfa_disable",
        requireMfa: true,
        mfaCode: "123456",
        backupCode: "BACKUP12",
      }),
    );
    expect(mocks.adminUpdate).toHaveBeenCalledWith({
      where: { id: "admin_1" },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: null,
        mfaVerifiedAt: null,
      },
    });
    expect(mocks.adminSessionUpdateMany).toHaveBeenCalledWith({
      where: { adminUserId: "admin_1", isActive: true },
      data: { isActive: false, lastActivity: expect.any(Date) },
    });
    expect(mocks.adminMfaTrustedDeviceUpdateMany).toHaveBeenCalledWith({
      where: { adminUserId: "admin_1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(mocks.writeAdminAudit).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "admin_1" }),
      expect.objectContaining({
        action: "MFA_DISABLED",
        metadata: expect.objectContaining({ sessionsRevoked: true }),
      }),
    );
    expect(mocks.expireAdminSessionCookies).toHaveBeenCalledWith(response, "admin.locateflow.com");
  });
});
