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
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_INDIVIDUAL`
- `STRIPE_PRICE_INDIVIDUAL_YEARLY` if yearly is enabled
- `NEXT_PUBLIC_APP_URL=https://locateflow-staging-owew7.ondigitalocean.app`

Stripe Dashboard:

- Configure Checkout for subscription mode.
- Configure Customer Portal for self-service subscription management.
- Create Individual monthly Price.
- Create Individual yearly Price if enabled.
- Add webhook endpoint: `https://locateflow-staging-owew7.ondigitalocean.app/api/webhooks/stripe`
- Subscribe to checkout session, customer subscription, invoice/payment events already handled by the app.

Local helper:

```bash
STRIPE_SECRET_KEY=sk_test_... pnpm stripe:sync-prices
```

Use `-- --apply` only when intentionally creating/updating test-mode prices.

## Stripe QA

- [ ] Checkout session creates for Individual monthly.
- [ ] Checkout session creates for yearly if enabled.
- [ ] Successful payment marks subscription active.
- [ ] Customer portal opens for Stripe subscriptions.
- [ ] Duplicate webhook delivery is idempotent.
- [ ] Delayed webhook delivery reconciles correctly.
- [ ] Failed payment/past_due state is visible.
- [ ] No admin refund/cancel/grace/retry/grant/revoke actions appear.

## Mobile IAP Staging Setup

Apple/App Store:

- `APPLE_APP_STORE_ISSUER_ID`
- `APPLE_APP_STORE_KEY_ID`
- `APPLE_APP_STORE_PRIVATE_KEY`
- `APPLE_APP_STORE_ENVIRONMENT=Sandbox`
- `MOBILE_IOS_PRODUCT_INDIVIDUAL`

Google Play:

- `GOOGLE_PLAY_PACKAGE_NAME=com.locateflow.mobile`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY`
- `GOOGLE_PLAY_RTDN_AUDIENCE=https://locateflow-staging-owew7.ondigitalocean.app/api/webhooks/playstore`
- `MOBILE_ANDROID_PRODUCT_INDIVIDUAL`

If IAP credentials are missing:

- Mobile can still run for non-store QA.
- Store purchase verification and stale validation cannot be fully tested.
- Product should show honest unavailable/readiness state for purchase validation.

## IAP QA

- [ ] Product endpoint returns configured product IDs.
- [ ] iOS sandbox receipt verifies when Apple credentials are present.
- [ ] Android sandbox purchase verifies when Play credentials are present.
- [ ] Play RTDN rejects missing/invalid OIDC token in production-like config.
- [ ] Stale validation is visible in admin/support context.

Reference: Stripe Billing should use Billing APIs and Checkout Sessions for subscriptions, with Customer Portal for self-service management.
