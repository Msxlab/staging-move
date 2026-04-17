import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Internal endpoint for middleware IP rule cache refresh.
// Protected by CRON_SECRET — not exposed to users.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
        const rules = await prisma.iPRule.findMany({
      where: { isActive: true },
      select: { ipAddress: true, type: true, isActive: true, expiresAt: true },
    });

    return NextResponse.json({ rules });
  } catch {
    return NextResponse.json({ rules: [] });
  }
}
