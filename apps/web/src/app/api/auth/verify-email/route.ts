import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashOpaqueToken } from "@/lib/user-auth";

export const runtime = "nodejs";

const schema = z.object({ token: z.string().min(10).max(200) });

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid token" }, { status: 400 });

  const tokenHash = hashOpaqueToken(parsed.data.token);
  const record = await prisma.emailVerificationToken.findUnique({ where: { tokenHash } });

  if (!record || record.consumedAt) {
    return NextResponse.json({ error: "This verification link is invalid or already used." }, { status: 400 });
  }
  if (record.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "This verification link has expired. Please request a new one." }, { status: 400 });
  }

  // Mark token used + flag user's email as verified (transactional).
  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ success: true });
}
