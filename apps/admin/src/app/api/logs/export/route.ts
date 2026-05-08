/**
 * Server-side admin/user audit log CSV export.
 *
 * Replaces the page-level client-side `Blob`/`URL.createObjectURL`
 * exports that bypassed step-up, audit logging, CSV-injection escaping,
 * and cache-control headers. The client-side path also exported only
 * the rows currently in the React state — operators were silently
 * truncating their own exports without knowing.
 *
 * Permission gate: `audit_logs:canRead` (falls back to `settings`) with
 * an ADMIN floor. Step-up password confirm is required because logs
 * can include actor email, target entity id, and IP address.
 *
 * Hard caps:
 *   - At most 50,000 rows per export. Very rarely binding for legitimate
 *     ops, hard ceiling on accidental "export everything ever".
 *   - Filters mirror the GET /api/logs schema 1:1 so an operator cannot
 *     widen the dataset by going through this endpoint.
 *
 * Email/IP masking:
 *   - SUPER_ADMIN gets unmasked email/IP — used for incident response.
 *   - ADMIN gets masked email and a coarse IP bucket so a stolen export
 *     does not expose third-party PII to a compromised admin account.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";
import { buildCsv } from "@/lib/csv-safety";
import { maskEmail } from "@/lib/privacy";

const MAX_EXPORT_ROWS = 50_000;

function maskIp(ip: string | null | undefined, unmasked: boolean) {
  if (!ip || ip === "unknown") return "";
  if (unmasked) return ip;
  // IPv4 — drop the last octet so trace-back to a household is removed
  // but ASN-level analysis is preserved.
  if (/^\d+\.\d+\.\d+\.\d+/.test(ip)) {
    return ip.split(".").slice(0, 3).join(".") + ".0";
  }
  // IPv6 — keep the /64 prefix only.
  if (ip.includes(":")) {
    return ip.split(":").slice(0, 4).join(":") + "::";
  }
  return ip.length > 8 ? ip.slice(0, 8) + "***" : "***";
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("audit_logs", "canRead", {
      minimumRole: "ADMIN",
      fallbackResources: ["settings"],
    });
    const body = await request.json().catch(() => ({}));

    const confirm = await requirePasswordConfirm(
      session,
      typeof body?.confirmPassword === "string" ? body.confirmPassword : undefined,
      { operation: "audit_log_export" },
    );
    if (!confirm.confirmed) {
      return NextResponse.json(
        { error: confirm.error, requiresPassword: true },
        { status: 403 },
      );
    }

    const tab = body?.tab === "user" ? "user" : "admin";
    const action = typeof body?.action === "string" ? body.action.slice(0, 60) : "";
    const entityType = typeof body?.entityType === "string" ? body.entityType.slice(0, 60) : "";
    const adminId = typeof body?.adminId === "string" ? body.adminId.slice(0, 32) : "";
    const dateFrom = typeof body?.dateFrom === "string" ? body.dateFrom.slice(0, 10) : "";
    const dateTo = typeof body?.dateTo === "string" ? body.dateTo.slice(0, 10) : "";
    const search = typeof body?.search === "string" ? body.search.slice(0, 200) : "";

    const unmasked = session.role === "SUPER_ADMIN";

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
        if (dateFrom) where.createdAt.gte = new Date(dateFrom);
        if (dateTo) where.createdAt.lte = new Date(dateTo + "T23:59:59Z");
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
        l.entityId,
        maskIp(l.ipAddress, unmasked),
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
        if (dateFrom) where.createdAt.gte = new Date(dateFrom);
        if (dateTo) where.createdAt.lte = new Date(dateTo + "T23:59:59Z");
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
        l.entityId,
        maskIp(l.ipAddress, unmasked),
        l.createdAt ? new Date(l.createdAt).toISOString() : "",
      ]);
      csv = buildCsv(header, rows);
      rowCount = rows.length;
    }

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "AUDIT_LOG_CSV_EXPORT",
        entityType: tab === "admin" ? "AdminAuditLog" : "AuditLog",
        entityId: "bulk",
        changes: JSON.stringify({
          tab,
          rowCount,
          truncated: rowCount >= MAX_EXPORT_ROWS,
          unmasked,
          filters: { action, entityType, adminId, dateFrom, dateTo, hasSearch: Boolean(search) },
        }),
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      },
    });

    const filename = `${tab}-logs-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
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
    console.error("Failed to export audit logs:", error?.message || error);
    return NextResponse.json({ error: "Failed to export audit logs" }, { status: 500 });
  }
}
