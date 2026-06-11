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
  deleteBackupArchive: vi.fn(),
  isOffsiteRetentionDeleteEnabled: vi.fn(),
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
  deleteBackupArchive: (...args: unknown[]) =>
    mocks.deleteBackupArchive(...args),
  isOffsiteRetentionDeleteEnabled: (...args: unknown[]) =>
    mocks.isOffsiteRetentionDeleteEnabled(...args),
}));

const STORED_OBJECT_KEY = "backups/20260401/backup_old/backup-file.json";

function retentionRequest(body: Record<string, unknown> = {}) {
  return new NextRequest("https://admin.locateflow.com/api/backup/retention", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function storedOffsiteMetadata() {
  return {
    offsite: {
      status: "stored",
      bucket: "locateflow-backups",
      objectKey: STORED_OBJECT_KEY,
    },
  };
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
    mocks.isOffsiteRetentionDeleteEnabled.mockResolvedValue(false);
    mocks.deleteBackupArchive.mockResolvedValue({
      outcome: "deleted",
      objectKey: STORED_OBJECT_KEY,
      reason: null,
    });
  });

  it("supports dry-run without deleting backup records", async () => {
    const { POST } = await import("./route");
    const response = await POST(retentionRequest({ dryRun: true }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.retention.dryRun).toBe(true);
    expect(mocks.backupDeleteMany).not.toHaveBeenCalled();
    expect(mocks.deleteBackupArchive).not.toHaveBeenCalled();
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

  it("preserves offsite-stored records while the delete flag is disabled (default)", async () => {
    mocks.parseBackupRecordMetadata.mockReturnValue(storedOffsiteMetadata());

    const { POST } = await import("./route");
    const response = await POST(retentionRequest());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.retention.offsiteCleanup).toBe("disabled_metadata_preserved");
    expect(body.retention.offsiteRecordsPreserved).toBeGreaterThan(0);
    expect(mocks.backupDeleteMany).not.toHaveBeenCalled();
    expect(mocks.deleteBackupArchive).not.toHaveBeenCalled();
  });

  it("dry-run with the flag enabled performs no offsite or DB deletes", async () => {
    mocks.isOffsiteRetentionDeleteEnabled.mockResolvedValue(true);
    mocks.parseBackupRecordMetadata.mockReturnValue(storedOffsiteMetadata());

    const { POST } = await import("./route");
    const response = await POST(retentionRequest({ dryRun: true }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.retention.offsiteCleanup).toBe("dry_run_no_deletes");
    expect(body.retention.offsiteDelete.deleted).toBe(0);
    expect(mocks.deleteBackupArchive).not.toHaveBeenCalled();
    expect(mocks.backupDeleteMany).not.toHaveBeenCalled();
  });

  it("enabled path deletes the stored offsite object exactly once, then the DB row", async () => {
    mocks.isOffsiteRetentionDeleteEnabled.mockResolvedValue(true);
    mocks.parseBackupRecordMetadata.mockReturnValue(storedOffsiteMetadata());

    const { POST } = await import("./route");
    const response = await POST(retentionRequest());

    expect(response.status).toBe(200);
    // The same record surfaces from both the completed and failed
    // candidate queries in this mock; dedupe must keep it to a single
    // offsite delete attempt.
    expect(mocks.deleteBackupArchive).toHaveBeenCalledTimes(1);
    expect(mocks.deleteBackupArchive).toHaveBeenCalledWith({
      backupId: "backup_old",
      offsite: expect.objectContaining({ objectKey: STORED_OBJECT_KEY }),
    });
    // DB row removed only after the object delete succeeded.
    expect(mocks.backupDeleteMany).toHaveBeenCalledWith({
      where: { id: "backup_old" },
    });

    const body = await response.json();
    expect(body.retention.offsiteCleanup).toBe("enabled");
    expect(body.retention.offsiteDelete.deleted).toBe(1);
    expect(body.retention.offsiteRecordsPreserved).toBe(0);
  });

  it("preserves the DB row when the offsite delete fails (retry next run)", async () => {
    mocks.isOffsiteRetentionDeleteEnabled.mockResolvedValue(true);
    mocks.parseBackupRecordMetadata.mockReturnValue(storedOffsiteMetadata());
    mocks.deleteBackupArchive.mockResolvedValue({
      outcome: "failed",
      objectKey: STORED_OBJECT_KEY,
      reason: "Delete failed (500): InternalError",
    });

    const { POST } = await import("./route");
    const response = await POST(retentionRequest());

    expect(response.status).toBe(200);
    expect(mocks.deleteBackupArchive).toHaveBeenCalledTimes(1);
    expect(mocks.backupDeleteMany).not.toHaveBeenCalled();

    const body = await response.json();
    expect(body.retention.offsiteDelete.deleted).toBe(0);
    expect(body.retention.offsiteDelete.failed).toBe(1);
    expect(body.retention.offsiteRecordsPreserved).toBe(1);
  });

  it("preserves the DB row when the storage client refuses the key (prefix mismatch)", async () => {
    mocks.isOffsiteRetentionDeleteEnabled.mockResolvedValue(true);
    mocks.parseBackupRecordMetadata.mockReturnValue({
      offsite: {
        status: "stored",
        bucket: "locateflow-backups",
        objectKey: "uploads/backup_old/escaped.json",
      },
    });
    mocks.deleteBackupArchive.mockResolvedValue({
      outcome: "refused",
      objectKey: "uploads/backup_old/escaped.json",
      reason:
        "Object key is missing, outside the configured backup prefix, or does not belong to this backup record.",
    });

    const { POST } = await import("./route");
    const response = await POST(retentionRequest());

    expect(response.status).toBe(200);
    expect(mocks.backupDeleteMany).not.toHaveBeenCalled();

    const body = await response.json();
    expect(body.retention.offsiteDelete.refused).toBe(1);
    expect(body.retention.offsiteDelete.deleted).toBe(0);
    expect(body.retention.offsiteRecordsPreserved).toBe(1);
  });
});
