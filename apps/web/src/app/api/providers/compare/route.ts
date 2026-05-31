import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireDbUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(getRateLimitKey(req, `providers:compare:${userId}`), { limit: 30, windowSeconds: 60 });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": Math.ceil((rl.resetAt - Date.now()) / 1000).toString() } }
    );
  }

  const url = new URL(req.url);
  const category = url.searchParams.get("category") || "";
  const state = url.searchParams.get("state") || "";
  const minRating = parseFloat(url.searchParams.get("minRating") || "0");
  const maxPrice = url.searchParams.get("maxPrice") || "";
  const sortBy = url.searchParams.get("sortBy") || "popularityScore";
  const tags = url.searchParams.get("tags") || "";
  const search = url.searchParams.get("search") || "";
  const scope = url.searchParams.get("scope") || "";
  const ids = url.searchParams.get("ids") || "";

  const where: any = { isActive: true };
  if (category) where.category = category;
  if (scope) where.scope = scope;
  if (search) where.name = { contains: search };

  let providers = await prisma.serviceProvider.findMany({
    where,
    orderBy: { popularityScore: "desc" },
  });

  if (state) {
    providers = providers.filter((p) => {
      if (p.scope === "FEDERAL") return true;
      try {
        const states = JSON.parse(p.states || "[]");
        return states.includes(state);
      } catch { return false; }
    });
  }

  if (tags) {
    const tagList = tags.split(",").map((t) => t.trim().toLowerCase());
    providers = providers.filter((p) => {
      try {
        const pTags = JSON.parse(p.tags || "[]").map((t: string) => t.toLowerCase());
        return tagList.some((t) => pTags.includes(t));
      } catch { return false; }
    });
  }

  // Compare mode: return specific providers by IDs
  if (ids) {
    const idList = ids.split(",");
    const compareProviders = providers.filter((p) => idList.includes(p.id));

    return NextResponse.json({ providers: compareProviders, mode: "compare" });
  }

  // Categories for filter
  const categories = [...new Set(providers.map((p) => p.category))].sort();
  const allTags = [...new Set(providers.flatMap((p) => { try { return JSON.parse(p.tags || "[]"); } catch { return []; } }))].sort();

  // State listing check based on the user's state. This is not an address-level
  // serviceability or official availability check.
  // NOTE: the withSoftDelete extension only filters TOP-LEVEL reads, not nested
  // relation includes — so deletedAt:null must be set explicitly here, otherwise
  // a user who deleted their primary address would still resolve its stale state.
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { addresses: { where: { isPrimary: true, deletedAt: null }, take: 1 } } });
  const userState = user?.addresses?.[0]?.state || "";

  if (userState) {
    providers = providers.map((p) => {
      let listed = false;
      if (p.scope === "FEDERAL") listed = true;
      else {
        try {
          const states = JSON.parse(p.states || "[]");
          listed = states.includes(userState);
        } catch {}
      }
      return {
        ...p,
        listedInUserState: listed,
        availabilityCaveat:
          "Listed provider only. Confirm address-level availability with the official provider.",
      };
    });
  }

  return NextResponse.json({
    providers: providers.slice(0, 100),
    total: providers.length,
    categories,
    allTags,
    userState,
  });
}
