# Adversarial Verification — repo-overview-01

**Finding under review:** "Multiple cron schedulers (vercel.json, GitHub Actions, ofelia) target the same `/api/cron/*` surface without a shared interlock"
**Claimed severity:** High — Reliability
**Verdict:** REFUTED (downgrade to Low/Info)

## What the claim asserts
That because `apps/web/vercel.json`, `.github/workflows/cron.yml`, and `docker/ofelia.ini` all enumerate `/api/cron/*` jobs without a *mutual* gate (only the GitHub workflow self-gates via `CRON_SCHEDULER_OWNER` / `CRON_SCHEDULER_DISABLED`), two live schedulers could double-fire jobs and cause **duplicate emails/pushes, double billing-state transitions, or redundant purges**.

## What the code actually shows

### 1. The three schedulers are partitioned by deployment target, not co-located on one production domain
- `.github/workflows/cron.yml:3-31` documents the ownership model in code: production runs on **DigitalOcean App Platform**, which is driven by the **GitHub Actions** workflow. `docker-compose.prod.yml` + `docker/ofelia.ini` are explicitly "for a self-hosted Docker host only."
- `docker/ofelia.ini:11-13` carries the matching contract: "use Ofelia only for self-hosted Docker. If GitHub Actions cron also targets the same production domain, set `CRON_SCHEDULER_DISABLED=true` or stop this service; never run both schedulers."
- `apps/web/vercel.json` targets a **staging** Vercel deployment, not production: `docs/deploy/vercel-staging-and-mobile-preview-runbook.md:59,70,109` show the Vercel app is `locateflow-web-staging.vercel.app`. Production web is `https://locateflow.com` (`cron.yml:73`). There is no evidence in source that vercel.json drives the production domain; it is the staging/preview path.
- So the premise "more than one scheduler is live against a **production** domain" is not established by code; the inventory of three files is by design one-per-environment.

### 2. Even if two schedulers double-fired, the claimed side-effects are structurally prevented by DB-level idempotency
This is the decisive point: the cron routes are written to be idempotent, so a duplicate invocation is a no-op rather than a duplicate action.

- **Duplicate emails / pushes / in-app notifications — prevented by a DB unique constraint.**
  - `createInAppNotification` (`apps/web/src/lib/in-app-notifications.ts:27-58`) relies on `@@unique([userId, channel, dedupeKey])`; a racing duplicate hits a P2002 unique-violation and is swallowed as "already delivered" (`return false`).
  - The constraint is real in the schema: `packages/db/prisma/schema.prisma:1505` (`@@unique([userId, channel, dedupeKey])`), with `dedupeKey` column at line 1498.
  - Every reminder/email call passes a stable per-day `dedupeKey`, e.g. `apps/web/src/app/api/cron/bill-reminders/route.ts:117` (`cron:bill-reminder:${svc.id}:${dueDate}:${daysUntilDue}`) and `apps/web/src/app/api/cron/trial-check/route.ts:50` (`cron:trial-expiring:${sub.id}:${date}:${days}`). The schema also has email-idempotency uniques (`schema.prisma:1008` `@@unique([userId, idempotencyKey])`, `:1569` `dedupeKey String? @unique`).

- **Double billing-state transitions — prevented by status-guarded `updateMany`.**
  - `trial-check` transitions are filtered on the *source* status, e.g. `apps/web/src/app/api/cron/trial-check/route.ts:178-211` matches `status: "TRIALING"` then sets `status: "EXPIRED"`. A second run matches zero rows (already EXPIRED), so the transition cannot fire twice. The same pattern applies to FREE_ACCESS (`:213-231`) and manual-premium (`:236-251`).
  - In-app notices in this route use an explicit `findFirst({ metadata: { contains: dedupe } })` existence check before `create` (`:76-97`, `:142-163`).

- **Redundant purges — naturally idempotent.**
  - `workspace-purge` (`apps/web/src/app/api/cron/workspace-purge/route.ts:28-36`) selects `deletedAt != null AND deletionGraceUntil < now` and `deleteMany`s them. A second run finds nothing already deleted, returning `{ purged: 0 }`. No double-delete is possible.

### 3. There IS a shared interlock at the route layer that the claim overlooks
- Every web cron route calls `guardCronRequest` (`apps/web/src/lib/cron-guard.ts`), which adds a **per-route + per-caller rate limit** (default 10/min, `:88-95`) on top of `CRON_SECRET` auth. This is a real cross-scheduler throttle on the `/api/cron/*` surface — not a full mutual-exclusion lock, but it bounds runaway double-firing.

## Why the severity is wrong
The finding is framed as a High reliability risk because of *consequences* (duplicate emails, double billing transitions, redundant purges). Each of those consequences is independently defused by DB-level dedupe/idempotency that the routes already implement and the schema already enforces. The residual risk of "two schedulers both configured" is an operational/config concern (wasted invocations, extra rate-limited 429s, duplicated read load) — not data corruption or user-visible duplication.

The one accurate observation in the finding — that `vercel.json` and `ofelia.ini` carry no *automated* mutual gate the way the GitHub workflow does — is true but low-impact, because (a) they target different environments and (b) the jobs are idempotent. At most this is a Low/Info documentation/ops hardening note (e.g. add a comment header to `vercel.json`, or have routes consult `CRON_SCHEDULER_OWNER`, which the app already plumbs in `docker-compose.prod.yml:130,221`).

## Conclusion
**REFUTED.** The code does not support a High reliability finding: the three scheduler configs are environment-partitioned by design, and the high-impact outcomes claimed (duplicate notifications, double billing-state transitions, redundant purges) are prevented by DB unique constraints + status-guarded updates + idempotent delete filters. Adjusted severity: **Low** (ops/config hygiene only).

## Files examined
- `apps/web/vercel.json`
- `.github/workflows/cron.yml`
- `docker/ofelia.ini`
- `docker-compose.prod.yml`, `docker-compose.digitalocean.yml`
- `apps/web/src/app/api/cron/bill-reminders/route.ts`
- `apps/web/src/app/api/cron/trial-check/route.ts`
- `apps/web/src/app/api/cron/workspace-purge/route.ts`
- `apps/web/src/lib/in-app-notifications.ts`
- `apps/web/src/lib/cron-guard.ts`
- `packages/db/prisma/schema.prisma` (Notification @@unique line 1505; idempotency uniques 1008/1569)
- `docs/deploy/vercel-staging-and-mobile-preview-runbook.md` (vercel.json targets staging, not prod) [orientation only]
