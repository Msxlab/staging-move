import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { verifyInternalAuth } from "@/lib/internal-secrets";
import { redactBackupSecretText } from "@/lib/backup-metadata";
import { parseBackupRecordMetadata } from "@/lib/backup-storage";
import { writeBackupAudit } from "@/lib/backup-audit";

// Default retention: 30 days for completed backups, 7 days for failed.
const RETENTION_DAYS_COMPLETED = 30;
const RETENTION_DAYS_FAILED = 7;
const MAX_BACKUPS_KEEP = 50;

async function splitRetentionCandidates(
  records: Array<{ id: string; errorMessage: string | null }>,
) {
  const deletableIds: string[] = [];
  const preservedOffsiteIds: string[] = [];

  for (const record of records) {
    const metadata = parseBackupRecordMetadata(record.errorMessage);
    if (metadata.offsite?.status === "stored" && metadata.offsite.objectKey) {
      preservedOffsiteIds.push(record.id);
    } else {
      deletableIds.push(record.id);
    }
  }

  return { deletableIds, preservedOffsiteIds };
}

async function collectRetentionCandidates(where: any) {
  const records = await prisma.backupRecord.findMany({
    where,
    select: { id: true, errorMessage: true },
  });
  return splitRetentionCandidates(records);
}

// POST /api/backup/retention - run retention cleanup (manual or cron).
export async function POST(request: NextRequest) {
  let session: Awaited<ReturnType<typeof requirePermission>> | null = null;
  let isCron = false;
  let dryRun = false;

  try {
    isCron = verifyInternalAuth(request.headers.get("authorization"), "cron");
    if (!isCron) {
      session = await requirePermission("settings", "canDelete", {
        minimumRole: "SUPER_ADMIN",
      });
    }

    const body = await request.json().catch(() => ({}));
    dryRun =
      body?.dryRun === true ||
      request.nextUrl.searchParams.get("dryRun") === "true" ||
      request.nextUrl.searchParams.get("dryRun") === "1";

    const now = new Date();
    const completedCutoff = new Date(
      now.getTime() - RETENTION_DAYS_COMPLETED * 24 * 60 * 60 * 1000,
    );
    const failedCutoff = new Date(
      now.getTime() - RETENTION_DAYS_FAILED * 24 * 60 * 60 * 1000,
    );

    const completedCandidates = await collectRetentionCandidates({
      status: "COMPLETED",
      createdAt: { lt: completedCutoff },
    });
    const failedCandidates = await collectRetentionCandidates({
      status: "FAILED",
      createdAt: { lt: failedCutoff },
    });

    let completedDeleted = 0;
    let failedDeleted = 0;
    if (!dryRun && completedCandidates.deletableIds.length > 0) {
      completedDeleted = (
        await prisma.backupRecord.deleteMany({
          where: { id: { in: completedCandidates.deletableIds } },
        })
      ).count;
    }
    if (!dryRun && failedCandidates.deletableIds.length > 0) {
      failedDeleted = (
        await prisma.backupRecord.deleteMany({
          where: { id: { in: failedCandidates.deletableIds } },
        })
      ).count;
    }

    const totalBackups = await prisma.backupRecord.count();
    let overflowDeleted = 0;
    let overflowCandidates = {
      deletableIds: [] as string[],
      preservedOffsiteIds: [] as string[],
    };
    if (totalBackups > MAX_BACKUPS_KEEP) {
      const oldestToKeep = await prisma.backupRecord.findMany({
        orderBy: { createdAt: "desc" },
        skip: MAX_BACKUPS_KEEP,
        select: { id: true, errorMessage: true },
      });
      overflowCandidates = await splitRetentionCandidates(oldestToKeep);
      if (!dryRun && overflowCandidates.deletableIds.length > 0) {
        overflowDeleted = (
          await prisma.backupRecord.deleteMany({
            where: { id: { in: overflowCandidates.deletableIds } },
          })
        ).count;
      }
    }

    const retention = {
      dryRun,
      completedDeleted,
      failedDeleted,
      overflowDeleted,
      completedCandidates: completedCandidates.deletableIds.length,
      failedCandidates: failedCandidates.deletableIds.length,
      overflowCandidates: overflowCandidates.deletableIds.length,
      offsiteRecordsPreserved:
        completedCandidates.preservedOffsiteIds.length +
        failedCandidates.preservedOffsiteIds.length +
        overflowCandidates.preservedOffsiteIds.length,
      offsiteCleanup: "not_implemented_metadata_preserved",
      retentionPolicy: {
        completedDays: RETENTION_DAYS_COMPLETED,
        failedDays: RETENTION_DAYS_FAILED,
        maxBackups: MAX_BACKUPS_KEEP,
      },
    };

    await writeBackupAudit({
      session,
      action: "BACKUP_RETENTION_SUCCESS",
      entityId: "retention",
      request,
      metadata: { trigger: isCron ? "cron" : "manual", ...retention },
    });

    return NextResponse.json({ success: true, retention });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await writeBackupAudit({
      session,
      action: "BACKUP_RETENTION_FAILED",
      entityId: "retention",
      request,
      metadata: { trigger: isCron ? "cron" : "manual", dryRun },
      error,
    });
    console.error(`Backup retention failed: ${redactBackupSecretText(error)}`);
    return NextResponse.json(
      { error: "Retention cleanup failed" },
      { status: 500 },
    );
  }
}

// GET /api/backup/retention - get retention stats.
export async function GET() {
  try {
    await requirePermission("settings", "canRead", {
      minimumRole: "ADMIN",
      fallbackResources: ["audit_logs"],
    });

    const [total, completed, failed, inProgress] = await Promise.all([
      prisma.backupRecord.count(),
      prisma.backupRecord.count({ where: { status: "COMPLETED" } }),
      prisma.backupRecord.count({ where: { status: "FAILED" } }),
      prisma.backupRecord.count({ where: { status: "IN_PROGRESS" } }),
    ]);

    const oldestBackup = await prisma.backupRecord.findFirst({
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });

    const newestBackup = await prisma.backupRecord.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    return NextResponse.json({
      stats: {
        total,
        completed,
        failed,
        inProgress,
        oldestBackup: oldestBackup?.createdAt || null,
        newestBackup: newestBackup?.createdAt || null,
      },
      policy: {
        completedRetentionDays: RETENTION_DAYS_COMPLETED,
        failedRetentionDays: RETENTION_DAYS_FAILED,
        maxBackupsKept: MAX_BACKUPS_KEEP,
      },
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to get retention stats" },
      { status: 500 },
    );
  }
}
