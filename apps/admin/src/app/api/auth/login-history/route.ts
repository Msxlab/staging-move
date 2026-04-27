import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, requireRole } from "@/lib/auth";
import { parsePaginationParams } from "@/lib/pagination";

// GET /api/auth/login-history — list admin login history
export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const { page, perPage, skip } = parsePaginationParams(searchParams, {
      defaultPerPage: 50,
    });
    const all = searchParams.get("all") === "true";
    const successOnly = searchParams.get("success");

        let isSuperAdmin = false;
    try { await requireRole("SUPER_ADMIN"); isSuperAdmin = true; } catch {}

    const where: any = {};
    if (!all || !isSuperAdmin) {
      where.adminUserId = session.adminId;
    }
    if (successOnly === "true") where.success = true;
    if (successOnly === "false") where.success = false;

    const [logs, total] = await Promise.all([
      prisma.adminLoginLog.findMany({
        where,
        include: {
          adminUser: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
        take: perPage,
        skip,
      }),
      prisma.adminLoginLog.count({ where }),
    ]);

    // Stats
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const statsWhere = all && isSuperAdmin ? {} : { adminUserId: session.adminId };

    const [total24h, failed24h, total7d, failed7d] = await Promise.all([
      prisma.adminLoginLog.count({ where: { ...statsWhere, createdAt: { gte: last24h } } }),
      prisma.adminLoginLog.count({ where: { ...statsWhere, createdAt: { gte: last24h }, success: false } }),
      prisma.adminLoginLog.count({ where: { ...statsWhere, createdAt: { gte: last7d } } }),
      prisma.adminLoginLog.count({ where: { ...statsWhere, createdAt: { gte: last7d }, success: false } }),
    ]);

    return NextResponse.json({
      logs: logs.map((l: any) => ({
        id: l.id,
        adminUser: l.adminUser,
        email: l.email,
        success: l.success,
        failReason: l.failReason,
        ipAddress: l.ipAddress,
        browser: l.browser,
        os: l.os,
        country: l.country,
        city: l.city,
        mfaUsed: l.mfaUsed,
        mfaMethod: l.mfaMethod,
        createdAt: l.createdAt,
      })),
      total,
      page,
      perPage,
      stats: { total24h, failed24h, total7d, failed7d },
      isSuperAdmin,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("Login history error:", error);
    return NextResponse.json({ error: "Failed to fetch login history" }, { status: 500 });
  }
}
