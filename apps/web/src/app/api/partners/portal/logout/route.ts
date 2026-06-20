import { NextRequest, NextResponse } from "next/server";
import { clearPartnerPortalSession } from "@/lib/partner-portal-auth";

// POST /api/partners/portal/logout — revoke the current portal token + clear the
// cookie, then redirect to the sign-in page.
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  await clearPartnerPortalSession().catch(() => {});
  return NextResponse.redirect(new URL("/partners/portal", request.url), { status: 303 });
}
