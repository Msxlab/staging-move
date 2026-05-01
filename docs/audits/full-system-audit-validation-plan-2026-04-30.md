# Full System Audit Validation And Planning - 2026-04-30

## 1) Verdict

The audit direction is mostly correct, but the current repo state does not
contain the promised single full-system report at
`docs/audits/full-system-audit-2026-04-30.md`.

What exists is an admin-focused module audit folder:
`docs/audits/admin-module-audit-2026-04-30/`.

That admin audit is useful and several findings are confirmed by code. However,
it is not enough to treat the system as fully audited. The web and mobile
client modules need their own evidence-backed module files, and the system-wide
report needs to be regenerated as a real source of truth rather than a chat
summary.

## 2) Accuracy Assessment

### Confirmed accurate findings

- Admin permission matrix is incomplete for current module surface.
  Evidence:
  - `apps/admin/src/lib/admin-permissions.ts`
  - `apps/admin/src/app/api/analytics/user-spending/route.ts`
  - `apps/admin/src/app/api/security/route.ts`
  - `apps/admin/src/app/api/runtime-config/route.ts`
  - `apps/admin/src/app/api/email-templates/route.ts`
  - `apps/admin/src/app/api/feature-flags/route.ts`

- Many sensitive admin modules are grouped under `settings` instead of having
  dedicated permission resources.
  Evidence:
  - `apps/admin/src/app/api/security/route.ts`
  - `apps/admin/src/app/api/runtime-config/route.ts`
  - `apps/admin/src/app/api/backup/route.ts`
  - `apps/admin/src/app/api/email-templates/route.ts`
  - `apps/admin/src/app/api/help-center/route.ts`
  - `apps/admin/src/app/api/notifications/route.ts`

- User detail endpoint returns broad operational and security-adjacent data to
  anyone with `users canRead` and `VIEWER` minimum role.
  Evidence:
  - `apps/admin/src/app/api/users/[id]/route.ts`

- Backup coverage is incomplete and the "FULL" label can overstate recovery
  coverage.
  Evidence:
  - `apps/admin/src/lib/backup-tables.ts`
  - `apps/admin/src/app/api/backup/route.ts`
  - `apps/admin/src/app/api/cron/backup/route.ts`
  - `packages/db/prisma/schema.prisma`

- Backup export uses `take: 50000`, so large tables can be truncated without a
  cursor-based complete export.
  Evidence:
  - `apps/admin/src/app/api/backup/route.ts`
  - `apps/admin/src/app/api/cron/backup/route.ts`

- Cron backup table fetchers are not fully derived from the declared table
  catalog; `providerLogoCandidates` is declared but not fetched by cron.
  Evidence:
  - `apps/admin/src/lib/backup-tables.ts`
  - `apps/admin/src/app/api/cron/backup/route.ts`

- Mobile analytics can be disabled by the web cookie-consent gate because
  mobile sends bearer-token API calls and does not send the web
  `cookie_consent` cookie.
  Evidence:
  - `apps/web/src/app/api/tracking/session/route.ts`
  - `apps/web/src/app/api/tracking/event/route.ts`
  - `apps/mobile/src/lib/api.ts`
  - `apps/mobile/src/lib/analytics.ts`
  - `apps/mobile/src/components/SessionTracker.tsx`

- Security IP/GDPR mutations are operationally sensitive but do not currently
  require password step-up or strong domain validation.
  Evidence:
  - `apps/admin/src/app/api/security/route.ts`

- Runtime config has strong baseline guards, but validation is mostly catalog
  and non-empty checks rather than provider-specific connectivity or format
  validation.
  Evidence:
  - `apps/admin/src/app/api/runtime-config/route.ts`
  - `apps/admin/src/lib/runtime-config.ts`
  - `packages/shared/src/runtime-config.ts`

- Acquisition campaign max-redemption logic can race because availability is
  checked before the redemption transaction and the campaign count increment is
  not conditional on remaining capacity.
  Evidence:
  - `apps/web/src/app/api/acquisition/redeem/route.ts`
  - `packages/shared/src/acquisition.ts`

### Partially accurate but overstated

- The pasted full-system audit says admin, web, and mobile were each deeply
  reviewed module by module. In the repo, only admin has split module files.
  Web and mobile route inventories exist in code, but there is no equivalent
  persisted client module audit.

- The existing admin module audit files are good triage notes, but they are
  short and do not yet meet the original requested bar for every module:
  exact symbol-level evidence, route-by-route behavior, UX state inventory,
  full data dependency mapping, and test expectations.

- "Operator-ready" language should remain conservative. Several admin modules
  are usable but not mature control planes yet: backups, runtime config,
  security, feature flags, acquisition campaigns, finance/billing, support, and
  analytics.

### Stale or currently incorrect

- `docs/audits/admin-module-audit-2026-04-30/00-index.md` says
  `pnpm verify:typecheck` fails due web/mobile issues. In this checkout,
  `pnpm verify:typecheck` passes. The only repeated warning is Node mismatch:
  repo wants Node `22.x`; current runtime is `v24.13.0`.

- The expected full-system report path does not exist locally:
  `docs/audits/full-system-audit-2026-04-30.md`.

## 3) Planning Principles

- Do not start by polishing UI. First make permissions, backup truth, privacy,
  and observability honest.
- Treat admin control-plane modules as privileged operations, not normal CRUD.
- Split fixes into small vertical passes with tests. The largest risk is
  changing permissions or backup behavior broadly without regression coverage.
- Keep audit documents synchronized with current code. Stale audit claims are
  now an operational risk by themselves.

## 4) Priority Plan

### P0 - Correctness and safety gate

1. Create the real full-system audit source of truth.
   - Add `docs/audits/full-system-audit-2026-04-30.md`.
   - Link the existing admin module audit folder.
   - Add separate web and mobile module audit sections with real route/page
     evidence.
   - Mark old/stale audit statements explicitly.

2. Expand and backfill the admin permission resource model.
   - Add dedicated resources for at least: `analytics`, `security`,
     `runtime_config`, `backups`, `notifications`, `email_templates`,
     `help_center`, `waitlist`, `feature_flags`, `reports`,
     `acquisition_campaigns`, and possibly `billing`.
   - Add seed/backfill coverage for existing admins.
   - Add route authorization tests that fail if a route uses an unknown or
     overly broad resource.

3. Add field-level admin data minimization.
   - Start with user detail, security, audit logs, waitlist, subscriptions, and
     moving plans.
   - Define role-based views: `overview`, `security`, `billing`, `support`,
     `activity`.
   - Mask IP, user-agent, OAuth provider ID hints, full addresses, reset/email
     token metadata, and sensitive GDPR fields for lower roles.

4. Fix backup truthfulness before relying on backups.
   - Generate backup catalog coverage from Prisma schema or add a schema-diff
     test.
   - Make manual and cron backups share one table operation registry.
   - Replace `take: 50000` with cursor pagination.
   - Fail or warn loudly when a table is truncated or missing from a "FULL"
     backup.
   - Decide policy for sessions, tokens, runtime secrets, webhook events, and
     GDPR records.

5. Harden high-risk admin mutations.
   - Add password step-up for IP rules, GDPR result/status changes, feature flag
     destructive/toggle actions, campaign activation, and transactional email
     template changes.
   - Add IP/CIDR, URL, enum, date, and domain-specific validation.

### P1 - Operator workflow readiness

1. Build a route/module authorization matrix test suite.
   - Admin API: resource, action, minimum role, step-up requirement.
   - Web API: authenticated user, object ownership, soft-delete guard.
   - Mobile API parity: bearer auth, deep link/OAuth callback, IAP paths.

2. Create integration readiness visibility.
   - Runtime config should show configured, validated, failing, stale, and
     unknown states.
   - Include Stripe, Resend, OAuth, R2/offsite backup, Redis/rate limit,
     webhooks, mobile IAP, push notifications, and cron secrets.

3. Make support/tickets operator-ready.
   - Add assignment, SLA, escalation, internal reason codes, timeline, and
     searchable user context with field-level masking.

4. Make finance/billing operator-ready.
   - Add failed payment queue, trial conversion visibility, refund/dispute
     review, Stripe/IAP reconciliation, campaign redemption exceptions, and
     audit-ready exports.

5. Fix mobile analytics consent semantics.
   - Add a mobile-native analytics consent setting or explicit API header.
   - Store consent state server-side per user/device.
   - Add tests proving mobile tracking is enabled only after explicit consent.

### P2 - Structural platform work

1. Replace route-only cron semantics with a clearer job model.
   - Keep cron HTTP entrypoints if needed, but centralize job handlers,
     idempotency keys, retries, lock/lease behavior, and job history.

2. Introduce admin control-plane history and rollback.
   - Runtime config version history.
   - Email template versioning and rollback.
   - Feature flag owner, expiry, rollout notes, and kill-switch runbook.

3. Improve data lifecycle governance.
   - Define retention for sessions, audit logs, rate-limit logs, backups,
     GDPR exports, email logs, push devices, and support messages.
   - Surface retention state in admin.

4. Normalize subscription and campaign lifecycle.
   - Clarify web Stripe vs mobile IAP parity.
   - Add reservation or conditional update for max redemptions.
   - Add a finance exception queue.

### P3 - Audit hygiene and product clarity

1. Split client audits into stable files:
   - `docs/audits/client-web-module-audit-2026-04-30/*.md`
   - `docs/audits/client-mobile-module-audit-2026-04-30/*.md`

2. Add a Jira-ready remediation backlog.
   - Each item should include impact, likelihood, owner, files, acceptance
     criteria, tests, and rollout risk.

3. Add automated inventory scripts.
   - Route inventory.
   - Permission resource usage inventory.
   - Backup schema coverage diff.
   - Public API exposure inventory.

## 5) Product Decisions Needed

- Which admin roles may see raw PII, IP addresses, user-agent strings, OAuth
  provider hints, full addresses, and GDPR request payloads?
- Should backups include runtime config, sessions, tokens, webhook events, and
  rate-limit logs, or should those remain excluded by explicit policy?
- Is mobile analytics allowed, and if yes, what consent UX/policy is required?
- Should acquisition campaigns apply to mobile IAP, or remain web/Stripe-only?
- What is the source of truth for finance operations: Stripe, app stores, or
  internal subscription state?
- Which support workflows require SLA/assignment/escalation before launch?
- Which admin actions require step-up, two-person approval, or SUPER_ADMIN only?

## 6) Recommended Execution Order

1. Documentation truth pass:
   - Create the missing full-system audit file.
   - Mark stale verification claims.
   - Add web/mobile module audit files with evidence.

2. Safety tests before code changes:
   - Permission matrix tests.
   - Backup schema coverage test.
   - Mobile analytics consent test.
   - Acquisition redemption concurrency test.
   - User-detail PII minimization snapshot test.

3. P0 implementation pass:
   - Permission resources/backfill.
   - Backup registry/cursor fixes.
   - High-risk admin mutation step-up.
   - Mobile analytics consent fix.
   - User-detail field-level masking.

4. P1 operator-readiness pass:
   - Integration readiness dashboard.
   - Support SLA/assignment.
   - Finance exception queues.
   - Security incident timeline.

5. P2 platform pass:
   - Central job/worker abstraction.
   - Runtime config/email/flag versioning.
   - Retention and restore drill automation.

## 7) Verification Performed In This Review

- `node -v; pnpm -v`
- `pnpm --filter @locateflow/admin exec tsc --noEmit`
- `pnpm --filter @locateflow/admin test`
- `pnpm --filter @locateflow/web exec tsc --noEmit`
- `pnpm --filter @locateflow/mobile exec tsc --noEmit`
- `pnpm verify:typecheck`

Results:
- Admin typecheck passed.
- Admin tests passed: 34 files, 125 tests.
- Web typecheck passed.
- Mobile typecheck passed.
- Full `verify:typecheck` passed.
- Repeated environment warning: repo expects Node `22.x`; local runtime is
  Node `v24.13.0`.

## 8) Bottom Line

The audit's main risk direction is right, especially around permissions,
backups, privacy/PII, mobile analytics consent, and operator-readiness gaps.
But the artifact is not yet a complete full-system audit. Treat it as a strong
admin/security triage input, then run the P0 plan above to produce a trustworthy
system-wide source of truth and fix the highest-risk gaps first.
