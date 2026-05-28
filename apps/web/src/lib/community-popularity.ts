/**
 * Community popularity signal for provider recommendations.
 *
 * Aggregates how many users in a given state have adopted each provider and
 * normalizes it to a 0–20 boost. Uses a DB-side groupBy aggregate (instead of
 * scanning every service row) and an optional Upstash Redis cache (1h TTL) so
 * the recommendations route doesn't recompute this on every request.
 *
 * Fully non-blocking: any failure resolves to undefined, leaving the engine to
 * rank without the community signal rather than erroring the route.
 */

import { prisma } from "@/lib/db";
import { Redis } from "@upstash/redis";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const hasRedis = Boolean(
  redisUrl &&
    redisToken &&
    !redisUrl.includes("REPLACE") &&
    !redisToken.includes("REPLACE"),
);

let redis: Redis | null = null;
if (hasRedis) {
  redis = new Redis({ url: redisUrl!, token: redisToken! });
}

const CACHE_TTL_SECONDS = 60 * 60;
// Threshold is strictly greater-than: a state needs more than this many
// distinct users before community popularity is shown, to avoid leaking
// individual choices in sparsely-populated states.
const MIN_DISTINCT_USERS = 5;
const POPULARITY_SCALE = 20;

function cacheKey(state: string): string {
  return `community-popularity:${state}`;
}

async function computeCommunityPopularity(
  state: string,
): Promise<Record<string, number> | undefined> {
  const distinctUsers = await prisma.address.groupBy({
    by: ["userId"],
    where: { state },
  });
  if (distinctUsers.length <= MIN_DISTINCT_USERS) return undefined;

  const userIds = distinctUsers.map((u) => u.userId);

  const grouped = await prisma.service.groupBy({
    by: ["providerId"],
    where: { userId: { in: userIds }, isActive: true, providerId: { not: null } },
    _count: { providerId: true },
  });

  const counts: Record<string, number> = {};
  for (const row of grouped) {
    if (row.providerId) counts[row.providerId] = row._count.providerId;
  }
  if (Object.keys(counts).length === 0) return undefined;

  const maxCount = Math.max(1, ...Object.values(counts));
  const popularity: Record<string, number> = {};
  for (const [id, count] of Object.entries(counts)) {
    popularity[id] = Math.round((count / maxCount) * POPULARITY_SCALE);
  }
  return popularity;
}

export async function getCommunityPopularity(
  state: string | null | undefined,
): Promise<Record<string, number> | undefined> {
  const normalized = (state ?? "").trim().toUpperCase();
  if (!normalized) return undefined;

  if (redis) {
    try {
      const cached = await redis.get<Record<string, number>>(cacheKey(normalized));
      if (cached && typeof cached === "object") return cached;
    } catch {
      // Cache read failed — fall through and recompute.
    }
  }

  let computed: Record<string, number> | undefined;
  try {
    computed = await computeCommunityPopularity(normalized);
  } catch {
    return undefined;
  }

  if (redis && computed) {
    try {
      await redis.set(cacheKey(normalized), computed, { ex: CACHE_TTL_SECONDS });
    } catch {
      // Cache write is best-effort.
    }
  }

  return computed;
}
