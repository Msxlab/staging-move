import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { requirePermission, requirePasswordConfirm } from "@/lib/auth";
import {
  downloadBackupArchive,
  isValidBackupObjectKey,
  parseBackupRecordMetadata,
  sanitizeBackupFileName,
} from "@/lib/backup-storage";
import { redactBackupSecretText } from "@/lib/backup-metadata";
import { writeBackupAudit } from "@/lib/backup-audit";
import { MAX_BACKUP_DOWNLOAD_BYTES } from "@/lib/backup-policy";
import { getAuditRequestMeta } from "@/lib/audit";
import { contentDispositionAttachment } from "@/lib/http-download";

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
  let session: Awaited<ReturnType<typeof requirePermission>> | null = null;
  let backupId: string | null = null;
  try {
    // Backup archives carry every encrypted/PII field in the DB. Force the
    // download gate to SUPER_ADMIN — a regular ADMIN with `settings.canRead`
    // can browse the backup list (metadata-only) but cannot pull the
    // archive bytes. Step-up below also requires MFA for SUPER_ADMINs that
    // have it enabled (which is mandatory for that role).
    session = await requirePermission("settings", "canRead", { minimumRole: "SUPER_ADMIN", fallbackResources: ["audit_logs"] });
    const { id } = await params;
    backupId = id;
    const body = await request.json().catch(() => ({}));
    const confirm = await requirePasswordConfirm(
      session,
      typeof body?.confirmPassword === "string" ? body.confirmPassword : undefined,
      {
        operation: "backup_download",
        requireMfa: true,
        mfaCode: typeof body?.mfaCode === "string" ? body.mfaCode : undefined,
        backupCode: typeof body?.backupCode === "string" ? body.backupCode : undefined,
        ipAddress: getAuditRequestMeta(request).ipAddress,
        userAgent: getAuditRequestMeta(request).userAgent,
      },
    );
    if (!confirm.confirmed) {
      await writeBackupAudit({
        session,
        action: "BACKUP_DOWNLOAD_FAILED",
        entityId: id,
        request,
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

    const backup = await prisma.backupRecord.findUnique({ where: { id } });
    if (!backup) {
      return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }
    if (backup.fileSize && backup.fileSize > MAX_BACKUP_DOWNLOAD_BYTES) {
      await writeBackupAudit({
        session,
        action: "BACKUP_DOWNLOAD_FAILED",
        entityId: backup.id,
        request,
        metadata: {
          fileSize: backup.fileSize,
          maxBytes: MAX_BACKUP_DOWNLOAD_BYTES,
        },
        error: "backup archive exceeds synchronous download limit",
      });
      return NextResponse.json(
        { error: "Backup archive is too large to download synchronously." },
        { status: 413 },
      );
    }

    const metadata = parseBackupRecordMetadata(backup.errorMessage);
    if (!metadata.offsite || metadata.offsite.status !== "stored" || !metadata.offsite.objectKey) {
      await writeBackupAudit({
        session,
        action: "BACKUP_DOWNLOAD_FAILED",
        entityId: backup.id,
        request,
        error: "offsite archive unavailable",
      });
      return NextResponse.json({ error: "This backup archive is not available from offsite storage." }, { status: 409 });
    }
    if (!isValidBackupObjectKey(metadata.offsite.objectKey, backup.id)) {
      await writeBackupAudit({
        session,
        action: "BACKUP_DOWNLOAD_FAILED",
        entityId: backup.id,
        request,
        metadata: { objectKeyRejected: true },
        error: "invalid offsite object key",
      });
      return NextResponse.json({ error: "Backup archive storage key is invalid." }, { status: 409 });
    }

    const archive = await downloadBackupArchive(metadata.offsite);
    const fileName = sanitizeBackupFileName(
      backup.fileName,
      `backup-${backup.id}.json`,
    );
    const fileSize = Buffer.byteLength(archive.content, "utf8");
    if (fileSize > MAX_BACKUP_DOWNLOAD_BYTES) {
      await writeBackupAudit({
        session,
        action: "BACKUP_DOWNLOAD_FAILED",
        entityId: backup.id,
        request,
        metadata: { fileSize, maxBytes: MAX_BACKUP_DOWNLOAD_BYTES },
        error: "downloaded archive exceeds synchronous download limit",
      });
      return NextResponse.json(
        { error: "Backup archive is too large to download synchronously." },
        { status: 413 },
      );
    }
    const contentHash = createHash("sha256").update(archive.content).digest("hex");

    await writeBackupAudit({
      session,
      action: "BACKUP_DOWNLOAD_SUCCESS",
      entityId: backup.id,
      request,
      metadata: {
        fileName,
        fileSize,
        contentHash,
        offsiteStatus: metadata.offsite.status,
      },
    });

    return new NextResponse(archive.content, {
      status: 200,
      headers: {
        "Content-Type": archive.contentType || "application/json; charset=utf-8",
        "Content-Disposition": contentDispositionAttachment(fileName, `backup-${backup.id}.json`),
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    if (session) {
      await writeBackupAudit({
        session,
        action: "BACKUP_DOWNLOAD_FAILED",
        entityId: backupId || "download",
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
