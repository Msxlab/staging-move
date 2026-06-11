import { NextRequest, NextResponse } from "next/server";
import { clearMoverPortalSession } from "@/lib/mover-portal-auth";

// POST /api/movers/portal/logout — revoke the current portal token + clear the
// cookie, then redirect to the sign-in page.
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  await clearMoverPortalSession().catch(() => {});
  return NextResponse.redirect(new URL("/movers/portal", request.url), { status: 303 });
}
