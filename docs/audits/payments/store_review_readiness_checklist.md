# LocateFlow Store Review Readiness Checklist

Audit date: 2026-05-07

This checklist is based on source evidence plus items that require manual App Store Connect, Play Console, Stripe, and reviewer-account verification. Secret values and provider account contents were not inspected.

## Current Recommendation

Do not submit mobile builds with paid mobile subscription purchase enabled yet.

Submit only as free/login/no-mobile-purchase if:

- Mobile subscription purchase CTAs are hidden or disabled.
- Mobile Stripe checkout and Stripe portal links are not exposed.
- Existing paid users can log in without being directed to external purchase.
- Review notes clearly explain the account/login flow.

## Apple App Store

### Source-verifiable

- iOS bundle ID is configured as `com.locateflow.mobile`.
- Mobile subscription screen uses native IAP path when iOS product IDs are available.
- Backend verifies Apple signed transaction JWS and bundle ID.
- App Store Server Notification route exists and verifies signed notifications.
- Restore purchases UI and client flow exist when IAP is available.
- Public privacy and policy pages exist in the web app source.

### Needs manual verification

- Bundle ID in App Store Connect matches `com.locateflow.mobile`.
- Paid subscription products exist in App Store Connect.
- Monthly and yearly products match runtime product ID configuration.
- Products are in the correct subscription group.
- Pricing, duration, display name, and localized descriptions match the app UI.
- Any trial or introductory offer terms are configured and disclosed.
- First IAP is submitted with the app version if required.
- Sandbox testers are configured.
- App Store Server Notification sandbox and production URLs are configured.
- App Review test account exists and can log in.
- App Review notes explain purchase, restore, existing subscriber login, and premium feature access.
- App Privacy nutrition labels match actual account, address, document, analytics, notification, and payment data flows.
- No iOS screen directs users to Stripe checkout or Stripe portal for digital subscription purchase or management.
- If mobile purchase is disabled for Phase 0, no unfinished paywall or broken purchase CTA is visible.

### Must pass before iOS mobile purchase launch

- Sandbox purchase succeeds.
- Restore purchases succeeds.
- Renewal updates backend entitlement.
- Expiration removes entitlement after period end.
- Billing retry/grace state is represented correctly.
- Refund/revoke removes entitlement and preserves refund/revoke status.
- Existing web-paid account login works without external purchase steering.
- App Store-managed users see App Store subscription management, not Stripe portal.

## Google Play

### Source-verifiable

- Android package name is configured as `com.locateflow.mobile`.
- Native Gradle application ID is `com.locateflow.mobile`.
- Android billing permission is present.
- Mobile subscription screen uses native IAP path when Android product IDs are available.
- Backend verifies Google Play subscriptions through Play Developer API.
- Play RTDN route exists with package validation and OIDC verification support.
- Restore purchases UI and client flow exist when IAP is available.

### Needs manual verification

- Play Console package name matches `com.locateflow.mobile`.
- Subscription products exist and are active.
- Monthly and yearly product IDs match runtime config.
- Base plans and offers are configured.
- Offer tokens are available and consumed by the client purchase flow.
- License testers and test cards are configured.
- RTDN Pub/Sub topic and push endpoint are configured.
- RTDN OIDC audience and expected service account settings are configured.
- Play Review test account exists and can log in.
- Review notes explain purchase, restore, existing subscriber login, and premium feature access.
- Play Data Safety answers match actual account, address, document, analytics, notification, and payment data flows.
- No Android screen directs users to Stripe checkout or Stripe portal for digital subscription purchase or management unless a vetted exception applies.
- If mobile purchase is disabled for Phase 0, no unfinished paywall or broken purchase CTA is visible.

### Must pass before Android mobile purchase launch

- Client purchase request includes Play subscription offer token/base plan offer data.
- Sandbox purchase succeeds.
- Backend verification validates package, token, product, and subscription state.
- Acknowledgement succeeds or entitlement remains pending until durable retry succeeds.
- Restore purchases succeeds.
- Renewal updates backend entitlement.
- Expiration removes entitlement after period end.
- Grace/on-hold/canceled/refunded states map correctly.
- Existing web-paid account login works without external purchase steering.
- Play-managed users see Play subscription management, not Stripe portal.

## Stripe Web

### Source-verifiable

- Web checkout route exists.
- Web portal route exists.
- Stripe webhook verifies signatures.
- Stripe webhook has idempotency and livemode checks.
- Stripe checkout grants only pending state before webhook confirmation.
- Stripe refund maps to refunded state.
- Stripe reconciliation route exists.

### Needs hardening before mobile store launch

- Checkout endpoint should reject iOS/Android store app clients.
- Portal endpoint should reject iOS/Android store app clients.
- Mobile app should not expose Stripe portal for digital subscriptions.
- Existing store-managed subscribers should not be prompted into Stripe checkout.

## Reviewer Notes To Prepare

- Test account email and password.
- Whether the build is Phase 0 free/login-only or has active IAP.
- Steps to access premium-gated areas.
- Steps to purchase through IAP or Play Billing if enabled.
- Steps to restore purchases.
- Existing paid account behavior if web Stripe subscribers can log in.
- Support contact.
- Privacy policy URL.
- Terms URL.
- Subscription terms and cancellation instructions.

## Final Store Readiness Status

| Area | Status |
| --- | --- |
| Phase 0 free/login mobile submission | Possible after hiding/disabling mobile purchase UI and external billing links |
| iOS paid subscription submission | Not ready |
| Android paid subscription submission | Not ready |
| Web Stripe billing | Ready for web use with mobile guardrail hardening |
| Unified cross-platform entitlement | Needs source-of-truth fixes before scale |
