# Dokploy Migrate Seed Bypass Handoff

Date: 2026-06-16

## Summary

Dokploy full app deploy reached container startup, but the `migrate` one-shot
failed after confirming there were no pending Prisma migrations. The failure
was caused by `seed-admin.ts` rejecting the configured admin seed password.

For the Dokploy migration path, the restored MySQL database already includes
the migrated `AdminUser` row. The Dokploy compose now overrides the migrate
container command to run only `prisma migrate deploy`, avoiding any admin seed
password validation or admin password reset during rehearsed migration deploys.

No secrets, `.env` values, customer PII, private keys, or production data were
recorded in this handoff.

## Changes

- `docker-compose.dokploy.yml` no longer requires `ADMIN_SEED_EMAIL` or
  `ADMIN_SEED_PASSWORD` for the `migrate` service.
- `docker-compose.dokploy.yml` now sets the `migrate` command to:
  `pnpm --filter @locateflow/db exec prisma migrate deploy`.
- The general `docker/migrate.Dockerfile` default command and
  `docker-compose.prod.yml` were left unchanged.

## Verification

- Validated `docker-compose.dokploy.yml` with a temporary dummy env file and
  `docker compose --env-file <dummy> -f docker-compose.dokploy.yml config --quiet`.
- The validation did not use real `.env` files or real secret values.

## Current State

- DigitalOcean remains live. DNS has not been changed.
- Dokploy cron remains disabled by default behind the `cron` compose profile.
- Dokploy MySQL still contains the successful rehearsal restore from the DB
  copy step.
- Next Dokploy deploy should allow `migrate` to complete without running
  `seed-admin.ts`.

## Next Steps

1. Commit and push this Dokploy compose change to `codex/dokploy-migration`.
2. Trigger another Dokploy deploy.
3. Confirm `locateflow-migrate` exits successfully.
4. Confirm `web` and `admin` containers become healthy.
5. Run rehearsal service checks before any DNS, cron, or final cutover action.
