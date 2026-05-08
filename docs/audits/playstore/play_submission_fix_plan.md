# Google Play Internal Testing Fix Plan

## Goal

Prepare LocateFlow for Google Play Internal Testing as:

- Free to download.
- Login required.
- Android in-app subscriptions through Google Play Billing.
- No mobile Stripe checkout.
- No mobile Stripe portal.
- No Apple IAP changes in this task.

## Completed In This Pass

1. Android permission cleanup

- Blocked unused `android.permission.CAMERA`.
- Blocked unused `android.permission.READ_EXTERNAL_STORAGE`.
- Blocked unused `android.permission.WRITE_EXTERNAL_STORAGE`.
- Kept `com.android.vending.BILLING`.

2. Android Play Billing client readiness

- Preserved `expo-iap`.
- Normalized Android subscription offer details from Play product details.
- Passed `subscriptionOffers` and `offerToken` in Android subscription purchase requests.
- Added safe failure for missing offer token.
- Kept iOS purchase request shape independent of Android offer tokens.

3. Backend Play verification hardening

- Verified Google product ID from API response against client product ID.
- Rejected acknowledgement failures before entitlement is returned.
- Added Google purchase-token ownership guard for restore/cross-account abuse.

4. Privacy readiness

- Added mobile Privacy Policy link.
- Fixed rendered web privacy legal entity fallback to `LocateFlow`.

## Keep Disabled Until Manual Config Is Complete

`EXPO_PUBLIC_MOBILE_STORE_PURCHASES_ENABLED` remains `false` in `apps/mobile/eas.json`.

Do not enable it until:

- Google Play products/base plans/offers are active.
- Runtime config values are set.
- Google Play service account has Android Publisher API access.
- RTDN Pub/Sub push is configured with OIDC.
- Internal tester/reviewer accounts are configured.
- Test purchase/restore/cancel/refund flows pass.

## Runtime Config Checklist

Set these values without exposing secrets:

- `GOOGLE_PLAY_PACKAGE_NAME=com.locateflow.mobile`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY`
- `GOOGLE_PLAY_RTDN_AUDIENCE=https://locateflow.com/api/webhooks/playstore`
- `EXPECTED_PLAYSTORE_WEBHOOK_SERVICE_ACCOUNT_EMAIL` or `EXPECTED_PLAYSTORE_WEBHOOK_SUBJECT`
- `MOBILE_ANDROID_PRODUCT_INDIVIDUAL`
- `MOBILE_ANDROID_PRODUCT_INDIVIDUAL_YEARLY` if yearly is supported

## Build Commands

Permission-correct AAB with current repo flag state:

```powershell
pnpm --filter @locateflow/mobile exec eas build --platform android --profile production
```

Billing-enabled AAB requires enabling `EXPO_PUBLIC_MOBILE_STORE_PURCHASES_ENABLED=true` for the Android store build after the manual checklist is complete.

## Play Console Steps

1. Enter privacy policy URL: `https://locateflow.com/privacy`.
2. Complete App access with reviewer credentials.
3. Create and activate subscription products/base plans/offers.
4. Add license testers.
5. Complete Ads declaration.
6. Complete Content rating.
7. Complete Target audience.
8. Complete Data Safety.
9. Complete Government apps declaration.
10. Complete Financial features declaration.
11. Complete Health declaration.
12. Upload a new AAB after permission changes.
13. Use Internal testing first.

