import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyInternalAuth } from "@/lib/internal-secrets";

// POST /api/cron/provider-stats
// Daily cron: recalculate userCount, reviewCount, avgRating for all providers
export async function POST(request: NextRequest) {
  try {
    if (!verifyInternalAuth(request.headers.get("authorization"), "cron")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const providers = await prisma.serviceProvider.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    let updated = 0;

    for (const provider of providers) {
      try {
        // Count active services linked to this provider
        const userCount = await prisma.service.count({
          where: { providerId: provider.id, isActive: true },
        });

        await prisma.serviceProvider.update({
          where: { id: provider.id },
          data: { userCount },
        });

        updated++;
      } catch (err) {
        console.error(`Failed to update stats for provider ${provider.id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      providersProcessed: providers.length,
      providersUpdated: updated,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Provider stats cron failed:", error);
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}
