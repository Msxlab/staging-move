import { NextRequest, NextResponse } from "next/server";
import { consumePartnerPortalToken } from "@/lib/partner-portal-auth";

// GET /partners/portal/enter?token=… — magic-link landing. Validates the token,
// sets the httpOnly portal cookie, and redirects into the portal (or back with an
// error). Runs on Node (crypto hash).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  const session = await consumePartnerPortalToken(token).catch(() => null);
  const dest = session ? "/partners/portal" : "/partners/portal?error=invalid";
  return NextResponse.redirect(new URL(dest, request.url));
}
