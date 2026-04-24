# DB Restore And Backup Drill Runbook

Use this runbook for restoring from a LocateFlow backup archive or proving restore readiness in a clean staging environment.

Do not run these steps against production unless there is an approved incident or change ticket, a fresh managed database snapshot, and an incident commander has explicitly approved the restore.

## Preconditions

- Target environment is staging or a temporary restore environment.
- Target database is empty or disposable.
- `DATABASE_URL` points to the staging/restore database, never production.
- `FIELD_ENCRYPTION_KEY` matches the key that created the backup archive.
- Admin app can reach the staging/restore database.
- Offsite storage credentials are available if the archive will be downloaded through the admin backup control plane.
- You have a known-good backup archive and its backup record ID or object storage key.

## Protected Tables In The App Backup Archive

The current app-level backup catalog includes these tables:

1. `users`
2. `profiles`
3. `providers`
4. `providerCoverages`
5. `addresses`
6. `movingPlans`
7. `customProviders`
8. `services`
9. `moveTasks`
10. `budgets`
11. `subscriptions`
12. `notifications`
13. `auditLogs`
14. `providerGovernanceIssues`

This archive is not a full managed database snapshot. It does not cover every database table, object storage file, runtime secret, database role, index outside Prisma, or provider-managed PITR record.

## Clean Staging Restore Drill

### 1. Prepare A Disposable Database

Use a dedicated staging database or create a temporary restore database in DigitalOcean.

Example MySQL commands:

```bash
mysql -h "$DB_HOST" -u "$DB_ADMIN_USER" -p -e "CREATE DATABASE locateflow_restore_drill;"
```

Set the admin app or shell environment to the temporary database:

```bash
export DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/locateflow_restore_drill"
export FIELD_ENCRYPTION_KEY="the-same-64-character-hex-key-used-for-the-backup"
```

Apply the current Prisma schema:

```bash
pnpm --filter @locateflow/db exec prisma migrate deploy
pnpm --filter @locateflow/db generate
```

### 2. Download Or Provide The Backup Archive

Preferred:

- Download from the admin Backup Control Plane when the backup record shows offsite status `stored`.

Alternative:

- Download directly from S3/R2-compatible object storage using a read-only operational credential.

Stop if:

- The archive is not available offsite.
- The archive is plaintext or unsigned in production.
- The archive source cannot be tied to a completed backup record.

### 3. Verify The Archive

Use the admin Backup Control Plane:

1. Open Backups.
2. Load the archive into the verify/restore panel.
3. Run Verify.
4. Confirm all expected tables are recognized.
5. Confirm HMAC signature passes.
6. Confirm decryption passes for encrypted archives.

Stop if:

- Signature verification fails.
- Decryption fails.
- Unknown tables appear unexpectedly.
- Table counts are materially different from the backup record metadata.

### 4. Run Dry-Run Import

Use DRY_RUN before any write:

1. Select all app backup tables from the archive.
2. Run DRY_RUN.
3. Review dependency warnings.
4. Confirm row counts match the expected archive table counts.

Expected dependency order:

```text
users
profiles
providers
providerCoverages
addresses
movingPlans
customProviders
services
moveTasks
budgets
subscriptions
notifications
auditLogs
providerGovernanceIssues
```

Stop if:

- Dry-run reports unexpected tables.
- Dry-run reports replace-safety issues for the intended restore mode.
- Row counts do not match the archive metadata.

### 5. Run Restore

For a clean staging database, use `MERGE` first.

Use `REPLACE` only when intentionally testing replacement behavior and when the selected table set includes all required child tables.

Admin route behavior:

- MERGE and REPLACE require password confirmation.
- MERGE and REPLACE require a valid backup signature.
- Write imports run in a transaction.
- A failed row import rolls back the transaction.

### 6. Validation Queries

Run these against the restore database after import:

```sql
SELECT COUNT(*) AS users FROM User;
SELECT COUNT(*) AS profiles FROM Profile;
SELECT COUNT(*) AS providers FROM ServiceProvider;
SELECT COUNT(*) AS providerCoverages FROM ServiceProviderCoverage;
SELECT COUNT(*) AS addresses FROM Address;
SELECT COUNT(*) AS movingPlans FROM MovingPlan;
SELECT COUNT(*) AS customProviders FROM UserCustomProvider;
SELECT COUNT(*) AS services FROM Service;
SELECT COUNT(*) AS moveTasks FROM MoveTask;
SELECT COUNT(*) AS budgets FROM Budget;
SELECT COUNT(*) AS subscriptions FROM Subscription;
SELECT COUNT(*) AS notifications FROM Notification;
SELECT COUNT(*) AS auditLogs FROM AuditLog;
SELECT COUNT(*) AS providerGovernanceIssues FROM ProviderGovernanceIssue;
```

Run relationship spot checks:

```sql
SELECT COUNT(*) AS orphan_profiles
FROM Profile p
LEFT JOIN User u ON u.id = p.userId
WHERE u.id IS NULL;

SELECT COUNT(*) AS orphan_provider_coverages
FROM ServiceProviderCoverage c
LEFT JOIN ServiceProvider p ON p.id = c.providerId
WHERE p.id IS NULL;

SELECT COUNT(*) AS orphan_addresses
FROM Address a
LEFT JOIN User u ON u.id = a.userId
WHERE u.id IS NULL;

SELECT COUNT(*) AS orphan_services
FROM Service s
LEFT JOIN User u ON u.id = s.userId
WHERE u.id IS NULL;

SELECT COUNT(*) AS orphan_custom_providers
FROM UserCustomProvider cp
LEFT JOIN User u ON u.id = cp.userId
WHERE u.id IS NULL;

SELECT COUNT(*) AS orphan_move_tasks
FROM MoveTask mt
LEFT JOIN User u ON u.id = mt.userId
WHERE u.id IS NULL;

SELECT COUNT(*) AS orphan_move_task_custom_providers
FROM MoveTask mt
LEFT JOIN UserCustomProvider cp ON cp.id = mt.customProviderId
WHERE mt.customProviderId IS NOT NULL AND cp.id IS NULL;

SELECT COUNT(*) AS orphan_provider_governance_custom_providers
FROM ProviderGovernanceIssue pgi
LEFT JOIN UserCustomProvider cp ON cp.id = pgi.customProviderId
WHERE pgi.customProviderId IS NOT NULL AND cp.id IS NULL;
```

Expected result for each orphan query: `0`.

### 7. Application Smoke Tests

Against the staging/restore app:

- Admin login works.
- Backup Control Plane loads.
- User list loads.
- Provider list and provider detail load.
- Provider coverage rows are visible for provider detail.
- User custom providers load for a non-production test user.
- Move task list loads for a non-production test move.
- Admin provider governance queue loads.
- Support list loads.
- Subscription list loads.
- Notifications list loads.
- A non-production test user can load dashboard, addresses, services, and providers.

### 8. Rollback And Cleanup

If this is a drill:

```bash
mysql -h "$DB_HOST" -u "$DB_ADMIN_USER" -p -e "DROP DATABASE locateflow_restore_drill;"
```

If a staging app was pointed at the restore database:

1. Stop the staging app.
2. Restore its previous `DATABASE_URL`.
3. Redeploy or restart.
4. Confirm staging points back to the normal staging database.

If restore failed:

1. Preserve logs, archive metadata, and import response.
2. Do not retry blindly with REPLACE.
3. File a restore incident with the failed table, mode, row counts, and error message.
4. Recreate the disposable database before the next attempt.

## Production Restore Guardrails

- Never restore directly into production without a fresh managed database snapshot.
- Never use plaintext or unsigned archives for production restore.
- Prefer managed database PITR for whole-database incidents.
- Use app-level backup import for selected table recovery only after dry-run evidence.
- Record the incident/change ticket, operator, archive ID, selected tables, import mode, and validation results.

## Stop Conditions

- `FIELD_ENCRYPTION_KEY` is missing or does not match the archive.
- Signature verification fails.
- Decryption fails.
- Dry-run shows unexpected tables or row counts.
- Replace-safety issues are reported.
- Unknown tables are present.
- Orphan checks fail after restore.
- Any import returns rollback/failure.

## Current RPO/RTO Position

RPO and RTO are not production-committed until this drill succeeds in staging with offsite storage and a managed database snapshot fallback.

After the first successful drill, record:

- Backup archive ID.
- Backup created timestamp.
- Offsite object key.
- Restore start and end time.
- Total restored rows.
- Smoke-test results.
- Measured RPO.
- Measured RTO.
