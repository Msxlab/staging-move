# LocateFlow Mobile Billing / Store Compliance Audit

Audit date: 2026-05-07

Scope: read-only source audit of LocateFlow payment, subscription, entitlement, Stripe, Play Billing, Apple In-App Purchase, mobile purchase UI, webhook, and store-readiness flows.

Source basis: application source, package files, route handlers, schema, config references, tests, and mobile code. Existing markdown reports and memory files were not used as source of truth. Secret values were not inspected or reproduced.

Policy references used for baseline:
- Apple App Store Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Google Play Payments policy: https://support.google.com/googleplay/android-developer/answer/10281818
- Google Play Billing integration and acknowledgement guidance: https://developer.android.com/google/play/billing/integrate
- Google Play Data safety guidance: https://support.google.com/googleplay/android-developer/answer/10144311

## 1. Executive Summary

Current readiness:

| Area | Readiness | Finding |
| --- | --- | --- |
| Google Play Billing | Not production ready | Android IAP code exists, but the subscription purchase call does not provide Play Billing subscription offer tokens/base-plan offer data, product/store configuration is not verifiable from source, acknowledgement is best-effort after entitlement verification, and no mobile revalidation cron was found. |
| Apple IAP | Not production ready | iOS IAP code and server-side App Store transaction verification exist, but App Store Connect product/subscription group configuration is not source-verifiable, refund/revoke state is flattened to canceled, no mobile revalidation cron was found, and mobile UI can expose Stripe billing portal links for web-paid users. |
| Stripe web billing | Mostly ready for web-only use | Checkout, portal, webhook signature verification, idempotency, Stripe status mapping, refund handling, and Stripe reconciliation are implemented. Keep it web-only and harden mobile access to checkout/portal endpoints. |
| In-app purchases today | Partially implemented, not launch safe | Mobile subscription screen attempts native IAP when product IDs are configured and does not fall back to Stripe checkout on iOS/Android. However Android purchase mechanics and store configuration are not ready enough for production purchase enablement. |
| Web purchases today | Technically supported | Web Stripe checkout can create subscription sessions, and entitlements are granted from verified Stripe webhook state rather than a client success redirect. |

Biggest blockers:

1. Android subscription purchases likely fail or are incomplete because the client sends only SKUs and does not pass Play Billing subscription offer tokens.
2. Unified entitlement uses one `Subscription` row per user and does not cleanly separate Stripe, App Store, and Play Store sources. Store purchases can leave stale Stripe identifiers, and later Stripe webhooks can overwrite store-managed state.
3. Mobile UI exposes Stripe customer portal opening from iOS/Android for Stripe-managed users. This is a policy steering risk for digital subscriptions.
4. No scheduled mobile IAP reconciliation job was found, despite admin UI text expecting one. Missed App Store/Play notifications can leave stale entitlement.
5. Store product IDs, subscription groups, Play base plans/offers, sandbox testers, review test credentials, privacy labels, and Data Safety declarations require manual store verification.

Recommended launch path:

- Phase 0: Submit mobile apps only as free/login apps with mobile subscription purchase UI and external billing links hidden or disabled.
- Keep Stripe for web billing only.
- Allow existing paid account login across platforms only if mobile UI avoids directing users to web checkout or external subscription changes.
- Enable Android and iOS purchases only after native purchase flow, backend source-of-truth conflicts, store config, reconciliation, refund/revoke handling, and policy UI tests are complete.

## 2. Current Payment Architecture

### Product/payment model

Source evidence:

- `packages/shared/src/billing.ts`
- `packages/shared/src/acquisition.ts`
- `packages/db/prisma/schema.prisma`
- `apps/mobile/app/settings/subscription.tsx`

LocateFlow sells digital app functionality consumed inside the app:

- More saved addresses.
- More tracked services.
- Reminders and moving-task features.
- Document storage.
- Smart moving checklist.
- Export features.
- Premium moving-plan and budget-related app access.

The authoritative shared billing model contains:

- Free Access / free trial style access.
- Individual paid plan.
- Monthly billing label: `$3.99/month`.
- Annual billing label: `$39.99/year`.
- Default trial duration: 14 days.
- Annual trial campaign support in acquisition code, including a 90-day campaign shape.

No authoritative current one-time purchase or active family plan was found in shared billing. Some legacy/admin surfaces still reference family-like concepts, but the current shared billing order contains only `FREE_TRIAL` and `INDIVIDUAL`.

Because these are digital app features and cloud/software services used inside Android and iOS apps, mobile purchases for new subscriptions should use Google Play Billing on Android and Apple In-App Purchase on iOS.

### Web Stripe

Source evidence:

- `apps/web/src/app/api/stripe/checkout/route.ts`
- `apps/web/src/app/api/stripe/checkout/cancel/route.ts`
- `apps/web/src/app/api/stripe/portal/route.ts`
- `apps/web/src/app/api/subscription/actions/route.ts`
- `apps/web/src/app/api/webhooks/stripe/route.ts`
- `apps/web/src/app/api/cron/stripe-reconcile/route.ts`
- `apps/web/src/lib/billing.ts`
- `apps/web/src/lib/billing-config.ts`
- `apps/web/src/lib/stripe.ts`

Stripe supports web checkout, Stripe customer portal, local pending checkout state, verified webhook state transitions, refund handling, cancellation/resume actions, and a Stripe reconciliation cron route.

Stripe plan IDs are resolved from runtime config names, not hardcoded values. The route stores `PENDING_CHECKOUT` before redirecting and relies on Stripe webhook events for active entitlement.

### Android Play Billing

Source evidence:

- `apps/mobile/package.json`
- `apps/mobile/app.json`
- `apps/mobile/android/app/build.gradle`
- `apps/mobile/android/app/src/main/AndroidManifest.xml`
- `apps/mobile/src/lib/iap.ts`
- `apps/mobile/app/settings/subscription.tsx`
- `apps/web/src/app/api/mobile/iap/products/route.ts`
- `apps/web/src/app/api/mobile/iap/verify/route.ts`
- `apps/web/src/app/api/webhooks/playstore/route.ts`
- `apps/web/src/lib/iap-google.ts`
- `apps/web/src/lib/iap-common.ts`

The mobile app includes an IAP dependency and Android has `com.android.vending.BILLING` permission. The Android package is `com.locateflow.mobile` in both Expo config and native Gradle config.

The client fetches subscription product metadata and attempts purchases through `expo-iap`. Backend verification uses Google Play Developer API subscription lookup and validates package name through runtime config. RTDN webhook handling exists and includes Pub/Sub OIDC verification when configured.

Major issue: the Android purchase request sends SKUs but no subscription offer token/base plan offer data. Modern Google Play Billing subscription purchases require an offer token for subscriptions. The installed `expo-iap` native module expects subscription offer token arrays for subscription purchases. This makes Android purchase production readiness doubtful until corrected and tested against Play Console products.

### iOS StoreKit/IAP

Source evidence:

- `apps/mobile/package.json`
- `apps/mobile/app.json`
- `apps/mobile/src/lib/iap.ts`
- `apps/mobile/app/settings/subscription.tsx`
- `apps/web/src/app/api/mobile/iap/products/route.ts`
- `apps/web/src/app/api/mobile/iap/verify/route.ts`
- `apps/web/src/app/api/webhooks/appstore/route.ts`
- `apps/web/src/lib/iap-apple.ts`
- `apps/web/src/lib/iap-common.ts`

The iOS bundle ID is `com.locateflow.mobile`. The client uses `expo-iap`, sends signed transaction JWS data to the backend, and finishes transactions only after backend verification succeeds.

The backend verifies Apple JWS transactions, validates bundle ID, uses App Store Server API, and handles App Store Server Notifications. Store configuration, product state, subscription group setup, sandbox testers, and first-IAP submission status are not verifiable from source.

### Backend subscription/entitlement

Source evidence:

- `packages/db/prisma/schema.prisma`
- `apps/web/src/lib/billing.ts`
- `apps/web/src/lib/plan-limits.ts`
- `apps/web/src/lib/api-gates.ts`
- `apps/web/src/lib/iap-common.ts`
- `apps/web/src/app/api/profile/route.ts`

The backend uses one `Subscription` row per user. It stores provider, platform, plan, status, Stripe IDs, App Store transaction IDs, Google purchase token, product ID, current period, trial/grace/cancellation fields, and campaign metadata.

Entitlement is derived from normalized subscription status and period dates. Web, Android, and iOS access are effectively unified through the same backend subscription row.

Risk: one-row-per-user simplifies entitlement but creates source conflicts. Applying an App Store or Play Store purchase does not clear old Stripe identifiers. Later Stripe webhooks or reconciliation can still match and overwrite the row. Conversely, Stripe checkout can be started by a user with an existing store subscription. This is the largest entitlement architecture issue.

### Webhooks/reconciliation

Implemented:

- Stripe webhook with signature verification, livemode guard, age guard, idempotency storage, and status mapping.
- Stripe reconciliation cron route.
- App Store Server Notification route with signed JWS verification and idempotency.
- Play RTDN route with Pub/Sub envelope validation, package validation, and OIDC verification when configured.

Missing or incomplete:

- No scheduled mobile App Store/Play Store subscription revalidation cron was found.
- Refund/revoke handling for Apple and Play is present but normalized mostly to `CANCELED`, losing refund/revocation specificity.
- Store notifications for purchases not previously linked to a user are swallowed as unowned rather than queued for later correlation.

## 3. Policy Compliance Review

### Google Play policy risk

Google Play policy requires Play Billing for digital content, subscriptions, premium features, and app functionality consumed in an Android app unless a specific exception or alternative billing program applies.

LocateFlow premium features are digital and consumed inside the app. Android must offer Google Play Billing for new purchases in the app. The current mobile code attempts native IAP and avoids Stripe checkout fallback when IAP is unavailable, which is the right direction. However, Android purchase readiness is incomplete because of missing subscription offer token handling, manual product configuration gaps, and no mobile reconciliation job.

Policy risk is high if Android shows subscribe/upgrade CTAs but cannot complete Play Billing or routes users to Stripe checkout/portal for digital subscription changes.

### Apple App Store policy risk

Apple requires In-App Purchase for digital content, subscriptions, premium features, and app functionality unlocked inside iOS apps. Apple Pay is for physical goods and services, not digital app features/subscriptions. Apple also permits multiplatform apps to let users access content/subscriptions acquired elsewhere, provided the iOS app does not direct users to non-IAP purchase mechanisms where prohibited.

LocateFlow does not appear to use Apple Pay for digital subscription unlocks. That is correct.

Current risk comes from:

- Stripe customer portal links being openable from iOS for Stripe-managed users.
- Upgrade/accessibility copy that still references browser checkout.
- Store product/configuration and sandbox review evidence not being verifiable.
- App Store refund/revoke states being flattened rather than stored distinctly.

### Apple Pay vs IAP clarification

Apple Pay is not the correct mechanism for unlocking LocateFlow premium digital features inside iOS. If mobile subscription purchase is offered, use StoreKit/In-App Purchase. Stripe and Apple Pay may remain web-only where policy allows.

### Web purchase behavior

Web Stripe billing is generally allowed on the web. Existing web-paid users can log into mobile and access their account as a multiplatform service, but mobile UI must avoid steering them to external checkout or external subscription changes.

### Mobile purchase behavior

Mobile apps should:

- Use Apple IAP on iOS for new mobile purchases.
- Use Google Play Billing on Android for new mobile purchases.
- Not fall back to Stripe checkout for mobile digital subscriptions.
- Avoid browser checkout wording, web checkout links, or Stripe portal links inside store-distributed apps unless counsel confirms a specific exception applies.

## 4. Android Google Play Billing Audit

### Client implementation

Evidence:

- `apps/mobile/package.json` includes an IAP package.
- `apps/mobile/android/app/src/main/AndroidManifest.xml` declares billing permission.
- `apps/mobile/app/settings/subscription.tsx` shows native IAP CTAs when product IDs are available.
- `apps/mobile/src/lib/iap.ts` fetches subscription products, starts purchase, verifies with backend, then finishes transaction.

Gaps:

- Android subscription purchase request does not pass subscription offer tokens/base-plan offer tokens.
- No store-level obfuscated account identifier is passed to bind the purchase to a LocateFlow user at purchase time.
- Purchase flow has no explicit timeout path if no purchase update/error event is received.
- Product IDs are runtime-configured and cannot be matched to Play Console from source.

### Backend verification

Evidence:

- `apps/web/src/app/api/mobile/iap/verify/route.ts`
- `apps/web/src/lib/iap-google.ts`
- `apps/web/src/lib/iap-common.ts`

Strengths:

- Authenticated verification route.
- IP and user rate limiting.
- Google Play Developer API subscription lookup.
- Expected package name validation.
- Test purchase rejection in production-like environment.
- Cross-user original transaction/order ownership check.

Gaps:

- Purchase token is not unique in the database schema.
- No app/account token or obfuscated account ID is used for stronger account binding.
- Applying a Play purchase to a user with previous Stripe fields leaves stale Stripe identifiers.

### RTDN/webhook

Evidence:

- `apps/web/src/app/api/webhooks/playstore/route.ts`
- `apps/web/src/lib/iap-google.ts`

Strengths:

- Pub/Sub envelope parsing.
- OIDC verification support.
- Production-like enforcement that an RTDN audience exists.
- Expected service account email/subject support.
- Package-name validation.
- Idempotency via processed webhook event storage.
- Voided purchase handling.

Gaps:

- RTDN can only update already-linked purchases. Unowned notifications are acknowledged and not queued.
- Voided purchases map to canceled state rather than preserving refund/revoke semantics.
- Manual Pub/Sub, OIDC, service account, Play Console product, and base-plan configuration must be verified outside source.

### Product IDs

Runtime config names exist for Android monthly and yearly product IDs. Source cannot prove those IDs exist, are active, have base plans/offers, or match Play Console.

### Restore/acknowledge

Evidence:

- `apps/mobile/src/lib/iap.ts`
- `apps/web/src/lib/iap-common.ts`

Restore purchases exists and calls backend verification for available purchases.

Android acknowledgement is attempted server-side after active verification, but failure does not block entitlement. This can grant access for a purchase that later auto-refunds because acknowledgement failed. A retry queue or pending entitlement state is needed.

### Android gaps

Android is not ready for production mobile subscription purchases until:

- Subscription offer token handling is implemented and tested.
- Play Console product/base plan/offer setup is manually verified.
- Acknowledgement failures are handled with fail-closed or durable retry semantics.
- RTDN configuration is validated in production-like environment.
- Mobile IAP reconciliation cron exists.
- Cross-source entitlement conflicts are resolved.

## 5. iOS Apple IAP / StoreKit Audit

### Client implementation

Evidence:

- `apps/mobile/package.json`
- `apps/mobile/app.json`
- `apps/mobile/src/lib/iap.ts`
- `apps/mobile/app/settings/subscription.tsx`

The iOS client uses native IAP through `expo-iap`, sends signed transaction JWS to the backend, verifies before finishing, and exposes restore purchases when IAP is available.

Gaps:

- App Store Connect products, subscription group, introductory offers/trials, family sharing, and sandbox tester setup are not source-verifiable.
- No store-level app account token is passed during purchase.
- The Expo config does not list an explicit IAP plugin entry. This may be acceptable depending on the Expo package and build, but it requires manual EAS/App Store validation.
- Some mobile copy still references secure browser checkout.

### Backend verification

Evidence:

- `apps/web/src/app/api/mobile/iap/verify/route.ts`
- `apps/web/src/lib/iap-apple.ts`
- `apps/web/src/lib/iap-common.ts`

Strengths:

- Authenticated verification route.
- Signed transaction JWS verification.
- Apple certificate chain validation.
- Bundle ID validation.
- App Store Server API refresh.
- Transaction ID mismatch rejection.
- Cross-user original transaction ownership check.

Gaps:

- Store purchase application leaves stale Stripe fields on the same subscription row.
- Refund/revoke information is normalized to canceled in key paths rather than preserving refund/revocation state.
- No scheduled App Store subscription revalidation cron was found.

### App Store notifications

Evidence:

- `apps/web/src/app/api/webhooks/appstore/route.ts`

Strengths:

- Signed notification verification.
- Inner transaction and renewal JWS verification.
- Idempotency by notification UUID.
- Stale notification guard.
- TEST notification handling.
- Refresh through App Store Server API before applying state.

Gaps:

- Unowned notifications are acknowledged and not queued for later correlation.
- Some logging includes full original transaction identifiers; logging should be further redacted.
- Refund/revoke states should be preserved distinctly.

### Product IDs

Runtime config names exist for iOS monthly and yearly product IDs. Source cannot prove App Store Connect products exist, are active, are in the correct subscription group, have correct pricing, or are submitted with the app version.

### Restore purchases

Restore purchase UI and client logic exist. Restore depends on backend verification and current store credentials.

### iOS gaps

iOS is not ready for production mobile subscription purchases until:

- App Store Connect products and subscription group are manually verified.
- Sandbox purchase, restore, renewal, expiration, refund, and revoke flows pass.
- External Stripe portal exposure is removed from iOS.
- Reconciliation and source-conflict fixes are implemented.
- App review metadata, test credentials, and subscription disclosures are prepared.

## 6. Stripe Web Billing Audit

### Checkout

Evidence:

- `apps/web/src/app/api/stripe/checkout/route.ts`
- `apps/web/src/lib/billing.ts`
- `apps/web/src/lib/billing-config.ts`

Strengths:

- Authenticated user binding.
- Rate limiting.
- Plan/campaign validation.
- Terms acceptance validation.
- Stripe customer metadata and subscription metadata include user binding.
- Local state is `PENDING_CHECKOUT`, not active.
- Success and cancel URLs are application-relative paths.
- Idempotency keys are used for customer/session creation.
- Production-like environment key validation exists for checkout.

Gaps:

- No explicit server-side mobile-platform rejection on checkout.
- Existing store-managed subscription does not appear to block Stripe checkout, creating duplicate billing/source-conflict risk.

### Portal

Evidence:

- `apps/web/src/app/api/stripe/portal/route.ts`
- `apps/mobile/app/settings/subscription.tsx`

Strengths:

- Authenticated portal creation.
- Requires Stripe customer ID.
- Uses Stripe Billing Portal rather than custom card-management code.

Gaps:

- Mobile subscription screen can open Stripe portal for Stripe-managed users on iOS/Android.
- Portal route has no explicit mobile-platform guard.
- Portal access from mobile may be viewed as steering to external subscription management/payment changes for digital features.

### Webhook

Evidence:

- `apps/web/src/app/api/webhooks/stripe/route.ts`

Strengths:

- Raw body signature verification.
- Webhook secret required.
- Stripe event construction through Stripe SDK.
- Livemode/test-mode mismatch checks.
- Stale event guard.
- Idempotency through processed event table.
- Handles checkout completed, subscription created/updated/deleted, invoice paid/succeeded/failed/action required, trial ending, and charge refunded.
- Entitlement changes are webhook-backed, not client-success-backed.

Gaps:

- Processed event IDs are globally keyed. A source-scoped unique key would be cleaner.
- Some handler side effects occur before processed-event insertion. Retried partial failures should be audited transaction-by-transaction.

### Entitlement

Stripe status is normalized into the shared subscription row. Active-like states grant entitlement if dates have not expired. Refunds set `REFUNDED` for Stripe.

### Mobile policy conflict risk

Stripe web billing is appropriate for web. The risk is not Stripe itself; the risk is mobile visibility or access to external checkout/portal for digital subscription changes. Harden mobile UI and server routes so Stripe remains web-only.

## 7. Entitlement Matrix

| Purchase source | Access target | Allowed | Technically supported today | Policy risk | Backend entitlement behavior | UI needed |
| --- | --- | --- | --- | --- | --- | --- |
| Web Stripe | Web | Yes | Yes | Low | Stripe webhook grants unified entitlement. | Normal web checkout and portal. |
| Web Stripe | Android | Yes for existing paid account access | Yes, with caveats | Medium if mobile links to Stripe | Same subscription row grants Android access. | No external checkout/portal in Android; login/access only. |
| Web Stripe | iOS | Yes for existing paid account access | Yes, with caveats | Medium/high if mobile links to Stripe | Same subscription row grants iOS access. | No external checkout/portal in iOS; login/access only. |
| Android Play Billing | Android | Yes, required for mobile digital purchases | Partial, not production ready | Low after complete; high if broken | Verified Play purchase grants unified entitlement. | Native Play purchase, restore, manage via Play. |
| Android Play Billing | Web | Yes | Partial | Low | Same subscription row should grant web access. | Web should show store-managed subscription and Play management guidance. |
| Android Play Billing | iOS | Yes for account access | Partial | Low/medium | Same subscription row should grant iOS access. | iOS should not manage Play billing except explain source; new iOS purchases use IAP. |
| iOS Apple IAP | iOS | Yes, required for mobile digital purchases | Partial, not production ready | Low after complete; high if broken | Verified Apple purchase grants unified entitlement. | Native IAP purchase, restore, manage via App Store. |
| iOS Apple IAP | Web | Yes | Partial | Low | Same subscription row should grant web access. | Web should show App Store managed subscription. |
| iOS Apple IAP | Android | Yes for account access | Partial | Low/medium | Same subscription row should grant Android access. | Android should not manage Apple billing except explain source; new Android purchases use Play. |

Key caveat: the unified row grants cross-platform access, but source conflicts and stale provider identifiers must be fixed before relying on cross-platform billing at scale.

## 8. Store Review Readiness

### Play Console checklist

Source-verifiable:

- Android package name: `com.locateflow.mobile`.
- Native Gradle application ID: `com.locateflow.mobile`.
- Billing permission exists in Android manifest.
- Mobile app can show native purchase UI when product IDs are configured.
- Backend Play verification and RTDN route exist.

Needs manual verification:

- Play Console app package matches `com.locateflow.mobile`.
- Subscription products exist and are active.
- Base plans and offers exist for monthly/yearly subscriptions.
- Product IDs match runtime config.
- RTDN Pub/Sub topic is configured.
- OIDC audience and expected service account settings are configured.
- License testers/test cards work.
- Play Data Safety answers match actual data collection.
- Review notes and test account are provided.
- No broken subscription UI is visible if products are not active.

### App Store Connect checklist

Source-verifiable:

- iOS bundle ID: `com.locateflow.mobile`.
- Mobile client attempts StoreKit/IAP purchase rather than Stripe checkout when product IDs are available.
- Backend App Store transaction verification and notification route exist.

Needs manual verification:

- Bundle ID matches App Store Connect.
- In-app purchase products exist and are active.
- Monthly/yearly products are in the correct subscription group.
- Product IDs match runtime config.
- First IAP is submitted with the app version if required.
- Sandbox testers are configured.
- App review notes include login and purchase/restore instructions.
- Subscription disclosures display price, period, renewal, cancellation, and trial terms.
- App Privacy nutrition labels match actual data collection.

### Test credentials

No source-verifiable app review test credentials were found. Because LocateFlow requires account flows, review credentials and sandbox purchase notes should be prepared manually.

### Privacy/data safety

Public privacy-related pages exist in web source, but store-specific App Privacy and Play Data Safety declarations are not source-verifiable. They must be manually aligned with:

- Account identifiers and contact data.
- Addresses/moving data.
- Uploaded documents.
- Analytics/error tracking if enabled.
- Push notifications.
- Payment processor data handled by Stripe, Apple, or Google.

### Subscription disclosures

Mobile purchase alert copy includes subscription disclosure concepts. Review should confirm all active store products display localized price, period, renewal behavior, trial/introductory terms if any, and cancellation instructions from the store product metadata.

## 9. Security Findings

### Purchase spoofing

Positive:

- Client success alone does not grant IAP entitlement.
- iOS sends signed transaction JWS for backend verification.
- Android sends purchase token for Google API verification.
- Stripe checkout success URL does not grant active entitlement.

Risks:

- Mobile could technically call Stripe checkout/portal endpoints unless server-side platform guards are added.
- Android client-supplied `productId` is accepted in the request schema, though entitlement is ultimately based on Google API product data.

### Webhook spoofing

Positive:

- Stripe signature verification exists.
- App Store JWS verification exists.
- Play RTDN OIDC verification exists and is required in production-like environments when configured.

Risks:

- Manual production OIDC/audience/service account configuration must be verified.
- Event storage should ideally use source-scoped uniqueness.

### Replay

Positive:

- Stripe webhook idempotency exists.
- App Store notification UUID idempotency exists.
- Play message ID idempotency exists.
- Stale event guards exist.

Risks:

- Purchase token uniqueness is not enforced at the DB level.
- Store purchase/source conflicts can reapply old provider state.

### Cross-account purchase

Positive:

- Apple original transaction ID ownership check exists.
- Google normalized original transaction/order ownership check exists.

Risks:

- Google purchase token is not unique.
- No app account token/obfuscated external account ID is passed during purchase.
- Restore purchase cross-account behavior needs explicit tests.

### Refunds/revocations

Positive:

- Stripe refund maps to `REFUNDED`.
- Apple/Play refund/revoke/void paths exist.

Risks:

- Apple and Play refund/revoke are generally flattened to `CANCELED`, losing normalized refund/revocation semantics and support/accounting visibility.

### Logging/secrets

No secret values were printed during this audit. Some App Store unowned notification logging includes full original transaction identifiers; redact or hash long-lived purchase identifiers in logs.

## 10. Implementation Plan

### Phase 0: policy-safe launch without mobile purchases

- Disable or hide mobile subscription purchase CTAs until store products are live and tested.
- Remove mobile Stripe checkout/portal exposure.
- Allow login/access for existing paid web accounts without steering users to web purchase.
- Keep web Stripe checkout and portal on web only.
- Add policy UI tests proving iOS/Android do not expose external digital subscription checkout links.

### Phase 1: Google Play Billing

- Implement Android subscription offer token/base plan selection.
- Confirm product IDs, base plans, offers, pricing, and testers in Play Console.
- Pass obfuscated account/profile identifiers where supported.
- Make acknowledgement failure fail closed or persist durable retry with pending entitlement.
- Validate pending, active, grace, hold, canceled, expired, refunded, and restored states.

### Phase 2: Apple IAP

- Confirm App Store Connect products, subscription group, pricing, and sandbox testers.
- Pass App Store account token where supported.
- Validate purchase, restore, renewal, grace, billing retry, expiration, refund, and revoke.
- Preserve refund/revoke state distinctly.
- Remove external billing language from iOS copy.

### Phase 3: unified entitlement/reconciliation

- Replace one mutable provider row with a subscription ledger plus derived entitlement, or add explicit provider-source priority and source cleanup.
- Clear or archive stale provider IDs when switching billing source.
- Block duplicate active subscriptions across Stripe/App Store/Play unless intentionally supported.
- Add scheduled mobile IAP reconciliation for Apple and Google.
- Queue unowned store notifications for later correlation.

### Phase 4: store review polish

- Prepare App Review and Play review notes.
- Provide test credentials and sandbox purchase instructions.
- Verify privacy policy, data safety, and privacy labels.
- Ensure subscription terms are localized and visible.
- Ensure no unfinished or broken paywall is visible if IAP is disabled.

### Phase 5: monitoring/refunds/support

- Add dashboards for provider drift, stale validation, webhook failures, ack retries, and refund/revoke events.
- Add support tools to identify billing source and management destination.
- Redact purchase tokens and transaction IDs in logs.
- Document refund, revoke, cancel, and account deletion support playbooks.

## 11. Tests Needed

High-priority tests:

- Android purchase request includes subscription offer token/base plan offer data.
- Android verification rejects wrong package, unknown product, test purchase in production, replayed token, and cross-account restore.
- Android acknowledgement failure does not silently grant durable paid access without retry.
- iOS verification rejects invalid JWS, wrong bundle ID, transaction ID mismatch, replayed transaction, revoked/refunded purchase, and cross-account restore.
- App Store Server Notification refund/revoke maps to normalized refund/revoke state.
- Play RTDN voided purchase maps to normalized refund/revoke state.
- Stripe checkout cannot be called by iOS/Android mobile clients.
- Stripe portal cannot be opened from iOS/Android mobile clients.
- Store purchase application clears or isolates stale Stripe identifiers.
- Stripe webhook cannot overwrite current store-managed entitlement unexpectedly.
- Web-purchased users can access mobile without mobile external checkout CTAs.
- Store-purchased users can access web without duplicate Stripe subscription prompts.
- Mobile UI tests prove iOS/Android show platform-native purchase/restore/manage paths only.
- Reconciliation jobs refresh stale App Store/Play subscriptions and handle missed webhooks.

## 12. Final Recommendation

Do not enable production mobile purchases yet.

Submit the current app only as a free/login/no-mobile-purchase app if mobile subscription purchase UI, external Stripe portal links, and upgrade CTAs are hidden or disabled for store builds. Existing paid users may log in and access their account, but the app should not direct them to web Stripe checkout or Stripe subscription management.

Hide or disable mobile subscription UI until Apple IAP and Google Play Billing are complete, store products are live/tested, review metadata is prepared, and policy UI tests pass.

Keep Stripe web billing web-only. Add server-side and UI guardrails so iOS and Android builds cannot initiate Stripe checkout or portal flows for digital subscriptions.

Before enabling mobile purchase:

- Fix Android Play Billing subscription offer token handling.
- Verify App Store Connect and Play Console product configuration manually.
- Add robust acknowledgement, refund/revoke, restore, reconciliation, and cross-account tests.
- Resolve unified entitlement source conflicts between Stripe, App Store, and Play Store.
- Remove mobile external checkout/portal risk.
- Prepare store review notes, test credentials, sandbox testers, privacy labels, and data safety declarations.
