import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashOpaqueToken } from "@/lib/user-auth";
import { sendWelcomeEmail } from "@/lib/email-service";
import { getRateLimitKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const schema = z.object({ token: z.string().min(10).max(200) });

function invalidVerificationLink() {
  return NextResponse.json(
    { error: "This verification link is invalid or already used." },
    { status: 400 },
  );
}

export async function POST(request: NextRequest) {
  const rl = await rateLimit(getRateLimitKey(request, "auth:verify-email"), {
    limit: 10,
    windowSeconds: 10 * 60,
    failClosed: true,
  });
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid token" }, { status: 400 });

  const tokenHash = hashOpaqueToken(parsed.data.token);
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
  });

  if (!record || record.consumedAt) {
    return invalidVerificationLink();
  }
  const userRl = await rateLimit(`auth:verify-email:user:${record.userId}`, {
    limit: 5,
    windowSeconds: 10 * 60,
    failClosed: true,
  });
  if (!userRl.success) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }
  if (record.expiresAt.getTime() < Date.now()) {
    return NextResponse.json(
      { error: "This verification link has expired. Please request a new one." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findFirst({
    where: { id: record.userId, deletedAt: null },
    select: { id: true, email: true, firstName: true },
  });
  if (!user) {
    return invalidVerificationLink();
  }

  const now = new Date();
  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.emailVerificationToken.updateMany({
        where: {
          id: record.id,
          consumedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });
      if (claimed.count !== 1) {
        throw new Error("VERIFY_TOKEN_NOT_CLAIMED");
      }

      await tx.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: now },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "VERIFY_TOKEN_NOT_CLAIMED") {
      return invalidVerificationLink();
    }
    throw error;
  }

  const welcomeSent = await sendWelcomeEmail({
    email: user.email,
    firstName: user.firstName,
    dedupeKey: `welcome:${user.id}`,
  }).catch((err) => {
    console.error("[EMAIL] welcome send after verification failed:", {
      userId: user.id,
      message: err instanceof Error ? err.message : "SEND_FAILED",
    });
    return false;
  });
  console.info("[EMAIL] welcome after verification", {
    userId: user.id,
    sent: welcomeSent,
  });

  return NextResponse.json({ success: true });
}
