import { NextRequest, NextResponse } from "next/server";
import { destroySession, expireAdminSessionCookies, getSession } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const session = await getSession().catch(() => null);
  await destroySession();
  if (session) {
    await writeAdminAudit(session, {
      action: "LOGOUT",
      entityType: "AdminAuth",
      entityId: session.sessionId || session.adminId,
      metadata: { operation: "admin_logout", sessionId: session.sessionId || null },
      request: getAuditRequestMeta(request),
    });
  }
  const response = NextResponse.json(
    { success: true },
    {
      headers: {
        "Cache-Control": "no-store",
        Pragma: "no-cache",
        Expires: "0",
      },
    },
  );
  return expireAdminSessionCookies(response, request.headers.get("host"));
}
