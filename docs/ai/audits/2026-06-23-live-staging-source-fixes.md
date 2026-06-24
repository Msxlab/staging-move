# Live Staging Source Fixes

Date: 2026-06-23

Branch: `codex/free-pivot-followup-fixes`

Live target tested: `https://staging.locateflow.com`

## Scope

This pass applies source fixes for the free-pivot runtime findings and captures fresh live staging frontend evidence. It does not deploy staging, publish an Android artifact, access production data, or use admin credentials.

## Live Staging Evidence

Screenshots and metrics were saved under:

`docs/ai/screenshots/2026-06-23-live-staging-fixes/`

The live staging run covered mobile `390x844` and desktop `1440x900` for:

`/`, `/pricing`, `/why-free`, `/features`, `/about`, `/contact`, `/privacy`, `/terms`, `/disclaimer`, `/help`, `/billing-policy`, `/refund`, `/account/delete`, `/sign-up`, `/sign-in`, `/forgot-password`.

Observed:

- Public pages returned HTTP 200.
- `/api/build-info` returned HTTP 401, so live branch/commit could not be verified from that endpoint in this pass.
- Desktop `1440x900` had no horizontal overflow on checked pages.
- Mobile `390x844` still had public-page horizontal overflow on live staging: `scrollWidth=497`, `clientWidth=390`.
- The overflow offender is the logged-out desktop auth CTA group (`Sign In` / `Get started`) still visible on mobile in the live staging bundle.
- The current source already wraps that CTA group in `hidden ... lg:flex`, and `apps/web/src/components/marketing/marketing-header.test.tsx` already covers the regression.
- Live staging `/sign-up` still shows stale `Checkout terms shown before purchase` text.
- Live staging `/pricing` and `/why-free` show the free-pivot public copy.

## Source Fixes Applied

- Admin `CONSUMER_FREE` now defaults to enabled when the DB FeatureFlag row is missing, matching the web product default.
- `CONSUMER_FREE_DEFAULT=false` remains the fallback opt-out.
- An explicit DB feature flag row still overrides the fallback default.
- Sign-up no longer concatenates the stale landing `noCreditCard` string into the auth subtitle.
- Sign-up and sign-in now show a visible free/no-card/partner-funded reassurance.
- English and Spanish `landing.noCreditCard` no longer contain the stale checkout wording.
- Regression coverage was added for the auth free/no-card promise and stale checkout text removal.

## Tests Run

- `pnpm --filter @locateflow/web test -- src/app/auth-page-regression.test.ts src/components/marketing/marketing-header.test.tsx src/components/marketing/pricing-section.test.tsx src/lib/pricing-free-tier-contract.test.ts`
- `pnpm --filter @locateflow/admin test -- src/lib/consumer-free-status.test.ts`
- `pnpm --filter @locateflow/web lint`
- `pnpm --filter @locateflow/admin lint`

All commands passed. The workspace emitted the expected Node engine warning because the local runtime is Node `v24.12.0` while the repo declares Node `22.x`.

## Remaining Work

1. Deploy staging from the intended branch/commit.
2. Re-run the same live staging screenshot matrix after deploy.
3. Verify mobile public overflow is gone on live staging.
4. Verify `/sign-up` and `/sign-in` show the free/no-card promise and no stale checkout copy on live staging.
5. Install or provide the official signed Android `preview` / `staging-preview` artifact and rerun mobile runtime QA.
6. Provide approved admin QA credentials before authenticated admin runtime screenshots.

Application source code was modified in this pass.
