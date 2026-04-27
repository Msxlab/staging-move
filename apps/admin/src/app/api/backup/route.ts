import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";
import { createBackupArchive } from "@/lib/backup-archive";
import {
  BACKUP_TABLE_ORDER,
  BACKUP_TABLES,
  normalizeBackupTables,
} from "@/lib/backup-tables";
import {
  getBackupStorageSummary,
  parseBackupRecordMetadata,
  serializeBackupRecordMetadata,
  uploadBackupArchive,
} from "@/lib/backup-storage";
import {
  BackupPolicyError,
  evaluateBackupArchiveSize,
  getBackupArchivePolicy,
  requireArchiveProtected,
  requireBackupCrypto,
  requireOffsiteStored,
  shouldReturnBrowserDownloadFallback,
} from "@/lib/backup-policy";
import { encryptBackup, signBackup } from "@/lib/shared-encryption";

const BACKUP_TABLE_OPS = {
  users: {
    count: () => prisma.user.count(),
    findRecords: () => prisma.user.findMany({ take: 50000 }),
  },
  oauthAccounts: {
    count: () => prisma.oAuthAccount.count(),
    findRecords: () => prisma.oAuthAccount.findMany({ take: 50000 }),
  },
  profiles: {
    count: () => prisma.profile.count(),
    findRecords: () => prisma.profile.findMany({ take: 50000 }),
  },
  dataConsents: {
    count: () => prisma.dataConsent.count(),
    findRecords: () => prisma.dataConsent.findMany({ take: 50000 }),
  },
  providers: {
    count: () => prisma.serviceProvider.count(),
    findRecords: () => prisma.serviceProvider.findMany({ take: 50000 }),
  },
  providerLogoCandidates: {
    count: () => prisma.providerLogoCandidate.count(),
    findRecords: () => prisma.providerLogoCandidate.findMany({ take: 50000 }),
  },
  providerCoverages: {
    count: () => prisma.serviceProviderCoverage.count(),
    findRecords: () => prisma.serviceProviderCoverage.findMany({ take: 50000 }),
  },
  addresses: {
    count: () => prisma.address.count(),
    findRecords: () => prisma.address.findMany({ take: 50000 }),
  },
  services: {
    count: () => prisma.service.count(),
    findRecords: () => prisma.service.findMany({ take: 50000 }),
  },
  movingPlans: {
    count: () => prisma.movingPlan.count(),
    findRecords: () => prisma.movingPlan.findMany({ take: 50000 }),
  },
  customProviders: {
    count: () => prisma.userCustomProvider.count(),
    findRecords: () => prisma.userCustomProvider.findMany({ take: 50000 }),
  },
  budgets: {
    count: () => prisma.budget.count(),
    findRecords: () => prisma.budget.findMany({ take: 50000 }),
  },
  subscriptions: {
    count: () => prisma.subscription.count(),
    findRecords: () => prisma.subscription.findMany({ take: 50000 }),
  },
  auditLogs: {
    count: () => prisma.auditLog.count(),
    findRecords: () => prisma.auditLog.findMany({ take: 50000 }),
  },
  notifications: {
    count: () => prisma.notification.count(),
    findRecords: () => prisma.notification.findMany({ take: 50000 }),
  },
  emailLogs: {
    count: () => prisma.emailLog.count(),
    findRecords: () => prisma.emailLog.findMany({ take: 50000 }),
  },
  moveTasks: {
    count: () => prisma.moveTask.count(),
    findRecords: () => prisma.moveTask.findMany({ take: 50000 }),
  },
  providerGovernanceIssues: {
    count: () => prisma.providerGovernanceIssue.count(),
    findRecords: () => prisma.providerGovernanceIssue.findMany({ take: 50000 }),
  },
  adminUsers: {
    count: () => prisma.adminUser.count(),
    findRecords: () => prisma.adminUser.findMany({ take: 50000 }),
  },
  adminPermissions: {
    count: () => prisma.adminPermission.count(),
    findRecords: () => prisma.adminPermission.findMany({ take: 50000 }),
  },
  adminLoginLogs: {
    count: () => prisma.adminLoginLog.count(),
    findRecords: () => prisma.adminLoginLog.findMany({ take: 50000 }),
  },
  adminAuditLogs: {
    count: () => prisma.adminAuditLog.count(),
    findRecords: () => prisma.adminAuditLog.findMany({ take: 50000 }),
  },
} as const;

function normalizeBackupRecord(backup: any, createdByLabel?: string) {
  const metadata = parseBackupRecordMetadata(backup.errorMessage);
  return {
    ...backup,
    errorMessage: metadata.error || null,
    archive: metadata.archive || null,
    offsite: metadata.offsite || null,
    createdByLabel: createdByLabel || backup.createdBy,
  };
}

// GET /api/backup - list backup records
export async function GET() {
  try {
    await requirePermission("settings", "canRead", {
      minimumRole: "ADMIN",
      fallbackResources: ["audit_logs"],
    });
    const backups = await prisma.backupRecord.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const creatorIds: string[] = [];
    for (const backup of backups as Array<{ createdBy?: unknown }>) {
      if (
        typeof backup.createdBy === "string" &&
        backup.createdBy !== "CRON" &&
        !creatorIds.includes(backup.createdBy)
      ) {
        creatorIds.push(backup.createdBy);
      }
    }
    const adminUsers =
      creatorIds.length > 0
        ? await prisma.adminUser.findMany({
            where: { id: { in: creatorIds } },
            select: { id: true, email: true, firstName: true, lastName: true },
          })
        : [];
    const creatorLabels = new Map(
      adminUsers.map((admin: { id: string; email: string | null }) => [
        admin.id,
        admin.email,
      ]),
    );
    const storage = await getBackupStorageSummary();
    const archivePolicy = getBackupArchivePolicy();

    // Table stats
    const stats: Record<string, number> = {};
    for (const key of BACKUP_TABLE_ORDER) {
      try {
        const tableOps = BACKUP_TABLE_OPS[key as keyof typeof BACKUP_TABLE_OPS];
        stats[key] = tableOps ? await tableOps.count() : 0;
      } catch {
        stats[key] = 0;
      }
    }

    return NextResponse.json({
      backups: backups.map((backup: any) =>
        normalizeBackupRecord(
          backup,
          backup.createdBy === "CRON"
            ? "CRON"
            : creatorLabels.get(backup.createdBy) || backup.createdBy,
        ),
      ),
      stats,
      tables: BACKUP_TABLES,
      storage,
      archivePolicy,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to fetch backups:", error);
    return NextResponse.json(
      { error: "Failed to fetch backups" },
      { status: 500 },
    );
  }
}

// POST /api/backup - create a new backup
export async function POST(request: NextRequest) {
  let backupId: string | null = null;
  try {
    const session = await requirePermission("settings", "canCreate", {
      minimumRole: "ADMIN",
      fallbackResources: ["audit_logs"],
    });
    const body = await request.json();
    const {
      type = "FULL",
      tables = [],
      format = "JSON",
      confirmPassword,
    } = body;
    const archivePolicy = getBackupArchivePolicy();

    const requestedTables =
      Array.isArray(tables) && tables.length > 0 ? tables : BACKUP_TABLE_ORDER;
    const selectedTables = normalizeBackupTables(requestedTables);
    if (selectedTables.length === 0) {
      return NextResponse.json(
        { error: "No valid tables were selected for backup." },
        { status: 400 },
      );
    }

    // Step-up auth: backup contains all system data
    const confirm = await requirePasswordConfirm(session, confirmPassword);
    if (!confirm.confirmed) {
      return NextResponse.json(
        { error: confirm.error, requiresPassword: true },
        { status: 403 },
      );
    }

    // Create backup record
    const backup = await prisma.backupRecord.create({
      data: {
        type,
        status: "IN_PROGRESS",
        format,
        tables: JSON.stringify(selectedTables),
        createdBy: session.adminId,
      },
    });
    backupId = backup.id;
    requireBackupCrypto(archivePolicy);

    // Collect data
    const backupData: Record<string, any[]> = {};
    const tableCounts: Record<string, number> = {};
    let totalRecords = 0;

    for (const tableName of selectedTables) {
      const tableOps =
        BACKUP_TABLE_OPS[tableName as keyof typeof BACKUP_TABLE_OPS];
      if (!tableOps) continue;
      try {
        const records = await tableOps.findRecords();
        backupData[tableName] = records;
        tableCounts[tableName] = records.length;
        totalRecords += records.length;
      } catch (err) {
        console.error(`Failed to backup table ${tableName}:`, err);
        backupData[tableName] = [];
        tableCounts[tableName] = 0;
      }
    }

    // Create JSON content
    const createdAt = new Date();
    const createdAtIso = createdAt.toISOString();
    const content = JSON.stringify(
      {
        metadata: {
          createdAt: createdAtIso,
          createdBy: session.email,
          type,
          format,
          tables: selectedTables,
          totalRecords,
        },
        data: backupData,
      },
      null,
      2,
    );

    const fileName = `backup-${type.toLowerCase()}-${createdAtIso.slice(0, 10)}-${backup.id}.json`;

    // Encrypt backup data with AES-256-GCM
    const encrypted = encryptBackup(content);
    const signature = signBackup(content);
    requireArchiveProtected({
      policy: archivePolicy,
      encrypted: Boolean(encrypted),
      signed: Boolean(signature),
    });
    const archive = createBackupArchive({
      metadata: {
        backupId: backup.id,
        fileName,
        createdAt: createdAtIso,
        createdBy: session.email,
        type,
        format,
        tables: selectedTables,
        totalRecords,
        tableCounts,
      },
      rawContent: content,
      signature,
      encrypted,
    });
    const downloadData = JSON.stringify(archive, null, 2);
    const fileSize = Buffer.byteLength(downloadData, "utf-8");
    const sizeEvaluation = evaluateBackupArchiveSize(fileSize);
    const offsite = await uploadBackupArchive({
      backupId: backup.id,
      fileName,
      archiveBody: downloadData,
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
        fileName,
        fileSize,
        recordCount: totalRecords,
        completedAt,
        errorMessage: metadata,
      },
    });

    // Audit log
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "CREATE_BACKUP",
        entityType: "BackupRecord",
        entityId: backup.id,
        changes: JSON.stringify({
          type,
          tables: selectedTables,
          recordCount: totalRecords,
          fileSize,
          isEncrypted: !!encrypted,
          signature: !!signature,
          offsiteStatus: offsite.status,
          offsiteLocation: offsite.location,
          archiveSizeWarning: sizeEvaluation.warning,
        }),
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      },
    });

    const browserDownloadFallback = shouldReturnBrowserDownloadFallback({
      policy: archivePolicy,
      offsite,
    });

    return NextResponse.json(
      {
        backup: normalizeBackupRecord(
          {
            ...backup,
            status: "COMPLETED",
            fileName,
            fileSize,
            recordCount: totalRecords,
            completedAt,
            errorMessage: metadata,
          },
          session.email,
        ),
        downloadUrl:
          offsite.status === "stored"
            ? `/api/backup/${backup.id}/download`
            : undefined,
        downloadData: browserDownloadFallback ? downloadData : undefined,
        archivePolicy,
        isEncrypted: !!encrypted,
        offsite,
        archiveSizeWarning: sizeEvaluation.warning,
      },
      { status: 201 },
    );
  } catch (error: any) {
    if (backupId) {
      await prisma.backupRecord
        .update({
          where: { id: backupId },
          data: {
            status: "FAILED",
            errorMessage: serializeBackupRecordMetadata({
              error: error?.message || "Failed to create backup.",
            }),
          },
        })
        .catch(() => null);
    }
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (error instanceof BackupPolicyError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error("Failed to create backup:", error);
    return NextResponse.json(
      { error: "Failed to create backup" },
      { status: 500 },
    );
  }
}
