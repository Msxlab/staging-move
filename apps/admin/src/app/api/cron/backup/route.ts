import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createBackupArchive } from "@/lib/backup-archive";
import { BACKUP_TABLE_ORDER } from "@/lib/backup-tables";
import { serializeBackupRecordMetadata, uploadBackupArchive } from "@/lib/backup-storage";
import { encryptBackup, signBackup } from "@/lib/shared-encryption";
import { verifyInternalAuth } from "@/lib/internal-secrets";
import {
  BackupPolicyError,
  getBackupArchivePolicy,
  requireArchiveProtected,
  requireBackupCrypto,
  requireOffsiteStored,
} from "@/lib/backup-policy";

const BACKUP_TABLE_FETCHERS = {
  users: () => prisma.user.findMany(),
  profiles: () => prisma.profile.findMany(),
  providers: () => prisma.serviceProvider.findMany(),
  providerCoverages: () => prisma.serviceProviderCoverage.findMany(),
  addresses: () => prisma.address.findMany(),
  services: () => prisma.service.findMany(),
  movingPlans: () => prisma.movingPlan.findMany(),
  budgets: () => prisma.budget.findMany(),
  subscriptions: () => prisma.subscription.findMany(),
  notifications: () => prisma.notification.findMany(),
  auditLogs: () => prisma.auditLog.findMany(),
} as const;

// POST /api/cron/backup — automated daily backup via cron
// Protected by CRON_SECRET. Call from Vercel Cron or external scheduler.
export async function POST(request: NextRequest) {
  let backupId: string | null = null;
  if (!verifyInternalAuth(request.headers.get("authorization"), "cron")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const archivePolicy = getBackupArchivePolicy();
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
      }
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
