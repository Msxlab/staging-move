# Security Hardening Handoff

## Scope

- Branch: `codex/security-hardening`
- Base: `move-main/main` at `e1221659`
- No deploy, no push to main, no flag change, no telemetry config change, and no DB migration applied.
- A clean worktree was used at `C:\Users\Windows\Documents\move-main\security-hardening-worktree` because the original checkout had unrelated local dirt.

## Re-verification Results

| Risk | Current status | Evidence | Action in this pass |
|---|---|---|---|
| RISK-001 startup runs migrations | Still applies | `package.json:8` starts with `pnpm db:migrate:deploy`; `Dockerfile:128` runs `prisma migrate deploy --schema packages/db/prisma/schema.prisma && exec node apps/web/server.js`. | No code change. Deployment/startup flow is infra-sensitive. |
| RISK-002 process-local fallback without Upstash | Still applies, with mitigations | Web limiter logs and falls back to memory when Redis is missing in production (`apps/web/src/lib/rate-limit.ts:238`, `:286`); admin step-up falls back to memory when Redis is not configured (`apps/admin/src/lib/auth-step-up-store.ts:17`, `:79`); admin distributed locks fall back to memory (`apps/admin/src/lib/distributed-lock.ts:54`). Current readiness surfaces production config gaps. | No code change. Fold into deploy hardening. |
| RISK-003 SQL dump filename header | Confirmed and fixed | Before: `Content-Disposition` used only `filename="${fileName}"` with DB-derived `conn.database`. After: filename is sanitized and header includes RFC 5987 `filename*`. | Fixed with tests. |
| RISK-004 legacy partner-consent refresh route | Confirmed and fixed | Before: `apps/web/src/app/api/partner-consents/[id]/refresh/route.ts` duplicated cron refresh behind non-public middleware. Canonical route remains `/api/cron/partner-consents/[id]/refresh`. | Removed dead legacy route and added middleware boundary test. |
| RISK-005 nullable `MobileOAuthCode.codeChallenge` | Still applies | `packages/db/prisma/schema.prisma:129` remains `codeChallenge String? @db.VarChar(128)`. Runtime already rejects null exchange records. | No migration applied. Proposal below. |

## Fixes Made

### RISK-003

- Added `sanitizeAttachmentFilename`, `encodeRfc5987Value`, and `contentDispositionAttachment`.
- SQL dump downloads now emit:

```text
Content-Disposition: attachment; filename="<ascii-safe>.sql.gz"; filename*=UTF-8''<rfc5987-safe>.sql.gz
```

- Added tests for normal download headers and weird DB-name/header-injection inputs.

### RISK-004

- Deleted the dead legacy route:

```text
apps/web/src/app/api/partner-consents/[id]/refresh/route.ts
```

- Preserved the canonical scheduler-safe route:

```text
apps/web/src/app/api/cron/partner-consents/[id]/refresh/route.ts
```

- Added middleware test confirming the old non-cron path stays sealed outside `/api/cron/` even when a cron credential is presented.

## Recommendations Not Applied

### RISK-001 deploy/startup migration split

Do not run `prisma migrate deploy` inside app startup. Recommended safe order:

1. Add or keep an explicit migration command/job that runs once per release.
2. Run migrations before new web containers are marked ready.
3. Change `package.json start` to start only the app server.
4. Change the Docker `CMD` to start only `node apps/web/server.js` after config validation.
5. Confirm rollback semantics for forward-compatible migrations before changing production deploy.

This should be coordinated with the active Dokploy/deploy work instead of surprise-changing startup behavior in this pass.

### RISK-002 Redis/Upstash fallback policy

Treat distributed limiter/step-up/lock state as required in production-like environments:

1. Keep memory fallback for local development and tests.
2. Ensure `/api/ready` or the platform health gate blocks production traffic when Upstash config is missing.
3. Prefer fail-closed behavior for auth/step-up/lock paths when Redis is configured but unavailable.
4. Add deploy documentation that production/staging must provide `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
5. Verify the admin health/readiness surfaces are monitored before changing fail modes.

### RISK-005 nullable PKCE challenge migration proposal

Do not apply this without explicit DB migration approval.

Proposed plan:

1. Preflight:

```sql
SELECT COUNT(*) FROM MobileOAuthCode WHERE codeChallenge IS NULL;
SELECT COUNT(*) FROM MobileOAuthCode WHERE codeChallenge IS NULL AND usedAt IS NULL AND expiresAt > NOW();
```

2. Because PKCE challenges cannot be reconstructed from existing rows, do not invent values.
3. Wait at least the max `MobileOAuthCode` TTL after runtime enforcement, or explicitly expire/delete any remaining null rows if product/legal approves.
4. Backfill/cleanup:

```sql
DELETE FROM MobileOAuthCode WHERE codeChallenge IS NULL AND (usedAt IS NOT NULL OR expiresAt <= NOW());
```

5. If any active null rows remain, wait for expiry or mark them expired in a separately approved operational cleanup.
6. Prisma/schema migration:

```prisma
codeChallenge String @db.VarChar(128)
```

```sql
ALTER TABLE MobileOAuthCode MODIFY codeChallenge VARCHAR(128) NOT NULL;
```

7. Run Prisma generate and full auth/mobile OAuth tests after approval.

## Tests Run

Installed dependencies in the clean worktree with:

```powershell
pnpm install --frozen-lockfile
```

Results:

```powershell
pnpm --filter @locateflow/admin test -- src/app/api/backup/sql-dump/route.test.ts
```

- Passed: 1 test file / 6 tests.

```powershell
pnpm --filter @locateflow/web test -- src/middleware.test.ts src/app/api/cron/partner-consents/[id]/refresh/route.test.ts
```

- Passed: 2 test files / 38 tests.

```powershell
pnpm verify:typecheck
```

- Failed on current-main code unrelated to this hardening pass:

```text
src/app/onboarding/page.tsx(2179,1): error TS1005: '}' expected.
```

- `apps/web/src/app/onboarding/page.tsx` has no diff on `codex/security-hardening` versus `move-main/main`, so this is a pre-existing current-main blocker.

All commands emitted the local Node warning: repo wants Node `22.x`, current runtime was `v24.13.0`.

## Changed Files

- `apps/admin/src/app/api/backup/sql-dump/route.ts`
- `apps/admin/src/app/api/backup/sql-dump/route.test.ts`
- `apps/web/src/app/api/partner-consents/[id]/refresh/route.ts` deleted
- `apps/web/src/middleware.test.ts`
- `docs/ai/handoffs/2026-06-16-133907-security-hardening.md`

## Stop Point

RISK-001, RISK-002, and RISK-005 require deploy/infra or migration approval. No DB migration was created or applied.
