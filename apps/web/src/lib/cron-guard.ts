/**
 * Cron route guard: combines internal-secret verification with a
 * per-route rate limit so a leaked CRON_SECRET cannot be used to spam
 * expensive jobs.
 *
 * Every web /api/cron/* route accepts authenticated calls from Ofelia
 * (docker scheduler) or DigitalOcean's job runner. The auth alone is
 * adequate against unauthenticated callers, but if the secret ever leaks
 * (CI logs, .env file in a backup, screen capture), an attacker could
 * call expensive endpoints — `data-retention`, `monthly-report`,
 * `weekly-digest` — in a tight loop and exhaust the DB or email quota.
 *
 * Default ceiling is 10 requests per route per minute identified by the
 * route name + caller IP. That's tight enough to bound abuse from a
 * leaked secret (10 invocations is one minute of trial-and-error before
 * 429s start) without blocking legitimate Ofelia retries or test runs.
 * Single-tick jobs that can pass `limit: 1`; heavier per-second jobs
 * (e.g. webhooks reconciliation) can pass `limit: 60`.
 *
 * Use this in cron route handlers BEFORE doing any DB or email work:
 *
 *   const guard = await guardCronRequest(request, "blog-publish");
 *   if (!guard.ok) return guard.response;
 */

import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { verifyInternalAuth } from "@/lib/internal-secrets";

interface CronGuardOptions {
  limit?: number;
  windowSeconds?: number;
}

interface CronGuardOk {
  ok: true;
}

interface CronGuardDenied {
  ok: false;
  response: NextResponse;
}

export async function guardCronRequest(
  request: Request,
  routeName: string,
  options: CronGuardOptions = {},
): Promise<CronGuardOk | CronGuardDenied> {
  const xCronSecret = request.headers.get("x-cron-secret");
  const authHeader = request.headers.get("authorization");
  const effective = authHeader || (xCronSecret ? `Bearer ${xCronSecret}` : null);

  if (!verifyInternalAuth(effective, "cron")) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  // Per-route window. The key is the route slug + a coarse caller bucket
  // (header-derived IP if present, otherwise the literal "cron"). We
  // avoid keying off the secret itself so a rotated secret doesn't reset
  // the limiter and allow a burst.
  const callerBucket =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "cron";

  const limit = options.limit ?? 10;
  const windowSeconds = options.windowSeconds ?? 60;

  const rl = await rateLimit(`cron:${routeName}:${callerBucket}`, {
    limit,
    windowSeconds,
    failClosed: true,
  });

  if (!rl.success) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((rl.resetAt - Date.now()) / 1000),
    );
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Cron route rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
      ),
    };
  }

  return { ok: true };
}
