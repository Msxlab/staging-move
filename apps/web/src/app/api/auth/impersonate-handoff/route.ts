import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashSessionToken, shouldUseSecureSessionCookies } from "@/lib/user-auth";
import { getUserJwtSecretKey } from "@/lib/user-jwt-secret";
import {
  isMissingDbColumnError,
  warnSchemaCompatibilityFallback,
} from "@/lib/db-schema-compat";

export const runtime = "nodejs";

const handoffSchema = z.object({
  token: z.string().min(20).max(4096),
});

/**
 * Exchanges a short-lived admin impersonation JWT for a user_session cookie.
 * The token is accepted only in a POST body so it does not land in browser
 * history, Referer headers, proxy URLs, or access logs.
 */
async function exchangeImpersonationToken(request: NextRequest, token: string) {
  let payload: Record<string, unknown>;
  try {
    const verified = await jwtVerify(token, getUserJwtSecretKey(), {
      algorithms: ["HS256"],
    });
    payload = verified.payload as Record<string, unknown>;
  } catch {
    return NextResponse.redirect(
      new URL("/sign-in?err=impersonation-invalid-token", request.url),
    );
  }

  if (
    typeof payload.impersonatedByAdminId !== "string" ||
    typeof payload.userId !== "string"
  ) {
    return NextResponse.redirect(
      new URL("/sign-in?err=impersonation-bad-claims", request.url),
    );
  }

  const tokenHash = await hashSessionToken(token);
  const adminId = payload.impersonatedByAdminId;
  let session: {
    id: string;
    userId: string;
    expiresAt: Date;
    impersonatedByAdminId?: string | null;
  } | null = null;
  try {
    session = await prisma.userLoginSession.findFirst({
      where: {
        tokenHash,
        isActive: true,
        impersonatedByAdminId: { not: null },
      },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        impersonatedByAdminId: true,
      },
    });
  } catch (error) {
    if (!isMissingDbColumnError(error, "impersonatedByAdminId")) throw error;
    warnSchemaCompatibilityFallback("impersonation-handoff:session-read", error);
    session = await prisma.userLoginSession.findFirst({
      where: { tokenHash, isActive: true },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
      },
    });
    if (session) {
      session.impersonatedByAdminId = adminId;
    }
  }

  if (!session || session.userId !== payload.userId) {
    return NextResponse.redirect(
      new URL("/sign-in?err=impersonation-session-missing", request.url),
    );
  }
  if (session.expiresAt.getTime() <= Date.now()) {
    return NextResponse.redirect(
      new URL("/sign-in?err=impersonation-expired", request.url),
    );
  }

  // Consume the short-lived handoff row before minting a browser session so
  // the handoff token cannot be replayed for its full JWT TTL.
  const now = new Date();
  const consumed = await prisma.userLoginSession.updateMany({
    where: {
      id: session.id,
      isActive: true,
      expiresAt: { gt: now },
    },
    data: {
      isActive: false,
      lastActivity: now,
    },
  });
  if (consumed.count !== 1) {
    return NextResponse.redirect(
      new URL("/sign-in?err=impersonation-session-consumed", request.url),
    );
  }

  const maxAgeSec = Math.max(
    1,
    Math.floor((session.expiresAt.getTime() - now.getTime()) / 1000),
  );
  const browserToken = await new SignJWT({
    userId: session.userId,
    email: typeof payload.email === "string" ? payload.email : undefined,
    impersonatedByAdminId: session.impersonatedByAdminId || adminId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSec}s`)
    .sign(getUserJwtSecretKey());
  const browserTokenHash = await hashSessionToken(browserToken);
  const sessionIpAddress = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
  const sessionUserAgent = request.headers.get("user-agent")?.trim() || "unknown";
  try {
    await prisma.userLoginSession.create({
      data: {
        userId: session.userId,
        tokenHash: browserTokenHash,
        ipAddress: sessionIpAddress,
        userAgent: sessionUserAgent,
        expiresAt: session.expiresAt,
        impersonatedByAdminId: session.impersonatedByAdminId || adminId,
      },
    });
  } catch (error) {
    if (!isMissingDbColumnError(error, "impersonatedByAdminId")) throw error;
    warnSchemaCompatibilityFallback("impersonation-handoff:session-create", error);
    await prisma.userLoginSession.create({
      data: {
        userId: session.userId,
        tokenHash: browserTokenHash,
        ipAddress: sessionIpAddress,
        userAgent: sessionUserAgent,
        expiresAt: session.expiresAt,
      },
    });
  }

  // Audit breadcrumb for successful exchanges. The admin app logs ticket
  // creation; this confirms the browser cookie was actually issued.
  if (session.impersonatedByAdminId) {
    const ipAddress = (request.headers.get("x-forwarded-for") || "")
      .split(",")[0]
      .trim();
    await prisma.adminAuditLog
      .create({
        data: {
          adminUserId: session.impersonatedByAdminId,
          action: "IMPERSONATE_HANDOFF",
          entityType: "User",
          entityId: session.userId,
          changes: JSON.stringify({
            sessionId: session.id,
            expiresAt: session.expiresAt.toISOString(),
          }),
          ipAddress: ipAddress || null,
        },
      })
      .catch(() => null);
  }

  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  response.cookies.set("user_session", browserToken, {
    httpOnly: true,
    secure: shouldUseSecureSessionCookies(),
    sameSite: "lax",
    maxAge: maxAgeSec,
    path: "/",
  });
  return response;
}

export async function POST(request: NextRequest) {
  const parsed = handoffSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.redirect(
      new URL("/sign-in?err=impersonation-missing-token", request.url),
    );
  }

  return exchangeImpersonationToken(request, parsed.data.token);
}

export async function GET(request: NextRequest) {
  return NextResponse.redirect(
    new URL("/sign-in?err=impersonation-post-required", request.url),
  );
}
