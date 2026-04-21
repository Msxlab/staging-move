import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { verifyInternalAuth } from "@/lib/internal-secrets";

// Default retention: 30 days for completed backups, 7 days for failed
const RETENTION_DAYS_COMPLETED = 30;
const RETENTION_DAYS_FAILED = 7;
const MAX_BACKUPS_KEEP = 50; // Keep at most 50 recent backups regardless of age

// POST /api/backup/retention — run retention cleanup (manual or cron)
export async function POST(request: NextRequest) {
  try {
    // Allow both admin-triggered and cron-triggered.
    const isCron = verifyInternalAuth(request.headers.get("authorization"), "cron");
    if (!isCron) {
      await requirePermission("settings", "canDelete", { minimumRole: "SUPER_ADMIN" });
    }

    const now = new Date();
    const completedCutoff = new Date(now.getTime() - RETENTION_DAYS_COMPLETED * 24 * 60 * 60 * 1000);
    const failedCutoff = new Date(now.getTime() - RETENTION_DAYS_FAILED * 24 * 60 * 60 * 1000);

    // Delete old completed backups
    const deletedCompleted = await prisma.backupRecord.deleteMany({
      where: {
        status: "COMPLETED",
        createdAt: { lt: completedCutoff },
      },
    });

    // Delete old failed backups
    const deletedFailed = await prisma.backupRecord.deleteMany({
      where: {
        status: "FAILED",
        createdAt: { lt: failedCutoff },
      },
    });

    // Enforce max backup count — keep only the most recent N
    const totalBackups = await prisma.backupRecord.count();
    let deletedOverflow = 0;
    if (totalBackups > MAX_BACKUPS_KEEP) {
      const oldestToKeep = await prisma.backupRecord.findMany({
        orderBy: { createdAt: "desc" },
        skip: MAX_BACKUPS_KEEP,
        select: { id: true },
      });
      if (oldestToKeep.length > 0) {
        const result = await prisma.backupRecord.deleteMany({
          where: { id: { in: oldestToKeep.map((b: any) => b.id) } },
        });
        deletedOverflow = result.count;
      }
    }

    // Clean up old processed webhook events (older than 7 days)
    const webhookCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const deletedWebhooks = await prisma.processedWebhookEvent.deleteMany({
      where: { processedAt: { lt: webhookCutoff } },
    }).catch(() => ({ count: 0 }));

    return NextResponse.json({
      success: true,
      retention: {
        completedDeleted: deletedCompleted.count,
        failedDeleted: deletedFailed.count,
        overflowDeleted: deletedOverflow,
        webhookEventsDeleted: deletedWebhooks.count,
        retentionPolicy: {
          completedDays: RETENTION_DAYS_COMPLETED,
          failedDays: RETENTION_DAYS_FAILED,
          maxBackups: MAX_BACKUPS_KEEP,
        },
      },
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Backup retention failed:", error);
    return NextResponse.json({ error: "Retention cleanup failed" }, { status: 500 });
  }
}

// GET /api/backup/retention — get retention stats
export async function GET() {
  try {
    await requirePermission("settings", "canRead", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });

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
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Failed to get retention stats" }, { status: 500 });
  }
}
