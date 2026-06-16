# Dokploy DB Copy Restore Handoff

Date: 2026-06-16

## Summary

Dokploy UI-only DB copy rehearsal succeeded. The temporary Raw compose was
switched from MySQL-only prep to the one-shot DB copy compose, the copy job ran,
and source/target count output matched. The compose was then switched back to
MySQL-only prep so accidental deploys do not rerun the restore job.

No secrets, database rows, customer PII, private keys, or `.env` values were
recorded in this handoff.

## Verified Results

- Dokploy project: `LocateFlow`, environment `production`, compose
  `Production Stack`.
- Current Dokploy Raw compose state after cleanup: MySQL-only prep compose.
- `locateflow-mysql`: running and healthy.
- `locateflow-dbcopy`: ran once, exited `0`, then was removed by switching back
  to MySQL-only compose.
- DigitalOcean app and live DNS were not changed.
- DigitalOcean remains the live app/DB source during this rehearsal stage.

## Count Comparison

The DB copy job printed matching source and target counts:

| Table or metric | Source | Target |
| --- | ---: | ---: |
| `_prisma_migrations` | 68 | 68 |
| `RuntimeConfigEntry` | 6 | 6 |
| `RuntimeConfigEntry_active` | 6 | 6 |
| `User` | 19 | 19 |
| `AdminUser` | 1 | 1 |
| `Subscription` | 18 | 18 |
| `Address` | 26 | 26 |
| `ServiceProvider` | 888 | 888 |
| `SavedProvider` | 1 | 1 |
| `UserCustomProvider` | 0 | 0 |
| `MoveTask` | 62 | 62 |
| `EmailLog` | 70 | 70 |
| `ConnectorDispatch` | 0 | 0 |
| `AddressChangeEvent` | 0 | 0 |

## Temporary Access Cleanup

- Temporary DigitalOcean restore user was deleted.
- Temporary DigitalOcean database firewall rule for the Dokploy server IP was
  removed.
- DigitalOcean DB firewall list now shows only the App Platform trusted source.
- Cleanup still recommended in Dokploy UI: remove temporary
  `SOURCE_MYSQL_PASSWORD` env key if it remains present. Do not reveal or record
  its value.

## Current Blockers

- Full app deploy still needs GitHub clone/build access resolved. The previous
  unauthenticated HTTPS clone failed in Dokploy.
- Host SSH to `server.perfnext.com` was not available from the local machine.
- No cutover has happened. A zero-loss cutover still requires write freeze,
  final dump, final restore/count comparison, app health checks, DNS move, and
  cron source switch.

## Next Steps

1. Configure Dokploy GitHub provider or add an approved read-only deploy key so
   the full app compose can build from `Msxlab/move-main`.
2. Switch Dokploy from the temporary Raw MySQL-only compose to the full app
   compose path.
3. Deploy full stack against the restored Dokploy MySQL and run health checks.
4. Before real cutover, freeze writes, disable GitHub scheduled cron, take a
   final DigitalOcean dump, restore again, compare counts again, then switch DNS
   only after health checks pass.
