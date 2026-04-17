import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateOpaqueToken } from "@/lib/user-auth";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/email-service";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email().max(191).transform((v) => v.toLowerCase()),
});

export async function POST(request: NextRequest) {
  const rlKey = getRateLimitKey(request, "auth:pwreset");
  const rl = await rateLimit(rlKey, { limit: 3, windowSeconds: 60 });
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    // Intentionally return success even on malformed — email enum avoidance.
    return NextResponse.json({ success: true });
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, email: true, firstName: true },
  });

  // Always respond success (never leak whether email exists).
  if (!user) {
    return NextResponse.json({ success: true });
  }

  const { token, hash } = generateOpaqueToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
  });

  await sendPasswordResetEmail({
    userEmail: user.email,
    userName: user.firstName || "there",
    resetToken: token,
    dedupeKey: `pwreset:${user.id}:${hash.slice(0, 12)}`,
  }).catch((err) => console.error("[EMAIL] password reset send failed:", err));

  return NextResponse.json({ success: true });
}
