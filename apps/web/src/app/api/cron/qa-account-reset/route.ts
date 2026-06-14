import { NextRequest, NextResponse } from "next/server";
import { guardCronRequest } from "@/lib/cron-guard";
import {
  getQaResettableAccountEmail,
  resetAllowlistedQaAccountForSignup,
} from "@/lib/qa-account";

export const runtime = "nodejs";

async function handle(request: NextRequest) {
  const guard = await guardCronRequest(request, "qa-account-reset", {
    limit: 3,
    windowSeconds: 60,
  });
  if (!guard.ok) return guard.response;

  const email = getQaResettableAccountEmail();
  if (!email) {
    return NextResponse.json({
      ok: true,
      reset: false,
      reason: "config_disabled",
    });
  }

  const result = await resetAllowlistedQaAccountForSignup({ email });
  return NextResponse.json({ ok: true, email, ...result });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
