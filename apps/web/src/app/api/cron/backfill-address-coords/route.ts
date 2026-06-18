/**
 * Cron / maintenance: backfill latitude+longitude for addresses that are
 * missing coordinates.
 *
 * Why: coordinates are only set best-effort at address create/update time
 * (geocodeFallbackForPersist). Addresses created before that shipped — or
 * manual entries whose geocode failed at the time — keep null coordinates,
 * which is what makes the route-map preview (mobile transit banner + the
 * Moving Plan screen) silently fall back to the stylized canvas. This sweep
 * fills those gaps so the real map can render.
 *
 * Safety:
 *  - Bounded to BATCH_SIZE rows per tick (each row is one upstream Census
 *    geocode call). Run repeatedly until `moreLikely` is false.
 *  - Idempotent: only rows still missing a coordinate are selected, so a
 *    second run after everything resolved finds zero.
 *  - Never overwrites existing coordinates (geocodeFallbackForPersist is the
 *    same fail-open helper used on create; we omit lat/lng in the call so it
 *    runs for the rows we already filtered to incomplete).
 *  - Skips soft-deleted addresses.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardCronRequest } from "@/lib/cron-guard";
import { geocodeFallbackForPersist } from "@/lib/census-geocoder";

const BATCH_SIZE = 25;

export async function GET(req: NextRequest) {
  const guard = await guardCronRequest(req, "backfill-address-coords");
  if (!guard.ok) return guard.response;
  return run();
}

export async function POST(req: NextRequest) {
  const guard = await guardCronRequest(req, "backfill-address-coords");
  if (!guard.ok) return guard.response;
  return run();
}

async function run() {
  const candidates = await prisma.address.findMany({
    where: {
      deletedAt: null,
      OR: [{ latitude: null }, { longitude: null }],
    },
    select: { id: true, street: true, city: true, state: true, zip: true },
    take: BATCH_SIZE,
    orderBy: { createdAt: "asc" },
  });

  let updated = 0;
  for (const addr of candidates) {
    // Omit lat/lng so the fail-open helper actually geocodes — we already
    // filtered to rows that are missing a coordinate.
    const coords = await geocodeFallbackForPersist({
      street: addr.street,
      city: addr.city,
      state: addr.state,
      zip: addr.zip,
    });
    if (!coords) continue;
    await prisma.address.update({
      where: { id: addr.id },
      data: { latitude: coords.latitude, longitude: coords.longitude },
    });
    updated += 1;
  }

  return NextResponse.json({
    ok: true,
    scanned: candidates.length,
    updated,
    // True when the page was full — there are probably more rows to sweep.
    moreLikely: candidates.length === BATCH_SIZE,
  });
}
