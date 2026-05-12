import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requireRole: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  expireAdminSessionCookies: vi.fn((response) => response),
  sessionFindUnique: vi.fn(),
  sessionUpdate: vi.fn(),
  sessionUpdateMany: vi.fn(),
  sessionFindMany: vi.fn(),
  writeAdminAudit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: mocks.requireAdmin,
  requireRole: mocks.requireRole,
  requirePasswordConfirm: mocks.requirePasswordConfirm,
  expireAdminSessionCookies: mocks.expireAdminSessionCookies,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    adminSession: {
      findUnique: mocks.sessionFindUnique,
      update: mocks.sessionUpdate,
      updateMany: mocks.sessionUpdateMany,
      findMany: mocks.sessionFindMany,
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  getAuditRequestMeta: () => ({ ipAddress: "203.0.113.10", userAgent: "vitest" }),
  writeAdminAudit: mocks.writeAdminAudit,
}));

import { POST } from "./route";

const SESSION = {
  adminId: "admin_1",
  email: "admin@example.com",
  role: "SUPER_ADMIN",
  sessionId: "session_current",
};

function request(body: Record<string, unknown>) {
  return new NextRequest("https://admin.locateflow.com/api/auth/sessions", {
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

describe("admin auth sessions route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue(SESSION);
    mocks.requireRole.mockResolvedValue(SESSION);
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.sessionUpdate.mockResolvedValue({});
    mocks.sessionUpdateMany.mockResolvedValue({ count: 3 });
    mocks.writeAdminAudit.mockResolvedValue(undefined);
  });

  it("requires SUPER_ADMIN plus step-up before revoking another admin session", async () => {
    mocks.sessionFindUnique.mockResolvedValue({ id: "session_other", adminUserId: "admin_2" });
    mocks.requirePasswordConfirm.mockResolvedValue({
      confirmed: false,
      error: "MFA verification required for this operation.",
      requiresMfa: true,
    });

    const response = await POST(request({
      action: "revoke",
      sessionId: "session_other",
      confirmPassword: "correct-password",
    }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.requiresMfa).toBe(true);
    expect(mocks.requireRole).toHaveBeenCalledWith("SUPER_ADMIN");
    expect(mocks.requirePasswordConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "admin_1" }),
      "correct-password",
      expect.objectContaining({
        operation: "admin_session_revoke_other",
        requireMfa: true,
        ipAddress: "203.0.113.10",
        userAgent: "vitest",
      }),
    );
    expect(mocks.sessionUpdate).not.toHaveBeenCalled();
  });

  it("requires SUPER_ADMIN plus step-up for revoke-all and expires the current cookie", async () => {
    const response = await POST(request({
      action: "revoke_all",
      revokeAll: "all",
      confirmPassword: "correct-password",
      mfaCode: "123456",
      backupCode: "BACKUP12",
    }));

    expect(response.status).toBe(200);
    expect(mocks.requireRole).toHaveBeenCalledWith("SUPER_ADMIN");
    expect(mocks.requirePasswordConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "admin_1" }),
      "correct-password",
      expect.objectContaining({
        operation: "admin_session_revoke_all",
        requireMfa: true,
        mfaCode: "123456",
        backupCode: "BACKUP12",
      }),
    );
    expect(mocks.sessionUpdateMany).toHaveBeenCalledWith({
      where: { isActive: true },
      data: { isActive: false },
    });
    expect(mocks.writeAdminAudit).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "admin_1" }),
      expect.objectContaining({
        action: "ALL_SESSIONS_REVOKED",
        metadata: expect.objectContaining({ operation: "admin_session_revoke_all", currentSessionRevoked: true }),
      }),
    );
    expect(mocks.expireAdminSessionCookies).toHaveBeenCalledWith(response, "admin.locateflow.com");
  });

  it("expires the current cookie when self revoke-all revokes the current session", async () => {
    const response = await POST(request({ action: "revoke_all", revokeAll: "self" }));

    expect(response.status).toBe(200);
    expect(mocks.requirePasswordConfirm).not.toHaveBeenCalled();
    expect(mocks.sessionUpdateMany).toHaveBeenCalledWith({
      where: { isActive: true, adminUserId: "admin_1" },
      data: { isActive: false },
    });
    expect(mocks.expireAdminSessionCookies).toHaveBeenCalledWith(response, "admin.locateflow.com");
  });
});
