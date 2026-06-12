import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { getProviderCoverageMetadata, type ProviderCoverageModel } from "@locateflow/db";
import { getProviderTrustSummary } from "@locateflow/shared";
import {
  getProviderPresentationMatchLevelFromDb,
  safeJsonArray,
} from "@/lib/provider-matching";
import {
  applyProviderServiceabilityMatchLevel,
  enrichProviderServiceability,
} from "@/lib/provider-serviceability";

// GET /api/providers/compare?ids=a,b,c[&addressId=...]
//
// Side-by-side comparison over attributes that ACTUALLY EXIST on
// ServiceProvider. There is no rating or price column on this model (and we
// deliberately do NOT invent them — that would be fabricated data and an FTC
// risk), so this compares the real, honest attributes a mover can use to
// decide between listed providers:
//
//   - coverage confidence AT THE USER'S ADDRESS (computed from the indexed
//     ServiceProviderCoverage rows + the provider's coverage model)
//   - popularity rank within the compared set (relative, from popularityScore)
//   - category / sub-category
//   - tags / features
//   - official-vs-affiliate (affiliateActive) and whether a website exists
//   - community user count, phone, scope (national vs state)
//
// The previous version of this endpoint filtered on `minRating` / `maxPrice`
// (columns that do not exist) and was never consumed by any UI. Those dead
// filters are removed.
const MAX_COMPARE = 4;

type CompareProviderRow = {
  id: string;
  name: string;
  slug: string;
  category: string;
  subCategory: string | null;
  description: string | null;
  website: string | null;
  phone: string | null;
  logoUrl: string | null;
  scope: string;
  states: string;
  zipCodes: string;
  coverageModel: string | null;
  tags: string;
  popularityScore: number;
  displayOrder: number;
  userCount: number;
  affiliateActive: boolean;
  fccServiceable?: boolean;
  utilityServiceable?: boolean;
  coverages: Array<{ state: string | null; zipPrefix: string | null; zipExact: string | null }>;
};

export async function GET(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireDbUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(getRateLimitKey(req, "providers:compare", { userId }), {
    limit: 30,
    windowSeconds: 60,
  });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": Math.ceil((rl.resetAt - Date.now()) / 1000).toString() } }
    );
  }

  const url = new URL(req.url);
  const idsParam = url.searchParams.get("ids") || "";
  const addressId = url.searchParams.get("addressId") || "";

  // Dedupe + cap. Preserve the caller's requested order so the comparison
  // columns stay where the user placed them.
  const requestedIds: string[] = [];
  const seen = new Set<string>();
  for (const raw of idsParam.split(",")) {
    const id = raw.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    requestedIds.push(id);
    if (requestedIds.length >= MAX_COMPARE) break;
  }

  if (requestedIds.length < 2) {
    return NextResponse.json(
      { error: "Provide between 2 and 4 provider ids to compare.", providers: [] },
      { status: 400 }
    );
  }

  // Resolve the address the comparison is anchored to: the explicitly chosen
  // one (scoped to this user) or the user's primary. deletedAt:null is set
  // explicitly because the soft-delete extension only filters top-level reads.
  const address = addressId
    ? await prisma.address.findFirst({
        where: { id: addressId, userId, deletedAt: null },
        select: { id: true, state: true, zip: true, city: true, nickname: true, latitude: true, longitude: true },
      })
    : await prisma.address.findFirst({
        where: { userId, deletedAt: null, isPrimary: true },
        select: { id: true, state: true, zip: true, city: true, nickname: true, latitude: true, longitude: true },
      });

  const rows = (await prisma.serviceProvider.findMany({
    where: { id: { in: requestedIds }, isActive: true },
    include: { coverages: true },
  })) as unknown as CompareProviderRow[];

  const byId = new Map(rows.map((r) => [r.id, r] as const));

  const matchOptions = {
    state: address?.state ?? null,
    zip: address?.zip ?? null,
    latitude: address?.latitude ?? null,
    longitude: address?.longitude ?? null,
  };

  // Popularity rank is relative WITHIN the compared set so the label is honest
  // ("most popular of the 3 you picked"), not a global claim. Ties share a rank.
  const present = requestedIds.map((id) => byId.get(id)).filter((r): r is CompareProviderRow => Boolean(r));
  await enrichProviderServiceability(present, {
    latitude: address?.latitude ?? null,
    longitude: address?.longitude ?? null,
  });
  const byPopularity = [...present].sort((a, b) => b.popularityScore - a.popularityScore);
  const popularityRank = new Map<string, number>();
  let rank = 0;
  let prevScore: number | null = null;
  byPopularity.forEach((r, index) => {
    if (prevScore === null || r.popularityScore !== prevScore) {
      rank = index + 1;
      prevScore = r.popularityScore;
    }
    popularityRank.set(r.id, rank);
  });

  const providers = requestedIds
    .map((id) => byId.get(id))
    .filter((r): r is CompareProviderRow => Boolean(r))
    .map((p) => {
      const states = safeJsonArray(p.states);
      const zipCodes = safeJsonArray(p.zipCodes);
      const tags = safeJsonArray(p.tags);
      const metadata = getProviderCoverageMetadata(p.slug);
      const coverageModel: ProviderCoverageModel =
        (p.coverageModel as ProviderCoverageModel | null | undefined) ||
        metadata?.coverageModel ||
        (zipCodes.length > 0 ? "zip_prefix" : "state");

      const matchInput = {
        id: p.id,
        slug: p.slug,
        scope: p.scope,
        coverageModel,
        coverages: p.coverages || [],
      };
      const coverageMatchLevel = applyProviderServiceabilityMatchLevel(
        p,
        getProviderPresentationMatchLevelFromDb(matchInput, matchOptions),
      );
      const requiresAddressCheck = coverageModel === "live_address";
      const requiresPolygonCheck = coverageModel === "polygon";

      const trust = getProviderTrustSummary({
        ...p,
        states,
        zipCodes,
        tags,
        coverageModel,
        coverageMatchLevel,
        coverageNote: metadata?.note || null,
        coverageSourceUrl: metadata?.officialUrl || null,
        requiresAddressCheck,
        requiresPolygonCheck,
      });

      let websiteHost: string | null = null;
      if (p.website) {
        try {
          websiteHost = new URL(p.website).hostname.replace(/^www\./, "");
        } catch {
          websiteHost = null;
        }
      }

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        category: p.category,
        subCategory: p.subCategory,
        description: p.description,
        website: p.website,
        websiteHost,
        phone: p.phone,
        logoUrl: p.logoUrl,
        scope: p.scope,
        states,
        zipCodes,
        tags,
        popularityScore: p.popularityScore,
        popularityRank: popularityRank.get(p.id) ?? null,
        userCount: p.userCount || 0,
        fccServiceable: p.fccServiceable === true,
        utilityServiceable: p.utilityServiceable === true,
        // "Official link" = the provider exposes an outbound affiliate/official
        // link we surface; otherwise it's a directory listing only.
        affiliateActive: Boolean(p.affiliateActive),
        hasWebsite: Boolean(p.website),
        hasPhone: Boolean(p.phone),
        coverageModel,
        coverageMatchLevel,
        coverageConfidence: trust.coverageConfidence,
        coverageNote: metadata?.note || null,
        coverageSourceUrl: metadata?.officialUrl || null,
        requiresAddressCheck,
        requiresPolygonCheck,
        trust,
      };
    });

  // Compare rows are defined by the union of attributes across the picked
  // providers so the UI can render an aligned table without re-deriving it.
  const allTags = [...new Set(providers.flatMap((p) => p.tags))].sort((a, b) => a.localeCompare(b));
  const categories = [...new Set(providers.map((p) => p.category))];

  return NextResponse.json({
    mode: "compare",
    providers,
    comparedCount: providers.length,
    sameCategory: categories.length === 1,
    categories,
    allTags,
    address: address
      ? { id: address.id, state: address.state, zip: address.zip, city: address.city, nickname: address.nickname ?? null }
      : null,
  });
}
