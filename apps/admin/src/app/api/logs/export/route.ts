import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";
import { buildCsv } from "@/lib/csv-safety";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import { maskEmail, maskIpAddress, maskProviderIdentifier } from "@/lib/privacy";
import { contentDispositionAttachment } from "@/lib/http-download";

const MAX_EXPORT_ROWS = 50_000;

function safeString(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function parseDateFilter(value: string, endOfDay = false): Date | null | undefined {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(endOfDay ? `${value}T23:59:59.999Z` : `${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) ? date : null;
}

function safeEntityIdentifier(value: unknown, unmasked: boolean) {
  if (typeof value !== "string" || !value) return "";
  if (/^(sub|cus|pi|cs|in|price|prod|pm|seti|si)_[A-Za-z0-9]+/.test(value)) {
    return maskProviderIdentifier(value);
  }
  return unmasked ? value : maskProviderIdentifier(value);
}

function safeAuditFilters(input: {
  tab: string;
  action: string;
  entityType: string;
  adminId: string;
  search: string;
  dateFrom: string;
  dateTo: string;
}) {
  return {
    tab: input.tab,
    action: input.action || null,
    entityType: input.entityType || null,
    adminId: input.adminId || null,
    dateRange: { from: input.dateFrom || null, to: input.dateTo || null },
    hasSearch: Boolean(input.search),
    searchLength: input.search.length,
  };
}

export async function POST(request: NextRequest) {
  let session: any = null;
  const requestMeta = getAuditRequestMeta(request);
  let auditContext: Record<string, unknown> = {};

  try {
    session = await requirePermission("audit_logs", "canRead", {
      minimumRole: "ADMIN",
    });
    const body = await request.json().catch(() => ({}));

    const tab = body?.tab === "user" ? "user" : "admin";
    const action = safeString(body?.action, 64);
    const entityType = safeString(body?.entityType, 50);
    const adminId = safeString(body?.adminId, 40);
    const dateFromRaw = safeString(body?.dateFrom, 10);
    const dateToRaw = safeString(body?.dateTo, 10);
    const search = safeString(body?.search, 200);
    const dateFrom = parseDateFilter(dateFromRaw);
    const dateTo = parseDateFilter(dateToRaw, true);
    const unmasked = session.role === "SUPER_ADMIN";
    auditContext = safeAuditFilters({ tab, action, entityType, adminId, search, dateFrom: dateFromRaw, dateTo: dateToRaw });

    const failAudit = async (reasonCode: string, status = "failed") => {
      await writeAdminAudit(session, {
        action: "AUDIT_LOG_EXPORT_FAILED",
        entityType: tab === "admin" ? "AdminAuditLog" : "AuditLog",
        entityId: "export",
        metadata: {
          ...auditContext,
          format: "csv",
          status,
          reasonCode,
        },
        request: requestMeta,
      });
    };

    if (dateFrom === null || dateTo === null) {
      await failAudit("invalid_date_filter");
      return NextResponse.json({ error: "Invalid date filter" }, { status: 400 });
    }

    const confirm = await requirePasswordConfirm(
      session,
      typeof body?.confirmPassword === "string" ? body.confirmPassword : undefined,
      {
        operation: "audit_log_export",
        requireMfa: true,
        mfaCode: typeof body?.mfaCode === "string" ? body.mfaCode : undefined,
        backupCode: typeof body?.backupCode === "string" ? body.backupCode : undefined,
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
      },
    );
    if (!confirm.confirmed) {
      await failAudit(confirm.requiresMfa ? "mfa_required_or_invalid" : "step_up_failed");
      return NextResponse.json(
        {
          error: confirm.error || "Password and MFA confirmation required",
          requiresPassword: true,
          requiresMfa: confirm.requiresMfa || undefined,
        },
        { status: confirm.rateLimited ? 429 : 403 },
      );
    }

    let csv: string;
    let rowCount = 0;

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

      const logs = await prisma.adminAuditLog.findMany({
        where,
        include: { adminUser: { select: { email: true } } },
        orderBy: { createdAt: "desc" },
        take: MAX_EXPORT_ROWS,
      });

      const header = ["id", "admin_email", "action", "entity_type", "entity_id", "ip", "created_at"];
      const rows = logs.map((l: any) => [
        l.id,
        unmasked ? l.adminUser?.email || "" : maskEmail(l.adminUser?.email || ""),
        l.action,
        l.entityType,
        safeEntityIdentifier(l.entityId, unmasked),
        unmasked ? l.ipAddress || "" : maskIpAddress(l.ipAddress) || "",
        l.createdAt ? new Date(l.createdAt).toISOString() : "",
      ]);
      csv = buildCsv(header, rows);
      rowCount = rows.length;
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
        if (dateFrom) where.createdAt.gte = dateFrom;
        if (dateTo) where.createdAt.lte = dateTo;
      }

      const logs = await prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: MAX_EXPORT_ROWS,
      });

      const header = ["id", "user_id", "action", "entity_type", "entity_id", "ip", "created_at"];
      const rows = logs.map((l: any) => [
        l.id,
        l.userId,
        l.action,
        l.entityType,
        safeEntityIdentifier(l.entityId, unmasked),
        unmasked ? l.ipAddress || "" : maskIpAddress(l.ipAddress) || "",
        l.createdAt ? new Date(l.createdAt).toISOString() : "",
      ]);
      csv = buildCsv(header, rows);
      rowCount = rows.length;
    }

    await writeAdminAudit(session, {
      action: "AUDIT_LOGS_EXPORTED",
      entityType: tab === "admin" ? "AdminAuditLog" : "AuditLog",
      entityId: "export",
      metadata: {
        ...auditContext,
        format: "csv",
        status: "success",
        rowCount,
        truncated: rowCount >= MAX_EXPORT_ROWS,
        unmasked,
      },
      request: requestMeta,
    });

    const filename = `${tab}-logs-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": contentDispositionAttachment(filename, "audit-logs.csv"),
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
    if (session) {
      await writeAdminAudit(session, {
        action: "AUDIT_LOG_EXPORT_FAILED",
        entityType: "AuditLog",
        entityId: "export",
        metadata: {
          ...auditContext,
          format: "csv",
          status: "failed",
          reasonCode: "unexpected_exception",
        },
        request: requestMeta,
      }).catch(() => null);
    }
    return NextResponse.json({ error: "Failed to export audit logs" }, { status: 500 });
  }
}
