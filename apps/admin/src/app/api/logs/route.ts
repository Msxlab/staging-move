import { NextRequest, NextResponse } from "next/server";
import { redactAuditPayload } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import { parsePaginationParams } from "@/lib/pagination";
import { maskEmail, maskIpAddress, maskProviderIdentifier } from "@/lib/privacy";

type AuditTab = "admin" | "user";

function safeString(value: string | null, max: number) {
  return (value || "").trim().slice(0, max);
}

function parseDateFilter(value: string | null, endOfDay = false): Date | null | undefined {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(endOfDay ? `${value}T23:59:59.999Z` : `${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) ? date : null;
}

function safeFilterMetadata(input: {
  tab: AuditTab;
  action: string;
  entityType: string;
  adminId: string;
  search: string;
  dateFrom: string | null;
  dateTo: string | null;
}) {
  return {
    tab: input.tab,
    action: input.action || null,
    entityType: input.entityType || null,
    adminId: input.adminId || null,
    dateRange: {
      from: input.dateFrom || null,
      to: input.dateTo || null,
    },
    hasSearch: Boolean(input.search),
    searchLength: input.search.length,
  };
}

function serializeChangesForRole(changes: unknown, unmasked: boolean): string | null {
  if (changes == null) return null;

  let parsed: unknown = changes;
  if (typeof changes === "string") {
    try {
      parsed = JSON.parse(changes);
    } catch {
      parsed = { rawTextLength: changes.length };
    }
  }

  const redacted = redactAuditPayload(parsed);
  if (unmasked) return JSON.stringify(redacted);

  if (redacted && typeof redacted === "object" && !Array.isArray(redacted)) {
    return JSON.stringify({
      redacted: true,
      fields: Object.keys(redacted as Record<string, unknown>).slice(0, 20),
    });
  }

  return JSON.stringify({ redacted: true });
}

function safeEntityIdentifier(value: unknown, unmasked: boolean) {
  if (typeof value !== "string" || !value) return value;
  if (/^(sub|cus|pi|cs|in|price|prod|pm|seti|si)_[A-Za-z0-9]+/.test(value)) {
    return maskProviderIdentifier(value);
  }
  return unmasked ? value : maskProviderIdentifier(value);
}

function redactAdminUser(adminUser: any, unmasked: boolean) {
  if (!adminUser) return null;
  return {
    ...adminUser,
    email: unmasked ? adminUser.email : maskEmail(adminUser.email),
  };
}

function redactLogRow(row: any, unmasked: boolean, userMap?: Record<string, any>) {
  const user = userMap ? userMap[row.userId] || null : undefined;
  return {
    ...row,
    entityId: safeEntityIdentifier(row.entityId, unmasked),
    ipAddress: unmasked ? row.ipAddress : maskIpAddress(row.ipAddress),
    changes: serializeChangesForRole(row.changes, unmasked),
    adminUser: row.adminUser ? redactAdminUser(row.adminUser, unmasked) : row.adminUser,
    user: user
      ? {
          ...user,
          email: unmasked ? user.email : maskEmail(user.email),
        }
      : user,
  };
}

function adminLabel(admin: any, unmasked: boolean) {
  const name = [admin.firstName, admin.lastName].filter(Boolean).join(" ").trim() || "Admin";
  return `${name} (${unmasked ? admin.email : maskEmail(admin.email)})`;
}

// Facet dropdowns (action / entityType) are populated by groupBy aggregations.
// Running them over the ENTIRE append-only audit table on every page load is
// what made this page unloadable at high write volume. They're only needed to
// seed the filter UI, so compute them at most ONCE per browsing session —
// when the user is on page 1 with no active filter — and bound them to a
// recent window so the aggregation is index-backed and cheap instead of a
// full-table scan. When a filter is active or the user has paged in, the
// dropdowns are already populated client-side, so we skip the facets entirely.
const FACET_WINDOW_DAYS = 30;

function shouldComputeFacets(page: number, hasActiveFilter: boolean): boolean {
  return page === 1 && !hasActiveFilter;
}

function facetWindowCreatedAt() {
  return { gte: new Date(Date.now() - FACET_WINDOW_DAYS * 24 * 60 * 60 * 1000) };
}

function mapFacet(rows: any[], key: "action" | "entityType") {
  return rows.map((r: any) => ({ value: r[key], count: r._count.id }));
}

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission("audit_logs", "canRead", { minimumRole: "ADMIN" });
    const { searchParams } = new URL(request.url);
    const { page, perPage, skip } = parsePaginationParams(searchParams, {
      defaultPerPage: 30,
      maxPerPage: 100,
    });
    const rawTab = searchParams.get("tab") || "admin";
    if (rawTab !== "admin" && rawTab !== "user") {
      return NextResponse.json({ error: "Invalid tab" }, { status: 400 });
    }
    const tab = rawTab as AuditTab;
    const search = safeString(searchParams.get("search"), 200);
    const action = safeString(searchParams.get("action"), 64);
    const entityType = safeString(searchParams.get("entityType"), 50);
    const adminId = safeString(searchParams.get("adminId"), 40);
    const dateFromRaw = searchParams.get("dateFrom");
    const dateToRaw = searchParams.get("dateTo");
    const dateFrom = parseDateFilter(dateFromRaw);
    const dateTo = parseDateFilter(dateToRaw, true);

    if (dateFrom === null || dateTo === null) {
      return NextResponse.json({ error: "Invalid date filter" }, { status: 400 });
    }

    const unmasked = session.role === "SUPER_ADMIN";
    const auditMetadata = safeFilterMetadata({ tab, action, entityType, adminId, search, dateFrom: dateFromRaw, dateTo: dateToRaw });

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
        if (dateFrom) where.createdAt.gte = dateFrom;
        if (dateTo) where.createdAt.lte = dateTo;
      }

      const hasActiveFilter = Boolean(search || action || entityType || adminId || dateFrom || dateTo);
      const computeFacets = shouldComputeFacets(page, hasActiveFilter);
      const facetWhere = { createdAt: facetWindowCreatedAt() };

      const [logs, total, actions, entityTypes, admins] = await Promise.all([
        prisma.adminAuditLog.findMany({
          where,
          include: { adminUser: { select: { email: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: "desc" },
          take: perPage,
          skip,
        }),
        prisma.adminAuditLog.count({ where }),
        computeFacets
          ? prisma.adminAuditLog.groupBy({ by: ["action"], where: facetWhere, _count: { id: true }, orderBy: { _count: { id: "desc" } } })
          : Promise.resolve([] as any[]),
        computeFacets
          ? prisma.adminAuditLog.groupBy({ by: ["entityType"], where: facetWhere, _count: { id: true }, orderBy: { _count: { id: "desc" } } })
          : Promise.resolve([] as any[]),
        computeFacets
          ? prisma.adminUser.findMany({ select: { id: true, email: true, firstName: true, lastName: true }, orderBy: { email: "asc" } })
          : Promise.resolve([] as any[]),
      ]);

      await writeAdminAudit(session, {
        action: "AUDIT_LOGS_VIEWED",
        entityType: "AdminAuditLog",
        entityId: "query",
        metadata: { ...auditMetadata, page, perPage, rowCount: logs.length, total },
        request: getAuditRequestMeta(request),
      });

      return NextResponse.json({
        logs: logs.map((row: any) => redactLogRow(row, unmasked)),
        total,
        page,
        perPage,
        tab: "admin",
        facetsComputed: computeFacets,
        filters: {
          actions: mapFacet(actions, "action"),
          entityTypes: mapFacet(entityTypes, "entityType"),
          admins: admins.map((a: any) => ({ id: a.id, label: adminLabel(a, unmasked) })),
        },
      });
    }

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
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }

    const hasActiveFilter = Boolean(search || action || entityType || dateFrom || dateTo);
    const computeFacets = shouldComputeFacets(page, hasActiveFilter);
    const facetWhere = { createdAt: facetWindowCreatedAt() };

    const [logs, total, actions, entityTypes] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: perPage,
        skip,
      }),
      prisma.auditLog.count({ where }),
      computeFacets
        ? prisma.auditLog.groupBy({ by: ["action"], where: facetWhere, _count: { id: true }, orderBy: { _count: { id: "desc" } } })
        : Promise.resolve([] as any[]),
      computeFacets
        ? prisma.auditLog.groupBy({ by: ["entityType"], where: facetWhere, _count: { id: true }, orderBy: { _count: { id: "desc" } } })
        : Promise.resolve([] as any[]),
    ]);

    const userIds = [...new Set(logs.map((l: any) => l.userId).filter(Boolean))];
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true, firstName: true, lastName: true },
        })
      : [];
    const userMap: Record<string, any> = {};
    users.forEach((u: any) => { userMap[u.id] = u; });

    await writeAdminAudit(session, {
      action: "AUDIT_LOGS_VIEWED",
      entityType: "AuditLog",
      entityId: "query",
      metadata: { ...auditMetadata, page, perPage, rowCount: logs.length, total },
      request: getAuditRequestMeta(request),
    });

    return NextResponse.json({
      logs: logs.map((row: any) => redactLogRow(row, unmasked, userMap)),
      total,
      page,
      perPage,
      tab: "user",
      facetsComputed: computeFacets,
      filters: {
        actions: mapFacet(actions, "action"),
        entityTypes: mapFacet(entityTypes, "entityType"),
      },
    });
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
