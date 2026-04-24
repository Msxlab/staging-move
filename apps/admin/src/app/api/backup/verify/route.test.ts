import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const count = vi.fn().mockResolvedValue(0);
  const prisma = {
    user: { count },
    profile: { count },
    address: { count },
    service: { count },
    serviceProvider: { count },
    serviceProviderCoverage: { count: vi.fn().mockResolvedValue(7) },
    movingPlan: { count },
    userCustomProvider: { count: vi.fn().mockResolvedValue(3) },
    moveTask: { count: vi.fn().mockResolvedValue(5) },
    budget: { count },
    subscription: { count },
    auditLog: { count },
    notification: { count },
    providerGovernanceIssue: { count: vi.fn().mockResolvedValue(2) },
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
});
