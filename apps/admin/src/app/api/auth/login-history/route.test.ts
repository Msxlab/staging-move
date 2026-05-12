import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requireRole: vi.fn(),
  requirePermission: vi.fn(),
  loginFindMany: vi.fn(),
  loginCount: vi.fn(),
  writeAdminAudit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: (...args: unknown[]) => mocks.requireAdmin(...args),
  requireRole: (...args: unknown[]) => mocks.requireRole(...args),
  requirePermission: (...args: unknown[]) => mocks.requirePermission(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    adminLoginLog: {
      findMany: (...args: unknown[]) => mocks.loginFindMany(...args),
      count: (...args: unknown[]) => mocks.loginCount(...args),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  getAuditRequestMeta: () => ({ ipAddress: "203.0.113.10", userAgent: "vitest" }),
  writeAdminAudit: (...args: unknown[]) => mocks.writeAdminAudit(...args),
}));

import { GET } from "./route";

const SESSION = {
  adminId: "admin-1",
  email: "admin@example.com",
  role: "ADMIN",
  sessionId: "session-1",
};

function request(url = "https://admin.locateflow.com/api/auth/login-history?page=1&perPage=30") {
  return new NextRequest(url, {
    headers: { "x-forwarded-for": "203.0.113.10", "user-agent": "vitest" },
  });
}

describe("admin login-history API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue(SESSION);
    mocks.requireRole.mockRejectedValue(new Error("FORBIDDEN"));
    mocks.requirePermission.mockResolvedValue({ ...SESSION, role: "SUPER_ADMIN" });
    mocks.loginFindMany.mockResolvedValue([
      {
        id: "login-1",
        adminUser: { id: "admin-1", email: "admin@example.com", firstName: "Ad", lastName: "Min", role: "ADMIN" },
        email: "admin@example.com",
        success: true,
        failReason: null,
        ipAddress: "198.51.100.20",
        browser: "Chrome",
        os: "Windows",
        country: "US",
        city: "New York",
        mfaUsed: true,
        mfaMethod: "totp",
        createdAt: new Date("2026-05-10T00:00:00Z"),
      },
    ]);
    mocks.loginCount.mockResolvedValue(1);
    mocks.writeAdminAudit.mockResolvedValue(undefined);
  });

  it("masks self-only login metadata and writes a read audit", async () => {
    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.logs[0].email).toBe("ad***@example.com");
    expect(body.logs[0].adminUser.email).toBe("ad***@example.com");
    expect(body.logs[0].ipAddress).toBe("198.51.100.0");
    expect(mocks.writeAdminAudit).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "admin-1" }),
      expect.objectContaining({
        action: "SECURITY_LOGIN_HISTORY_VIEWED",
        metadata: expect.objectContaining({ scope: "self", rowCount: 1 }),
      }),
    );
  });

  it("requires SUPER_ADMIN audit-log access for all-admin login history", async () => {
    const response = await GET(request("https://admin.locateflow.com/api/auth/login-history?all=true&page=1&perPage=30"));

    expect(response.status).toBe(200);
    expect(mocks.requirePermission).toHaveBeenCalledWith("audit_logs", "canRead", { minimumRole: "SUPER_ADMIN" });
  });
});
