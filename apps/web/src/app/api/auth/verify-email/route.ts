import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashOpaqueToken } from "@/lib/user-auth";

export const runtime = "nodejs";

const schema = z.object({ token: z.string().min(10).max(200) });

function invalidVerificationLink() {
  return NextResponse.json(
    { error: "This verification link is invalid or already used." },
    { status: 400 },
  );
}

export async function POST(request: NextRequest) {
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
  if (record.expiresAt.getTime() < Date.now()) {
    return NextResponse.json(
      { error: "This verification link has expired. Please request a new one." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findFirst({
    where: { id: record.userId, deletedAt: null },
    select: { id: true },
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

  return NextResponse.json({ success: true });
}
