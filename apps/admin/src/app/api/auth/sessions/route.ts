import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { expireAdminSessionCookies, requireAdmin, requirePasswordConfirm, requirePermission, requireRole } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import { maskEmail, maskIpAddress } from "@/lib/privacy";

const REVOKE_HANDLE_TTL_MS = 5 * 60 * 1000;

function getRevokeHandleSecret() {
  return process.env.ADMIN_SESSION_HANDLE_SECRET
    || process.env.ADMIN_JWT_SECRET
    || process.env.JWT_SECRET
    || process.env.AUTH_SECRET
    || "dev-admin-session-revoke-handle-secret";
}

function hmacBase64Url(value: string) {
  return createHmac("sha256", getRevokeHandleSecret())
    .update(value)
    .digest("base64url");
}

function displayIdFromSessionId(sessionId: string) {
  return `sess_${hmacBase64Url(`display:${sessionId}`).slice(0, 10)}`;
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function createRevokeHandle(target: { id: string; adminUserId: string }, issuedToAdminId: string, allScope: boolean) {
  const expiresAt = Date.now() + REVOKE_HANDLE_TTL_MS;
  const scope = allScope ? "all" : "self";
  const signature = hmacBase64Url([
    "admin-session-revoke",
    target.id,
    target.adminUserId,
    issuedToAdminId,
    scope,
    expiresAt,
  ].join(":"));
  return `${expiresAt}.${scope}.${signature}`;
}

function parseRevokeHandle(raw: unknown): { expiresAt: number; scope: "all" | "self"; signature: string } | null {
  if (typeof raw !== "string") return null;
  const [expiresRaw, scopeRaw, signature] = raw.split(".");
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;
  if (scopeRaw !== "all" && scopeRaw !== "self") return null;
  if (!signature || signature.length < 32) return null;
  return { expiresAt, scope: scopeRaw, signature };
}

async function resolveRevokeHandle(
  rawHandle: unknown,
  session: { adminId: string },
  allScope: boolean,
): Promise<any | null> {
  const handle = parseRevokeHandle(rawHandle);
  if (!handle || handle.scope !== (allScope ? "all" : "self")) return null;

  const candidates = await prisma.adminSession.findMany({
    where: {
      isActive: true,
      ...(allScope ? {} : { adminUserId: session.adminId }),
    },
    take: 500,
  });

  return candidates.find((candidate: any) => {
    const expected = hmacBase64Url([
      "admin-session-revoke",
      candidate.id,
      candidate.adminUserId,
      session.adminId,
      handle.scope,
      handle.expiresAt,
    ].join(":"));
    return safeEqual(expected, handle.signature);
  }) || null;
}

// GET /api/auth/sessions — list active admin sessions
export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const requestMeta = getAuditRequestMeta(request);
    const { searchParams } = new URL(request.url);
    const all = searchParams.get("all") === "true";

    let isSuperAdmin = false;
    if (all) {
      await requirePermission("audit_logs", "canRead", { minimumRole: "SUPER_ADMIN" });
      isSuperAdmin = true;
    } else {
      try {
        await requireRole("SUPER_ADMIN");
        isSuperAdmin = true;
      } catch {}
    }
    const unmasked = isSuperAdmin;

    const where: any = { isActive: true };
    if (!all) {
      where.adminUserId = session.adminId;
    }

    const sessions = await prisma.adminSession.findMany({
      where,
      include: {
        adminUser: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
      },
      orderBy: { lastActivity: "desc" },
      take: 100,
    });

    // Clean up expired sessions
    await prisma.adminSession.updateMany({
      where: { expiresAt: { lt: new Date() }, isActive: true },
      data: { isActive: false },
    });

    await writeAdminAudit(session, {
      action: "SECURITY_SESSIONS_VIEWED",
      entityType: "AdminSession",
      entityId: all ? "all" : "self",
      metadata: {
        scope: all ? "all" : "self",
        rowCount: sessions.length,
        crossAdmin: all,
      },
      request: requestMeta,
    });

    return NextResponse.json({
      sessions: sessions.map((s: any) => ({
        displayId: displayIdFromSessionId(s.id),
        revokeHandle: createRevokeHandle(s, session.adminId, all),
        adminUser: s.adminUser ? {
          ...s.adminUser,
          email: unmasked ? s.adminUser.email : maskEmail(s.adminUser.email),
        } : null,
        ipAddress: unmasked ? s.ipAddress : maskIpAddress(s.ipAddress),
        browser: s.browser,
        os: s.os,
        deviceType: s.deviceType,
        country: s.country,
        city: s.city,
        isActive: s.isActive,
        isCurrent: s.id === session.sessionId,
        lastActivity: s.lastActivity,
        expiresAt: s.expiresAt,
        createdAt: s.createdAt,
      })),
      currentAdminId: session.adminId,
      isSuperAdmin,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("Sessions fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }
}

// POST /api/auth/sessions — revoke a session
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const requestMeta = getAuditRequestMeta(request);
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { action, revokeAll, confirmPassword, mfaCode, backupCode } = body || {};
    const sessionHandle = body?.sessionHandle || body?.revokeHandle;

    const requireSessionStepUp = async (operation: string, targetDisplayId = "session") => {
      const confirm = await requirePasswordConfirm(session, confirmPassword, {
        operation,
        requireMfa: true,
        mfaCode,
        backupCode,
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
      });
      if (confirm.confirmed) return null;
      await writeAdminAudit(session, {
        action: "SECURITY_ACTION_FAILED",
        entityType: "AdminSession",
        entityId: targetDisplayId,
        metadata: {
          operation,
          status: "failed",
          reasonCode: confirm.requiresMfa ? "mfa_required_or_invalid" : "step_up_failed",
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
    };

    if (action === "revoke" && sessionHandle) {
      let target = await resolveRevokeHandle(sessionHandle, session, false);
      let crossAdmin = false;

      if (!target) {
        try { await requireRole("SUPER_ADMIN"); } catch {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        target = await resolveRevokeHandle(sessionHandle, session, true);
        if (!target) return NextResponse.json({ error: "Invalid or expired session handle" }, { status: 400 });
        crossAdmin = target.adminUserId !== session.adminId;
      }

      const targetDisplayId = displayIdFromSessionId(target.id);

      // Only SUPER_ADMIN can revoke other admins' sessions, and it requires step-up.
      if (crossAdmin) {
        const stepUpFailure = await requireSessionStepUp("admin_session_revoke_other", targetDisplayId);
        if (stepUpFailure) return stepUpFailure;
      }

      await prisma.adminSession.update({
        where: { id: target.id },
        data: { isActive: false },
      });

      const currentSessionRevoked = target.id === session.sessionId;
      await writeAdminAudit(session, {
        action: "SECURITY_SESSION_REVOKED",
        entityType: "AdminSession",
        entityId: targetDisplayId,
        metadata: {
          operation: target.adminUserId === session.adminId ? "admin_session_revoke_self" : "admin_session_revoke_other",
          targetAdminId: target.adminUserId,
          targetSessionDisplayId: targetDisplayId,
          currentSessionRevoked,
        },
        request: requestMeta,
      });

      const response = NextResponse.json({ success: true });
      return currentSessionRevoked
        ? expireAdminSessionCookies(response, request.headers.get("host"))
        : response;
    }

    if (action === "revoke_all") {
      const targetAdminId = revokeAll === "all" ? undefined : session.adminId;

      // Only SUPER_ADMIN can revoke all admins' sessions
      if (revokeAll === "all") {
        try { await requireRole("SUPER_ADMIN"); } catch {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const stepUpFailure = await requireSessionStepUp("admin_session_revoke_all");
        if (stepUpFailure) return stepUpFailure;
      }

      const where: any = { isActive: true };
      if (targetAdminId) where.adminUserId = targetAdminId;

      const result = await prisma.adminSession.updateMany({
        where,
        data: { isActive: false },
      });

      const currentSessionRevoked = revokeAll === "all" || targetAdminId === session.adminId;
      await writeAdminAudit(session, {
        action: "SECURITY_SESSION_REVOKED",
        entityType: "AdminSession",
        entityId: session.adminId,
        metadata: {
          operation: revokeAll === "all" ? "admin_session_revoke_all" : "admin_session_revoke_self",
          scope: revokeAll || "self",
          count: result.count,
          currentSessionRevoked,
        },
        request: requestMeta,
      });

      const response = NextResponse.json({ success: true, revoked: result.count });
      return currentSessionRevoked
        ? expireAdminSessionCookies(response, request.headers.get("host"))
        : response;
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
