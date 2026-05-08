# LocateFlow Play Billing Internal Testing Report

Date: 2026-05-08

## Readiness Decision

Code readiness after this pass: ready for Android Play Billing internal testing after Play Console/runtime configuration is completed.

Conditionally ready means:

- The source now handles Android subscription offer tokens.
- Backend verification and acknowledgement behavior are safer.
- Billing permission is intentionally present.
- Production EAS store builds now compile mobile store purchase support on.
- If runtime product IDs are missing, the mobile UI still fails closed and shows no broken purchase flow.

## Android Billing Permission

`com.android.vending.BILLING` is present in the native Android manifest and must remain.

Do not block:

- `com.android.vending.BILLING`

Do not remove:

- `expo-iap`

## Offer Token / Base Plan Handling

Before this pass, Android subscription purchase requests used only SKUs.

Now:

- Product details preserve Android `subscriptionOfferDetailsAndroid`.
- Monthly and annual products select offer tokens by billing period when possible.
- Android purchase requests pass `subscriptionOffers`.
- Missing offer token returns `IAP_ANDROID_OFFER_TOKEN_MISSING` instead of launching an invalid purchase request.

Tests added:

- Monthly product keeps offer token.
- Annual product keeps offer token.
- Android purchase request includes `subscriptionOffers`.
- Missing Android offer token fails safely.
- iOS request shape remains independent of Android offer tokens.

## Backend Verification

Backend behavior:

- Calls Google Play Developer API for subscription token verification.
- Uses `GOOGLE_PLAY_PACKAGE_NAME` as package-name trust anchor.
- Maps verified Google product ID to configured LocateFlow billing plan.
- Rejects Android verification if client `productId` does not match the verified Google product ID.
- Acknowledges pending active Google subscriptions server-side.
- If acknowledgement fails, entitlement is not returned and the client can retry.
- Prevents cross-account restore by checking both `originalTransactionId` and Google `purchaseToken` ownership.

Remaining backend/manual dependencies:

- Service account credentials must be configured.
- RTDN push service account/audience must be configured.
- Refund/voided purchase flows should be tested with Play Console test tools.

## Purchase UI Flag

Current source state:

- Development/preview/staging-preview keep mobile store purchases disabled.
- Production EAS store builds set:
  - `EXPO_PUBLIC_MOBILE_STORE_PURCHASES_ENABLED=true`
  - `EXPO_PUBLIC_MOBILE_IOS_STORE_PURCHASES_ENABLED=true`
  - `EXPO_PUBLIC_MOBILE_ANDROID_STORE_PURCHASES_ENABLED=true`

Recommendation:

- Build Play Internal Testing and TestFlight/store builds from the production profile after runtime product IDs and store products are configured.
- Do not use Stripe checkout or portal inside mobile.
- Do not use Apple Pay for digital subscription unlocks. iOS uses StoreKit/IAP.

## Cross-Platform Subscription Guards

This pass also hardens mixed-source entitlement behavior:

- Mobile manage-subscription links are platform-aware.
- An iOS App Store subscription is not sent to Google Play management on Android.
- A Google Play subscription is not sent to App Store management on iOS.
- Stripe subscriptions remain usable on mobile but mobile does not expose Stripe checkout or portal.
- Backend IAP verification rejects new store purchases when the user already has an active subscription managed by another provider.
- Web Stripe checkout rejects active App Store / Google Play subscribers to avoid duplicate billing.
- Expired Stripe users can move to store billing; stale Stripe fields are cleared when the store subscription is attached.
- Apple and Google canceled-but-not-expired subscriptions remain entitled through the paid period using `CANCEL_AT_PERIOD_END`.

## Required Runtime Values

Use these exact keys. Do not print or commit secret values.

- `GOOGLE_PLAY_PACKAGE_NAME=com.locateflow.mobile`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY`
- `GOOGLE_PLAY_RTDN_AUDIENCE=https://locateflow.com/api/webhooks/playstore`
- `EXPECTED_PLAYSTORE_WEBHOOK_SERVICE_ACCOUNT_EMAIL` or `EXPECTED_PLAYSTORE_WEBHOOK_SUBJECT`
- `MOBILE_ANDROID_PRODUCT_INDIVIDUAL`
- `MOBILE_ANDROID_PRODUCT_INDIVIDUAL_YEARLY` if yearly is supported

For iOS StoreKit:

- `APPLE_BUNDLE_ID=com.locateflow.mobile`
- `APPLE_APP_STORE_ISSUER_ID`
- `APPLE_APP_STORE_KEY_ID`
- `APPLE_APP_STORE_PRIVATE_KEY`
- `APPLE_APP_STORE_ENVIRONMENT`
- `MOBILE_IOS_PRODUCT_INDIVIDUAL`
- `MOBILE_IOS_PRODUCT_INDIVIDUAL_YEARLY` if yearly is supported

## New AAB Requirement

A new AAB is required because Android manifest permissions are binary-level metadata.

The next AAB should:

- Keep `com.android.vending.BILLING`.
- Remove/block `CAMERA`.
- Remove/block legacy external storage permissions.
