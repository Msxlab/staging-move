import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { requirePermission, requirePasswordConfirm } from "@/lib/auth";
import { downloadBackupArchive, parseBackupRecordMetadata } from "@/lib/backup-storage";
import { redactBackupSecretText } from "@/lib/backup-metadata";

export async function GET() {
  return NextResponse.json(
    { error: "Password confirmation is required before downloading a backup archive.", requiresPassword: true },
    { status: 403 },
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Backup archives carry every encrypted/PII field in the DB. Force the
    // download gate to SUPER_ADMIN — a regular ADMIN with `settings.canRead`
    // can browse the backup list (metadata-only) but cannot pull the
    // archive bytes. Step-up below also requires MFA for SUPER_ADMINs that
    // have it enabled (which is mandatory for that role).
    const session = await requirePermission("settings", "canRead", { minimumRole: "SUPER_ADMIN", fallbackResources: ["audit_logs"] });
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const confirm = await requirePasswordConfirm(
      session,
      typeof body?.confirmPassword === "string" ? body.confirmPassword : undefined,
      {
        operation: "backup_download",
        requireMfa: true,
        mfaCode: typeof body?.mfaCode === "string" ? body.mfaCode : undefined,
        backupCode: typeof body?.backupCode === "string" ? body.backupCode : undefined,
      },
    );
    if (!confirm.confirmed) {
      return NextResponse.json({ error: confirm.error, requiresPassword: true }, { status: 403 });
    }

    const backup = await prisma.backupRecord.findUnique({ where: { id } });
    if (!backup) {
      return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }

    const metadata = parseBackupRecordMetadata(backup.errorMessage);
    if (!metadata.offsite || metadata.offsite.status !== "stored" || !metadata.offsite.objectKey) {
      return NextResponse.json({ error: "This backup archive is not available from offsite storage." }, { status: 409 });
    }

    const archive = await downloadBackupArchive(metadata.offsite);
    const fileName = backup.fileName || `backup-${backup.id}.json`;
    const fileSize = Buffer.byteLength(archive.content, "utf8");
    const contentHash = createHash("sha256").update(archive.content).digest("hex");

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "BACKUP_DOWNLOAD",
        entityType: "BackupRecord",
        entityId: backup.id,
        changes: JSON.stringify({
          fileName,
          fileSize,
          contentHash,
          offsiteStatus: metadata.offsite.status,
          userAgent: request.headers.get("user-agent") || "unknown",
        }),
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      },
    });

    return new NextResponse(archive.content, {
      status: 200,
      headers: {
        "Content-Type": archive.contentType || "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (error?.message === "BACKUP_NOT_AVAILABLE_OFFSITE") {
      return NextResponse.json({ error: "This backup archive is not available from offsite storage." }, { status: 409 });
    }
    if (error?.message === "BACKUP_STORAGE_NOT_READY") {
      return NextResponse.json({ error: "Backup storage is not fully configured for archive downloads." }, { status: 503 });
    }
    if (typeof error?.message === "string" && error.message.startsWith("BACKUP_DOWNLOAD_FAILED:")) {
      return NextResponse.json({ error: redactBackupSecretText(error.message.slice("BACKUP_DOWNLOAD_FAILED:".length)) || "Backup archive download failed." }, { status: 502 });
    }
    console.error(`Failed to download backup archive: ${redactBackupSecretText(error)}`);
    return NextResponse.json({ error: "Failed to download backup archive" }, { status: 500 });
  }
}
