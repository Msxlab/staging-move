# LocateFlow Full QA Checklist / UI Live Verification - 2026-06-05

Scope: execute the checklist in `docs/strategy/15-full-qa-checklist.md` against the current branch, with emphasis on the three new UI commits for connector metrics, connector fallbacks, and address-change history. Safety limits remained in force: no live Stripe charge, no production store rollout/release, no secret rotation, no legal/trader declaration, no App Store / Play terms acceptance, and no real USPS COA push.

## Release Reflection Answer

The latest web/admin UI changes are now pushed and deployed to DigitalOcean.

- Pushed commits:
  - `392e430` - `feat(admin): connector fallback actions editor UI`
  - `70082d3` - `feat(admin,web): connector metrics dashboard + address-change timeline UI + fallback editor validation/preview`
  - `0cba738` - `feat(admin,web): link connector metrics/fallbacks + address-change history into nav`
- DigitalOcean deployment: `0031f5c6-188d-4ad3-9290-f32f98b6f290`, phase `ACTIVE`.
- These commits are web/admin only. They do not change the iOS or Android native binaries.
- App Store Connect `Pending Developer Release` means Apple has accepted the current iOS version, but it will not go live until the operator manually releases it. Releasing the iOS app is a separate store action, not caused by this web/admin deploy.
- The App Store Connect trader-status banner is a legal/account-holder DSA compliance action. It is not a code failure, but it can affect EU distribution/app updates if not completed.

## Verdict

The new UI changes are sensible and safe to keep deployed. I found no code or build blocker.

Remaining release caution:

- Do not manually release iOS until the operator is comfortable with the currently approved build and DSA/trader-status path.
- The live client `Address change history` authenticated empty-state was not verified because the current Brave client session redirected to sign-in. The unauthenticated redirect behavior was verified.
- Production fallback create/edit/delete was not executed to avoid writing test rows/audit entries to production. Server CRUD and validation are covered by automated tests; live UI validation/preview was exercised without saving.

## Code And Static Inspection

Reviewed the UI and supporting routes/libs:

- `apps/admin/src/app/(admin)/connector-fallbacks/connector-fallbacks-client.tsx`
- `apps/admin/src/app/(admin)/connector-fallbacks/page.tsx`
- `apps/admin/src/app/(admin)/connector-metrics/connector-metrics-client.tsx`
- `apps/admin/src/app/(admin)/connector-metrics/page.tsx`
- `apps/admin/src/lib/connector-metrics.ts`
- `apps/admin/src/lib/admin-nav.ts`
- `apps/web/src/app/(app)/settings/address-changes/page.tsx`
- `apps/web/src/app/(app)/settings/page.tsx`
- `apps/admin/src/app/api/connector-fallbacks/route.ts`
- `apps/admin/src/app/api/connectors/route.ts`

Notes:

- Admin pages are gated through `requirePagePermission("connectors", "canRead")`.
- Admin nav and command palette include Connector Metrics and Connector Fallbacks under the connector permission.
- Metrics UI reads `/api/connectors`; that API already excludes `isShadow: true` dispatches.
- Fallback editor mirrors the server URL-type rules client-side and the server still rejects unsafe/mismatched URLs.
- Address history UI reads `/api/connectors/changes`; that route is auth-scoped and excludes shadow dispatches.

## Automated Verification

All passed unless listed under blockers.

- `git diff --check`
  - Passed.
- Focused admin tests:
  - `pnpm --filter @locateflow/admin test -- src/lib/connector-metrics.test.ts src/app/api/connector-fallbacks/route.test.ts src/app/api/connectors/route.test.ts`
  - Passed: 3 files / 22 tests.
- Focused web tests:
  - `pnpm --filter @locateflow/web test -- src/app/api/connectors/changes/route.test.ts src/lib/fallback-actions.test.ts`
  - Passed: 2 files / 13 tests.
- `pnpm verify:typecheck`
  - Passed.
- `pnpm verify:tests`
  - Passed: web 197 files / 1472 tests, admin 91 files / 501 tests, mobile 15 files / 42 tests, connectors 14 files / 92 tests.
- `pnpm lint`
  - Passed.
- `pnpm --filter @locateflow/admin build`
  - Passed. Known Prisma CJS warning only.
- `pnpm --filter @locateflow/web build`
  - Passed. Known Next middleware / edge-runtime warnings only.
- `pnpm build`
  - Passed.
- `pnpm verify:ci`
  - Passed.

Known local environment warning:

- The repo expects Node 22.x; this machine is Node v24.12.0. It did not fail verification.

Generated-only churn reviewed and not kept:

- `docs/generated/state-provider-*` timestamp-only regeneration.
- Next build may adjust `apps/*/next-env.d.ts` route type imports in some runs; no source logic change.

## Migration Status

- `pnpm --filter @locateflow/db run migrate:status` could not complete locally.
- Root cause: local Prisma status needed a reachable local database; `.env.local` contained `DATABASE_URL`, but the schema engine failed before returning migration status.
- Production readiness was separately verified by `/api/ready` after deploy, with `ready=true` and no failures.

## Local Rendered UI Checks

Browser plugin path:

- In-app Browser runtime failed with `native pipe closed before response`.
- Fallback used normal Playwright with the installed Chrome executable.

Local web/admin dev smoke:

- `http://127.0.0.1:3000/sign-in`
  - Rendered nonblank sign-in screen.
- `http://127.0.0.1:3000/settings/address-changes`
  - Redirected to `/sign-in?redirect=%2Fsettings%2Faddress-changes`.
- `http://127.0.0.1:3001/login`
  - Rendered nonblank admin sign-in screen.
- `http://127.0.0.1:3001/connector-metrics`
  - Redirected to `/login`.

Dev-only console note:

- Local dev pages showed HMR WebSocket handshake errors in headless Chrome. Production pages did not show these console errors.

Screenshot evidence saved outside the repo:

- `C:\Users\Kutay\AppData\Local\Temp\lf-qa-web-sign-in-20260605.png`
- `C:\Users\Kutay\AppData\Local\Temp\lf-qa-web-address-changes-unauth-20260605.png`
- `C:\Users\Kutay\AppData\Local\Temp\lf-qa-admin-login-20260605.png`
- `C:\Users\Kutay\AppData\Local\Temp\lf-qa-admin-connector-metrics-unauth-20260605.png`

## Live Production Checks After Deploy

Deployment:

- DigitalOcean deployment `0031f5c6-188d-4ad3-9290-f32f98b6f290` became `ACTIVE`.

Readiness:

- `GET https://locateflow.com/api/ready`
  - HTTP 200, `ready=true`, failures `0`.
- `GET https://locateflow.com/api/health`
  - HTTP 200, `status=healthy`, `ready=true`.
- `GET https://locateflow.com/api/mobile/iap/products`
  - HTTP 200, iOS 6 unique products, Android 6 unique products.

Fail-closed/security checks:

- `GET https://locateflow.com/settings/address-changes` without auth
  - HTTP 307 to sign-in.
- `GET https://admin.locateflow.com/connector-metrics` without auth
  - HTTP 307 to login.
- `GET https://admin.locateflow.com/connector-fallbacks` without auth
  - HTTP 307 to login.
- `GET https://admin.locateflow.com/api/connector-fallbacks` without auth
  - HTTP 401.
- `GET https://locateflow.com/api/cron/connector-dispatch` without cron secret
  - HTTP 401.
- `GET https://locateflow.com/api/connectors/changes` without auth
  - HTTP 401.
- `POST https://locateflow.com/api/connectors/usps/webhook` without signature
  - HTTP 401.

Authenticated live admin UI, using existing Brave operator session:

- `https://admin.locateflow.com/connector-metrics`
  - HTTP 200.
  - Title: `Connector metrics - Admin`.
  - Sidebar/nav visible.
  - Page heading `Dispatch metrics` visible.
  - Empty state `No dispatches yet` visible.
  - No console errors.
- `https://admin.locateflow.com/connector-fallbacks`
  - HTTP 200.
  - Title: `Connector fallbacks - Admin`.
  - Sidebar/nav visible.
  - Page heading `Fallback actions` visible.
  - Empty state `No fallback actions yet` visible.
  - `Add fallback` opens the form.
  - With `type=MAILTO` and `urlTemplate=https://example.com/bad-for-mailto`:
    - URL warning visible.
    - Create button disabled.
  - After changing `urlTemplate=mailto:support@example.com`:
    - Preview visible.
    - Create button enabled.
  - No production save/delete was clicked.
  - No console errors.

Live screenshot evidence saved outside the repo:

- `C:\Users\Kutay\AppData\Local\Temp\lf-live-admin-connector-metrics-20260605.png`
- `C:\Users\Kutay\AppData\Local\Temp\lf-live-admin-connector-fallbacks-20260605.png`
- `C:\Users\Kutay\AppData\Local\Temp\lf-live-admin-fallbacks-invalid-20260605.png`
- `C:\Users\Kutay\AppData\Local\Temp\lf-live-admin-fallbacks-valid-20260605.png`

Authenticated live web client UI:

- Current Brave client session was not authenticated for `locateflow.com`.
- `/settings` redirected to sign-in.
- `/settings/address-changes` redirected to sign-in.
- This proves route protection, but not the authenticated empty-state UI. A signed-in client session is required to complete that item.

## Checklist Coverage Notes

Covered this turn:

- Local code gates: typecheck, tests, lint, build, whitespace.
- DigitalOcean deploy active.
- Production readiness/health.
- New admin Connector Metrics UI.
- New admin Connector Fallbacks UI validation/preview.
- New web address history route protection.
- Security fail-closed checks for cron, connector changes, fallback API, and webhook.
- Mobile automated tests.
- Store product endpoint count.

Not executed by safety rule or external dependency:

- Live Stripe charge/refund.
- Play Store production rollout.
- App Store manual release.
- App Store DSA/trader declaration.
- Real USPS push / COA filing.
- CRON_SECRET-authorized production cron mutation.
- Production fallback CRUD save/delete.

Not completed because current session lacked the needed authenticated client state:

- Live authenticated `/settings/address-changes` empty state.
- Live settings page `Address change history` link inside a signed-in client session.

## Recommendation

- Keep the web/admin deploy. The new UI is safe, gated, and working in production.
- Before pressing App Store `Release this version`, decide the Apple DSA/trader status path and confirm that the approved iOS build is the build you want live.
- For a final client UI tick, sign into `locateflow.com` in Brave with a test/client account and re-open:
  - `https://locateflow.com/settings`
  - `https://locateflow.com/settings/address-changes`
- Do not run USPS GA push until the authorized-agent agreement exists.
