import { NextRequest, NextResponse } from "next/server";
import {
  trackBlockedIPAttempt,
  trackBreakGlassBypass,
  trackSessionHijackAttempt,
} from "@/lib/security-monitor";
import { verifyInternalAuth } from "@/lib/internal-secrets";

export async function POST(request: NextRequest) {
  if (!verifyInternalAuth(request.headers.get("authorization"), "internal")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const ip = typeof body?.ip === "string" ? body.ip : "unknown";
    const pathname = typeof body?.pathname === "string" ? body.pathname : "unknown";

    if (body?.type === "BLOCKED_IP_ATTEMPT") {
      trackBlockedIPAttempt(ip, pathname);
      return NextResponse.json({ success: true });
    }

    if (body?.type === "SESSION_HIJACK_ATTEMPT") {
      trackSessionHijackAttempt(ip, typeof body?.adminId === "string" ? body.adminId : undefined);
      return NextResponse.json({ success: true });
    }

    if (body?.type === "IP_RULE_BYPASSED_FOR_BREAK_GLASS") {
      trackBreakGlassBypass(ip, pathname, typeof body?.adminId === "string" ? body.adminId : undefined);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unsupported event type" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Failed to process security event" }, { status: 500 });
  }
}
