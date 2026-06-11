import { NextRequest, NextResponse } from "next/server";
import { consumeMoverPortalToken } from "@/lib/mover-portal-auth";

// GET /movers/portal/enter?token=… — the magic-link landing. Validates the
// token, sets the httpOnly portal cookie, and redirects into the dashboard
// (or back to the sign-in page with an error). Runs on Node (crypto hash).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  const session = await consumeMoverPortalToken(token).catch(() => null);
  const dest = session ? "/movers/portal/dashboard" : "/movers/portal?error=invalid";
  return NextResponse.redirect(new URL(dest, request.url));
}
