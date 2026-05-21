import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  getUserSession,
  generateOpaqueToken,
  hashPassword,
  validatePasswordPolicy,
} from "@/lib/user-auth";
import { sendPasswordResetEmail, sendSecurityNoticeEmail } from "@/lib/email-service";

export const runtime = "nodejs";

const setPasswordSchema = z.object({
  action: z.literal("set_password"),
  newPassword: z.string().max(200),
});

const requestSetPasswordSchema = z.object({
  action: z.literal("request_set_password"),
});

const revokeSessionSchema = z.object({
  action: z.literal("revoke_session"),
  sessionId: z.string().min(1).max(30),
});

const revokeOtherSessionsSchema = z.object({
  action: z.literal("revoke_other_sessions"),
});

const actionSchema = z.discriminatedUnion("action", [
  setPasswordSchema,
  requestSetPasswordSchema,
  revokeSessionSchema,
  revokeOtherSessionsSchema,
]);

function serializeLoginSession(session: any, currentSessionId?: string) {
  return {
    id: session.id,
    current: session.id === currentSessionId,
    browser: session.browser,
    os: session.os,
    deviceType: session.deviceType,
    ipAddress: session.ipAddress,
    userAgent: session.userAgent,
    isActive: session.isActive,
    expiresAt: session.expiresAt,
    lastActivity: session.lastActivity,
    createdAt: session.createdAt,
    impersonated: Boolean(session.impersonatedByAdminId),
  };
}

async function loadSecurityState(userId: string, currentSessionId?: string) {
  const [user, oauthAccounts, loginSessions, latestVerificationToken, latestPasswordReset] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          passwordHash: true,
          emailVerifiedAt: true,
          mfaEnabled: true,
          preferredLocale: true,
          createdAt: true,
        },
      }),
      prisma.oAuthAccount.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: { id: true, provider: true, createdAt: true },
      }),
      prisma.userLoginSession.findMany({
        where: { userId },
        orderBy: [{ isActive: "desc" }, { lastActivity: "desc" }],
        take: 20,
        select: {
          id: true,
          browser: true,
          os: true,
          deviceType: true,
          ipAddress: true,
          userAgent: true,
          isActive: true,
          expiresAt: true,
          lastActivity: true,
          createdAt: true,
        },
      }),
      prisma.emailVerificationToken.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { email: true, expiresAt: true, consumedAt: true, createdAt: true },
      }),
      prisma.passwordResetToken.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { expiresAt: true, usedAt: true, createdAt: true },
      }),
    ]);

  if (!user) return null;

  const hasPasswordLogin = Boolean(user.passwordHash);
  const linkedMethods = [
    {
      type: "password",
      label: "Password",
      enabled: hasPasswordLogin,
      linkedAt: hasPasswordLogin ? user.createdAt : null,
    },
    ...oauthAccounts.map((account: { provider: string; createdAt: Date }) => ({
      type: account.provider,
      label: account.provider === "google" ? "Google" : account.provider === "apple" ? "Apple" : account.provider,
      enabled: true,
      linkedAt: account.createdAt,
    })),
  ];

  return {
    account: {
      id: user.id,
      email: user.email,
      emailVerified: Boolean(user.emailVerifiedAt),
      emailVerifiedAt: user.emailVerifiedAt,
      hasPasswordLogin,
      mfaEnabled: user.mfaEnabled,
      preferredLocale: user.preferredLocale,
      createdAt: user.createdAt,
    },
    linkedMethods,
    sessions: loginSessions.map((item: any) => serializeLoginSession(item, currentSessionId)),
    recovery: {
      latestVerificationToken,
      latestPasswordReset,
    },
    capabilities: {
      canSetPassword: !hasPasswordLogin,
      canChangePassword: hasPasswordLogin,
      canManageMfa: hasPasswordLogin,
      canRevokeSessions: true,
    },
  };
}

function getRequestIp(request: NextRequest): string {
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export async function GET() {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = await loadSecurityState(session.userId, session.sessionId);
  if (!state) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(state);
}

export async function POST(request: NextRequest) {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid account security action" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      preferredLocale: true,
      passwordHash: true,
      emailVerifiedAt: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const ipAddress = getRequestIp(request);
  const userAgent = request.headers.get("user-agent") || null;

  if (parsed.data.action === "set_password") {
    if (user.passwordHash) {
      return NextResponse.json(
        { error: "This account already has a password. Use change password instead." },
        { status: 400 },
      );
    }

    if (!user.emailVerifiedAt) {
      return NextResponse.json(
        { error: "Verify your email before setting a password." },
        { status: 400 },
      );
    }

    const policyError = validatePasswordPolicy(parsed.data.newPassword);
    if (policyError) {
      return NextResponse.json({ error: policyError }, { status: 400 });
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    const changedAt = new Date();
    await prisma.user.update({
      where: { id: session.userId },
      data: { passwordHash },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "SET_PWD_DONE",
        entityType: "User",
        entityId: session.userId,
        changes: JSON.stringify({ source: "account_security_inline" }),
        ipAddress,
        userAgent,
      },
    });

    void sendSecurityNoticeEmail({
      userEmail: user.email,
      userName: user.firstName || "there",
      kind: "password-set",
      occurredAt: changedAt,
      locale: user.preferredLocale,
      dedupeKey: `pwd-set:${session.userId}:${changedAt.getTime()}`,
    }).catch((err) => console.error("[AUTH] set-password notice failed:", err));

    const state = await loadSecurityState(session.userId, session.sessionId);
    return NextResponse.json({
      success: true,
      message: "Password set. You can now sign in with email and password.",
      ...state,
    });
  }

  if (parsed.data.action === "request_set_password") {
    if (user.passwordHash) {
      return NextResponse.json(
        { error: "This account already has a password. Use change password instead." },
        { status: 400 },
      );
    }

    if (!user.emailVerifiedAt) {
      return NextResponse.json(
        { error: "Verify your email before setting a password." },
        { status: 400 },
      );
    }

    const recentToken = await prisma.passwordResetToken.findFirst({
      where: {
        userId: session.userId,
        usedAt: null,
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });
    if (recentToken) {
      const state = await loadSecurityState(session.userId, session.sessionId);
      return NextResponse.json({
        success: true,
        message: "A password setup link was already sent recently. Check your email.",
        ...state,
      });
    }

    const { token, hash } = generateOpaqueToken();
    await prisma.passwordResetToken.create({
      data: {
        userId: session.userId,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "SET_PWD_REQ",
        entityType: "User",
        entityId: session.userId,
        changes: JSON.stringify({ source: "account_security_email" }),
        ipAddress,
        userAgent,
      },
    });

    await sendPasswordResetEmail({
      userEmail: user.email,
      userName: user.firstName || "there",
      resetToken: token,
      mode: "set-password",
      locale: user.preferredLocale,
      dedupeKey: `pwreset:${session.userId}:${hash}`,
    }).catch((err) => console.error("[AUTH] set-password email failed:", err));

    const state = await loadSecurityState(session.userId, session.sessionId);
    return NextResponse.json({
      success: true,
      message: "Password setup email sent. Check your inbox.",
      ...state,
    });
  }

  if (parsed.data.action === "revoke_session") {
    const result = await prisma.userLoginSession.updateMany({
      where: { id: parsed.data.sessionId, userId: session.userId, isActive: true },
      data: { isActive: false, lastActivity: new Date() },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Session not found or already inactive" }, { status: 404 });
    }

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "REVOKE_SESSION",
        entityType: "UserLoginSession",
        entityId: parsed.data.sessionId,
        changes: JSON.stringify({
          current: parsed.data.sessionId === session.sessionId,
        }),
        ipAddress,
        userAgent,
      },
    });

    return NextResponse.json({
      success: true,
      revoked: result.count,
      currentSessionRevoked: parsed.data.sessionId === session.sessionId,
    });
  }

  const result = await prisma.userLoginSession.updateMany({
    where: {
      userId: session.userId,
      isActive: true,
      ...(session.sessionId ? { id: { not: session.sessionId } } : {}),
    },
    data: { isActive: false, lastActivity: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: "REVOKE_OTHERS",
      entityType: "User",
      entityId: session.userId,
      changes: JSON.stringify({ revoked: result.count }),
      ipAddress,
      userAgent,
    },
  });

  const state = await loadSecurityState(session.userId, session.sessionId);
  return NextResponse.json({ success: true, revoked: result.count, ...state });
}
