# Adversarial Verification: security-surface-02

**Finding under review:** Internal/cron/webhook route prefixes are public at the middleware layer (fail-open by omission)
**Claimed severity:** High
**Category:** Architecture
**Verdict:** uncertain (architecturally accurate; severity overstated → Low/Info)

---

## What the original finding claims

1. `apps/web/src/middleware.ts` L76-86 lists `/api/internal/`, `/api/cron/`, `/api/webhooks/` in `PUBLIC_API_PREFIXES`.
2. `isPublicApi` (L140-153) short-circuits auth for them.
3. Protection exists ONLY inside each route handler (`verifyInternalAuth` / `guardCronRequest` / `stripe.constructEvent`).
4. Admin `middleware.ts` L661-663 likewise waves internal/cron through.
5. The boundary is fail-open: a newly added route under these prefixes that forgets its in-route guard is exposed by default. Safe default would be deny-then-allowlist.

## What the code actually shows

### The literal evidence is accurate

- `apps/web/src/middleware.ts:76-86` — `PUBLIC_API_PREFIXES` does contain `/api/internal/`, `/api/cron/`, `/api/webhooks/`. **Confirmed.**
- `apps/web/src/middleware.ts:140-153` — `isPublicApi()` iterates `PUBLIC_API_PREFIXES` with `pathname.startsWith(p)` and returns `true`. **Confirmed.**
- `apps/web/src/middleware.ts:816-817` — main middleware: `if (isPublicApi(...)) return ...nextWithCurrentPath(...)` BEFORE the `hasValidSession` gate at L819. So these prefixes never hit the session check. **Confirmed.**
- `apps/admin/src/middleware.ts:661-663` — `if (pathname.startsWith("/api/internal/") || pathname.startsWith("/api/cron/")) { return nextWithCsp(request); }` before the admin session check at L679. **Confirmed.** (Admin has no `/api/webhooks/` routes.)

So the structural characterization — middleware short-circuits auth for these prefixes, and the boundary is allowlist-public rather than deny-by-default — is factually correct.

### But the actual exposure claim does NOT hold for any current route

The finding's IMPACT hinges on "a single missing guard = unauthenticated access." I enumerated every route file under all three prefixes and confirmed **each one enforces its own guard**:

**Cron (`apps/web/src/app/api/cron/*`)** — all 28 route handlers call `guardCronRequest(request, "...")`, which calls `verifyInternalAuth(effective, "cron")` and returns 401 on failure (`apps/web/src/lib/cron-guard.ts:60-65`). Verified via grep: every `route.ts` under `cron/` imports and invokes `guardCronRequest` (admin-daily-digest, daily-digest, contract-reminders, workspace-purge, connector-dispatch, weekly-digest, checkout-cleanup, backfill-address-coords, admin-monthly-report, uptime-check, blog-publish, bill-reminders, monthly-report, trial-check, lead-dispatch, stripe-reconcile, scheduled-delivery, lifecycle-nudges, store-review-accounts, data-retention, move-reminders, synthetic-monitor, task-reminders, bill-overdue, move-week-alerts, blog-cleanup, provider-stats, qa-account-reset, partner-consents/[id]/refresh).

**Internal (`apps/web/src/app/api/internal/*`)** — all 3 routes call `verifyInternalAuth(request.headers.get("authorization"), ...)` and 401 on failure:
- `internal/rate-limit-log/route.ts:39` (kind `"internal"`)
- `internal/ip-rules/route.ts:8` (kind `"internal"`)
- `internal/impersonate/route.ts:43` (kind `"impersonation"`)

**Webhooks (`apps/web/src/app/api/webhooks/*`)** — all 4 verify a cryptographic signature/identity in-handler:
- `webhooks/stripe/route.ts:612` — `stripe.webhooks.constructEvent(body, signature, webhookSecret)`.
- `webhooks/resend/route.ts:49` — `verifyResendSignature(...)`.
- `webhooks/appstore/route.ts:87,127-130` — `verifyAppleJws(...)` on the JWS; returns 400 "Invalid signature" on failure.
- `webhooks/playstore/route.ts:159` — `verifyPubsubOidcToken(...)` against Google JWKS; returns 401 on failure.

`verifyInternalAuth` (`apps/web/src/lib/internal-secrets.ts:49-78`) uses constant-time comparison (`safeEqual`) and scoped secrets per kind. The guards are real, not nominal.

### Additional defense-in-depth at the middleware layer

The prefixes are not entirely unprotected at the edge:
- `apps/web/src/middleware.ts:320-349` — cron requests that DO present a credential are coarse-rate-limited (1/60s per credential hash) before the handler; credential-less requests fall through to the route's 401.
- `apps/web/src/middleware.ts:351-370` — internal prefix is rate-limited 60/60s at the edge.
- Admin `getAdminRouteRateLimit` (`apps/admin/src/middleware.ts:504-505`) applies cron/internal rate limits before the pass-through.

## Assessment

The finding accurately describes a real **architectural property**: the middleware uses an allowlist-public model for these prefixes, so the security of any future route under them depends on the author remembering to add an in-route guard. There is no deny-by-default safety net at the boundary. That is a legitimate defense-in-depth observation and the cited line numbers are correct.

However, the finding is framed and rated as if it were an active **High-severity vulnerability** ("unauthenticated access to cron jobs, internal mutations, or webhook side-effects"). The code disproves that framing: **every** currently shipped route under all three prefixes enforces its own authentication/signature guard. There is no presently-exposed route. The risk is purely hypothetical/future ("a newly added route that forgets...").

This is also the standard, idiomatic Next.js App Router pattern — Edge middleware cannot do DB-row validation or signature verification, so secret/signature checks necessarily live in the Node-runtime route handler. The middleware explicitly cannot perform `constructEvent` or DB-backed internal checks. Calling this "fail-open" overstates it: the routes fail CLOSED individually; only the absence of a redundant boundary check is at issue.

**Verdict: uncertain.** The architectural observation is real and the evidence is correctly cited, so it is not fully "refuted." But the High severity and the "unauthenticated access" impact are not supported by the code — no route is actually exposed. Appropriate rating is **Low/Info** (hardening / future-proofing recommendation: add a deny-by-default assertion or a CI test that every new `cron|internal|webhooks` route imports its guard), not High.

## Recommendation (downgraded)

- Keep as an Info/Low architecture hardening note, not a High vulnerability.
- Optional safety net: a lightweight unit/CI test that fails if any `app/api/{cron,internal,webhooks}/**/route.ts` does not reference `guardCronRequest` / `verifyInternalAuth` / a signature-verify call — converting the implicit convention into an enforced one.

## Files reviewed
- `apps/web/src/middleware.ts` (L76-86, 140-153, 320-370, 816-836)
- `apps/admin/src/middleware.ts` (L501-519, 661-663, 679-688)
- `apps/web/src/lib/cron-guard.ts`
- `apps/web/src/lib/internal-secrets.ts`
- All `route.ts` under `apps/web/src/app/api/{cron,internal,webhooks}/`
- `apps/web/src/app/api/webhooks/{stripe,resend,appstore,playstore}/route.ts`
