# Dokploy Migration Runbook

This runbook moves LocateFlow from DigitalOcean App Platform plus managed
MySQL to Dokploy plus Dokploy-hosted MySQL 8 using the same public domains.

Do not paste secrets, database rows, customer PII, private keys, or `.env`
contents into chat, tickets, docs, or logs. Use this runbook as an operator
checklist and record only key names, masked indicators, counts, statuses, and
timestamps.

## Scope

- Source: DigitalOcean App Platform components plus DigitalOcean managed MySQL.
- Target: Dokploy Docker Compose using `docker-compose.dokploy.yml`.
- Domains stay the same:
  - `https://locateflow.com` -> Dokploy service `web`, port `3000`
  - `https://admin.locateflow.com` -> Dokploy service `admin`, port `3001`
  - `https://img.locateflow.com` -> Dokploy service `imgproxy`, port `8080`
- Cron source after cutover: Dokploy/Ofelia only.
- GitHub scheduled cron must be disabled before Dokploy cron is enabled.
- App-level backup is not the primary migration path. Use a whole MySQL dump or
  provider snapshot for the migration, because RuntimeConfigEntry and all
  Prisma tables must be preserved.

## Stop Conditions

Stop before cutover if any of these are true:

- `FIELD_ENCRYPTION_KEY` cannot be verified as copied exactly from old prod to
  Dokploy.
- DigitalOcean managed MySQL backup/snapshot is not current.
- Final dump cannot be created with `--single-transaction`.
- Dokploy MySQL restore rehearsal has not completed successfully.
- Runtime Config active count or `_prisma_migrations` count does not match.
- `/api/ready` returns failures after the rehearsal restore.
- GitHub scheduled cron cannot be paused.
- Stripe, email, OAuth, R2/imgproxy, or DNS ownership cannot be verified.

## 1. Pre-Migration Inventory

Record only key names and statuses.

1. DigitalOcean App Platform:
   - Component names for web and admin.
   - Build method and run command for each component.
   - Public routes/domains.
   - Runtime env key names present per component.
   - Database connection source, without printing the URL.
2. Admin Runtime Config:
   - Open Runtime Config as a super admin.
   - Record each configured key as `ENV`, `Runtime Config`, `ENV + Runtime Config`, or `Missing`.
   - Record conflicts and invalid statuses.
   - Do not reveal or copy values into the record.
3. MySQL:
   - MySQL version.
   - Database size.
   - Latest managed backup/snapshot timestamp.
   - `_prisma_migrations` row count.
   - `RuntimeConfigEntry` total and active row counts.

Recommended presence-only local check after the Dokploy env is prepared:

```bash
node scripts/dokploy-env-audit.mjs --env-file .env
```

The script prints key names only. It does not print values.

## 2. Dokploy Preparation

1. Create a Dokploy Compose service from the repository.
2. Use compose path:

```text
./docker-compose.dokploy.yml
```

3. Configure Dokploy environment variables from DigitalOcean and Runtime Config
   inventory. Values must be copied by the operator, not pasted into chat.
4. Configure Dokploy domains:
   - `locateflow.com` -> `web:3000`
   - `admin.locateflow.com` -> `admin:3001`
   - `img.locateflow.com` -> `imgproxy:8080`
5. Do not point live DNS to Dokploy yet.
6. Confirm the generated compose is valid in Dokploy Preview Compose, or from a
   trusted shell with a non-production env file:

```bash
docker compose --env-file .env -f docker-compose.dokploy.yml config --quiet
```

7. Confirm no public host port is published for MySQL. The `mysql` service must
   use only the internal Docker network and the `mysql_data` volume.

## 3. Rehearsal Restore

Use a fresh rehearsal dump from DigitalOcean managed MySQL. Do not run these
commands from chat; run them from an approved operator shell.

Source dump shape:

```bash
mysqldump \
  --host="$DO_DB_HOST" \
  --port="$DO_DB_PORT" \
  --user="$DO_DB_USER" \
  --password="$DO_DB_PASSWORD" \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  --hex-blob \
  --default-character-set=utf8mb4 \
  "$DO_DB_NAME" \
  > locateflow-rehearsal.sql
```

Restore into Dokploy MySQL only after confirming the target is a disposable
rehearsal target:

```bash
docker compose --env-file .env -f docker-compose.dokploy.yml up -d mysql
docker compose --env-file .env -f docker-compose.dokploy.yml exec -T mysql \
  mysql -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" \
  < locateflow-rehearsal.sql
```

Run migration status without applying new production work:

```bash
docker compose --env-file .env -f docker-compose.dokploy.yml run --rm migrate \
  pnpm --filter @locateflow/db exec prisma migrate status
```

Compare source and target:

```sql
SELECT COUNT(*) AS migrations FROM _prisma_migrations;
SELECT COUNT(*) AS runtime_config_entries FROM RuntimeConfigEntry;
SELECT COUNT(*) AS active_runtime_config_entries FROM RuntimeConfigEntry WHERE isActive = 1;
SELECT COUNT(*) AS users FROM User;
SELECT COUNT(*) AS admin_users FROM AdminUser;
SELECT COUNT(*) AS addresses FROM Address;
SELECT COUNT(*) AS services FROM Service;
SELECT COUNT(*) AS move_tasks FROM MoveTask;
SELECT COUNT(*) AS subscriptions FROM Subscription;
```

Then start the app stack:

```bash
docker compose --env-file .env -f docker-compose.dokploy.yml up -d --build migrate web admin imgproxy
```

Health checks:

```bash
curl -fsS https://locateflow.com/api/health
curl -fsS https://locateflow.com/api/ready
curl -fsS https://admin.locateflow.com/api/healthz
```

If live DNS still points to DigitalOcean, use a temporary Dokploy domain or
operator-approved Host-header test instead of the live URLs.

## 4. Cutover Window

Target window: 15-30 minutes.

1. Announce maintenance and freeze writes.
2. Disable GitHub scheduled cron workflow for `Scheduled cron jobs`.
3. Confirm Dokploy cron is not yet running against live data.
4. Take a final DigitalOcean managed MySQL backup/snapshot.
5. Create final dump with the same `mysqldump` options used in rehearsal.
6. Restore final dump into the Dokploy MySQL target.
7. Start Dokploy:

```bash
docker compose --env-file .env -f docker-compose.dokploy.yml up -d --build
```

8. Confirm:
   - `migrate` exits successfully.
   - `web`, `admin`, `mysql`, `imgproxy`, and `cron` are healthy/running.
   - `/api/health`, `/api/ready`, and admin `/api/healthz` pass.
9. Switch DNS to Dokploy.
10. Enable Dokploy cron only after public health checks pass.
11. Keep DigitalOcean app and managed DB untouched for 7-14 days as rollback
    evidence.

## 5. Post-Cutover QA

Run these checks without exposing secrets or PII:

- Web login.
- Admin login.
- Dashboard load.
- Address and service list load for a QA account.
- Admin Runtime Config page: no unexpected missing/invalid/conflict statuses.
- Stripe webhook delivery status in Stripe dashboard.
- Stripe checkout/portal safe smoke.
- Resend email safe smoke.
- Google Maps/static map safe smoke.
- R2 upload/read or existing image load through `img.locateflow.com`.
- Ofelia cron logs show only Dokploy cron firing.
- GitHub scheduled cron remains disabled.

Suggested cron smoke calls from inside the Dokploy network:

```bash
docker compose --env-file .env -f docker-compose.dokploy.yml exec web \
  wget -qO- --header="Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/trial-check

docker compose --env-file .env -f docker-compose.dokploy.yml exec web \
  wget -qO- --header="Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/stripe-reconcile

docker compose --env-file .env -f docker-compose.dokploy.yml exec admin \
  wget -qO- --post-data="" --header="Authorization: Bearer $CRON_SECRET" \
  http://localhost:3001/api/cron/backup
```

## 6. Rollback Rules

Rollback by DNS only before new writes are accepted on Dokploy.

After Dokploy accepts user writes, do not simply point DNS back to
DigitalOcean. First decide how to reconcile writes made against the Dokploy DB.

Rollback checklist before DNS reversal:

- Dokploy cron stopped.
- No new Dokploy writes, or all writes are identified and accepted as lost.
- DigitalOcean app and DB still unchanged since cutover freeze.
- Stripe webhook endpoint behavior understood so events do not double-apply.
- Operator signs off on data-loss risk.

## 7. Handoff Record

Record after the migration:

- Source backup/snapshot timestamp.
- Final dump start/end time.
- Restore start/end time.
- Migration status result.
- Key table counts.
- Runtime Config count and conflict status.
- Health check timestamps.
- DNS cutover timestamp.
- Cron source confirmation.
- Any rollback risk or follow-up.
