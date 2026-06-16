# Risk Register

Updated: 2026-06-15

## Verified Risks

| ID | Severity | Area | Status | Evidence | Summary | Recommended Action |
| --- | --- | --- | --- | --- | --- | --- |
| RISK-001 | High | Deployment/database | Open | `package.json:8`, `package.json:38`, `Dockerfile:128`, `.github/workflows/ci.yml:118-141`, `docker-compose.prod.yml:54-84` | Production runtime startup can run `prisma migrate deploy`, despite separate CI/compose migration jobs. | Split migrations from runtime server startup. Runtime should only start the app after migrations have been run by a dedicated deploy step. |
| RISK-002 | Medium | Rate limits/admin step-up/locks | Open | `apps/web/src/lib/rate-limit.ts:236-286`, `apps/web/src/lib/rate-limit.ts:407-415`, `apps/admin/src/middleware.ts:391-422`, `apps/admin/src/lib/auth-step-up-store.ts`, `apps/admin/src/lib/distributed-lock.ts` | Without Upstash, important controls degrade to process-local memory in production-like environments. | Make Upstash a production readiness gate; consider fail-closed/read-only behavior for sensitive admin controls when distributed state is missing. |
| RISK-003 | Low | Admin backup | Open | `apps/admin/src/app/api/backup/sql-dump/route.ts:420`, `apps/admin/src/app/api/backup/sql-dump/route.ts:426` | SQL dump `Content-Disposition` filename interpolates DB name from config without filename encoding. | Sanitize filename component and include encoded `filename*`. |
| RISK-004 | Low | Cron/reliability | Open | `apps/web/src/app/api/partner-consents/[id]/refresh/route.ts:8-14`, `apps/web/src/middleware.ts:74-76` | Legacy partner-consent refresh route has a cron guard but is likely blocked by session middleware before reaching it. | Remove route, document as session-only, or add explicit public middleware exception if needed. |
| RISK-005 | Low | Mobile OAuth schema | Open | `packages/db/prisma/migrations/20260512100000_mobile_oauth_pkce_challenge/migration.sql:19`, `apps/web/src/lib/mobile-oauth.ts:128-129`, `apps/web/src/lib/mobile-oauth.ts:200-207` | Runtime enforces PKCE, but DB column remains nullable. | Backfill/purge old rows and migrate `codeChallenge` to `NOT NULL` after legacy-client window closes. |

## Positive Control Notes

- User/admin auth routes re-check DB session state rather than trusting middleware JWT alone.
- Admin irreversible deletion has strong step-up, OTP, audit, and Stripe reconciliation controls.
- Stripe and store purchase flows verify server-side before granting entitlement.
- Public uploads and remote fetches use size/type/host controls.
- Connector framework enforces HTTPS allowlists, redirect revalidation, circuit breakers, retries, idempotency, and fallback.

## Unverified Risks

| Area | Reason |
| --- | --- |
| Live production env readiness | `.env`/deployed env values were intentionally not read. |
| Real provider integrations | No live USPS/Stripe/App Store/Google Play/Resend/R2 calls were made. |
| Full route authorization coverage | 279 route handlers were inventoried, but not all were reviewed line-by-line. |
| Runtime performance/load | No tests or benchmarks were run. |
