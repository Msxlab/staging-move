# LocateFlow — Production Deployment

This guide deploys the full stack (MySQL + web + admin + reverse proxy + cron)
to a single VPS using Docker Compose.

## Prerequisites

- A VPS with **Docker Engine 24+** and **Docker Compose v2**.
- Two DNS A/AAAA records pointing at the VPS:
  - `app.yourdomain.com` (web client)
  - `admin.yourdomain.com` (admin panel)
- Ports **80** and **443** open on the firewall.
- At least **2 GB RAM** (4 GB recommended for build-time).
- At least **10 GB disk** (MySQL + images + logs).

## Quick start

```bash
# 1. Clone repo
git clone <repo-url> locateflow && cd locateflow

# 2. Copy env template and fill in secrets
cp .env.production.example .env.production
# edit .env.production — read the comments carefully

# 3. Bring everything up (first run builds images + runs migrations)
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# 4. Verify
docker compose -f docker-compose.prod.yml ps
curl -fsS https://app.yourdomain.com/api/health | jq '.status'
curl -fsS https://admin.yourdomain.com/api/health | jq '.status'
```

Both should return `"healthy"`. If Caddy is still provisioning TLS, wait ~30
seconds and retry — the first boot requests Let's Encrypt certs.

## Generating secrets

```bash
# 32-byte hex — used for ADMIN_JWT_SECRET and FIELD_ENCRYPTION_KEY
openssl rand -hex 32

# 36-byte base64url — used for CRON_SECRET
openssl rand -base64 36 | tr '+/' '-_' | tr -d '='

# Strong admin password (min 16 chars + upper + lower + digit + special)
# Generate and keep it out of the repo/commit history:
LC_ALL=C tr -dc 'A-Za-z0-9!@#$%&*' < /dev/urandom | head -c 20; echo
```

## Architecture

```
Internet ──▶ Caddy (:443) ──┬─▶ web:3000      (Next.js standalone)
                            └─▶ admin:3001    (Next.js standalone)
                                 │
                                 └─▶ mysql:3306 (internal network only)

                         Ofelia daemon ──(docker exec + wget)──▶ web / admin
```

- **mysql** — data persisted in the `mysql_data` volume.
- **migrate** — one-shot service; runs `prisma migrate deploy` then
  `seed-admin`. Exits 0. Other services wait for it via `depends_on`.
- **web** and **admin** — each Next.js app shipped as a Node.js
  `standalone` bundle. Non-root user, healthcheck on `/api/health`.
- **caddy** — automatic Let's Encrypt TLS, strips spoofable forwarded
  headers, forwards real client IP. Certs cached in `caddy_data` volume.
- **cron** — [mcuadros/ofelia](https://github.com/mcuadros/ofelia) runs
  scheduled commands inside the web/admin containers using `docker exec`.
  Schedules live in `docker/ofelia.ini`.

## Common operations

```bash
# Tail logs for a single service
docker compose -f docker-compose.prod.yml logs -f web

# Re-run migrations after a schema change (code is already deployed)
docker compose -f docker-compose.prod.yml run --rm migrate

# Open a shell inside the web container
docker compose -f docker-compose.prod.yml exec web sh

# Full rebuild after pulling new code
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# Manually trigger a cron job
docker compose -f docker-compose.prod.yml exec web \
  wget -qO- --header="Authorization: Bearer $CRON_SECRET" \
    http://localhost:3000/api/cron/weekly-digest

# Database backup
docker compose -f docker-compose.prod.yml exec -T mysql \
  mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" \
  > "backup-$(date +%F).sql"
```

## Updating an existing install

1. Back up the database (command above).
2. `git pull` to fetch new code.
3. If the PR touches `prisma/schema.prisma`, a new migration file lives
   under `packages/db/prisma/migrations/`. No manual step — the `migrate`
   service applies it before web/admin restart.
4. `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build`

## Security checklist

- [ ] `.env.production` is **not** in version control (`.gitignore` it).
- [ ] All `CHANGE_ME_` placeholders replaced with high-entropy values.
- [ ] Firewall allows only 80/443 from public internet.
- [ ] MySQL port **3306** is NOT exposed to the host (check `ports:` —
      our compose uses `expose:` only; do not add public ports).
- [ ] `ADMIN_SEED_PASSWORD` rotated immediately after first admin login.
- [ ] Host OS automatic security updates enabled (`unattended-upgrades`
      on Debian/Ubuntu).
- [ ] Regular offsite backups of the `mysql_data` volume.
- [ ] DNS CAA records limit cert issuance to `letsencrypt.org`.

## Managed Runtime Config

LocateFlow supports a managed runtime-config catalog in the admin panel at
`/runtime-config`. The source-of-truth for supported keys lives in
`packages/shared/src/runtime-config.ts`, and values can come from either:

- deployment env vars (`.env.production` / container env)
- encrypted DB overrides managed by `SUPER_ADMIN`

Step-up password confirmation is required before changing or resetting a key.
Resetting a key disables the DB override and falls back to the deployment env.

Keys that are especially important to set at deploy time:

- `USER_JWT_SECRET`
- `FIELD_ENCRYPTION_KEY`
- `CRON_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_INDIVIDUAL`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `GOOGLE_MAPS_API_KEY`

Optional but supported offsite backup settings:

- `BACKUP_STORAGE_PROVIDER`
- `BACKUP_STORAGE_BUCKET`
- `BACKUP_STORAGE_REGION`
- `BACKUP_STORAGE_ENDPOINT`
- `BACKUP_STORAGE_ACCESS_KEY_ID`
- `BACKUP_STORAGE_SECRET_ACCESS_KEY`

## Troubleshooting

**TLS cert fails to provision.**
- Check DNS actually points at the VPS: `dig app.yourdomain.com`.
- Check ports 80/443 reachable: `curl -vI http://app.yourdomain.com`.
- View Caddy logs: `docker compose logs caddy | grep -i acme`.

**`migrate` container keeps exiting non-zero.**
- Usually `ADMIN_SEED_PASSWORD` fails the complexity check. The error
  message tells you which rule failed.
- Or the DB is not yet healthy; compose waits but the healthcheck may
  need more retries on slow disks — bump `retries: 20` higher.

**Web container unhealthy immediately.**
- `docker compose logs web` will show the Next.js startup crash.
- Most common: a required `FIELD_ENCRYPTION_KEY` or `ADMIN_JWT_SECRET`
  is missing or too short.

## Auth (Phase D)

Clerk has been removed. Auth runs in-house with JWT cookies (web) + Bearer
tokens (mobile), plus Google / Apple OAuth. Configuration checklist:

1. **Generate `USER_JWT_SECRET`** — min 32 chars:
   ```bash
   openssl rand -hex 32
   ```
2. **Google OAuth** (optional but recommended):
   - Google Cloud Console → APIs & Services → Credentials → OAuth client ID
     → "Web application".
   - Authorized redirect URI:
     `https://app.yourdomain.com/api/auth/oauth/google/callback`
   - Put the client ID/secret into `.env.production`.
3. **Apple OAuth** (mandatory for iOS App Store):
   - https://developer.apple.com → Certificates, Identifiers & Profiles
   - Register a **Services ID** (this is `APPLE_OAUTH_CLIENT_ID`) with
     Return URL `https://app.yourdomain.com/api/auth/oauth/apple/callback`.
   - Generate a **Sign in with Apple** key (p8 file). Paste full PEM
     contents (including `-----BEGIN/END PRIVATE KEY-----`) into
     `APPLE_OAUTH_PRIVATE_KEY`. Keep team ID + key ID handy.
4. **MFA (2FA)** — enabled per user via `/settings/privacy`. Nothing to
   configure at the deploy layer.

### Removed Clerk variables

Delete these from any prior `.env` — they are no longer read:
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`,
`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, `DEV_AUTH_BYPASS`.
