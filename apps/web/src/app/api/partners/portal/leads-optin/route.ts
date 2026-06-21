import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPartnerPortalSession } from "@/lib/partner-portal-auth";

// POST /api/partners/portal/leads-optin — the signed-in partner toggles whether it
// receives consumer leads (Partner.leadsOptIn). Self-serve consent control for the
// lead program (audit P2 — partners opt in at registration; this lets them opt out).
// Session-gated; form-POST + redirect back to the portal.
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await getPartnerPortalSession();
  if (!session) {
    return NextResponse.redirect(new URL("/partners/portal", request.url), { status: 303 });
  }
  const form = await request.formData().catch(() => null);
  const optIn = form?.get("optIn") === "true";
  await prisma.partner
    .update({ where: { id: session.partnerId }, data: { leadsOptIn: optIn } })
    .catch(() => {});
  return NextResponse.redirect(new URL("/partners/portal", request.url), { status: 303 });
}
