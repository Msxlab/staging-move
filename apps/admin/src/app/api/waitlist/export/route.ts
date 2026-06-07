import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";
import { buildCsv } from "@/lib/csv-safety";
import { maskEmail } from "@/lib/privacy";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";

/**
 * Admin waitlist CSV export.
 *
 * Mirrors the hardened user export (`/api/users/export`): the waitlist holds
 * raw signup emails, so a bulk CSV is a high-impact PII leak vector. The
 * previous in-page Blob path serialized `signup.email` unmasked with no audit
 * trail. This route gates on the same permission as the waitlist GET
 * (`settings:canRead` with an `audit_logs` fallback and an ADMIN floor),
 * requires step-up password + MFA confirmation, masks the email column unless
 * the requester is SUPER_ADMIN, runs every field through the CSV-injection
 * guard, and writes an admin audit row on both success and failure.
 */
const MAX_EXPORT_ROWS = 50_000;

export async function POST(request: NextRequest) {
  const requestMeta = getAuditRequestMeta(request);
  try {
    const session = await requirePermission("settings", "canRead", {
      minimumRole: "ADMIN",
      fallbackResources: ["audit_logs"],
    });
    const body = await request.json().catch(() => ({}));

    const confirm = await requirePasswordConfirm(
      session,
      typeof body?.confirmPassword === "string" ? body.confirmPassword : undefined,
      {
        operation: "waitlist_export",
        requireMfa: true,
        mfaCode: typeof body?.mfaCode === "string" ? body.mfaCode : undefined,
        backupCode: typeof body?.backupCode === "string" ? body.backupCode : undefined,
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
      },
    );
    if (!confirm.confirmed) {
      await writeAdminAudit(session, {
        action: "WAITLIST_EXPORT_FAILED",
        entityType: "WaitlistSignup",
        entityId: "bulk",
        metadata: {
          operation: "waitlist_export",
          status: "failed",
          reason: "step_up_failed",
          requiresMfa: Boolean(confirm.requiresMfa),
        },
        request: requestMeta,
      });
      return NextResponse.json(
        {
          error: confirm.error || "Password and MFA confirmation required",
          requiresPassword: true,
          requiresMfa: confirm.requiresMfa || undefined,
        },
        { status: confirm.rateLimited ? 429 : 403 },
      );
    }

    const signups = await prisma.waitlistSignup.findMany({
      take: MAX_EXPORT_ROWS,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        target: true,
        source: true,
        userId: true,
        note: true,
        notifiedAt: true,
        convertedAt: true,
        createdAt: true,
      },
    });

    const unmaskedEmail = session.role === "SUPER_ADMIN";
    const header = [
      "id",
      "email",
      "target",
      "source",
      "user_id",
      "note",
      "notified_at",
      "converted_at",
      "created_at",
    ];
    const rows = signups.map((s: any) => [
      s.id,
      unmaskedEmail ? s.email : maskEmail(s.email),
      s.target,
      s.source || "",
      s.userId || "",
      s.note || "",
      s.notifiedAt ? new Date(s.notifiedAt).toISOString() : "",
      s.convertedAt ? new Date(s.convertedAt).toISOString() : "",
      s.createdAt ? new Date(s.createdAt).toISOString() : "",
    ]);

    const csv = buildCsv(header, rows);

    await writeAdminAudit(session, {
      action: "WAITLIST_EXPORT_CREATED",
      entityType: "WaitlistSignup",
      entityId: "bulk",
      metadata: {
        operation: "waitlist_export",
        status: "success",
        rowCount: rows.length,
        unmaskedEmail,
        truncated: rows.length >= MAX_EXPORT_ROWS,
      },
      request: requestMeta,
    });

    const filename = `waitlist-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;

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
    console.error("Failed to export waitlist:", error?.message || error);
    return NextResponse.json({ error: "Failed to export waitlist" }, { status: 500 });
  }
}
