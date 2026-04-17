import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("audit_logs", "canRead", { minimumRole: "ADMIN" });

    const now = new Date();
    const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // ── Per-admin action counts (last 30d) ──────────────────
    const adminActions = await prisma.adminAuditLog.groupBy({
      by: ["adminUserId"],
      where: { createdAt: { gte: day30 } },
      _count: { id: true },
    });

    const adminIds = adminActions.map((a) => a.adminUserId);
    const admins = await prisma.adminUser.findMany({
      where: { id: { in: adminIds } },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, lastLoginAt: true },
    });
    const adminMap = new Map(admins.map((a) => [a.id, a]));

    const perAdmin = adminActions
      .map((a) => ({
        admin: adminMap.get(a.adminUserId) || { id: a.adminUserId, email: "Unknown", firstName: "?", lastName: "?", role: "?" },
        actions: a._count.id,
      }))
      .sort((a, b) => b.actions - a.actions);

    // ── Action type breakdown (last 30d) ────────────────────
    const actionTypes = await prisma.adminAuditLog.groupBy({
      by: ["action"],
      where: { createdAt: { gte: day30 } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 20,
    });

    // ── Entity type breakdown (last 30d) ────────────────────
    const entityTypes = await prisma.adminAuditLog.groupBy({
      by: ["entityType"],
      where: { createdAt: { gte: day30 } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 15,
    });

    // ── Daily admin activity (last 30d) ─────────────────────
    const logs = await prisma.adminAuditLog.findMany({
      where: { createdAt: { gte: day30 } },
      select: { createdAt: true },
    });

    const dailyMap: Record<string, number> = {};
    for (const log of logs) {
      const day = log.createdAt.toISOString().split("T")[0];
      dailyMap[day] = (dailyMap[day] || 0) + 1;
    }
    const dailyActivity = Object.entries(dailyMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // ── Total stats ─────────────────────────────────────────
    const [total30d, total7d, totalAll] = await Promise.all([
      prisma.adminAuditLog.count({ where: { createdAt: { gte: day30 } } }),
      prisma.adminAuditLog.count({ where: { createdAt: { gte: day7 } } }),
      prisma.adminAuditLog.count(),
    ]);

    // ── Recent critical actions ─────────────────────────────
    const criticalActions = await prisma.adminAuditLog.findMany({
      where: {
        action: { in: ["DELETE", "MFA_DISABLED", "SESSION_REVOKE_ALL", "RESTORE", "IMPORT"] },
        createdAt: { gte: day30 },
      },
      include: { adminUser: { select: { email: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      perAdmin,
      actionTypes: actionTypes.map((a) => ({ action: a.action, count: a._count.id })),
      entityTypes: entityTypes.map((e) => ({ entity: e.entityType, count: e._count.id })),
      dailyActivity,
      stats: { total30d, total7d, totalAll },
      criticalActions: criticalActions.map((c) => ({
        id: c.id,
        action: c.action,
        entityType: c.entityType,
        entityId: c.entityId,
        admin: c.adminUser,
        ipAddress: c.ipAddress,
        createdAt: c.createdAt,
      })),
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Admin activity error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
