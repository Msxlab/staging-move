import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const ipAddress = typeof body?.ipAddress === "string" ? body.ipAddress.slice(0, 45) : "anonymous";
    const endpoint = typeof body?.endpoint === "string" ? body.endpoint.slice(0, 200) : "unknown";
    const count = Number.isFinite(body?.count) ? Math.max(1, Math.min(Number(body.count), 100000)) : 1;
    const blocked = body?.blocked !== false;
    const windowStart = body?.windowStart ? new Date(body.windowStart) : new Date();
    const windowEnd = body?.windowEnd ? new Date(body.windowEnd) : new Date(Date.now() + 60 * 1000);

    if (Number.isNaN(windowStart.getTime()) || Number.isNaN(windowEnd.getTime())) {
      return NextResponse.json({ error: "Invalid window" }, { status: 400 });
    }

    await prisma.rateLimitLog.create({
      data: {
        ipAddress,
        endpoint,
        count,
        blocked,
        windowStart,
        windowEnd,
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to record rate-limit log" }, { status: 500 });
  }
}
