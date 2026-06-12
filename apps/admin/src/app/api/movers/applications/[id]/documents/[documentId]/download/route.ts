import { NextRequest, NextResponse } from "next/server";
import { MOVER_DOC_MAX_BYTES, normalizeMoverDocContentType } from "@locateflow/shared";
import { requirePermission } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { downloadAssetObject } from "@/lib/r2-asset-storage";

export const runtime = "nodejs";

function isValidMoverDocumentObjectKey(objectKey: string, applicationId: string): boolean {
  if (!objectKey || objectKey.includes("\\") || objectKey.startsWith("/") || objectKey.includes("\0")) {
    return false;
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(objectKey);
  } catch {
    return false;
  }
  if (decoded !== objectKey || decoded.includes("..")) return false;
  const prefix = `document/mover-${applicationId}/`;
  const leaf = objectKey.slice(prefix.length);
  return objectKey.startsWith(prefix) && /^[a-zA-Z0-9-]+\.[a-zA-Z0-9]{1,6}$/.test(leaf);
}

function extensionFor(contentType: string): string {
  switch (normalizeMoverDocContentType(contentType)) {
    case "application/pdf":
      return "pdf";
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

function sanitizeDownloadFileName(fileName: string, contentType: string): string {
  const clean = fileName
    .replace(/[\\/\r\n"]/g, "_")
    .replace(/[^\x20-\x7E]/g, "_")
    .trim()
    .slice(0, 160);
  const fallback = `mover-document.${extensionFor(contentType)}`;
  return clean || fallback;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  let session: Awaited<ReturnType<typeof requirePermission>> | null = null;
  let documentId: string | null = null;
  try {
    session = await requirePermission("providers", "canRead", { minimumRole: "VIEWER" });
    const { id, documentId: docId } = await params;
    documentId = docId;
    const requestMeta = getAuditRequestMeta(request);

    const document = await prisma.moverDocument.findFirst({
      where: { id: docId, applicationId: id },
      select: {
        id: true,
        applicationId: true,
        kind: true,
        fileName: true,
        objectKey: true,
        contentType: true,
        sizeBytes: true,
      },
    });
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    if (!isValidMoverDocumentObjectKey(document.objectKey, id)) {
      await writeAdminAudit(session, {
        action: "MOVER_DOCUMENT_DOWNLOAD_FAILED",
        entityType: "MoverDocument",
        entityId: document.id,
        metadata: { applicationId: id, reason: "invalid_object_key" },
        request: requestMeta,
      });
      return NextResponse.json({ error: "Document storage key is invalid." }, { status: 409 });
    }
    if (document.sizeBytes > MOVER_DOC_MAX_BYTES) {
      return NextResponse.json({ error: "Document is too large to download synchronously." }, { status: 413 });
    }

    const object = await downloadAssetObject(document.objectKey);
    const contentType = normalizeMoverDocContentType(document.contentType) || "application/octet-stream";
    const fileName = sanitizeDownloadFileName(document.fileName, document.contentType);

    await writeAdminAudit(session, {
      action: "MOVER_DOCUMENT_DOWNLOAD",
      entityType: "MoverDocument",
      entityId: document.id,
      metadata: {
        applicationId: id,
        kind: document.kind,
        sizeBytes: document.sizeBytes,
        contentType,
      },
      request: requestMeta,
    });

    return new NextResponse(new Uint8Array(object.body), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: any) {
    if (session) {
      await writeAdminAudit(session, {
        action: "MOVER_DOCUMENT_DOWNLOAD_FAILED",
        entityType: "MoverDocument",
        entityId: documentId || "download",
        metadata: { error: error?.message || String(error) },
        request: getAuditRequestMeta(request),
      });
    }
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (typeof error?.message === "string" && error.message.startsWith("R2_GET_FAILED:")) {
      return NextResponse.json({ error: "Document download failed." }, { status: 502 });
    }
    if (error?.message === "R2_GET_TIMEOUT" || typeof error?.message === "string" && error.message.startsWith("R2_ASSET_STORAGE_NOT_CONFIGURED:")) {
      return NextResponse.json({ error: "Document storage is unavailable." }, { status: 503 });
    }
    console.error("Failed to download mover document:", error);
    return NextResponse.json({ error: "Failed to download mover document" }, { status: 500 });
  }
}
