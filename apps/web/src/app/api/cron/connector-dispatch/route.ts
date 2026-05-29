import { NextRequest, NextResponse } from "next/server";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { isApiConnectorsEnabled } from "@/lib/connector-oauth";
import { runDueDispatches } from "@/lib/connector-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cron/system auth: Bearer CRON_SECRET. */
async function isCronAuthorized(request: NextRequest): Promise<boolean> {
  const secret = (await getRuntimeConfigValue("CRON_SECRET")) ?? process.env.CRON_SECRET ?? "";
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  return bearer.length > 0 && bearer === secret;
}

/**
 * POST /api/cron/connector-dispatch
 *
 * The dispatcher worker. Claims due ConnectorDispatch rows and runs each
 * through its connector (allowlisted client + circuit breaker), then applies
 * the planner's retry/fallback decision. Gated by FEATURE_API_CONNECTORS — a
 * no-op when the feature is off.
 */
async function handle(request: NextRequest): Promise<NextResponse> {
  if (!(await isCronAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
