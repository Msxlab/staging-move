import { NextRequest, NextResponse } from "next/server";
import { requireDbUserId } from "@/lib/auth";
import { recordSponsoredClick } from "@/lib/movers";

/**
 * Fire-and-forget click beacon for a sponsored placement (provider slot in the
 * recommendations surface, etc.). Mirrors the mover sponsored-click counter that
 * lives on POST /api/movers, but generic by placementId so any sponsored surface
 * can use it. The counter bump is best-effort and never blocks the outbound link;
 * this route only authenticates and validates, then returns immediately.
 *
 * CCPA/CPRA note: this records ONLY an anonymous, placement-level counter
 * (`recordSponsoredClick(placementId)`) — no user identifier is stored or shared —
 * so it is not a "sale/share" of personal information and is intentionally NOT
 * gated by the Do-Not-Sell opt-out (`hasCcpaOptOut`). The attributed, per-user
 * `/api/affiliate/click` path IS gated.
 */
export async function POST(request: NextRequest) {
  try {
    await requireDbUserId();
    const body = await request.json().catch(() => null);
    const placementId = body?.placementId;
    if (typeof placementId === "string" && placementId.length > 0 && placementId.length <= 30) {
      recordSponsoredClick(placementId);
    }
    return NextResponse.json({ ok: true });
  } catch {
    // Beacons are best-effort; never surface an error to the click path.
    return NextResponse.json({ ok: true });
  }
}
