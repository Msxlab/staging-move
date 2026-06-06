# LocateFlow Stripe Staging QA Final - 2026-06-03

## Scope

Verified the DigitalOcean QA/staging Stripe test-mode runtime after the release-readiness fixes. This report covers staging/test-mode only and does not claim production charge execution.

## Runtime Status

- DigitalOcean app: `locateflow-staging`
- Default ingress: `https://locateflow-staging-owew7.ondigitalocean.app`
- Deployment `df8bcdc5-76e8-4cd2-9b99-8a8a1b1a2905` became ACTIVE for the flexible-billing Stripe schedule fix.
- Deployment `22742904-4886-4c4b-822d-b32781786dc4` became ACTIVE after the Stripe matrix report/helper update.
- Post-deploy smoke passed:
  - `GET /api/health` returned HTTP 200 with `ready: true`.
  - `GET /api/ready` returned HTTP 200 with `ready: true`.

## Stripe Test Catalog

The earlier incomplete test catalog blocker is resolved for the QA/staging runtime. The matrix used six Stripe test prices:

- Individual Monthly
- Individual Annual
- Family Monthly
- Family Annual
- Pro Monthly
- Pro Annual

## Verified Behavior

- Hosted Checkout success paths activate all six paid plan/cycle states.
- Annual checkout uses the expected annual trial path.
- Failed initial payment persists inactive `UNPAID`, not an active paid entitlement.
- Checkout cancel resets/recoverably clears pending checkout state.
- Duplicate checkout is blocked for active paid users.
- Store-managed subscriptions block web Stripe checkout.
- Plan upgrades and Month -> Year same-tier changes apply immediately.
- Downgrades and Year -> Month same-tier changes schedule for period end.
- Same plan/same interval is rejected as a no-op.
- Stripe flexible-billing subscriptions can now create/update schedules because schedule calls send the required per-request API version.

## Evidence

- Focused route tests after the schedule fix: 48/48 passed.
- Web typecheck passed after the schedule fix.
- `git diff --check` passed for the touched payment/report files.
- Full live QA/staging matrix: 36 transitions / 36 passed.
- Matrix summary path: `C:\Users\Kutay\AppData\Local\Temp\locateflow-plan-matrix-v6-20260603-231015.json`.

## Safety Notes

- No live production charge was completed.
- No production Stripe customer/subscription mutation was executed.
- No secret values are recorded in this report.
