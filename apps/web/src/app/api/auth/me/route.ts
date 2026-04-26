import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";

/**
 * Returns the current user. Used by the web client to hydrate state.
 * Never exposes passwordHash or mfaSecret.
 */
export async function GET() {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized", user: null },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      imageUrl: true,
      emailVerifiedAt: true,
      mfaEnabled: true,
      createdAt: true,
    },
  });
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized", user: null },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        imageUrl: user.imageUrl,
        emailVerified: Boolean(user.emailVerifiedAt),
        mfaEnabled: user.mfaEnabled,
        createdAt: user.createdAt,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
