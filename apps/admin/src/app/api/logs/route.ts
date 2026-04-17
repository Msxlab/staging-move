import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("audit_logs", "canRead", { minimumRole: "ADMIN", fallbackResources: ["settings"] });
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const perPage = parseInt(searchParams.get("perPage") || "30");
    const tab = searchParams.get("tab") || "admin";
    const search = searchParams.get("search") || "";
    const action = searchParams.get("action") || "";
    const entityType = searchParams.get("entityType") || "";
    const adminId = searchParams.get("adminId") || "";
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    if (tab === "admin") {
      const where: any = {};
      if (search) {
        where.OR = [
          { adminUser: { email: { contains: search } } },
          { entityId: { contains: search } },
          { action: { contains: search } },
        ];
      }
      if (action) where.action = action;
      if (entityType) where.entityType = entityType;
      if (adminId) where.adminUserId = adminId;
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) where.createdAt.gte = new Date(dateFrom);
        if (dateTo) where.createdAt.lte = new Date(dateTo + "T23:59:59Z");
      }

      const [logs, total, actions, entityTypes, admins] = await Promise.all([
        prisma.adminAuditLog.findMany({
          where,
          include: { adminUser: { select: { email: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: "desc" },
          take: perPage,
          skip: (page - 1) * perPage,
        }),
        prisma.adminAuditLog.count({ where }),
        prisma.adminAuditLog.groupBy({ by: ["action"], _count: { id: true }, orderBy: { _count: { id: "desc" } } }),
        prisma.adminAuditLog.groupBy({ by: ["entityType"], _count: { id: true }, orderBy: { _count: { id: "desc" } } }),
        prisma.adminUser.findMany({ select: { id: true, email: true, firstName: true, lastName: true }, orderBy: { email: "asc" } }),
      ]);

      return NextResponse.json({
        logs, total, page, perPage, tab: "admin",
        filters: {
          actions: actions.map((a: any) => ({ value: a.action, count: a._count.id })),
          entityTypes: entityTypes.map((e: any) => ({ value: e.entityType, count: e._count.id })),
          admins: admins.map((a: any) => ({ id: a.id, label: `${a.firstName} ${a.lastName} (${a.email})` })),
        },
      });
    } else {
      const where: any = {};
      if (search) {
        where.OR = [
          { userId: { contains: search } },
          { entityId: { contains: search } },
          { action: { contains: search } },
        ];
      }
      if (action) where.action = action;
      if (entityType) where.entityType = entityType;
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) where.createdAt.gte = new Date(dateFrom);
        if (dateTo) where.createdAt.lte = new Date(dateTo + "T23:59:59Z");
      }

      const [logs, total, actions, entityTypes] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: perPage,
          skip: (page - 1) * perPage,
        }),
        prisma.auditLog.count({ where }),
        prisma.auditLog.groupBy({ by: ["action"], _count: { id: true }, orderBy: { _count: { id: "desc" } } }),
        prisma.auditLog.groupBy({ by: ["entityType"], _count: { id: true }, orderBy: { _count: { id: "desc" } } }),
      ]);

      // Resolve user emails
      const userIds = [...new Set(logs.map((l: any) => l.userId))];
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, firstName: true, lastName: true },
      });
      const userMap: Record<string, any> = {};
      users.forEach((u: { id: string; email: string; firstName: string | null; lastName: string | null }) => { userMap[u.id] = u; });

      const enrichedLogs = logs.map((l: any) => ({
        ...l,
        user: userMap[l.userId] || null,
      }));

      return NextResponse.json({
        logs: enrichedLogs, total, page, perPage, tab: "user",
        filters: {
          actions: actions.map((a: any) => ({ value: a.action, count: a._count.id })),
          entityTypes: entityTypes.map((e: any) => ({ value: e.entityType, count: e._count.id })),
        },
      });
    }
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
