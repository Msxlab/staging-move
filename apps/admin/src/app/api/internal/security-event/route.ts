import { NextRequest, NextResponse } from "next/server";
import { trackBlockedIPAttempt, trackSessionHijackAttempt } from "@/lib/security-monitor";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
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

    return NextResponse.json({ error: "Unsupported event type" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Failed to process security event" }, { status: 500 });
  }
}
