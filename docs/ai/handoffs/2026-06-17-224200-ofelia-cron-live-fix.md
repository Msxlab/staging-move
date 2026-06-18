# Ofelia Cron Live Fix Handoff

## Summary

Fixed and deployed the Dokploy Ofelia cron command parsing issue.

Initial live verification of PR #292 showed the original `missing URL` problem was replaced by a deeper Ofelia tokenization issue: nested header quoting was stripped, causing `wget` to run with `--header=Authorization: Bearer ...` and fail with exit code 4.

Follow-up PR #293 replaced direct `wget` commands in `docker/ofelia.ini` with a mounted runner script.

## Branches and PRs

- PR #292: `codex/ofelia-cron-fix` -> `main`
  - Commit: `ffb89efe`
  - Merge commit: `e1024b4e`
  - Result: deployed, but live cron still failed with exit code 4 due stripped header quoting.
- PR #293: `codex/ofelia-cron-runner` -> `main`
  - Commit: `e00d0c24`
  - Merge commit: `df5307ef`
  - Result: deployed and live cron tick verified green.

## Changed Application/Ops Files

- `docker/ofelia.ini`
- `docker/locateflow-cron-runner.sh`
- `docker-compose.dokploy.yml`
- `docker-compose.prod.yml`

## Local Validation

- `docker compose -f docker-compose.dokploy.yml config --no-interpolate --quiet` passed.
- `docker compose -f docker-compose.prod.yml config --no-interpolate --quiet` passed.
- Static Ofelia matrix passed:
  - 26 jobs
  - 24 web jobs
  - 2 admin jobs
  - 3 POST jobs
- Real Ofelia runtime GET/header test passed with throwaway containers.
- Real Ofelia runtime POST/header test passed with throwaway containers.
- Runner guard tests passed for bad target, bad path, bad method, and missing `CRON_SECRET`.

## Typecheck

`pnpm verify:typecheck` was attempted but blocked by an unrelated stale generated Next cache:

```text
.next/dev/types/validator.ts(1682,39): error TS2307:
Cannot find module '../../../src/app/api/partner-consents/[id]/refresh/route.js'
```

The cron change is shell/compose only and does not touch TypeScript source.

## Live Deploy Verification

- `main` deployed through Dokploy at merge commit `df5307ef`.
- `locateflow-web` healthy.
- `locateflow-admin` healthy.
- `locateflow-migrate` exited `0`.
- `locateflow-mysql` healthy.
- `locateflow-imgproxy` running.
- `locateflow-cron` required an explicit restart after deploy to reload the updated Ofelia config.

Live health endpoints:

- `https://locateflow.com/api/health` -> 200
- `https://locateflow.com/api/ready` -> 200
- `https://admin.locateflow.com/api/healthz` -> 200
- `https://img.locateflow.com/` -> 200

Live cron tick verified at 10:40 PM ET:

- `blog-publish` -> `failed: false`, stdout `{"ok":true,"published":0}`
- `checkout-cleanup` -> `failed: false`, stdout success payload
- `connector-dispatch` -> `failed: false`, stdout `{"skipped":"disabled"}`

## UI/UX Smoke

Chrome live smoke was run against:

- `/`
- `/pricing`
- `/faq`
- `/how-it-works`
- `/contact`
- `/about`
- `/codex-live-not-found-check`
- `https://admin.locateflow.com/login`

Checks:

- Pages rendered non-empty.
- Nested `<a><button>` pattern count was `0` on checked pages.
- No checked public page showed stale `90 days`, `3 months`, `$3.99`, `$39.99`, `$14.99`, `Unlimited addresses`, `4 others`, or `Save 17%`.
- Home and pricing showed the expected annual-first pricing/trial signals.
- Home had FAQ JSON-LD and Offer price 24.
- FAQ had FAQ JSON-LD.

Screenshots saved locally under:

```text
C:\Users\Windows\AppData\Local\Temp\locateflow-live-qa-1781750498433
```

Screenshot capture succeeded for home, FAQ, contact, not-found, and admin-login. Chrome CDP screenshot capture timed out for pricing, how-it-works, and about; DOM checks still passed.

## Operational Note

Dokploy compose deploy did not automatically recreate the long-running `locateflow-cron` container. The new config became active only after an explicit cron container restart. Future cron config deploys should include either a cron container recreate/restart step or a Dokploy workflow adjustment that forces the Ofelia daemon to reload config.
