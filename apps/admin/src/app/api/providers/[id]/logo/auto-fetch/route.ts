import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ingestLogoFromWebsite } from "@/lib/logo-ingest";

export const runtime = "nodejs";

/**
 * Try to auto-discover and ingest a logo for the given provider, using its
 * `website` field. Writes the resulting public URL to `logoUrl` on success.
 *
 * Returns 200 with `{ logoUrl, source }` on success, 422 with `{ attempted }`
 * when no candidate produced a usable image, 503 when storage isn't
 * configured.
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
      select: { id: true, website: true, logoUrl: true, name: true },
    });
    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }
    if (!provider.website) {
      return NextResponse.json(
        { error: "Provider has no website to discover logo from" },
        { status: 400 },
      );
    }

    const result = await ingestLogoFromWebsite({
      providerId: provider.id,
      website: provider.website,
    }).catch((err: any) => {
      const message = String(err?.message ?? err);
      if (
        message === "R2_ASSET_STORAGE_NOT_CONFIGURED" ||
        message === "R2_PUBLIC_BASE_URL_MISSING"
      ) {
        return { storageError: message } as const;
      }
      throw err;
    });

    if ("storageError" in result) {
      return NextResponse.json(
        { error: "Logo storage is not configured", code: result.storageError },
        { status: 503 },
      );
    }

    if ("failed" in result) {
      return NextResponse.json(
        {
          error: "No logo source returned a usable image",
          attempted: result.failed.attempted,
        },
        { status: 422 },
      );
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
          source: result.source,
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
      source: result.source,
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
    console.error("[ADMIN] logo auto-fetch failed:", error);
    return NextResponse.json({ error: "Failed to auto-fetch logo" }, { status: 500 });
  }
}
