import { NextRequest, NextResponse } from "next/server";
import { destroyUserSession, expireUserSessionCookies, getUserSession } from "@/lib/user-auth";
import { extractRequestMeta } from "@/lib/audit";
import { recordUserSecurityAudit } from "@/lib/user-security-audit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await getUserSession().catch(() => null);
  await destroyUserSession();
  if (session?.userId) {
    recordUserSecurityAudit({
      userId: session.userId,
      action: "LOGOUT",
      entityId: session.userId,
      changes: { status: "success" },
      ...extractRequestMeta(request),
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
  return expireUserSessionCookies(response, request.headers.get("host"));
}
