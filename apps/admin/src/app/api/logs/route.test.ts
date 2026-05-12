import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  adminAuditFindMany: vi.fn(),
  adminAuditCount: vi.fn(),
  adminAuditGroupBy: vi.fn(),
  adminFindMany: vi.fn(),
  auditFindMany: vi.fn(),
  auditCount: vi.fn(),
  auditGroupBy: vi.fn(),
  userFindMany: vi.fn(),
  writeAdminAudit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: (...args: unknown[]) => mocks.requirePermission(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    adminAuditLog: {
      findMany: (...args: unknown[]) => mocks.adminAuditFindMany(...args),
      count: (...args: unknown[]) => mocks.adminAuditCount(...args),
      groupBy: (...args: unknown[]) => mocks.adminAuditGroupBy(...args),
    },
    adminUser: { findMany: (...args: unknown[]) => mocks.adminFindMany(...args) },
    auditLog: {
      findMany: (...args: unknown[]) => mocks.auditFindMany(...args),
      count: (...args: unknown[]) => mocks.auditCount(...args),
      groupBy: (...args: unknown[]) => mocks.auditGroupBy(...args),
    },
    user: { findMany: (...args: unknown[]) => mocks.userFindMany(...args) },
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

function request(url = "https://admin.locateflow.com/api/logs?tab=admin&page=1&perPage=30") {
  return new NextRequest(url, {
    headers: { "x-forwarded-for": "203.0.113.10", "user-agent": "vitest" },
  });
}

describe("audit log read API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(SESSION);
    mocks.adminAuditFindMany.mockResolvedValue([
      {
        id: "log-1",
        adminUserId: "admin-2",
        action: "UPDATE_USER",
        entityType: "User",
        entityId: "sub_live_123456789",
        changes: JSON.stringify({
          email: "person@example.com",
          password: "secret-password",
          note: "raw support note",
          safeField: "status",
        }),
        ipAddress: "198.51.100.23",
        createdAt: new Date("2026-05-10T00:00:00Z"),
        adminUser: { email: "operator@example.com", firstName: "Op", lastName: "Erator" },
      },
    ]);
    mocks.adminAuditCount.mockResolvedValue(1);
    mocks.adminAuditGroupBy.mockResolvedValue([]);
    mocks.adminFindMany.mockResolvedValue([
      { id: "admin-2", email: "operator@example.com", firstName: "Op", lastName: "Erator" },
    ]);
    mocks.auditFindMany.mockResolvedValue([]);
    mocks.auditCount.mockResolvedValue(0);
    mocks.auditGroupBy.mockResolvedValue([]);
    mocks.userFindMany.mockResolvedValue([]);
    mocks.writeAdminAudit.mockResolvedValue(undefined);
  });

  it("requires audit_logs.canRead without settings fallback", async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      "audit_logs",
      "canRead",
      { minimumRole: "ADMIN" },
    );
  });

  it("redacts sensitive changes, payment-like entity IDs, emails, and IPs for ADMIN", async () => {
    const response = await GET(request());
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(body.logs[0].adminUser.email).toBe("op***@example.com");
    expect(body.logs[0].ipAddress).toBe("198.51.100.0");
    expect(body.logs[0].entityId).toBe("sub_****6789");
    expect(serialized).not.toContain("secret-password");
    expect(serialized).not.toContain("person@example.com");
    expect(serialized).not.toContain("raw support note");
    expect(JSON.parse(body.logs[0].changes)).toMatchObject({ redacted: true });
  });

  it("writes AUDIT_LOGS_VIEWED with safe read metadata", async () => {
    await GET(request("https://admin.locateflow.com/api/logs?tab=admin&search=person@example.com&page=2&perPage=5"));

    expect(mocks.writeAdminAudit).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "admin-1" }),
      expect.objectContaining({
        action: "AUDIT_LOGS_VIEWED",
        entityType: "AdminAuditLog",
        metadata: expect.objectContaining({
          tab: "admin",
          page: 2,
          perPage: 5,
          rowCount: 1,
          hasSearch: true,
          searchLength: "person@example.com".length,
        }),
      }),
    );
    const metadata = mocks.writeAdminAudit.mock.calls[0][1].metadata;
    expect(JSON.stringify(metadata)).not.toContain("person@example.com");
  });
});
