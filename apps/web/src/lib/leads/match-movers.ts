import { prisma } from "@/lib/db";

/**
 * Lead routing — match a moving lead to deliverable partners (R3, movers first).
 *
 * v1 recipients are APPROVED MoverApplications: they carry a contactEmail (the
 * FMCSA MovingCompany catalog has none) and opted into the program, and their
 * `serviceStates` (comma-separated, e.g. "TX,OK,NM") declare where they work. A
 * partner with NO declared states is treated as nationwide. Capped at
 * MAX_LEAD_MATCHES so a single submit can't fan out unbounded. Fail-safe: any
 * error returns no matches (the lead is still captured; nothing is delivered).
 */

export const MAX_LEAD_MATCHES = 4;

export interface MoverMatch {
  moverApplicationId: string;
  companyName: string;
  contactEmail: string;
  /** Declared service states (empty = nationwide). */
  serviceStates: string[];
}

function parseStates(csv: string | null | undefined): string[] {
  return (csv || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

export async function matchMoversForLead(params: {
  toState?: string | null;
  fromState?: string | null;
  limit?: number;
}): Promise<MoverMatch[]> {
  const limit = Math.min(Math.max(params.limit ?? MAX_LEAD_MATCHES, 1), MAX_LEAD_MATCHES);
  // Route on the destination state (where the local move work happens), falling
  // back to the origin when the destination is unknown.
  const target = (params.toState || params.fromState || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(target)) return [];

  let apps: Array<{
    id: string;
    companyLegalName: string;
    dbaName: string | null;
    contactEmail: string | null;
    serviceStates: string | null;
  }>;
  try {
    // Approved partners are few, so an in-memory state filter is fine for v1
    // (avoids a substring LIKE that would false-match "TX" inside "ATXN").
    apps = await prisma.moverApplication.findMany({
      where: { status: "APPROVED" },
      select: {
        id: true,
        companyLegalName: true,
        dbaName: true,
        contactEmail: true,
        serviceStates: true,
      },
      orderBy: [{ fleetSize: "desc" }, { createdAt: "asc" }],
    });
  } catch {
    return [];
  }

  const matches: MoverMatch[] = [];
  for (const app of apps) {
    if (!app.contactEmail) continue;
    const states = parseStates(app.serviceStates);
    if (states.length > 0 && !states.includes(target)) continue; // empty = nationwide
    matches.push({
      moverApplicationId: app.id,
      companyName: app.dbaName?.trim() || app.companyLegalName,
      contactEmail: app.contactEmail,
      serviceStates: states,
    });
    if (matches.length >= limit) break;
  }
  return matches;
}
