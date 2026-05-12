import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  verifyInternalAuth: vi.fn(),
  backupFindMany: vi.fn(),
  backupCount: vi.fn(),
  backupDeleteMany: vi.fn(),
  auditCreate: vi.fn(),
  parseBackupRecordMetadata: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: (...args: unknown[]) => mocks.requirePermission(...args),
}));
vi.mock("@/lib/internal-secrets", () => ({
  verifyInternalAuth: (...args: unknown[]) => mocks.verifyInternalAuth(...args),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    backupRecord: {
      findMany: (...args: unknown[]) => mocks.backupFindMany(...args),
      count: (...args: unknown[]) => mocks.backupCount(...args),
      deleteMany: (...args: unknown[]) => mocks.backupDeleteMany(...args),
    },
    adminAuditLog: {
      create: (...args: unknown[]) => mocks.auditCreate(...args),
    },
  },
}));
vi.mock("@/lib/backup-storage", () => ({
  parseBackupRecordMetadata: (...args: unknown[]) =>
    mocks.parseBackupRecordMetadata(...args),
}));

function retentionRequest(body: Record<string, unknown> = {}) {
  return new NextRequest("https://admin.locateflow.com/api/backup/retention", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("backup retention cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1" });
    mocks.verifyInternalAuth.mockReturnValue(false);
    mocks.backupFindMany.mockResolvedValue([{ id: "backup_old", errorMessage: null }]);
    mocks.backupCount.mockResolvedValue(1);
    mocks.backupDeleteMany.mockResolvedValue({ count: 1 });
    mocks.auditCreate.mockResolvedValue({});
    mocks.parseBackupRecordMetadata.mockReturnValue({});
  });

  it("supports dry-run without deleting backup records", async () => {
    const { POST } = await import("./route");
    const response = await POST(retentionRequest({ dryRun: true }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.retention.dryRun).toBe(true);
    expect(mocks.backupDeleteMany).not.toHaveBeenCalled();
  });

  it("writes an audit log for retention cleanup", async () => {
    const { POST } = await import("./route");
    const response = await POST(retentionRequest());

    expect(response.status).toBe(200);
    expect(mocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          adminUserId: "admin_1",
          action: "BACKUP_RETENTION_SUCCESS",
          entityType: "BackupRecord",
          entityId: "retention",
        }),
      }),
    );
  });

  it("preserves metadata records when offsite object cleanup is not implemented", async () => {
    mocks.parseBackupRecordMetadata.mockReturnValue({
      offsite: { status: "stored", objectKey: "backups/2026/backup_1/file.json" },
    });

    const { POST } = await import("./route");
    const response = await POST(retentionRequest());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.retention.offsiteRecordsPreserved).toBeGreaterThan(0);
    expect(mocks.backupDeleteMany).not.toHaveBeenCalled();
  });
});
