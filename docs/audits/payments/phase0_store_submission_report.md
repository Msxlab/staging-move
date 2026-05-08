# LocateFlow Phase 0 Store Submission Report

Date: 2026-05-07

Scope: Phase 0 implementation for policy-safe App Store and Play Store submission as free/login/no-mobile-purchase builds.

## Summary

LocateFlow mobile store builds now default to no mobile purchases. The mobile app does not expose Stripe checkout, Stripe customer portal, external payment links, or browser-checkout language for digital subscriptions.

Web Stripe billing remains available through the web app. Existing paid web subscribers can sign in on mobile and use their entitled account without mobile billing links.

## What Was Hidden Or Disabled

- Mobile store purchases are gated by `EXPO_PUBLIC_MOBILE_STORE_PURCHASES_ENABLED`.
- The flag defaults to disabled in code unless explicitly set to `true`.
- EAS build profiles set `EXPO_PUBLIC_MOBILE_STORE_PURCHASES_ENABLED=false`.
- Mobile subscription screen does not call Stripe checkout.
- Mobile subscription screen does not call Stripe customer portal.
- Mobile restore purchases is hidden unless mobile store purchases are enabled and native store products are available.
- Mobile IAP helper refuses product fetch, purchase, restore, and native manage calls while the store-purchase flag is disabled.
- Budget premium gate no longer shows a "View plans" purchase CTA while the store-purchase flag is disabled.
- Mobile browser-checkout wording was replaced with neutral native-store or unavailable copy.

## Existing Paid Users

Existing Stripe/web paid users can still sign in to the mobile apps. Entitlement continues to come from the backend subscription state returned through profile and entitlement APIs.

Mobile displays this read-only billing source message for Stripe-managed users:

> Your subscription is managed on the web. You can continue using your account here.

Mobile does not expose a Stripe portal link for these users.

## Free Users Or Users Without Entitlement

Free users can sign in and use the free mobile experience. Premium-gated areas remain gated by backend entitlement.

Where billing context is shown, mobile displays:

> Mobile purchases are not available in this version.

No broken purchase button, Stripe checkout fallback, or Stripe portal fallback should be visible in store builds.

## Play Store Submission Notes

Use this build only as a free/login/no-mobile-purchase Android submission.

Reviewer note placeholder:

- Test account email: `[ADD REVIEWER EMAIL]`
- Test account password: `[ADD REVIEWER PASSWORD]`
- Purchase behavior: Mobile purchases are not available in this version.
- Existing paid account behavior: Existing paid users may sign in and use entitled features; billing is managed on the web.
- Restore purchases: Hidden in this build because Google Play Billing purchase launch is not enabled.
- Premium-gated feature behavior: Users without entitlement see that mobile purchases are not available.

Manual Play Console setup still needed before paid Android launch:

- Active subscription products.
- Base plans and offers.
- Offer token purchase flow.
- License testers.
- RTDN Pub/Sub and OIDC verification.
- Play Data Safety declaration.
- Review notes for active Play Billing purchase and restore flow.

## App Store Submission Notes

Use this build only as a free/login/no-mobile-purchase iOS submission.

Reviewer note placeholder:

- Test account email: `[ADD REVIEWER EMAIL]`
- Test account password: `[ADD REVIEWER PASSWORD]`
- Purchase behavior: Mobile purchases are not available in this version.
- Existing paid account behavior: Existing paid users may sign in and use entitled features; billing is managed on the web.
- Restore purchases: Hidden in this build because Apple IAP purchase launch is not enabled.
- Premium-gated feature behavior: Users without entitlement see that mobile purchases are not available.

Manual App Store Connect setup still needed before paid iOS launch:

- Active IAP subscription products.
- Subscription group and pricing.
- Sandbox testers.
- App Store Server Notifications.
- App Privacy nutrition labels.
- Review notes for active IAP purchase and restore flow.

## Remaining IAP Work

- Implement and test Android Play Billing subscription offer token handling.
- Complete Apple IAP product setup and sandbox validation.
- Add mobile IAP reconciliation cron jobs.
- Resolve unified entitlement source conflicts between Stripe, App Store, and Play Store.
- Preserve refund/revoke state distinctly for App Store and Play Store.
- Add end-to-end purchase, restore, expiration, refund, and revoke tests before enabling mobile purchases.

## Verification Checklist

- Mobile subscription UI has no Stripe checkout call.
- Mobile subscription UI has no Stripe portal call.
- Mobile restore purchases is hidden by default.
- Mobile feature gate shows unavailable copy rather than purchase CTA when purchases are disabled.
- Stripe checkout rejects mobile app clients with `MOBILE_EXTERNAL_BILLING_NOT_ALLOWED`.
- Stripe portal rejects mobile app clients with `MOBILE_EXTERNAL_BILLING_NOT_ALLOWED`.
- Web checkout and portal requests remain allowed.

