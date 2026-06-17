# 2026-06-16 Dokploy DB Rehearsal Handoff

## Context

LocateFlow migration prep from DigitalOcean App Platform plus DigitalOcean
managed MySQL to Dokploy plus Dokploy-hosted MySQL 8.

No secrets, env values, database rows, customer PII, private keys, or dump files
were written to this handoff.

## Completed

- Switched local `doctl` to the existing `locateflow-migration` context.
- Verified DigitalOcean database cluster metadata:
  - ID: `e15c3c97-21cb-43b9-9ae1-5341ed3947eb`
  - Name: `locateflow-staging-db`
  - Engine/version: MySQL 8
  - Region: `nyc3`
  - Status: `online`
  - Size: `db-s-1vcpu-1gb`
  - Nodes: `1`
- Verified available managed backups. Latest observed backup:
  - `2026-06-16 13:20:13 +0000 UTC`
  - Size: `0.354334 GB`
- Verified trusted sources after cleanup:
  - DigitalOcean App Platform app `8e21e9cb-722d-4c4d-9359-dcfd0d86c9ee`
  - Temporary local IP rule was removed after checks.
- Added count-only SQL helper:
  - `scripts/dokploy-db-counts.sql`
- Updated runbook to use the count helper and to include
  `--set-gtid-purged=OFF` in dump commands.
- Ran source count check using a temporary DigitalOcean database user.
  - Temporary user was deleted after use.
- Ran a no-dump-file local rehearsal restore:
  - Source `mysqldump` was piped directly into a temporary local MySQL 8 Docker
    container.
  - No SQL dump file was written to disk.
  - Temporary local MySQL container was stopped/removed after count checks.

## Source And Rehearsal Counts

The source and restored rehearsal target matched:

| Table/metric | Count |
| --- | ---: |
| `_prisma_migrations` | 68 |
| `RuntimeConfigEntry` | 6 |
| `RuntimeConfigEntry_active` | 6 |
| `User` | 19 |
| `AdminUser` | 1 |
| `Subscription` | 18 |
| `Address` | 26 |
| `ServiceProvider` | 888 |
| `SavedProvider` | 1 |
| `UserCustomProvider` | 0 |
| `MoveTask` | 62 |
| `EmailLog` | 70 |
| `ConnectorDispatch` | 0 |
| `AddressChangeEvent` | 0 |

## Current State

- DigitalOcean live health checks passed before rehearsal:
  - `https://locateflow.com/api/health` -> 200
  - `https://locateflow.com/api/ready` -> 200
  - `https://admin.locateflow.com/api/healthz` -> 200
- Dokploy environment key presence was previously checked by key name only.
- Dokploy DNS has not been changed.
- Dokploy compose has not been deployed for cutover.
- DigitalOcean app and database remain the source of truth.

## Important Caveat

The successful rehearsal proves that the current source MySQL database can be
dumped and restored with matching critical table counts. It does not by itself
guarantee zero data loss during final cutover. Zero-loss cutover still requires
freezing writes, taking a final dump after the freeze, restoring that final dump,
validating counts/health, and only then switching DNS/cron.

## Next Recommended Action

Prepare the Dokploy-side final restore path. Before DNS cutover:

1. Decide whether to keep cron disabled until after health checks.
2. Start/prepare Dokploy MySQL without allowing user traffic.
3. Add the Dokploy server IP as a temporary trusted source on the DigitalOcean
   DB only during final dump.
4. During the maintenance window, freeze writes, take the final dump, restore to
   Dokploy MySQL, compare `scripts/dokploy-db-counts.sql` results, then switch
   DNS.

