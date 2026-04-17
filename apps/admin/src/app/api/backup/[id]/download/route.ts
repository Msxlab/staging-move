import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { downloadBackupArchive, parseBackupRecordMetadata } from "@/lib/backup-storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission("settings", "canRead", { minimumRole: "ADMIN", fallbackResources: ["audit_logs"] });
    const { id } = await params;

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
      return NextResponse.json({ error: error.message.slice("BACKUP_DOWNLOAD_FAILED:".length) || "Backup archive download failed." }, { status: 502 });
    }
    console.error("Failed to download backup archive:", error);
    return NextResponse.json({ error: "Failed to download backup archive" }, { status: 500 });
  }
}
