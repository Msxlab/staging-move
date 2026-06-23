# Module Audit: API, Cron, Webhooks, Integrations

Status: sampled.

## Source Inspected

- `apps/web/src/lib/cron-guard.ts`
- `apps/web/src/lib/internal-secrets.ts`
- `apps/admin/src/lib/internal-secrets.ts`
- sampled cron/internal/webhook/postback routes
- `.github/workflows/cron.yml`
- `docker/locateflow-cron-runner.sh`

## Verified Facts

- Web cron guard uses `verifyInternalAuth`.
- Admin and web internal secret helpers exist.
- Sampled internal routes use `verifyInternalAuth`.
- Apple/Google webhook routes include verification patterns in sampled source.
- Affiliate postback route uses HMAC verification in sampled source.

Evidence:

- `apps/web/src/lib/cron-guard.ts:51`
- `apps/web/src/lib/cron-guard.ts:60`
- `apps/web/src/lib/internal-secrets.ts:49`
- `apps/admin/src/lib/internal-secrets.ts:28`

## Findings

No unguarded sampled cron/internal route was verified in this pass.

## Not Verified In Code

- Full list of every cron/internal/webhook route and auth boundary.
- Current runtime secret rotation and scoping.
- Replay resistance and idempotency for every webhook/integration.

## Next Steps

- Generate a route matrix specifically for cron/internal/webhook routes.
- Verify idempotency model and tests for each external provider.
