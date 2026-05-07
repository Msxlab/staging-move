import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createBackupArchive } from "@/lib/backup-archive";
import {
  BACKUP_TABLE_ORDER,
  fetchAllRecords,
  MAX_BACKUP_ROWS_PER_TABLE,
} from "@/lib/backup-tables";
import { serializeBackupRecordMetadata, uploadBackupArchive } from "@/lib/backup-storage";
import { encryptBackup, signBackup } from "@/lib/shared-encryption";
import { verifyInternalAuth } from "@/lib/internal-secrets";
import { dispatchAlert } from "@/lib/alert-dispatcher";
import {
  BackupPolicyError,
  evaluateBackupArchiveSize,
  getBackupArchivePolicy,
  requireArchiveProtected,
  requireBackupCrypto,
  requireOffsiteStored,
} from "@/lib/backup-policy";
import {
  BackupRunLockError,
  acquireBackupRunLock,
  markBackupRunFailed,
} from "@/lib/backup-lock";
import {
  getBackupRuntimeMetadata,
  redactBackupSecretText,
} from "@/lib/backup-metadata";

const STALE_BACKUP_ALERT_MS = 24 * 60 * 60 * 1000;

async function dispatchBackupAlert(type: string, details: string) {
  await Promise.resolve(dispatchAlert(type, "CRITICAL", "cron", details)).catch(() => null);
}

// POST /api/cron/backup — automated daily backup via cron
// Protected by CRON_SECRET. In production compose this is wired by
// docker/ofelia.ini's "admin-backup" job against the admin container;
// apps/web/vercel.json does not schedule this admin-only endpoint.
export async function POST(request: NextRequest) {
  let backupId: string | null = null;
  if (!verifyInternalAuth(request.headers.get("authorization"), "cron")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const archivePolicy = getBackupArchivePolicy();
    const latestCompletedBackup = await prisma.backupRecord.findFirst({
      where: { status: "COMPLETED", completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      select: { id: true, completedAt: true },
    });
    if (
      latestCompletedBackup?.completedAt &&
      Date.now() - latestCompletedBackup.completedAt.getTime() > STALE_BACKUP_ALERT_MS
    ) {
      await dispatchBackupAlert(
        "BACKUP_STALE",
        `Latest completed backup ${latestCompletedBackup.id} is older than 24 hours.`,
      );
    }

    // Create the BackupRecord as the shared manual/cron lock. A second
    // backup run loses this DB-backed race and exits before reading data.
    const backup = await acquireBackupRunLock({
      prismaClient: prisma as any,
      data: {
        type: "FULL",
        status: "IN_PROGRESS",
        format: "JSON",
        tables: JSON.stringify(BACKUP_TABLE_ORDER),
        createdBy: "CRON",
      },
    });
    backupId = backup.id;
    requireBackupCrypto(archivePolicy);

    // Collect data from all tables. Cron and manual backup share the
    // same paginated fetcher so both observe the same per-table ceiling
    // and label PARTIAL when truncation occurs.
    const backupData: Record<string, any[]> = {};
    const selectedTables = BACKUP_TABLE_ORDER;
    const tableCounts: Record<string, number> = {};
    const failedTables: string[] = [];
    const truncatedTables: string[] = [];
    let totalRecords = 0;

    for (const tableName of selectedTables) {
      try {
        const result = await fetchAllRecords(prisma as any, tableName);
        backupData[tableName] = result.records;
        tableCounts[tableName] = result.fetched;
        totalRecords += result.fetched;
        if (result.truncated) truncatedTables.push(tableName);
      } catch (err) {
        console.error(
          `[CRON-BACKUP] Failed to fetch ${tableName}: ${redactBackupSecretText(err)}`,
        );
        backupData[tableName] = [];
        tableCounts[tableName] = 0;
        failedTables.push(tableName);
      }
    }

    // A per-table fetch failure used to be silently absorbed: the table
    // ended up empty in the archive but the backup was still marked
    // COMPLETED, so ops had no way to learn that (e.g.) the audit log or
    // the admin user table was missing from a "successful" backup. Page
    // the operator with the failed table list so the next restore drill
    // can be retargeted before the gap rolls past the 30-day retention.
    if (failedTables.length > 0) {
      await dispatchBackupAlert(
        "BACKUP_PARTIAL_FAILURE",
        `Backup ${backup.id} completed with empty data for tables: ${failedTables.join(", ")}.`,
      );
    }
    if (truncatedTables.length > 0) {
      await dispatchBackupAlert(
        "BACKUP_TRUNCATED",
        `Backup ${backup.id} hit the per-table ceiling of ${MAX_BACKUP_ROWS_PER_TABLE} for tables: ${truncatedTables.join(", ")}. Archive marked PARTIAL.`,
      );
    }
    const effectiveType =
      truncatedTables.length > 0 || failedTables.length > 0 ? "PARTIAL" : "FULL";
    const runtimeMetadata = getBackupRuntimeMetadata();

    const createdAt = new Date();
    const createdAtIso = createdAt.toISOString();
    const jsonContent = JSON.stringify({
      metadata: {
        createdAt: createdAtIso,
        createdBy: "CRON",
        type: effectiveType,
        requestedType: "FULL",
        format: "JSON",
        tables: selectedTables,
        tableCount: selectedTables.length,
        totalRecords,
        truncatedTables,
        failedTables,
        maxRowsPerTable: MAX_BACKUP_ROWS_PER_TABLE,
        environment: runtimeMetadata.environment,
        compatibility: runtimeMetadata.compatibility,
      },
      data: backupData,
    }, null, 2);

    // Encrypt backup
    const encrypted = encryptBackup(jsonContent);
    const signature = signBackup(jsonContent);
    requireArchiveProtected({
      policy: archivePolicy,
      encrypted: Boolean(encrypted),
      signed: Boolean(signature),
    });
    const fileName = `backup-${createdAtIso.split("T")[0]}-auto-${backup.id}.json`;
    const archive = createBackupArchive({
      metadata: {
        backupId: backup.id,
        fileName,
        createdAt: createdAtIso,
        createdBy: "CRON",
        type: effectiveType,
        format: "JSON",
        tables: selectedTables,
        tableCount: selectedTables.length,
        totalRecords,
        tableCounts,
        truncatedTables,
        failedTables,
        maxRowsPerTable: MAX_BACKUP_ROWS_PER_TABLE,
        environment: runtimeMetadata.environment,
        compatibility: runtimeMetadata.compatibility,
      },
      rawContent: jsonContent,
      signature,
      encrypted,
    });
    const archiveBody = JSON.stringify(archive, null, 2);

    // Calculate file size
    const fileSize = Buffer.byteLength(archiveBody, "utf8");
    const sizeEvaluation = evaluateBackupArchiveSize(fileSize);
    const offsite = await uploadBackupArchive({
      backupId: backup.id,
      fileName,
      archiveBody,
    });
    requireOffsiteStored({ policy: archivePolicy, offsite });
    const completedAt = new Date();
    const metadata = serializeBackupRecordMetadata({
      offsite,
      archive: {
        encrypted: Boolean(encrypted),
        signature: Boolean(signature),
        totalRecords,
        tableCounts,
        tableCount: selectedTables.length,
        archiveSizeWarning: sizeEvaluation.warning,
        truncatedTables: truncatedTables.length > 0 ? truncatedTables : undefined,
        failedTables: failedTables.length > 0 ? failedTables : undefined,
        maxRowsPerTable: MAX_BACKUP_ROWS_PER_TABLE,
        environment: runtimeMetadata.environment,
        compatibility: runtimeMetadata.compatibility,
      },
    });

    // Update backup record. The `type` column is set to PARTIAL whenever
    // any table was truncated or failed, so dashboards never present a
    // truncated archive as FULL.
    await prisma.backupRecord.update({
      where: { id: backup.id },
      data: {
        type: effectiveType,
        status: "COMPLETED",
        recordCount: totalRecords,
        fileSize,
        completedAt,
        fileName,
        errorMessage: metadata,
      },
    });

    // Run retention cleanup
    const retentionCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const cleaned = await prisma.backupRecord.deleteMany({
      where: {
        status: "COMPLETED",
        createdAt: { lt: retentionCutoff },
        createdBy: "CRON",
      },
    });

    return NextResponse.json({
      success: true,
      backup: {
        id: backup.id,
        totalRecords,
        fileSize,
        encrypted: Boolean(encrypted),
        signed: Boolean(signature),
        offsite,
        archivePolicy,
        archiveSizeWarning: sizeEvaluation.warning,
        tables: Object.keys(backupData).length,
        failedTables,
        truncatedTables,
      },
      retention: { cleaned: cleaned.count },
    });
  } catch (error) {
    if (backupId) {
      await markBackupRunFailed({
        prismaClient: prisma as any,
        backupId,
        error,
      });
    }
    if (error instanceof BackupRunLockError) {
      return NextResponse.json(
        {
          error: error.message,
          code: "BACKUP_ALREADY_RUNNING",
          activeBackupId: error.activeBackupId,
        },
        { status: 409 },
      );
    }
    const safeError = redactBackupSecretText(error);
    await dispatchBackupAlert(
      "BACKUP_FAILED",
      safeError.slice(0, 500) || "Scheduled backup failed.",
    );
    if (error instanceof BackupPolicyError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error(`[CRON-BACKUP] Backup failed: ${safeError}`);
    return NextResponse.json({ error: "Backup failed" }, { status: 500 });
  }
}
