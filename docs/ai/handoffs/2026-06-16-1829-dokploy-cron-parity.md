# Dokploy Cron Parity Prep - 2026-06-16 18:29

## Summary

Prepared the self-hosted Dokploy/Ofelia scheduler to replace the GitHub Actions
scheduled cron workflow after final cutover. Cron is still disabled behind the
`cron` Compose profile and must not be enabled until DigitalOcean writes are
frozen, the final DB restore is complete, DNS points to Dokploy, and the GitHub
scheduled workflow is disabled.

## Changed

- Updated `docker/ofelia.ini` so every `/api/cron/*` endpoint invoked by
  `.github/workflows/cron.yml` is represented in Ofelia.
- Added missing jobs:
  - `scheduled-delivery`
  - `store-review-accounts`
  - `uptime-check`
  - `lifecycle-nudges`
  - `move-week-alerts`
  - `daily-digest`
  - `admin-monthly-report`
- Changed user-facing reminder jobs from a single UTC hour to `12-18 UTC`,
  matching the GitHub workflow's US timezone self-gating model.
- Changed `weekly-digest` to run daily at `09:00 UTC`; the route self-gates by
  each user's configured digest day.
- Changed `data-retention` to daily `06:00 UTC`, matching the active GitHub
  daily batch behavior.
- Changed `blog-image-cleanup` to use POST for parity with the GitHub workflow.

## Verification

- `docker compose -f docker-compose.dokploy.yml config --quiet` passed with
  dummy local env values only.
- Endpoint parity comparison between `.github/workflows/cron.yml` and
  `docker/ofelia.ini` returned no missing endpoints and no extra endpoints.

## Current State

- Dokploy cron service remains gated by `profiles: ["cron"]`.
- Do not enable `COMPOSE_PROFILES=cron` or otherwise start `locateflow-cron`
  before GitHub scheduled cron is disabled.
- GitHub scheduled cron is still the old source until final cutover, though the
  human reported it is failing or limited by Actions budget.

## Next Action

At cutover time:

1. Disable the GitHub `Scheduled cron jobs` workflow.
2. Complete final DB restore and DNS health checks.
3. Enable the Dokploy cron profile and redeploy.
4. Confirm `locateflow-cron` is running and only one cron source is active.
