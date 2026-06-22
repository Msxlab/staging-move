# Module Audit: Privacy, Export, Account Deletion

Status: source-backed privacy/export/deletion matrix added; full model-by-model policy table still required.

## Source Inspected

- Prisma privacy/consent-related model references.
- Web self-service account deletion, account restore, data retention cron, export, PDF export, consent, and CCPA routes.
- Web account deletion helper and tests.
- Admin hard-delete/OTP routes, hard-delete helper, privacy helper, and tests.
- Tracking event route.

## Verified Facts

- `DataConsent`, `PartnerConsent`, `GDPRRequest`, and `UserEvent` models exist.
- Tracking route stores serialized metadata.
- Account deletion requires user auth, rate limiting, confirmation phrase handling, server-side step-up, audit, grace-window restore token, and retention cron purge.
- User export/PDF export require POST, user auth, rate limiting, server-side step-up, deleted-row filters, masking, and audit.
- Consent writes are append-only; sensitive consent withdrawal clears stored profile sensitive fields in the same transaction.
- CCPA opt-out supports logged-in `DataConsent` persistence and anonymous secure root-scoped cookie persistence.
- Admin hard delete requires SUPER_ADMIN permission, password/MFA step-up, target-bound OTP, audit, and Stripe cancel-before-DB-delete behavior.

Evidence:

- `packages/db/prisma/schema.prisma:201`
- `packages/db/prisma/schema.prisma:1190`
- `packages/db/prisma/schema.prisma:1702`
- `packages/db/prisma/schema.prisma:2000`
- `apps/web/src/app/api/tracking/event/route.ts:105`
- `apps/web/src/app/api/tracking/event/route.ts:156`
- `docs/audit/reports/privacy-export-deletion-matrix.md`

## Findings

- `PRIV-TRACK-001`

## Not Verified In Code

- Full model-by-model export/delete retention table for every Prisma model.
- Treatment of backups, partner leads, connector dispatches, and analytics during deletion/export against final legal/product policy.
- Legal retention policy encoded in code.

## Next Steps

- Use `docs/audit/reports/privacy-export-deletion-matrix.md` as the starting evidence table.
- Build a generated model-by-model export/delete matrix and policy test.
- Verify connector dispatch, partner leads, mover documents, and backup records against final export/delete policy.
