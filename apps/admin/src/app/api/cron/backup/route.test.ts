import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const findMany = vi.fn().mockResolvedValue([]);
  const prisma = {
    user: { findMany },
    profile: { findMany },
    serviceProvider: { findMany },
    serviceProviderCoverage: { findMany },
    address: { findMany },
    service: { findMany },
    movingPlan: { findMany },
    budget: { findMany },
    subscription: { findMany },
    notification: { findMany },
    auditLog: { findMany },
    backupRecord: {
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  };

  return {
    prisma,
    verifyInternalAuth: vi.fn(),
    serializeBackupRecordMetadata: vi.fn(),
    uploadBackupArchive: vi.fn(),
    encryptBackup: vi.fn(),
    signBackup: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/internal-secrets", () => ({
  verifyInternalAuth: mocks.verifyInternalAuth,
}));
vi.mock("@/lib/backup-storage", () => ({
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
    mocks.verifyInternalAuth.mockReturnValue(true);
    mocks.serializeBackupRecordMetadata.mockImplementation((value: unknown) =>
      JSON.stringify(value),
    );
    mocks.prisma.backupRecord.create.mockResolvedValue({
      id: "backup_cron_1",
    });
    mocks.prisma.backupRecord.update.mockResolvedValue({});
  });

  it("fails closed before creating a plaintext cron archive in production", async () => {
    const { POST } = await import("./route");
    const res = await POST(cronRequest());

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({
      code: "BACKUP_CRYPTO_NOT_CONFIGURED",
    });
    expect(mocks.encryptBackup).not.toHaveBeenCalled();
    expect(mocks.uploadBackupArchive).not.toHaveBeenCalled();
    expect(mocks.prisma.backupRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "backup_cron_1" },
        data: expect.objectContaining({ status: "FAILED" }),
      }),
    );
  });
});
