import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashSessionToken, shouldUseSecureSessionCookies } from "@/lib/user-auth";
import { getUserJwtSecretKey } from "@/lib/user-jwt-secret";

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
  const session = await prisma.userLoginSession.findFirst({
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

  if (!session) {
    return NextResponse.redirect(
      new URL("/sign-in?err=impersonation-session-missing", request.url),
    );
  }
  if (session.expiresAt.getTime() <= Date.now()) {
    return NextResponse.redirect(
      new URL("/sign-in?err=impersonation-expired", request.url),
    );
  }

  // Audit breadcrumb — one row per successful handoff. The admin app already
  // logs the "impersonate started" event at ticket-creation time; this row
  // confirms the cookie was actually exchanged into a browser session.
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
  const maxAgeSec = Math.max(
    1,
    Math.floor((session.expiresAt.getTime() - Date.now()) / 1000),
  );
  response.cookies.set("user_session", token, {
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
