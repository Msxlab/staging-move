# Privacy, Export, And Account Deletion Matrix

Date: 2026-06-22
Scope: self-service account deletion, account restore, data retention cron, user export/PDF export, consent/CCPA routes, admin hard delete, and related tests/helpers.

This is a source-backed matrix pass. No production data, customer PII, `.env`, secrets, live billing/store/provider credentials, migrations, deploys, or destructive DB commands were used.

## Method

Inspected source routes, helper files, Prisma schema, and route/helper tests with targeted searches.

## Self-Service Deletion And Restore

| Route/helper | Methods or symbol | Boundary observed | Important controls | Status |
| --- | --- | --- | --- | --- |
| `apps/web/src/app/api/account/delete/route.ts` | POST | `requireDbUserId({ distinguishDeleted: true })` at line 30 | user-scoped rate limit at lines 41-43; delete confirmation phrase path at lines 76 and 93-101; server-side step-up at lines 114-125; audit at lines 141-149 and 201-224; restore token generation at lines 166-167 | No bypass verified |
| `apps/web/src/lib/account-deletion.ts` | `processAccountDeletionRequest` | source helper | grace-window deferral at lines 211-213; raw client used for physical delete at lines 316-318; moving plan purge at line 344; waitlist and notification queue purge at lines 365-370; user hard delete at line 371; retained GDPR request cleanup of sensitive payload at line 384 | No bypass verified |
| `apps/web/src/lib/account-deletion.ts` | `scheduleAccountDeletionWithGrace` | source helper | Stripe renewal pause at line 463; immediate soft-delete lockout at lines 478-481; sessions destroyed in tests | No bypass verified |
| `apps/web/src/lib/account-deletion.ts` | `restoreAccountFromDeletion` | source helper | HMAC restore token verified at lines 501-505; completed/purged requests rejected at lines 512 and 525; soft-delete cleared at line 527; Stripe renewal resume error is logged at line 539 | No bypass verified |
| `apps/web/src/app/api/account/restore/route.ts` | GET | public restore link route | signed token is the proof of intent per route comment at lines 7-16; route calls `restoreAccountFromDeletion` at line 22 and redirects to sign-in status at lines 28-29 | No bypass verified |
| `apps/web/src/app/api/cron/data-retention/route.ts` | GET, POST | `guardCronRequest` at line 26 | low cron rate limit at lines 24-26; purges sessions/events/rate logs/email logs/notifications/audit logs with bounded windows at lines 35-163; user event dry-run support at lines 43-55 | No bypass verified |

Related test evidence:

- `apps/web/src/app/api/account/delete/route.test.ts:113-126` blocks deletion without server-side step-up.
- `apps/web/src/app/api/account/delete/route.test.ts:129-153` creates and processes a deletion request after valid step-up.
- `apps/web/src/app/api/account/delete/route.test.ts:190-207` applies a user-scoped cooldown.
- `apps/web/src/lib/account-deletion.test.ts:144-152` cancels Stripe and deletes moving plans before hard-deleting the user.
- `apps/web/src/lib/account-deletion.test.ts:198-220` force-completes erasure after repeated Stripe cancellation failure.
- `apps/web/src/lib/account-deletion.test.ts:243-260` defers physical purge during the grace window.
- `apps/web/src/lib/account-deletion.test.ts:275-302` restores a grace-deleted account with a valid token and rejects forged tokens.

## User Export

| Route | Methods | Boundary observed | Important controls | Status |
| --- | --- | --- | --- | --- |
| `apps/web/src/app/api/export/route.ts` | GET | explicit denial | GET returns "Use POST with step-up verification" at lines 23-27 | Expected |
| `apps/web/src/app/api/export/route.ts` | POST | `requireDbUserId` at line 58 | rate limit at lines 68-72; user step-up at lines 94-118; Pro-gated reports separated from GDPR dump at line 122; sensitive service fields masked at lines 156-180; deleted rows filtered at lines 191, 210, 236, 270, 286, and 297; workspace context included with invitation emails masked at lines 514-574; export audit at lines 596-604 | No bypass verified |
| `apps/web/src/app/api/export/pdf/route.ts` | GET | explicit denial | GET requires POST with step-up at lines 41-44 | Expected |
| `apps/web/src/app/api/export/pdf/route.ts` | POST | `requireDbUserId` at line 54 | rate-limit/audit on denial at lines 76-83; step-up at lines 98-121; successful export audit at lines 134-163; safe content-disposition at line 229; deleted rows filtered at lines 242, 313, and 340 | No bypass verified |

Related test evidence:

- `apps/web/src/app/api/export/route.test.ts:148-176` masks sensitive service fields.
- `apps/web/src/app/api/export/route.test.ts:259-285` prefixes dangerous CSV values to prevent formula injection.
- `apps/web/src/app/api/export/route.test.ts:366-390` does not gate data export on subscription state.
- `apps/web/src/app/api/export/route.test.ts:394-415` excludes soft-deleted user data.
- `apps/web/src/app/api/export/route.test.ts:415-428` requires server-side step-up before data access.
- `apps/web/src/app/api/export/route.test.ts:434-450` applies export cooldown.
- `apps/web/src/app/api/export/route.test.ts:453-462` blocks Pro tax export for non-Pro before touching data.

## Consent And CCPA

| Route | Methods | Boundary observed | Important controls | Status |
| --- | --- | --- | --- | --- |
| `apps/web/src/app/api/consent/route.ts` | GET, POST | `requireDbUserId` at lines 48 and 87 | append-only consent history at lines 100-108; CCPA default and semantics documented at lines 12-16 and 60-61; sensitive consent withdrawal clears stored profile sensitive fields in same transaction at lines 115-137 | No bypass verified |
| `apps/web/src/app/api/consent/ccpa/route.ts` | GET, POST | optional `getUserSession` at lines 52 and 91 | logged-in users persist opt-out to `DataConsent` at lines 98-100; anonymous users get root-scoped cookie at lines 107-119; route comments document 1-year secure httpOnly cookie behavior at lines 24-27 | No bypass verified |

Related test evidence:

- `apps/web/src/app/api/consent/ccpa/route.test.ts:54-64` mirrors anonymous opt-out into a secure root-scoped cookie.
- `apps/web/src/app/api/consent/ccpa/route.test.ts:67-77` clears the same cookie when revoked.
- `apps/web/src/app/api/consent/route.test.ts:49-64` clears stored sensitive profile fields in the same transaction when sensitive consent is withdrawn.

## Admin Hard Delete

| Route/helper | Methods or symbol | Boundary observed | Important controls | Status |
| --- | --- | --- | --- | --- |
| `apps/admin/src/app/api/users/[id]/hard-delete/otp/route.ts` | POST | `requirePermission("users", "canDelete", { minimumRole: "SUPER_ADMIN" })` at line 34 | password/MFA step-up at lines 50-53; target email is masked before OTP email at line 131; OTP is never returned at lines 154-156 | No bypass verified |
| `apps/admin/src/app/api/users/[id]/hard-delete/route.ts` | POST | `requirePermission("users", "canDelete", { minimumRole: "SUPER_ADMIN" })` at line 37 | password/MFA step-up at lines 60-63; 6-digit target-bound OTP validation at lines 93-138; OTP attempts/consume race guards at lines 147-194; hard delete call at line 204; blocked Stripe cancel path audits and alerts at lines 221-249 | No bypass verified |
| `apps/admin/src/lib/hard-delete-user.ts` | `hardDeleteUser` | caller must authorize per lines 12-13 | Stripe cancel before DB erasure at lines 221-226; blocked delete if live subscription cancel fails at lines 124-133; moving plan purge at line 279; workspace transfer/delete at lines 286-300; GDPR, waitlist, notification queue, email log purge at lines 306-316; final user delete at line 319 | No bypass verified |

Related test evidence:

- `apps/admin/src/app/api/users/[id]/hard-delete/otp/route.test.ts:69-83` sends OTP to the acting admin, not target user, and stores an HMAC hash.
- `apps/admin/src/app/api/users/[id]/hard-delete/route.test.ts:99-127` blocks and alerts when Stripe cancel fails.
- `apps/admin/src/lib/hard-delete-user.test.ts:63-84` cancels Stripe before DB erasure and blocks when cancel fails.
- `apps/admin/src/lib/hard-delete-user.test.ts:100-111` treats missing/invalid Stripe key as fail-closed for hard delete.

## Findings

No new account deletion, export, consent, or admin hard-delete bypass was verified in this pass.

Existing related finding remains:

- `PRIV-TRACK-001`: analytics metadata sanitizer can miss sensitive data under benign keys.

## Not Verified In Code

- Full model-by-model export/delete table for every Prisma model.
- Legal retention policy for backups, audit logs, and billing records beyond the route/helper behavior above.
- Whether connector dispatch payloads and confirmations are included in export/delete flows according to final policy.
- Live runtime data retention configuration values.

## Recommended Next Tests

- Add a generated model-by-model coverage test comparing Prisma models against export/delete retention decisions.
- Add deletion/export tests for connector dispatch, address-change events, partner leads, mover documents, and backup records where policy requires inclusion or exclusion.
- Add retention tests proving `UserEvent` dry-run cannot accidentally become destructive without explicit runtime config.
