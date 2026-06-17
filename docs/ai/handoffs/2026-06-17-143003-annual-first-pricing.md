# Annual-First Pricing Rework Handoff

## Summary

Repriced LocateFlow around annual-first, lower paid tiers, with conservative generous-free packaging copy and a checkout price guard. No Stripe dashboard writes were performed. No deploy, migration, or feature-flag change was performed.

## Branch

- `codex/annual-first-pricing`

## Code Diff

- Updated canonical plan pricing in `packages/shared/src/billing.ts`.
- Added shared billing helpers:
  - `billingPriceLabelForInterval(plan, interval)`
  - `billingAmountUsdForInterval(plan, interval)`
- Updated annual-first pricing displays across web pricing, workspace plan cards, plan compare table, web subscription settings, mobile subscription settings, mobile comparison rows, acquisition campaign defaults, and structured data.
- Updated English and Spanish pricing copy for annual-first prices, Family seats, plan limits, Pro address limit, and stale savings copy.
- Added checkout price guard in `apps/web/src/app/api/stripe/checkout/route.ts`:
  - Retrieves the resolved Stripe Price read-only.
  - Requires active price.
  - Requires `currency=usd`.
  - Requires recurring interval to match the requested billing interval.
  - Requires unit amount to match canonical shared billing config.
  - Fails closed with `PRICE_UNAVAILABLE`.
- Added/updated drift tests so displayed pricing, limits, and seat strings stay aligned with shared billing and entitlement constants.

## New Price Table

| Plan | Interval | Stripe unit amount | Display |
|---|---:|---:|---|
| Individual | Year | `2400` | `$24/year` |
| Individual | Month | `499` | `$4.99/month` |
| Family | Year | `3900` | `$39/year` |
| Family | Month | `799` | `$7.99/month` |
| Pro | Year | `5900` | `$59/year` |
| Pro | Month | `1199` | `$11.99/month` |

## Free Tier Note

Free copy now presents a generous baseline: basic move checklist, address/service tracking, and Home Dossier preview. Enforcement was intentionally left conservative: no paid-only entitlement was opened without a more explicit product decision. Paid plans still keep full move-plan tracking, AI briefing, proof/PDF/export depth, post-move monitoring depth, and extra seats.

## Stripe Dashboard Steps

The human must create new Stripe Prices. Existing Stripe Price amounts cannot be edited in place.

1. In Stripe Dashboard, open the LocateFlow products for Individual, Family, and Pro, or create the products if needed.
2. Create a new recurring USD Price for Individual Monthly:
   - Amount: `$4.99`
   - Interval: monthly
3. Create a new recurring USD Price for Individual Annual:
   - Amount: `$24.00`
   - Interval: yearly
4. Create a new recurring USD Price for Family Monthly:
   - Amount: `$7.99`
   - Interval: monthly
5. Create a new recurring USD Price for Family Annual:
   - Amount: `$39.00`
   - Interval: yearly
6. Create a new recurring USD Price for Pro Monthly:
   - Amount: `$11.99`
   - Interval: monthly
7. Create a new recurring USD Price for Pro Annual:
   - Amount: `$59.00`
   - Interval: yearly
8. Set these environment variables to the new Price IDs:
   - `STRIPE_PRICE_INDIVIDUAL_MONTHLY`
   - `STRIPE_PRICE_INDIVIDUAL_YEARLY`
   - `STRIPE_PRICE_FAMILY_MONTHLY`
   - `STRIPE_PRICE_FAMILY_YEARLY`
   - `STRIPE_PRICE_PRO_MONTHLY`
   - `STRIPE_PRICE_PRO_YEARLY`
9. Keep the existing Stripe webhook configuration intact.
10. Existing subscribers stay on their old Stripe Price IDs unless explicitly migrated. Recommendation: grandfather existing subscribers unless a separate customer-communication and migration plan is approved.

## Checkout Guard Operational Note

After merge but before the env values are updated, checkout will fail closed for any plan whose configured Stripe Price does not exactly match the canonical amount, currency, and interval. That is intentional.

## Tests Run

- `pnpm install --frozen-lockfile --store-dir .pnpm-store`
  - Used because the clean worktree had no `node_modules`.
  - The first install against the user-level pnpm store failed on a missing store object; the repo-local frozen install succeeded.
  - Warning observed: local Node is `v24.13.0`, repo engine wants `22.x`.
- `pnpm verify:typecheck` - passed.
- `pnpm exec vitest run packages/shared/src/__tests__/billing.test.ts packages/shared/src/acquisition.test.ts` - passed, 2 files / 18 tests.
- `pnpm --filter @locateflow/web test -- src/app/api/stripe/checkout/route.test.ts src/components/marketing/pricing-section.test.tsx src/components/marketing/plan-compare-table.test.tsx src/lib/acquisition-campaigns.test.ts src/lib/acquisition-campaign-sync.test.ts src/components/shared/service-limit-upsell.test.ts src/app/api/acquisition/public-trial-campaign/route.test.ts src/app/api/services/route.test.ts` - passed, 8 files / 102 tests.
- `pnpm --filter @locateflow/admin test -- src/lib/stripe-campaign-validation.test.ts src/lib/billing-metrics.test.ts src/app/api/acquisition-campaigns/route.test.ts` - passed, 3 files / 34 tests.
- `pnpm --filter @locateflow/mobile test -- src/lib/plan-comparison.test.ts src/lib/subscription-app-review.test.ts` - passed, 2 files / 18 tests.
- `git diff --check` - passed.
- `en.json` and `es.json` parsed successfully.
- Stale-copy scan found only intentional negative assertions in the new drift test.

## Guardrails Confirmed

- No Stripe writes.
- No deploy.
- No migration.
- No feature flag enablement.
- No billing config/env changes performed.
- No secrets read or written.

## Recommended Next Action

Open PR for review, then have the human create the six new Stripe Prices and update the six `STRIPE_PRICE_*` env values before enabling checkout for the new pricing.
