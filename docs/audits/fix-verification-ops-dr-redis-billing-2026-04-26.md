# Ops DR Redis Billing Audit Fix Verification

Branch: `ops-dr-redis-billing-audit-fixes`

Source audits reviewed:

- `09-backup-restore-dr.md`
- `10-redis-rate-limit-cache.md`
- `11-billing-subscriptions-stripe-iap.md`

The source audit files are read-only and were partially stale against current main. This branch fixes only confirmed, low-risk items and defers schema-heavy, payment-policy-heavy, paid-service, or operator-only work.

## Summary

- Findings reviewed: 56
- Confirmed and fixed in this branch: 23
- Already fixed before this branch: 11
- Stale: 0
- False positives: 3
- Deferred: 19
- Schema migrations added: no
- Live restore executed: no
- Live Stripe charges triggered: no
- Apple/Google production purchase APIs called: no

## Validation Matrix

| Finding ID | Audit title | Current status | Evidence in current code | Fix decision | Files touched | Tests added | Launch relevance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F-DR-001 | `AdminUser` not backed up | CONFIRMED | `BACKUP_TABLES` and route table ops omitted `adminUser`. | Added `adminUsers` plus `adminPermissions` to encrypted/signed backup coverage; `AdminSession` remains excluded. | `backup-tables.ts`, backup/verify/import/cron/manual routes | `backup-tables.test.ts`, `backup verify` test | Critical DR |
| F-DR-002 | `FIELD_ENCRYPTION_KEY` has no escrow SOP | DEFERRED | Crypto uses one env key and runbook mentioned matching key but no custody SOP. | Added operator SOP; defer KMS/Shamir implementation to `dr-key-escrow`. | `docs/runbooks/key-escrow.md` | None | Critical operator risk |
| F-DR-003 | Restore drill not executed end-to-end | DEFERRED | `docs/runbooks/db-restore.md` says RPO/RTO are not committed until staging drill succeeds. | Expanded disposable DB drill and RPO/RTO placeholders; actual drill remains operator action. | `docs/runbooks/db-restore.md` | None | Critical operator action |
| F-DR-004 | `DataConsent` not backed up | CONFIRMED | `DataConsent` exists in Prisma schema but was absent from backup catalog. | Added `dataConsents` to encrypted/signed backup coverage. | backup catalog/routes | `backup-tables.test.ts`, `backup verify` test | High compliance |
| F-DR-005 | `AdminAuditLog` and `AdminLoginLog` not backed up | CONFIRMED | Admin forensic models exist but were absent from backup catalog. | Added `adminAuditLogs` and `adminLoginLogs` to encrypted/signed backup coverage. | backup catalog/routes | `backup-tables.test.ts`, `backup verify` test | High forensic |
| F-DR-006 | `EmailLog` not backed up | CONFIRMED | `EmailLog` exists and was absent from backup catalog. | Added `emailLogs`; backup archive is encrypted and signed. | backup catalog/routes | `backup-tables.test.ts`, `backup verify` test | Medium support evidence |
| F-DR-OAUTH | `OAuthAccount` not backed up | CONFIRMED | `OAuthAccount` exists and was absent from backup catalog. | Added `oauthAccounts` to prevent avoidable re-link friction after restore. | backup catalog/routes | `backup-tables.test.ts`, `backup verify` test | Medium restore UX |
| F-DR-RUNTIME | `RuntimeConfigEntry` must remain excluded | ALREADY_FIXED | Runtime config model is absent from backup catalog. | Kept excluded; added explicit coverage test so secrets do not enter backup tables. | `backup-tables.test.ts` | `backup-tables.test.ts` | Critical secret safety |
| F-DR-007 | No alert on backup failure or staleness | CONFIRMED | Cron backup catch only recorded FAILED and logged to console. | Dispatches CRITICAL alerts on backup job failure and stale latest success with existing deduped alert dispatcher. | cron backup route | cron backup route test | High ops |
| F-DR-008 | Manual and cron backup take inconsistency | CONFIRMED | Manual route used `take: 50000`; cron route used unbounded `findMany()`. | Standardized cron to explicit same cap; cursor pagination deferred to `dr-backup-pagination`. | cron backup route | cron backup route test | High scale safety |
| F-DR-009 | R2 lifecycle/versioning/object lock not enforced in code | DEFERRED | Storage abstraction signs S3-compatible requests but cannot verify provider lifecycle/object-lock config. | Documented required lifecycle/versioning/object-lock checks; no Cloudflare account mutation from app code. | `docs/runbooks/db-restore.md` | None | Medium operator risk |
| F-DR-010 | Bucket credentials scope not validated in code | DEFERRED | Storage summary validates config presence only; cross-bucket scope cannot be proven safely without provider account privileges. | Documented manual scope verification; avoided destructive cross-bucket checks. | `docs/runbooks/db-restore.md` | None | Medium operator risk |
| F-DR-011 | No orphan-object scanner | DEFERRED | No periodic R2 listing vs `BackupRecord` inventory job exists. | Added monthly checklist; defer scanner to `dr-orphan-object-scanner`. | `docs/runbooks/db-restore.md` | None | Medium ops |
| F-DR-012 | Encrypted fields doubly encrypted | ALREADY_FIXED | Backup archive encryption wraps already-encrypted field values; this is expected defense in depth. | No change. | None | None | Low |
| F-DR-013 | Signed URL expiry not set | DEFERRED | Download uses signed request at request time; no emailed signed URLs exist. | Documented that external signed URLs need expiry policy; no code change now. | `docs/runbooks/db-restore.md` | None | Low |
| F-DR-SIZE | Backup archive size/cost guard absent | CONFIRMED | Backup routes calculate file size but did not warn/fail on large archive size. | Added warning at 500 MB and fail guard above 1 GB. | `backup-policy.ts`, manual/cron backup routes | `backup-policy.test.ts` | Low cost safety |
| F-DR-RESTORE | Restore safety controls | ALREADY_FIXED | Import requires `SUPER_ADMIN`, password confirmation for write modes, HMAC signature for MERGE/REPLACE, and supports DRY_RUN. | Keep controls; document in matrix. | None | Existing import tests | Critical safety |
| F-RL-001 | Password reset confirm no rate limit | ALREADY_FIXED | `password/reset/confirm` calls `rateLimit(...auth:pwreset:confirm...)` before token lookup. | No route behavior change. | None | Existing route test | Critical auth |
| F-RL-002 | Verify-email no rate limit | ALREADY_FIXED | `verify-email` already called `rateLimit(...auth:verify-email...)` before token lookup. | Added a small per-user overlay once a valid token is known. | verify-email route | Existing verify-email route test | Critical auth |
| F-RL-003 | MFA setup no rate limit | CONFIRMED | Setup had per-IP rate limit but no authenticated per-user overlay. | Added per-user overlay. | MFA setup route | MFA setup route test | Critical auth |
| F-RL-004 | MFA confirm no rate limit | ALREADY_FIXED | Confirm uses per-IP plus per-user limits. | No change. | None | Existing code coverage | Critical auth |
| F-RL-005 | MFA disable no rate limit | CONFIRMED | Disable had per-IP rate limit but no authenticated per-user overlay. | Added per-user overlay. | MFA disable route | MFA disable route test | Critical auth |
| F-RL-006 | OAuth callbacks no rate limit | ALREADY_FIXED | Google and Apple callback routes already limit `auth:oauth:*:callback` at 30/min. | Added fail-closed sensitivity via shared helper. | OAuth callback routes, `rate-limit.ts` | `rate-limit.test.ts` | High auth |
| F-RL-007 | Sensitive endpoints fail open if Upstash drops | CONFIRMED | Shared rate limiter fell back to in-memory in production for all callers. | Added opt-in fail-closed mode and applied it to sensitive auth/payment endpoints. | `rate-limit.ts`, auth/payment routes | `rate-limit.test.ts` | High abuse |
| F-RL-008 | Admin login raw Upstash and fire-and-forget expire | CONFIRMED | Admin login used raw REST calls and did not handle `expire` failure after `incr`. | Hardened REST response checks and delete/fallback if TTL setup fails; SDK refactor deferred. | admin login route | Focused typecheck | High admin auth |
| F-RL-009 | Login IP extraction duplication | ALREADY_FIXED | Web login uses `resolveClientIP` from shared rate-limit helper. | No change. | None | Existing route behavior | Medium auth |
| F-RL-010 | Web Redis env vs admin runtime config | DEFERRED | Web rate-limit reads process env at module load; admin runtime config differs. | Hot-reload config is ops/product scope; document current behavior. | Matrix only | None | Medium ops |
| F-RL-011 | Degraded mode logs once and stays silent | CONFIRMED | `redisFailureWarned` suppressed repeated warnings indefinitely. | Added 5 minute re-warning window without log spam. | `rate-limit.ts` | `rate-limit.test.ts` | Medium ops |
| F-RL-012 | Per-user rate-limit overlay missing | CONFIRMED | High-risk authenticated mutations were primarily IP-keyed. | Added low-cost per-user overlays for ticket, service, custom-provider, moving, and IAP create/verify paths. | tickets/services/custom-providers/moving/IAP routes | Focused route tests where added | Medium abuse |
| F-RL-013 | Per-email reset/verify cap missing | ALREADY_FIXED | Password reset request checks recent token by user within 5 minutes; there is no verify resend endpoint. | Keep reset cap; verify-token submit remains IP/user-token limited. | None | Existing reset tests | Medium inbox abuse |
| F-RL-014 | Inconsistent key naming | DEFERRED | Existing key prefixes differ between user/admin lockouts. | Broader key taxonomy could break operational lockout continuity; defer to `rate-limit-key-taxonomy`. | Matrix only | None | Medium maintainability |
| F-RL-015 | Per-user vs per-IP not documented | DEFERRED | No consolidated rate-limit policy doc exists. | Include operator notes in this matrix; fuller docs deferred to `rate-limit-user-overlays`. | Matrix only | None | Low |
| F-RL-016 | Upstash analytics cost | DEFERRED | Shared Upstash ratelimit uses `analytics: true`. | Do not alter analytics cost profile without usage data; document budget cap. | Matrix only | None | Low cost |
| F-RL-017 | In-memory Map cleanup interval | ALREADY_FIXED | Fallback store has TTL cleanup every 5 minutes. | No change. | None | None | Low |
| F-RL-018 | Forwarded-header trust assumption undocumented | DEFERRED | `resolveClientIP` trusts platform headers in documented order but deployment proxy trust is not separately documented. | Document deploy assumption; no route change. | Matrix only | None | Low |
| F-BILL-001 | Stripe live-mode not validated | CONFIRMED | Stripe routes checked presence only, not `sk_live_` in production billing env. | Added safe billing config guard and health reporting; Stripe mutations refuse wrong key mode. | `billing-config.ts`, Stripe routes, health route | billing config and checkout route tests | Critical billing |
| F-BILL-002 | Stripe customer creation lacks idempotency key | CONFIRMED | Checkout created customer without idempotency options. | Added deterministic hash-based idempotency key and retained existing customer check. | checkout route, billing config helper | checkout route test | High billing |
| F-BILL-003 | Yearly checkout silently downgrades to monthly | CONFIRMED | `getStripePriceIdForPlan` fell back to monthly if yearly price was missing. | Yearly requests now return a clean config error when yearly price is missing. | `billing.ts`, checkout route | billing and checkout route tests | High billing |
| F-BILL-004 | `PAST_DUE` immediately inactive | DEFERRED | Schema lacks a generic payment failure timestamp; `gracePeriodEndsAt` exists mostly for store flows. | Defer generalized Stripe grace policy to `billing-grace-period`; do not grant indefinite access. | Matrix only | None | High product policy |
| F-BILL-005 | Trial expiry can be null | CONFIRMED | Entitlement/plan helpers treated null `trialEndsAt` as non-expired. | Existing null trial rows are treated inactive; health reports null trial rows. | `billing.ts`, `plan-limits.ts`, health route | billing helper test | High billing |
| F-BILL-006 | Apple environment defaults to Production silently | CONFIRMED | `getDefaultEnvironment` returned Production when env was missing. | Production billing env now fails closed when `APPLE_APP_STORE_ENVIRONMENT` is unset; health reports misconfig when iOS IAP is enabled. | `billing-config.ts`, `iap-apple.ts`, health route | billing config test | High IAP |
| F-BILL-007 | No admin refund/cancel/grant-premium UI | DEFERRED | Admin billing pages are read-only. | Product/ops scope; defer to `billing-admin-actions` with audit/password-confirm policies. | Matrix only | None | High ops |
| F-BILL-008 | Refund and `invoice.upcoming` events not handled | DEFERRED | Stripe webhook has payment/subscription branches but no refund/upcoming reminder policy. | Defer to `billing-webhook-expansion`; no new email volume here. | Matrix only | None | Medium billing |
| F-BILL-009 | Trial-end reminder email missing | DEFERRED | Existing cron checks trials/admin visibility; no automated reminder email policy. | Defer to `billing-email-notifications` with preferences. | Matrix only | None | Medium lifecycle |
| F-BILL-010 | Move-task generation gate needs API audit | CONFIRMED | API route checked entitlement, but shared generation pipeline could be reached through service/address/moving sync paths. | Added server-side guard inside generation pipeline. | move-task generation and route | move-task generation test | Medium entitlement |
| F-BILL-011 | Apple bearer token not cached | CONFIRMED | Apple API client minted a new JWT per lookup. | Added in-memory 18 minute cache keyed by Apple API credentials. | `iap-apple.ts` | Focused typecheck | Medium cost/latency |
| F-BILL-012 | Google Play test purchases not rejected in production | CONFIRMED | `normalizeGoogleResult` labeled `testPurchase` as Sandbox but did not reject in production. | Reject Google test purchases in production billing env and handle them safely in verify/webhook flows. | `iap-common.ts`, mobile verify route, Play webhook route | IAP common test | Medium fraud |
| F-BILL-013 | Last-invoice metadata not stored | DEFERRED | Subscription schema has no `lastInvoiceId` or `lastInvoicePaidAt`. | Defer schema work to `billing-subscription-metadata`. | Matrix only | None | Medium ops |
| F-BILL-014 | Data export gate not verified | ALREADY_FIXED | Export route uses only `requireDbUserId` and no subscription gate. | Added explicit regression test that export does not query subscription state. | export route test | export route test | Medium privacy/legal |
| F-BILL-015 | Google Play acknowledgment failures swallowed | DEFERRED | Ack failure is logged but no retry model exists. | Defer retry queue to `iap-ack-retry-queue`; do not half-implement. | Matrix only | None | Medium IAP |
| F-BILL-016 | Trial duration fixed at 14 days | FALSE_POSITIVE | Fixed trial duration is a current product policy, not a security/launch defect. | No change. | None | None | Low |
| F-BILL-017 | Plan resolution fallback in webhook | DEFERRED | Webhook may transiently store unknown plan if price mapping absent. | Defer with metadata columns/config audit to `billing-subscription-metadata`. | Matrix only | None | Low |
| F-BILL-018 | Subscription retained after cancel | FALSE_POSITIVE | Financial/support audit retention is intentional. | No change. | None | None | Low |
| F-BILL-019 | Custom provider read-only after expiry | FALSE_POSITIVE | Existing plan limits block creation but preserve access/export; this is desired. | No change. | None | None | Low |
| F-BILL-020 | Yearly savings check not enforced | DEFERRED | UI/marketing concern; no security or billing integrity impact. | Defer to pricing/product review; no price changes in this branch. | Matrix only | None | Low |
| F-BILL-HEALTH | Billing config health gaps | CONFIRMED | Health checked Stripe presence only and had no Apple/Google billing config checks. | Added safe local config validation without printing secrets. | health route, billing config helper | billing config test | High ops |

## Fixed Findings

- F-DR-001/F-DR-004/F-DR-005/F-DR-006/F-DR-OAUTH: backup coverage now includes admin users/permissions, admin audit/login logs, legal consent, email logs, and OAuth accounts.
- F-DR-007/F-DR-008/F-DR-SIZE: cron backups now alert on failure/staleness, use explicit fetch caps, and enforce backup archive size guardrails.
- F-RL-003/F-RL-005/F-RL-007/F-RL-008/F-RL-011/F-RL-012: MFA setup/disable user overlays, sensitive fail-closed rate limiting, admin login TTL hardening, periodic Redis degraded warnings, and user overlays for high-risk mutations.
- F-BILL-001/F-BILL-002/F-BILL-003/F-BILL-005/F-BILL-006/F-BILL-010/F-BILL-011/F-BILL-012/F-BILL-HEALTH: Stripe live/test guard, Stripe customer idempotency, yearly price hard-fail, null-trial inactivity, Apple env fail-closed, move-task generation entitlement guard, Apple token cache, Google test purchase rejection, and billing health checks.

## Deferred Findings

- `dr-key-escrow`: KMS/Shamir implementation beyond the documented custody SOP.
- `dr-restore-drill-and-alerts`: real disposable DB restore drill execution and measured RPO/RTO.
- `dr-backup-pagination`: cursor/page backup export for tables that exceed the current explicit 50,000 row cap.
- `dr-orphan-object-scanner`: automated R2 inventory scanner.
- `rate-limit-user-overlays`: full policy docs and broader key taxonomy/hot-reload runtime config decisions.
- `billing-admin-actions`: audited refund/cancel/grant-premium workflows with password confirmation.
- `billing-grace-period`: schema-backed Stripe payment failure timestamp and grace policy.
- `billing-webhook-expansion`: refund and invoice-upcoming handling with email preference policy.
- `billing-email-notifications`: trial-end reminder email policy and delivery controls.
- `billing-subscription-metadata`: last invoice metadata and richer plan-resolution audit fields.
- `iap-ack-retry-queue`: durable Google Play acknowledgment retry queue.
- `mobile-iap-sandbox-readiness`: operator-run Apple/Google sandbox purchase checklist.

## Tests Added

- Backup table catalog and archive size policy tests.
- Backup verify route coverage for admin/consent/email/OAuth tables.
- Cron backup failure alert test.
- Rate-limit fail-closed helper tests.
- MFA setup/confirm/disable rate-limit tests.
- Stripe checkout config, yearly price, and idempotency tests.
- Billing helper tests for yearly fallback and null trials.
- IAP Google production test-purchase rejection test.
- Move-task generation entitlement guard test.
- Export route subscription-gate regression test.

## Remaining Risks

- App-level backup is still not a replacement for managed database PITR.
- Cursor-based backup pagination is deferred; current manual and cron backup paths share an explicit 50,000 row per-table cap.
- R2 lifecycle/versioning/object-lock and bucket credential scope require operator verification in Cloudflare.
- Stripe PAST_DUE grace needs schema-backed failure timing before implementation.
- Admin billing actions and expanded billing webhooks remain product/ops work, not security hotfixes.

## Operator Actions Needed

- Run a real disposable DB restore drill and record observed RPO/RTO.
- Verify R2 lifecycle, versioning, and object-lock/retention settings in Cloudflare.
- Run Stripe test-mode checkout/webhook scenarios in a non-production billing environment.
- Run Apple Sandbox purchase/cancel/refund scenarios.
- Run Google Play test-track purchase/expiry/acknowledgment scenarios.
