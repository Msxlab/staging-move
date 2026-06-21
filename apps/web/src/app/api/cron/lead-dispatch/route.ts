import { NextRequest, NextResponse } from "next/server";
import { guardCronRequest } from "@/lib/cron-guard";
import { drainLeadDispatches } from "@/lib/leads/dispatch-leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST|GET /api/cron/lead-dispatch
 *
 * The lead delivery worker (R3d). Drains QUEUED LeadDispatch rows and emails each
 * matched partner the lead, with backoff retry + idempotency. NOT gated by the
 * creation flag: once a lead is captured with the user's consent, it must be
 * delivered even if offers_moving_quotes_v1 is later turned off.
 */
async function handle(request: NextRequest): Promise<NextResponse> {
  const guard = await guardCronRequest(request, "lead-dispatch", { limit: 60 });
  if (!guard.ok) return guard.response;
  const result = await drainLeadDispatches({ batchSize: 50 });
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: NextRequest) {
  return handle(request);
}
export async function POST(request: NextRequest) {
  return handle(request);
}
