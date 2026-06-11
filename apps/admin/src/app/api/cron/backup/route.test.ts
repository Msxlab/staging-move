import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dispatchAlert: vi.fn(),
  verifyInternalAuth: vi.fn(),
  backupRecordFindFirst: vi.fn(),
  backupRecordFindMany: vi.fn(),
  backupRecordCreate: vi.fn(),
  backupRecordUpdate: vi.fn(),
  backupRecordUpdateMany: vi.fn(),
  backupRecordDeleteMany: vi.fn(),
  auditCreate: vi.fn(),
  safeUserFindMany: vi.fn(),
  unsafeUserFindMany: vi.fn(),
  requireBackupCrypto: vi.fn(),
  encryptBackup: vi.fn(),
  signBackup: vi.fn(),
  uploadBackupArchive: vi.fn(),
  parseBackupRecordMetadata: vi.fn(),
  deleteBackupArchive: vi.fn(),
  isOffsiteRetentionDeleteEnabled: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    backupRecord: {
      findFirst: mocks.backupRecordFindFirst,
      findMany: mocks.backupRecordFindMany,
      create: mocks.backupRecordCreate,
      update: mocks.backupRecordUpdate,
      updateMany: mocks.backupRecordUpdateMany,
      deleteMany: mocks.backupRecordDeleteMany,
    },
    adminAuditLog: { create: mocks.auditCreate },
    user: { findMany: mocks.safeUserFindMany },
    oAuthAccount: { findMany: vi.fn().mockResolvedValue([]) },
    profile: { findMany: vi.fn().mockResolvedValue([]) },
    dataConsent: { findMany: vi.fn().mockResolvedValue([]) },
    serviceProvider: { findMany: vi.fn().mockResolvedValue([]) },
    serviceProviderCoverage: { findMany: vi.fn().mockResolvedValue([]) },
    address: { findMany: vi.fn().mockResolvedValue([]) },
    service: { findMany: vi.fn().mockResolvedValue([]) },
    movingPlan: { findMany: vi.fn().mockResolvedValue([]) },
    userCustomProvider: { findMany: vi.fn().mockResolvedValue([]) },
    moveTask: { findMany: vi.fn().mockResolvedValue([]) },
    budget: { findMany: vi.fn().mockResolvedValue([]) },
    subscription: { findMany: vi.fn().mockResolvedValue([]) },
    notification: { findMany: vi.fn().mockResolvedValue([]) },
    emailLog: { findMany: vi.fn().mockResolvedValue([]) },
    auditLog: { findMany: vi.fn().mockResolvedValue([]) },
    providerGovernanceIssue: { findMany: vi.fn().mockResolvedValue([]) },
    adminUser: { findMany: vi.fn().mockResolvedValue([]) },
    adminPermission: { findMany: vi.fn().mockResolvedValue([]) },
    adminLoginLog: { findMany: vi.fn().mockResolvedValue([]) },
  },
  prismaUnsafe: {
    user: { findMany: mocks.unsafeUserFindMany },
    oAuthAccount: { findMany: vi.fn().mockResolvedValue([]) },
    profile: { findMany: vi.fn().mockResolvedValue([]) },
    dataConsent: { findMany: vi.fn().mockResolvedValue([]) },
    serviceProvider: { findMany: vi.fn().mockResolvedValue([]) },
    serviceProviderCoverage: { findMany: vi.fn().mockResolvedValue([]) },
    address: { findMany: vi.fn().mockResolvedValue([]) },
    service: { findMany: vi.fn().mockResolvedValue([]) },
    movingPlan: { findMany: vi.fn().mockResolvedValue([]) },
    userCustomProvider: { findMany: vi.fn().mockResolvedValue([]) },
    moveTask: { findMany: vi.fn().mockResolvedValue([]) },
    budget: { findMany: vi.fn().mockResolvedValue([]) },
    subscription: { findMany: vi.fn().mockResolvedValue([]) },
    notification: { findMany: vi.fn().mockResolvedValue([]) },
    emailLog: { findMany: vi.fn().mockResolvedValue([]) },
    auditLog: { findMany: vi.fn().mockResolvedValue([]) },
    providerGovernanceIssue: { findMany: vi.fn().mockResolvedValue([]) },
    adminUser: { findMany: vi.fn().mockResolvedValue([]) },
    adminPermission: { findMany: vi.fn().mockResolvedValue([]) },
    adminLoginLog: { findMany: vi.fn().mockResolvedValue([]) },
    adminAuditLog: { findMany: vi.fn().mockResolvedValue([]) },
    acquisitionCampaign: { findMany: vi.fn().mockResolvedValue([]) },
    acquisitionRedemption: { findMany: vi.fn().mockResolvedValue([]) },
    blogCategory: { findMany: vi.fn().mockResolvedValue([]) },
    blogTag: { findMany: vi.fn().mockResolvedValue([]) },
    blogPost: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock("@/lib/internal-secrets", () => ({
  verifyInternalAuth: mocks.verifyInternalAuth,
}));
vi.mock("@/lib/alert-dispatcher", () => ({
  dispatchAlert: mocks.dispatchAlert,
}));
vi.mock("@/lib/backup-archive", () => ({
  createBackupArchive: vi.fn((input) => ({ version: 1, ...input })),
}));
vi.mock("@/lib/backup-storage", () => ({
  parseBackupRecordMetadata: mocks.parseBackupRecordMetadata,
  serializeBackupRecordMetadata: vi.fn((metadata) => JSON.stringify(metadata)),
  uploadBackupArchive: mocks.uploadBackupArchive,
  deleteBackupArchive: mocks.deleteBackupArchive,
  isOffsiteRetentionDeleteEnabled: mocks.isOffsiteRetentionDeleteEnabled,
}));
vi.mock("@/lib/shared-encryption", () => ({
  encryptBackup: mocks.encryptBackup,
  signBackup: mocks.signBackup,
  validateKeyFormat: (value: string) =>
    typeof value === "string" && /^[0-9a-fA-F]{64}$/.test(value),
}));
vi.mock("@/lib/backup-policy", () => {
  class BackupPolicyError extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly status = 503,
    ) {
      super(message);
      this.name = "BackupPolicyError";
    }
  }
  return {
    BackupPolicyError,
    getBackupArchivePolicy: vi.fn(() => ({})),
    requireBackupCrypto: mocks.requireBackupCrypto,
    requireArchiveProtected: vi.fn(),
    requireOffsiteStored: vi.fn(),
    evaluateBackupArchiveSize: vi.fn(() => ({ ok: true, warning: null })),
  };
});

import { BackupPolicyError } from "@/lib/backup-policy";

function cronRequest() {
  return new Request("http://localhost/api/cron/backup", {
    method: "POST",
    headers: { authorization: "Bearer cron-secret" },
  }) as any;
}

describe("cron backup safety policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FIELD_ENCRYPTION_KEY", "");
    mocks.dispatchAlert.mockResolvedValue(undefined);
    mocks.verifyInternalAuth.mockReturnValue(true);
    mocks.requireBackupCrypto.mockReset();
    mocks.requireBackupCrypto.mockImplementation(() => undefined);
    mocks.backupRecordFindFirst.mockResolvedValue(null);
    mocks.backupRecordCreate.mockResolvedValue({
      id: "backup_cron_1",
    });
    mocks.backupRecordFindMany.mockResolvedValue([
      { id: "backup_cron_1", createdAt: new Date("2026-04-24T00:00:00.000Z") },
    ]);
    mocks.backupRecordUpdateMany.mockResolvedValue({ count: 0 });
    mocks.backupRecordUpdate.mockResolvedValue({});
    mocks.backupRecordDeleteMany.mockResolvedValue({ count: 0 });
    mocks.auditCreate.mockResolvedValue({});
    mocks.safeUserFindMany.mockResolvedValue([]);
    mocks.unsafeUserFindMany.mockResolvedValue([{ id: "soft_deleted_user" }]);
    mocks.encryptBackup.mockReturnValue("encrypted");
    mocks.signBackup.mockReturnValue("signature");
    mocks.uploadBackupArchive.mockResolvedValue({ status: "stored" });
    mocks.parseBackupRecordMetadata.mockReturnValue({});
    mocks.isOffsiteRetentionDeleteEnabled.mockResolvedValue(false);
    mocks.deleteBackupArchive.mockResolvedValue({
      outcome: "deleted",
      objectKey: "backups/20260424/backup_cron_old/backup-file.json",
      reason: null,
    });
  });

  it("fails closed before creating a plaintext cron archive in production", async () => {
    mocks.requireBackupCrypto.mockImplementation(() => {
      throw new BackupPolicyError(
        "BACKUP_CRYPTO_NOT_CONFIGURED",
        "Production backup archives require FIELD_ENCRYPTION_KEY.",
        503,
      );
    });

    const { POST } = await import("./route");
    const res = await POST(cronRequest());

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({
      code: "BACKUP_CRYPTO_NOT_CONFIGURED",
    });
    expect(mocks.encryptBackup).not.toHaveBeenCalled();
    expect(mocks.uploadBackupArchive).not.toHaveBeenCalled();
    expect(mocks.backupRecordUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "backup_cron_1" },
        data: expect.objectContaining({ status: "FAILED" }),
      }),
    );
  });

  it("dispatches a critical alert when a scheduled backup fails", async () => {
    mocks.requireBackupCrypto.mockImplementation(() => {
      throw new Error("crypto missing");
    });

    const { POST } = await import("./route");
    const response = await POST(cronRequest());

    expect(response.status).toBe(500);
    expect(mocks.backupRecordUpdate).toHaveBeenCalledWith({
      where: { id: "backup_cron_1" },
      data: expect.objectContaining({ status: "FAILED" }),
    });
    expect(mocks.dispatchAlert).toHaveBeenCalledWith(
      "BACKUP_FAILED",
      "CRITICAL",
      "cron",
      expect.stringContaining("crypto missing"),
    );
  });

  it("exports cron backup data through prismaUnsafe so soft-deleted rows are included", async () => {
    vi.stubEnv("FIELD_ENCRYPTION_KEY", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");

    const { POST } = await import("./route");
    const response = await POST(cronRequest());

    expect(response.status).toBe(200);
    expect(mocks.unsafeUserFindMany).toHaveBeenCalled();
    expect(mocks.safeUserFindMany).not.toHaveBeenCalled();
    expect(mocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "BACKUP_CRON_SUCCESS",
        }),
      }),
    );
  });

  it("preserves offsite-stored retention candidates while the delete flag is disabled", async () => {
    vi.stubEnv("FIELD_ENCRYPTION_KEY", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
    mocks.parseBackupRecordMetadata.mockReturnValue({
      offsite: {
        status: "stored",
        objectKey: "backups/20260424/backup_cron_1/backup-file.json",
      },
    });

    const { POST } = await import("./route");
    const response = await POST(cronRequest());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.retention.offsiteDeleteEnabled).toBe(false);
    expect(body.retention.preservedOffsite).toBe(1);
    expect(mocks.deleteBackupArchive).not.toHaveBeenCalled();
    expect(mocks.backupRecordDeleteMany).not.toHaveBeenCalled();
  });

  it("deletes the offsite object before the row when the delete flag is enabled", async () => {
    vi.stubEnv("FIELD_ENCRYPTION_KEY", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
    mocks.isOffsiteRetentionDeleteEnabled.mockResolvedValue(true);
    mocks.parseBackupRecordMetadata.mockReturnValue({
      offsite: {
        status: "stored",
        objectKey: "backups/20260424/backup_cron_1/backup-file.json",
      },
    });

    const { POST } = await import("./route");
    const response = await POST(cronRequest());

    expect(response.status).toBe(200);
    expect(mocks.deleteBackupArchive).toHaveBeenCalledWith({
      backupId: "backup_cron_1",
      offsite: expect.objectContaining({
        objectKey: "backups/20260424/backup_cron_1/backup-file.json",
      }),
    });
    expect(mocks.backupRecordDeleteMany).toHaveBeenCalledWith({
      where: { id: "backup_cron_1" },
    });
    const body = await response.json();
    expect(body.retention.offsiteDeleted).toBe(1);
    expect(body.retention.preservedOffsite).toBe(0);
  });

  it("keeps the retention row when the offsite delete fails", async () => {
    vi.stubEnv("FIELD_ENCRYPTION_KEY", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
    mocks.isOffsiteRetentionDeleteEnabled.mockResolvedValue(true);
    mocks.parseBackupRecordMetadata.mockReturnValue({
      offsite: {
        status: "stored",
        objectKey: "backups/20260424/backup_cron_1/backup-file.json",
      },
    });
    mocks.deleteBackupArchive.mockResolvedValue({
      outcome: "failed",
      objectKey: "backups/20260424/backup_cron_1/backup-file.json",
      reason: "Delete failed (500): InternalError",
    });

    const { POST } = await import("./route");
    const response = await POST(cronRequest());

    expect(response.status).toBe(200);
    expect(mocks.backupRecordDeleteMany).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.retention.offsiteDeleted).toBe(0);
    expect(body.retention.offsiteDeleteFailed).toBe(1);
    expect(body.retention.preservedOffsite).toBe(1);
  });
});
