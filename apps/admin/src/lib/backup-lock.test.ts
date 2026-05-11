import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BackupRunLockError,
  acquireBackupRunLock,
  acquireRestoreRunLock,
  markBackupRunFailed,
} from "./backup-lock";

afterEach(() => {
  vi.unstubAllEnvs();
});

function prismaMock() {
  return {
    backupRecord: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({
        id: "candidate",
        createdAt: new Date("2026-04-24T00:00:00.000Z"),
      }),
      findMany: vi.fn().mockResolvedValue([
        { id: "candidate", createdAt: new Date("2026-04-24T00:00:00.000Z") },
      ]),
      update: vi.fn().mockResolvedValue({}),
    },
  };
}

describe("backup run lock", () => {
  it("allows the candidate backup when it is the oldest active in-progress run", async () => {
    const prisma = prismaMock();

    const backup = await acquireBackupRunLock({
      prismaClient: prisma,
      data: {
        type: "FULL",
        status: "IN_PROGRESS",
        format: "JSON",
        tables: "[]",
        createdBy: "admin_1",
      },
      now: new Date("2026-04-24T00:00:00.000Z"),
    });

    expect(backup.id).toBe("candidate");
    expect(prisma.backupRecord.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "IN_PROGRESS" }),
        data: expect.objectContaining({ status: "FAILED" }),
      }),
    );
  });

  it("rejects an overlapping backup and releases the losing candidate", async () => {
    const prisma = prismaMock();
    prisma.backupRecord.findMany.mockResolvedValue([
      { id: "active", createdAt: new Date("2026-04-24T00:00:00.000Z") },
      { id: "candidate", createdAt: new Date("2026-04-24T00:00:01.000Z") },
    ]);

    await expect(
      acquireBackupRunLock({
        prismaClient: prisma,
        data: {
          type: "FULL",
          status: "IN_PROGRESS",
          format: "JSON",
          tables: "[]",
          createdBy: "admin_1",
        },
        now: new Date("2026-04-24T00:00:01.000Z"),
      }),
    ).rejects.toMatchObject({
      name: "BackupRunLockError",
      activeBackupId: "active",
      candidateBackupId: "candidate",
    } satisfies Partial<BackupRunLockError>);

    expect(prisma.backupRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "candidate" },
        data: expect.objectContaining({
          status: "FAILED",
          errorMessage: expect.stringContaining("Backup lock held by active"),
        }),
      }),
    );
  });

  it("redacts secret values when marking a backup run failed", async () => {
    const prisma = prismaMock();
    vi.stubEnv("DATABASE_URL", "mysql://u:secret-pass@example.test/db");

    await markBackupRunFailed({
      prismaClient: prisma,
      backupId: "backup_1",
      error: new Error("failed mysql://u:secret-pass@example.test/db"),
    });

    const update = prisma.backupRecord.update.mock.calls[0]?.[0];
    expect(update.data.errorMessage).not.toContain("secret-pass");
    expect(update.data.errorMessage).toContain("mysql://[redacted]@");
  });

  it("rejects overlapping restore locks with the active restore id", async () => {
    const prisma = prismaMock();
    prisma.backupRecord.create.mockResolvedValue({
      id: "restore_candidate",
      createdAt: new Date("2026-04-24T00:00:01.000Z"),
    });
    prisma.backupRecord.findMany.mockResolvedValue([
      { id: "restore_active", createdAt: new Date("2026-04-24T00:00:00.000Z") },
      { id: "restore_candidate", createdAt: new Date("2026-04-24T00:00:01.000Z") },
    ]);

    await expect(
      acquireRestoreRunLock({
        prismaClient: prisma,
        adminId: "admin_1",
        mode: "MERGE",
        tables: ["users"],
        now: new Date("2026-04-24T00:00:01.000Z"),
      }),
    ).rejects.toMatchObject({
      name: "RestoreRunLockError",
      activeRestoreId: "restore_active",
    });

    expect(prisma.backupRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "restore_candidate" },
        data: expect.objectContaining({ status: "FAILED" }),
      }),
    );
  });
});
