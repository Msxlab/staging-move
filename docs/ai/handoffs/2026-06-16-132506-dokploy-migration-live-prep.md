# Dokploy Migration Live Prep Handoff

Date: 2026-06-16

## Scope

Live migration preparation for moving LocateFlow from DigitalOcean App Platform
to Dokploy. No DNS cutover, production DB dump/restore, production deploy,
production migration, cron switch, or secret disclosure was performed.

## Completed

- Created Dokploy project `LocateFlow` with production environment.
- Created Dokploy compose service `Production Stack`.
- Disabled Dokploy compose autodeploy before connecting the repository.
- Configured the compose source as:
  - Repository: `https://github.com/Msxlab/move-main.git`
  - Branch: `codex/dokploy-migration`
  - Compose path: `docker-compose.dokploy.yml`
- Confirmed Dokploy environment editor is open and currently requires env
  population before any deploy can be attempted.
- Confirmed DigitalOcean App Platform settings show app-level environment
  variables are paginated and encrypted secrets are represented as encrypted,
  not raw values.

## Blocked / Needs Human Operator

- Dokploy env values must be entered by the human operator from a secure source.
  Codex must not read, copy, print, or store `.env` files, credential files,
  tokens, private keys, or raw secret values.
- `FIELD_ENCRYPTION_KEY` is a hard blocker. It must be copied exactly from the
  existing production secret source. If it cannot be recovered, encrypted DB
  fields and DB-backed runtime secrets may be unreadable after restore.
- DigitalOcean App Platform encrypted values may not be retrievable from the UI.
  Use the original password manager, deployment secret store, or approved
  operator-held secret source instead.
- Rehearsal restore is not started. No dump was taken.
- Domains are not configured in Dokploy yet.
- GitHub scheduled cron is not disabled yet.
- DigitalOcean maintenance mode is not enabled.

## Current External State

- Dokploy has one project and one compose service for LocateFlow.
- Dokploy autodeploy is off for the compose service.
- The compose service is not deployed.
- DigitalOcean app remains live and unchanged by this session.
- Admin Runtime Config page was previously observed with configured/missing
  status only; no raw runtime config values were read or stored.

## Recommended Next Action

1. Human operator enters Dokploy environment variables in the Dokploy compose
   Environment tab without pasting values into chat.
2. Human operator runs the presence-only env audit outside chat or reports only
   missing key names:

   ```bash
   node scripts/dokploy-env-audit.mjs --env-file <operator-managed-env-file>
   ```

3. After env presence passes, preview the compose in Dokploy and verify it
   resolves without missing interpolation keys.
4. Configure Dokploy domains without changing live DNS.
5. Start rehearsal restore only after explicit approval.

## Application Source Code Modified

No application source code was modified in this live-prep step.
