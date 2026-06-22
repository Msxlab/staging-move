# Adversarial Verification: database-schema-03

**Finding:** GDPR erasure does not purge Lead/LeadDispatch/AddressChangeEvent PII
**Claimed severity:** High · **Category:** Security
**Verdict:** CONFIRMED (with scope correction) · **Adjusted severity:** Medium

## What the code shows

### Lead PII persists after erasure — CONFIRMED
- `packages/db/prisma/schema.prisma:2385-2429` — `model Lead`. `userId String @db.VarChar(30)` (line 2391) is a **loose ref with no `@relation` / no FK**. PII (`contactName`, `contactEmail`, `contactPhone`, `notes`) is written into `payloadEncrypted String @db.Text` (line 2404).
- `apps/web/src/lib/leads/create-lead.ts:70-113` — confirms Lead is actively created with the user's name/email/phone/notes encrypted into `payloadEncrypted`, stamped with `userId: input.userId`. So real per-user PII lands in this table in production (model is in use, not dead code).
- `packages/db/prisma/schema.prisma:49-77` — the `User` model relation list has **no `leads Lead[]` relation**. Therefore `User` delete cannot cascade to `Lead`.
- `apps/web/src/lib/account-deletion.ts:359-371` — the self-service erasure explicitly enumerates the no-FK residue tables it purges: `waitlistSignup.deleteMany` and `notificationQueue.deleteMany`. **`lead.deleteMany` is absent.** `rawPrisma.user.delete` (line 371) then cascades only the FK-linked children.
- `apps/admin/src/lib/hard-delete-user.ts:304-319` — the admin hard-delete path likewise enumerates no-FK residue (`gDPRRequest`, `waitlistSignup`, `notificationQueue`, `emailLog`) and then `tx.user.delete`. **Lead is absent here too.** Comment at line 318 confirms `user.delete` "cascades all remaining direct children" — and Lead is not a direct child.
- `apps/web/src/app/api/cron/data-retention/route.ts:23-182` — the retention cron deletes sessions, userEvents, rateLimitLog, emailLog, notifications, auditLog, adminAuditLog, adminLoginLog, userLoginSession, notificationQueue, and runs `processPendingAccountDeletionRequests`. **No Lead delete and no age-based Lead purge anywhere.**
- `apps/web/src/lib/user-event-retention.ts` — grep for `Lead`/`AddressChangeEvent`: no matches. Not handled there either.
- Repo-wide grep for `lead.deleteMany` / `.lead.delete`: only hits are in `docs/audit/*.md` (the prior auditor's own notes), **never in source**.

Net: after an Art. 17 erasure, the deleted user's encrypted contact PII remains in `Lead.payloadEncrypted` (and the FK-cascaded `LeadDispatch` rows survive with it, since the parent `Lead` is never deleted). The model's own comment (schema.prisma:2389-2390) asserts erasure is "handled... via payloadEncrypted rather than a cascade" — but no code path actually deletes those rows, so the documented intent is not implemented.

### AddressChangeEvent PII persists — REFUTED
- `packages/db/prisma/schema.prisma:2114-2143` — `model AddressChangeEvent`. `userId String` at line 2116 **has `user User @relation(fields: [userId], references: [id], onDelete: Cascade)`** (line 2117), and the `User` model lists `addressChangeEvents AddressChangeEvent[]` (schema.prisma:72).
- Therefore `rawPrisma.user.delete` / `tx.user.delete` **does cascade-delete** AddressChangeEvent rows, including the plaintext `fullName` (line 2129). The claim that `AddressChangeEvent.fullName` survives erasure is **false** — it is the opposite of Lead. The prior finding conflated a true-cascade table with the no-cascade Lead table.

## Why Medium, not High
The core defect (Lead PII surviving erasure) is real and is a genuine GDPR Art. 17 completeness gap. Severity is reduced from High to Medium because:
1. Lead PII is **encrypted at rest** (`payloadEncrypted` via `FIELD_ENCRYPTION_KEY`), so it is not plaintext residue — it is recoverable only with the key, materially lowering exposure vs. the claimed "plaintext full name."
2. One-third of the claimed scope (AddressChangeEvent plaintext fullName) is incorrect — that table cascades correctly, so there is no plaintext-name leak as asserted.
3. The model is gated `offers_moving_quotes_v1` (fail-closed, per schema comment 2384) and CPL billing is not yet live (R5), so production lead volume may be limited — but this does not eliminate the compliance gap.

## Recommendation
Add an explicit `rawPrisma.lead.deleteMany({ where: { userId } })` (LeadDispatch cascades from Lead) to BOTH erasure paths — `apps/web/src/lib/account-deletion.ts` (around line 369-370) and `apps/admin/src/lib/hard-delete-user.ts` (around line 314-316) — mirroring the existing no-FK residue purges. Alternatively, document a lawful retention exception. No change is needed for AddressChangeEvent (already cascaded).

## Related files
- `apps/web/src/lib/account-deletion.ts`
- `apps/admin/src/lib/hard-delete-user.ts`
- `apps/web/src/app/api/cron/data-retention/route.ts`
- `apps/web/src/lib/leads/create-lead.ts`
- `packages/db/prisma/schema.prisma:2385-2429` (Lead), `:2114-2143` (AddressChangeEvent), `:49-77` (User relations)
