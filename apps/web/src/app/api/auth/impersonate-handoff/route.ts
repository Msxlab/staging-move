import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { hashSessionToken } from "@/lib/user-auth";

export const runtime = "nodejs";

const userJwtSecret = process.env.USER_JWT_SECRET;
if (!userJwtSecret || userJwtSecret.length < 32) {
  throw new Error("USER_JWT_SECRET must be set and at least 32 characters");
}
const JWT_SECRET = new TextEncoder().encode(userJwtSecret);

/**
 * One-shot GET handler that accepts an impersonation token from the admin
 * UI and exchanges it for the `user_session` cookie on this origin. This
 * is the only path by which an impersonation session enters the browser —
 * `/api/auth/login` never issues one.
 *
 * Checks:
 *  - Token must verify against USER_JWT_SECRET and carry the
 *    `impersonatedByAdminId` claim.
 *  - A DB row must exist with the same tokenHash, be active, not expired,
 *    and carry a non-null `impersonatedByAdminId`.
 *  - On success we set the cookie and redirect to /dashboard.
 *
 * Failure cases redirect to /sign-in with an explanatory query param so
 * the operator sees what went wrong in the URL bar.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(
      new URL("/sign-in?err=impersonation-missing-token", request.url),
    );
  }

  let payload: Record<string, unknown>;
  try {
    const verified = await jwtVerify(token, JWT_SECRET);
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
    select: { id: true, userId: true, expiresAt: true },
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

  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  // Cookie lifetime mirrors the DB session so the browser and server
  // agree on when the impersonation window ends.
  const maxAgeSec = Math.max(
    1,
    Math.floor((session.expiresAt.getTime() - Date.now()) / 1000),
  );
  response.cookies.set("user_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: maxAgeSec,
    path: "/",
  });
  return response;
}
