import { NextRequest, NextResponse } from "next/server";
import { guardCronRequest } from "@/lib/cron-guard";
import { isApiConnectorsEnabled } from "@/lib/connector-oauth";
import { runDueDispatches } from "@/lib/connector-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/cron/connector-dispatch
 *
 * The dispatcher worker. Claims due ConnectorDispatch rows and runs each
 * through its connector (allowlisted client + circuit breaker), then applies
 * the planner's retry/fallback decision. Gated by FEATURE_API_CONNECTORS — a
 * no-op when the feature is off.
 */
async function handle(request: NextRequest): Promise<NextResponse> {
  // Shared cron guard: constant-time secret check + per-route rate limit
  // (the bespoke bearer===secret check this replaces was timing-attackable
  // and had no rate limit — the highest-value target since it drives egress).
  const guard = await guardCronRequest(request, "connector-dispatch");
  if (!guard.ok) return guard.response;
  if (!(await isApiConnectorsEnabled())) {
    return NextResponse.json({ skipped: "disabled" });
  }
  const result = await runDueDispatches();
  return NextResponse.json(result);
}

// Vercel Cron invokes via GET (with the CRON_SECRET bearer); POST is kept for
// manual/system invocation. Both share one handler.
export async function GET(request: NextRequest) {
  return handle(request);
}
export async function POST(request: NextRequest) {
  return handle(request);
}
