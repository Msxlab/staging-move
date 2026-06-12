import { NextRequest, NextResponse } from "next/server";
import { requireDbUserId } from "@/lib/auth";
import { apiGateErrorResponse } from "@/lib/api-gates";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { requestHasPlanFeature } from "@/lib/request-entitlements";
import {
  getActiveSponsoredMover,
  getMoversByState,
  recordSponsoredClick,
  recordSponsoredImpression,
} from "@/lib/movers";

// GET /api/movers?state=XX[&city=…] — FMCSA household-goods movers for a
// destination state. Family/Pro feature (`moverSuggestions`).
//
// Contract (GATE-API style, mirrors the dossier endpoint):
//   - 401 unauthenticated, 400 bad/missing state.
//   - Plan-gated requests answer HTTP 200 with { entitled:false,
//     upgradeRequired:"MOVER_SUGGESTIONS_UPGRADE_REQUIRED" } and NO mover
//     data — the client renders the upgrade teaser. Never 403.
//   - Entitled: { entitled:true, state, movers:[…max 10] } where every row
//     carries usdotNumber + a protectyourmove.gov link. Catalog data is
//     FMCSA registry information, NOT endorsements — the UI copy says so.
//   - `sponsored` (one clearly-labeled placement above organic results) is
//     present ONLY when the SPONSORED_ENABLED runtime flag is on AND an
//     active SponsoredPlacement(kind=mover) matches the state. Its
//     impression counter increments fire-and-forget — placement machinery
//     can never fail or slow the request.
//
// POST /api/movers — lightweight sponsored-click beacon:
//   body { placementId } → fire-and-forget clicks increment, always 204 for
//   an authenticated caller (invalid ids are silently ignored; a beacon has
//   no error contract worth leaking placement existence through).

async function sponsoredEnabled(): Promise<boolean> {
  const raw = await getRuntimeConfigValue("SPONSORED_ENABLED").catch(() => null);
  return raw?.trim().toLowerCase() === "true";
}

export async function GET(request: NextRequest) {
  try {
    const userId = await requireDbUserId();

    const stateParam = (request.nextUrl.searchParams.get("state") ?? "").trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(stateParam)) {
      return NextResponse.json({ error: "state must be a 2-letter code" }, { status: 400 });
    }
    const cityParam = request.nextUrl.searchParams.get("city")?.trim() || null;

    // Plan gate BEFORE any catalog/placement work — gated requests cost
    // nothing beyond the plan read (same posture as the dossier route).
    if (!(await requestHasPlanFeature(request, userId, "moverSuggestions"))) {
      return NextResponse.json({
        configured: true,
        entitled: false,
        upgradeRequired: "MOVER_SUGGESTIONS_UPGRADE_REQUIRED",
      });
    }

    const movers = await getMoversByState({ state: stateParam, city: cityParam });

    let sponsored = null;
    if (await sponsoredEnabled()) {
      sponsored = await getActiveSponsoredMover(stateParam);
      if (sponsored) recordSponsoredImpression(sponsored.placementId);
    }

    return NextResponse.json({
      configured: true,
      entitled: true,
      state: stateParam,
      city: cityParam,
      movers,
      sponsored,
    });
  } catch (error) {
    const authResponse = apiGateErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Failed to list movers:", error);
    return NextResponse.json({ error: "Failed to list movers" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireDbUserId();

    let placementId: unknown = null;
    try {
      const body = await request.json();
      placementId = body?.placementId;
    } catch {
      // Malformed beacon body — ignore (still 204 below).
    }

    if (typeof placementId === "string" && placementId && (await sponsoredEnabled())) {
      recordSponsoredClick(placementId);
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const authResponse = apiGateErrorResponse(error);
    if (authResponse) return authResponse;
    // A counter beacon must never surface a 500 to the client.
    return new NextResponse(null, { status: 204 });
  }
}
