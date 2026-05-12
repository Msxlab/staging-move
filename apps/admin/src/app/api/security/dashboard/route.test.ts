import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  adminAuditFindMany: vi.fn(),
  adminAuditCount: vi.fn(),
  ipRuleFindMany: vi.fn(),
  rateLimitCount: vi.fn(),
  adminFindMany: vi.fn(),
  gdprFindMany: vi.fn(),
  backupFindFirst: vi.fn(),
  getRecentSecurityEvents: vi.fn(),
  getSecurityReadinessSnapshot: vi.fn(),
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
    },
    iPRule: { findMany: (...args: unknown[]) => mocks.ipRuleFindMany(...args) },
    rateLimitLog: { count: (...args: unknown[]) => mocks.rateLimitCount(...args) },
    adminUser: { findMany: (...args: unknown[]) => mocks.adminFindMany(...args) },
    gDPRRequest: { findMany: (...args: unknown[]) => mocks.gdprFindMany(...args) },
    backupRecord: { findFirst: (...args: unknown[]) => mocks.backupFindFirst(...args) },
  },
}));

vi.mock("@/lib/security-monitor", () => ({
  getRecentSecurityEvents: (...args: unknown[]) => mocks.getRecentSecurityEvents(...args),
}));

vi.mock("@/lib/security-readiness", () => ({
  getSecurityReadinessSnapshot: (...args: unknown[]) => mocks.getSecurityReadinessSnapshot(...args),
}));

vi.mock("@/lib/audit", () => ({
  getAuditRequestMeta: () => ({ ipAddress: "203.0.113.10", userAgent: "vitest" }),
  writeAdminAudit: (...args: unknown[]) => mocks.writeAdminAudit(...args),
}));

import { GET } from "./route";

const ADMIN_SESSION = {
  adminId: "admin-1",
  email: "admin@example.com",
  role: "ADMIN",
  sessionId: "session-1",
};

function request() {
  return new NextRequest("https://admin.locateflow.com/api/security/dashboard", {
    headers: { "x-forwarded-for": "203.0.113.10", "user-agent": "vitest" },
  });
}

function seedDashboardMocks() {
  mocks.adminAuditFindMany
    .mockResolvedValueOnce([
      { adminUserId: "admin-2", ipAddress: "198.51.100.1", createdAt: new Date() },
      { adminUserId: "admin-2", ipAddress: "198.51.100.2", createdAt: new Date() },
      { adminUserId: "admin-2", ipAddress: "198.51.100.3", createdAt: new Date() },
      { adminUserId: "admin-2", ipAddress: "198.51.100.4", createdAt: new Date() },
    ])
    .mockResolvedValueOnce([
      { adminUserId: "admin-2", action: "IP_RULE_CREATED", entityType: "IPRule", entityId: "rule-1", ipAddress: "198.51.100.77", createdAt: new Date() },
    ]);
  mocks.adminAuditCount.mockResolvedValue(1);
  mocks.ipRuleFindMany.mockResolvedValue([{ type: "BLACKLIST" }]);
  mocks.rateLimitCount.mockResolvedValue(2);
  mocks.adminFindMany.mockResolvedValue([
    { id: "admin-2", email: "operator@example.com", role: "ADMIN", lastLoginAt: null },
  ]);
  mocks.gdprFindMany.mockResolvedValue([{ id: "gdpr-1", type: "EXPORT", createdAt: new Date() }]);
  mocks.backupFindFirst.mockResolvedValue(null);
  mocks.getRecentSecurityEvents.mockResolvedValue([
    {
      entityType: "ANOMALY",
      entityId: "HIGH",
      ipAddress: "198.51.100.88",
      changes: JSON.stringify({ details: { email: "person@example.com", password: "secret", safe: "count" } }),
      createdAt: new Date(),
    },
  ]);
  mocks.getSecurityReadinessSnapshot.mockResolvedValue({
    summary: { ready: 1, warn: 0, missing: 0, unknown: 0, missingRequired: 0 },
    missingRequiredKeys: [],
  });
}

describe("security dashboard API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(ADMIN_SESSION);
    mocks.writeAdminAudit.mockResolvedValue(undefined);
    seedDashboardMocks();
  });

  it("redacts emails, IPs, and alert details for ADMIN", async () => {
    const response = await GET(request());
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.accessControl.staleAdmins[0].email).toBe("op***@example.com");
    expect(body.accessControl.multiIPAdmins[0].ips).toBeUndefined();
    expect(body.accessControl.multiIPAdmins[0].ipSamples[0]).toBe("198.51.100.0");
    expect(body.alerts.recent[0].ip).toBe("198.51.100.0");
    expect(body.alerts.recent[0].details).toEqual({ redacted: true });
    expect(serialized).not.toContain("person@example.com");
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("198.51.100.88");
  });

  it("allows SUPER_ADMIN to see raw operational details and writes SECURITY_DASHBOARD_VIEWED", async () => {
    mocks.requirePermission.mockResolvedValue({ ...ADMIN_SESSION, role: "SUPER_ADMIN" });

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.accessControl.staleAdmins[0].email).toBe("operator@example.com");
    expect(body.accessControl.multiIPAdmins[0].ips).toContain("198.51.100.1");
    expect(body.alerts.recent[0].ip).toBe("198.51.100.88");
    expect(JSON.stringify(body.alerts.recent[0].details)).not.toContain("person@example.com");
    expect(mocks.writeAdminAudit).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "admin-1" }),
      expect.objectContaining({
        action: "SECURITY_DASHBOARD_VIEWED",
        metadata: expect.objectContaining({
          counts: expect.objectContaining({ alerts: 1, sensitiveOperations: 1 }),
        }),
      }),
    );
  });
});
