import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ingestLogoFromUpload } from "@/lib/logo-ingest";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 1_000_000;

/**
 * Manual logo upload (multipart/form-data, single field "file"). Used when
 * the auto-fetch endpoint can't find a usable logo or when ops have a
 * specific brand asset to use.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requirePermission("providers", "canUpdate", {
      minimumRole: "MODERATOR",
    });
    const { id } = await params;

    const provider = await prisma.serviceProvider.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    let file: File | null = null;
    try {
      const formData = await request.formData();
      const value = formData.get("file");
      if (value instanceof File) file = value;
    } catch {
      return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: "Missing 'file' field" }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_UPLOAD_BYTES} bytes)` },
        { status: 413 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = file.type || "application/octet-stream";

    let result;
    try {
      result = await ingestLogoFromUpload({
        providerId: provider.id,
        body: buffer,
        contentType,
      });
    } catch (err: any) {
      const message = String(err?.message ?? err);
      if (message.startsWith("UNSUPPORTED_LOGO_CONTENT_TYPE")) {
        return NextResponse.json(
          { error: "Unsupported file type. Use PNG, JPEG, WEBP, GIF, SVG, or ICO." },
          { status: 415 },
        );
      }
      if (message === "LOGO_TOO_LARGE") {
        return NextResponse.json({ error: "File too large" }, { status: 413 });
      }
      if (message === "LOGO_TOO_SMALL") {
        return NextResponse.json({ error: "File too small to be a usable logo" }, { status: 400 });
      }
      if (
        message === "R2_ASSET_STORAGE_NOT_CONFIGURED" ||
        message === "R2_PUBLIC_BASE_URL_MISSING"
      ) {
        return NextResponse.json(
          { error: "Logo storage is not configured", code: message },
          { status: 503 },
        );
      }
      throw err;
    }

    await prisma.serviceProvider.update({
      where: { id },
      data: { logoUrl: result.publicUrl },
    });

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "UPDATE_PROVIDER_LOGO",
        entityType: "ServiceProvider",
        entityId: id,
        changes: JSON.stringify({
          source: "manual-upload",
          objectKey: result.objectKey,
          bytes: result.bytes,
          contentType: result.contentType,
        }),
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      },
    });

    revalidateTag("providers", "default");

    return NextResponse.json({
      logoUrl: result.publicUrl,
      contentType: result.contentType,
      bytes: result.bytes,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[ADMIN] logo upload failed:", error);
    return NextResponse.json({ error: "Failed to upload logo" }, { status: 500 });
  }
}
