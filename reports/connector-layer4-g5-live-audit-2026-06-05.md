# LocateFlow Connector Layer-4 / G5 Live Audit - 2026-06-05

Scope: audit the recent connector Layer-4, fallback, timeline, docs/runbook, and G5 async-confirm changes; run real local tests/builds; perform live read-only production smoke checks after the deployed branch. No live charges, production store rollout, secret rotation, legal terms acceptance, or irreversible production actions were performed.

## Audited Head

- Branch: `codex/release-readiness-mobile-billing-guards`
- Audited commit: `9f186f4` - `test(connectors): cover async-confirm connector path (G5)`
- DigitalOcean deployment observed before this report commit: `2cc87963-c758-4027-b65b-14b23317d5e6`, phase `ACTIVE`

## Verdict

The changes are sensible and launch-safe in their current state.

- G5 is a valid contract/regression test for async connector behavior: async-confirm connectors can submit without immediate read-back verification, and webhook parsing can map an external reference back to a connector result.
- SHADOW dispatch logic is inert by design: it does not call partner `push()`, does not require production partner credentials, marks rows as `isShadow`, and excludes shadow rows from user-facing timeline/accounting.
- Fallback action hardening is appropriate: admin fallback CRUD is permission-gated/audit-logged, unsafe URL protocols are rejected, and unsafe rendered fallback URLs do not reach the user.
- Timeline API is appropriately scoped: it requires an authenticated user, returns only that user's connector changes, excludes SHADOW rows, and does not select encrypted payload/confirmation fields.
- Webhook route behavior is fail-closed: global connector flag, signature secret, HMAC signature, idempotency, terminal-state handling, and circuit/kill-switch checks are covered.
- Partner/SOC2 can remain deferred for consumer launch, affiliate/lightweight revenue, and SHADOW/guided connector validation. Real USPS push still requires a real authorized-agent agreement.

## Important Residual Risk

G5 is not proof that a real live async partner connector exists in production. The current registered connector map still contains the built-in USPS connector, which is sync/read-back oriented and does not expose `parseWebhook` in production. The G5 work is valuable contract coverage and route harness coverage, but live async partner validation remains future work when an async partner connector is actually registered.

## Local Verification Run

All commands below passed on 2026-06-05. Recurring local warning: the repo expects Node 22.x, while this machine is running Node v24.12.0. This warning did not fail verification.

- `pnpm --filter @locateflow/connectors test`
  - Passed: 14 files / 92 tests.
- `pnpm --filter @locateflow/connectors lint`
  - Passed.
- `pnpm --filter @locateflow/web test -- src/lib/connector-runtime.test.ts src/lib/fallback-actions.test.ts src/app/api/connectors/changes/route.test.ts src/app/api/connectors/[key]/webhook/route.test.ts`
  - Passed: 4 files / 37 tests.
- `pnpm --filter @locateflow/admin test -- src/app/api/connector-fallbacks/route.test.ts src/app/api/connectors/route.test.ts src/lib/backup-tables.test.ts`
  - Passed: 3 files / 25 tests.
- `pnpm --filter @locateflow/db generate`
  - Passed.
- `git diff --check`
  - Passed.
- `pnpm --filter @locateflow/web build`
  - Passed. Warnings only: Next middleware convention deprecation and edge-runtime static generation warning.
- `pnpm verify:typecheck`
  - Passed.
- `pnpm verify:tests`
  - Passed: web 197 files / 1472 tests, admin 90 files / 499 tests, mobile 15 files / 42 tests, connectors 14 files / 92 tests.
- `pnpm lint`
  - Passed.
- `pnpm build`
  - Passed. Warnings only: known Next middleware convention warning, edge-runtime static generation warning, and admin build Prisma CJS export warning.
- `pnpm verify:ci`
  - Passed.

Generated-only churn from build/verify was reviewed and not kept in this report commit:

- `apps/*/next-env.d.ts`: build switched dev route type import to prod route type import.
- `docs/generated/state-provider-*`: timestamp-only regeneration.

## Live Read-Only Checks

All live checks were read-only or intentionally unauthenticated fail-closed checks.

- DigitalOcean latest deployment: `2cc87963-c758-4027-b65b-14b23317d5e6` was `ACTIVE`.
- `GET https://locateflow.com/api/ready`
  - HTTP 200, `ready=true`, no failures.
- `GET https://locateflow.com/api/health`
  - HTTP 200, `status=healthy`, `ready=true`.
- `GET https://locateflow.com/api/mobile/iap/products`
  - HTTP 200.
  - iOS store products available, 6 unique product values.
  - Android store products available, 6 unique product values.
- `GET https://locateflow.com/api/cron/connector-dispatch` without cron secret
  - HTTP 401.
- `GET https://locateflow.com/api/connectors/changes` without auth
  - HTTP 401.
- `POST https://locateflow.com/api/connectors/usps/webhook` without signature
  - HTTP 401.
- `GET https://locateflow.com/privacy`
  - HTTP 200.
  - Legal entity text present.
  - Woodland Park mailing address text present.

## Safety Notes

- No live Stripe charge or real refund was performed.
- No production Play Store rollout or App Store release was performed.
- No App Store / Play legal terms were accepted.
- No secrets were printed or rotated.
- No production connector push/USPS COA action was performed.

## Recommendation

Push/report the audited state, keep connector runtime gated, and proceed with the documented sequence:

1. Consumer launch runbook for revenue readiness.
2. SHADOW connector pilot only after operator approval for the global connector switch and a controlled test window.
3. Real USPS GA push only after the authorized-agent agreement exists.
4. Partner/SOC2 work can remain deferred until enterprise partner discussions make it necessary.
