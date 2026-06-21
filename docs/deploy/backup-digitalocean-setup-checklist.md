# Backup And DigitalOcean Setup Checklist

Purpose: prepare staging database, backups, offsite storage, and restore drill for current-product readiness.

## DigitalOcean Managed MySQL

Staging DB requirements:

- [ ] Dedicated staging database, separate from production.
- [ ] Managed backups/PITR enabled where available.
- [ ] Trusted sources/firewall allow Vercel serverless egress strategy.
- [ ] TLS required in `DATABASE_URL`.
- [ ] Migration user available for `prisma migrate deploy`.
- [ ] App DB user uses least privilege practical for the app.
- [ ] Connection limits checked for Vercel serverless behavior.

Example `DATABASE_URL` shape:

```text
mysql://USER:PASSWORD@HOST:PORT/DATABASE?ssl-mode=REQUIRED
```

Do not run staging migrations against production.

## Migration Checklist

```bash
pnpm --filter @locateflow/db generate
pnpm --filter @locateflow/db prisma migrate deploy
pnpm verify:typecheck
```

- [ ] Take DB snapshot/backup before migration.
- [ ] Run migration against staging.
- [ ] Verify `MoveTask`, `UserCustomProvider`, and `ProviderGovernanceIssue` tables exist.
- [ ] Verify indexes for user/task/status/action/service/provider/custom-provider/governance queues.
- [ ] Seed or create representative QA data.
- [ ] Create admin user.
- [ ] Run web/admin smoke tests.
- [ ] Run backup after migration.

## Offsite Backup Env

Admin staging env:

- `BACKUP_STORAGE_PROVIDER`
- `BACKUP_STORAGE_BUCKET`
- `BACKUP_STORAGE_REGION`
- `BACKUP_STORAGE_ENDPOINT`
- `BACKUP_STORAGE_ACCESS_KEY_ID`
- `BACKUP_STORAGE_SECRET_ACCESS_KEY`
- `FIELD_ENCRYPTION_KEY`
- `BACKUP_CRON_SECRET` (recommended; isolates backup cron from broader scheduler auth)

Offsite bucket requirements:

- [ ] S3-compatible bucket or Spaces/R2 bucket.
- [ ] Least-privilege key scoped to backup bucket.
- [ ] Encryption enabled.
- [ ] Lifecycle retention configured.
- [ ] Access logging enabled where available.
- [ ] Delete permissions limited and reviewed.

## Restore Drill

1. Create disposable staging database.
2. Run migrations.
3. Create representative data, including move tasks, custom providers, and provider governance issues.
4. Create encrypted/signed backup.
5. Upload backup to offsite storage.
6. Download backup from offsite storage.
7. Verify backup.
8. Dry-run import.
9. Restore/import into disposable DB.
10. Verify table counts and relationships.
11. Start web/admin against restored DB.
12. Smoke test auth, services, custom providers, move tasks, admin governance, and export.
13. Record observed RPO/RTO.

## Launch Status

Backup scope includes the new current-product tables, but launch readiness remains YELLOW until a real offsite backup and restore drill is completed.
