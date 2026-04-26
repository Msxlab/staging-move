import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const count = vi.fn().mockResolvedValue(0);
  const prisma = {
    user: { count },
    oAuthAccount: { count: vi.fn().mockResolvedValue(4) },
    profile: { count },
    dataConsent: { count: vi.fn().mockResolvedValue(6) },
    address: { count },
    service: { count },
    serviceProvider: { count },
    serviceProviderCoverage: { count: vi.fn().mockResolvedValue(7) },
    movingPlan: { count },
    userCustomProvider: { count: vi.fn().mockResolvedValue(3) },
    moveTask: { count: vi.fn().mockResolvedValue(5) },
    budget: { count },
    subscription: { count },
    emailLog: { count: vi.fn().mockResolvedValue(8) },
    auditLog: { count },
    notification: { count },
    providerGovernanceIssue: { count: vi.fn().mockResolvedValue(2) },
    adminUser: { count: vi.fn().mockResolvedValue(1) },
    adminPermission: { count: vi.fn().mockResolvedValue(2) },
    adminLoginLog: { count: vi.fn().mockResolvedValue(9) },
    adminAuditLog: { count: vi.fn().mockResolvedValue(10) },
  };

  return {
    prisma,
    requirePermission: vi.fn(),
    parseBackupArchive: vi.fn(),
    decryptBackup: vi.fn(),
    verifyBackupSignature: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({
  requirePermission: mocks.requirePermission,
}));
vi.mock("@/lib/backup-archive", () => ({
  parseBackupArchive: mocks.parseBackupArchive,
}));
vi.mock("@/lib/shared-encryption", () => ({
  decryptBackup: mocks.decryptBackup,
  verifyBackupSignature: mocks.verifyBackupSignature,
}));

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/backup/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

describe("backup verify catalog validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1" });
    mocks.parseBackupArchive.mockReturnValue(null);
  });

  it("recognizes providerCoverages from the canonical backup catalog", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest({
        data: {
          providerCoverages: [
            { id: "coverage_1", providerId: "provider_1", state: "CA" },
            { id: "coverage_2", providerId: "provider_2", state: "TX" },
          ],
        },
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.tableStats.providerCoverages).toMatchObject({
      count: 2,
      dbCount: 7,
    });
    expect(
      body.checks.some(
        (check: { name: string; detail: string }) =>
          check.name === "Table Validation" &&
          check.detail.includes("providerCoverages"),
      ),
    ).toBe(false);
  });

  it("recognizes move tasks, custom providers, and provider governance issues", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest({
        data: {
          customProviders: [{ id: "custom_1", userId: "user_1", name: "Dentist" }],
          moveTasks: [{ id: "task_1", userId: "user_1", movingPlanId: "move_1" }],
          providerGovernanceIssues: [{ id: "issue_1", issueType: "MISSING_PHONE" }],
        },
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.tableStats.customProviders).toMatchObject({ count: 1, dbCount: 3 });
    expect(body.tableStats.moveTasks).toMatchObject({ count: 1, dbCount: 5 });
    expect(body.tableStats.providerGovernanceIssues).toMatchObject({ count: 1, dbCount: 2 });
  });

  it("recognizes admin, consent, email, and OAuth backup tables", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest({
        data: {
          adminUsers: [{ id: "admin_1", email: "admin@example.com" }],
          adminPermissions: [{ id: "perm_1", adminUserId: "admin_1" }],
          adminLoginLogs: [{ id: "login_1", email: "admin@example.com" }],
          adminAuditLogs: [{ id: "audit_1", adminUserId: "admin_1" }],
          dataConsents: [{ id: "consent_1", userId: "user_1" }],
          emailLogs: [{ id: "email_1", to: "user@example.com" }],
          oauthAccounts: [{ id: "oauth_1", userId: "user_1", provider: "google" }],
        },
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.tableStats.adminUsers).toMatchObject({ count: 1, dbCount: 1 });
    expect(body.tableStats.adminPermissions).toMatchObject({ count: 1, dbCount: 2 });
    expect(body.tableStats.adminLoginLogs).toMatchObject({ count: 1, dbCount: 9 });
    expect(body.tableStats.adminAuditLogs).toMatchObject({ count: 1, dbCount: 10 });
    expect(body.tableStats.dataConsents).toMatchObject({ count: 1, dbCount: 6 });
    expect(body.tableStats.emailLogs).toMatchObject({ count: 1, dbCount: 8 });
    expect(body.tableStats.oauthAccounts).toMatchObject({ count: 1, dbCount: 4 });
  });
});
