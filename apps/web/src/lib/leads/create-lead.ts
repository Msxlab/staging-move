import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/shared-encryption";
import { matchMoversForLead } from "@/lib/leads/match-movers";

/**
 * Create a moving lead and fan it out to matched partners (R3b).
 *
 * - PII (name/contact/notes) is encrypted into payloadEncrypted; only coarse
 *   routing fields (ZIP/state/date/size) are stored in the clear for matching.
 * - Idempotent: a repeat submit with the same idempotencyKey returns the existing
 *   lead instead of creating duplicates (double-tap / retry safe).
 * - The lead is created even with zero matches (captured for manual outreach /
 *   for when partners register) — status NEW vs MATCHED reflects that.
 * - Per-dispatch idempotencyKey = `${leadKey}:${moverApplicationId}` so a given
 *   partner is never double-dispatched for the same lead.
 */

export interface CreateLeadInput {
  userId: string;
  category?: string;
  fromZip?: string | null;
  toZip?: string | null;
  fromState?: string | null;
  toState?: string | null;
  moveDate?: Date | null;
  homeSize?: string | null;
  // PII — encrypted at rest.
  contactName: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
  // Attribution + abuse context.
  source?: string | null;
  clickToken?: string | null;
  ipHash?: string | null;
  userAgent?: string | null;
  locale?: string | null;
  // Immutable consent snapshot.
  consentAcceptedAt: Date;
  consentIpHash?: string | null;
  consentUserAgentHash?: string | null;
  termsVersion?: string | null;
  idempotencyKey: string;
}

export interface CreateLeadResult {
  leadId: string;
  matchedCount: number;
  deduped: boolean;
}

function normState(v?: string | null): string | null {
  const s = (v || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(s) ? s : null;
}

export async function createLead(input: CreateLeadInput): Promise<CreateLeadResult> {
  const existing = await prisma.lead.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: { id: true, matchedCount: true },
  });
  if (existing) return { leadId: existing.id, matchedCount: existing.matchedCount, deduped: true };

  const toState = normState(input.toState);
  const fromState = normState(input.fromState);
  const matches = await matchMoversForLead({ toState, fromState });

  const payloadEncrypted = encrypt(
    JSON.stringify({
      contactName: input.contactName,
      contactEmail: input.contactEmail ?? null,
      contactPhone: input.contactPhone ?? null,
      notes: input.notes ?? null,
    }),
  );

  const created = await prisma.lead.create({
    data: {
      category: input.category || "moving",
      userId: input.userId,
      status: matches.length > 0 ? "MATCHED" : "NEW",
      fromZip: input.fromZip || null,
      toZip: input.toZip || null,
      fromState,
      toState,
      moveDate: input.moveDate || null,
      homeSize: input.homeSize || null,
      payloadEncrypted,
      source: input.source || null,
      clickToken: input.clickToken || null,
      matchedCount: matches.length,
      idempotencyKey: input.idempotencyKey,
      ipHash: input.ipHash || null,
      userAgent: input.userAgent || null,
      locale: input.locale || null,
      consentAcceptedAt: input.consentAcceptedAt,
      consentIpHash: input.consentIpHash || null,
      consentUserAgentHash: input.consentUserAgentHash || null,
      termsVersion: input.termsVersion || null,
      dispatches: {
        create: matches.map((m) => ({
          moverApplicationId: m.moverApplicationId,
          status: "QUEUED",
          idempotencyKey: `${input.idempotencyKey}:${m.moverApplicationId}`,
        })),
      },
    },
    select: { id: true },
  });

  return { leadId: created.id, matchedCount: matches.length, deduped: false };
}
