import { NextRequest, NextResponse } from "next/server";
import { getUserSession } from "@/lib/user-auth";
import { isApiConnectorsEnabled } from "@/lib/connector-oauth";
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

  const body = await request.json().catch(() => ({}));
  const toAddressId = typeof body?.toAddressId === "string" ? body.toAddressId : "";
  const fromAddressId = typeof body?.fromAddressId === "string" ? body.fromAddressId : null;
  if (!toAddressId) {
    return NextResponse.json({ error: "toAddressId is required" }, { status: 400 });
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
