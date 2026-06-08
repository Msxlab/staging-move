import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

// GET /api/providers/popular?state=TX — community-powered popularity data
// Returns aggregated, anonymous stats on which providers are most used per state
//
// PRIVACY (F-002): this endpoint is PUBLIC (covered by the /api/providers
// middleware allowlist) and unauthenticated. Without a cohort floor a caller
// could infer which providers a tiny group — even a single user — relies on in
// a low-population state. We enforce k-anonymity before exposing any per-provider
// usage figures:
//   - STATE_COHORT_K: the state's distinct contributing user set must reach this
//     size before ANY exact usage data is returned for that state.
//   - PROVIDER_USER_FLOOR: an individual provider must be used by at least this
//     many distinct users before its row is exposed; rows below the floor are
//     omitted from topProviders entirely (never returned with a raw small count).
// When the state cohort is below K we suppress topProviders/popularity and flag
// the response as suppressed, while still echoing a (coarse) userCount so the
// caller knows the state exists but is too sparse to profile.
const STATE_COHORT_K = 20;
const PROVIDER_USER_FLOOR = 5;

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
      select: { userId: true, providerId: true, providerName: true },
    });

    // Aggregate: providerId → count + DISTINCT contributing users.
    // userCount (distinct users) is what k-anonymity is measured against; a high
    // service count from a single user must never clear the cohort floor.
    const providerCounts: Record<string, { count: number; name: string; userIds: Set<string> }> = {};
    for (const svc of services) {
      const key = svc.providerId || svc.providerName || "";
      if (!key) continue;
      if (!providerCounts[key]) {
        providerCounts[key] = { count: 0, name: svc.providerName || key, userIds: new Set() };
      }
      providerCounts[key].count++;
      providerCounts[key].userIds.add(svc.userId);
    }

    // K-ANONYMITY GATE: if the state's distinct contributing user set is below
    // STATE_COHORT_K, the whole state is too sparse to profile. Suppress all
    // per-provider figures rather than leak which providers a handful of people
    // use. We still return the state and a userCount so the response is honest
    // about the state existing.
    if (userIds.length < STATE_COHORT_K) {
      return NextResponse.json({
        state,
        userCount: userIds.length,
        popularity: {},
        topProviders: [],
        suppressed: true,
      });
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

    // Only providers whose DISTINCT user set clears the floor may contribute any
    // cohort-derived figure. Everything below the floor is dropped here so it can
    // never reach the popularity map or topProviders.
    const eligibleCounts = Object.entries(providerCounts).filter(
      ([, val]) => val.userIds.size >= PROVIDER_USER_FLOOR,
    );

    // Build popularity map: providerId/slug → score (0-20, normalized)
    const maxCount = Math.max(1, ...eligibleCounts.map(([, v]) => v.count));
    const popularity: Record<string, number> = {};

    for (const [key, val] of eligibleCounts) {
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

    // Top providers for this state — only providers whose distinct user set
    // clears PROVIDER_USER_FLOOR are exposed; small-cohort rows are omitted
    // entirely so no exact single/low usage counts ever leave the endpoint.
    const topProviders = eligibleCounts
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20)
      .map(([id, val]) => ({
        providerId: id,
        name: val.name,
        usageCount: val.count,
        userCount: val.userIds.size,
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
