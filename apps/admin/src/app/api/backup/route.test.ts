import { beforeEach, describe, expect, it, vi } from "vitest";

const VALID_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const mocks = vi.hoisted(() => {
  const findMany = vi.fn().mockResolvedValue([]);
  const count = vi.fn().mockResolvedValue(0);
  const prisma = {
    user: { count, findMany },
    profile: { count, findMany },
    serviceProvider: { count, findMany },
    serviceProviderCoverage: { count, findMany },
    address: { count, findMany },
    service: { count, findMany },
    movingPlan: { count, findMany },
    userCustomProvider: { count, findMany },
    moveTask: { count, findMany },
    budget: { count, findMany },
    subscription: { count, findMany },
    auditLog: { count, findMany },
    notification: { count, findMany },
    providerGovernanceIssue: { count, findMany },
    backupRecord: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
    adminAuditLog: {
      create: vi.fn(),
    },
    adminUser: {
      findMany: vi.fn(),
    },
  };

  return {
    prisma,
    requirePermission: vi.fn(),
    requirePasswordConfirm: vi.fn(),
    getBackupStorageSummary: vi.fn(),
    parseBackupRecordMetadata: vi.fn(),
    serializeBackupRecordMetadata: vi.fn(),
    uploadBackupArchive: vi.fn(),
    encryptBackup: vi.fn(),
    signBackup: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({
  requirePermission: mocks.requirePermission,
  requirePasswordConfirm: mocks.requirePasswordConfirm,
}));
vi.mock("@/lib/backup-storage", () => ({
  getBackupStorageSummary: mocks.getBackupStorageSummary,
  parseBackupRecordMetadata: mocks.parseBackupRecordMetadata,
  serializeBackupRecordMetadata: mocks.serializeBackupRecordMetadata,
  uploadBackupArchive: mocks.uploadBackupArchive,
}));
vi.mock("@/lib/shared-encryption", () => ({
  encryptBackup: mocks.encryptBackup,
  signBackup: mocks.signBackup,
  validateKeyFormat: (value: string) =>
    typeof value === "string" &&
    /^[0-9a-fA-F]{64}$/.test(value),
}));

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/backup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

describe("backup creation safety policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("FIELD_ENCRYPTION_KEY", VALID_KEY);

    mocks.requirePermission.mockResolvedValue({
      adminId: "admin_1",
      email: "admin@example.com",
    });
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
    mocks.parseBackupRecordMetadata.mockReturnValue({});
    mocks.prisma.backupRecord.create.mockResolvedValue({
      id: "backup_1",
      type: "FULL",
      status: "IN_PROGRESS",
      format: "JSON",
      tables: "[]",
      createdBy: "admin_1",
      createdAt: new Date("2026-04-24T00:00:00.000Z"),
    });
    mocks.prisma.backupRecord.findMany.mockResolvedValue([
      { id: "backup_1", createdAt: new Date("2026-04-24T00:00:00.000Z") },
    ]);
    mocks.prisma.backupRecord.updateMany.mockResolvedValue({ count: 0 });
    mocks.prisma.backupRecord.update.mockResolvedValue({});
    mocks.prisma.user.findMany.mockResolvedValue([{ id: "user_1" }]);
    mocks.encryptBackup.mockReturnValue({
      encryptedData: "encrypted",
      iv: "iv",
      authTag: "tag",
    });
    mocks.signBackup.mockReturnValue("signature");
    mocks.serializeBackupRecordMetadata.mockImplementation((value: unknown) =>
      JSON.stringify(value),
    );
    mocks.uploadBackupArchive.mockResolvedValue({
      status: "stored",
      provider: "s3",
      bucket: "backups",
      region: "nyc3",
      endpoint: "https://example.test",
      objectKey: "backups/backup_1/backup.json",
      location: "s3://backups/backup.json",
      uploadedAt: "2026-04-24T00:00:00.000Z",
      reason: null,
    });
  });

  it("fails closed in production when FIELD_ENCRYPTION_KEY is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FIELD_ENCRYPTION_KEY", "");

    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest({
        type: "FULL",
        tables: ["users"],
        confirmPassword: "correct horse",
      }),
    );

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({
      code: "BACKUP_CRYPTO_NOT_CONFIGURED",
    });
    expect(mocks.encryptBackup).not.toHaveBeenCalled();
    expect(mocks.uploadBackupArchive).not.toHaveBeenCalled();
    expect(mocks.prisma.backupRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "backup_1" },
        data: expect.objectContaining({ status: "FAILED" }),
      }),
    );
  });

  it("allows browser download fallback outside production when offsite storage is unavailable", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("FIELD_ENCRYPTION_KEY", "");
    mocks.encryptBackup.mockReturnValue(null);
    mocks.signBackup.mockReturnValue(null);
    mocks.uploadBackupArchive.mockResolvedValue({
      status: "disabled",
      provider: null,
      bucket: null,
      region: null,
      endpoint: null,
      objectKey: null,
      location: null,
      uploadedAt: null,
      reason: "Offsite backup storage is not configured.",
    });

    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest({
        type: "FULL",
        tables: ["users"],
        confirmPassword: "correct horse",
      }),
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.downloadData).toEqual(expect.any(String));
    expect(body.archivePolicy.browserDownloadFallbackAllowed).toBe(true);
  });

  it("fails closed in production when offsite storage does not retain the archive", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FIELD_ENCRYPTION_KEY", VALID_KEY);
    mocks.uploadBackupArchive.mockResolvedValue({
      status: "disabled",
      provider: null,
      bucket: null,
      region: null,
      endpoint: null,
      objectKey: null,
      location: null,
      uploadedAt: null,
      reason: "Offsite backup storage is not configured.",
    });

    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest({
        type: "FULL",
        tables: ["users"],
        confirmPassword: "correct horse",
      }),
    );

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({
      code: "BACKUP_OFFSITE_REQUIRED",
    });
    expect(mocks.prisma.backupRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "backup_1" },
        data: expect.objectContaining({ status: "FAILED" }),
      }),
    );
  });

  it("fails closed in production when encryption or HMAC signing is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FIELD_ENCRYPTION_KEY", VALID_KEY);
    mocks.encryptBackup.mockReturnValue(null);
    mocks.signBackup.mockReturnValue(null);

    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest({
        type: "FULL",
        tables: ["users"],
        confirmPassword: "correct horse",
      }),
    );

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({
      code: "BACKUP_ARCHIVE_UNPROTECTED",
    });
    expect(mocks.uploadBackupArchive).not.toHaveBeenCalled();
  });

  it("marks manual backups partial when a selected table fetch fails", async () => {
    mocks.prisma.user.findMany.mockRejectedValue(new Error("table unavailable"));

    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest({
        type: "FULL",
        tables: ["users"],
        confirmPassword: "correct horse",
      }),
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({
      partial: true,
      failedTables: ["users"],
      backup: { type: "PARTIAL", status: "COMPLETED" },
    });
    expect(mocks.prisma.backupRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "PARTIAL",
          status: "COMPLETED",
        }),
      }),
    );
  });

  it("writes schema hash metadata without leaking backup secrets", async () => {
    vi.stubEnv(
      "DATABASE_URL",
      "mysql://backup_user:supersecret@db.example.com:3306/locateflow",
    );
    vi.stubEnv("FIELD_ENCRYPTION_KEY", VALID_KEY);

    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest({
        type: "FULL",
        tables: ["users"],
        confirmPassword: "correct horse",
      }),
    );

    expect(res.status).toBe(201);
    const uploadArgs = mocks.uploadBackupArchive.mock.calls.at(-1)?.[0];
    const archive = JSON.parse(uploadArgs.archiveBody);
    expect(archive.metadata.compatibility.schemaHash).toEqual(expect.any(String));
    expect(archive.metadata.compatibility.schemaHash.length).toBe(64);
    expect(archive.metadata.environment.databaseFingerprint).toEqual(expect.any(String));
    expect(uploadArgs.archiveBody).not.toContain("supersecret");
    expect(uploadArgs.archiveBody).not.toContain(VALID_KEY);
  });
});
