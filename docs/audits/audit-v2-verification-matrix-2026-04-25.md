# LocateFlow Audit V2 Verification Matrix - 2026-04-25

Source report: `KAPSAMLI_DERIN_DENETIM_RAPORU.md` (untracked local input).

Baseline:
- Branch created from latest `move-main/main`.
- Baseline commit checked: `e276e8101288acb4cc9d23d8b2ec508ecab8dffc`.
- Working branch: `pr/audit-v2-p0-hardening`.
- Report branch label is `pr/current-product-readiness-epic`, so line numbers were treated as hints only. The referenced files and most logic paths still exist in current `main`; each item below was re-checked against current files.

Classification key:
- CONFIRMED: finding exists in current code.
- ALREADY_FIXED: current main already has the intended mitigation.
- STALE: report points at old code or a no-longer-valid line/path.
- FALSE_POSITIVE: current code does not support the claimed risk.
- NEEDS_PRODUCT_DECISION: confirmed risk, but the fix changes product/client/ops/legal behavior.
- NEEDS_SCHEMA_MIGRATION: confirmed risk requiring Prisma/database migration review.
- NEEDS_EXTERNAL_CREDENTIAL: confirmed gap depends on provider credentials/infrastructure.
- DEFERRED: valid but intentionally left out of this P0 hardening branch.

## P0 Verification

| # | Audit item title | Claimed files/lines | Actual current files/lines checked | Classification | Verification evidence | Fix decision | Risk if unfixed | Tests needed | Fixed in this branch |
|---|---|---|---|---|---|---|---|---|---|
| P0-1 | Web middleware CSP missing / web CSP unsafe-inline | `apps/web/src/middleware.ts`, `apps/web/next.config.js:48-50` | `apps/web/next.config.js:47-62`, `apps/web/src/middleware.ts:276-292` | CONFIRMED | Current main already sets CSP/security headers from `next.config.js`, so "no CSP" is stale. Production `script-src 'unsafe-inline'` remains real. | Added safe CSP hardening directives (`object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`). Full nonce CSP is deferred because Next App Router inline bootstrap/hydration can break without a staged Report-Only rollout. | XSS impact is higher while inline scripts remain allowed. | Web build, smoke browser QA, later CSP Report-Only telemetry before nonce enforcement. | PARTIAL |
| P0-2 | MFA backup-code consumption non-atomic | `apps/web/src/app/api/auth/login/route.ts:153-167`, admin variant `294-309` | `apps/web/src/app/api/auth/login/route.ts:157-165`, `apps/admin/src/app/api/auth/login/route.ts:296-305` | CONFIRMED | Both flows read JSON, verify bcrypt hash, splice, then wrote the new JSON. Two concurrent requests could consume the same original array. | Switched both flows to compare-and-swap with `updateMany` where `mfaBackupCodes` still equals the original JSON; login succeeds only when exactly one row is updated. | Backup code replay under concurrency. | Web/admin typecheck and auth login regression tests. | YES |
| P0-3 | `requireDbUserId` missing `deletedAt: null` | `apps/web/src/lib/user-auth.ts:326-331` | `apps/web/src/lib/user-auth.ts:322-327` | CONFIRMED | User lookup only selected by `id`; `User.deletedAt` exists at `packages/db/prisma/schema.prisma:63-69`. | Changed lookup to `findFirst({ id, deletedAt: null })`; soft-deleted users lose session access and their session cookie is destroyed by existing path. | Soft-deleted users could continue using a still-valid session. | Web typecheck; API auth regression. | YES |
| P0-4 | Mobile IAP `/verify` accepts unsigned `transactionId` | `apps/web/src/app/api/mobile/iap/verify/route.ts:80-100` | `apps/web/src/app/api/mobile/iap/verify/route.ts:36-50`, `82-102`; mobile sends optional signed JWS at `apps/mobile/src/lib/iap.ts:129-135`, `231-236` | NEEDS_PRODUCT_DECISION | Confirmed: iOS schema accepts either `transactionId` or `signedTransaction`, and falls back to `transactionId`. Mobile currently sends `signedTransaction` when available but still sends transaction-id fallback. | Deferred. Requiring `signedTransaction` is the right fix, but it changes mobile client contract and may block existing clients/restore flows. Mark as launch blocker for IAP before enabling mobile subscriptions. | A user could attempt to claim another Apple original transaction id if store API lookup succeeds. | IAP route tests with signed JWS mocks, mobile contract test, staged mobile release. | NO |
| P0-5 | MovingPlan from/to address FK delete behavior may block GDPR deletion | `packages/db/prisma/schema.prisma:384-388` | `packages/db/prisma/schema.prisma:379-388`, account deletion cleanup not covering MovingPlan/AuditLog/EmailLog/NotificationQueue | NEEDS_SCHEMA_MIGRATION | Confirmed: `fromAddress` and `toAddress` relations have no `onDelete`, while `User -> MovingPlan` cascades. Address hard-delete can be restricted by these FKs. | Deferred for migration review. Needs DB migration, deletion-order review, and restore implications. | Account/address deletion can fail or leave GDPR erasure incomplete. | Migration rehearsal against staging snapshot, account deletion integration test. | NO |
| P0-6 | Provider recommendations typo: `CANCELLED` vs `CANCELED` | `apps/web/src/app/api/providers/recommendations/route.ts:37` | `apps/web/src/app/api/providers/recommendations/route.ts:37`; status strings in schema are plain strings at `packages/db/prisma/schema.prisma:393-394` | CONFIRMED | Current code used `status: { not: "CANCELLED" }`, while app convention uses US spelling `CANCELED`. | Changed to `"CANCELED"`. | Canceled moving plans could influence recommendations. | Web typecheck and provider recommendation route test. | YES |
| P0-7 | Data-retention cron deletes LEGAL_CONSENT / ONBOARDING_COMPLETED proof | `apps/web/src/app/api/cron/data-retention/route.ts:37-41` | `apps/web/src/app/api/cron/data-retention/route.ts:6`, `38-43`; constants in `packages/shared/src/legal.ts:1-3` | CONFIRMED | Retention deleted all `UserEvent` rows older than 90 days. Legal acceptance and onboarding completion are stored as `UserEvent` values. | Excluded `LEGAL_CONSENT_EVENT` and `ONBOARDING_COMPLETED_EVENT` from UserEvent retention deletion. | Legal/compliance evidence disappears after 90 days. | Cron route test with protected event fixtures. | YES |
| P0-8 | AuditLog.userId not FK / orphan PII risk | `packages/db/prisma/schema.prisma:710-726` | `packages/db/prisma/schema.prisma:710-725` | NEEDS_SCHEMA_MIGRATION | Confirmed: `AuditLog.userId` is a string with indexes, no `user` relation/FK. | Deferred. Adding FK/cascade or anonymization requires migration and legal/audit retention policy. | User deletion can leave orphan IP/user-agent/change records. | Migration rehearsal, account deletion test, legal retention decision. | NO |
| P0-9 | BACKUP_TABLES missing critical tables | `apps/admin/src/lib/backup-tables.ts:1-19` | `apps/admin/src/lib/backup-tables.ts:1-38`; schema models at `packages/db/prisma/schema.prisma` | DEFERRED | Confirmed: catalog has 14 tables and omits many operational/auth/admin tables. | Deferred after review. Adding tables changes backup/restore semantics and must update create, verify, import order, restore runbook, and token/secret policy together. See backup review section below. | Disaster recovery may restore only part of the system. | Backup create/verify/import tests and staging restore drill. | NO |
| P0-10 | TOTP web/admin duplicate drift | `apps/web/src/lib/totp.ts`, `apps/admin/src/lib/totp.ts` | `apps/web/src/lib/totp.ts:75-149`, `apps/admin/src/lib/totp.ts:75-149` | DEFERRED | Confirmed: duplicate implementations differ in issuer default and BigInt syntax. | Deferred. Consolidating into `packages/shared` touches both auth stacks and should be a focused PR. The backup-code race was fixed in both copies' callers. | Future TOTP/security fixes can drift between web and admin. | Shared package unit tests, web/admin MFA setup and login tests. | NO |
| P0-11 | `sendSms` / `sendPush` stubs cause reminder loop/write storm | `apps/web/src/lib/notifications.ts:58-76` | `apps/web/src/lib/notifications.ts:19-31`, `58-76`, `82-114` | FALSE_POSITIVE | Current `processReminders` only sends `type: "EMAIL"` and marks reminders sent only on successful email. `sendNotification` has no other caller. SMS/PUSH stubs return false behind feature flags, but no current reminder loop uses them. | Skipped. Do not mark unsupported SMS/PUSH as sent because that creates false delivery evidence. Keep future SMS/PUSH behind explicit product/integration work. | If future code sends reminders via SMS/PUSH without channel-state handling, retries could loop. | Notification channel integration tests when SMS/PUSH are added. | NO |
| P0-12 | Smoke test expects admin `/api/health` but admin health requires auth | `scripts/smoke-test.sh:43`, `apps/admin/src/app/api/health/route.ts:14` | `scripts/smoke-test.sh:43`, `apps/admin/src/app/api/health/route.ts:13-15` | CONFIRMED | Admin health calls `requirePermission(...)`; unauthenticated smoke should not expect 200. | Changed smoke test expectation to `401` for admin health auth gate. Did not add a new public admin health endpoint. | Smoke falsely fails healthy deployments or encourages exposing sensitive admin metrics. | Shell smoke test against staging URLs. | YES |

## P1 Verification

| # | Audit item title | Claimed files/lines | Actual current files/lines checked | Classification | Verification evidence | Fix decision | Risk if unfixed | Tests needed | Fixed in this branch |
|---|---|---|---|---|---|---|---|---|---|
| P1-11 | Complete BACKUP_TABLES | `apps/admin/src/lib/backup-tables.ts` | `apps/admin/src/lib/backup-tables.ts:1-138`, schema model list | DEFERRED | Confirmed incomplete. See backup table review. | No catalog mutation in this branch; needs restore-order/runbook work. | Partial DR coverage. | Backup create/verify/import/restore tests. | NO |
| P1-12 | Migrate money fields from Float to Decimal | schema money fields | `packages/db/prisma/schema.prisma:339`, `425-428` | NEEDS_SCHEMA_MIGRATION | Confirmed: `Service.monthlyCost`, `Budget` planned/actual income/expenses use `Float`. | Deferred; data migration and UI parser review required. | Rounding errors for money values. | Migration rehearsal, budget/service tests. | NO |
| P1-13 | Subscription enum for plan/status/provider | `Subscription` model | `packages/db/prisma/schema.prisma:186-190` | NEEDS_SCHEMA_MIGRATION | Confirmed: `plan`, `status`, `provider`, `platform` are strings. | Deferred; requires enum design across Stripe/IAP/trial flows. | Invalid states can be persisted. | Billing/IAP/webhook tests. | NO |
| P1-14 | Move TOTP/ip-rules/sentry-options/i18n-config to shared package | multiple copies | TOTP duplicate confirmed; other modules not changed in this pass | DEFERRED | TOTP duplicate confirmed. Broader shared-package move is architectural. | Deferred to dedicated refactor PR. | Security fix drift. | Shared package tests plus web/admin import checks. | NO |
| P1-15 | Stripe webhook livemode env match | `apps/web/src/app/api/webhooks/stripe/route.ts` | `apps/web/src/app/api/webhooks/stripe/route.ts:20-40`, no `event.livemode` check found | NEEDS_PRODUCT_DECISION | Confirmed absent. Requires defining environment policy for staging vs production Stripe modes. | Deferred; do not risk blocking current staging OAuth/DB work. | Test-mode event could be accepted in wrong environment if webhook secret/config is mixed. | Stripe webhook route tests with live/test events. | NO |
| P1-16 | `stripe-sync-individual-prices.ts --archive-old` | `scripts/stripe-sync-individual-prices.ts` | Script exists; no archive flag found | NEEDS_PRODUCT_DECISION | Confirmed as ops behavior gap, not runtime security. | Deferred. | Old Stripe prices remain active until manually archived. | Script dry-run/apply tests with mocked Stripe. | NO |
| P1-17 | Move alert dispatcher to Redis | alert/lockout infra | Login lockout uses current rate-limit/lockout helpers; Redis availability depends on env | NEEDS_EXTERNAL_CREDENTIAL | Requires Upstash/Redis runtime config and multi-replica design. | Deferred. | Multi-instance brute-force state can drift. | Integration test with Redis mock/real staging config. | NO |
| P1-18 | Dashboard progress undeclared + budget dynamic Tailwind class | `dashboard-client.tsx` | `apps/web/src/app/(app)/dashboard/dashboard-client.tsx:297`, `408`, `668` | STALE | `progress` is currently declared at line 297. Dynamic category class remains but is a frontend polish/build-stability item. | Skipped for P0 branch. | Potential missing Tailwind class for category bar, not a deployment/security blocker. | Web UI snapshot/build. | NO |
| P1-19 | Onboarding form labels/progressbar accessibility | `apps/web/src/app/onboarding/page.tsx` | Not fully re-audited; out of P0 security scope | DEFERRED | Needs UX/a11y pass, not safe to mix into security deployment work. | Deferred. | Accessibility gaps. | Axe/playwright a11y tests. | NO |
| P1-20 | `/api/auth/security` set_password email confirmation | `apps/web/src/app/api/auth/security/route.ts` | `apps/web/src/app/api/auth/security/route.ts:194-210` | NEEDS_PRODUCT_DECISION | Confirmed flow can set password for OAuth account while session is valid; adding email confirmation changes account-security UX. | Deferred. | Session compromise can become persistent password login. | Auth security route tests and email verification UX. | NO |

## Backup Table Review

Current backup catalog includes:
`users`, `profiles`, `providers`, `providerCoverages`, `addresses`, `movingPlans`, `customProviders`, `services`, `moveTasks`, `budgets`, `subscriptions`, `notifications`, `auditLogs`, `providerGovernanceIssues`.

| Table/model | Review classification | Reason |
|---|---|---|
| OAuthAccount | MUST_BACKUP_NOW | Needed to preserve linked Google/Apple accounts after restore. |
| UserSession | SHOULD_BACKUP_LATER | Analytics/session history; active session restore may be undesirable. |
| UserLoginSession | TOKEN/SECRET_TABLE_EXCLUDE | Active auth sessions should generally not be restored as valid sessions. Consider backup for audit only with forced invalidation on import. |
| NotificationPreference | MUST_BACKUP_NOW | User settings; safe operational data. |
| EmailLog | NEEDS_RETENTION_POLICY | Useful compliance/delivery evidence but contains PII and should obey retention policy. |
| AdminUser | MUST_BACKUP_NOW | Required for admin access recovery, but includes password/MFA secrets; only under encrypted/signed/offsite backup policy. |
| AdminSession | TOKEN/SECRET_TABLE_EXCLUDE | Active admin sessions should not be restored. |
| AdminPermission | MUST_BACKUP_NOW | Required to restore admin RBAC. |
| AdminAuditLog | NEEDS_RETENTION_POLICY | Important audit evidence; PII retention/anonymization policy needed. |
| RuntimeConfigEntry | TOKEN/SECRET_TABLE_EXCLUDE | Contains encrypted secrets/config; restore semantics depend on encryption key and environment. Needs explicit secret-restore policy. |
| ProcessedWebhookEvent | SHOULD_BACKUP_LATER | Idempotency history; restoring can prevent replay, but retention window should be defined. |
| DataConsent | MUST_BACKUP_NOW | Current consent lifecycle proof. |
| PushDevice | TOKEN/SECRET_TABLE_EXCLUDE | Device tokens should not be blindly restored; can be stale/sensitive. |
| SupportTicket | MUST_BACKUP_NOW | Customer support record. |
| TicketMessage | MUST_BACKUP_NOW | Depends on SupportTicket. |
| PasswordResetToken | TOKEN/SECRET_TABLE_EXCLUDE | Active reset tokens should not be restored. |
| EmailVerificationToken | TOKEN/SECRET_TABLE_EXCLUDE | Active verification tokens should not be restored. |
| StateRule | SHOULD_BACKUP_LATER | Reference/rules data; restore order is low risk but catalog tests needed. |
| Reminder | MUST_BACKUP_NOW | User reminder state is product data. |
| NotificationQueue | SHOULD_BACKUP_LATER | Queue replay risk; import should not re-send stale jobs. |
| EmailTemplate | SHOULD_BACKUP_LATER | Operational config/content. |
| FAQ | SHOULD_BACKUP_LATER | Content/reference data. |
| HelpArticle | SHOULD_BACKUP_LATER | Content/reference data. |
| FeatureFlag | SHOULD_BACKUP_LATER | Operational config; environment-specific semantics. |
| IPRule | SHOULD_BACKUP_LATER | Security config; environment-specific semantics. |
| GDPRRequest | MUST_BACKUP_NOW | Compliance workflow record. |
| BackupRecord | DO_NOT_BACKUP | Backup metadata should not recursively restore backup archive state without a dedicated DR process. |
| WaitlistSignup | NEEDS_RETENTION_POLICY | Marketing/contact PII; retention/legal policy needed. |
| UserEvent | NEEDS_RETENTION_POLICY | Analytics and legal events share a table; legal events must be preserved, analytics can expire. |

No backup catalog changes were made in this branch because a safe change requires updating table ops, dependency order, verify/import route counters, restore safety checks, and the restore runbook together.

## Deferred Migration / Design Plans

### MovingPlan and AuditLog deletion integrity
1. Add schema relations only after checking existing orphan rows.
2. Decide whether audit logs should cascade, anonymize, or be retained under legal basis.
3. Add migration with preflight SQL for orphan detection.
4. Rehearse on staging snapshot before production.
5. Add account deletion tests covering MovingPlan, AuditLog, EmailLog, NotificationQueue.

### IAP signed iOS transaction
1. Update mobile contract to require `signedTransaction` for iOS purchase and restore.
2. Keep Android purchase-token verification unchanged.
3. Add server tests rejecting iOS transaction-id-only bodies.
4. Roll out mobile client before enforcing on deployed API, or guard enforcement by launch flag while IAP is disabled.

### Full web nonce CSP
1. Add CSP Report-Only first.
2. Inventory Next/App Router inline script requirements.
3. Introduce per-request nonce only after render/build/browser testing.
4. Remove `script-src 'unsafe-inline'` after report-only telemetry is clean.
