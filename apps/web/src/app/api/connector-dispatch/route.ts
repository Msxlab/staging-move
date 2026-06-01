import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";
import { isApiConnectorsEnabled, userHasApiConnectorEntitlement } from "@/lib/connector-oauth";
import { enqueueAddressChange } from "@/lib/connector-runtime";

export const runtime = "nodejs";

/**
 * POST /api/connector-dispatch
 *
 * Fan an address change out to the caller's connected + enabled connectors by
 * enqueueing outbox rows. The cron worker then propagates them. Gated by
 * FEATURE_API_CONNECTORS (503 when off).
 */
export async function POST(request: NextRequest) {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isApiConnectorsEnabled())) {
    return NextResponse.json({ error: "Connectors are not enabled." }, { status: 503 });
  }
  if (!(await userHasApiConnectorEntitlement(session.userId))) {
    return NextResponse.json({ error: "Your plan doesn't include partner API sync." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  let toAddressId = typeof body?.toAddressId === "string" ? body.toAddressId : "";
  const fromAddressId = typeof body?.fromAddressId === "string" ? body.fromAddressId : null;
  if (!toAddressId) {
    // The "Sync now" button sends no id → default to the user's primary address.
    const primary = await prisma.address.findFirst({
      where: { userId: session.userId, isPrimary: true, deletedAt: null },
      select: { id: true },
    });
    if (!primary) {
      return NextResponse.json({ error: "Set a primary address first." }, { status: 400 });
    }
    toAddressId = primary.id;
  }

  try {
    const result = await enqueueAddressChange({ userId: session.userId, toAddressId, fromAddressId });
    return NextResponse.json(result);
  } catch (e: any) {
    if (e?.message === "ADDRESS_NOT_FOUND") {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
