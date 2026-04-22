import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

// GET /api/providers/popular?state=TX — community-powered popularity data
// Returns aggregated, anonymous stats on which providers are most used per state
export async function GET(request: NextRequest) {
  try {
    const rl = await rateLimit(getRateLimitKey(request, "providers:popular"), { limit: 60, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": Math.ceil((rl.resetAt - Date.now()) / 1000).toString() } }
      );
    }

    const { searchParams } = new URL(request.url);
    const state = searchParams.get("state")?.toUpperCase();

    if (!state || state.length !== 2) {
      return NextResponse.json({ error: "state parameter required (2-letter code)" }, { status: 400 });
    }

    // Get all services for users who have an address in the given state
    // This gives us community usage patterns for that state
    const stateAddresses = await prisma.address.findMany({
      where: { state },
      select: { userId: true },
    });
    const userIds = [...new Set(stateAddresses.map((a) => a.userId))];

    if (userIds.length === 0) {
      return NextResponse.json({ popularity: {}, userCount: 0 });
    }

    // Count services per provider for users in this state
    const services = await prisma.service.findMany({
      where: {
        userId: { in: userIds },
        isActive: true,
        providerId: { not: null },
      },
      select: { providerId: true, providerName: true },
    });

    // Aggregate: providerId → count
    const providerCounts: Record<string, { count: number; name: string }> = {};
    for (const svc of services) {
      const key = svc.providerId || svc.providerName || "";
      if (!key) continue;
      if (!providerCounts[key]) {
        providerCounts[key] = { count: 0, name: svc.providerName || key };
      }
      providerCounts[key].count++;
    }

    // Also get provider ratings from the ServiceProvider table
    const providerStats = await prisma.serviceProvider.findMany({
      where: {
        isActive: true,
        OR: [
          { states: { contains: state } },
          { scope: "FEDERAL" },
        ],
      },
      select: { id: true, slug: true, userCount: true },
    });

    // Build popularity map: providerId/slug → score (0-20, normalized)
    const maxCount = Math.max(1, ...Object.values(providerCounts).map((v) => v.count));
    const popularity: Record<string, number> = {};

    for (const [key, val] of Object.entries(providerCounts)) {
      // Normalize to 0-20 scale
      popularity[key] = Math.round((val.count / maxCount) * 20);
    }

    // Merge provider DB stats
    for (const stat of providerStats) {
      if (stat.userCount > 0 && !popularity[stat.id]) {
        popularity[stat.id] = Math.min(20, Math.round((stat.userCount / 100) * 10));
      }
      if (stat.slug && !popularity[stat.slug]) {
        popularity[stat.slug] = popularity[stat.id] || 0;
      }
    }

    // Top providers for this state
    const topProviders = Object.entries(providerCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20)
      .map(([id, val]) => ({
        providerId: id,
        name: val.name,
        usageCount: val.count,
        percentOfUsers: Math.round((val.count / userIds.length) * 100),
      }));

    return NextResponse.json({
      state,
      userCount: userIds.length,
      popularity,
      topProviders,
    });
  } catch (error) {
    console.error("Failed to fetch popular providers:", error);
    return NextResponse.json({ error: "Failed to fetch popularity data" }, { status: 500 });
  }
}
