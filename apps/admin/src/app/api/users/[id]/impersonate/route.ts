import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, requirePasswordConfirm } from "@/lib/auth";
import { notifyUserOfAdminChange } from "@/lib/user-notify";
import { getInternalCallerSecret } from "@/lib/internal-secrets";
import { getAdminRuntimeConfigValue } from "@/lib/runtime-config";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import { maskEmail } from "@/lib/privacy";

export const runtime = "nodejs";

/**
 * POST /api/users/:id/impersonate
 *
 * Starts a 15-minute "act-as" session for a target user.
 *
 * Guardrails:
 *  - SUPER_ADMIN only — MODERATOR / ADMIN roles cannot impersonate.
 *  - Step-up password confirmation. The admin must re-enter their
 *    password in the same request; this is the same pattern used by
 *    destructive routes (delete user, backup import).
 *  - Every impersonation writes an AdminAuditLog row with action
 *    IMPERSONATION_START and creates a Notification for the target user
 *    so they're informed about the access.
 *  - Cross-app handoff is done through the web app's internal endpoint
 *    authenticated by IMPERSONATION_HANDOFF_SECRET.
 *
 * The response contains a `handoffUrl` plus a short-lived handoff token.
 * Clients must POST the token to the web app; it is never embedded in a URL.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requirePermission("users", "canUpdate", {
      minimumRole: "SUPER_ADMIN",
    });

    const { id: userId } = await params;

    // Step-up auth — impersonation is privileged.
    let confirmPassword: string | undefined;
    let mfaCode: string | undefined;
    let backupCode: string | undefined;
    let reason: string | undefined;
    const requestMeta = getAuditRequestMeta(request);
    try {
      const body = await request.json();
      confirmPassword = body?.confirmPassword;
      mfaCode = typeof body?.mfaCode === "string" ? body.mfaCode : undefined;
      backupCode = typeof body?.backupCode === "string" ? body.backupCode : undefined;
      reason = typeof body?.reason === "string" ? body.reason.slice(0, 500) : undefined;
    } catch {
      /* no body is fine — confirm will fail below */
    }
    const confirm = await requirePasswordConfirm(session, confirmPassword, {
      operation: "user_impersonation",
      requireMfa: true,
      mfaCode,
      backupCode,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
    if (!confirm.confirmed) {
      await writeAdminAudit(session, {
        action: "USER_IMPERSONATION_FAILED",
        entityType: "User",
        entityId: userId,
        metadata: {
          operation: "user_impersonation",
          status: "failed",
          reason: "step_up_failed",
          requiresMfa: Boolean(confirm.requiresMfa),
        },
        request: requestMeta,
      });
      return NextResponse.json(
        { error: confirm.error, requiresPassword: true, requiresMfa: confirm.requiresMfa || undefined },
        { status: 403 },
      );
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, email: true, firstName: true },
    });
    if (!user) {
      await writeAdminAudit(session, {
        action: "USER_IMPERSONATION_FAILED",
        entityType: "User",
        entityId: userId,
        metadata: {
          operation: "user_impersonation",
          status: "failed",
          reason: "target_not_found_or_deleted",
        },
        request: requestMeta,
      });
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Call the web app's internal impersonation endpoint. This is the
    // only place where a user JWT is minted on behalf of an admin —
    // keeping that logic in the web app means admin containers never
    // need USER_JWT_SECRET.
    const appUrl = await getAdminRuntimeConfigValue("NEXT_PUBLIC_APP_URL");
    const webBase =
      appUrl ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.WEB_INTERNAL_URL ||
      "http://web:3000";
    const handoffSecret = getInternalCallerSecret("impersonation");
    if (!handoffSecret) {
      await writeAdminAudit(session, {
        action: "USER_IMPERSONATION_FAILED",
        entityType: "User",
        entityId: user.id,
        metadata: {
          operation: "user_impersonation",
          status: "failed",
          reason: "handoff_secret_missing",
          maskedEmail: maskEmail(user.email),
        },
        request: requestMeta,
      });
      return NextResponse.json(
        {
          error:
            "Impersonation is unavailable (IMPERSONATION_HANDOFF_SECRET not configured)",
        },
        { status: 503 },
      );
    }

    const internalRes = await fetch(`${webBase}/api/internal/impersonate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${handoffSecret}`,
      },
      body: JSON.stringify({
        userId: user.id,
        adminId: session.adminId,
        ttlMinutes: 15,
      }),
    }).catch((err) => {
      return new Response(JSON.stringify({ error: err?.message || "fetch failed" }), { status: 502 });
    });

    if (!internalRes.ok) {
      const detail = await internalRes.text().catch(() => "");
      await writeAdminAudit(session, {
        action: "USER_IMPERSONATION_FAILED",
        entityType: "User",
        entityId: user.id,
        metadata: {
          operation: "user_impersonation",
          status: "failed",
          reason: "handoff_failed",
          handoffStatus: internalRes.status,
          maskedEmail: maskEmail(user.email),
        },
        request: requestMeta,
      });
      return NextResponse.json(
        { error: "Failed to start impersonation session", detail: detail.slice(0, 300) },
        { status: 502 },
      );
    }
    const handoff = (await internalRes.json()) as {
      token: string;
      handoffUrl: string;
      expiresAt: string;
    };

    // Audit trail — who impersonated whom, when, and why.
    await writeAdminAudit(session, {
      action: "USER_IMPERSONATION_STARTED",
      entityType: "User",
      entityId: user.id,
      metadata: {
        operation: "user_impersonation",
        status: "success",
        maskedEmail: maskEmail(user.email),
        expiresAt: handoff.expiresAt,
        reasonLength: reason?.length || 0,
      },
      request: requestMeta,
    });

    // Transparency to the user (GDPR-aligned). Uses the same helper that
    // sends admin-edit notifications, so impersonation shows up in the
    // user's in-app notification feed + email.
    await notifyUserOfAdminChange({
      userId: user.id,
      changes: {
        impersonationStarted: {
          from: null,
          to: `until ${handoff.expiresAt}${reason ? ` — "${reason}"` : ""}`,
        },
      },
      actorAdminId: session.adminId,
    });

    return NextResponse.json({
      handoffUrl: handoff.handoffUrl,
      handoffMethod: "POST",
      handoffToken: handoff.token,
      expiresAt: handoff.expiresAt,
      userEmail: user.email,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Impersonation failed:", error);
    return NextResponse.json(
      { error: "Impersonation failed" },
      { status: 500 },
    );
  }
}
