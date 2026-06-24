import { NextRequest, NextResponse } from "next/server";
import { consumeMoverPortalToken } from "@/lib/mover-portal-auth";
import { getOAuthResponseUrl } from "@/lib/oauth";

// GET /movers/portal/enter?token=… — the magic-link landing. Validates the
// token, sets the httpOnly portal cookie, and redirects into the dashboard
// (or back to the sign-in page with an error). Runs on Node (crypto hash).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  const session = await consumeMoverPortalToken(token).catch(() => null);
  const dest = session ? "/movers/portal/dashboard" : "/movers/portal?error=invalid";
  // Build the redirect from the TRUSTED public app origin. On staging the app
  // sits behind a proxy and request.url is the internal 0.0.0.0:3000 listener,
  // so `new URL(dest, request.url)` would leak the internal host. This helper
  // honors x-forwarded-host/proto (rejecting internal hosts) and falls back to
  // the configured NEXT_PUBLIC_APP_URL.
  return NextResponse.redirect(await getOAuthResponseUrl(request, dest));
}
