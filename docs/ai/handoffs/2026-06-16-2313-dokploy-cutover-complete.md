# 2026-06-16 23:13 - Dokploy Cutover Complete

## Summary

LocateFlow production traffic was cut over from DigitalOcean App Platform to the
Dokploy server at `89.117.149.77` via Cloudflare DNS.

The final DigitalOcean MySQL dump was restored into Dokploy MySQL through the
one-shot `docker-compose.dokploy-dbcopy.yml` flow. The restore exited `0`, and
source/target counts matched for the checked tables.

## Verified State

- Dokploy project: `LocateFlow`, environment `production`, compose service
  `Production Stack`.
- Git branch deployed: `codex/dokploy-migration`.
- Latest deployed commit: `6dbe3fbb` (`chore: enable dokploy cron service`).
- Cloudflare DNS now has proxied A records to `89.117.149.77` for:
  - `locateflow.com`
  - `www.locateflow.com`
  - `admin.locateflow.com`
  - `img.locateflow.com`
- Dokploy containers after final deploy:
  - `locateflow-cron` running.
  - `locateflow-web` running and healthy.
  - `locateflow-admin` running and healthy.
  - `locateflow-migrate` exited `0`.
  - `locateflow-imgproxy` running.
  - `locateflow-mysql` running and healthy.
- Public smoke checks after DNS and final deploy:
  - `https://locateflow.com/api/health` returned `200`.
  - `https://locateflow.com/api/ready` returned `200`.
  - `https://www.locateflow.com/api/health` redirected to root and returned
    `200`.
  - `https://admin.locateflow.com/api/healthz` returned `200`.
  - `https://img.locateflow.com/` returned `200`.

## Final DB Count Check

Source and target counts matched:

- `Address`: 26
- `AddressChangeEvent`: 0
- `AdminUser`: 1
- `ConnectorDispatch`: 0
- `EmailLog`: 70
- `MoveTask`: 62
- `RuntimeConfigEntry`: 6
- `RuntimeConfigEntry_active`: 6
- `SavedProvider`: 1
- `ServiceProvider`: 888
- `Subscription`: 18
- `User`: 19
- `UserCustomProvider`: 0
- `_prisma_migrations`: 68

## Cron State

- GitHub scheduled cron was manually disabled before cutover.
- Dokploy Ofelia cron is now enabled by source change:
  `docker-compose.dokploy.yml` no longer gates `cron` behind the Compose
  profile.
- `locateflow-cron` is running in Dokploy after commit `6dbe3fbb`.

## Source DigitalOcean State

- DigitalOcean App Platform app: `8e21e9cb-722d-4c4d-9359-dcfd0d86c9ee`.
- DigitalOcean MySQL cluster:
  `e15c3c97-21cb-43b9-9ae1-5341ed3947eb`.
- The old DigitalOcean app firewall rule was removed during cutover to freeze
  writes.
- The temporary Dokploy IP firewall rule was removed after verification.
- Current DigitalOcean DB firewall list is empty.
- Keep DigitalOcean app and DB untouched for 7-14 days as rollback archive.

## Important Cleanup

- Remove the temporary Dokploy environment keys used only for final DB copy:
  - `SOURCE_MYSQL_HOST`
  - `SOURCE_MYSQL_PORT`
  - `SOURCE_MYSQL_USER`
  - `SOURCE_MYSQL_PASSWORD`
  - `SOURCE_MYSQL_DATABASE`
- Do not reveal or record any values while removing those keys.

## Rollback Notes

Rollback to DigitalOcean is only straightforward before new writes on Dokploy are
accepted. After Dokploy production writes begin, do not point DNS back to the old
DigitalOcean app without reconciling data created on Dokploy.

If rollback is still required, first re-allow the old DigitalOcean App Platform
app through the source DB firewall:

```powershell
doctl databases firewalls append e15c3c97-21cb-43b9-9ae1-5341ed3947eb --rule app:8e21e9cb-722d-4c4d-9359-dcfd0d86c9ee --context locateflow-migration
```

Then move Cloudflare records back to the old DigitalOcean target only after the
data decision is explicit.

## Follow-Up Checks

- Watch Dokploy logs for the first cron windows.
- Check Stripe webhook delivery, Resend email delivery, Runtime Config status,
  R2/image proxy behavior, login, admin login, dashboard load, and billing
  flows manually.
- Remove temporary `SOURCE_MYSQL_*` env keys from Dokploy.
- Keep GitHub scheduled cron disabled while Dokploy cron is running.
