import { NextRequest, NextResponse } from "next/server";
import { consumePartnerPortalToken } from "@/lib/partner-portal-auth";
import { getOAuthResponseUrl } from "@/lib/oauth";

// GET /partners/portal/enter?token=… — magic-link landing. Validates the token,
// sets the httpOnly portal cookie, and redirects into the portal (or back with an
// error). Runs on Node (crypto hash).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  const session = await consumePartnerPortalToken(token).catch(() => null);
  const dest = session ? "/partners/portal" : "/partners/portal?error=invalid";
  // Build the redirect from the TRUSTED public app origin. On staging the app
  // sits behind a proxy and request.url is the internal 0.0.0.0:3000 listener,
  // so `new URL(dest, request.url)` would leak the internal host. This helper
  // honors x-forwarded-host/proto (rejecting internal hosts) and falls back to
  // the configured NEXT_PUBLIC_APP_URL.
  return NextResponse.redirect(await getOAuthResponseUrl(request, dest));
}
