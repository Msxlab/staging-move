# Test Automation Strategy — LocateFlow

Captures the production synthetic-monitoring strategy, what's already in place, the
gaps still open, and the safety rules any future automation must follow.

## TL;DR

- **Production** runs lightweight synthetic smoke checks on a schedule. Read-only.
  No real user data is created or modified.
- **Staging / preview** is the place for full regression, payment flows, and
  randomised scenarios.
- All test-created data must be tagged with `createdByTestAutomation`,
  `testRunId`, and a namespace before any cleanup logic is allowed to run.
- Cleanup is opt-in (`TEST_DATA_CLEANUP_ENABLED=true`) and namespace-scoped —
  never deletes by email match alone.
- No live Stripe keys, ever, in automation. Sandbox/test keys only, with
  idempotency keys, and no real subscription/charge creation.

## What exists today

| Capability | Status | Notes |
|---|---|---|
| HTTP smoke test (`scripts/smoke-test.sh`) | ✅ | Unauthenticated only — homepage, sign-in, dashboard redirect, admin login. |
| Playwright e2e (`apps/web/tests/e2e/`) | ✅ | Public pages + a11y. Configurable via `PLAYWRIGHT_BASE_URL` so it can run against any environment. |
| Cron auth pattern (`verifyInternalAuth` + `CRON_SECRET`) | ✅ | Constant-time check, header-based, used by all `/api/cron/*` routes. |
| Health endpoint (`/api/health`) | ✅ | Returns DB + config diagnostics. |
| Soft-delete on `User` (`deletedAt`) | ✅ | Could be reused for test-user lifecycle. |
| Synthetic-monitor cron (`/api/cron/synthetic-monitor`) | ✅ (added with this doc) | Read-only. Hits critical public surfaces, returns JSON report. |
| Test-user DB tagging (`createdByTestAutomation`, `testRunId`, namespace) | ❌ | Requires Prisma migration — deferred. |
| Sign-up-based authenticated production tests | ❌ | Requires the tagging fields above + email/SMS suppression. Deferred. |
| Stripe sandbox isolation for tests | ❌ | All Stripe usage today shares the configured key. Needs a separate test key plus a guard that refuses `sk_live_*` in automation. Deferred. |
| Outbound email/SMS suppression for test users | ❌ | `sendEmailWithResult` has no per-recipient suppression hook. Deferred. |
| Kill-switch env vars (`TEST_AUTOMATION_ENABLED`, `TEST_DATA_CLEANUP_ENABLED`, …) | ✅ partial | `TEST_AUTOMATION_ENABLED` is honoured by the new cron route. The data/payment/email flags are placeholders until those flows land. |
| Scheduled orphan cleanup | ❌ | Will be designed once tagging fields exist. |

## Architecture (target)

```
DigitalOcean scheduler / external cron
        │   3× daily, 06:00 / 14:00 / 22:00 UTC
        ▼
POST /api/cron/synthetic-monitor       (CRON_SECRET, kill-switch gated)
        │
        ├── public-surface checks   (homepage, /sign-in, /pricing, /faq, robots, sitemap)
        ├── auth gate checks         (unauth /dashboard → 307, admin /api/health → 401)
        ├── health endpoint check    (200 + status field present)
        └── returns JSON report      ({ ok, checks: [...], failures, durationMs })
                │
                ▼
        Logger → log aggregator → alert on 2 consecutive failures
```

When the authenticated-flow tests are added, they will live in a separate
out-of-band runner (Playwright job invoked by an external scheduler), not in
the cron route — synthetic monitoring stays read-only and synchronous.

## Safety rules for any future test-data work

These are non-negotiable. Anything that creates or deletes data on behalf of a
test user MUST follow all of them.

1. **Tagging is mandatory.** Every test-created record must carry:
   - `createdByTestAutomation: true`
   - `testRunId: "<run-id>"`
   - `testNamespace: "<namespace>"` (e.g. `"e2e-sandbox"`)
   - `testUserId: "<id of the dedicated automation user>"`
2. **Cleanup is namespace-scoped.** Never delete by email match. The query must
   filter on `userId` AND `createdByTestAutomation` AND `namespace` AND a
   `testRunId` that is either current or expired.
3. **Kill switches are honoured.** `TEST_AUTOMATION_ENABLED=false` disables the
   monitor cron immediately, no redeploy needed. `TEST_DATA_CLEANUP_ENABLED`,
   `TEST_PAYMENTS_ENABLED`, and `TEST_EMAIL_NOTIFICATIONS_ENABLED` gate their
   respective flows independently.
4. **Stripe stays in sandbox.** Test code must reject any key starting with
   `sk_live_`. All payment-related calls use idempotency keys. Webhook handlers
   must already be tolerant of out-of-order and repeated events.
5. **Test users have no privileges.** Normal consumer role only. B2B/partner
   testing uses an isolated tenant.
6. **Outbound comms suppressed.** When the recipient is a tagged test user, the
   email/SMS layer either no-ops or routes to a controlled test inbox.
7. **Failure alerts are quiet.** Alert only on 2 consecutive failures, cleanup
   failure, or detection of test data touching real-user records.

## Operating the synthetic-monitor cron

### Schedule

External scheduler (DigitalOcean App Platform scheduled job, GitHub Actions
schedule, Ofelia in `docker-compose.prod.yml`, or whatever lives at the
deployment edge) calls:

```
POST https://<env>/api/cron/synthetic-monitor
Authorization: Bearer ${CRON_SECRET}
```

Recommended cron expression: `0 6,14,22 * * *` (UTC).

### Disabling without redeploy

Set `TEST_AUTOMATION_ENABLED=false` in the environment. The endpoint will
respond `200 { ok: true, skipped: "TEST_AUTOMATION_ENABLED=false" }` and do no
work. Use this if synthetic monitoring is producing noise during an incident
or planned maintenance window.

### Reading the response

Successful run:

```json
{
  "ok": true,
  "testRunId": "synthetic-2026-05-06T14:00:00Z",
  "durationMs": 842,
  "checks": [
    { "name": "homepage", "ok": true, "status": 200, "ms": 134 },
    { "name": "health", "ok": true, "status": 200, "ms": 38 },
    ...
  ],
  "failures": []
}
```

Failed run returns HTTP 503 with the same shape and a populated `failures`
array. The endpoint never throws — it always returns a structured report so
upstream alerting can key off the response body or status code consistently.

## Deferred work (open gaps)

In rough priority order:

1. **Prisma schema migration** adding `createdByTestAutomation`, `testRunId`,
   `testNamespace` columns to `User`, `MovingPlan`, `MoveTask`, `Address`,
   `Service`, `Subscription`, and any other table the test user can write to.
2. **Test-user provisioning** — a one-shot script that creates a single
   normal-role automation user, marks it, and stores its credentials in the
   environment. Idempotent.
3. **Authenticated production smoke runner** — separate Playwright project
   `production-auth-smoke` that logs in as the test user, exercises a small
   golden-path flow, and uses the tagging contract above.
4. **Stripe sandbox isolation** — separate `STRIPE_TEST_SECRET_KEY`,
   `STRIPE_TEST_PRICE_*` env vars, plus a guard in the test runner that refuses
   to start if it sees a live key.
5. **Email/SMS suppression hook** — central guard in `sendEmailWithResult` that
   short-circuits or rewrites when the recipient matches the automation user.
6. **Orphan cleanup cron** — a second cron route that finds tagged test data
   older than 24h and deletes it, namespace-scoped, with a dry-run report mode.
7. **Data-leakage detector** — post-cleanup verification that no tagged record
   appears under a non-test user, and that the test user has no admin grants.

Each of these touches shared infrastructure (DB schema, billing, comms) and
should land as a separate, reviewed PR — not bundled into the monitoring layer.

## References

- `apps/web/src/app/api/cron/synthetic-monitor/route.ts` — the monitor itself.
- `apps/web/src/lib/internal-secrets.ts` — `verifyInternalAuth` shared helper.
- `apps/web/src/app/api/health/route.ts` — the health surface the monitor relies on.
- `scripts/smoke-test.sh` — HTTP-level smoke checks for post-deploy use.
- `apps/web/playwright.config.ts` — Playwright base config; honours `PLAYWRIGHT_BASE_URL`.
