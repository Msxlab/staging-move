# LocateFlow Google Play Policy Audit

Date: 2026-05-07

Scope: Google Play Internal Testing for `com.locateflow.mobile`.

Release posture:

- LocateFlow is free to download.
- LocateFlow requires login.
- Android subscriptions must use Google Play Billing.
- Mobile Stripe checkout and Stripe portal must not be exposed.
- Web Stripe remains web-only.
- Apple IAP is not changed in this task.

## Executive Summary

LocateFlow is materially closer to a Play Billing-enabled Android internal test build after this pass.

Implemented:

- `com.android.vending.BILLING` is intentionally kept.
- `expo-iap` is intentionally kept.
- Unused `CAMERA`, `READ_EXTERNAL_STORAGE`, and `WRITE_EXTERNAL_STORAGE` are blocked in Expo config.
- Android subscription purchases now preserve and pass Google Play `offerToken` through `subscriptionOffers`.
- Missing Android offer token fails safely before opening a broken purchase flow.
- Backend Google verification rejects product ID mismatches.
- Backend Google acknowledgement failure no longer grants durable entitlement.
- Restore/cross-account protection now checks Google `purchaseToken` ownership as well as transaction identity.
- Mobile Privacy Policy link was added.
- Web privacy policy no longer renders the legal entity placeholder; it falls back to `LocateFlow`.

Current blocker before turning on Android purchase UI in a store AAB:

- `EXPO_PUBLIC_MOBILE_STORE_PURCHASES_ENABLED` is still `false` in `apps/mobile/eas.json`.
- This should remain false until Play Console products/base plans, runtime config, Google service account, RTDN, and reviewer/test accounts are configured and verified.
- Once those manual dependencies are complete, enabling the Android store build flag is technically reasonable from the source changes in this pass.

## Permission Audit

Explicit Android permissions in `apps/mobile/app.json`:

- `INTERNET`
- `VIBRATE`
- `RECEIVE_BOOT_COMPLETED`

Native manifest includes:

- `com.android.vending.BILLING`

Blocked Android permissions in `apps/mobile/app.json`:

- `android.permission.CAMERA`
- `android.permission.READ_EXTERNAL_STORAGE`
- `android.permission.WRITE_EXTERNAL_STORAGE`

Findings:

- No active camera capture feature was found.
- No active `expo-image-picker` or `expo-document-picker` usage was found in mobile app/source files.
- `CAMERA` and legacy storage permissions are introduced by native dependency metadata from packages such as `expo-image-picker` and `expo-file-system`.
- `com.android.vending.BILLING` is required for Android subscriptions and must remain.

## Google Play Billing Readiness

Client:

- `expo-iap` remains installed.
- Android product details are loaded with `fetchProducts({ skus, type: "subs" })`.
- Android subscription offer details are normalized from `subscriptionOfferDetailsAndroid`.
- Android purchase requests now include `subscriptionOffers: [{ sku: productId, offerToken }]`.

Backend:

- `/api/mobile/iap/verify` verifies purchase tokens through the Google Play Developer API path.
- Google API client uses `GOOGLE_PLAY_PACKAGE_NAME` as the package trust anchor.
- Product IDs are mapped through runtime config and unknown products are rejected.
- Client-submitted Android `productId` must now match the verified Google subscription product ID.
- Pending active subscriptions must be acknowledged successfully before entitlement state is returned.
- RTDN webhook verifies Pub/Sub OIDC when configured, validates package name, and uses webhook idempotency.

Remaining manual setup:

- Create and activate Play subscription products/base plans/offers.
- Configure runtime secrets and public product ID keys.
- Configure RTDN Pub/Sub push with OIDC.
- Add license testers and reviewer account.
- Flip the mobile store purchase build flag only after the above is ready.

## Stripe Policy Posture

Confirmed source posture:

- Mobile app does not call Stripe checkout.
- Mobile app does not open Stripe customer portal.
- Existing Stripe-paid users can sign in and keep entitlement.
- Stripe-managed subscriptions are read-only from mobile.
- Web Stripe checkout/portal remain available for web.
- Server routes reject mobile app clients with `MOBILE_EXTERNAL_BILLING_NOT_ALLOWED`.

## Privacy Policy

Use this URL in Play Console:

`https://locateflow.com/privacy`

The mobile Privacy settings screen now exposes a visible Privacy Policy link to this URL.

Web privacy page now renders:

- `Legal entity: LocateFlow` when no legal entity env override is configured.

Before production, the legal entity shown in the privacy policy must match the Google Play Console developer/legal identity.

## Store Listing Guidance

Use listing language consistent with:

- Free download.
- Login required.
- Optional Android subscription available through Google Play Billing.
- No external mobile checkout.

Avoid:

- Stripe checkout in mobile listing copy.
- Browser checkout language.
- Claims that subscription management happens outside Google Play for Android purchases.

## Official References

- Expo app permissions and `android.blockedPermissions`: `https://docs.expo.dev/guides/permissions/`
- EAS build profiles and env config: `https://docs.expo.dev/build/eas-json/`
- Google Play Billing integration and acknowledgement guidance: `https://developer.android.com/google/play/billing/integrate`
- Google Play subscriptions/base plans/offers: `https://support.google.com/googleplay/android-developer/answer/12154973`
- Google Play Developer API subscriptions acknowledgement: `https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptions/acknowledge`

