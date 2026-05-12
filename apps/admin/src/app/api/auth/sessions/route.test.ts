import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requireRole: vi.fn(),
  requirePermission: vi.fn(),
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
  requirePermission: mocks.requirePermission,
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

import { GET, POST } from "./route";

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
    mocks.requirePermission.mockResolvedValue(SESSION);
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.sessionUpdate.mockResolvedValue({});
    mocks.sessionUpdateMany.mockResolvedValue({ count: 3 });
    mocks.sessionFindMany.mockResolvedValue([]);
    mocks.writeAdminAudit.mockResolvedValue(undefined);
  });

  it("requires SUPER_ADMIN audit-log access for all-session reads", async () => {
    mocks.sessionFindMany.mockResolvedValue([
      {
        id: "session_other",
        adminUserId: "admin_2",
        adminUser: { id: "admin_2", email: "operator@example.com", firstName: "Op", lastName: "Erator", role: "ADMIN" },
        ipAddress: "198.51.100.20",
        browser: "Chrome",
        os: "Windows",
        deviceType: "Desktop",
        isActive: true,
        lastActivity: new Date(),
        expiresAt: new Date(),
        createdAt: new Date(),
      },
    ]);

    const response = await GET(new NextRequest("https://admin.locateflow.com/api/auth/sessions?all=true", {
      headers: { "x-forwarded-for": "203.0.113.10", "user-agent": "vitest" },
    }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.sessions[0]).not.toHaveProperty("id");
    expect(body.sessions[0].displayId).toMatch(/^sess_/);
    expect(body.sessions[0].revokeHandle).toEqual(expect.any(String));
    expect(JSON.stringify(body.sessions[0])).not.toContain("session_other");
    expect(mocks.requirePermission).toHaveBeenCalledWith("audit_logs", "canRead", { minimumRole: "SUPER_ADMIN" });
    expect(mocks.writeAdminAudit).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "admin_1" }),
      expect.objectContaining({ action: "SECURITY_SESSIONS_VIEWED" }),
    );
  });

  it("masks session IP and admin email for self-only non-super reads", async () => {
    mocks.requireAdmin.mockResolvedValue({ ...SESSION, role: "ADMIN" });
    mocks.requireRole.mockRejectedValue(new Error("FORBIDDEN"));
    mocks.sessionFindMany.mockResolvedValue([
      {
        id: "session_current",
        adminUserId: "admin_1",
        adminUser: { id: "admin_1", email: "admin@example.com", firstName: "Ad", lastName: "Min", role: "ADMIN" },
        ipAddress: "198.51.100.20",
        browser: "Chrome",
        os: "Windows",
        deviceType: "Desktop",
        isActive: true,
        lastActivity: new Date(),
        expiresAt: new Date(),
        createdAt: new Date(),
      },
    ]);

    const response = await GET(new NextRequest("https://admin.locateflow.com/api/auth/sessions", {
      headers: { "x-forwarded-for": "203.0.113.10", "user-agent": "vitest" },
    }));
    const body = await response.json();

    expect(body.sessions[0].adminUser.email).toBe("ad***@example.com");
    expect(body.sessions[0].ipAddress).toBe("198.51.100.0");
    expect(body.sessions[0]).not.toHaveProperty("id");
    expect(body.sessions[0].displayId).toMatch(/^sess_/);
    expect(body.sessions[0].revokeHandle).toEqual(expect.any(String));
    expect(JSON.stringify(body.sessions[0])).not.toContain("session_current");
  });

  it("requires SUPER_ADMIN plus step-up before revoking another admin session", async () => {
    const targetSession = { id: "session_other", adminUserId: "admin_2", isActive: true };
    mocks.sessionFindMany.mockResolvedValueOnce([
      {
        ...targetSession,
        adminUser: { id: "admin_2", email: "operator@example.com", firstName: "Op", lastName: "Erator", role: "ADMIN" },
        ipAddress: "198.51.100.20",
        browser: "Chrome",
        os: "Windows",
        deviceType: "Desktop",
        lastActivity: new Date(),
        expiresAt: new Date(),
        createdAt: new Date(),
      },
    ]);

    const listResponse = await GET(new NextRequest("https://admin.locateflow.com/api/auth/sessions?all=true", {
      headers: { "x-forwarded-for": "203.0.113.10", "user-agent": "vitest" },
    }));
    const listBody = await listResponse.json();
    const revokeHandle = listBody.sessions[0].revokeHandle;
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue(SESSION);
    mocks.requireRole.mockResolvedValue(SESSION);
    mocks.requirePermission.mockResolvedValue(SESSION);
    mocks.sessionFindMany.mockResolvedValueOnce([targetSession]);
    mocks.sessionUpdate.mockResolvedValue({});
    mocks.writeAdminAudit.mockResolvedValue(undefined);
    mocks.requirePasswordConfirm.mockResolvedValue({
      confirmed: false,
      error: "MFA verification required for this operation.",
      requiresMfa: true,
    });

    const response = await POST(request({
      action: "revoke",
      sessionHandle: revokeHandle,
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

  it("revokes a self session with the display-safe revoke handle", async () => {
    const targetSession = {
      id: "session_current",
      adminUserId: "admin_1",
      adminUser: { id: "admin_1", email: "admin@example.com", firstName: "Ad", lastName: "Min", role: "SUPER_ADMIN" },
      ipAddress: "198.51.100.20",
      browser: "Chrome",
      os: "Windows",
      deviceType: "Desktop",
      isActive: true,
      lastActivity: new Date(),
      expiresAt: new Date(),
      createdAt: new Date(),
    };
    mocks.sessionFindMany.mockResolvedValueOnce([targetSession]);

    const listResponse = await GET(new NextRequest("https://admin.locateflow.com/api/auth/sessions", {
      headers: { "x-forwarded-for": "203.0.113.10", "user-agent": "vitest" },
    }));
    const listBody = await listResponse.json();
    const revokeHandle = listBody.sessions[0].revokeHandle;

    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue(SESSION);
    mocks.requireRole.mockResolvedValue(SESSION);
    mocks.requirePermission.mockResolvedValue(SESSION);
    mocks.sessionFindMany.mockResolvedValueOnce([{ id: "session_current", adminUserId: "admin_1", isActive: true }]);
    mocks.sessionUpdate.mockResolvedValue({});
    mocks.writeAdminAudit.mockResolvedValue(undefined);

    const response = await POST(request({ action: "revoke", sessionHandle: revokeHandle }));

    expect(response.status).toBe(200);
    expect(mocks.sessionUpdate).toHaveBeenCalledWith({
      where: { id: "session_current" },
      data: { isActive: false },
    });
    expect(mocks.expireAdminSessionCookies).toHaveBeenCalled();
    expect(mocks.writeAdminAudit).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "admin_1" }),
      expect.objectContaining({
        action: "SECURITY_SESSION_REVOKED",
        entityId: expect.stringMatching(/^sess_/),
      }),
    );
    expect(JSON.stringify(mocks.writeAdminAudit.mock.calls.map((call) => call[1]))).not.toContain("session_current");
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
        action: "SECURITY_SESSION_REVOKED",
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
