import { NextRequest, NextResponse } from "next/server";
import { guardCronRequest } from "@/lib/cron-guard";
import {
  getQaResettableAccountEmails,
  resetAllowlistedQaAccountForSignup,
} from "@/lib/qa-account";

export const runtime = "nodejs";

async function handle(request: NextRequest) {
  const guard = await guardCronRequest(request, "qa-account-reset", {
    limit: 3,
    windowSeconds: 60,
  });
  if (!guard.ok) return guard.response;

  const emails = getQaResettableAccountEmails();
  if (emails.length === 0) {
    return NextResponse.json({
      ok: true,
      reset: false,
      reason: "config_disabled",
    });
  }

  const accounts = [];
  for (const email of emails) {
    const result = await resetAllowlistedQaAccountForSignup({ email });
    accounts.push({ email, ...result });
  }

  return NextResponse.json({
    ok: true,
    reset: accounts.some((account) => account.reset),
    accounts,
  });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
