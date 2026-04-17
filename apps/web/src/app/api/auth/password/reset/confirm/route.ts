import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  hashOpaqueToken,
  hashPassword,
  validatePasswordPolicy,
  destroyAllUserSessions,
} from "@/lib/user-auth";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(10).max(200),
  newPassword: z.string().max(200),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const policyError = validatePasswordPolicy(parsed.data.newPassword);
  if (policyError) return NextResponse.json({ error: policyError }, { status: 400 });

  const tokenHash = hashOpaqueToken(parsed.data.token);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record || record.usedAt) {
    return NextResponse.json({ error: "This reset link is invalid or already used." }, { status: 400 });
  }
  if (record.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "This reset link has expired. Please request a new one." }, { status: 400 });
  }

  const newHash = await hashPassword(parsed.data.newPassword);

  await prisma.$transaction([
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: newHash, emailVerifiedAt: new Date() }, // reset flow implicitly verifies email
    }),
  ]);

  // Invalidate all prior sessions so a compromised session cannot persist.
  await destroyAllUserSessions(record.userId);

  return NextResponse.json({ success: true });
}
