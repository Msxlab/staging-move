# LocateFlow Play Billing Internal Testing Report

Date: 2026-05-07

## Readiness Decision

Code readiness after this pass: conditionally ready for Android Play Billing internal testing.

Conditionally ready means:

- The source now handles Android subscription offer tokens.
- Backend verification and acknowledgement behavior are safer.
- Billing permission is intentionally present.
- Purchase UI must stay disabled until Play Console and runtime config are completed.

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

- `EXPO_PUBLIC_MOBILE_STORE_PURCHASES_ENABLED=false` in EAS profiles.

Recommendation:

- Keep false until manual Play setup is complete.
- After Play products/runtime config are ready, enable true for Android internal test store builds only.
- Do not use Stripe checkout or portal inside mobile.
- Do not enable Apple IAP as part of this Android-only task.

## Required Runtime Values

Use these exact keys. Do not print or commit secret values.

- `GOOGLE_PLAY_PACKAGE_NAME=com.locateflow.mobile`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY`
- `GOOGLE_PLAY_RTDN_AUDIENCE=https://locateflow.com/api/webhooks/playstore`
- `EXPECTED_PLAYSTORE_WEBHOOK_SERVICE_ACCOUNT_EMAIL` or `EXPECTED_PLAYSTORE_WEBHOOK_SUBJECT`
- `MOBILE_ANDROID_PRODUCT_INDIVIDUAL`
- `MOBILE_ANDROID_PRODUCT_INDIVIDUAL_YEARLY` if yearly is supported

## New AAB Requirement

A new AAB is required because Android manifest permissions are binary-level metadata.

The next AAB should:

- Keep `com.android.vending.BILLING`.
- Remove/block `CAMERA`.
- Remove/block legacy external storage permissions.

