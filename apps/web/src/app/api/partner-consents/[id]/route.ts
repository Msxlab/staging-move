import { NextRequest, NextResponse } from "next/server";
import { getUserSession } from "@/lib/user-auth";
import { revokeConsent } from "@/lib/connector-oauth";
import { auditImpersonatedMutation } from "@/lib/impersonation-audit";

export const runtime = "nodejs";

/**
 * DELETE /api/partner-consents/[id]
 *
 * Revokes one of the caller's own connector consents. Zeroes the stored token.
 * Idempotent from the user's side: a non-owned or missing id returns 404.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const revoked = await revokeConsent({ id, userId: session.userId, reason: "USER_REQUESTED" });
  if (!revoked) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Forensic attribution if an admin is impersonating (no-op otherwise). (admin-impersonation-02)
  await auditImpersonatedMutation(request, { action: "REVOKE", entityType: "PartnerConsent", entityId: id, route: "/api/partner-consents/[id]" });
  return NextResponse.json({ revoked: true });
}
