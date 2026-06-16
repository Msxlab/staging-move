# Dokploy Build Fixes Handoff

Date: 2026-06-16

## Summary

Dokploy full app deploy was blocked by build errors after the DB copy rehearsal.
This pass fixed the app build blockers without changing production data, DNS,
runtime secrets, or cron state.

No secrets, database rows, customer PII, private keys, or `.env` values were
recorded in this handoff.

## Changes

- `apps/web/src/app/onboarding/page.tsx` was reduced back to a server wrapper
  that computes the onboarding teaser flag and renders
  `onboarding-client.tsx`. The prior file contained a duplicated client
  component body and two default exports, which broke Next/Turbopack parsing.
- Web production code imports of Prisma types were changed from direct
  `@prisma/client` imports to the existing `@locateflow/db` export surface.
  This avoids strict workspace dependency resolution failures during the web
  Docker build.
- `apps/admin/package.json` now uses `@types/bcryptjs@^2.4.6`, matching
  admin's `bcryptjs@^2.4.3`. The previous v3 stub package did not provide
  declarations for the v2 runtime package in the Docker build.
- `pnpm-lock.yaml` importer metadata was updated to match the admin type
  dependency.

## Verification

- `pnpm --filter @locateflow/web lint` passed.
- `docker build -f docker/web.prod.Dockerfile .` passed.
- `pnpm --filter @locateflow/admin lint` passed.
- `docker build -f docker/admin.prod.Dockerfile .` passed.
- The Docker builds still emit a non-fatal Turbopack warning about
  `export *` from the CommonJS `@prisma/client` module through
  `@locateflow/db`.

## Current State

- DigitalOcean remains live. DNS has not been changed.
- Dokploy MySQL still contains the successful rehearsal restore from the earlier
  DB copy step.
- Dokploy cron remains disabled by default because `cron` is behind the
  `cron` compose profile.
- GitHub provider is configured in Dokploy for `Msxlab/move-main` on branch
  `codex/dokploy-migration`.

## Next Steps

1. Commit and push these build fixes to `codex/dokploy-migration`.
2. Trigger Dokploy deploy again from the configured GitHub provider.
3. If full deploy passes, run rehearsal health checks against Dokploy service
   targets before any DNS or cron cutover.
4. Keep `cron` disabled until the real cutover window.
5. Before real cutover, freeze writes, disable the old scheduled cron source,
   take a final DigitalOcean dump, restore/count again, then move DNS only after
   health checks pass.
