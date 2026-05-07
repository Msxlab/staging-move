import { serializeBackupRecordMetadata } from "@/lib/backup-storage";
import { redactBackupSecretText } from "@/lib/backup-metadata";

export const BACKUP_LOCK_STALE_MS = 2 * 60 * 60 * 1000;

export class BackupRunLockError extends Error {
  constructor(
    message: string,
    public readonly activeBackupId?: string,
    public readonly candidateBackupId?: string,
  ) {
    super(message);
    this.name = "BackupRunLockError";
  }
}

interface BackupRecordClient {
  backupRecord: {
    updateMany: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
    findMany: (args: any) => Promise<any[]>;
    update: (args: any) => Promise<any>;
  };
}

export async function acquireBackupRunLock(input: {
  prismaClient: BackupRecordClient;
  data: Record<string, unknown>;
  now?: Date;
  staleMs?: number;
}) {
  const now = input.now || new Date();
  const staleMs = input.staleMs ?? BACKUP_LOCK_STALE_MS;
  const staleCutoff = new Date(now.getTime() - staleMs);

  await input.prismaClient.backupRecord.updateMany({
    where: {
      status: "IN_PROGRESS",
      createdAt: { lt: staleCutoff },
    },
    data: {
      status: "FAILED",
      completedAt: now,
      errorMessage: serializeBackupRecordMetadata({
        error: `Backup lock expired after ${Math.round(staleMs / 60000)} minute(s). Marked stale IN_PROGRESS job as FAILED.`,
      }),
    },
  });

  const backup = await input.prismaClient.backupRecord.create({
    data: input.data,
  });

  const activeBackups = await input.prismaClient.backupRecord.findMany({
    where: {
      status: "IN_PROGRESS",
      createdAt: { gte: staleCutoff },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, createdAt: true, createdBy: true, type: true },
  });
  const activeBackup = activeBackups[0];

  if (activeBackup && activeBackup.id !== backup.id) {
    await input.prismaClient.backupRecord
      .update({
        where: { id: backup.id },
        data: {
          status: "FAILED",
          completedAt: now,
          errorMessage: serializeBackupRecordMetadata({
            error: `Backup lock held by ${activeBackup.id}. Refusing overlapping backup run.`,
          }),
        },
      })
      .catch(() => null);

    throw new BackupRunLockError(
      "Another backup job is already running.",
      activeBackup.id,
      backup.id,
    );
  }

  return backup;
}

export async function markBackupRunFailed(input: {
  prismaClient: BackupRecordClient;
  backupId: string;
  error: unknown;
}) {
  await input.prismaClient.backupRecord
    .update({
      where: { id: input.backupId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage: serializeBackupRecordMetadata({
          error: redactBackupSecretText(input.error),
        }),
      },
    })
    .catch(() => null);
}

