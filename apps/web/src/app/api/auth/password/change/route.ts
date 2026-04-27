import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireDbUserId,
  verifyPassword,
  hashPassword,
  validatePasswordPolicy,
  destroyAllUserSessions,
  createUserSession,
  generateFingerprint,
} from "@/lib/user-auth";
import { resolveClientIP } from "@/lib/rate-limit";
import { sendSecurityNoticeEmail } from "@/lib/email-service";

export const runtime = "nodejs";

const schema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().max(200),
});

export async function PATCH(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireDbUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const policyError = validatePasswordPolicy(parsed.data.newPassword);
  if (policyError) return NextResponse.json({ error: policyError }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, firstName: true, preferredLocale: true, passwordHash: true },
  });
  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: "Password change requires an existing password." }, { status: 400 });
  }

  const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 403 });
  }

  const newHash = await hashPassword(parsed.data.newPassword);
  const changedAt = new Date();
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } });

  // Invalidate all sessions, then issue a fresh session for this device so the
  // user stays logged in here.
  await destroyAllUserSessions(userId);

  const ua = request.headers.get("user-agent") || "";
  const ip = resolveClientIP(request);
  const fp = await generateFingerprint(ip, ua);
  await createUserSession({ userId, email: user.email, fingerprint: fp, ipAddress: ip, userAgent: ua });

  void sendSecurityNoticeEmail({
    userEmail: user.email,
    userName: user.firstName || "there",
    kind: "password-changed",
    occurredAt: changedAt,
    locale: user.preferredLocale,
    dedupeKey: `pwd-changed:${userId}:${changedAt.getTime()}`,
  }).catch((err) => console.error("[AUTH] password-changed email failed:", err));

  return NextResponse.json({ success: true });
}
