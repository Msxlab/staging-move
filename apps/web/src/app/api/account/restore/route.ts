import { NextRequest, NextResponse } from "next/server";
import { restoreAccountFromDeletion } from "@/lib/account-deletion";

export const runtime = "nodejs";

/**
 * GET /api/account/restore?token=...
 *
 * The "undo" endpoint behind the emailed restore link for a grace-windowed
 * account deletion. The signed token IS the proof of intent (the user is
 * locked out, so there's no session) — no auth required, like the unsubscribe
 * and email-verification links. Restores the soft-deleted account, resumes
 * Stripe renewal, and cancels the pending deletion, then redirects to sign-in.
 *
 * Idempotent: a second click after a successful restore lands on the same
 * "restored" confirmation rather than erroring.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const base = (process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).replace(/\/+$/, "");

  const result = await restoreAccountFromDeletion(token).catch(() => ({
    ok: false as const,
    reason: "error",
  }));

  const dest = result.ok
    ? `${base}/sign-in?restored=1`
    : `${base}/sign-in?error=restore-${encodeURIComponent(result.reason || "failed")}`;
  return NextResponse.redirect(dest);
}
