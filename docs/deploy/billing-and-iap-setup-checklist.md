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
- `STRIPE_ANNUAL_TRIAL_DAYS=90`
- `APP_URL=https://locateflow.com`
- `NEXT_PUBLIC_APP_URL=https://locateflow.com`

Stripe billing config is env-first in production. Admin Runtime Config only overrides these Stripe/App URL keys when `STRIPE_RUNTIME_CONFIG_OVERRIDE_ENABLED=true` is deliberately set; otherwise DB values are shown as ignored overrides in Admin. Never expose `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` in Admin responses or client responses.

Stripe Dashboard (start in Test Mode, mirror to Live Mode for production):

1. Switch the dashboard to Test Mode.
2. Products → New product → "LocateFlow Individual" with metadata `locateflow_plan=INDIVIDUAL`.
3. Create monthly recurring Price: USD 3.99 / month -> copy `price_...` -> save as `STRIPE_PRICE_INDIVIDUAL_MONTHLY`.
4. Create annual recurring Price: USD 39.99 / year -> copy `price_...` -> save as `STRIPE_PRICE_INDIVIDUAL_YEARLY`. Do NOT add a Stripe-side trial on the Price; the 90-day trial is applied at Checkout via `subscription_data.trial_period_days = STRIPE_ANNUAL_TRIAL_DAYS` so Free Access users can start the trial without changing the Price.
5. Developers → API keys: copy `pk_test_...` (Publishable) and `sk_test_...` (Secret). Production uses `pk_live_*` / `sk_live_*`.
6. Developers → Webhooks → Add endpoint: `https://locateflow.com/api/webhooks/stripe`. Select these events:
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
   Copy the `whsec_...` signing secret → save as `STRIPE_WEBHOOK_SECRET`.
7. Settings → Billing → Customer Portal → enable: cancel subscription, update payment method, view invoices, switch between active Prices (monthly ↔ annual). Set the return URL to `${NEXT_PUBLIC_APP_URL}/settings/subscription`.
8. Repeat steps 1–7 in Live Mode before flipping production. The webhook (`route.ts`) rejects test-mode events in a production billing environment, so live and test webhooks must be added separately and configured with their respective signing secrets.

Local helper:

```bash
STRIPE_SECRET_KEY=sk_test_... pnpm stripe:sync-prices
```

Defaults to $3.99/month and $39.99/year. Use `-- --apply` to actually create the Product and Prices on Stripe; otherwise the script runs as a dry-run.

After env is set, sync public campaign copy and Stripe Price IDs:

```bash
pnpm campaigns:sync-billing
pnpm campaigns:sync-billing -- --apply
```

The sync updates active `INDIVIDUAL90` copy to `$39.99/year` and active `INDIVIDUALMONTHLY` copy to `$3.99/month`. It counts active subscriptions first. Existing subscriptions keep their current Stripe Price IDs; clone a new campaign instead of mutating the old one when immutable reporting or grandfathered campaign copy is required.

## Stripe QA

- [ ] Checkout session creates for Individual monthly ($3.99/month).
- [ ] Checkout session creates for Individual annual ($39.99/year) and starts in `trialing` status with a `trial_end` 90 days out.
- [ ] Annual checkout success page renders the trial badge and the trial-end / first-charge dates from the webhook-confirmed state, not from the success URL alone.
- [ ] Successful payment marks subscription `ACTIVE` and `accessType=PAID`.
- [ ] Customer portal opens for Stripe subscriptions and lets the user upgrade/downgrade between monthly and annual.
- [ ] Duplicate webhook delivery is idempotent (`ProcessedWebhookEvent` blocks the second apply).
- [ ] Delayed webhook delivery reconciles correctly within Stripe's 72h retry window.
- [ ] Failed payment / `PAST_DUE` state is visible to the user with a clear "fix payment" CTA.
- [ ] Cancel-at-period-end shows next-charge date and an "undo" path through the portal.
- [ ] Webhook signature verification rejects forged payloads.
- [ ] Test-mode events are rejected when the app is running in a production billing environment.
- [ ] No admin refund/cancel/grace/retry/grant/revoke actions appear.
- [ ] STRIPE_SECRET_KEY is never exposed in the client bundle (grep `_next/static` after a production build).
- [ ] Frontend cannot pick an arbitrary Stripe Price ID - checkout only accepts `plan` + `billingInterval` and the backend resolves the Price.
- [ ] Public acquisition campaign endpoint returns `$39.99/year` for `INDIVIDUAL90`; mobile paywall and homepage show the same label.

## Mobile IAP Staging Setup

Apple/App Store:

- `APPLE_APP_STORE_ISSUER_ID`
- `APPLE_APP_STORE_KEY_ID`
- `APPLE_APP_STORE_PRIVATE_KEY`
- `APPLE_APP_STORE_ENVIRONMENT=Sandbox`
- `MOBILE_IOS_PRODUCT_INDIVIDUAL` — monthly App Store product ID
- `MOBILE_IOS_PRODUCT_INDIVIDUAL_YEARLY` — annual App Store product ID

App Store Connect setup (mirror in sandbox first, then production):

1. App Store Connect → My Apps → LocateFlow → In-App Purchases.
2. Create a Subscription Group "LocateFlow Individual" (one group, two products — required for upgrade/downgrade between monthly and annual to be ordered correctly).
3. Add product `com.locateflow.individual.monthly` (Auto-Renewable Subscription, Duration = 1 month, Price = $3.99 / Tier 4).
4. Add product `com.locateflow.individual.annual` (Auto-Renewable Subscription, Duration = 1 year, Price = $39.99). On this product, add a Subscription Introductory Offer → Free Trial → 3 months → eligibility "New Subscribers". This is what surfaces the trial in the StoreKit purchase sheet — do NOT fake the trial in app code.
5. Set both products to "Ready to Submit" with localized display name and description.
6. App Store Connect → Users and Access → Sandbox Testers: create at least one tester account; sandbox subscriptions cycle in accelerated time (1 month = 5 minutes) so QA loops are short.
7. App Store Server API: copy Issuer ID (Users & Access → Integrations) and create a Key with the App Manager role. Download the .p8 once and store in runtime config as `APPLE_APP_STORE_PRIVATE_KEY`.
8. App Store Server Notifications V2: set the Production and Sandbox URLs to `https://locateflow.com/api/webhooks/appstore`. Apple signs the JWS with AppleRootCA-G3; the webhook verifies the chain locally so no shared secret is needed.

Google Play:

- `GOOGLE_PLAY_PACKAGE_NAME=com.locateflow.mobile`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY`
- `GOOGLE_PLAY_RTDN_AUDIENCE=https://locateflow.com/api/webhooks/playstore`
- `MOBILE_ANDROID_PRODUCT_INDIVIDUAL` — monthly Play product/base plan
- `MOBILE_ANDROID_PRODUCT_INDIVIDUAL_YEARLY` — annual Play product/base plan

Play Console setup (use Internal Testing track first):

1. Play Console → LocateFlow → Monetize → Subscriptions → Create subscription `locateflow_individual`.
2. Add base plan `monthly` → Auto-renewing → Billing period = 1 month → Price = $3.99 → Region pricing = USD anchor.
3. Add base plan `annual` → Auto-renewing → Billing period = 1 year → Price = $39.99.
4. On the annual base plan add an Offer of type "Free trial" → Duration = 3 months → Eligibility = "New customer acquisition (subscriptions)". The trial is surfaced by Play Billing only when the user is eligible — do NOT fake the trial in app code.
5. Play Console → Setup → API access: link the project that owns the service account whose email is configured in `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL`. Grant `View financial data, orders, cancellation survey responses` and `Manage orders and subscriptions`.
6. Real-Time Developer Notifications: create a Pub/Sub topic, point it at `https://locateflow.com/api/webhooks/playstore`, and configure the `aud` claim to match `GOOGLE_PLAY_RTDN_AUDIENCE`. The webhook rejects payloads without that audience in production.
7. License testers: Play Console → Settings → License testing → add at least one Google account; test purchases on that account skip the 3-month grace and surface as `testPurchase=true` (the verifier rejects these in production but accepts them in test/staging).

If IAP credentials are missing:

- Mobile can still run for non-store QA — the paywall transparently falls back to opening Stripe Checkout in the system browser, which is allowed inside the app for test builds but should NOT be shipped to the App Store / Play Store as the primary path for digital subscriptions.
- Store purchase verification and stale validation cannot be fully tested.
- The settings/subscription screen should show honest unavailable/readiness state for purchase validation.

## IAP QA

- [ ] `/api/mobile/iap/products` returns both `INDIVIDUAL_MONTHLY` and `INDIVIDUAL_YEARLY` IDs for each platform when both env vars are set.
- [ ] Mobile paywall shows two CTAs (Annual + Monthly) when both SKUs are configured; falls back to the legacy single CTA when only one is set.
- [ ] Annual CTA shows the "First 3 months free" badge (driven by the `INDIVIDUAL90` campaign trial label) and the "Save $X/year vs monthly" badge (computed from localized prices).
- [ ] iOS sandbox receipt verifies on `/api/mobile/iap/verify` when Apple credentials are present.
- [ ] iOS introductory offer activates: a new sandbox tester sees status `TRIALING` after annual purchase; the unified entitlement resolver returns `accessType=FREE_TRIAL` and `currentPeriodEndsAt` matches Apple's `expiresDate`.
- [ ] iOS sandbox sub renewal flips status to `ACTIVE` and `accessType` to `PAID` on the next cycle.
- [ ] Android base-plan purchase verifies when Play credentials are present, including reading `lineItem.offerDetails.basePlanId/offerId`.
- [ ] Android annual base plan with the Free Trial offer surfaces `subscriptionState=SUBSCRIPTION_STATE_ACTIVE` plus a future `lineItem.expiryTime`; the verifier writes `accessType=FREE_TRIAL` while the trial is active and `accessType=PAID` after the first paid period (Play does not have a separate TRIALING state).
- [ ] Play RTDN rejects missing/invalid OIDC token in production-like config.
- [ ] Restore Purchases on a fresh install correctly re-claims an existing iOS or Android subscription via `/api/mobile/iap/verify`, and does NOT create a duplicate subscription row (`originalTransactionId` unique constraint enforces this).
- [ ] Restore on iOS where the user already has a Stripe-origin subscription does not silently overwrite the Stripe row — the new IAP row would conflict on `originalTransactionId` only if a previous IAP purchase exists. Mixed-provider users keep their highest-entitlement provider.
- [ ] Manage Subscription routes correctly per provider: APP_STORE → `deepLinkToSubscriptions`, PLAY_STORE → same, STRIPE → `/api/stripe/portal`.
- [ ] Stale validation is visible in admin/support context.
- [ ] Web user that subscribes via Stripe sees the same `entitlement.isActive=true` after signing in on iOS or Android.
- [ ] iOS user that subscribes via App Store sees the same on web (web pricing UI hides the upgrade CTA when `provider=APP_STORE` and routes Manage to a "manage in App Store" message instead of Stripe portal).

Reference: Stripe Billing should use Billing APIs and Checkout Sessions for subscriptions, with Customer Portal for self-service management. Apple StoreKit2 / Play Billing must be used for in-app digital-goods subscriptions per store policy — Stripe Checkout in the system browser is acceptable only for non-store distribution channels.
