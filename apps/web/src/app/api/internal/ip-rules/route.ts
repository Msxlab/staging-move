import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyInternalAuth } from "@/lib/internal-secrets";

// Internal endpoint for middleware IP rule cache refresh.
// Authenticates with INTERNAL_WEBHOOK_SECRET (falls back to CRON_SECRET).
export async function GET(request: NextRequest) {
  if (!verifyInternalAuth(request.headers.get("authorization"), "internal")) {
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
