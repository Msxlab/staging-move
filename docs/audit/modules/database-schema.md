# Module Audit: Database Schema & Data Layer

> READ-ONLY audit. Evidence = source code only. Paths are relative to repo root
> `staging-move/`. Line numbers cited where practical.

## 1. Module Summary

The data layer is a single Prisma schema (`packages/db/prisma/schema.prisma`,
88 models, MySQL/`utf8mb4_unicode_ci`) consumed through two clients exported
from `packages/db/src/index.ts`:

- `db` (a.k.a. `prisma` in `apps/web/src/lib/db.ts`) — the default, soft-delete
  extended client. Read ops auto-filter `deletedAt: null` and `delete`/`deleteMany`
  are rewritten to stamp `deletedAt` for the 10 models in `SOFT_DELETE_MODELS`.
- `dbUnsafe` (a.k.a. `rawPrisma`) — raw client, no soft-delete filtering, for
  retention purge, restore, and backup export.

Multi-tenancy is being migrated from a per-`userId` ownership model to a
`Workspace` isolation root (Family/Pro). `workspaceId` columns were added
NULLABLE in Phase 1 (`20260529002000_workspace_phase1_foundation`) and remain
inert until `WORKSPACE_MODEL_ENABLED`. Application-level field encryption
(AES-256-GCM, `packages/shared/src/encryption.ts`) protects PII columns
(`Service.accountNumber/username/phone/email/notes`, MFA secrets, connector
tokens, lead payloads). Optimistic locking (`version Int`) guards
`ServiceProvider`, `Subscription`, `MovingPlan`, `PartnerConsent`.

Migration history is a single MySQL baseline (`20260314100500_mysql_baseline`,
1071 lines) followed by 71 additive migrations; legacy SQLite migrations are
archived under `legacy-sqlite-migrations/` and a one-shot
`_migrate-to-mysql.ts` script.

Overall the layer is mature and carefully reasoned (extensive schema comments,
explicit `onDelete` annotations, regression tests for soft-delete parity). The
material risks are: (a) soft-delete filtering does not cascade to child/included
relations; (b) several PII-bearing tables use loose `userId` refs with no FK and
no GDPR purge sweep (notably the new `Lead`/`AddressChangeEvent` lead-gen
models); (c) tenant-isolation enforcement is entirely application-layer.

## 2. Related Files

- `packages/db/prisma/schema.prisma` — the 88-model schema.
- `packages/db/src/index.ts` — `db` / `dbUnsafe` factory + soft-delete wiring.
- `packages/db/src/soft-delete.ts` — `withSoftDelete` extension + `SOFT_DELETE_MODELS`.
- `packages/db/src/optimistic-locking.ts` — `updateWithVersion`, `OptimisticLockError`.
- `packages/db/src/provider-coverage.ts`, `provider-coverage-metadata.ts`, `zip-centroid.ts`.
- `apps/web/src/lib/db.ts` — re-export of `prisma` / `rawPrisma`.
- `apps/web/src/lib/db-schema-compat.ts` — missing-column fallback detection (P2022 etc.).
- `apps/web/src/lib/shared-encryption.ts` → `packages/shared/src/encryption.ts`.
- `apps/web/src/lib/service-sensitive-fields.ts` — encrypt/decrypt of Service PII.
- `apps/web/src/lib/account-deletion.ts` — GDPR erasure, residue-table purge.
- `packages/db/prisma/migrations/**` (72 dirs) + `migration_lock.toml` (`provider = "mysql"`).
- `packages/db/prisma/legacy-sqlite-migrations/20260211195621_add_compound_indexes`.
- `packages/db/prisma/_migrate-to-mysql.ts`, `_migration-data.json` (653 KB).
- `packages/db/prisma/migrate-to-workspaces.ts`, `migrate-to-workspaces.smoke.ts`.
- Tests: `apps/web/src/lib/soft-delete-models.test.ts`,
  `soft-delete-delete-path.test.ts`, `soft-delete-recommendations.test.ts`,
  `account-deletion.test.ts`.

## 3. Related Routes / Screens

The schema underpins effectively every web/admin/mobile surface. Hot data-layer
consumers reviewed: `app/api/cron/{bill-reminders,contract-reminders,bill-overdue,
data-retention}/route.ts`, `app/api/services/**`, `app/api/budget/**`,
`app/api/export/route.ts`, `app/api/moving/migration/route.ts`. No user-facing
screen is owned by this module; it is infrastructure.

## 4. Related APIs

Indirect — all `apps/web/src/app/api/*` handlers import `prisma`/`rawPrisma`.
Direct data-layer surface: the two client exports, the soft-delete extension,
optimistic-locking helper, and `db-schema-compat` fallback used by routes that
must tolerate a not-yet-migrated column.

## 5. Related Components

None (server/infrastructure). UI consumes the data only through API routes.

## 6. Related State / Hooks / Stores

None client-side. Server "state" of note: the `globalForPrisma` singleton in
`packages/db/src/index.ts` (single shared connection for `db` and `dbUnsafe`),
and the in-process `warnedScopes` Set in `db-schema-compat.ts`.

## 7. Related Database / Models

All 88 models. Soft-delete models (10): `User`, `Address`, `Service`,
`MovingPlan`, `Budget`, `ServiceProvider`, `MoveTask`, `UserCustomProvider`,
`BlogPost`, `Workspace`. Versioned (optimistic-lock) models: `Subscription`,
`MovingPlan`, `ServiceProvider`, `PartnerConsent` (`tokenVersion`).
Workspace-scoped domain models with nullable `workspaceId`: `Address`, `Service`,
`MovingPlan`, `Budget`.

## 8. Impact Map

- **UI** — soft-delete filtering keeps deleted rows out of every list view for free.
- **API** — every route depends on the singleton client and the soft-delete contract.
- **DB** — schema integrity, indexes, FK/cascade rules, unique constraints (this audit).
- **Auth** — `User`, `AdminUser`, session/token tables, MFA secrets (encrypted).
- **Admin** — `AdminAuditLog` deliberately survives admin deletion (SetNull).
- **Mobile** — `MobileOAuthCode` (PKCE), `PushDevice`, IAP fields on `Subscription`.
- **Notifications** — `Notification`/`NotificationQueue`/`NotificationPreference` dedupe keys.
- **Integrations** — connector outbox (`ConnectorDispatch`), `PartnerConsent` token vault.
- **Analytics** — `UserSession`/`UserEvent`/`BlogView` (IP hashed), `IntegrationDailyStat`.
- **SEO** — `BlogPost` (`[slug, locale]` unique, sanitized `contentHtml`).
- **Tests** — soft-delete parity + delete-path regression guards; account-deletion tests.

## 9. Buttons / Actions / Functions

Infrastructure module — no UI actions. Key data-layer functions:

- **`withSoftDelete` (read interception)** — used by `db`. Expected: exclude
  `deletedAt != null` on `findMany/findFirst/findUnique/aggregate/groupBy/count`.
  Actual: correct for the listed ops; `findUnique` post-filters in JS and
  re-adds `deletedAt` to the select to detect deleted rows, then strips it.
  Edge cases: **does NOT cascade to `include`d relations** — a soft-deleted
  parent reached via a child's relation is still visible (DB-SCHEMA-01).
- **`withSoftDelete` (delete rewrite)** — `delete`→`update`, `deleteMany`→
  `updateMany`, dispatched via the captured `client` (factory form). Regression
  test `soft-delete-delete-path.test.ts` guards the old `this`-binding TypeError.
  Edge case: `update`/`upsert` are intentionally NOT intercepted (documented).
- **`updateWithVersion`** — CAS update; throws `OptimisticLockError` on 0 rows.
  Correct. Caller must surface 409; no permission check here (caller's job).
- **`restoreSoftDeleted`** — admin-only restore; validates model membership,
  uses raw client. Correct.
- **`encrypt`/`decrypt`** — AES-256-GCM, `enc_v1:` prefix; throws in production
  if `FIELD_ENCRYPTION_KEY` missing/invalid, passthrough in dev. Correct and
  fail-closed for prod writes.
- **`processAccountDeletionRequest`** — GDPR Art.17 erasure; uses `rawPrisma`,
  purges no-FK residue (`WaitlistSignup`, `NotificationQueue`) but NOT `Lead`
  (DB-SCHEMA-03).

## 10. UI/UX Audit

N/A — no UI surface. The only user-visible consequence is correct: soft-deleted
records disappear from lists automatically, and restore flows are admin-gated.

## 11. Logic Audit

- **Expected flow** — app code uses `db`; deleted rows are invisible; hard
  delete / restore / backup use `rawPrisma`. This is consistently followed
  (`rawPrisma` appears in only the documented callers: `user-auth.ts`,
  `qa-account.ts`, `account-deletion.ts`, `cron/workspace-purge`,
  `cron/stripe-reconcile`, `auth/register`).
- **Missing states** — soft-delete read filter does not extend into nested
  `include`/`select` relations. Crons compensate with explicit
  `user: { deletedAt: null }` guards (`bill-reminders/route.ts:62`,
  `contract-reminders/route.ts:45`), but this is per-call discipline, not a
  systemic guarantee. Any new join that forgets the guard leaks
  soft-deleted-owner data. (DB-SCHEMA-01)
- **Wrong conditions** — none found in the extension itself. `applyDeletedAtFilter`
  correctly respects a caller-supplied explicit `deletedAt`.
- **State mismatches** — `Service.actualMonthlyCost` is a documented legacy scalar
  superseded by `ServiceCostLog` per-month rows; both can drift. Documented, not
  a bug, but a dual-source-of-truth maintenance risk (DB-SCHEMA-07).
- **Race conditions** — optimistic locking covers the versioned models; unique
  constraints (`AcquisitionRedemption @@unique([userId, campaignId])`,
  `Notification @@unique([userId, channel, dedupeKey])`,
  `PartnerConsent activeGrantKey`) provide DB-enforced idempotency. Good.
- **Stale/cache risks** — `db-schema-compat.ts` swallows P2022 "missing column"
  to tolerate pre-migration rollouts; this hides genuine drift if a migration is
  skipped (the `warnedScopes` guard only logs once per scope per process).

## 12. Reverse Logic Audit

- **Unauthorized user / tenant isolation** — there is NO database-level tenant
  guard. `scopedRecordWhere`/`recordBelongsToScope`
  (`apps/web/src/lib/workspace-data-scope.ts`) enforce `workspaceId`/`userId`
  scoping in application code only. A route that builds a `where` without going
  through these helpers can read across tenants (IDOR). (DB-SCHEMA-02)
- **Empty data** — `findUnique` returns `null` for soft-deleted rows (correct).
- **Direct route access** — covered by route auth, not the schema.
- **Token expiry** — token tables (`UserLoginSession`, `MobileOAuthCode`,
  `OAuthState`, `PasswordResetToken`, `*PortalToken`) store hashes + `expiresAt`
  and are indexed on `expiresAt` for sweeping. Good.
- **Role change** — `WorkspaceMember.role/status` are plain strings; no DB
  constraint enforces the enum set (DB-SCHEMA-05).
- **Stale data** — `Subscription.lastStripeEventAt` guards out-of-order webhook
  replays at the app layer; `version Int` backs optimistic concurrency.

## 13. Security Audit

### DB-SCHEMA-02 — No DB-enforced tenant isolation (application-only scoping)
- **Severity**: High
- **Affected Area**: All workspace/user-scoped models (`Address`, `Service`,
  `MovingPlan`, `Budget`, `MoveTask`, etc.).
- **Evidence**: `workspaceId`/`userId` are nullable/plain columns; isolation is
  enforced only by `scopedRecordWhere`/`recordBelongsToScope`/`assertScopedRecordAction`
  in `apps/web/src/lib/workspace-data-scope.ts`. No row-level security, no
  composite unique that ties a child to its tenant. `workspaceId` is still
  NULLABLE on all four domain tables (Phase 1).
- **Risk**: A handler that constructs a Prisma `where` directly (omitting the
  scope helper) can read or mutate another tenant's rows (IDOR / cross-tenant
  leak).
- **Defensive Abuse Scenario (high-level)**: A user calls a scoped resource
  endpoint with another tenant's record id; if that endpoint forgot the
  ownership predicate, the row is returned because nothing at the DB layer
  rejects it.
- **Prevention**: Promote `workspaceId` to NOT NULL after backfill; centralize
  ALL scoped reads/writes through the scope helpers; add a lint/test that fails
  if a route queries a scoped model without a scope predicate.
- **Detection**: Audit each scoped-model query for a tenant predicate; add
  integration tests that attempt cross-tenant access and expect 404.
- **Analysis (root cause)**: Phased migration left `workspaceId` nullable and
  isolation in app code so the model can land before the dual-read window.
- **Recommendation**: Track Phase 3 NOT-NULL promotion; add an automated
  cross-tenant access test suite as a gate.
- **Tests To Add**: For each scoped model, "user A cannot GET/PUT/DELETE user B's
  record" returns 404/403.

### DB-SCHEMA-03 — GDPR erasure does not purge `Lead`/`LeadDispatch`/`AddressChangeEvent` PII
- **Severity**: High
- **Affected Area**: `Lead` (`payloadEncrypted` = name/contact/notes),
  `LeadDispatch`, `AddressChangeEvent.fullName` (plaintext).
- **Evidence**: `Lead.userId` is a documented LOOSE ref with NO FK
  (`schema.prisma:2385-2429`), so the `User` cascade never reaches it.
  `account-deletion.ts:365-371` explicitly purges only `WaitlistSignup` and
  `NotificationQueue` as "no-FK residue"; `Lead` is absent. The retention cron
  (`app/api/cron/data-retention/route.ts`) has no `lead.*` delete. Grep for
  `lead.deleteMany` across `apps/web/src` returns nothing.
- **Risk**: After an Art.17 erasure the user's encrypted contact PII persists in
  `Lead.payloadEncrypted` indefinitely, and `AddressChangeEvent.fullName` holds
  the user's plaintext full name. Incomplete erasure is a compliance violation.
- **Defensive Abuse Scenario (high-level)**: A regulator/audit requests proof of
  complete erasure; lead rows still contain the deleted user's recoverable PII.
- **Prevention**: Add `lead`, `leadDispatch`, `addressChangeEvent` (and any
  future loose-ref PII table) to the residue purge in both `account-deletion.ts`
  and the admin hard-delete path; or give them an FK + cascade.
- **Detection**: A schema-level test that asserts every model carrying PII either
  has a cascading FK to `User` or appears in the erasure purge list.
- **Analysis (root cause)**: Loose-ref pattern adopted for additive migration
  safety; the erasure-completeness checklist was not extended to the new
  lead-gen round (`20260620120000_free_pivot_lead_partner_models`).
- **Recommendation**: Extend `processAccountDeletionRequest` residue purge to
  cover the lead-gen tables before the lead program launches.
- **Tests To Add**: Erase a user with a `Lead` and assert no `Lead` row with that
  `userId` survives.

### DB-SCHEMA-04 — Legacy plaintext purchase tokens remain in `Subscription.purchaseToken`
- **Severity**: Medium
- **Affected Area**: `Subscription.purchaseToken` (`@db.Text`, plaintext).
- **Evidence**: Migration `20260621110000_subscription_purchase_token_encrypted`
  adds `purchaseTokenEncrypted` and states existing plaintext values "are left
  as legacy fallback rows" rewritten only "on the next successful store
  validation". New writes set `purchaseToken: null` and populate
  `purchaseTokenEncrypted` (`iap-common.ts:644-645`). Until each subscriber's
  next validation, the plaintext Play token persists.
- **Risk**: A Google Play purchase token is a bearer credential for subscription
  state; plaintext-at-rest for inactive/lapsed subs that never re-validate is a
  standing secret-exposure window.
- **Defensive Abuse Scenario (high-level)**: A DB read (backup leak, SQLi
  elsewhere) exposes still-plaintext tokens for subscribers who haven't
  re-validated.
- **Prevention**: Run a one-time backfill job that encrypts all remaining
  plaintext `purchaseToken` values and then nulls the column.
- **Detection**: `SELECT count(*) WHERE purchaseToken IS NOT NULL` should trend
  to 0; alert if it plateaus.
- **Analysis (root cause)**: Key unavailable inside SQL migration, so the rewrite
  was deferred to runtime re-validation, which never fires for dormant rows.
- **Recommendation**: Add an app-runtime backfill (has the key) rather than
  relying on organic re-validation.
- **Tests To Add**: Backfill job test that encrypts a plaintext token and nulls
  the source column.

### DB-SCHEMA-08 — Encryption key passthrough in non-production
- **Severity**: Low / Info
- **Affected Area**: `packages/shared/src/encryption.ts:38-46, 63-73`.
- **Evidence**: When `FIELD_ENCRYPTION_KEY` is unset, `encrypt`/`decrypt` return
  plaintext outside production. `decrypt` also logs `[ENCRYPTION] Failed to
  decrypt` and returns the raw value in dev.
- **Risk**: Staging/preview environments (if `NODE_ENV !== "production"`) can
  persist PII in plaintext. Lower risk because production is fail-closed (throws).
- **Prevention**: Ensure staging runs with `NODE_ENV=production` or a real key;
  never seed real PII into non-prod.
- **Detection**: Startup assertion that the key is present in any internet-facing env.
- **Recommendation**: Gate passthrough on an explicit `ALLOW_PLAINTEXT_PII=1`
  dev flag rather than `NODE_ENV`.
- **Tests To Add**: Assert `encrypt` throws when key missing and env is not a
  local dev marker.

### DB-SCHEMA-09 — `db-schema-compat` silently swallows missing-column errors
- **Severity**: Low
- **Affected Area**: `apps/web/src/lib/db-schema-compat.ts`.
- **Evidence**: `isMissingDbColumnError` matches P2022 / "unknown column" and
  callers fall back to a legacy query path, warning only once per scope per
  process (`warnedScopes`).
- **Risk**: A genuinely un-applied migration in production degrades silently to a
  legacy code path instead of failing loud, masking schema drift.
- **Prevention/Detection**: Emit a metric (not just a one-time console.warn) when
  a fallback fires; alert on any occurrence in production.
- **Recommendation**: Treat a fallback in production as an error-level signal.

## 14. Performance Audit

- **Indexes** — broadly thorough. Hot crons are covered by composite indexes
  added deliberately (`Service @@index([isActive, contractEndDate])`,
  `@@index([isActive, billingDay])` via `20260530000000_add_perf_indexes`;
  `AuditLog`/`AdminAuditLog @@index([createdAt])` and `@@index([action, createdAt])`
  with explanatory comments). `AffiliateClick @@index([providerId, createdAt])`
  for windowed aggregation.
- **N+1 risk** — crons batch `notificationPreference.findMany({ userId: { in } })`
  to avoid per-row lookups (`bill-reminders/route.ts:70`). Good.
- **`deletedAt` index** — present on all 10 soft-delete models, so the auto-filter
  is index-backed.
- **Potential gap (DB-SCHEMA-10, Low)** — `EmailLog.to` and `WaitlistSignup`
  scans by `email` exist, but PII-bearing wide-text columns (`@db.Text`
  account/username/phone/email on `Service`) are encrypted, so equality lookups
  on them are impossible by design — acceptable, just note that "find my service
  by account number" is not indexable.
- **Pagination** — `contract-reminders` uses `take: 1000`; large tenants near
  that cap could be silently truncated (Low). Cursor pagination would be safer.

## 15. Reliability Audit

- **Transaction consistency** — `BlogPost` writes `contentJson/Html/Text`
  together "in a transaction" (schema comment); connector outbox + lead dispatch
  follow a transactional-outbox pattern with idempotency keys and retry/backoff
  columns (`nextRetryAt`, `attemptCount`, `lastErrorCode`). Strong design.
- **Partial failure** — `account-deletion.ts` is explicitly resilient: caps
  Stripe-cancel retries, force-erases after N attempts so GDPR is never wedged,
  purges `MovingPlan` before workspace delete to avoid FK 1451. Well-reasoned.
- **Cascade integrity** — `MovingPlan.from/toAddress` are explicit
  `onDelete: Restrict` (schema.prisma:619/622) to prevent silent move-history
  loss; `Workspace.owner` is `Restrict`; audit logs are `SetNull` to survive
  actor deletion. These are correct and documented.
- **Monitoring/logging** — `db-schema-compat` warns once-per-scope (weak signal,
  see DB-SCHEMA-09). Connection lifecycle handled via `beforeExit/SIGINT/SIGTERM`
  in `index.ts`.
- **Singleton** — `globalForPrisma.prisma` is only memoized when
  `NODE_ENV !== "production"`; in production a new client is created per module
  load, which is the standard Next.js pattern (Info).

## 16. Dead Code / Cleanup

- `Service.actualMonthlyCost` — documented LEGACY scalar superseded by
  `ServiceCostLog`; retained for back-compat. Candidate for eventual removal once
  all reads go through the cost-log engine. [needs verification that no read path
  still uses it as source of truth] (DB-SCHEMA-07).
- `Subscription.purchaseToken` (plaintext) — to be retired after backfill
  (DB-SCHEMA-04).
- `_migrate-to-mysql.ts` + `_migration-data.json` (653 KB) + `legacy-sqlite-migrations/`
  — one-shot SQLite→MySQL tooling. The `TABLES` list in `_migrate-to-mysql.ts`
  references models that NO LONGER EXIST in the current schema (`FamilyMember`,
  `Task`, `MovingBox`, `Document`, `Review`, `Badge`, `UserBadge`, `ChatSession`,
  `ChatMessage`, `ReferralCode`, `ReferralReward`, `KeywordBlacklist`,
  `ModerationStat`). The script is dead relative to the current schema and should
  be archived out of the active prisma dir. [confirmed against schema model list]
  (DB-SCHEMA-11, Info).
- `ConnectorDispatch.purchaseToken`-style dual columns and connector "loose ref"
  legacy fields (`eventId`, `serviceId`) are documented back-compat — keep until
  the connector framework GA.

## 17. Tests

- **Existing** — `soft-delete-models.test.ts` parses the schema and asserts
  `SOFT_DELETE_MODELS` is exactly the set of models with a `deletedAt` column
  (parity guard, both directions). `soft-delete-delete-path.test.ts` runs the
  REAL extension to prove the `delete`/`deleteMany` rewrite doesn't regress to
  the `this`-binding TypeError. `soft-delete-recommendations.test.ts`,
  `account-deletion.test.ts`.
- **Missing / suggested**:
  - Cross-tenant IDOR integration tests for every scoped model (DB-SCHEMA-02).
  - Erasure-completeness test asserting `Lead`/`AddressChangeEvent` PII is purged
    on account deletion (DB-SCHEMA-03).
  - A regression test that a soft-deleted parent is NOT returned via a child's
    `include` (documents/guards DB-SCHEMA-01).
  - Migration-reversibility / drift test (schema vs. migration SQL).
  - Backfill test for plaintext-token encryption (DB-SCHEMA-04).

## 18. Findings Summary

| ID | Severity | Category | Finding | Impact | Recommendation | Files |
|----|----------|----------|---------|--------|----------------|-------|
| DB-SCHEMA-01 | Medium | Data | Soft-delete read filter does not cascade into `include`/`select` relations | Soft-deleted-owner rows leak through child joins unless each query adds a manual guard | Add a join-time guard pattern / lint; document the limitation; test it | `packages/db/src/soft-delete.ts`, `apps/web/src/app/api/cron/*-reminders/route.ts` |
| DB-SCHEMA-02 | High | Security | Tenant isolation is application-only (no DB-level row scoping; `workspaceId` nullable) | A query missing the scope predicate enables cross-tenant IDOR | Promote `workspaceId` NOT NULL post-backfill; funnel all scoped queries through helpers; add cross-tenant tests | `apps/web/src/lib/workspace-data-scope.ts`, `schema.prisma` (Address/Service/MovingPlan/Budget) |
| DB-SCHEMA-03 | High | Security | GDPR erasure misses `Lead`/`LeadDispatch`/`AddressChangeEvent` PII (loose refs, no purge) | Deleted user's encrypted contact PII + plaintext `fullName` persist after Art.17 erasure | Add lead-gen tables to residue purge or add cascading FK | `apps/web/src/lib/account-deletion.ts`, `schema.prisma:2385-2429,2114-2143` |
| DB-SCHEMA-04 | Medium | Security | Legacy plaintext `Subscription.purchaseToken` lingers until organic re-validation | Plaintext store bearer token at rest for dormant subscribers | Runtime backfill: encrypt then null the column | `packages/db/prisma/migrations/20260621110000_*`, `apps/web/src/lib/iap-common.ts` |
| DB-SCHEMA-05 | Low | Data | Enum-like fields are plain `VarChar` strings (status/role/category) — no DB constraint | Invalid enum values can be written, drift between app + DB | Validate at app boundary (zod); consider DB CHECK/enum where stable | `schema.prisma` (e.g. `WorkspaceMember.role/status`, `*.status`) |
| DB-SCHEMA-06 | Low | Data | `AuditLog.userId` / `GDPRRequest.userId` are FK-less loose refs | Orphaned audit/GDPR rows; cannot join-enforce integrity | Intentional for AuditLog; document GDPRRequest retention/erasure handling | `schema.prisma:1123-1144,1702-1717` |
| DB-SCHEMA-07 | Low | Data | Dual source of truth: `Service.actualMonthlyCost` vs `ServiceCostLog` | Budget actuals can drift if a reader uses the legacy scalar | Confirm no read path uses the scalar as truth; plan removal | `schema.prisma:516-601` |
| DB-SCHEMA-08 | Low | Security | Encryption passthrough/log-raw in non-production | PII plaintext-at-rest possible in mis-configured staging | Gate on explicit dev flag, not `NODE_ENV` | `packages/shared/src/encryption.ts:38-99` |
| DB-SCHEMA-09 | Low | Reliability | `db-schema-compat` swallows missing-column errors with once-per-scope warn | Real production schema drift degrades silently | Emit metric/alert on any production fallback | `apps/web/src/lib/db-schema-compat.ts` |
| DB-SCHEMA-10 | Low | Performance | `contract-reminders` uses `take: 1000` (no cursor) | Very large tenant sets could be truncated silently | Cursor-paginate the cron scan | `apps/web/src/app/api/cron/contract-reminders/route.ts:51` |
| DB-SCHEMA-11 | Info | Dead Code | `_migrate-to-mysql.ts` references ~13 models no longer in the schema | Confusing dead tooling in active prisma dir | Archive the SQLite→MySQL one-shot tooling | `packages/db/prisma/_migrate-to-mysql.ts`, `_migration-data.json`, `legacy-sqlite-migrations/` |

## 19. Module TODO

- [ ] **DB-SCHEMA-02 (High)** — Enforce tenant isolation. Reason: app-only
  scoping is IDOR-prone. Files: `workspace-data-scope.ts`, scoped-model routes.
  Fix: route every scoped query through the helpers + add cross-tenant tests;
  schedule NOT-NULL `workspaceId` promotion. Deps: workspace backfill complete.
  Complexity: high. Risk of change: high.
- [ ] **DB-SCHEMA-03 (High)** — Purge lead-gen PII on erasure. Reason: GDPR Art.17
  completeness. Files: `account-deletion.ts`, admin hard-delete path. Fix: add
  `lead`/`leadDispatch`/`addressChangeEvent` to residue purge. Deps: none.
  Complexity: low. Risk: low.
- [ ] **DB-SCHEMA-01 (Medium)** — Guard soft-delete across joins. Reason: leak via
  included relations. Files: `soft-delete.ts`, cron routes. Fix: helper/lint +
  regression test. Deps: none. Complexity: medium. Risk: medium.
- [ ] **DB-SCHEMA-04 (Medium)** — Backfill-encrypt legacy purchase tokens. Reason:
  plaintext bearer secret at rest. Files: `iap-common.ts` + new backfill job.
  Fix: app-runtime job (has the key) then null the column. Deps: none.
  Complexity: low. Risk: low.
- [ ] **DB-SCHEMA-05 (Low)** — Validate enum-like strings at the boundary. Fix:
  zod schemas / DB CHECK. Complexity: medium. Risk: low.
- [ ] **DB-SCHEMA-09 (Low)** — Alert on schema-compat fallback in prod. Complexity:
  low. Risk: low.
- [ ] **DB-SCHEMA-11 (Info)** — Archive dead SQLite→MySQL tooling. Complexity: low.
  Risk: low.

[needs verification] items: DB-SCHEMA-07 (whether any live read uses
`Service.actualMonthlyCost` as the actuals source) — would require tracing every
budget-actuals read path beyond this module's scope.
