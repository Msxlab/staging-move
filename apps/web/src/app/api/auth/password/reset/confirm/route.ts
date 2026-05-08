import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  hashOpaqueToken,
  hashPassword,
  validatePasswordPolicy,
  destroyAllUserSessions,
} from "@/lib/user-auth";
import { enforceRateLimitPolicy, stableRateLimitHash } from "@/lib/rate-limit-policy";
import { sendSecurityNoticeEmail } from "@/lib/email-service";
import { extractRequestMeta } from "@/lib/audit";
import { recordUserSecurityAudit } from "@/lib/user-security-audit";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(10).max(200),
  newPassword: z.string().max(200),
});

function invalidResetLink() {
  return NextResponse.json(
    { error: "This reset link is invalid or already used." },
    { status: 400 },
  );
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const rl = await enforceRateLimitPolicy(request, "password_reset", {
    routeId: "password_reset_confirm",
    extra: stableRateLimitHash(parsed.data.token),
  });
  if (!rl.success) {
    return NextResponse.json(
      { code: rl.policy.userFacingErrorCode, error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  const policyError = validatePasswordPolicy(parsed.data.newPassword);
  if (policyError) return NextResponse.json({ error: policyError }, { status: 400 });

  const tokenHash = hashOpaqueToken(parsed.data.token);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!record || record.usedAt) {
    return invalidResetLink();
  }
  if (record.expiresAt.getTime() < Date.now()) {
    return NextResponse.json(
      { error: "This reset link has expired. Please request a new one." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findFirst({
    where: { id: record.userId, deletedAt: null },
    select: { id: true, email: true, firstName: true, preferredLocale: true },
  });
  if (!user) {
    return invalidResetLink();
  }

  const newHash = await hashPassword(parsed.data.newPassword);
  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({
        where: {
          id: record.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) {
        throw new Error("RESET_TOKEN_NOT_CLAIMED");
      }

      await tx.user.update({
        where: { id: record.userId },
        data: {
          passwordHash: newHash,
          emailVerifiedAt: now,
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "RESET_TOKEN_NOT_CLAIMED") {
      return invalidResetLink();
    }
    throw error;
  }

  await destroyAllUserSessions(record.userId);

  recordUserSecurityAudit({
    userId: record.userId,
    action: "PWRESET_DONE",
    entityId: record.userId,
    changes: { status: "completed" },
    ...extractRequestMeta(request),
  });

  void sendSecurityNoticeEmail({
    userEmail: user.email,
    userName: user.firstName || "there",
    kind: "password-changed",
    occurredAt: now,
    locale: user.preferredLocale,
    dedupeKey: `pwd-changed:${record.id}`,
  }).catch((err) => console.error("[AUTH] password-changed email failed:", err));

  return NextResponse.json({ success: true });
}
