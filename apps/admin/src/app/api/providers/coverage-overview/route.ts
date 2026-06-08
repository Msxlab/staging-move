import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 50 states + DC. The matcher treats DC as a coverage state (see the ZIP-prefix
// table in packages/shared/src/provider-coverage.ts), so it belongs here.
const ALL_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID",
  "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO",
  "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA",
  "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

// A state with fewer distinct providers than this is flagged "thin" — a gap an
// operator should fill. Tunable; 3 is a deliberately conservative floor.
const THIN_STATE_PROVIDER_THRESHOLD = 3;

/**
 * GET — per-STATE coverage overview. Aggregates the ServiceProviderCoverage
 * rows of ACTIVE, non-deleted, non-FEDERAL providers into per-state counts of
 * distinct providers and distinct categories, plus a federal baseline that
 * applies everywhere. Surfaces THIN states (few providers) and the specific
 * (state, category) gaps so operators know exactly where to add coverage.
 *
 * Read-only and permission-gated (providers.canRead). No mutation, no step-up.
 */
export async function GET(_request: NextRequest) {
  try {
    await requirePermission("providers", "canRead", { minimumRole: "VIEWER" });

    // FEDERAL providers cover every state implicitly (matching uses
    // scope='FEDERAL'); they have no per-state coverage rows. Count them as a
    // baseline that lifts every state, and break them down by category so the
    // gap math doesn't flag a category as missing in a state when a federal
    // provider already serves it nationwide.
    const [federalProviders, coverageRows] = await Promise.all([
      prisma.serviceProvider.findMany({
        where: { isActive: true, deletedAt: null, scope: "FEDERAL" },
        select: { id: true, category: true },
      }),
      // State-scoped coverage rows joined to their (active) provider's category.
      prisma.serviceProviderCoverage.findMany({
        where: {
          state: { not: null },
          provider: { isActive: true, deletedAt: null },
        },
        select: { state: true, provider: { select: { id: true, category: true } } },
      }),
    ]);

    const federalCategories = new Set(federalProviders.map((p) => p.category));
    const federalCount = federalProviders.length;

    // state -> { providerIds:Set, categories:Set }
    const perState = new Map<string, { providerIds: Set<string>; categories: Set<string> }>();
    for (const state of ALL_STATES) {
      perState.set(state, { providerIds: new Set(), categories: new Set() });
    }
    for (const row of coverageRows) {
      const state = row.state as string;
      const bucket = perState.get(state);
      if (!bucket) continue; // ignore stray/territory codes outside the 50+DC set
      if (row.provider?.id) bucket.providerIds.add(row.provider.id);
      if (row.provider?.category) bucket.categories.add(row.provider.category);
    }

    // The category universe that "should" be covered everywhere is the set of
    // categories that appear in ANY state-scoped coverage OR federally. We use
    // observed categories (not the full enum) so we never flag a state as
    // missing a category the catalog simply doesn't carry anywhere.
    const observedCategories = new Set<string>(federalCategories);
    for (const bucket of perState.values()) {
      for (const cat of bucket.categories) observedCategories.add(cat);
    }
    const observedCategoryList = Array.from(observedCategories).sort();

    const states = ALL_STATES.map((state) => {
      const bucket = perState.get(state)!;
      const stateProviderCount = bucket.providerIds.size;
      // Effective categories = state-specific categories ∪ federal categories.
      const effectiveCategories = new Set(bucket.categories);
      for (const cat of federalCategories) effectiveCategories.add(cat);
      const missingCategories = observedCategoryList.filter(
        (cat) => !effectiveCategories.has(cat),
      );
      return {
        state,
        stateProviderCount, // distinct state-scoped providers
        federalProviderCount: federalCount, // baseline applied everywhere
        totalProviderCount: stateProviderCount + federalCount,
        stateCategoryCount: bucket.categories.size,
        effectiveCategoryCount: effectiveCategories.size,
        missingCategories,
        isThin: stateProviderCount < THIN_STATE_PROVIDER_THRESHOLD,
      };
    });

    const thinStates = states
      .filter((s) => s.isThin)
      .sort((a, b) => a.stateProviderCount - b.stateProviderCount)
      .map((s) => ({ state: s.state, stateProviderCount: s.stateProviderCount }));

    // Per-category coverage breadth: in how many of the 50+DC states does this
    // category have a state-scoped provider? Federal categories are covered in
    // all states. Categories present in few states are the catalog-wide gaps.
    const categoryStateCount = new Map<string, Set<string>>();
    for (const [state, bucket] of perState.entries()) {
      for (const cat of bucket.categories) {
        if (!categoryStateCount.has(cat)) categoryStateCount.set(cat, new Set());
        categoryStateCount.get(cat)!.add(state);
      }
    }
    const categories = observedCategoryList.map((category) => {
      const isFederal = federalCategories.has(category);
      const statesCovered = isFederal
        ? ALL_STATES.length
        : categoryStateCount.get(category)?.size || 0;
      return {
        category,
        isFederal,
        statesCovered,
        statesMissing: ALL_STATES.length - statesCovered,
        coveragePct: Math.round((statesCovered / ALL_STATES.length) * 100),
      };
    });

    const thinCategories = categories
      .filter((c) => !c.isFederal && c.statesCovered < ALL_STATES.length)
      .sort((a, b) => a.statesCovered - b.statesCovered);

    return NextResponse.json({
      summary: {
        totalStates: ALL_STATES.length,
        federalProviderCount: federalCount,
        thinStateCount: thinStates.length,
        thinStateThreshold: THIN_STATE_PROVIDER_THRESHOLD,
        observedCategoryCount: observedCategoryList.length,
        fullyCoveredCategoryCount: categories.filter(
          (c) => c.statesCovered === ALL_STATES.length,
        ).length,
      },
      states,
      categories,
      thinStates,
      thinCategories,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to load coverage overview" }, { status: 500 });
  }
}
