# Dokploy Migration Prep Handoff

## Scope

- Task: implement the approved DigitalOcean to Dokploy migration preparation plan.
- Branch: `codex/dokploy-migration`.
- No production systems were accessed.
- No `.env`, `.env.*`, credential, private key, token, customer PII, or production data was read or printed.
- No deployment, migration, DNS change, package install, push, or destructive command was run.

## Completed

- Added `docker-compose.dokploy.yml` for Dokploy-hosted production:
  - Uses Dokploy/Traefik domain management instead of Caddy.
  - Runs `mysql`, `migrate`, `web`, `admin`, `imgproxy`, and `cron`.
  - Keeps MySQL internal with persistent `mysql_data`.
  - Adds `web`, `admin`, and `imgproxy` to external `dokploy-network`.
  - Passes required and common optional runtime env keys explicitly.
  - Keeps Ofelia as the single target cron source for Dokploy.
- Updated `docker/web.prod.Dockerfile` and `docker/admin.prod.Dockerfile` to accept public build args while preserving current defaults.
- Added `scripts/dokploy-env-audit.mjs`, a presence-only env checker that reports missing/duplicate/unknown key names and never prints values.
- Added `docs/runbooks/dokploy-migration.md` with inventory, rehearsal, cutover, post-cutover QA, cron, and rollback steps.
- Updated `README.deploy.md` to point Dokploy operators to the new compose file and runbook.

## Verification

- Ran `node scripts/dokploy-env-audit.mjs --help`.
- Ran `node scripts/dokploy-env-audit.mjs --env-file <temporary dummy env>` with synthetic non-secret values.
- Ran `docker compose --env-file <temporary dummy env> -f docker-compose.dokploy.yml config --quiet`.
- Ran `git diff --check`.

## Key Risks

- Real cutover still requires operator-managed copying of secret values from DigitalOcean to Dokploy, especially `FIELD_ENCRYPTION_KEY`.
- GitHub scheduled cron must be disabled before Dokploy/Ofelia cron is enabled, or cron jobs may double-fire.
- Rollback by DNS is only data-loss-free before Dokploy accepts new writes.
- Runtime Config values are preserved by the whole MySQL restore; do not attempt to manually recreate secret values from the admin UI.

## Next Action

Run the real migration together from the runbook, starting with DigitalOcean and Dokploy inventory screens using masked/key-name-only verification.

## Application Source Modified

Yes, but only deploy/build infrastructure files were changed:

- `docker/web.prod.Dockerfile`
- `docker/admin.prod.Dockerfile`

No product runtime logic, database schema, application feature code, or production data was modified.
