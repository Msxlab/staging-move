# 2026-06-16 Dokploy DB Prep UI-Only Handoff

## Context

Host SSH to `server.perfnext.com` was not available, so migration prep switched
to a Dokploy UI-only path for the database bootstrap.

No secrets, env values, database rows, customer PII, private keys, or SQL dumps
were written to this handoff.

## Completed

- Added `docker-compose.dokploy-dbprep.yml`.
  - Compose project name: `locateflow`
  - Starts only `mysql`
  - Uses the same `mysql_data` volume name as the full Dokploy compose
  - Does not start `web`, `admin`, `imgproxy`, or `cron`
  - Does not expose MySQL on a public host port
- Validated the DB-only compose locally with dummy env values:
  - `docker compose -f docker-compose.dokploy-dbprep.yml config --quiet`
- Updated `docs/runbooks/dokploy-migration.md` with the SSH-less DB prep fallback.
- Pushed commit `0caa063d` to `codex/dokploy-migration`.

## Dokploy State

- Project: `LocateFlow`
- Environment: `production`
- Compose service: `Production Stack`
- Server: `server.perfnext.com` / `89.117.149.77`
- Dokploy Git provider deploy failed because the repository could not be cloned
  over unauthenticated HTTPS:
  - `fatal: could not read Username for 'https://github.com': No such device or address`
- To bypass Git auth for DB-only prep, the compose service was switched to the
  Raw provider and the DB-only compose content was saved there.
- Raw DB-only deploy succeeded.
- Current Dokploy container state observed:
  - `locateflow-mysql`
  - state: `running`
  - status: `healthy`
- The prior failed Git deployment remains in the deployment history, but the
  latest Raw deployment is `done`.

## Live Source State

DigitalOcean remains the live source of truth. DNS was not changed.

Health checks after DB-only Dokploy deploy:

- `https://locateflow.com/api/health` -> 200
- `https://locateflow.com/api/ready` -> 200
- `https://admin.locateflow.com/api/healthz` -> 200

## Next Required Step

Restore source MySQL data into the healthy Dokploy `locateflow-mysql` container.

Because host SSH is unavailable and the Dokploy terminal only attaches to
containers, the safest next path is to use a one-off DB-copy compose/service or
container terminal workflow that does not expose source DB credentials in chat.

Possible safe path:

1. Add a temporary source DB credential to Dokploy environment manually, without
   pasting it into chat.
2. Run a one-off restore service or container terminal command that reads from
   the source DigitalOcean MySQL and writes to `locateflow-mysql`.
3. Run `scripts/dokploy-db-counts.sql` on source and target and compare counts.
4. Remove any temporary source DB credential from Dokploy after restore.

## Before Full App Deploy

- Do not switch DNS yet.
- Do not enable cron yet.
- GitHub repo clone still needs to be solved for full app build/deploy.
  Options:
  - Configure Dokploy GitHub provider.
  - Add a read-only GitHub deploy key and switch repository URL to SSH.
  - Use a Raw full compose only if image/build strategy no longer needs Git.
- Switch away from the DB-only Raw compose only after the DB restore and final
  cutover sequence is ready.

