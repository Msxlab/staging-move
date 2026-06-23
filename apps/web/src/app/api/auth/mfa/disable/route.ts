import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireDbUserId, verifyPassword } from "@/lib/user-auth";
import { verifyTOTP, verifyBackupCode } from "@/lib/totp";
import { decrypt } from "@/lib/shared-encryption";
import { enforceRateLimitPolicy } from "@/lib/rate-limit-policy";
import { sendSecurityNoticeEmail } from "@/lib/email-service";
import { extractRequestMeta } from "@/lib/audit";
import { recordUserSecurityAudit } from "@/lib/user-security-audit";
import { auditImpersonatedMutation } from "@/lib/impersonation-audit";

export const runtime = "nodejs";

// Disabling MFA requires the password AND a valid second factor (TOTP or
// backup code). A password-only disable would let an attacker who phished /
// stuffed the password — but who does NOT have the second factor — turn off
// the very protection that stops them, fully taking over the account. Both
// proofs are mandatory whenever MFA is enabled; fail closed otherwise.
const schema = z.object({
  password: z.string().min(1).max(200),
  mfaCode: z.string().trim().min(1).max(16).optional(),
  backupCode: z.string().trim().min(1).max(64).optional(),
});

/**
 * POST /api/auth/mfa/disable — turn off MFA (requires password confirmation).
 */
export async function POST(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireDbUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await enforceRateLimitPolicy(request, "mfa_verify", {
    userId,
    routeId: "mfa_disable",
  });
  if (!rl.success) {
    return NextResponse.json(
      { code: rl.policy.userFacingErrorCode, error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Password required" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      firstName: true,
      preferredLocale: true,
      passwordHash: true,
      mfaEnabled: true,
      mfaSecret: true,
      mfaBackupCodes: true,
    },
  });
  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.mfaEnabled) {
    return NextResponse.json({ error: "MFA is not enabled." }, { status: 400 });
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 403 });
  }

  // Second factor is mandatory: the password alone must not be able to
  // disable MFA. Require a current TOTP code OR an unused backup code.
  const mfaCode = parsed.data.mfaCode?.trim();
  const backupCode = parsed.data.backupCode?.trim();
  if (!mfaCode && !backupCode) {
    return NextResponse.json(
      {
        error: "Enter a code from your authenticator app or a backup code to disable MFA.",
        code: "MFA_CODE_REQUIRED",
        requiresMfa: true,
      },
      { status: 403 },
    );
  }

  let secondFactorVerified = false;

  if (mfaCode && user.mfaSecret) {
    const secret = decrypt(user.mfaSecret);
    if (secret && verifyTOTP(secret, mfaCode)) {
      secondFactorVerified = true;
    }
  }

  // Backup code path: parse the stored hash list, verify, and atomically
  // consume the matched code (CAS on the exact prior value) so a replayed
  // request can't reuse it and a concurrent request can't double-spend.
  if (!secondFactorVerified && backupCode && user.mfaBackupCodes) {
    const originalBackupCodes = user.mfaBackupCodes || "[]";
    let storedHashes: string[] = [];
    try {
      const decoded = JSON.parse(originalBackupCodes);
      if (Array.isArray(decoded)) storedHashes = decoded.filter((item) => typeof item === "string");
    } catch {
      storedHashes = [];
    }
    const matchIndex = await verifyBackupCode(backupCode, storedHashes);
    if (matchIndex >= 0) {
      storedHashes.splice(matchIndex, 1);
      const consumed = await prisma.user.updateMany({
        where: { id: userId, mfaBackupCodes: originalBackupCodes },
        data: { mfaBackupCodes: JSON.stringify(storedHashes) },
      });
      if (consumed.count === 1) {
        secondFactorVerified = true;
      }
    }
  }

  if (!secondFactorVerified) {
    return NextResponse.json(
      { error: "Invalid MFA code.", code: "MFA_CODE_INVALID", requiresMfa: true },
      { status: 403 },
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: { mfaEnabled: false, mfaSecret: null, mfaBackupCodes: null },
  });

  recordUserSecurityAudit({
    userId,
    action: "MFA_DISABLED",
    entityId: userId,
    changes: { status: "success" },
    ...extractRequestMeta(request),
  });

  // Forensic attribution if an admin is impersonating (no-op otherwise). (admin-impersonation-02)
  await auditImpersonatedMutation(request, { action: "MFA_DISABLED", entityType: "User", entityId: userId, route: "/api/auth/mfa/disable" });

  void sendSecurityNoticeEmail({
    userEmail: user.email,
    userName: user.firstName || "there",
    kind: "mfa-disabled",
    occurredAt: new Date(),
    locale: user.preferredLocale,
    dedupeKey: `mfa-disabled:${userId}:${Date.now()}`,
  }).catch((err) => console.error("[AUTH] mfa-disabled email failed:", err));

  return NextResponse.json({ success: true });
}
