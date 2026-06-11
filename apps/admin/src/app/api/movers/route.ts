import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { parsePaginationParams } from "@/lib/pagination";

/**
 * Admin read surface for the MovingCompany catalog — the FMCSA household-
 * goods carrier registry snapshot rendered on public mover surfaces.
 *
 * Deliberately GET-only. The catalog is filled exclusively by
 * `scripts/etl-fmcsa-movers.mjs` (idempotent upserts on usdotNumber from a
 * locally-downloaded FMCSA census CSV — the download is form-gated, so
 * there is NO server-side trigger; faking one would just 500). Last-import
 * metadata is derived honestly from the rows themselves: max(dataAsOf),
 * row counts, and per-state coverage. Per-row corrections (activate/
 * deactivate, complaintCount2y, safetyRating) live in [id]/route.ts behind
 * ADMIN + step-up, mirroring the sponsored module.
 *
 * Permission resource: `providers` — same catalog surface the providers /
 * sponsored modules govern (SponsoredPlacement already targets
 * MovingCompany rows under this resource). Reads sit at the VIEWER floor.
 */

const STATE_RE = /^[A-Z]{2}$/;

export async function GET(request: NextRequest) {
  try {
    await requirePermission("providers", "canRead", { minimumRole: "VIEWER" });
    const { searchParams } = new URL(request.url);
    const { page, perPage, skip } = parsePaginationParams(searchParams, {
      defaultPerPage: 50,
      maxPerPage: 100,
    });
    const search = (searchParams.get("search") || "").trim().slice(0, 120);
    const stateRaw = (searchParams.get("state") || "").trim().toUpperCase();
    const state = STATE_RE.test(stateRaw) ? stateRaw : "";
    const status = searchParams.get("status") || ""; // active | inactive
    const hhg = searchParams.get("hhg") || ""; // authorized | none

    const where: Record<string, unknown> = {};
    if (search) {
      const usdot = /^\d+$/.test(search) ? Number.parseInt(search, 10) : null;
      where.OR = [
        ...(usdot !== null && Number.isSafeInteger(usdot) ? [{ usdotNumber: usdot }] : []),
        { legalName: { contains: search } },
        { dbaName: { contains: search } },
      ];
    }
    if (state) where.state = state;
    if (status === "active") where.active = true;
    if (status === "inactive") where.active = false;
    if (hhg === "authorized") where.hhgAuthorization = true;
    if (hhg === "none") where.hhgAuthorization = false;

    const [movers, total] = await Promise.all([
      (prisma as any).movingCompany.findMany({
        where,
        // Deterministic ordering — legalName collides across states, so the
        // unique usdotNumber breaks ties (stable pagination).
        orderBy: [{ legalName: "asc" }, { usdotNumber: "asc" }],
        skip,
        take: perPage,
      }),
      (prisma as any).movingCompany.count({ where }),
    ]);

    // Catalog-freshness strip — computed over the WHOLE catalog (not the
    // filtered view) because it answers "when did the ETL last run and how
    // much did it cover", not "what does this filter match". Degrades
    // gracefully: if the aggregates fail the list still renders and the
    // client simply hides the strip.
    let freshness: {
      totalRows: number;
      activeCount: number;
      newestDataAsOf: string | null;
      statesCovered: number;
      stateCounts: Array<{ state: string; count: number }>;
    } | null = null;
    try {
      const [totalRows, activeCount, newest, stateGroups] = await Promise.all([
        (prisma as any).movingCompany.count(),
        (prisma as any).movingCompany.count({ where: { active: true } }),
        (prisma as any).movingCompany.aggregate({ _max: { dataAsOf: true } }),
        (prisma as any).movingCompany.groupBy({
          by: ["state"],
          _count: { id: true },
          orderBy: { state: "asc" },
        }),
      ]);
      freshness = {
        totalRows,
        activeCount,
        newestDataAsOf: newest?._max?.dataAsOf
          ? new Date(newest._max.dataAsOf).toISOString()
          : null,
        statesCovered: stateGroups.length,
        stateCounts: stateGroups.map((group: any) => ({
          state: group.state,
          count: group._count.id,
        })),
      };
    } catch (error) {
      console.error("Failed to compute mover catalog freshness:", error);
    }

    return NextResponse.json({ movers, total, page, perPage, freshness });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Failed to fetch movers:", error);
    return NextResponse.json({ error: "Failed to fetch movers" }, { status: 500 });
  }
}
