# Admin Backup And Import Matrix

Date: 2026-06-22
Scope: admin backup create, cron backup, backup verify, backup import/restore, backup download, SQL dump, retention cleanup, and supporting backup helpers/tests.

This is a source-backed matrix pass. No backup was created, downloaded, imported, restored, or deleted. No production data, `.env`, secrets, credentials, migrations, deploys, package installs, or destructive DB commands were used.

## Method

Inspected admin backup routes, backup helper files, policy files, storage/delete guards, restore guard, table catalog, and related tests with targeted source searches.

## Backup Routes

| Route/helper | Methods or symbol | Boundary observed | Important controls | Status |
| --- | --- | --- | --- | --- |
| `apps/admin/src/app/api/backup/route.ts` | GET | `requirePermission("settings", "canRead", ...)` at lines 78-80 | backup list read, audit writes at lines 161 and 170 | No bypass verified |
| `apps/admin/src/app/api/backup/route.ts` | POST | `requirePermission("settings", "canCreate", ...)` at line 195 | password/MFA step-up at lines 208-209; calls `createBackupJob` at line 235; audit failure/success paths at lines 217, 242, and 283 | No bypass verified |
| `apps/admin/src/app/api/cron/backup/route.ts` | POST | `verifyInternalAuth(..., "backup")` at line 54 | DB-backed backup lock at line 77; crypto required at line 88; encrypted/signed archive at lines 161-163; archive protection at line 163; offsite upload at line 196; offsite retention required at line 201; audit at lines 331-345 | No bypass verified |
| `apps/admin/src/app/api/backup/verify/route.ts` | POST | `requirePermission("settings", "canRead", { minimumRole: "ADMIN" })` at line 61 | request size cap at lines 62-68; archive parse at line 77; decrypt attempts at lines 97 and 138; signature verification at line 192; table stats at lines 222-248; audit at lines 350 and 383 | No bypass verified |
| `apps/admin/src/app/api/backup/[id]/download/route.ts` | GET | GET rejected with password-required response at lines 17-20 | download requires POST | Expected |
| `apps/admin/src/app/api/backup/[id]/download/route.ts` | POST | `requirePermission("settings", "canRead", { minimumRole: "SUPER_ADMIN" })` at line 36 | password/MFA step-up at lines 40-44; size cap at lines 74-88 and 121-132; offsite availability/key validation at lines 93-112; safe content-disposition at line 154; audit at lines 137-146 and 160-163 | No bypass verified |
| `apps/admin/src/app/api/backup/sql-dump/route.ts` | POST | `requirePermission("settings", "canCreate", { minimumRole: "SUPER_ADMIN" })` at line 287 | password/MFA step-up at lines 291-292; database URL parser at lines 56-62; `--single-transaction` at lines 324-329; `mysqldump` spawn at line 344; fallback method tracked at lines 358 and 368; stderr redaction at lines 217 and 427; safe content-disposition at line 450 | No bypass verified |
| `apps/admin/src/app/api/backup/retention/route.ts` | POST | cron via `verifyInternalAuth(..., "backup")` at line 161 or manual permission at line 163 | manual password/MFA step-up at lines 175-179; offsite delete dry-run/default-disabled posture at lines 228 and 309-315; exact offsite delete helper at lines 105-116; audit at lines 333-335 | No bypass verified |

## Import And Restore

| Route/helper | Methods or symbol | Boundary observed | Important controls | Status |
| --- | --- | --- | --- | --- |
| `apps/admin/src/app/api/backup/import/route.ts` | POST | `requirePermission("settings", "canUpdate", ...)` at line 562 | request size guard at lines 566-575; password/MFA step-up at lines 589-607; valid modes only at lines 637-647; REPLACE requires signature at lines 652-664; MERGE/REPLACE require signature and raw content at lines 669-681; signature verification at line 688 | No bypass verified |
| `apps/admin/src/app/api/backup/import/route.ts` | `assertRestoreTargetAllowed` call | source route | restore target guard at lines 709-721; unsafe REPLACE table guard at lines 736-750; restore lock at lines 773-806; pre-restore safety backup at lines 810-843 | No bypass verified |
| `apps/admin/src/app/api/backup/import/route.ts` | DRY_RUN | source route | dry-run returns without mutation at lines 852-915 | No bypass verified |
| `apps/admin/src/app/api/backup/import/route.ts` | REPLACE | source route | uses raw client for real delete semantics at lines 921-927; transaction failure reports rollback at lines 961-979 | No bypass verified |
| `apps/admin/src/app/api/backup/import/route.ts` | MERGE | source route | soft-deleted row collision comments at lines 987-992; single-record failure aborts whole MERGE at lines 1024-1033; transaction failure reports rollback at lines 1043-1062 | No bypass verified |
| `apps/admin/src/lib/backup-restore-guard.ts` | `assertRestoreTargetAllowed` | source helper | target environment must match at lines 55-74; REPLACE requires explicit phrase at lines 158-161; production REPLACE requires flag and production confirmation at lines 171-179 | No bypass verified |
| `apps/admin/src/lib/backup-lock.ts` | backup/restore locks | source helper | lock helpers redact errors at lines 183 and 206 | No bypass verified |

## Backup Catalog And Storage Safety

| Area | Evidence | Notes |
| --- | --- | --- |
| Table fetch ceiling | `apps/admin/src/lib/backup-tables.ts:16`, `apps/admin/src/lib/backup-tables.ts:48-77` | per-table cap is 500,000 and truncation is surfaced. |
| Table catalog | `apps/admin/src/lib/backup-tables.ts:80`, `apps/admin/src/lib/backup-tables.ts:418-427` | supported table list is centralized and normalized. |
| Replace safety | `apps/admin/src/lib/backup-tables.ts:454-455` | selected REPLACE tables are checked for dependency issues. |
| Crypto policy | `apps/admin/src/lib/backup-policy.ts:26-29`, `apps/admin/src/lib/backup-policy.ts:57-80` | archive/import/verify/download size limits and crypto/offsite requirements are centralized. |
| Audit redaction | `apps/admin/src/lib/backup-audit.ts:95-119`, `apps/admin/src/lib/backup-audit.ts:139` | backup audit metadata and errors are redacted before persistence. |
| Offsite delete guard | `apps/admin/src/lib/backup-storage.ts:257`, `apps/admin/src/lib/backup-storage.ts:587-618` | retention delete refuses missing/out-of-prefix/wrong-record object keys and skips when storage is not configured. |

Related test evidence:

- `apps/admin/src/app/api/backup/route.test.ts:128-147` blocks backup creation when caller lacks SUPER_ADMIN-level permission.
- `apps/admin/src/app/api/backup/route.test.ts:150-179` requires MFA step-up before full backup creation.
- `apps/admin/src/app/api/backup/route.test.ts:200-219` fails closed in production when encryption key is missing.
- `apps/admin/src/app/api/backup/route.test.ts:259-287` fails closed in production when offsite storage does not retain the archive.
- `apps/admin/src/app/api/backup/import/route.test.ts:133-159` rejects unsigned or tampered MERGE imports.
- `apps/admin/src/app/api/backup/import/route.test.ts:206-234` returns 409 when a concurrent restore is already running.
- `apps/admin/src/app/api/backup/import/route.test.ts:237-267` blocks REPLACE of admin identity tables by default.
- `apps/admin/src/app/api/backup/import/route.test.ts:270-293` blocks mutating restore when pre-restore safety backup fails.
- `apps/admin/src/app/api/backup/import/route.test.ts:307-340` rejects signed MERGE restore into the wrong target environment.
- `apps/admin/src/app/api/backup/import/route.test.ts:343-370` requires a strong REPLACE confirmation phrase.
- `apps/admin/src/app/api/backup/import/route.test.ts:373-402` blocks production REPLACE without the approved production flag.
- `apps/admin/src/lib/backup-tables.test.ts:80-92` keeps runtime secrets and active sessions out of app-level backups.
- `apps/admin/src/lib/backup-tables.test.ts:145-177` accounts for every Prisma model as included or intentionally excluded.

## Findings

No new admin backup/import/restore bypass was verified in this pass.

## Not Verified In Code

- A live restore drill on a disposable local/staging database.
- Current runtime backup/offsite/crypto configuration values.
- Whether every backup archive can be restored after future Prisma model additions without the catalog coverage test failing.
- Whether legal/business retention policy for backup records matches product/privacy policy.

## Recommended Next Tests

- Run backup route test suites with the existing project test command when approved.
- Add periodic restore-drill automation against a disposable database snapshot.
- Add CI guard that fails when a new Prisma model is not included in `BACKUP_TABLES` or `INTENTIONALLY_EXCLUDED_MODELS`.
