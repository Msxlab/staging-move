import { prisma } from "@/lib/db";
import { matchMoversForLead, MAX_LEAD_MATCHES } from "@/lib/leads/match-movers";

/**
 * Category-aware lead routing (R4). Returns the deliverable partners for a lead,
 * unified across partner types:
 *  - "moving"  → APPROVED MoverApplications (delegates to matchMoversForLead).
 *  - "cleaning"/"junk" → APPROVED generic Partners of that category (R4).
 * Both kinds carry a contactEmail + serviceStates (empty = nationwide). Capped at
 * MAX_LEAD_MATCHES; fail-safe to [] so a routing error never blocks lead capture.
 */

export type LeadPartnerKind = "mover_application" | "partner";

export interface LeadPartnerMatch {
  partnerKind: LeadPartnerKind;
  partnerId: string;
  companyName: string;
  contactEmail: string;
  serviceStates: string[];
}

// Generic-Partner categories (movers use their own specialized portal).
const PARTNER_CATEGORIES = new Set(["cleaning", "junk"]);

function parseStates(csv: string | null | undefined): string[] {
  return (csv || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

export async function matchPartnersForLead(params: {
  category: string;
  toState?: string | null;
  fromState?: string | null;
  limit?: number;
}): Promise<LeadPartnerMatch[]> {
  const category = (params.category || "moving").toLowerCase();

  if (category === "moving") {
    const movers = await matchMoversForLead({
      toState: params.toState,
      fromState: params.fromState,
      limit: params.limit,
    });
    return movers.map((m) => ({
      partnerKind: "mover_application" as const,
      partnerId: m.moverApplicationId,
      companyName: m.companyName,
      contactEmail: m.contactEmail,
      serviceStates: m.serviceStates,
    }));
  }

  if (!PARTNER_CATEGORIES.has(category)) return [];

  const limit = Math.min(Math.max(params.limit ?? MAX_LEAD_MATCHES, 1), MAX_LEAD_MATCHES);
  const target = (params.toState || params.fromState || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(target)) return [];

  let partners: Array<{
    id: string;
    companyName: string;
    contactEmail: string | null;
    serviceStates: string | null;
  }>;
  try {
    partners = await prisma.partner.findMany({
      where: { status: "APPROVED", category },
      select: { id: true, companyName: true, contactEmail: true, serviceStates: true },
      orderBy: { createdAt: "asc" },
    });
  } catch {
    return [];
  }

  const matches: LeadPartnerMatch[] = [];
  for (const p of partners) {
    if (!p.contactEmail) continue;
    const states = parseStates(p.serviceStates);
    if (states.length > 0 && !states.includes(target)) continue; // empty = nationwide
    matches.push({
      partnerKind: "partner",
      partnerId: p.id,
      companyName: p.companyName,
      contactEmail: p.contactEmail,
      serviceStates: states,
    });
    if (matches.length >= limit) break;
  }
  return matches;
}
