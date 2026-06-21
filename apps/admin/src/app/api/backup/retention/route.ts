import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";
import { verifyInternalAuth } from "@/lib/internal-secrets";
import { redactBackupSecretText } from "@/lib/backup-metadata";
import {
  deleteBackupArchive,
  isOffsiteRetentionDeleteEnabled,
  parseBackupRecordMetadata,
  type BackupOffsiteMetadata,
} from "@/lib/backup-storage";
import { writeBackupAudit } from "@/lib/backup-audit";

// Default retention: 30 days for completed backups, 7 days for failed.
const RETENTION_DAYS_COMPLETED = 30;
const RETENTION_DAYS_FAILED = 7;
const MAX_BACKUPS_KEEP = 50;
// Cap the per-object result list embedded in the response/audit log so
// a large backlog can't bloat the audit row. Counts stay exact.
const MAX_OFFSITE_RESULTS_REPORTED = 50;

function noStoreJson(body: Record<string, unknown>, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  return NextResponse.json(body, { ...init, headers });
}

interface OffsiteCandidate {
  id: string;
  offsite: BackupOffsiteMetadata;
}

interface OffsiteObjectResult {
  backupId: string;
  objectKey: string | null;
  outcome: string;
  reason: string | null;
}

async function splitRetentionCandidates(
  records: Array<{ id: string; errorMessage: string | null }>,
) {
  const deletableIds: string[] = [];
  const offsiteCandidates: OffsiteCandidate[] = [];

  for (const record of records) {
    const metadata = parseBackupRecordMetadata(record.errorMessage);
    if (metadata.offsite?.status === "stored" && metadata.offsite.objectKey) {
      offsiteCandidates.push({ id: record.id, offsite: metadata.offsite });
    } else {
      deletableIds.push(record.id);
    }
  }

  return { deletableIds, offsiteCandidates };
}

async function collectRetentionCandidates(where: any) {
  const records = await prisma.backupRecord.findMany({
    where,
    select: { id: true, errorMessage: true },
  });
  return splitRetentionCandidates(records);
}

/**
 * Offsite deletion pass. For each expired record whose archive lives
 * offsite: delete the S3 object FIRST (exact stored key only — the
 * client refuses prefix/bucket mismatches and never lists), and only
 * remove the DB row once the object is confirmed gone. Any refusal or
 * failure leaves the row intact so the next run retries. Dry-run and
 * the disabled flag perform no deletes at all.
 */
async function processOffsiteCandidates(input: {
  candidates: OffsiteCandidate[];
  enabled: boolean;
  dryRun: boolean;
  processedIds: Set<string>;
}) {
  const results: OffsiteObjectResult[] = [];
  let rowsDeleted = 0;

  for (const candidate of input.candidates) {
    if (input.processedIds.has(candidate.id)) continue;
    input.processedIds.add(candidate.id);

    let result: OffsiteObjectResult;
    if (!input.enabled) {
      result = {
        backupId: candidate.id,
        objectKey: candidate.offsite.objectKey,
        outcome: "preserved_flag_disabled",
        reason: null,
      };
    } else if (input.dryRun) {
      result = {
        backupId: candidate.id,
        objectKey: candidate.offsite.objectKey,
        outcome: "dry_run_would_delete",
        reason: null,
      };
    } else {
      const deletion = await deleteBackupArchive({
        backupId: candidate.id,
        offsite: candidate.offsite,
      });
      if (deletion.outcome === "deleted") {
        try {
          await prisma.backupRecord.deleteMany({
            where: { id: candidate.id },
          });
          rowsDeleted += 1;
          result = {
            backupId: candidate.id,
            objectKey: deletion.objectKey,
            outcome: "deleted",
            reason: deletion.reason,
          };
        } catch (error) {
          // Object is gone but the row remains; the next run sees the
          // object as already absent (treated as deleted) and removes
          // the row then — self-healing, no orphaned offsite data.
          result = {
            backupId: candidate.id,
            objectKey: deletion.objectKey,
            outcome: "row_delete_failed",
            reason: redactBackupSecretText(error),
          };
        }
      } else {
        result = {
          backupId: candidate.id,
          objectKey: deletion.objectKey,
          outcome: deletion.outcome,
          reason: deletion.reason,
        };
      }
    }

    // Per-object result logging.
    console.info(
      `[BACKUP-RETENTION] offsite ${result.outcome} backup=${result.backupId} key=${result.objectKey ?? "<none>"}${
        result.reason ? ` reason=${redactBackupSecretText(result.reason)}` : ""
      }`,
    );
    results.push(result);
  }

  return { results, rowsDeleted };
}

// POST /api/backup/retention - run retention cleanup (manual or cron).
export async function POST(request: NextRequest) {
  let session: Awaited<ReturnType<typeof requirePermission>> | null = null;
  let isCron = false;
  let dryRun = false;

  try {
    isCron = verifyInternalAuth(request.headers.get("authorization"), "backup");
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

    if (!isCron && !dryRun) {
      const confirm = await requirePasswordConfirm(session!, body?.confirmPassword, {
        operation: "backup_retention_cleanup",
        requireMfa: true,
        mfaCode: typeof body?.mfaCode === "string" ? body.mfaCode : undefined,
        backupCode: typeof body?.backupCode === "string" ? body.backupCode : undefined,
        ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
        userAgent: request.headers.get("user-agent") ?? undefined,
      });
      if (!confirm.confirmed) {
        await writeBackupAudit({
          session,
          action: "BACKUP_RETENTION_FAILED",
          entityId: "retention",
          request,
          metadata: {
            trigger: "manual",
            dryRun,
            reasonCode: confirm.requiresMfa ? "mfa_required_or_invalid" : "step_up_failed",
            requiresMfa: Boolean(confirm.requiresMfa),
          },
          error: confirm.error || "backup retention step-up failed",
        });
        return noStoreJson(
          {
            error: confirm.error || "Password and MFA confirmation required",
            requiresPassword: true,
            requiresMfa: confirm.requiresMfa || undefined,
          },
          { status: confirm.rateLimited ? 429 : 403 },
        );
      }
    }

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

    // The offsite delete flag defaults to false; the owner opts in via
    // Runtime Config (BACKUP_RETENTION_DELETE_OFFSITE=true). When off,
    // offsite-stored records are preserved exactly as before.
    const offsiteDeleteEnabled = await isOffsiteRetentionDeleteEnabled();
    const processedOffsiteIds = new Set<string>();
    const offsiteResults: OffsiteObjectResult[] = [];
    let offsiteRowsDeleted = 0;

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

    const expiredOffsitePass = await processOffsiteCandidates({
      candidates: [
        ...completedCandidates.offsiteCandidates,
        ...failedCandidates.offsiteCandidates,
      ],
      enabled: offsiteDeleteEnabled,
      dryRun,
      processedIds: processedOffsiteIds,
    });
    offsiteResults.push(...expiredOffsitePass.results);
    offsiteRowsDeleted += expiredOffsitePass.rowsDeleted;

    const totalBackups = await prisma.backupRecord.count();
    let overflowDeleted = 0;
    let overflowCandidates = {
      deletableIds: [] as string[],
      offsiteCandidates: [] as OffsiteCandidate[],
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
      const overflowOffsitePass = await processOffsiteCandidates({
        candidates: overflowCandidates.offsiteCandidates,
        enabled: offsiteDeleteEnabled,
        dryRun,
        processedIds: processedOffsiteIds,
      });
      offsiteResults.push(...overflowOffsitePass.results);
      offsiteRowsDeleted += overflowOffsitePass.rowsDeleted;
    }

    const offsiteRefused = offsiteResults.filter(
      (result) => result.outcome === "refused",
    ).length;
    const offsiteFailed = offsiteResults.filter(
      (result) =>
        result.outcome === "failed" || result.outcome === "row_delete_failed",
    ).length;

    const retention = {
      dryRun,
      completedDeleted,
      failedDeleted,
      overflowDeleted,
      completedCandidates: completedCandidates.deletableIds.length,
      failedCandidates: failedCandidates.deletableIds.length,
      overflowCandidates: overflowCandidates.deletableIds.length,
      offsiteRecordsPreserved: offsiteResults.length - offsiteRowsDeleted,
      offsiteCleanup: !offsiteDeleteEnabled
        ? "disabled_metadata_preserved"
        : dryRun
          ? "dry_run_no_deletes"
          : "enabled",
      offsiteDelete: {
        enabled: offsiteDeleteEnabled,
        candidates: offsiteResults.length,
        deleted: offsiteRowsDeleted,
        refused: offsiteRefused,
        failed: offsiteFailed,
        results: offsiteResults.slice(0, MAX_OFFSITE_RESULTS_REPORTED),
        resultsTruncated: offsiteResults.length > MAX_OFFSITE_RESULTS_REPORTED,
      },
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
