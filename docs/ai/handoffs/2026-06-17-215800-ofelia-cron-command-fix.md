# 2026-06-17 21:58 - Ofelia Cron Command Fix

## Summary

Fixed Dokploy Ofelia `job-exec` command parsing for the production cron
configuration.

The production logs showed Ofelia starting jobs as `sh -c wget ...`, which
caused `wget` to run without a URL and fail with `wget: missing URL`. The fix
keeps the full `wget ... URL` invocation as one shell argument after
`/bin/sh -lc`.

## Changed Files

- `docker/ofelia.ini`
- `docs/ai/handoffs/2026-06-17-215800-ofelia-cron-command-fix.md`

## What Changed

- Replaced every `command = sh -c "wget ..."` entry with:
  - `command = /bin/sh -lc 'wget ...'`
- Preserved existing schedules, target containers, endpoints, HTTP methods,
  and `CRON_SECRET` bearer header behavior.
- Added a short comment explaining why the command must remain one shell
  argument after `-lc`.

## Local Checks

- Parsed all `docker/ofelia.ini` `job-exec` commands with Python
  `configparser` + `shlex`.
  - Result: `PASS parsed 26 job-exec commands`
  - Verified each command parses as `/bin/sh`, `-lc`, and one full shell
    command containing `wget`, the `CRON_SECRET` header, and the target URL.
- `docker compose -f docker-compose.dokploy.yml config --no-interpolate --quiet`
  - Result: pass
- `git diff --check -- docker/ofelia.ini`
  - Result: pass

## Not Done

- No deploy performed.
- No production cron job was manually triggered.
- No production env, secret, customer data, or production data was read.

## Deployment Verification Needed After Approval

After this branch is merged and deployed through Dokploy:

1. Open `locateflow-cron` logs.
2. Verify jobs start as `/bin/sh -lc wget ...` with the full URL inside the
   shell command rather than `sh -c wget`.
3. Confirm at least:
   - `blog-publish`
   - `checkout-cleanup`
   - `connector-dispatch`
4. Confirm the logs no longer contain `wget: missing URL`.
5. Confirm the corresponding web/admin cron endpoints return success or a
   route-level expected response, not command parsing failure.

## Safety

- No deploy.
- No push to main.
- No flag changes.
- No migration.
- No billing, Stripe, store, or telemetry changes.
