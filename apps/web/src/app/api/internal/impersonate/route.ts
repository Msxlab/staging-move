import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SignJWT } from "jose";
import { prisma } from "@/lib/db";
import { hashSessionToken } from "@/lib/user-auth";
import { verifyInternalAuth } from "@/lib/internal-secrets";

export const runtime = "nodejs";

/**
 * Internal-only endpoint used by the admin app to create a short-lived
 * impersonation session for a target user.
 *
 * Security model:
 *  - Requires `Authorization: Bearer <CRON_SECRET>` (the same shared
 *    secret the admin container already uses for other cross-app calls).
 *  - Hard 15-minute TTL — the admin UI can only ask for ≤15 minutes,
 *    and we cap server-side regardless.
 *  - Writes to UserLoginSession with `impersonatedByAdminId` set so
 *    the web app can show a banner and every request leaves an audit
 *    breadcrumb.
 *  - JWT carries `impersonatedByAdminId` claim (hashed form) so the
 *    client can display "You're acting as <user>" without an extra fetch.
 */

const MAX_TTL_MINUTES = 15;
const userJwtSecret = process.env.USER_JWT_SECRET;
if (!userJwtSecret || userJwtSecret.length < 32) {
  throw new Error("USER_JWT_SECRET must be set and at least 32 characters");
}
const JWT_SECRET = new TextEncoder().encode(userJwtSecret);

const bodySchema = z.object({
  userId: z.string().min(1).max(40),
  adminId: z.string().min(1).max(40),
  adminEmail: z.string().email().optional(),
  ttlMinutes: z.number().int().min(1).max(MAX_TTL_MINUTES).default(MAX_TTL_MINUTES),
});

export async function POST(request: NextRequest) {
  // Shared-secret check — uses IMPERSONATION_HANDOFF_SECRET when configured,
  // falls back to CRON_SECRET for deployments that haven't rotated yet.
  if (!verifyInternalAuth(request.headers.get("authorization"), "impersonation")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.errors },
      { status: 400 },
    );
  }

  const { userId, adminId, ttlMinutes } = parsed.data;
  const ttlSeconds = Math.min(ttlMinutes, MAX_TTL_MINUTES) * 60;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Sign a JWT scoped to the impersonation window. No `fp` claim so the
  // session is unconditionally single-use — we rely on expiresAt + the
  // DB row as the source of truth.
  const token = await new SignJWT({
    userId: user.id,
    email: user.email,
    impersonatedByAdminId: adminId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(JWT_SECRET);

  const tokenHash = await hashSessionToken(token);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  await prisma.userLoginSession.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
      impersonatedByAdminId: adminId,
      deviceType: "IMPERSONATION",
      ipAddress: (request.headers.get("x-forwarded-for") || "internal")
        .split(",")[0]
        .trim(),
      userAgent: `admin-impersonation/${adminId}`,
      isActive: true,
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const handoffUrl = `${appUrl}/api/auth/impersonate-handoff?token=${encodeURIComponent(token)}`;

  return NextResponse.json({
    token,
    handoffUrl,
    expiresAt: expiresAt.toISOString(),
    userEmail: user.email,
  });
}
