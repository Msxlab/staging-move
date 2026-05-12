import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";
import {
  BACKUP_TABLE_ORDER,
  BACKUP_TABLES,
} from "@/lib/backup-tables";
import {
  getBackupStorageSummary,
  parseBackupRecordMetadata,
} from "@/lib/backup-storage";
import {
  BackupPolicyError,
  getBackupArchivePolicy,
} from "@/lib/backup-policy";
import { BackupRunLockError } from "@/lib/backup-lock";
import {
  getCurrentBackupEnvironmentMetadata,
  redactBackupSecretText,
} from "@/lib/backup-metadata";
import {
  getProductionRestoreConfirmationPhrase,
  getReplaceConfirmationPhrase,
} from "@/lib/backup-restore-guard";
import { createBackupJob } from "@/lib/backup-job";
import { writeBackupAudit } from "@/lib/backup-audit";
import { getAuditRequestMeta } from "@/lib/audit";

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
  let session: Awaited<ReturnType<typeof requirePermission>> | null = null;
  try {
    session = await requirePermission("settings", "canRead", {
      minimumRole: "ADMIN",
      fallbackResources: ["audit_logs"],
    });
    const backups = await prisma.backupRecord.findMany({
      where: { NOT: { type: { startsWith: "RESTORE_" } } },
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

    const responseBody = {
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
    };
    await writeBackupAudit({
      session,
      action: "BACKUP_LIST",
      entityId: "list",
      metadata: { count: backups.length },
    });
    return NextResponse.json(responseBody);
  } catch (error: any) {
    if (session) {
      await writeBackupAudit({
        session,
        action: "BACKUP_LIST",
        entityId: "list",
        error,
      });
    }
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
  let session: Awaited<ReturnType<typeof requirePermission>> | null = null;
  try {
    session = await requirePermission("settings", "canCreate", {
      minimumRole: "SUPER_ADMIN",
    });
    const body = await request.json();
    const {
      type = "FULL",
      tables = [],
      format = "JSON",
      confirmPassword,
      mfaCode,
      backupCode,
    } = body;

    const confirm = await requirePasswordConfirm(session, confirmPassword, {
      operation: "backup_create",
      requireMfa: true,
      mfaCode: typeof mfaCode === "string" ? mfaCode : undefined,
      backupCode: typeof backupCode === "string" ? backupCode : undefined,
      ipAddress: getAuditRequestMeta(request).ipAddress,
      userAgent: getAuditRequestMeta(request).userAgent,
    });
    if (!confirm.confirmed) {
      await writeBackupAudit({
        session,
        action: "BACKUP_CREATE_FAILED",
        entityId: "create",
        request,
        metadata: { type, tables },
        error: confirm.error || "step-up failed",
      });
      return NextResponse.json(
        {
          error: confirm.error,
          requiresPassword: true,
          requiresMfa: confirm.requiresMfa,
        },
        { status: 403 },
      );
    }

    const result = await createBackupJob({
      actor: { adminId: session.adminId, email: session.email },
      type,
      tables,
      format,
      request,
    });
    await writeBackupAudit({
      session,
      action: "BACKUP_CREATE_SUCCESS",
      entityId: result.backup.id,
      request,
      metadata: {
        type: result.backup.type,
        requestedType: type,
        truncatedTables: result.truncatedTables,
        failedTables: result.failedTables,
        tables: result.selectedTables,
        recordCount: result.totalRecords,
        fileSize: result.fileSize,
        isEncrypted: result.encrypted,
        signature: result.signature,
        offsiteStatus: result.offsite.status,
        offsiteLocation: result.offsite.location,
        archiveSizeWarning: result.archiveSizeWarning,
      },
    });

    return NextResponse.json(
      {
        backup: normalizeBackupRecord(result.backup, session.email),
        downloadUrl:
          result.offsite.status === "stored"
            ? `/api/backup/${result.backup.id}/download`
            : undefined,
        downloadData: result.downloadData,
        archivePolicy: result.archivePolicy,
        isEncrypted: result.encrypted,
        offsite: result.offsite,
        archiveSizeWarning: result.archiveSizeWarning,
        truncatedTables: result.truncatedTables,
        failedTables: result.failedTables,
        partial: result.partial,
      },
      { status: 201 },
    );
  } catch (error: any) {
    if (session) {
      await writeBackupAudit({
        session,
        action: "BACKUP_CREATE_FAILED",
        entityId: "create",
        request,
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
    if (error?.message === "BACKUP_NO_VALID_TABLES") {
      return NextResponse.json(
        { error: "No valid tables were selected for backup." },
        { status: 400 },
      );
    }
    console.error(`Failed to create backup: ${redactBackupSecretText(error)}`);
    return NextResponse.json(
      { error: "Failed to create backup" },
      { status: 500 },
    );
  }
}
