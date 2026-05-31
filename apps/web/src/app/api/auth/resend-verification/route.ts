import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmailVerificationEmail } from "@/lib/email-service";
import { getRateLimitKey, rateLimit } from "@/lib/rate-limit";
import { generateOpaqueToken, getUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const ipLimit = await rateLimit(getRateLimitKey(request, "auth:resend-verification"), {
    limit: 5,
    windowSeconds: 10 * 60,
    failClosed: true,
  });
  if (!ipLimit.success) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userLimit = await rateLimit(`auth:resend-verification:user:${session.userId}`, {
    limit: 3,
    windowSeconds: 30 * 60,
    failClosed: true,
  });
  if (!userLimit.success) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const user = await prisma.user.findFirst({
    where: { id: session.userId, deletedAt: null },
    select: {
      id: true,
      email: true,
      firstName: true,
      emailVerifiedAt: true,
      passwordHash: true,
      oauthAccounts: { select: { id: true }, take: 1 },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.emailVerifiedAt || !user.passwordHash || user.oauthAccounts.length > 0) {
    return NextResponse.json({ success: true, alreadyVerified: true });
  }

  const { token, hash } = generateOpaqueToken();
  // Supersede any still-valid verification token for this user so an older,
  // un-clicked link can't be used after a fresh one is issued.
  await prisma.emailVerificationToken.updateMany({
    where: { userId: user.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      email: user.email,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  await sendEmailVerificationEmail({
    userEmail: user.email,
    userName: user.firstName || "there",
    verifyToken: token,
    dedupeKey: `verify:${user.id}:${hash}`,
  }).catch((err) => {
    console.error("[EMAIL] verification resend failed:", {
      userId: user.id,
      message: err instanceof Error ? err.message : "SEND_FAILED",
    });
  });

  return NextResponse.json({ success: true });
}
