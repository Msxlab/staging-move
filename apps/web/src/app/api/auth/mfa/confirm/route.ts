import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/user-auth";
import { verifyTOTP } from "@/lib/totp";
import { decrypt } from "@/lib/shared-encryption";
import { getRateLimitKey, rateLimit } from "@/lib/rate-limit";

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

  const [ipRl, userRl] = await Promise.all([
    rateLimit(getRateLimitKey(request, "auth:mfa:confirm:ip"), {
      limit: 50,
      windowSeconds: 60 * 60,
      failClosed: true,
    }),
    rateLimit(`auth:mfa:confirm:user:${userId}`, {
      limit: 5,
      windowSeconds: 60,
      failClosed: true,
    }),
  ]);
  if (!ipRl.success || !userRl.success) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid code" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaSecret: true, mfaEnabled: true },
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
    return NextResponse.json({ error: "Invalid MFA code." }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { mfaEnabled: true },
  });

  return NextResponse.json({ success: true });
}
