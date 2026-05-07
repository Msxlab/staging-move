import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";
import { createBackupArchive } from "@/lib/backup-archive";
import {
  BACKUP_TABLE_ORDER,
  BACKUP_TABLES,
  fetchAllRecords,
  MAX_BACKUP_ROWS_PER_TABLE,
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
import {
  BackupRunLockError,
  acquireBackupRunLock,
  markBackupRunFailed,
} from "@/lib/backup-lock";
import {
  getCurrentBackupEnvironmentMetadata,
  getBackupRuntimeMetadata,
  redactBackupSecretText,
} from "@/lib/backup-metadata";
import {
  getProductionRestoreConfirmationPhrase,
  getReplaceConfirmationPhrase,
} from "@/lib/backup-restore-guard";

// Per-table count helpers. Record fetching is centralized in
// `fetchAllRecords` from backup-tables.ts so the manual and cron paths
// share the same paginated, ceiling-aware logic. Counts stay here
// because they are model-specific Prisma calls and the registry is
// intentionally framework-agnostic.
const BACKUP_TABLE_COUNTS: Record<string, () => Promise<number>> = {
  users: () => prisma.user.count(),
  oauthAccounts: () => prisma.oAuthAccount.count(),
  profiles: () => prisma.profile.count(),
  dataConsents: () => prisma.dataConsent.count(),
  providers: () => prisma.serviceProvider.count(),
  providerLogoCandidates: () => prisma.providerLogoCandidate.count(),
  providerCoverages: () => prisma.serviceProviderCoverage.count(),
  addresses: () => prisma.address.count(),
  services: () => prisma.service.count(),
  movingPlans: () => prisma.movingPlan.count(),
  customProviders: () => prisma.userCustomProvider.count(),
  budgets: () => prisma.budget.count(),
  subscriptions: () => prisma.subscription.count(),
  auditLogs: () => prisma.auditLog.count(),
  notifications: () => prisma.notification.count(),
  emailLogs: () => prisma.emailLog.count(),
  moveTasks: () => prisma.moveTask.count(),
  providerGovernanceIssues: () => prisma.providerGovernanceIssue.count(),
  adminUsers: () => prisma.adminUser.count(),
  adminPermissions: () => prisma.adminPermission.count(),
  adminLoginLogs: () => prisma.adminLoginLog.count(),
  adminAuditLogs: () => prisma.adminAuditLog.count(),
};

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
    const restoreEnvironment = getCurrentBackupEnvironmentMetadata();
    const databaseFingerprintPrefix =
      restoreEnvironment.databaseFingerprint.slice(0, 12);

    // Table stats
    const stats: Record<string, number> = {};
    for (const key of BACKUP_TABLE_ORDER) {
      try {
        const counter = BACKUP_TABLE_COUNTS[key];
        stats[key] = counter ? await counter() : 0;
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
      restoreTarget: {
        environment: {
          name: restoreEnvironment.name,
          nodeEnv: restoreEnvironment.nodeEnv,
          appEnv: restoreEnvironment.appEnv,
          vercelEnv: restoreEnvironment.vercelEnv,
          digitalOceanAppIdPresent:
            restoreEnvironment.digitalOceanAppIdPresent,
          databaseFingerprintPrefix,
        },
        confirmations: {
          targetEnvironment: restoreEnvironment.name,
          replaceConfirmation:
            getReplaceConfirmationPhrase(restoreEnvironment),
          productionRestoreConfirmation:
            getProductionRestoreConfirmationPhrase(restoreEnvironment),
        },
      },
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error(`Failed to fetch backups: ${redactBackupSecretText(error)}`);
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

    // Create the BackupRecord as the shared manual/cron lock. A second
    // backup run loses this DB-backed race and exits before reading data.
    const backup = await acquireBackupRunLock({
      prismaClient: prisma as any,
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

    // Collect data via the central paginated fetcher. Any table that
    // hits the per-table ceiling is recorded in `truncatedTables` so
    // the resulting BackupRecord can be flagged PARTIAL — silent
    // truncation past 50k rows was the bug this fixes.
    const backupData: Record<string, any[]> = {};
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
          `Failed to backup table ${tableName}: ${redactBackupSecretText(err)}`,
        );
        backupData[tableName] = [];
        tableCounts[tableName] = 0;
        failedTables.push(tableName);
      }
    }
    // If any table was truncated by the per-table ceiling, downgrade
    // the type label so the operator sees PARTIAL instead of FULL.
    const effectiveType =
      truncatedTables.length > 0 || failedTables.length > 0
        ? "PARTIAL"
        : type;
    const runtimeMetadata = getBackupRuntimeMetadata();

    // Create JSON content. The archive metadata reflects the EFFECTIVE
    // type — if any table was truncated by the per-table ceiling, the
    // archive must label itself PARTIAL so a downstream restore drill
    // can't be misled by the "FULL" in the filename.
    const createdAt = new Date();
    const createdAtIso = createdAt.toISOString();
    const content = JSON.stringify(
      {
        metadata: {
          createdAt: createdAtIso,
          createdBy: session.email,
          type: effectiveType,
          requestedType: type,
          format,
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
      },
      null,
      2,
    );

    const fileName = `backup-${effectiveType.toLowerCase()}-${createdAtIso.slice(0, 10)}-${backup.id}.json`;

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
        type: effectiveType,
        format,
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
        tableCount: selectedTables.length,
        archiveSizeWarning: sizeEvaluation.warning,
        truncatedTables: truncatedTables.length > 0 ? truncatedTables : undefined,
        failedTables: failedTables.length > 0 ? failedTables : undefined,
        maxRowsPerTable: MAX_BACKUP_ROWS_PER_TABLE,
        environment: runtimeMetadata.environment,
        compatibility: runtimeMetadata.compatibility,
      },
    });

    // Update backup record. The `type` column is rewritten to the
    // effective value so a list of historical backups doesn't show a
    // truncated archive as "FULL".
    await prisma.backupRecord.update({
      where: { id: backup.id },
      data: {
        type: effectiveType,
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
          type: effectiveType,
          requestedType: type,
          truncatedTables,
          failedTables,
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
            type: effectiveType,
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
        truncatedTables,
        failedTables,
        partial: truncatedTables.length > 0 || failedTables.length > 0,
      },
      { status: 201 },
    );
  } catch (error: any) {
    if (backupId) {
      await markBackupRunFailed({
        prismaClient: prisma as any,
        backupId,
        error,
      });
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
    console.error(`Failed to create backup: ${redactBackupSecretText(error)}`);
    return NextResponse.json(
      { error: "Failed to create backup" },
      { status: 500 },
    );
  }
}
