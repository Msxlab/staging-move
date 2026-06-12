import { NextRequest } from "next/server";
import { guardCronRequest } from "@/lib/cron-guard";
import { refreshPartnerConsentById } from "@/lib/partner-consent-refresh";

export const runtime = "nodejs";

/**
 * POST /api/partner-consents/[id]/refresh
 *
 * Legacy compatibility path. The scheduler-safe canonical route is
 * /api/cron/partner-consents/[id]/refresh.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardCronRequest(request, "partner-consent-refresh", { limit: 60 });
  if (!guard.ok) return guard.response;

  const { id } = await params;
  return refreshPartnerConsentById(id);
}
