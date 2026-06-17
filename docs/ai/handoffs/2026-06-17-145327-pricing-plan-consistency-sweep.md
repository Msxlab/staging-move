# Pricing Plan Consistency Sweep Handoff

Date: 2026-06-17 14:53 local
Branch: `codex/pricing-plan-consistency-sweep`
Base: `move-main/main` after PR #281 merge

## Summary

Canonical pricing remains:

| Tier | Annual default | Optional monthly | Seats / limits |
|---|---:|---:|---|
| Free | Free | Free | 3 addresses, 10 services, Home Dossier preview |
| Individual | $24/year | $4.99/month | 10 addresses, 100 services |
| Family | $39/year | $7.99/month | 6 members, 15 addresses, 500 services |
| Pro | $59/year | $11.99/month | 10 members, 25 addresses, 1,000 services, 3 move plans |

No Stripe writes, App Store writes, Google Play writes, deploys, migrations, or flag changes were performed.

## Changed Files

- `apps/web/src/components/marketing/plan-compare-table.test.tsx`
- `docs/deploy/billing-and-iap-setup-checklist.md`
- `docs/deploy/mobile-and-places-release-runbook.md`
- `docs/deploy/mobile-store-submission-copy.md`
- `docs/setup/oauth-and-iap.md`
- `packages/db/prisma/_migration-data.json`
- `docs/ai/handoffs/2026-06-17-145327-pricing-plan-consistency-sweep.md`

## Per-Surface Sweep

| Surface | Status |
|---|---|
| Web marketing/home/pricing | Already correct from PR #281. Pricing cards, compare table, homepage metadata/JSON-LD derive from `BILLING_PLAN_DEFINITIONS` or current campaign copy. |
| Web workspace plan cards | Already correct from PR #281. Uses shared billing definitions and dynamic annual/monthly labels. |
| Admin billing/subscription campaign UI | Already correct from PR #281 for active acquisition campaign copy. No old user-facing plan price surfaced in admin source scan. |
| Admin runtime config / IAP product IDs | Already correct. All six iOS and Android product runtime keys are present. |
| Mobile subscription/paywall | Already correct from PR #281. Mobile displays StoreKit/Play fetched prices when available, with canonical shared-billing fallback. |
| Mobile plan comparison | Already correct and verified by mobile test. Annual label appears first in fallback copy. |
| Web i18n en/es | Already correct from PR #281 and guarded by existing compare-table test. |
| Mobile i18n | No hardcoded plan prices found in current mobile i18n; plan prices come from store-fetched values or shared billing fallback. |
| Email/transactional seed payload | Fixed now. `_migration-data.json` no longer advertises unlimited/Enterprise subscription copy or old monthly/annual savings language. |
| Operator docs | Fixed now. Stripe, App Store, Google Play, mobile runbook, and store-submission copy now use annual-first target prices and all six mobile SKUs. |
| Historical roadmap/audit/prototype docs | Stale literals remain by design. They are historical records, not current user-facing or runtime product surfaces. |

## Stale-Literal Results

Current app/package/deploy/setup sweep after fixes still returns only non-plan or test-only hits:

- Test fixtures: `$49.99/year`, `$79/year`, `$80/year`, `$99.99`, `$9.99`, and invoice/payment examples used to assert validation or store-price behavior.
- User-subscription examples, not LocateFlow plan prices: Netflix/ClassPass-style `$19.99`, service bill `$59.99`, coordinate data.
- Negative assertions in `plan-compare-table.test.tsx` intentionally block stale strings such as `$14.99`, `Save 17%`, `Unlimited addresses`, `up to 4 others`, and `250 services`.
- Apple Developer Program cost `$99/year` remains in setup docs because it is not a LocateFlow subscription price.

## Extended Test

`apps/web/src/components/marketing/plan-compare-table.test.tsx` now verifies current web/admin/mobile/email/operator surfaces against:

- `packages/shared/src/billing.ts`
- `packages/shared/src/workspace-entitlements.ts`
- seeded subscription/help content
- mobile StoreKit/Play fallback behavior
- current IAP product IDs
- stale price/limit/seat strings to block

## Manual Stripe Dashboard Steps

Do this in Stripe Dashboard manually. Do not edit old Prices in place; Stripe Prices are immutable for amount/interval.

| Env key | Tier | Interval | Currency | Unit amount |
|---|---|---|---|---:|
| `STRIPE_PRICE_INDIVIDUAL_MONTHLY` | Individual | month | USD | 499 |
| `STRIPE_PRICE_INDIVIDUAL_YEARLY` | Individual | year | USD | 2400 |
| `STRIPE_PRICE_FAMILY_MONTHLY` | Family | month | USD | 799 |
| `STRIPE_PRICE_FAMILY_YEARLY` | Family | year | USD | 3900 |
| `STRIPE_PRICE_PRO_MONTHLY` | Pro | month | USD | 1199 |
| `STRIPE_PRICE_PRO_YEARLY` | Pro | year | USD | 5900 |

Steps:

1. In Stripe Test Mode, create or open each LocateFlow product.
2. Create a new recurring Price for each tier/interval above.
3. Keep currency `usd`; set the interval exactly to month or year.
4. Do not add a Stripe-side trial to the Price. The 90-day annual trial campaign remains Checkout/session-driven.
5. Copy each new `price_...` ID into the matching env key.
6. Repeat in Live Mode before production release.
7. Keep the existing webhook endpoint/events unchanged.
8. Existing subscribers stay on old Prices unless intentionally migrated. Recommended default: grandfather old subscribers and migrate only with a separate billing/customer-communication decision.

## Manual App Store Connect Steps

Target product IDs and amounts:

| Product ID | Target price |
|---|---:|
| `com.locateflow.individual.monthly` | USD 4.99/month |
| `com.locateflow.individual.annual` | USD 24/year |
| `com.locateflow.family.monthly` | USD 7.99/month |
| `com.locateflow.family.annual` | USD 39/year |
| `com.locateflow.pro.monthly` | USD 11.99/month |
| `com.locateflow.pro.annual` | USD 59/year |

Steps:

1. App Store Connect -> My Apps -> LocateFlow -> In-App Purchases / Subscriptions.
2. Ensure all six products exist in the LocateFlow Premium subscription group.
3. Set each product price to the closest available App Store tier for the target amount.
4. Keep the introductory free trial only on annual Individual if the operator wants to keep the 90-day intro hook.
5. Localize display names/descriptions and mark products ready for review as needed.
6. Confirm `MOBILE_IOS_PRODUCT_*` runtime-config values match the product IDs above.

Human decision flag: mobile store prices do not have to match web exactly. Choose one: match nearest store tier, absorb store fees, or steer price-sensitive upgrades to web.

## Manual Google Play Console Steps

Target product IDs and amounts:

| Product / base plan ID | Target price |
|---|---:|
| `locateflow_individual_monthly` | USD 4.99/month |
| `locateflow_individual_annual` | USD 24/year |
| `locateflow_family_monthly` | USD 7.99/month |
| `locateflow_family_annual` | USD 39/year |
| `locateflow_pro_monthly` | USD 11.99/month |
| `locateflow_pro_annual` | USD 59/year |

Steps:

1. Play Console -> LocateFlow -> Monetize -> Subscriptions.
2. Ensure all six subscription products/base plans exist.
3. Set base-plan pricing to the closest available Play price tier for the target amount.
4. Keep the introductory trial offer only on annual Individual if the operator wants to keep the 90-day intro hook.
5. Confirm Real-Time Developer Notifications remain configured.
6. Confirm `MOBILE_ANDROID_PRODUCT_*` runtime-config values match the product/base plan IDs above.

Human decision flag: mobile store prices do not have to match web exactly. Choose one: match nearest store tier, absorb store fees, or steer price-sensitive upgrades to web.

## Tests Run

- `pnpm --filter @locateflow/web test -- src/components/marketing/plan-compare-table.test.tsx` - pass, 16 tests
- `pnpm --filter @locateflow/mobile test -- src/lib/plan-comparison.test.ts` - pass, 14 tests
- `pnpm verify:typecheck` - pass

Note: local Node is `v24.13.0`; repo engine requests Node `22.x`, so pnpm printed an engine warning but commands passed.

## Recommended Next Action

Open a review PR for this branch. After review, have the operator create the six new Stripe Prices and update store-console pricing manually; no code can perform the App Store/Google Play price writes.
