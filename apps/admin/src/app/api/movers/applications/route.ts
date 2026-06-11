import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { isMoverApplicationStatus } from "@locateflow/shared";

/**
 * GET /api/movers/applications — admin verification queue list.
 *
 * Reuses the `providers` permission resource (VIEWER floor) like the sponsored
 * surface. Optional ?status= filter (PENDING by default focus, but unfiltered
 * returns the whole queue newest-first). Returns a compact row shape + a
 * documentCount; the per-application detail route returns the full record.
 */

const PAGE_SIZE = 100;

export async function GET(request: NextRequest) {
  try {
    await requirePermission("providers", "canRead", { minimumRole: "VIEWER" });

    const statusParam = request.nextUrl.searchParams.get("status");
    const where =
      statusParam && isMoverApplicationStatus(statusParam) ? { status: statusParam } : {};

    const [applications, counts] = await Promise.all([
      prisma.moverApplication.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: PAGE_SIZE,
        select: {
          id: true,
          companyLegalName: true,
          dbaName: true,
          usdotNumber: true,
          contactEmail: true,
          serviceStates: true,
          services: true,
          status: true,
          createdAt: true,
          reviewedAt: true,
          linkedMovingCompanyId: true,
          _count: { select: { documents: true } },
        },
      }),
      prisma.moverApplication.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const row of counts) statusCounts[row.status] = row._count._all;

    return NextResponse.json({
      applications: applications.map((a) => ({
        id: a.id,
        companyLegalName: a.companyLegalName,
        dbaName: a.dbaName,
        usdotNumber: a.usdotNumber,
        contactEmail: a.contactEmail,
        serviceStates: a.serviceStates,
        services: a.services,
        status: a.status,
        createdAt: a.createdAt,
        reviewedAt: a.reviewedAt,
        linkedMovingCompanyId: a.linkedMovingCompanyId,
        documentCount: a._count.documents,
      })),
      statusCounts,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Failed to list mover applications:", error);
    return NextResponse.json({ error: "Failed to list mover applications" }, { status: 500 });
  }
}
