import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";

/**
 * GET /api/connectors/changes
 *
 * The caller's recent address-change events with each connector's dispatch
 * status — the "where did my address land?" timeline. Derived from
 * AddressChangeEvent (the canonical fan-out) joined to its ConnectorDispatch
 * children. Strictly scoped to the session user. No secrets are exposed: only
 * the connector key + normalized status / timestamps, never the encrypted
 * payload or confirmation number.
 */
export async function GET() {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const changes = await prisma.addressChangeEvent.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      fromAddressId: true,
      toAddressId: true,
      status: true,
      dispatchCount: true,
      createdAt: true,
      dispatches: {
        where: { isShadow: false },
        select: { connectorKey: true, status: true, confirmedAt: true, lastErrorCode: true },
        orderBy: { connectorKey: "asc" },
      },
    },
  });

  return NextResponse.json({ changes }, { headers: { "Cache-Control": "no-store" } });
}
