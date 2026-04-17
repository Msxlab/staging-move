import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId, verifyPassword } from "@/lib/user-auth";
import { generateSecret, generateProvisioningURI, generateBackupCodes } from "@/lib/totp";
import { encrypt } from "@/lib/shared-encryption";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  password: z.string().min(1).max(200),
});

/**
 * POST /api/auth/mfa/setup
 *
 * Step 1 of enabling MFA. User must re-enter password.
 * Returns a provisioning URI (QR code) and 8 single-use backup codes.
 * The secret is stored encrypted; MFA is NOT yet enabled — the user must
 * call /api/auth/mfa/confirm with a fresh TOTP code to complete setup.
 */
export async function POST(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireDbUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Password required" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, passwordHash: true, mfaEnabled: true },
  });
  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: "Account requires a password before enabling MFA." }, { status: 400 });
  }
  if (user.mfaEnabled) {
    return NextResponse.json({ error: "MFA is already enabled. Disable it first." }, { status: 400 });
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 403 });
  }

  const secret = generateSecret();
  const { codes, hashes } = await generateBackupCodes();

  // Stage the secret + backup-code hashes but do NOT flip mfaEnabled yet.
  await prisma.user.update({
    where: { id: userId },
    data: {
      mfaSecret: encrypt(secret),
      mfaBackupCodes: JSON.stringify(hashes),
    },
  });

  const uri = generateProvisioningURI(secret, user.email);

  return NextResponse.json({
    success: true,
    provisioningUri: uri,
    secret, // plaintext, shown once so the user can paste into an authenticator
    backupCodes: codes,
  });
}
