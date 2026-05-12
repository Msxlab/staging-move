import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import { maskEmail, maskIpAddress } from "@/lib/privacy";

interface DailyActivityRow {
  date: string;
  count: number;
}

/**
 * SQL-side bucket of `AdminAuditLog` rows by UTC day. Returns rows in
 * ascending date order. We rely on `$queryRaw` against MySQL because
 * Prisma `groupBy` cannot date-truncate. The window is parameterised
 * to keep the query plan stable.
 */
async function loadDailyAdminActivity(since: Date): Promise<DailyActivityRow[]> {
  const rows = await prisma.$queryRaw<Array<{ day: Date | string; total: bigint | number }>>`
    SELECT DATE(\`createdAt\`) AS day, COUNT(*) AS total
    FROM \`AdminAuditLog\`
    WHERE \`createdAt\` >= ${since}
    GROUP BY DATE(\`createdAt\`)
    ORDER BY day ASC
  `;
  return rows.map((r) => {
    const day = r.day instanceof Date ? r.day.toISOString().split("T")[0] : String(r.day).slice(0, 10);
    const total = typeof r.total === "bigint" ? Number(r.total) : Number(r.total ?? 0);
    return { date: day, count: total };
  });
}

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission("audit_logs", "canRead", { minimumRole: "ADMIN" });
    const unmasked = session.role === "SUPER_ADMIN";

    const now = new Date();
    const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // ── Per-admin action counts (last 30d) ──────────────────
    const adminActions = await prisma.adminAuditLog.groupBy({
      by: ["adminUserId"],
      where: { createdAt: { gte: day30 } },
      _count: { id: true },
    });

    // adminUserId is nullable post-P0-2: when an admin is deleted, the
    // audit row's FK is set to null instead of cascading. Filter the
    // orphans out here — they bucket under "Deleted admin" in the
    // per-admin breakdown rather than crashing the lookup.
    const adminIds = adminActions
      .map((a) => a.adminUserId)
      .filter((id): id is string => Boolean(id));
    const admins = await prisma.adminUser.findMany({
      where: { id: { in: adminIds } },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, lastLoginAt: true },
    });
    const adminMap = new Map(admins.map((a) => [a.id, a]));

    const perAdmin = adminActions
      .map((a) => {
        const adminId = a.adminUserId;
        const admin = adminId ? adminMap.get(adminId) : undefined;
        const safeAdmin = admin
          ? { ...admin, email: unmasked ? admin.email : maskEmail(admin.email) }
          : undefined;
        return {
          admin:
            safeAdmin ||
            {
              id: adminId || "deleted",
              email: adminId ? "Unknown" : "Deleted admin",
              firstName: "?",
              lastName: "?",
              role: "?",
            },
          actions: a._count.id,
        };
      })
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
    // Bucket in SQL instead of loading every audit row. The previous
    // findMany-then-reduce path scanned the entire 30d window into the
    // Node heap on every dashboard load and would OOM on busy installs.
    const dailyActivity = await loadDailyAdminActivity(day30);

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

    await writeAdminAudit(session, {
      action: "AUDIT_LOGS_VIEWED",
      entityType: "AdminActivity",
      entityId: "analytics",
      metadata: {
        surface: "admin_activity",
        timeRange: { days: 30 },
        rowCount: {
          perAdmin: perAdmin.length,
          criticalActions: criticalActions.length,
          dailyActivity: dailyActivity.length,
        },
      },
      request: getAuditRequestMeta(request),
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
        admin: c.adminUser ? { ...c.adminUser, email: unmasked ? c.adminUser.email : maskEmail(c.adminUser.email) } : null,
        ipAddress: unmasked ? c.ipAddress : maskIpAddress(c.ipAddress),
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
