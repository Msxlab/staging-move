import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { apiGateErrorResponse } from "@/lib/api-gates";
import { rateLimit } from "@/lib/rate-limit";

// Where the click came from — constrained so the column stays a small, known
// set for reporting. Anything else is recorded as "unknown" rather than rejected.
const ALLOWED_SOURCES = new Set(["provider_detail", "services", "recommendation", "providers", "moving"]);

function isHttpsUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

// POST /api/affiliate/click
// Body: { providerId, addressId?, source }
//
// Records an outbound affiliate click and returns the provider's stored
// affiliate URL. The redirect target is ALWAYS read from the database, never
// from the client, so this endpoint cannot be turned into an open redirect.
export async function POST(request: NextRequest) {
  try {
    const userId = await requireDbUserId();

    // User-scoped + fail-closed: a click write should be attributed per account,
    // and a Redis outage shouldn't open an unbounded write path.
    const rl = await rateLimit(`affiliate:click:user:${userId}`, {
      limit: 30,
      windowSeconds: 60,
      failClosed: true,
    });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const providerId = typeof body?.providerId === "string" ? body.providerId : "";
    let addressId =
      typeof body?.addressId === "string" && body.addressId.trim() ? body.addressId.trim() : null;
    const rawSource = typeof body?.source === "string" ? body.source : "";
    const source = ALLOWED_SOURCES.has(rawSource) ? rawSource : "unknown";

    if (!providerId) {
      return NextResponse.json({ error: "providerId is required" }, { status: 400 });
    }

    const provider = await prisma.serviceProvider.findFirst({
      where: { id: providerId, deletedAt: null },
      select: { id: true, affiliateActive: true, affiliateUrl: true, affiliateNetwork: true },
    });

    // Treat "no active affiliate offer" exactly like "not found": never disclose
    // which providers have inactive affiliate rows, and never hand back a
    // non-TLS link as a user-facing redirect.
    if (!provider || !provider.affiliateActive || !isHttpsUrl(provider.affiliateUrl)) {
      return NextResponse.json({ error: "No affiliate offer for this provider." }, { status: 404 });
    }

    // Only attribute an address the caller actually owns; otherwise drop it so a
    // forged addressId can't be written against this user's clicks.
    if (addressId) {
      const owned = await prisma.address.findFirst({
        where: { id: addressId, userId, deletedAt: null },
        select: { id: true },
      });
      if (!owned) addressId = null;
    }

    // De-dup: a refresh / double-click within 30 min shouldn't inflate counts (or
    // later corrupt EPC). Still return the URL either way so the CTA always works.
    const recent = await prisma.affiliateClick.findFirst({
      where: { userId, providerId: provider.id, createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) } },
      select: { id: true },
    });
    if (!recent) {
      await prisma.affiliateClick.create({
        data: {
          userId,
          providerId: provider.id,
          addressId,
          source,
          network: provider.affiliateNetwork,
        },
      });
    }

    return NextResponse.json({ url: provider.affiliateUrl });
  } catch (error) {
    const gate = apiGateErrorResponse(error);
    if (gate) return gate;
    console.error("Affiliate click failed:", error);
    return NextResponse.json({ error: "Could not record affiliate click" }, { status: 500 });
  }
}
