import { NextRequest, NextResponse } from "next/server";
import { prisma, prismaUnsafe } from "@/lib/db";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";
import { buildCsv } from "@/lib/csv-safety";
import { maskEmail } from "@/lib/privacy";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import { contentDispositionAttachment } from "@/lib/http-download";

/**
 * Admin user CSV export.
 *
 * Permission gate: `users:canRead` with an ADMIN floor — VIEWERs never
 * export bulk PII. Step-up confirmation is required because an
 * unmasked CSV is a high-impact data leak vector. Rows include email
 * (masked unless the requester is SUPER_ADMIN), join date, and
 * subscription summary; no raw IPs, no OAuth provider IDs, no profile
 * payloads.
 *
 * Anti-injection: every field is run through `csvField`, which neutralizes
 * leading `=`/`+`/`-`/`@`/`\t`/`\r` characters that would otherwise
 * execute as a formula on Excel/Sheets open.
 *
 * Returned response carries `Cache-Control: no-store, max-age=0` and a
 * stable filename so re-running the export does not collide with a
 * previously cached file.
 */
const MAX_EXPORT_ROWS = 50_000;

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("users", "canRead", { minimumRole: "ADMIN" });
    const body = await request.json().catch(() => ({}));
    const requestMeta = getAuditRequestMeta(request);
    const confirm = await requirePasswordConfirm(
      session,
      typeof body?.confirmPassword === "string" ? body.confirmPassword : undefined,
      {
        operation: "users_export",
        requireMfa: true,
        mfaCode: typeof body?.mfaCode === "string" ? body.mfaCode : undefined,
        backupCode: typeof body?.backupCode === "string" ? body.backupCode : undefined,
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
      },
    );
    if (!confirm.confirmed) {
      await writeAdminAudit(session, {
        action: "USER_EXPORT_FAILED",
        entityType: "User",
        entityId: "bulk",
        metadata: {
          operation: "users_export",
          status: "failed",
          reason: "step_up_failed",
          requiresMfa: Boolean(confirm.requiresMfa),
        },
        request: requestMeta,
      });
      return NextResponse.json({ error: confirm.error, requiresPassword: true, requiresMfa: confirm.requiresMfa || undefined }, { status: 403 });
    }

    const includeDeleted = Boolean(body?.includeDeleted);
    const userClient = includeDeleted ? prismaUnsafe : prisma;
    const where = includeDeleted ? {} : { deletedAt: null };

    const users = await userClient.user.findMany({
      where,
      take: MAX_EXPORT_ROWS,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        deletedAt: true,
        subscription: { select: { plan: true, status: true } },
      },
    });

    const unmaskedEmail = session.role === "SUPER_ADMIN";
    const header = [
      "id",
      "email",
      "first_name",
      "last_name",
      "joined_at",
      "deleted_at",
      "plan",
      "subscription_status",
    ];
    const rows = users.map((u: any) => [
      u.id,
      unmaskedEmail ? u.email : maskEmail(u.email),
      u.firstName || "",
      u.lastName || "",
      u.createdAt ? new Date(u.createdAt).toISOString() : "",
      u.deletedAt ? new Date(u.deletedAt).toISOString() : "",
      u.subscription?.plan || "",
      u.subscription?.status || "",
    ]);

    const csv = buildCsv(header, rows);

    await writeAdminAudit(session, {
      action: "USER_EXPORT_CREATED",
      entityType: "User",
      entityId: "bulk",
      metadata: {
        operation: "users_export",
        status: "success",
        rowCount: rows.length,
        includeDeleted,
        unmaskedEmail,
        truncated: rows.length >= MAX_EXPORT_ROWS,
      },
      request: requestMeta,
    });

    const filename = `users-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        // text/csv with explicit utf-8 charset so non-ASCII names render
        // correctly in Excel (which assumes UTF-16 otherwise).
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": contentDispositionAttachment(filename, "users.csv"),
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
    console.error("Failed to export users:", error?.message || error);
    return NextResponse.json({ error: "Failed to export users" }, { status: 500 });
  }
}
