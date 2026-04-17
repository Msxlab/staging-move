import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireDbUserId, verifyPassword } from "@/lib/user-auth";

export const runtime = "nodejs";

const schema = z.object({
  password: z.string().min(1).max(200),
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

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Password required" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, mfaEnabled: true },
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

  await prisma.user.update({
    where: { id: userId },
    data: { mfaEnabled: false, mfaSecret: null, mfaBackupCodes: null },
  });

  return NextResponse.json({ success: true });
}
