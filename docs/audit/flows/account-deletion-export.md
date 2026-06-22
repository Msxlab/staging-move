# Flow Audit: Account Deletion / Data Export (CCPA)

Area slug: `account-deletion-export`
Scope: end-to-end self-service account deletion (GDPR Art. 17 erasure) and data export (GDPR Art. 15 / CCPA access + "Do Not Sell/Share" opt-out), web + mobile, across UI -> API -> DB -> side effects.

All evidence is from source code. Doc/README claims are not cited as proof.

---

## 1. Flow Summary & actors

Actors:
- Authenticated end user (web `DeleteAccountDialog`, mobile `delete-account.tsx`; export pages web/mobile).
- Locked-out user clicking the emailed "restore" link (grace-window deletions only).
- Data-retention cron (`/api/cron/data-retention`) which drives the physical purge.
- Admin operator (separate hard-delete path, used here only for parity comparison).

Two distinct sub-flows:

A. Deletion (GDPR Art. 17)
- `POST /api/account/delete` (`apps/web/src/app/api/account/delete/route.ts`).
- Auth: `requireDbUserId({ distinguishDeleted: true })` -> rate limit `account_delete` -> step-up (`verifyUserStepUp`) -> create/find `GDPRRequest(type=DELETE)`.
- If `ACCOUNT_DELETION_GRACE_DAYS > 0`: soft-delete now (`deletedAt`), pause Stripe (`cancel_at_period_end`), kill sessions, set `scheduledPurgeAt`, email restore link, return 202 `SCHEDULED`. Physical purge deferred to cron.
- If grace = 0 (default): `processAccountDeletionRequest` runs the physical erasure inline.
- Cron `data-retention` calls `processPendingAccountDeletionRequests(25)` each run to advance PENDING/PROCESSING requests and finish grace-window purges.
- Restore: `GET /api/account/restore?token=...` -> `restoreAccountFromDeletion` (HMAC token bound to `userId:requestId`).

B. Export (GDPR Art. 15 / CCPA access)
- `POST /api/export` (JSON/CSV) and `POST /api/export/pdf` (PDF). Both require `requireDbUserId` -> rate limit -> step-up. Synchronous download; no async job, no persisted DSAR record.
- CCPA "Do Not Sell/Share": `POST /api/consent/ccpa` records opt-out (cookie + `DataConsent` row, category `DO_NOT_SELL`). Resolver `hasCcpaOptOut` in `apps/web/src/lib/ccpa.ts`.

---

## 2. Step-by-step trace

### Deletion (immediate, grace = 0)

1. Trigger: user opens `DeleteAccountDialog` (`apps/web/src/components/settings/delete-account-dialog.tsx`), types `DELETE`/`ELIMINAR`/email, supplies password (if `hasPasswordLogin`) or MFA code; OAuth-only accounts send `confirmAccountDeletion: true`.
2. Client `POST /api/account/delete` with `{ confirmText, confirmPassword?, mfaCode?, confirmAccountDeletion? }`.
3. Route: `requireDbUserId({ distinguishDeleted: true })`; emits `ACCOUNT_DELETE_ATTEMPT` security event (always, pre-rate-limit); `enforceRateLimitPolicy(account_delete)`.
4. `prisma.user.findUnique` (soft-delete-filtered) -> 404 if not found.
5. Confirmation gate: `isAccountDeletionConfirmationValid` is checked ONLY when `wantsOAuthOnlyAccountDeletion === true` (route.ts:66-86). For password/MFA accounts the typed-DELETE intent is NOT re-validated server-side (see finding -03).
6. Step-up: `verifyUserStepUp` (`apps/web/src/lib/user-step-up.ts`). MFA-enabled users MUST pass TOTP/backup-code; password alone is rejected. OAuth-only (no password, no MFA) bypass allowed only with `confirmAccountDeletion`.
7. `getActiveAccountDeletionRequest` (PENDING/PROCESSING) reused if present; else `createAccountDeletionRequest` (+ `ACCOUNT_DELETE` audit log). No DB uniqueness guard on active DELETE requests (see finding -05).
8. `processAccountDeletionRequest` (`apps/web/src/lib/account-deletion.ts:199`):
   - Loads user via `rawPrisma` (so a grace-soft-deleted user is still found).
   - Cancels Stripe sub (idempotent: treats `resource_missing`/"already canceled" as success). On other failures retries up to `ACCOUNT_DELETION_MAX_STRIPE_ATTEMPTS=5`, then force-erases and alerts ops (Art. 17 never blocked by billing).
   - `destroyAllUserSessions`.
   - Owned-workspace heir transfer (`pickOwnershipHeir`/`transferWorkspaceOwnership`, any role) vs solo hard-delete.
   - `rawPrisma.movingPlan.deleteMany` (own + solo-workspace plans) BEFORE deleting solo workspaces (FK 1451 guard).
   - `rawPrisma.waitlistSignup.deleteMany` (by userId OR email) + `rawPrisma.notificationQueue.deleteMany` (by userId).
   - `rawPrisma.user.delete` -> cascades all `onDelete: Cascade` children (sessions, oauth, profile, addresses, services, budgets, consents, notifications, support tickets, push devices, events, memberships, etc.).
   - Marks `GDPRRequest` COMPLETED and scrubs residual PII (`email`, `stripeSubscriptionId`) from `requestData` (kept as proof of erasure).
9. Side effects: `sendSecurityNoticeEmail` (account-deletion-requested) on first request only; audit `ACCOUNT_DEL_PROC`. Client then `POST /api/auth/logout` and redirects to `/`.

### Deletion (grace window)

- `scheduleAccountDeletionWithGrace` soft-deletes (`deletedAt`), `stripe.subscriptions.update(cancel_at_period_end:true)`, kills sessions, stores `scheduledPurgeAt`. Idempotent: re-request keeps the original window.
- Cron `processPendingAccountDeletionRequests` re-invokes `processAccountDeletionRequest`; while `Date.now() < scheduledPurgeAt` it returns `SCHEDULED` (no erasure). After window, physical purge runs.
- Restore: `restoreAccountFromDeletion` verifies HMAC token, clears `deletedAt`, resumes Stripe, sets request REJECTED. Blocked once `status=COMPLETED` (`already_purged`) or window elapsed.

### Export

- `POST /api/export`: validates `type` against `ALLOWED_TYPES`, `format` against `ALLOWED_FORMATS`; step-up; `tax` type gated on `planFeatures().advancedExport`. Queries are all `where: { userId, ... }` (own-data only). Sensitive fields masked (`accountNumber`, `phone`, `email`, `username`); encrypted `notes` only decrypted with `includeNotes=true`. CSV formula-injection guard (`safeCsvValue`).
- `POST /api/export/pdf`: same auth/step-up/rate-limit; address/full/tax PDFs scoped to `userId`.
- No `GDPRRequest` row is created for exports (see finding -06).

### Cache invalidation

- No HTTP cache is involved in deletion (mutation). Export responses set `Content-Disposition` attachment; PDF route sets `Cache-Control: private, no-store`. The JSON/CSV export route does NOT set `no-store` (finding -07, Low).
- "Cache" of identity is the session table; `destroyAllUserSessions` + soft-delete `deletedAt` invalidate live sessions (`getUserSession` rejects `user.deletedAt`).

---

## 3. Happy-path correctness

- Deletion happy path is correct and notably careful: FK ordering (MovingPlan before Workspace), heir transfer to preserve shared-workspace data, Stripe idempotency, force-erase so Art. 17 cannot be wedged by a failing billing call, residual-PII scrub on the retained `GDPRRequest`. Verified by `apps/web/src/lib/account-deletion.test.ts`.
- Grace/restore happy path is correct and reversible; HMAC token is request-bound and timing-safe.
- Export happy path returns only the caller's own rows, masks sensitive fields, and gates the Pro tax report.

---

## 4. Edge cases & reverse-logic

- Auth/role: all entry points require an authenticated DB user; export/delete additionally require step-up. Soft-deleted (grace) users are rejected by `requireDbUserId` (no `distinguishDeleted` on export) so they cannot export during the grace window — correct.
- Empty/invalid input: export coerces unknown `type`->`full`, unknown `format`->`json` (safe defaults). Delete `confirmText` validated client-side always, server-side only for OAuth-only path.
- Network failure: Stripe failures are retried across cron runs and ultimately force-erased; logged without leaking the secret (test-asserted).
- Double-submit / idempotency: delete reuses an existing active request and suppresses duplicate email. BUT no DB-level uniqueness on active DELETE `GDPRRequest`, so two concurrent first-time requests can both pass `getActiveAccountDeletionRequest==null` and create two rows (finding -05).
- Token expiry: restore token has no time bound of its own; expiry is enforced via `scheduledPurgeAt` and request status. Acceptable.
- Partial failure: deletion is NOT transactional (sequential `rawPrisma` calls). A crash between `movingPlan.deleteMany`/`workspace.delete`/`user.delete` leaves partial state; the request stays PROCESSING and the cron retries. Self-heals on retry but is not atomic, unlike the admin path which wraps everything in `$transaction` (finding -02 context).
- Stale data: client redirects to `/` after logout; no stale authenticated view.
- Direct deep-link: `/api/account/restore` is intentionally auth-less (token is proof of intent) and idempotent — acceptable, matches unsubscribe/verify-email pattern.

---

## 5. Security review of the flow

- Authz at each step: deletion and export both require session + step-up; MFA users cannot downgrade to password-only step-up (`user-step-up.ts:52-59`). Good.
- IDOR / workspace scoping: export queries are uniformly `where: { userId }`; PDF address lookup is `findFirst({ id, userId, deletedAt: null })`. No cross-user leakage observed. Workspace export masks other members' emails and excludes their PII.
- Validation: export type/format allowlists; CCPA body zod-validated; CSV formula-injection guarded.
- Rate limiting: `account_delete`, `export_data`, `export_pdf` all have enforce-mode policies with hard-lockout thresholds; MFA sub-attempts on delete are separately limited.
- Secrets/PII: Stripe secret never logged (test-asserted). Residual PII scrubbed from retained `GDPRRequest`. HOWEVER the self-service erasure does NOT purge `EmailLog` (plaintext recipient email, no User FK) — the admin path does (finding -01, High). CCPA opt-out resolver is never enforced by any sell/share surface (finding -04, High).

---

## 6. Reliability

- Retry: cron-driven retry for deletion; Stripe retries bounded then force-erase. Good.
- Transaction consistency: self-service deletion is non-atomic multi-statement (finding -02 is the EmailLog gap; the atomicity difference vs admin path is noted as Low context, not separately filed because the cron retry self-heals).
- Partial-failure recovery: PROCESSING requests are re-driven by `processPendingAccountDeletionRequests`. `userDeleted`/`stripeCanceled` flags persisted in `requestData` make retries resumable.
- Loading/empty/error UX: web/mobile dialogs handle submitting state, STEP_UP_REQUIRED re-prompt (web delete), and error toasts. Web export page is missing an MFA input for MFA-enabled users (finding -03b / -08).

---

## 7. Cross-module impact

- Auth/session (`user-auth.ts`): `deletedAt` + session destroy gate all access.
- Billing (Stripe): cancel on erasure, pause/resume on grace/restore.
- Workspaces: ownership heir transfer preserves shared data; solo workspaces hard-deleted.
- Notifications/email: inherited-owner notice; deletion-requested security email; queued notifications purged.
- Analytics/audit: `UserEvent` cascades with the user (erased); `AuditLog` (no FK) retained 365d by retention cron; `GDPRRequest` retained as proof.
- CCPA sharing surfaces (affiliate/sponsored/lead-dispatch/partner-consents): currently do NOT consult the opt-out resolver.

---

## 8. Findings Summary

| ID | Severity | Category | Finding | Impact | Recommendation | Files |
|----|----------|----------|---------|--------|----------------|-------|
| account-deletion-export-01 | High | Data | Self-service Art. 17 erasure does not purge `EmailLog` (plaintext `to` email, no User FK). Admin path purges it. | Deleted user's plaintext email survives erasure in `EmailLog` indefinitely (until 180d retention sweep) — incomplete GDPR/CCPA erasure. | Add `rawPrisma.emailLog.deleteMany({ where: { to: deletedUserEmail } })` to `processAccountDeletionRequest`, mirroring `hard-delete-user.ts:316`. | apps/web/src/lib/account-deletion.ts:364-371; apps/admin/src/lib/hard-delete-user.ts:309-316; packages/db/prisma/schema.prisma:1564-1585 |
| account-deletion-export-04 | High | Security | CCPA "Do Not Sell/Share" opt-out (`hasCcpaOptOut`/`hasCcpaOptOutServer`) is defined but never called by any sell/share surface (affiliate/sponsored/lead-dispatch/partner-consents). | Opt-out is recorded but never enforced; data may still be shared after a consumer opts out — CPRA non-compliance and dead enforcement code. | Call `hasCcpaOptOut()` in every data-sharing path before transfer, or document why each surface is exempt. | apps/web/src/lib/ccpa.ts:32-68; apps/web/src/app/api/affiliate/click/route.ts; apps/web/src/app/api/sponsored/click/route.ts; apps/web/src/app/api/cron/lead-dispatch/route.ts |
| account-deletion-export-08 | Medium | UI/UX | Web export page (`settings/export`) has only a password field; no MFA/backup-code input. MFA-enabled users get `STEP_UP_REQUIRED` and cannot export. | MFA users on web are blocked from GDPR/CCPA data export. Mobile handles this; web does not. | Add an MFA/backup-code input to the web export page like the delete dialog and mobile export screen. | apps/web/src/app/(app)/settings/export/page.tsx:175-197,401-413; apps/web/src/lib/user-step-up.ts:61-90; apps/mobile/app/settings/export.tsx:67-101 |
| account-deletion-export-05 | Medium | Reliability | No DB uniqueness on active DELETE `GDPRRequest`; concurrent first-time delete requests can create duplicate rows. | Duplicate deletion requests/emails; redundant cron processing. Low data-integrity risk (idempotent erasure) but messy. | Add a partial-unique guard or `upsert`/transaction around `getActiveAccountDeletionRequest` + `create`. | apps/web/src/lib/account-deletion.ts:158-197; apps/web/src/app/api/account/delete/route.ts:140-159; packages/db/prisma/schema.prisma:1702-1717 |
| account-deletion-export-03 | Medium | Logic | Typed-DELETE intent gate is enforced server-side only for the OAuth-only path; password/MFA accounts' `confirmText` is never validated on the server. | Server trusts the client for the intent gate on password/MFA accounts; a non-UI client can delete with only a valid password/MFA and no typed confirmation (defense-in-depth weakness, not an authz bypass). | Validate `confirmText` server-side for all paths (the function already exists). | apps/web/src/app/api/account/delete/route.ts:19-25,66-86 |
| account-deletion-export-06 | Low | Data | Data exports (Art. 15 access requests) create no `GDPRRequest`/DSAR fulfillment record; only per-call AuditLog rows (purged at 365d). | Weaker long-term DSAR fulfillment trail for access requests vs deletion requests. | Optionally record an EXPORT-type `GDPRRequest` (or equivalent) on successful export for compliance traceability. | apps/web/src/app/api/export/route.ts:146-153,593-606; apps/web/src/lib/account-deletion.ts:169-197 |
| account-deletion-export-07 | Low | Security | JSON/CSV export responses lack `Cache-Control: private, no-store` (PDF route sets it). | Exported PII (addresses, services, masked PII) may be cached by intermediaries/browser disk cache. | Add `Cache-Control: private, no-store` to the JSON/CSV export responses as the PDF route does. | apps/web/src/app/api/export/route.ts:661-723; apps/web/src/app/api/export/pdf/route.ts:224-233 |
| account-deletion-export-09 | Info | Architecture | Self-service deletion is non-transactional sequential `rawPrisma` calls; admin path uses `$transaction`. Cron retry self-heals partial failures. | A mid-sequence crash leaves partial state until the next cron run. No data corruption observed; just non-atomic. | Consider wrapping the erasure in `$transaction` to match the admin path. | apps/web/src/lib/account-deletion.ts:311-378; apps/admin/src/lib/hard-delete-user.ts:247-320 |

---

## 9. Flow TODO

1. Purge `EmailLog` (and re-verify all no-FK PII tables) in `processAccountDeletionRequest` to match the admin hard-delete completeness (-01).
2. Wire `hasCcpaOptOut` into every sell/share surface, or formally document exemptions (-04).
3. Add MFA/backup-code input to the web export page (-08).
4. Guard against duplicate active DELETE requests (-05).
5. Enforce the typed-DELETE intent gate server-side for all account types (-03).
6. Add `no-store` to JSON/CSV export responses (-07); consider a persisted DSAR record for exports (-06); consider transactional erasure (-09).
