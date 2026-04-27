import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { destroyUserSession, getUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";

function isOptionalAuthStateRequest(request?: NextRequest): boolean {
  const optional = request?.nextUrl.searchParams.get("optional");
  return optional === "1" || optional === "true";
}

function loggedOutResponse(optional: boolean) {
  if (optional) {
    return NextResponse.json(
      { authenticated: false, user: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    { error: "Unauthorized", user: null },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Returns the current user. Used by the web client to hydrate state.
 * Never exposes passwordHash or mfaSecret.
 */
export async function GET(request?: NextRequest) {
  const optional = isOptionalAuthStateRequest(request);
  const session = await getUserSession();
  if (!session) {
    return loggedOutResponse(optional);
  }

  const user = await prisma.user.findFirst({
    where: { id: session.userId, deletedAt: null },
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
    await destroyUserSession().catch(() => null);
    return loggedOutResponse(optional);
  }

  return NextResponse.json(
    {
      authenticated: true,
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
