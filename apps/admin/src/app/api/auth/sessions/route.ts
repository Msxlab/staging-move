import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { expireAdminSessionCookies, requireAdmin, requirePasswordConfirm, requireRole } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";

// GET /api/auth/sessions — list active admin sessions
export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const all = searchParams.get("all") === "true";

        // SUPER_ADMIN can see all sessions, others see only their own
    let isSuperAdmin = false;
    try {
      await requireRole("SUPER_ADMIN");
      isSuperAdmin = true;
    } catch {}

    const where: any = { isActive: true };
    if (!all || !isSuperAdmin) {
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

    return NextResponse.json({
      sessions: sessions.map((s: any) => ({
        id: s.id,
        adminUser: s.adminUser,
        ipAddress: s.ipAddress,
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
    const { action, sessionId, revokeAll, confirmPassword, mfaCode, backupCode } = body || {};

    const requireSessionStepUp = async (operation: string) => {
      const confirm = await requirePasswordConfirm(session, confirmPassword, {
        operation,
        requireMfa: true,
        mfaCode,
        backupCode,
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
      });
      if (confirm.confirmed) return null;
      return NextResponse.json(
        {
          error: confirm.error || "Password and MFA confirmation required",
          requiresPassword: true,
          requiresMfa: confirm.requiresMfa || undefined,
        },
        { status: confirm.rateLimited ? 429 : 403 },
      );
    };

        if (action === "revoke" && sessionId) {
      const target = await prisma.adminSession.findUnique({ where: { id: sessionId } });
      if (!target) return NextResponse.json({ error: "Session not found" }, { status: 404 });

      // Only SUPER_ADMIN can revoke other admins' sessions
      if (target.adminUserId !== session.adminId) {
        try { await requireRole("SUPER_ADMIN"); } catch {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const stepUpFailure = await requireSessionStepUp("admin_session_revoke_other");
        if (stepUpFailure) return stepUpFailure;
      }

      await prisma.adminSession.update({
        where: { id: sessionId },
        data: { isActive: false },
      });

      const currentSessionRevoked = sessionId === session.sessionId;
      await writeAdminAudit(session, {
        action: "SESSION_REVOKED",
        entityType: "AdminSession",
        entityId: sessionId,
        metadata: {
          operation: target.adminUserId === session.adminId ? "admin_session_revoke_self" : "admin_session_revoke_other",
          targetAdminId: target.adminUserId,
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
        action: "ALL_SESSIONS_REVOKED",
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
