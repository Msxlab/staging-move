# 2026-06-17 - GitHub Actions Cost Control

## Summary

GitHub Actions is billing-blocked for `Msxlab/move-main`, so the safe no-cost
path is to disable the CI workflow in GitHub settings and use a local
pre-deploy quality gate.

## Repo Changes

- Added root `pnpm check`.
- Added `docs/ai/ops/PRE_DEPLOY_CHECKS.md`.
- Did not add a pre-push hook because doing it consistently would require repo
  hook management or a dependency such as Husky.

## Local Check Result

- `pnpm check` was run. It failed during `pnpm verify:typecheck` because the
  existing mobile package has Expo route type errors in files such as
  `apps/mobile/app/(tabs)/index.tsx`, `apps/mobile/app/(tabs)/more.tsx`, and
  related route files.
- `pnpm --filter @locateflow/web test` passed: 283 files, 2541 tests.
- `pnpm --filter @locateflow/admin test` passed: 120 files, 752 tests.
- Local Node was `v24.13.0`; the repo expects Node `22.x`, so pnpm emitted
  engine warnings.

## GitHub Settings Status

No `GH_ADMIN_TOKEN` with repository admin scope was available in this local
environment, so GitHub settings were not changed by API.

Owner action required:

- Disable the `CI` workflow:
  `repo -> Actions -> CI -> ... -> Disable workflow`.
- Because Dokploy now runs the Ofelia `cron` service, disable the scheduled
  `cron.yml` workflow too:
  `repo -> Actions -> Scheduled cron jobs -> ... -> Disable workflow`.
- Enable free native GitHub protections:
  `repo -> Settings -> Code security -> Secret scanning -> Enable`,
  then `Push protection -> Enable`.
- Check branch protection for `main`:
  `repo -> Settings -> Branches -> main rule -> Require status checks`, then
  remove only CI-required checks if they are listed.

## Cron Finding

`docker-compose.dokploy.yml` includes a `cron` service using
`mcuadros/ofelia`, and `docker/ofelia.ini` includes the production
`/api/cron/*` endpoint schedules. The Dokploy cutover handoff recorded
`locateflow-cron` running after the final deploy. Therefore GitHub `cron.yml`
is no longer the only cron path and may be disabled to avoid billing-blocked
workflow failures.

## Safety

- No production containers touched.
- No deploy performed.
- No secrets printed or committed.
- GitHub settings require owner/admin UI confirmation because no admin token was
  available locally.
