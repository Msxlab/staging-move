# Cross-Surface Hardening And Ops Implementation - 2026-04-23

## 1. Goals Of This Pass

- Make internal service authentication fail closed instead of accepting broad secret fallbacks.
- Make runtime readiness and environment templates truthful about which integrations and internal paths are actually live.
- Add a shared account-security capability that can be consumed by web, mobile, and admin-facing support workflows.
- Improve existing operator workspaces without adding speculative dashboards.
- Make notifications honest about supported delivery semantics until a real worker/provider path exists.
- Add support/subscription operational context where the current data model already supports it.

## 2. Implementation Batches

### Batch 1 - Internal Auth And Runtime Truthfulness

Files changed:

- `.env.example`
- `.env.production.example`
- `apps/admin/src/app/api/internal/ip-rules/route.ts`
- `apps/admin/src/lib/internal-secrets.test.ts`
- `apps/admin/src/lib/internal-secrets.ts`
- `apps/admin/src/lib/security-readiness.ts`
- `apps/web/src/app/api/internal/ip-rules/route.ts`
- `apps/web/src/lib/internal-secrets.test.ts`
- `apps/web/src/lib/internal-secrets.ts`
- `packages/shared/src/runtime-config.ts`

What changed:

- `INTERNAL_WEBHOOK_SECRET` is now the required secret for generic internal webhook calls.
- `CRON_SECRET` remains valid only for cron-scoped calls.
- `IMPERSONATION_HANDOFF_SECRET` remains scoped to impersonation handoff only.
- Runtime config marks `INTERNAL_WEBHOOK_SECRET` and `IMPERSONATION_HANDOFF_SECRET` as production-required.
- Admin security-readiness copy now describes the real operational impact when these secrets are missing.
- Internal IP rules routes now call `getInternalCallerSecret("internal")`, so they no longer inherit cron fallback behavior.

### Batch 2 - Cross-Surface Account Security

Files changed:

- `apps/web/src/app/api/auth/security/route.ts`
- `apps/web/src/app/(app)/settings/privacy/page.tsx`
- `apps/mobile/app/settings/privacy.tsx`

What changed:

- Added `GET /api/auth/security` for account-security aggregation.
- Added `POST /api/auth/security` actions for `set_password`, `revoke_session`, and `revoke_other_sessions`.
- Web settings now show linked login methods, password/OAuth/MFA/email-verification state, live login sessions, recovery context, and revoke controls.
- Mobile settings now show the same security state and support set-password plus sign-out-other-sessions.
- Security actions write user audit events through the existing `AuditLog` model.

### Batch 3 - Notification Delivery Honesty

Files changed:

- `apps/admin/src/app/api/notifications/route.ts`
- `apps/admin/src/app/(admin)/notifications/page.tsx`

What changed:

- Admin-created notifications now explicitly support immediate `IN_APP` delivery only.
- `EMAIL`, `PUSH`, and delayed/scheduled delivery are rejected at the API boundary.
- The admin UI disables unsupported channels and explains that worker/provider delivery is not live yet.
- The list API now returns delivery capability metadata so the UI can avoid overstating readiness.

### Batch 4 - Support Operator Context

Files changed:

- `apps/admin/src/app/api/tickets/route.ts`
- `apps/admin/src/app/api/tickets/[id]/route.ts`
- `apps/admin/src/app/(admin)/support/page.tsx`
- `apps/admin/src/app/(admin)/support/[id]/page.tsx`

What changed:

- Ticket list and detail APIs now return derived SLA metadata.
- Ticket list and detail APIs now return assigned admin details when `assignedTo` is present.
- Support list shows assignee visibility and SLA status.
- Support detail shows assignee visibility and SLA due/breach context.

### Batch 5 - Subscription Operator Context

Files changed:

- `apps/admin/src/app/api/subscriptions/route.ts`
- `apps/admin/src/app/(admin)/subscriptions/page.tsx`

What changed:

- Subscription API supports `provider` and `platform` filters.
- Subscription API returns provider/platform distribution maps.
- Subscription list shows source/provider/platform filters.
- Subscription rows show mobile validation health such as missing transaction token, never validated, stale validation, or OK.
- Subscription detail modal exposes provider, platform, last validation, and last sync timestamps.

### Batch 6 - Admin User Detail Sensitive Field Redaction

Files changed:

- `apps/admin/src/app/api/users/[id]/route.ts`
- `apps/admin/src/app/(admin)/users/[id]/page.tsx`

What changed:

- Admin user detail now returns a safe selected user payload instead of all user scalar fields.
- `passwordHash`, `mfaSecret`, and `mfaBackupCodes` are not returned to the browser.
- Login-session `tokenHash` is not returned to the browser.
- Push-device tokens are not returned to the browser.
- OAuth provider identifiers are reduced to a server-generated hint instead of exposing the full provider subject.
- The UI now uses `hasPasswordLogin` and `providerIdHint` instead of sensitive raw values.

## 3. Schema And Migration Changes

- No database migration was added in this pass.
- The implementation reused existing models, including `UserLoginSession`, `OAuthAccount`, `UserVerificationToken`, `UserPasswordResetToken`, `AuditLog`, `SupportTicket`, `AdminUser`, `Subscription`, and `Notification`.
- Internal admin notes for users were not added because that would require a new durable note model and a product-policy decision around retention, visibility, and permissions.

## 4. New Or Changed APIs

New API:

- `GET /api/auth/security`
- `POST /api/auth/security`

Changed APIs:

- `GET /api/notifications` now includes delivery capability metadata.
- `POST /api/notifications` rejects unsupported channels and scheduled/delayed delivery semantics.
- `GET /api/tickets` now includes `assignedAdmin` and `sla` per ticket.
- `GET /api/tickets/[id]` now includes `assignedAdmin` and `sla`.
- `GET /api/subscriptions` now accepts `provider` and `platform` filters and returns provider/platform stats.
- Internal IP-rule route callers now use the scoped internal secret instead of cron fallback.
- `GET /api/users/[id]` now redacts sensitive auth/session/push-token fields while preserving admin support context.

## 5. Cross-Surface Behavior Changes

- Web and mobile now share the same account-security API instead of each surface guessing at auth state.
- Web has the richer account-security action surface: session revoke, revoke others, set-password, and existing MFA/change-password entry points.
- Mobile now has truthful security visibility, set-password for OAuth-only users, and revoke-other-sessions.
- Admin notifications can no longer claim or imply live email/push/scheduled delivery from the manual send path.
- Admin support and subscriptions now expose operational context already present in backend data.
- Admin user detail keeps account-security visibility without sending auth secrets or raw session tokens to the client.

## 6. Security Fixes Applied

- Removed broad `CRON_SECRET` fallback from generic internal webhook authentication.
- Kept cron and impersonation secrets scoped to their intended use.
- Marked internal and impersonation secrets as production-required runtime config.
- Added tests covering the stricter internal-secret behavior in web and admin.
- Added user audit events for account-security password/session actions.
- Prevented unsupported notification channels from being accepted by the admin API.
- Prevented future-scheduled admin notifications from being accepted while no scheduler/worker exists.
- Prevented admin user-detail responses from leaking password hashes, MFA secrets/backup codes, login token hashes, push tokens, or full OAuth provider subject IDs.
- Fixed Play Store RTDN production behavior so missing `GOOGLE_PLAY_RTDN_AUDIENCE` fails closed instead of skipping OIDC verification.
- Added logger redaction for authorization headers, cookies, tokens, password/MFA material, reset/verification tokens, push tokens, and OAuth subject identifiers.

## 7. Fully Implemented

- Scoped internal secret behavior for web/admin helper usage.
- Runtime readiness/environment template truthfulness for internal and impersonation secrets.
- Account-security API aggregation for linked methods, sessions, email/password/MFA state, and recovery-token context.
- Account-security actions for setting first password and revoking sessions.
- Web account-security UI backed by the new API.
- Mobile account-security visibility backed by the new API, including set-password and sign-out-other-sessions.
- Manual admin notifications restricted to immediate in-app delivery.
- Support ticket assignee visibility and derived SLA context.
- Subscription provider/platform filtering and validation health visibility.
- Admin users/[id] sensitive field redaction while preserving linked-method/session/support visibility.
- Backup table catalog aligned with the schema-backed export/import paths.
- Cron backup generation now uses the shared canonical backup catalog.
- Current-system incident response, restore, breach, admin compromise, key rotation, and release checklists documented.

## 8. Partially Implemented

- Mobile account-security management: visibility and key actions exist, but full change-password and MFA management remain web-only.
- Admin users/[id] account-security support surface: the new API makes the core user-side data available, but admin user-detail aggregation was not expanded in this batch.
- Notification operations: unsupported channels are now honest and blocked, but no durable email/push worker was added.
- Support operations: assignee/SLA visibility improved, but no macros, queues, saved replies, or SLA policy configuration were added.
- Subscription operations: validation health is visible, but finance/support actions such as refund, retry, grant, revoke, or reconciliation workflows were not added.

## 9. Intentionally Deferred

- A new notification worker or scheduler service.
- User internal notes and full account/security timeline on admin users/[id].
- Provider governance workflow changes such as review states, duplicate merge, or approval queues.
- State-rules governance workflow changes such as draft/publish and impact review.
- Moving-operations workflow changes beyond the existing admin surface.
- Team/admin lifecycle changes such as archive-only deletion or role elevation approval.

## 10. Blocked By Credentials

- Live Google OAuth validation.
- Live Apple OAuth validation.
- Production email-provider validation.
- Production push-provider validation.
- Store subscription verification against real Apple/Google credentials.
- Backup storage validation if production object storage secrets are required.

## 11. Product Decisions Needed

- Notification system direction: immediate-only admin broadcasts, queued campaigns, or full transactional/multichannel worker.
- Support operating model: queues, ownership rules, SLA policy, macros, escalation, and internal note visibility.
- Subscription action model: what finance/support staff may do directly, what requires approval, and what must be reconciled externally.
- Provider governance: who can publish provider changes, whether review is required, and how duplicates should be merged.
- State-rules governance: draft/publish ownership, legal review requirements, and rollback expectations.
- User/admin notes retention and visibility policy.

## 12. Stabilization Cleanup Addendum

- Play Store RTDN now rejects production webhook calls when `GOOGLE_PLAY_RTDN_AUDIENCE` is missing, while retaining the non-production escape hatch for safe local/test work.
- Backup import/export/cron backup paths share the same schema-backed table catalog, including users, subscriptions, payments, services, addresses, providers, provider coverage, notifications, feature flags, and audit logs.
- Backup import remains dependency-aware through `BACKUP_TABLE_ORDER`, and replace-mode safety checks prevent replacing parent tables without required dependent tables.
- Admin notification creation is explicitly immediate in-app only; unsupported email/push channels and delayed `sendAt` values are rejected server-side.
- Support SLA language was narrowed to "derived operational target" so the UI does not imply a configured contractual SLA policy.
- Subscription health language was narrowed to recorded validation metadata and no longer implies live store verification without credentials.
- CI already includes a free `gitleaks` secret-scan job; this pass did not add paid tooling.
- Current runbooks were added only for current production surfaces, not future Pro/KYC/Plaid/connector features.

## 13. Verification Results

Passed:

- `pnpm --filter @locateflow/web exec vitest run src/lib/internal-secrets.test.ts src/lib/logger.test.ts src/app/api/webhooks/playstore/route.test.ts`
- `pnpm --filter @locateflow/admin exec vitest run src/lib/internal-secrets.test.ts src/app/api/backup/import/route.test.ts src/app/api/notifications/route.test.ts`
- `git diff --check`

Typecheck status:

- `pnpm --filter @locateflow/web exec tsc --noEmit` fails on existing provider/cron/db typing issues outside the files changed in this pass.
- `pnpm --filter @locateflow/admin exec tsc --noEmit` fails on existing analytics/reports/db typing issues outside the files changed in this pass.
- `pnpm --filter @locateflow/mobile exec tsc --noEmit` fails on existing `app/settings/subscription.tsx` package-selection typing.
- `pnpm verify:typecheck` therefore still fails before all packages can pass.

## 14. Recommended Next Sprint

1. Fix the shared Prisma client/type generation issue so package typecheck can become a reliable gate.
2. Expand admin users/[id] into the account/security support workspace using the same account-security concepts plus admin-only notes/timeline.
3. Decide notification operating model, then either build the worker path or permanently narrow the feature to immediate in-app sends.
4. Add support queue ownership, SLA policy configuration, macros, and case timeline.
5. Add subscription finance/support action workflows with audit logs and approval boundaries.
6. Add provider and state-rule governance workflow: review states, impact drill-down, approvals, and rollback history.
