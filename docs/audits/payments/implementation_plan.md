# LocateFlow Payment and Mobile Billing Implementation Plan

Audit date: 2026-05-07

This plan is ordered to keep LocateFlow policy-safe while moving from web-only Stripe billing toward native mobile billing and unified entitlement.

## Phase 0: Policy-Safe Launch Without Mobile Purchases

Goal: ship mobile as free/login/existing-account access without store-policy billing risk.

Tasks:

1. Hide or disable mobile subscription purchase CTAs in iOS and Android store builds until native IAP/Play purchase is live.
2. Remove mobile access to Stripe checkout and Stripe customer portal for digital subscription purchase or management.
3. Keep web Stripe checkout and portal available only on web.
4. Add server-side guards to Stripe checkout and portal routes so mobile app clients cannot initiate external billing flows.
5. Change mobile billing copy so it does not mention browser checkout or external payment from iOS/Android.
6. Ensure existing paid users can log in and receive entitlement without purchase calls-to-action.
7. Prepare store review notes explaining that mobile purchase is not available in the Phase 0 build.

Exit criteria:

- iOS and Android builds contain no external checkout links or Stripe portal links for digital features.
- Mobile paywall/upgrade UI is hidden or clearly unavailable without broken purchase buttons.
- Web Stripe purchase still works on web.
- Existing paid user login works on mobile.

## Phase 1: Google Play Billing

Goal: make Android subscriptions technically and policy ready.

Tasks:

1. Configure Play Console subscription products for monthly and yearly LocateFlow Individual subscriptions.
2. Configure base plans and offers for each subscription.
3. Update Android product loading to capture subscription offer tokens.
4. Update Android purchase request to pass `subscriptionOffers` with the selected SKU and offer token.
5. Pass a stable hashed obfuscated account/profile identifier where supported.
6. Verify backend package-name, token, product, and subscription state mapping against Play Developer API responses.
7. Make purchase acknowledgement durable:
   - either fail closed to pending entitlement until ack succeeds,
   - or persist a retry job before granting durable paid access.
8. Verify pending, active, grace, hold, paused, canceled, expired, voided/refunded, and restored states.
9. Configure and test RTDN Pub/Sub push with OIDC verification.

Exit criteria:

- Play sandbox purchase succeeds.
- Backend acknowledgement succeeds or durable retry protects entitlement.
- Restore purchase works.
- RTDN updates entitlement.
- Refunded/voided purchase removes entitlement and preserves refund/revoke status.
- Android UI uses Play management links for Play subscriptions.

## Phase 2: Apple IAP

Goal: make iOS subscriptions technically and policy ready.

Tasks:

1. Configure App Store Connect subscription group and monthly/yearly LocateFlow Individual products.
2. Confirm runtime product IDs match App Store Connect IDs.
3. Confirm pricing, localization, trial/introductory offers, and cancellation disclosure.
4. Pass App Store app account token where supported.
5. Validate signed transaction JWS verification in sandbox and production-like staging.
6. Preserve refund/revoke states distinctly from voluntary cancellation.
7. Configure and test App Store Server Notifications in sandbox and production.
8. Validate purchase, restore, renewal, billing retry, grace, expiration, refund, and revoke flows.

Exit criteria:

- App Store sandbox purchase succeeds.
- Restore purchase works.
- App Store notifications update entitlement.
- Refund/revoke removes entitlement and preserves normalized state.
- iOS UI uses App Store subscription management and no Stripe billing links.

## Phase 3: Unified Entitlement and Reconciliation

Goal: make cross-platform access reliable and prevent duplicate billing/source conflicts.

Tasks:

1. Replace one mutable provider row with a subscription ledger plus derived entitlement, or add explicit provider-source priority and cleanup rules.
2. Prevent duplicate active subscriptions across Stripe, App Store, and Play Store unless intentionally supported.
3. Clear or archive stale provider IDs when a user migrates billing sources.
4. Block Stripe checkout when a user has an active store-managed entitlement.
5. Block store purchase application from leaving stale Stripe subscription identifiers on the active entitlement row.
6. Add Apple and Google scheduled reconciliation for stale store-managed subscriptions.
7. Queue unowned App Store/Play notifications for later correlation rather than discarding them.
8. Add admin visibility for current billing source, original source, stale validation, ack retry status, and refund/revoke history.

Exit criteria:

- Stripe webhooks cannot overwrite current store-managed entitlement unexpectedly.
- Store notifications cannot overwrite unrelated Stripe state incorrectly.
- Expired/refunded/revoked store subscriptions are reconciled even if webhook delivery fails.
- Cross-platform access behaves consistently for every purchase-source/access-target pair.

## Phase 4: Store Review Polish

Goal: reduce review rejection risk.

Tasks:

1. Prepare App Review and Play Review test accounts.
2. Prepare sandbox tester accounts.
3. Write review notes covering login, purchase, restore, existing subscriber access, and support.
4. Verify privacy policy and terms are accessible without login.
5. Complete App Privacy nutrition labels.
6. Complete Play Data Safety form.
7. Verify subscription terms are visible and match store metadata.
8. Run iOS and Android UI tests that check no external checkout/portal links are present.
9. Run a final build smoke test with production-like runtime config but sandbox store environments.

Exit criteria:

- Reviewers can log in and test relevant flows.
- Store metadata matches app behavior.
- Purchase UI is either fully functional or hidden.
- Subscription disclosures are complete.

## Phase 5: Monitoring, Refunds, and Support

Goal: operate billing safely after launch.

Tasks:

1. Add dashboards for webhook failures, stale validation, ack retries, refunds, revocations, and source conflicts.
2. Add alerts for App Store/Play/Stripe reconciliation drift.
3. Redact or hash purchase tokens, transaction IDs, webhook IDs, and provider customer IDs in logs.
4. Document support playbooks for:
   - restore purchases,
   - duplicate subscription,
   - refund/revoke,
   - billing source migration,
   - account deletion,
   - chargeback/dispute.
5. Add recurring audit checks for store product configuration and runtime config drift.

Exit criteria:

- Support can identify billing source and management destination without exposing secrets.
- Refund/revoke events are visible and auditable.
- Provider drift is detected before users report entitlement issues.

## Launch Recommendation

Use Phase 0 for the next store submission if a mobile release is urgent. Do not enable production mobile purchase until Phases 1 through 4 are complete for the relevant platform.

Keep Stripe web-only. Treat App Store and Play Billing as required for new mobile purchases of LocateFlow premium digital features.
