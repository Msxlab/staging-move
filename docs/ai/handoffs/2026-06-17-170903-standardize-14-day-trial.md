# 2026-06-17 - Standardize 14-Day Trial

## Summary
- Retired the 90-day / 3-month public Individual annual trial copy in runtime defaults, web checkout defaults, admin campaign defaults, mobile copy, setup docs, and sync helper copy.
- Kept the legacy `INDIVIDUAL90` campaign code for compatibility, but rewrote the baked-in/default offer to the standard 14-day trial.
- Fixed public Playwright selector/test bugs for password fields, robots field casing/local noindex output, and FAQ JSON-LD DOM validation.
- Added the pricing/free-tier contract test so pricing, limits, free-preview boundaries, and trial defaults are pinned together.

## Grandfathering
- Existing users are not shortened by this code change. Trial state is snapshotted and persisted at signup via `buildCampaignSnapshot`, including `trialDaysAtSignup` and `trialEndsAt`.
- Stripe Checkout now defaults `trial_period_days` to 14 when no runtime override is set.

## Admin / Runtime Caveat
- This PR does not read or mutate production data.
- If production Admin/DB still has an active legacy `INDIVIDUAL90` campaign with old public copy, the owner should end/disable it or update it to 14-day copy in Admin.
- If deployed runtime config/env still sets `STRIPE_ANNUAL_TRIAL_DAYS=90`, the owner should change it to `14`; this PR only changes code defaults and examples.

## Tests Run
- `pnpm install --frozen-lockfile` - passed; local warning: repo wants Node 22.x, machine has Node v24.13.0.
- `pnpm --filter @locateflow/web exec vitest run ../../packages/shared/src/acquisition.test.ts` - passed, 1 file / 12 tests.
- `pnpm --filter @locateflow/web test -- src/lib/acquisition-campaigns.test.ts src/lib/acquisition-campaign-sync.test.ts src/lib/billing.test.ts src/lib/pricing-free-tier-contract.test.ts src/components/marketing/pricing-section.test.tsx src/components/shared/service-limit-upsell.test.ts src/app/api/acquisition/public-trial-campaign/route.test.ts src/app/api/services/route.test.ts src/app/api/stripe/checkout/route.test.ts` - passed, 9 files / 113 tests.
- `pnpm --filter @locateflow/admin test -- src/app/api/acquisition-campaigns/route.test.ts src/app/api/acquisition-campaigns/[id]/route.test.ts` - passed, 2 files / 20 tests.
- `pnpm --filter @locateflow/mobile test -- src/lib/subscription-app-review.test.ts` - passed, 1 file / 4 tests.
- `pnpm verify:typecheck` - passed.
- `pnpm --filter @locateflow/web exec playwright test tests/e2e/public-pages.spec.ts --project=chromium --workers=1` - passed, 9 tests.
- `pnpm --filter @locateflow/web exec playwright test tests/e2e/accessibility.spec.ts --project=chromium --workers=1` - failed, 4 tests, all `color-contrast` on home/sign-in/sign-up/pricing. This is the separately approved contrast PR.

## Notes
- No deploy, no Stripe writes, no store writes, no production-data access, no secrets.
