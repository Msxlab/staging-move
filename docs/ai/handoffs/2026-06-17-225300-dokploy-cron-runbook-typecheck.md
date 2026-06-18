# Dokploy Cron Runbook + Typecheck Handoff

## Summary

Followed up on the live Ofelia cron fix by documenting the required cron
reload procedure and clearing the stale local Next generated cache that was
blocking `pnpm verify:typecheck`.

## Changed Files

- `README.deploy.md`
- `docs/runbooks/dokploy-migration.md`
- `docs/ai/handoffs/2026-06-17-225300-dokploy-cron-runbook-typecheck.md`

## Runbook Update

Added explicit guidance that Dokploy may keep the long-running
`locateflow-cron` Ofelia daemon alive across compose config changes.

After any change to:

- `docker/ofelia.ini`
- `docker/locateflow-cron-runner.sh`
- cron-related compose `configs:` mounts

operators should explicitly restart or recreate only `locateflow-cron`, then
verify runner-form job registration and the next cron tick.

## Local Cache Cleanup

Removed generated ignored cache:

```text
C:\Users\Windows\Documents\move-main\move-main\apps\web\.next
```

This resolved the stale generated type reference to the deleted
`partner-consents/[id]/refresh` route.

## Validation

`pnpm verify:typecheck` passed.

The command emitted only the existing local engine warning:

```text
Unsupported engine: wanted node 22.x, current node v24.13.0
```

No application source code, deploy config behavior, secrets, migrations, or
production data were changed in this follow-up.
