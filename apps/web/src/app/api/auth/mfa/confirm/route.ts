import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/user-auth";
import { verifyTOTP } from "@/lib/totp";
import { decrypt } from "@/lib/shared-encryption";
import { enforceRateLimitPolicy } from "@/lib/rate-limit-policy";
import { sendSecurityNoticeEmail } from "@/lib/email-service";
import { extractRequestMeta } from "@/lib/audit";
import { recordUserSecurityAudit } from "@/lib/user-security-audit";
import { auditImpersonatedMutation, blockIfImpersonating } from "@/lib/impersonation-audit";

export const runtime = "nodejs";

const schema = z.object({
  mfaCode: z.string().length(6),
});

/**
 * POST /api/auth/mfa/confirm — finalize MFA enrollment.
 * User must provide a valid TOTP code proving they successfully set up an
 * authenticator app with the secret from /api/auth/mfa/setup.
 */
export async function POST(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireDbUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blocked = await blockIfImpersonating(request, { action: "MFA_CONFIRM", route: "/api/auth/mfa/confirm" });
  if (blocked) return blocked;

  const rl = await enforceRateLimitPolicy(request, "mfa_verify", {
    userId,
    routeId: "mfa_confirm",
  });
  if (!rl.success) {
    return NextResponse.json(
      { code: rl.policy.userFacingErrorCode, error: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid code" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, firstName: true, preferredLocale: true, mfaSecret: true, mfaEnabled: true },
  });
  if (!user || !user.mfaSecret) {
    return NextResponse.json({ error: "Call /api/auth/mfa/setup first." }, { status: 400 });
  }
  if (user.mfaEnabled) {
    return NextResponse.json({ error: "MFA already enabled." }, { status: 400 });
  }

  const secret = decrypt(user.mfaSecret);
  if (!secret) {
    return NextResponse.json({ error: "MFA configuration error." }, { status: 500 });
  }

  if (!verifyTOTP(secret, parsed.data.mfaCode)) {
    // 400 (validation), NOT 401: the bearer session is valid — only the typed
    // code is wrong. Mobile's ApiClient treats every 401 as session death and
    // force-logs-out, so a single mistyped enrollment digit must not be a 401.
    return NextResponse.json({ error: "Invalid MFA code." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { mfaEnabled: true },
  });

  recordUserSecurityAudit({
    userId,
    action: "MFA_ENABLED",
    entityId: userId,
    changes: { status: "success" },
    ...extractRequestMeta(request),
  });

  // Forensic attribution if an admin is impersonating (no-op otherwise). (admin-impersonation-02)
  await auditImpersonatedMutation(request, { action: "MFA_ENABLED", entityType: "User", entityId: userId, route: "/api/auth/mfa/confirm" });

  void sendSecurityNoticeEmail({
    userEmail: user.email,
    userName: user.firstName || "there",
    kind: "mfa-enabled",
    occurredAt: new Date(),
    locale: user.preferredLocale,
    dedupeKey: `mfa-enabled:${userId}:${Date.now()}`,
  }).catch((err) => console.error("[AUTH] mfa-enabled email failed:", err));

  return NextResponse.json({ success: true });
}
