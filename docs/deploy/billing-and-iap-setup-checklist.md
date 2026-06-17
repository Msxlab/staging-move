# Billing And IAP Setup Checklist

Purpose: validate current-product billing in staging without adding financial admin actions or new paid tiers.

Current billing policy:

- Data export/delete is always available.
- Existing data remains readable after subscription expiration.
- Completing already-created move tasks remains allowed after expiration.
- Generating new move tasks requires active entitlement.
- Creating new custom providers requires active entitlement.
- Admin can view billing context but cannot refund, cancel, grace, retry, grant, or revoke without an approved workflow.

## Stripe Staging Setup

Use Stripe test mode for staging.

Required web staging env:

- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_INDIVIDUAL_MONTHLY`
- `STRIPE_PRICE_INDIVIDUAL_YEARLY`
- `STRIPE_PRICE_FAMILY_MONTHLY`
- `STRIPE_PRICE_FAMILY_YEARLY`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_PRO_YEARLY`
- `STRIPE_ANNUAL_TRIAL_DAYS=90`
- `APP_URL=https://locateflow.com`
- `NEXT_PUBLIC_APP_URL=https://locateflow.com`

Stripe billing config is env-first in production. Admin Runtime Config only overrides these Stripe/App URL keys when `STRIPE_RUNTIME_CONFIG_OVERRIDE_ENABLED=true` is deliberately set; otherwise DB values are shown as ignored overrides in Admin. Never expose `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` in Admin responses or client responses.

Stripe Dashboard (start in Test Mode, mirror to Live Mode for production):

1. Switch the dashboard to Test Mode.
2. Products -> New product -> "LocateFlow Individual" with metadata `locateflow_plan=INDIVIDUAL`.
3. Create Individual monthly recurring Price: USD 4.99 / month -> save as `STRIPE_PRICE_INDIVIDUAL_MONTHLY`.
4. Create Individual annual recurring Price: USD 24 / year -> save as `STRIPE_PRICE_INDIVIDUAL_YEARLY`. Do not add a Stripe-side trial on the Price; the 90-day trial is applied at Checkout via `subscription_data.trial_period_days = STRIPE_ANNUAL_TRIAL_DAYS`.
5. Products -> New product -> "LocateFlow Family" with metadata `locateflow_plan=FAMILY`.
6. Create Family monthly recurring Price: USD 7.99 / month -> save as `STRIPE_PRICE_FAMILY_MONTHLY`.
7. Create Family annual recurring Price: USD 39 / year -> save as `STRIPE_PRICE_FAMILY_YEARLY`.
8. Products -> New product -> "LocateFlow Pro" with metadata `locateflow_plan=PRO`.
9. Create Pro monthly recurring Price: USD 11.99 / month -> save as `STRIPE_PRICE_PRO_MONTHLY`.
10. Create Pro annual recurring Price: USD 59 / year -> save as `STRIPE_PRICE_PRO_YEARLY`.
11. Developers -> API keys: copy `pk_test_...` (Publishable) and `sk_test_...` (Secret). Production uses `pk_live_*` / `sk_live_*`.
12. Developers -> Webhooks -> Add endpoint: `https://locateflow.com/api/webhooks/stripe`. Select these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `customer.subscription.trial_will_end`
   - `invoice.paid`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `invoice.payment_action_required`
   - `charge.refunded`
   Copy the `whsec_...` signing secret -> save as `STRIPE_WEBHOOK_SECRET`.
13. Settings -> Billing -> Customer Portal -> enable at least: cancel subscription, update payment method, and view invoices. The current product handles most plan/cycle mutations in-app through `/api/subscription/change-plan` and `/api/subscription/switch-cycle`; only enable portal-driven price switching if you intentionally test it against the same pricing matrix.
14. Repeat steps 1-13 in Live Mode before flipping production. The webhook rejects test-mode events in a production billing environment, so live and test webhooks must be added separately and configured with their respective signing secrets.

Local helper:

```bash
STRIPE_SECRET_KEY=sk_test_... pnpm stripe:sync-prices
```

This helper currently syncs the Individual product/prices only. Use `-- --apply` to actually create the Product and Prices on Stripe; otherwise the script runs as a dry-run. Family/Pro prices currently need to be created manually in the dashboard, or via a future script.

After env is set, sync public campaign copy and Stripe Price IDs:

```bash
pnpm campaigns:sync-billing
pnpm campaigns:sync-billing -- --apply
```

The sync updates active `INDIVIDUAL90` copy to `$24/year` and active `INDIVIDUALMONTHLY` copy to `$4.99/month`. It counts active subscriptions first. Existing subscriptions keep their current Stripe Price IDs; clone a new campaign instead of mutating the old one when immutable reporting or grandfathered campaign copy is required.

## Stripe QA

- [ ] Checkout session creates for Individual monthly ($4.99/month).
- [ ] Checkout session creates for Individual annual ($24/year) and starts in `trialing` status with a `trial_end` 90 days out.
- [ ] Checkout session creates for Family monthly ($7.99/month) and activates `FAMILY` / `PAID`.
- [ ] Checkout session creates for Family annual ($39/year) and activates `FAMILY` / `PAID`.
- [ ] Checkout session creates for Pro monthly ($11.99/month) and activates `PRO` / `PAID`.
- [ ] Checkout session creates for Pro annual ($59/year) and activates `PRO` / `PAID`.
- [ ] Annual checkout success page renders the trial badge and the trial-end / first-charge dates from the webhook-confirmed state, not from the success URL alone.
- [ ] Successful payment marks subscription `ACTIVE` and `accessType=PAID`.
- [ ] Pro annual unlocks connector/API sync entitlement; Pro monthly does not.
- [ ] `/api/subscription/change-plan` rejects missing `acceptedSubscriptionTerms` and handles Family/Pro tier changes with the current immediate-vs-scheduled rules.
- [ ] `/api/subscription/switch-cycle` rejects missing `acceptedSubscriptionTerms` and only applies to Stripe Individual subscriptions.
- [ ] Customer portal opens for Stripe subscriptions for cancel/payment method/invoices and does not expose an untested pricing path.
- [ ] Duplicate webhook delivery is idempotent (`ProcessedWebhookEvent` blocks the second apply).
- [ ] Delayed webhook delivery reconciles correctly within Stripe's 72h retry window.
- [ ] Failed payment / `PAST_DUE` state is visible to the user with a clear "fix payment" CTA.
- [ ] Cancel-at-period-end shows next-charge date and an "undo" path through the portal.
- [ ] Webhook signature verification rejects forged payloads.
- [ ] Test-mode events are rejected when the app is running in a production billing environment.
- [ ] No admin refund/cancel/grace/retry/grant/revoke actions appear.
- [ ] `STRIPE_SECRET_KEY` is never exposed in the client bundle (grep `_next/static` after a production build).
- [ ] Frontend cannot pick an arbitrary Stripe Price ID; checkout only accepts `plan` + `billingInterval` and the backend resolves the Price.
- [ ] Public acquisition campaign endpoint returns `$24/year` for `INDIVIDUAL90`; mobile paywall and homepage show the same label.

## Mobile IAP Staging Setup

Apple/App Store:

- `APPLE_APP_STORE_ISSUER_ID`
- `APPLE_APP_STORE_KEY_ID`
- `APPLE_APP_STORE_PRIVATE_KEY`
- `APPLE_APP_STORE_ENVIRONMENT=Sandbox`
- `MOBILE_IOS_PRODUCT_INDIVIDUAL` - monthly App Store product ID
- `MOBILE_IOS_PRODUCT_INDIVIDUAL_YEARLY` - annual App Store product ID
- `MOBILE_IOS_PRODUCT_FAMILY` - Family monthly App Store product ID
- `MOBILE_IOS_PRODUCT_FAMILY_YEARLY` - Family annual App Store product ID
- `MOBILE_IOS_PRODUCT_PRO` - Pro monthly App Store product ID
- `MOBILE_IOS_PRODUCT_PRO_YEARLY` - Pro annual App Store product ID

App Store Connect setup (mirror in sandbox first, then production):

1. App Store Connect -> My Apps -> LocateFlow -> In-App Purchases.
2. Create the subscription products that match `/api/mobile/iap/products`. At minimum this now includes Individual, Family, and Pro monthly/yearly SKUs when those tiers are shipped in mobile builds.
3. For Individual, use `com.locateflow.individual.monthly` (target USD 4.99) and `com.locateflow.individual.annual` (target USD 24). Keep the introductory free trial on the annual Individual product only; do not fake the trial in app code.
4. If Family/Pro are being sold in the mobile build, add matching monthly/yearly products for those tiers as well: `com.locateflow.family.monthly` (target USD 7.99), `com.locateflow.family.annual` (target USD 39), `com.locateflow.pro.monthly` (target USD 11.99), and `com.locateflow.pro.annual` (target USD 59). App Store price tiers may not exactly equal web prices; the operator must choose whether to match the nearest tier, absorb the store fee, or steer price-sensitive upgrades to web.
5. Set every shipped product to "Ready to Submit" with localized display name and description.
6. App Store Connect -> Users and Access -> Sandbox Testers: create at least one tester account; sandbox subscriptions cycle in accelerated time (1 month = 5 minutes) so QA loops are short.
7. App Store Server API: copy Issuer ID (Users & Access -> Integrations) and create a Key with the App Manager role. Download the `.p8` once and store in runtime config as `APPLE_APP_STORE_PRIVATE_KEY`.
8. App Store Server Notifications V2: set the Production and Sandbox URLs to `https://locateflow.com/api/webhooks/appstore`. Apple signs the JWS with AppleRootCA-G3; the webhook verifies the chain locally so no shared secret is needed.

Google Play:

- `GOOGLE_PLAY_PACKAGE_NAME=com.locateflow.mobile`
- Android Publisher API auth, one complete path:
  - service account: `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY`
  - OAuth fallback: `GOOGLE_PLAY_OAUTH_CLIENT_ID` + `GOOGLE_PLAY_OAUTH_REFRESH_TOKEN`; add `GOOGLE_PLAY_OAUTH_CLIENT_SECRET` if the OAuth client requires it.
- `GOOGLE_PLAY_RTDN_AUDIENCE=https://locateflow.com/api/webhooks/playstore`
- `EXPECTED_PLAYSTORE_WEBHOOK_SERVICE_ACCOUNT_EMAIL` - Pub/Sub push auth service account email
- `MOBILE_ANDROID_PRODUCT_INDIVIDUAL` - monthly Play product/base plan
- `MOBILE_ANDROID_PRODUCT_INDIVIDUAL_YEARLY` - annual Play product/base plan
- `MOBILE_ANDROID_PRODUCT_FAMILY` - Family monthly Play product/base plan
- `MOBILE_ANDROID_PRODUCT_FAMILY_YEARLY` - Family annual Play product/base plan
- `MOBILE_ANDROID_PRODUCT_PRO` - Pro monthly Play product/base plan
- `MOBILE_ANDROID_PRODUCT_PRO_YEARLY` - Pro annual Play product/base plan

Play Console setup (use Internal Testing track first):

1. Play Console -> LocateFlow -> Monetize -> Subscriptions -> create the subscriptions that match `/api/mobile/iap/products`.
2. Individual should include `locateflow_individual_monthly` (target USD 4.99) and `locateflow_individual_annual` (target USD 24).
3. On the annual Individual product/base plan add the free-trial offer. The trial is surfaced by Play Billing only when the user is eligible; do not fake the trial in app code.
4. If Family/Pro are being sold in the mobile build, add matching monthly/yearly subscriptions for those tiers too: `locateflow_family_monthly` (target USD 7.99), `locateflow_family_annual` (target USD 39), `locateflow_pro_monthly` (target USD 11.99), and `locateflow_pro_annual` (target USD 59). Play price tiers may not exactly equal web prices; the operator must choose whether to match the nearest tier, absorb the store fee, or steer price-sensitive upgrades to web.
5. Play Console -> Setup -> API access: link the project that owns the service account whose email is configured in `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL`, or complete the OAuth fallback path if service-account key creation is blocked. Grant `View financial data, orders, cancellation survey responses` and `Manage orders and subscriptions`.
6. Real-Time Developer Notifications: create a Pub/Sub topic, point it at `https://locateflow.com/api/webhooks/playstore`, configure the `aud` claim to match `GOOGLE_PLAY_RTDN_AUDIENCE`, and set `EXPECTED_PLAYSTORE_WEBHOOK_SERVICE_ACCOUNT_EMAIL` to the authenticated push service account. The webhook rejects payloads without that audience or expected identity in production.
7. License testers: Play Console -> Settings -> License testing -> add at least one Google account; test purchases on that account skip the 3-month grace and surface as `testPurchase=true`. Production only persists those verified test purchases for the configured QA account allowlist (`QA_RESETTABLE_ACCOUNT_EMAIL` plus optional `GOOGLE_PLAY_TEST_PURCHASE_USER_EMAILS`); test/staging accepts them normally.

If IAP credentials are missing:

- Mobile can still run for non-store QA, but the subscription screen must stay honest about unavailable store validation.
- Store purchase verification and stale validation cannot be fully tested.
- Do not ship a store build that relies on Stripe Checkout in the system browser as the primary path for digital subscriptions.

## IAP QA

- [ ] `/api/mobile/iap/products` returns all shipped plan/cycle IDs for each platform (currently six per platform when Individual, Family, and Pro are configured).
- [ ] Mobile paywall shows the plan/cycle options that match the configured store catalog.
- [ ] Individual annual CTA shows the "First 3 months free" badge and the annual savings badge from localized prices.
- [ ] iOS sandbox receipt verifies on `/api/mobile/iap/verify` when Apple credentials are present.
- [ ] iOS introductory offer activates: a new sandbox tester sees status `TRIALING` after annual Individual purchase; the unified entitlement resolver returns `accessType=FREE_TRIAL` and `currentPeriodEndsAt` matches Apple's `expiresDate`.
- [ ] iOS sandbox renewal flips status to `ACTIVE` and `accessType` to `PAID` on the next cycle.
- [ ] Android base-plan purchase verifies when Play credentials are present, including `lineItem.offerDetails.basePlanId/offerId`.
- [ ] Android annual Individual base plan with the free-trial offer writes `accessType=FREE_TRIAL` while the trial is active and `accessType=PAID` after the first paid period.
- [ ] Play RTDN rejects missing/invalid OIDC token in production-like config.
- [ ] Restore Purchases on a fresh install correctly re-claims an existing iOS or Android subscription via `/api/mobile/iap/verify`, and does not create a duplicate subscription row (`originalTransactionId` unique constraint enforces this).
- [ ] Restore on iOS where the user already has a Stripe-origin subscription does not silently overwrite the Stripe row. Mixed-provider users keep their highest-entitlement provider.
- [ ] Manage Subscription routes correctly per provider: `APP_STORE` -> `deepLinkToSubscriptions`, `PLAY_STORE` -> same, `STRIPE` -> `/api/stripe/portal`.
- [ ] Stale validation is visible in admin/support context.
- [ ] Web user that subscribes via Stripe sees the same `entitlement.isActive=true` after signing in on iOS or Android.
- [ ] Store-managed user that subscribes via App Store or Google Play sees the same on web, with web management routed to the applicable store rather than Stripe.

Reference: Stripe Billing should use Billing APIs and Checkout Sessions for subscriptions, with Customer Portal for self-service management. Apple StoreKit 2 / Play Billing must be used for in-app digital-goods subscriptions per store policy.
