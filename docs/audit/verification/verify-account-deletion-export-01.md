# Adversarial Verification: account-deletion-export-01

**Finding:** Self-service Art. 17 erasure does not purge EmailLog (plaintext email survives)
**Verdict:** CONFIRMED
**Adjusted severity:** High (unchanged)

## Task
I was assigned to REFUTE this finding. After reading the cited source code, the
finding is REAL and the evidence holds. I cannot refute it.

## Evidence verified in source

### 1. Self-service path omits EmailLog purge
`apps/web/src/lib/account-deletion.ts` `processAccountDeletionRequest`, the
physical-erasure block (lines 311-372). Before `rawPrisma.user.delete` it purges
only two no-FK residue tables:

- line 365-369: `rawPrisma.waitlistSignup.deleteMany(...)`
- line 370: `rawPrisma.notificationQueue.deleteMany({ where: { userId: request.userId } })`
- line 371: `rawPrisma.user.delete({ where: { id: request.userId } })`

A Grep for `emailLog`/`EmailLog` across the ENTIRE `account-deletion.ts` file
returned **no matches** — EmailLog is never touched on the self-service path.
The in-code comment at lines 359-363 even enumerates the no-FK residue tables it
mirrors from the admin path (WaitlistSignup, NotificationQueue) but omits
EmailLog.

### 2. EmailLog has no User FK and stores plaintext email
`packages/db/prisma/schema.prisma:1564-1589`:
- line 1572: `to String @db.VarChar(191)` — plaintext recipient address.
- Only relation is `template EmailTemplate?` via `templateId` (line 1567). There
  is NO `userId`/User relation. Therefore `user.delete`'s onDelete cascade
  cannot reach EmailLog rows.

`apps/web/src/lib/email-service.ts:217` writes `to: opts.to` — the raw recipient
email (no mask/hash), confirming a deleted user's address is stored verbatim.

### 3. Admin hard-delete path DOES purge it (proving the divergence)
`apps/admin/src/lib/hard-delete-user.ts:316`:
`await tx.emailLog.deleteMany({ where: { to: user.email } });`
with an explicit comment (lines 309-313) that EmailLog "retains the PLAINTEXT
email too." The self-service path mirrors WaitlistSignup + NotificationQueue from
this admin path but drops the EmailLog deletion.

### 4. Only an unrelated time-based sweep eventually removes it
`apps/web/src/app/api/cron/data-retention/route.ts:73-82`: EmailLog rows are
deleted only when older than 180 days (matched by `sentAt`/`createdAt`), NOT by
user identity at erasure time. So a freshly-deleted user's plaintext email
persists for up to 180 days after a confirmed Art. 17 erasure.

## Why not refuted
There is no compensating purge of EmailLog reachable from the self-service
deletion flow. The cascade cannot touch it (no FK). The retention cron is purely
age-based. The admin path's explicit deletion makes the omission a clear,
intentional-on-admin / missing-on-self-service inconsistency.

## Impact
A self-service (GDPR Art. 17 / CCPA) erasure leaves the deleted user's plaintext
email address in EmailLog until the unrelated 180-day retention sweep removes it,
making the self-service right-to-erasure incomplete and inconsistent with the
admin hard-delete path.

## Recommendation
In `processAccountDeletionRequest`, before `rawPrisma.user.delete`, add a
purge mirroring the admin path:
`rawPrisma.emailLog.deleteMany({ where: { to: deletedUserEmail } })`
(reusing the already-computed `deletedUserEmail` at line 364), guarded for a
non-null email.

## Severity assessment
High is appropriate and unchanged. It is a genuine erasure-completeness /
regulatory gap (plaintext PII survives a confirmed deletion), but it is bounded
(auto-purged at 180 days) and not directly exploitable, so it does not rise to
Critical.

## Related files
- apps/web/src/lib/account-deletion.ts:311-371
- apps/admin/src/lib/hard-delete-user.ts:309-316
- packages/db/prisma/schema.prisma:1564-1589
- apps/web/src/lib/email-service.ts:213-222
- apps/web/src/app/api/cron/data-retention/route.ts:69-82
