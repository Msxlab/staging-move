# Module Audit: Admin Panel

Status: scanned; backup/import and hard-delete deep dives now have source-backed matrices; full permission matrix still required.

## Source Inspected

- `apps/admin/src/middleware.ts`
- `apps/admin/src/lib/auth.ts`
- Admin backup create, verify, import, download, SQL dump, retention, and cron backup routes.
- Admin hard-delete and hard-delete OTP routes.
- Admin backup policy/storage/restore guard/table catalog helpers and tests.
- sampled admin API route references through `rg`
- CI/deploy config relevant to admin checks

## Verified Facts

- Admin middleware centralizes public paths, CSRF, HSTS, rate limiting, body limits, session checks, MFA, and password-rotation behavior.
- Admin route helpers provide role, permission, and password-confirm controls.
- Backup create/download/SQL dump/import routes use SUPER_ADMIN/admin permission boundaries, password/MFA step-up, audit, size caps, crypto/signature/offsite policies, restore locks, target-environment guards, and safety backup controls.
- Admin hard delete uses SUPER_ADMIN, password/MFA step-up, target-bound OTP, audit, and billing-cancel-before-DB-delete behavior.

Evidence:

- `apps/admin/src/middleware.ts:24`
- `apps/admin/src/middleware.ts:253`
- `apps/admin/src/middleware.ts:327`
- `apps/admin/src/middleware.ts:355`
- `apps/admin/src/middleware.ts:554`
- `apps/admin/src/lib/auth.ts:316`
- `apps/admin/src/lib/auth.ts:347`
- `apps/admin/src/lib/auth.ts:491`
- `apps/admin/src/lib/auth.ts:652`
- `docs/audit/reports/admin-backup-import-matrix.md`
- `docs/audit/reports/privacy-export-deletion-matrix.md`

## Findings

No unauthenticated admin mutation was verified in this pass.

## Not Verified In Code

- Complete route-by-route admin permission matrix.
- All destructive route step-up behavior.
- Live backup restore drill on a disposable database.
- Permission-denied UX and audit-log completeness.

## Next Steps

- Produce admin API matrix with role, permission, mutation type, and step-up requirement.
- Use `docs/audit/reports/admin-backup-import-matrix.md` for backup/import follow-up.
