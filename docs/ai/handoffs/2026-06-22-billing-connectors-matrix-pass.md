# Handoff: Billing/IAP And Connector Matrix Pass

Date: 2026-06-22
Branch: `codex/staging-audit-2026-06-21`
Scope: docs-only audit continuation.

## What Changed

- Added `docs/audit/reports/billing-iap-route-matrix.md`.
- Added `docs/audit/reports/connectors-address-change-route-matrix.md`.
- Updated audit modules, flow docs, findings, roadmap, TODO, API/route maps, open questions, and audit memory.
- Added low finding `SEC-CONNECTOR-001` for connector fallback action mutations lacking step-up parity.

Application source code was not modified.

## Source Evidence Reviewed

- Web Stripe checkout, portal, checkout cancel, subscription actions, change-plan, and switch-cycle routes.
- Web mobile IAP products and verify routes.
- Web Stripe/App Store/Play Store webhook routes and webhook idempotency helper.
- Admin billing/subscription list, invoice, cancel, refund, change-plan, resync, and revalidate routes.
- Web connector catalog, changes, connector dispatch, connector webhook, partner consent, OAuth initiate/callback, and connector cron routes.
- Admin connector control, detail, test-connection, healthcheck, consents, and fallback action routes.
- Connector runtime, OAuth/consent helpers, partner consent refresh helper, and `packages/connectors` contract files.

No `.env`, private keys, tokens, credential stores, production data, live billing/store/provider credentials, migrations, deploys, or package installs were touched.

## Findings

New:

- `SEC-CONNECTOR-001` (Low/P2): Connector fallback action POST/DELETE are admin-permission gated, validated, and audited, but do not use password/MFA step-up. Connector config POST/PUT do use `requirePasswordConfirm`.

Not promoted:

- Apple IAP verify can fall back to a locally verified signed transaction when Apple server lookup fails or returns no subscription. This was not promoted because the inspected code verifies Apple JWS data, validates bundle ID, captures environment, and applies a production-like sandbox gate. Transition test coverage remains open.

## Checks Run

- `git status --short --branch`
- Targeted `rg` evidence searches over billing/IAP routes, webhook routes, admin subscription routes, connector routes, connector runtime helpers, OAuth helpers, and connector package files.

No lint, typecheck, tests, build, dependency audit, browser QA, mobile emulator QA, live provider, or live billing checks were run in this pass.

## Recommended Next Actions

1. Decide whether to fix `SEC-CONNECTOR-001` by adding `requirePasswordConfirm` to fallback action POST/DELETE.
2. Add billing/IAP transition tests before any billing behavior changes.
3. Continue the full one-row-per-route API authorization matrix.
4. Complete connector retention/export/delete and user-notification proof.
