# Flow Audit: Cron And Webhooks

Status: sampled.

## Verified Flow Components

- Web cron guard uses internal secret verification.
- Admin/web internal secret helpers exist.
- CI/cron workflow config exists.
- Production-like cron runner script exists.
- Billing webhooks use signature/audience/package checks and idempotency in inspected Stripe, App Store, and Play Store routes.
- Connector webhooks use HMAC verification, fail-closed secret handling, idempotency, and terminal-dispatch checks in the inspected route.
- Connector dispatch cron uses `guardCronRequest` and feature gating in the inspected route.

Evidence:

- `apps/web/src/lib/cron-guard.ts:51`
- `apps/web/src/lib/cron-guard.ts:60`
- `apps/web/src/lib/internal-secrets.ts:49`
- `apps/admin/src/lib/internal-secrets.ts:28`
- `.github/workflows/cron.yml`
- `docker/locateflow-cron-runner.sh`
- `docs/audit/reports/billing-iap-route-matrix.md`
- `docs/audit/reports/connectors-address-change-route-matrix.md`

## Not Verified In Code

- Every cron/webhook route outside the inspected billing and connector subset has replay protection and idempotency.
- Current runtime secret values/scoping.
- Production scheduler ownership and disable flags.

## Recommendation

- Produce a route matrix for cron/webhooks with secret bucket, method, idempotency key, retry behavior, and tests.
