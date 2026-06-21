import { prisma } from "@/lib/db";

/**
 * kind=provider sponsored placement reader — the catalog-provider analogue of
 * getActiveSponsoredMover (lib/movers.ts). The SponsoredPlacement model already
 * supports kind="provider" with a ServiceProvider targetId + categoryScope, so
 * this needs no schema change; it was simply never read/rendered.
 *
 * Ranking integrity (docs/ai/free-pivot/19 §7): the recommendation engine never
 * weights sponsorship. Sponsored revenue comes ONLY from a separate, FTC-labeled
 * slot — never by reordering organic results. This reader returns at most ONE
 * placement for the caller to render in that dedicated, labeled box.
 *
 * Fail-safe by construction: returns null on no live placement, a missing /
 * inactive target, or any throw — a sponsored slot may never break the page.
 */

export interface SponsoredProvider {
  placementId: string;
  /** FTC disclosure label — the UI MUST render this on the card. */
  label: string;
  provider: {
    id: string;
    name: string;
    slug: string;
    category: string;
    website: string | null;
    logoUrl: string | null;
    affiliateActive: boolean;
  };
}

const SPONSORED_PROVIDER_SELECT = {
  id: true,
  name: true,
  slug: true,
  category: true,
  website: true,
  logoUrl: true,
  affiliateActive: true,
  isActive: true,
} as const;

/**
 * The single active provider placement for a (category, state), preferring the
 * most specific scope: a category+state targeted placement beats a category-only
 * one, which beats a fully national/all-category one; ties break to newest.
 */
export async function getActiveSponsoredProvider(
  category: string | null | undefined,
  state: string | null | undefined,
  now: Date = new Date(),
): Promise<SponsoredProvider | null> {
  try {
    const normalizedState = state ? state.trim().toUpperCase() : null;
    const normalizedCategory = category ? category.trim().toUpperCase() : null;

    const placement = await prisma.sponsoredPlacement.findFirst({
      where: {
        kind: "provider",
        active: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
        AND: [
          { OR: [{ stateScope: normalizedState }, { stateScope: null }] },
          { OR: [{ categoryScope: normalizedCategory }, { categoryScope: null }] },
        ],
      },
      // Most specific scope first (a real targeted buy outranks a catch-all),
      // then newest. nulls sort last under "desc" in MySQL, so a concrete
      // categoryScope/stateScope is preferred over null.
      orderBy: [{ categoryScope: "desc" }, { stateScope: "desc" }, { startsAt: "desc" }],
      select: { id: true, label: true, targetId: true },
    });
    if (!placement) return null;

    const provider = await prisma.serviceProvider.findUnique({
      where: { id: placement.targetId },
      select: SPONSORED_PROVIDER_SELECT,
    });
    if (!provider || !provider.isActive) return null;

    return {
      placementId: placement.id,
      label: placement.label?.trim() || "Sponsored",
      provider: {
        id: provider.id,
        name: provider.name,
        slug: provider.slug,
        category: provider.category,
        website: provider.website,
        logoUrl: provider.logoUrl,
        affiliateActive: Boolean(provider.affiliateActive),
      },
    };
  } catch {
    return null;
  }
}
