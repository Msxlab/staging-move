import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  adminAuditFindMany: vi.fn(),
  auditFindMany: vi.fn(),
  writeAdminAudit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: (...args: unknown[]) => mocks.requirePermission(...args),
  requirePasswordConfirm: (...args: unknown[]) => mocks.requirePasswordConfirm(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    adminAuditLog: { findMany: (...args: unknown[]) => mocks.adminAuditFindMany(...args) },
    auditLog: { findMany: (...args: unknown[]) => mocks.auditFindMany(...args) },
  },
}));

vi.mock("@/lib/audit", () => ({
  getAuditRequestMeta: () => ({ ipAddress: "203.0.113.10", userAgent: "vitest" }),
  writeAdminAudit: (...args: unknown[]) => mocks.writeAdminAudit(...args),
}));

import { POST } from "./route";

const SESSION = {
  adminId: "admin-1",
  email: "admin@example.com",
  role: "ADMIN",
  sessionId: "session-1",
};

function request(body: Record<string, unknown>) {
  return new NextRequest("https://admin.locateflow.com/api/logs/export", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10", "user-agent": "vitest" },
    body: JSON.stringify(body),
  });
}

describe("audit log CSV export API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(SESSION);
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.adminAuditFindMany.mockResolvedValue([
      {
        id: "log-1",
        adminUser: { email: "operator@example.com" },
        action: "=WEBSERVICE(\"https://evil.example\")",
        entityType: "User",
        entityId: "sub_live_123456789",
        ipAddress: "198.51.100.23",
        createdAt: new Date("2026-05-10T00:00:00Z"),
      },
    ]);
    mocks.auditFindMany.mockResolvedValue([]);
    mocks.writeAdminAudit.mockResolvedValue(undefined);
  });

  it("requires audit_logs.canRead without settings fallback and requires MFA step-up", async () => {
    mocks.requirePasswordConfirm.mockResolvedValue({
      confirmed: false,
      error: "MFA verification required for this operation.",
      requiresMfa: true,
    });

    const response = await POST(request({ tab: "admin", confirmPassword: "pw" }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ requiresPassword: true, requiresMfa: true });
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      "audit_logs",
      "canRead",
      { minimumRole: "ADMIN" },
    );
    expect(mocks.requirePasswordConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "admin-1" }),
      "pw",
      expect.objectContaining({
        operation: "audit_log_export",
        requireMfa: true,
        ipAddress: "203.0.113.10",
        userAgent: "vitest",
      }),
    );
    expect(mocks.writeAdminAudit).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "admin-1" }),
      expect.objectContaining({ action: "AUDIT_LOG_EXPORT_FAILED" }),
    );
  });

  it("writes AUDIT_LOGS_EXPORTED and preserves CSV injection escaping", async () => {
    const response = await POST(request({ tab: "admin", confirmPassword: "pw", mfaCode: "123456" }));
    const csv = await response.text();

    expect(response.status).toBe(200);
    expect(csv).toContain("'=WEBSERVICE");
    expect(csv).toContain("op***@example.com");
    expect(csv).toContain("sub_****6789");
    expect(csv).not.toContain("198.51.100.23");
    expect(mocks.writeAdminAudit).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "admin-1" }),
      expect.objectContaining({
        action: "AUDIT_LOGS_EXPORTED",
        metadata: expect.objectContaining({ rowCount: 1, format: "csv", status: "success" }),
      }),
    );
  });

  it("writes AUDIT_LOG_EXPORT_FAILED for validation failures without raw search text", async () => {
    const response = await POST(request({
      tab: "admin",
      confirmPassword: "pw",
      mfaCode: "123456",
      dateFrom: "bad-date",
      search: "person@example.com",
    }));

    expect(response.status).toBe(400);
    const failureCall = mocks.writeAdminAudit.mock.calls.find((call) => call[1]?.action === "AUDIT_LOG_EXPORT_FAILED");
    expect(failureCall?.[1].metadata).toMatchObject({
      reasonCode: "invalid_date_filter",
      hasSearch: true,
      searchLength: "person@example.com".length,
    });
    expect(JSON.stringify(failureCall?.[1].metadata)).not.toContain("person@example.com");
  });
});
