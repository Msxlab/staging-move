import { NextRequest, NextResponse } from "next/server";
import { guardCronRequest } from "@/lib/cron-guard";
import { provisionConfiguredStoreReviewAccounts } from "@/lib/store-review-account";

export const runtime = "nodejs";

async function handle(request: NextRequest) {
  const guard = await guardCronRequest(request, "store-review-accounts", {
    limit: 6,
    windowSeconds: 60,
  });
  if (!guard.ok) return guard.response;

  const result = await provisionConfiguredStoreReviewAccounts({ request });
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
