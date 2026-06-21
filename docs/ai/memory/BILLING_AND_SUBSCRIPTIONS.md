# Billing and Subscriptions

Updated: 2026-06-21

## Stripe Web Billing

- Checkout route requires authenticated user, non-mobile client context, rate limits, legal consent, runtime Stripe config, and duplicate active subscription checks.
- Checkout creates or reuses Stripe customer, uses idempotency, stores pending subscription state, and records consent snapshot.
- Portal route requires authenticated non-mobile user, rate limit, Stripe config, and Stripe customer mapping.
- Subscription actions support cancel trial, cancel renewal, and resume renewal for Stripe subscriptions only.
- Admin hard delete attempts Stripe cancel before irreversible DB erasure and blocks if cancel fails unless operator forces and accepts manual reconciliation.

## Stripe Webhooks

- Stripe webhook route uses Node runtime, raw body, body size cap, Stripe signature verification, livemode/environment mismatch checks, idempotency, and subscription state mapping.
- Webhook handlers include schema-compat fallbacks for rolling deploys.

## Mobile IAP

- Mobile production EAS profile sets:
  - `EXPO_PUBLIC_MOBILE_STORE_PURCHASES_ENABLED=true`
  - `EXPO_PUBLIC_MOBILE_IOS_STORE_PURCHASES_ENABLED=true`
  - `EXPO_PUBLIC_MOBILE_ANDROID_STORE_PURCHASES_ENABLED=true`
- Development/preview profiles keep mobile store purchases disabled.
- Mobile purchase flow:
  - initializes `expo-iap`;
  - fetches subscription products from native stores;
  - requests purchase;
  - posts signed transaction/purchase token to `/api/mobile/iap/verify`;
  - finishes the store transaction only after server verification succeeds.
- Restore and cold-start reconciliation re-send purchase evidence to backend.
- Backend iOS verify uses signed Apple transactions and server refresh.
- Backend Android verify uses purchase token and product ID match.
- New Google Play token writes store the reusable token in `Subscription.purchaseTokenEncrypted`, clear plaintext `Subscription.purchaseToken`, and retain `purchaseTokenHash` for ownership lookup/webhook matching. The legacy plaintext column remains only for old rows/rolling compatibility until a runtime revalidation or app-key migration clears it.
- Server handles store ownership conflicts and verification errors without granting entitlement.

## Entitlements

- Entitlement helpers live in `packages/shared`.
- Subscription model includes Stripe and mobile-store fields, plan/status/provider/platform, encrypted purchase-token storage, purchase-token hashes, App Store environment, grace/trial/current period, cancellation metadata, and versions.
- Workspace seat limits resolve from workspace owner subscription and reconcile after plan/ownership changes.

## Billing Config

- Runtime config definitions include Stripe secret/webhook/publishable keys and Stripe price IDs.
- Deployment env is authoritative by default; DB runtime config fallback/override is restricted.
- Stripe secrets and publishable keys have prefix and live/test environment validation.

## Verified Billing Risks

- Root production runtime startup has been changed in the staging audit branch to avoid running migrations before server start; verify the live platform run command keeps migrations as a separate step.
- Legacy Play Store rows may still have plaintext `purchaseToken` until they are revalidated or migrated with access to `FIELD_ENCRYPTION_KEY`.
- Subscription action rate limiting uses `failClosed: "if-redis-configured"`; if Redis is not configured, it degrades to process-local memory rather than denying all actions.
- Store-purchase production flags are enabled in EAS production, so App Store Connect / Play product setup and backend verifier config are release gates.

## Not Verified

- No Stripe dashboard, App Store Connect, Google Play Console, real webhook delivery, or live subscription objects were inspected.
- No billing tests were run.
