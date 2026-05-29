import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";

function safeParseScopes(json: string): string[] {
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) ? value.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

/**
 * GET /api/partner-consents
 *
 * Lists the current user's connector consents. Never exposes the encrypted
 * token — only status, scopes, and lifecycle timestamps for the connections UI.
 */
export async function GET() {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const rows = await prisma.partnerConsent.findMany({
    where: { userId: session.userId },
    select: {
      id: true,
      connectorKey: true,
      status: true,
      scopesJson: true,
      grantedAt: true,
      revokedAt: true,
      expiresAt: true,
      tokenExpiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const consents = rows.map((row) => ({
    id: row.id,
    connectorKey: row.connectorKey,
    status: row.status,
    scopes: safeParseScopes(row.scopesJson),
    grantedAt: row.grantedAt,
    revokedAt: row.revokedAt,
    expiresAt: row.expiresAt,
    tokenExpiresAt: row.tokenExpiresAt,
    createdAt: row.createdAt,
  }));

  return NextResponse.json({ consents }, { headers: { "Cache-Control": "no-store" } });
}
