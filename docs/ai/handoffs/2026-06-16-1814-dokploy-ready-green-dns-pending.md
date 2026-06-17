# Dokploy Ready Green, DNS Pending Handoff

Date: 2026-06-16

## Summary

Dokploy rehearsal stack was redeployed after backup storage credentials were
added in Dokploy. The application readiness check now passes against the
Dokploy server when the live hostnames are resolved to the Dokploy IP.

No secrets, `.env` values, customer PII, private keys, certificates, or
production database row contents were recorded in this handoff.

## Verified

- `locateflow-web` is running and healthy in Dokploy.
- `locateflow-admin` is running and healthy in Dokploy.
- `locateflow-mysql` is running and healthy in Dokploy.
- `locateflow-migrate` exited with code `0`.
- `locateflow-imgproxy` is running.
- `locateflow-cron` is still not running because the cron compose profile has
  not been enabled.
- Forced-resolution checks to the Dokploy server returned:
  - `https://locateflow.com/api/health`: `200`
  - `https://locateflow.com/api/ready`: `200`
  - `https://admin.locateflow.com/api/healthz`: `200`

## Not Cut Over

- Public DNS still resolves through Cloudflare to the current live DigitalOcean
  app path.
- No DNS records were changed.
- GitHub scheduled cron was not changed.
- DigitalOcean app and database remain live.
- Final dump/restore/cutover has not been performed.

## TLS Note

Strict TLS checks directly against the Dokploy IP fail with an untrusted
certificate. This is expected for the current rehearsal state because the live
hostnames still point through Cloudflare/DigitalOcean and the Dokploy domains
were created before final DNS cutover.

Dokploy documentation says custom domains should point to the Dokploy server
before selecting Let's Encrypt, and if a domain is added first the certificate
may need to be recreated or Traefik restarted.

## Next Steps

1. Keep DigitalOcean live until a final cutover window is approved.
2. During cutover, freeze writes and disable the old scheduled cron source.
3. Take a final DigitalOcean MySQL dump and restore it into Dokploy MySQL.
4. Re-run row-count and readiness checks.
5. Update Cloudflare DNS records for `locateflow.com`,
   `admin.locateflow.com`, and any image hostname to the Dokploy server.
6. Recreate or update Dokploy domain certificate settings to use a trusted
   certificate path appropriate for Cloudflare/Dokploy.
7. Enable Dokploy cron only after post-DNS health checks pass.
