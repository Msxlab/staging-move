import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { buildCsv } from "@/lib/csv-safety";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import { contentDispositionAttachment } from "@/lib/http-download";

/**
 * Admin provider catalog CSV export.
 *
 * The provider catalog carries no user PII (no emails), so this mirrors the
 * lighter `/api/affiliate/export` posture rather than the step-up user export:
 * admin-gated and audit-logged, but no password/MFA confirmation. The previous
 * in-page Blob path built the CSV client-side from whatever was loaded into
 * React state and wrote no audit row — so a bulk catalog export left no trace.
 * Every field still runs through the CSV-injection guard.
 *
 * `?ids=a,b,c` exports only the named providers (the page passes the current
 * bulk selection); omitting it exports the full catalog.
 */
const MAX_EXPORT_ROWS = 50_000;

export async function GET(request: NextRequest) {
  const requestMeta = getAuditRequestMeta(request);
  try {
    const session = await requirePermission("providers", "canRead", {
      minimumRole: "VIEWER",
    });

    const idsParam = new URL(request.url).searchParams.get("ids");
    const ids = idsParam
      ? idsParam
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
          .slice(0, MAX_EXPORT_ROWS)
      : null;

    const where: Record<string, unknown> = { deletedAt: null };
    if (ids && ids.length > 0) where.id = { in: ids };

    const providers = await prisma.serviceProvider.findMany({
      where,
      take: MAX_EXPORT_ROWS,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        category: true,
        scope: true,
        popularityScore: true,
        isActive: true,
        website: true,
      },
    });

    const header = [
      "id",
      "name",
      "slug",
      "category",
      "scope",
      "score",
      "active",
      "website",
    ];
    const rows = providers.map((p: any) => [
      p.id,
      p.name,
      p.slug,
      p.category,
      p.scope,
      p.popularityScore,
      p.isActive,
      p.website || "",
    ]);

    const csv = buildCsv(header, rows);

    await writeAdminAudit(session, {
      action: "PROVIDER_EXPORT_CREATED",
      entityType: "ServiceProvider",
      entityId: "bulk",
      metadata: {
        operation: "provider_export",
        status: "success",
        rowCount: rows.length,
        selection: ids && ids.length > 0 ? "subset" : "all",
        requestedIds: ids ? ids.length : null,
        truncated: rows.length >= MAX_EXPORT_ROWS,
      },
      request: requestMeta,
    });

    const filename = `providers-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": contentDispositionAttachment(filename, "providers.csv"),
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to export providers:", error?.message || error);
    return NextResponse.json({ error: "Failed to export providers" }, { status: 500 });
  }
}
