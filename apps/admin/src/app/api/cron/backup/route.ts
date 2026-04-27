import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createBackupArchive } from "@/lib/backup-archive";
import { BACKUP_TABLE_ORDER } from "@/lib/backup-tables";
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

const BACKUP_TABLE_FETCHERS = {
  users: () => prisma.user.findMany({ take: 50000 }),
  oauthAccounts: () => prisma.oAuthAccount.findMany({ take: 50000 }),
  profiles: () => prisma.profile.findMany({ take: 50000 }),
  dataConsents: () => prisma.dataConsent.findMany({ take: 50000 }),
  providers: () => prisma.serviceProvider.findMany({ take: 50000 }),
  providerCoverages: () => prisma.serviceProviderCoverage.findMany({ take: 50000 }),
  addresses: () => prisma.address.findMany({ take: 50000 }),
  services: () => prisma.service.findMany({ take: 50000 }),
  movingPlans: () => prisma.movingPlan.findMany({ take: 50000 }),
  customProviders: () => prisma.userCustomProvider.findMany({ take: 50000 }),
  moveTasks: () => prisma.moveTask.findMany({ take: 50000 }),
  budgets: () => prisma.budget.findMany({ take: 50000 }),
  subscriptions: () => prisma.subscription.findMany({ take: 50000 }),
  notifications: () => prisma.notification.findMany({ take: 50000 }),
  emailLogs: () => prisma.emailLog.findMany({ take: 50000 }),
  auditLogs: () => prisma.auditLog.findMany({ take: 50000 }),
  providerGovernanceIssues: () => prisma.providerGovernanceIssue.findMany({ take: 50000 }),
  adminUsers: () => prisma.adminUser.findMany({ take: 50000 }),
  adminPermissions: () => prisma.adminPermission.findMany({ take: 50000 }),
  adminLoginLogs: () => prisma.adminLoginLog.findMany({ take: 50000 }),
  adminAuditLogs: () => prisma.adminAuditLog.findMany({ take: 50000 }),
} as const;

const STALE_BACKUP_ALERT_MS = 24 * 60 * 60 * 1000;

async function dispatchBackupAlert(type: string, details: string) {
  await Promise.resolve(dispatchAlert(type, "CRITICAL", "cron", details)).catch(() => null);
}

// POST /api/cron/backup — automated daily backup via cron
// Protected by CRON_SECRET. Call from Vercel Cron or external scheduler.
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

    // Create backup record
    const backup = await prisma.backupRecord.create({
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

    // Collect data from all tables
    const backupData: Record<string, any[]> = {};
    const selectedTables = BACKUP_TABLE_ORDER;
    const tableCounts: Record<string, number> = {};
    const failedTables: string[] = [];
    let totalRecords = 0;

    for (const tableName of selectedTables) {
      try {
        const fetchRecords = BACKUP_TABLE_FETCHERS[tableName as keyof typeof BACKUP_TABLE_FETCHERS];
        if (!fetchRecords) continue;
        const records = await fetchRecords();
        backupData[tableName] = records;
        tableCounts[tableName] = records.length;
        totalRecords += records.length;
      } catch (err) {
        console.error(`[CRON-BACKUP] Failed to fetch ${tableName}:`, err);
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

    const createdAt = new Date();
    const createdAtIso = createdAt.toISOString();
    const jsonContent = JSON.stringify({
      metadata: {
        createdAt: createdAtIso,
        createdBy: "CRON",
        type: "FULL",
        format: "JSON",
        tables: selectedTables,
        totalRecords,
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
        type: "FULL",
        format: "JSON",
        tables: selectedTables,
        totalRecords,
        tableCounts,
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
        archiveSizeWarning: sizeEvaluation.warning,
      },
    });

    // Update backup record
    await prisma.backupRecord.update({
      where: { id: backup.id },
      data: {
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
      },
      retention: { cleaned: cleaned.count },
    });
  } catch (error) {
    if (backupId) {
      await prisma.backupRecord.update({
        where: { id: backupId },
        data: {
          status: "FAILED",
          errorMessage: serializeBackupRecordMetadata({ error: error instanceof Error ? error.message : "Backup failed" }),
        },
      }).catch(() => null);
    }
    await dispatchBackupAlert(
      "BACKUP_FAILED",
      error instanceof Error ? error.message.slice(0, 500) : "Scheduled backup failed.",
    );
    if (error instanceof BackupPolicyError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error("[CRON-BACKUP] Backup failed:", error);
    return NextResponse.json({ error: "Backup failed" }, { status: 500 });
  }
}
