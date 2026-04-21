import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

/**
 * CCPA / CPRA opt-out resolver.
 *
 * Business code that routes data to "sell/share" surfaces — ad
 * networks, affiliate partners, anything classified as a sale under
 * CPRA — must call this helper FIRST and skip the transfer when it
 * returns `true`. The helper resolves from two sources:
 *
 *   1. Cookie `ccpa_opt_out=1` — fast path for anonymous visitors and
 *      client-side gating of third-party scripts at page load.
 *   2. DataConsent row with category=DO_NOT_SELL and granted=true —
 *      the authoritative record for logged-in users.
 *
 * The cookie and DB row are kept in sync by `/api/consent/ccpa` —
 * changing one via that endpoint mirrors the change into the other.
 */

const CCPA_COOKIE = "ccpa_opt_out";

function cookieSaysOptOut(value: string | undefined): boolean {
  return value === "1";
}

/**
 * Resolve opt-out state inside a route handler that already has the
 * `NextRequest`. Synchronous-feeling, single DB call at most.
 */
export async function hasCcpaOptOut(
  request: NextRequest,
  userId?: string | null,
): Promise<boolean> {
  if (cookieSaysOptOut(request.cookies.get(CCPA_COOKIE)?.value)) return true;
  if (!userId) return false;

  const row = await prisma.dataConsent
    .findFirst({
      where: { userId, category: "DO_NOT_SELL" },
      orderBy: { createdAt: "desc" },
      select: { granted: true },
    })
    .catch(() => null);
  return Boolean(row?.granted);
}

/**
 * Resolve opt-out state inside a server component or server action
 * where only `cookies()` is available (no direct `NextRequest`).
 */
export async function hasCcpaOptOutServer(
  userId?: string | null,
): Promise<boolean> {
  const cookieStore = await cookies();
  if (cookieSaysOptOut(cookieStore.get(CCPA_COOKIE)?.value)) return true;
  if (!userId) return false;

  const row = await prisma.dataConsent
    .findFirst({
      where: { userId, category: "DO_NOT_SELL" },
      orderBy: { createdAt: "desc" },
      select: { granted: true },
    })
    .catch(() => null);
  return Boolean(row?.granted);
}
