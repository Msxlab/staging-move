import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireDbUserId } from "@/lib/auth";
import { apiGateErrorResponse } from "@/lib/api-gates";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { OFFERS_MOVING_QUOTES_FLAG, OFFERS_CLEANING_JUNK_FLAG, TERMS_VERSION } from "@locateflow/shared";
import { getRateLimitKey, rateLimit } from "@/lib/rate-limit";
import { resolveClientIpFromHeaders } from "@/lib/client-ip";
import { getRequestHashSnapshot, hashForSnapshot } from "@/lib/acquisition-campaigns";
import { createLead } from "@/lib/leads/create-lead";

export const dynamic = "force-dynamic";

const HOME_SIZES = ["STUDIO", "ONE_BR", "TWO_BR", "THREE_BR", "FOUR_PLUS", "OTHER"] as const;

const LEAD_CATEGORIES = ["moving", "cleaning", "junk"] as const;

const leadSchema = z.object({
  category: z.enum(LEAD_CATEGORIES).default("moving"),
  fromZip: z.string().trim().max(10).optional().nullable(),
  toZip: z.string().trim().max(10).optional().nullable(),
  fromState: z.string().trim().length(2).optional().nullable(),
  toState: z.string().trim().length(2).optional().nullable(),
  moveDate: z.string().trim().max(40).optional().nullable(),
  homeSize: z.enum(HOME_SIZES).optional().nullable(),
  contactName: z.string().trim().min(1).max(120),
  contactEmail: z.string().trim().email().max(255).optional().nullable(),
  contactPhone: z.string().trim().max(40).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  source: z.string().trim().max(60).optional().nullable(),
  // The user must explicitly consent to sharing their request with movers.
  consent: z.literal(true),
});

// POST /api/leads — submit one moving-quote request (R3). Gated by
// offers_moving_quotes_v1 (fail-closed); auth-only; consent required.
export async function POST(request: NextRequest) {
  try {
    const userId = await requireDbUserId();

    const rl = await rateLimit(getRateLimitKey(request, "leads", { userId }), {
      limit: 10,
      windowSeconds: 60 * 60,
    });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const parsed = leadSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      // A missing/false consent surfaces here too (z.literal(true)).
      return NextResponse.json({ error: "Invalid lead", code: "INVALID_LEAD" }, { status: 422 });
    }
    const d = parsed.data;

    // Category-aware rollout gate (fail-closed): moving rides offers_moving_quotes_v1;
    // cleaning/junk ride offers_cleaning_junk_v1.
    const gateFlag = d.category === "moving" ? OFFERS_MOVING_QUOTES_FLAG : OFFERS_CLEANING_JUNK_FLAG;
    if (!(await isFeatureEnabled(gateFlag, { userId }))) {
      return NextResponse.json({ error: "Not available" }, { status: 404 });
    }

    const moveDate = d.moveDate ? new Date(d.moveDate) : null;
    const ip = resolveClientIpFromHeaders(request.headers);
    const consentHashes = getRequestHashSnapshot(request);

    // Stable dedupe key: an identical request (same user, route, date, contact)
    // resubmitted (double-tap / retry) maps to the same lead.
    const idempotencyKey = (
      hashForSnapshot(
        [userId, d.category, d.fromZip, d.toZip, d.fromState, d.toState, d.moveDate, d.contactEmail]
          .map((v) => (v || "").toString().trim().toUpperCase())
          .join("|"),
      ) || `${userId}:${Date.now()}`
    ).slice(0, 120);

    const result = await createLead({
      userId,
      category: d.category,
      fromZip: d.fromZip ?? null,
      toZip: d.toZip ?? null,
      fromState: d.fromState ?? null,
      toState: d.toState ?? null,
      moveDate: moveDate && !Number.isNaN(moveDate.getTime()) ? moveDate : null,
      homeSize: d.homeSize ?? null,
      contactName: d.contactName,
      contactEmail: d.contactEmail ?? null,
      contactPhone: d.contactPhone ?? null,
      notes: d.notes ?? null,
      source: d.source ?? null,
      ipHash: hashForSnapshot(ip === "anonymous" ? null : ip),
      userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
      consentAcceptedAt: new Date(),
      consentIpHash: consentHashes.consentIpHash,
      consentUserAgentHash: consentHashes.consentUserAgentHash,
      termsVersion: TERMS_VERSION,
      idempotencyKey,
    });

    return NextResponse.json({
      ok: true,
      leadId: result.leadId,
      matchedCount: result.matchedCount,
    });
  } catch (error) {
    const gate = apiGateErrorResponse(error);
    if (gate) return gate;
    console.error("Lead submission error:", error);
    return NextResponse.json({ error: "Failed to submit lead" }, { status: 500 });
  }
}
