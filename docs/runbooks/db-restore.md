# DB Restore Runbook

Use this when restoring from a LocateFlow backup archive or investigating restore readiness.

## Preconditions

- Confirm the target environment and database URL.
- Confirm the latest completed backup and whether it has an offsite copy.
- Never restore directly into production without a fresh production snapshot and explicit incident commander approval.

## Safe Restore Flow

1. Download the backup archive from the admin backup control plane or offsite storage.
2. Run backup verification first.
3. Run import in `DRY_RUN` mode and inspect selected tables, dependency warnings, and row counts.
4. Prefer `MERGE` for additive recovery.
5. Use `REPLACE` only when the selected table set includes required child tables and the route reports no replace-safety issues.
6. For production restore, require password confirmation and record the incident or change ticket ID in the admin notes/incident log.

## Verification

- Confirm core login works.
- Confirm users, addresses, services, subscriptions, notifications, and provider catalog screens load.
- Confirm backup records show the restore/import audit event.
- Confirm no unexpected FK errors or partial imports occurred.

## Stop Conditions

- Signature verification fails.
- Decryption fails.
- Dry-run shows unexpected tables or row counts.
- Replace-safety issues are reported.
- Any import returns rollback/failure.

## Current Scope

The backup catalog covers the currently supported protected tables exposed by the backup API. It is not a legal archive of every table in the database.
