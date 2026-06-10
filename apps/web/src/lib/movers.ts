import { prisma } from "@/lib/db";

/**
 * Licensed-movers query helpers (FMCSA household-goods carriers).
 *
 * Reads the `MovingCompany` catalog (populated by scripts/etl-fmcsa-movers.mjs
 * from the public FMCSA census) and the admin-managed `SponsoredPlacement`
 * rows. Catalog rows are read-only here; the only writes are the sponsored
 * impression/click counters, which are FIRE-AND-FORGET by house rule — they
 * may never add latency or failures to a user path.
 *
 * Honest-data notes baked into the row shape:
 *  - `complaintCount2y` has NO public bulk source (the FMCSA NCCDB is not
 *    public), so it is 0 unless an enrichment lands; the UI must treat 0 as
 *    "check the official record", not "zero complaints".
 *  - `protectYourMoveUrl` points at the official FMCSA mover search
 *    (protectyourmove.gov's company-search tool). The form has no documented
 *    per-company GET deep link, so each row links the search page and the UI
 *    surfaces the USDOT # to look up.
 */

/** Hard response ceiling — the API never returns more than this many movers. */
export const MAX_MOVERS = 10;

/**
 * Official FMCSA "Protect Your Move" company search (the tool behind
 * protectyourmove.gov). No documented per-company GET parameters exist, so
 * this is the same destination for every row; kept as a per-row function so a
 * future deep-link format is a one-line change.
 */
const PROTECT_YOUR_MOVE_SEARCH_URL = "https://ai.fmcsa.dot.gov/hhg/search.asp";

export function protectYourMoveLink(_usdotNumber: number): string {
  return PROTECT_YOUR_MOVE_SEARCH_URL;
}

/** API row shape for GET /api/movers (and the sponsored slot). */
export interface MoverRow {
  id: string;
  usdotNumber: number;
  /** Display name — DBA when present, else the legal name. */
  name: string;
  legalName: string;
  dbaName: string | null;
  city: string | null;
  state: string;
  phone: string | null;
  fleetSize: number | null;
  complaintCount2y: number;
  safetyRating: string | null;
  /** ISO date of the FMCSA snapshot this row was last refreshed from. */
  dataAsOf: string;
  protectYourMoveUrl: string;
}

interface MovingCompanyRecord {
  id: string;
  usdotNumber: number;
  legalName: string;
  dbaName: string | null;
  state: string;
  city: string | null;
  phone: string | null;
  fleetSize: number | null;
  complaintCount2y: number;
  safetyRating: string | null;
  dataAsOf: Date;
}

const MOVER_SELECT = {
  id: true,
  usdotNumber: true,
  legalName: true,
  dbaName: true,
  state: true,
  city: true,
  phone: true,
  fleetSize: true,
  complaintCount2y: true,
  safetyRating: true,
  dataAsOf: true,
} as const;

export function toMoverRow(company: MovingCompanyRecord): MoverRow {
  return {
    id: company.id,
    usdotNumber: company.usdotNumber,
    name: company.dbaName?.trim() || company.legalName,
    legalName: company.legalName,
    dbaName: company.dbaName,
    city: company.city,
    state: company.state,
    phone: company.phone,
    fleetSize: company.fleetSize,
    complaintCount2y: company.complaintCount2y,
    safetyRating: company.safetyRating,
    dataAsOf: company.dataAsOf.toISOString().slice(0, 10),
    protectYourMoveUrl: protectYourMoveLink(company.usdotNumber),
  };
}

/**
 * Ranking (pure, exported for tests): FMCSA safety rating first
 * (Satisfactory > unrated > Conditional > Unsatisfactory), then fleet size
 * descending (nulls last), then legal name for a stable tiebreak. An
 * Unsatisfactory-rated carrier is never hidden — it is honest public data —
 * it just sorts last.
 */
const SAFETY_RANK: Record<string, number> = {
  satisfactory: 0,
  conditional: 2,
  unsatisfactory: 3,
};

function safetyRank(rating: string | null): number {
  if (!rating) return 1; // unrated sits between Satisfactory and Conditional
  return SAFETY_RANK[rating.trim().toLowerCase()] ?? 1;
}

export function rankMovers<T extends { safetyRating: string | null; fleetSize: number | null; legalName: string }>(
  movers: T[],
): T[] {
  return [...movers].sort((a, b) => {
    const safety = safetyRank(a.safetyRating) - safetyRank(b.safetyRating);
    if (safety !== 0) return safety;
    const fleet = (b.fleetSize ?? -1) - (a.fleetSize ?? -1);
    if (fleet !== 0) return fleet;
    return a.legalName.localeCompare(b.legalName);
  });
}

/**
 * Household-goods movers for a destination state (optionally narrowed to a
 * city). Active + HHG-authorized rows only; ranked by safety rating then
 * fleet size; capped at MAX_MOVERS regardless of the caller's `limit`.
 */
export async function getMoversByState(params: {
  state: string;
  city?: string | null;
  limit?: number;
}): Promise<MoverRow[]> {
  const state = params.state.trim().toUpperCase();
  const city = params.city?.trim() || null;
  const limit = Math.min(Math.max(params.limit ?? MAX_MOVERS, 1), MAX_MOVERS);

  // Over-fetch a bounded candidate pool so the safety-aware ranking has
  // something to reorder, then slice to the cap.
  const companies = await prisma.movingCompany.findMany({
    where: {
      state,
      active: true,
      hhgAuthorization: true,
      ...(city ? { city } : {}),
    },
    select: MOVER_SELECT,
    orderBy: [{ fleetSize: "desc" }, { legalName: "asc" }],
    take: 50,
  });
  return rankMovers(companies).slice(0, limit).map(toMoverRow);
}

// ── Sponsored placement (flag-gated by SPONSORED_ENABLED at the route) ───────

export interface SponsoredMover {
  placementId: string;
  /** FTC disclosure label — the UI MUST render this on the card. */
  label: string;
  mover: MoverRow;
}

/**
 * The single active mover placement for a state (stateScope match or
 * placement with no state scope), resolved to its MovingCompany. Returns null
 * when there is no live placement, the target is missing/inactive/non-HHG, or
 * anything throws — a sponsored slot may never break the organic list.
 */
export async function getActiveSponsoredMover(
  state: string,
  now: Date = new Date(),
): Promise<SponsoredMover | null> {
  try {
    const normalized = state.trim().toUpperCase();
    const placement = await prisma.sponsoredPlacement.findFirst({
      where: {
        kind: "mover",
        active: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
        OR: [{ stateScope: normalized }, { stateScope: null }],
      },
      // Prefer the state-targeted placement over a national one, then newest.
      orderBy: [{ stateScope: "desc" }, { startsAt: "desc" }],
      select: { id: true, label: true, targetId: true },
    });
    if (!placement) return null;

    const company = await prisma.movingCompany.findUnique({
      where: { id: placement.targetId },
      select: { ...MOVER_SELECT, active: true, hhgAuthorization: true },
    });
    if (!company || !company.active || !company.hhgAuthorization) return null;

    return {
      placementId: placement.id,
      label: placement.label?.trim() || "Sponsored",
      mover: toMoverRow(company),
    };
  } catch {
    return null;
  }
}

/**
 * Fire-and-forget counter bumps. Synchronous from the caller's perspective:
 * the prisma promise is detached and every failure is swallowed, so these can
 * never add latency or errors to the request that triggered them.
 */
export function recordSponsoredImpression(placementId: string): void {
  bumpPlacementCounter(placementId, "impressions");
}

export function recordSponsoredClick(placementId: string): void {
  bumpPlacementCounter(placementId, "clicks");
}

function bumpPlacementCounter(placementId: string, counter: "impressions" | "clicks"): void {
  try {
    if (!placementId || typeof placementId !== "string" || placementId.length > 30) return;
    const data =
      counter === "impressions" ? { impressions: { increment: 1 } } : { clicks: { increment: 1 } };
    void prisma.sponsoredPlacement
      .update({
        where: { id: placementId },
        data,
      })
      .catch(() => {
        // Best-effort counters only.
      });
  } catch {
    // Never throws by contract.
  }
}
