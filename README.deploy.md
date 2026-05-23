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

## DigitalOcean Managed MySQL

If you use DigitalOcean Managed MySQL instead of the local MySQL container,
set `DATABASE_URL` in `.env.production`:

```bash
DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/DATABASE?ssl-mode=REQUIRED"
```

Then deploy with the DigitalOcean override:

```bash
docker compose \
  -f docker-compose.prod.yml \
  -f docker-compose.digitalocean.yml \
  --env-file .env.production \
  up -d --build
```

The override disables the local `mysql` service and points `migrate`, `web`,
and `admin` directly at the managed database.

For the current LocateFlow production server (`locateflow-prod-nyc3`), always
use the DigitalOcean override. Running `docker-compose.prod.yml` by itself will
start a fresh local MySQL container and will not use the managed production DB.

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
# On locateflow-prod-nyc3, define this helper first:
dc() {
  docker compose \
    --env-file .env.production \
    -f docker-compose.prod.yml \
    -f docker-compose.digitalocean.yml \
    "$@"
}

# Tail logs for a single service
dc logs -f web

# Re-run migrations after a schema change (code is already deployed)
dc up --force-recreate migrate

# Open a shell inside the web container
dc exec web sh

# Full rebuild after pulling new code
git pull
dc up -d --build

# Manually trigger a cron job
dc exec web \
  wget -qO- --header="Authorization: Bearer $CRON_SECRET" \
    http://localhost:3000/api/cron/weekly-digest

# Database backup when using the bundled local mysql service
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
4. On `locateflow-prod-nyc3`, use the `dc` helper above and run
   `dc up -d --build`. On single-VPS local MySQL installs, run
   `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build`.

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
- [ ] `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` set in
      production; `/api/health` should report Redis `ok`, not in-memory
      fallback.
- [ ] `NEXT_PUBLIC_SENTRY_DSN` points at the GlitchTip project on
      `https://errors.yourdomain.com`.
- [ ] `IMPERSONATION_HANDOFF_SECRET` is set on both web and admin. Do not
      reuse `CRON_SECRET` for impersonation.
- [ ] Root SSH login disabled after a non-root `deploy` user has been tested.

## Host SSH hardening

Run these steps from an existing root session, but keep that root session open
until a new `deploy` SSH login has been tested in a second terminal.

```bash
adduser deploy
usermod -aG sudo,docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys

# In a second terminal, verify this works before changing sshd:
ssh deploy@your-server
```

After the `deploy` login works:

```bash
cat >/etc/ssh/sshd_config.d/99-locateflow-hardening.conf <<'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
EOF

sshd -t
systemctl reload ssh
apt-get update
apt-get install -y fail2ban
systemctl enable --now fail2ban
```

## Env rotation hygiene

Keep `.env.production` backups local to the server, mode `600`, and retain only
the newest three copies. Install this helper as `/usr/local/bin/rotate-env.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=/opt/locateflow/.env.production
TS=$(date +%Y%m%d%H%M%S)

install -m 600 "$ENV_FILE" "$ENV_FILE.bak.$TS"
find /opt/locateflow -maxdepth 1 -name '.env.production.bak.*' \
  -type f -printf '%T@ %p\n' \
  | sort -rn \
  | awk 'NR>3 {print $2}' \
  | xargs -r rm --
```

Then run:

```bash
chmod 700 /usr/local/bin/rotate-env.sh
/usr/local/bin/rotate-env.sh
find /opt/locateflow -maxdepth 1 -name '.env.production.bak.*' -type f -ls
```

Remove accidental trailing-dot backups such as `.env.production.bak.` after
confirming a timestamped backup exists.

## Incident response

For a suspected admin compromise:

1. Revoke admin sessions from the admin UI under Settings -> Health/Sessions,
   or call `POST /api/auth/sessions` with `{"action":"revoke_all","revokeAll":"all"}`
   as a `SUPER_ADMIN`.
2. Rotate `ADMIN_JWT_SECRET`, `USER_JWT_SECRET`, `FIELD_ENCRYPTION_KEY`,
   `CRON_SECRET`, `INTERNAL_WEBHOOK_SECRET`, and
   `IMPERSONATION_HANDOFF_SECRET` as appropriate.
3. Rebuild and restart web/admin:
   `dc up -d --build web admin` on `locateflow-prod-nyc3`.
4. Check `AdminAuditLog`, `AdminLoginLog`, GlitchTip, and Caddy logs for the
   compromise window.

For leaked env or provider credentials, rotate the upstream provider secret
first, update `.env.production`, run `rotate-env.sh`, then restart affected
services.

## Restore testing

Run a monthly restore drill against a temporary database:

```bash
docker compose -f docker-compose.prod.yml exec -T mysql \
  mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" \
  > "restore-test-source-$(date +%F).sql"
```

Create a throwaway MySQL instance, restore the dump, run `prisma migrate
deploy`, then verify web `/api/health` against that database. For admin backup
archives, download the newest offsite backup and perform a `DRY_RUN` import
first; `MERGE` and `REPLACE` require a valid HMAC signature.

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
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_PRICE_INDIVIDUAL_MONTHLY`
- `STRIPE_PRICE_INDIVIDUAL_YEARLY`
- `STRIPE_ANNUAL_TRIAL_DAYS`
- `NEXT_PUBLIC_IOS_APP_STORE_URL`
- `NEXT_PUBLIC_ANDROID_PLAY_STORE_URL`
- `NEXT_PUBLIC_IOS_APP_STORE_ID`
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

## Blog & SEO (M14)

The blog system reuses your existing MySQL database, R2 bucket, and
imgproxy container — no new infrastructure required.

### Required env

| Var                          | Where used | Purpose |
|------------------------------|------------|---------|
| `INTERNAL_WEBHOOK_SECRET`    | web + admin | HMAC for the publish → revalidate webhook |
| `ADMIN_JWT_SECRET`           | web + admin | Signs preview-token JWTs |
| `R2_*` + `IMGPROXY_*`        | web + admin | Cover/inline image pipeline (already wired) |
| `INDEXNOW_KEY` (optional)    | web         | Bing/Yandex push-indexing on publish |

`INDEXNOW_KEY` is a 32-character hex string you choose once and never
change:

```bash
openssl rand -hex 32
```

The web app serves it back at `/api/blog/indexnow-key/<key>` — no
filesystem step needed. After your first deploy, register the host on
[bing.com/indexnow](https://www.bing.com/indexnow) using that URL.

### Migration

Schema lives in `packages/db/prisma/schema.prisma`; the migration is
in `prisma/migrations/20260430000000_blog_system/`. The first
`docker compose ... up` after pulling these changes runs the
`migrate` service automatically (`prisma migrate deploy`). Manually:

```bash
docker compose -f docker-compose.prod.yml run --rm migrate
```

### Cron

Two new Ofelia jobs (already in `docker/ofelia.ini`):
- `blog-publish` — every minute; promotes `SCHEDULED → PUBLISHED`.
- `blog-cleanup` — daily 04:30 UTC; prunes BlogView and old
  BlogRevision rows (90-day retention).

### Search Console

Submit `https://your-domain/sitemap.xml` once via Google Search
Console + Bing Webmaster Tools. After that, Google rediscovers new
posts via the sitemap (revalidated on every publish), and Bing/Yandex
get instant pings via IndexNow.

Feeds are available at `/blog/feed.xml` (RSS 2.0) and `/blog/atom.xml`
(Atom 1.0).

### AI crawler policy

`apps/web/src/app/robots.ts` allows GPTBot, ClaudeBot, PerplexityBot,
Google-Extended, CCBot, Applebot-Extended, OAI-SearchBot,
ChatGPT-User, anthropic-ai, meta-externalagent, cohere-ai,
DuckAssistBot, and YouBot. Bytespider (TikTok) is disallowed. To
flip a bot, edit `AI_BOTS_ALLOW` / `AI_BOTS_DISALLOW` in that file.

The site also publishes `/llms.txt` — a markdown index of docs +
recent posts that AI answer-engines can ingest in one fetch.
