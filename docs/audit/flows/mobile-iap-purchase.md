# Flow Audit: Mobile IAP Purchase

Area slug: `mobile-iap-purchase`
Scope: Mobile paywall -> native IAP purchase -> server receipt validation (Apple/Google) -> entitlement sync -> external-billing guard.
Method: READ-ONLY source review. Evidence cites source files at repo-root-relative paths.

---

## 1. Flow Summary & actors

Actors:
- Mobile user (authenticated; custom-JWT session forwarded by the mobile `api` client).
- Native store (StoreKit2 on iOS / Play Billing on Android) via `expo-iap`.
- Web backend (`apps/web/src/app/api/mobile/iap/*`, `apps/web/src/lib/iap-*`).
- Apple App Store Server API v2 / Google Play Developer API v3 (server-to-server receipt verification).
- Store webhooks (`/api/webhooks/appstore`, `/api/webhooks/playstore`) for asynchronous lifecycle.
- DB: single per-user `Subscription` row (`@unique` on `userId` and `originalTransactionId`).

High-level: the mobile paywall loads product-id mapping from `GET /api/mobile/iap/products`, fetches localized prices from the native store, runs a native purchase, then POSTs the store proof to `POST /api/mobile/iap/verify`. The server cryptographically/`server-API` verifies the receipt, normalizes it, and writes the `Subscription` row keyed by the user. Web Stripe billing endpoints reject mobile clients via `mobile-external-billing-guard`.

---

## 2. Step-by-step trace

### Step 1 — Paywall load
- Trigger: navigate to `apps/mobile/app/settings/subscription.tsx`.
- State: `fetchSubscription()` -> `GET /api/profile` (entitlement + subscription); `fetchIapProducts()` -> `GET /api/mobile/iap/products`; `fetchPublicOffers()` -> `GET /api/acquisition/public-trial-campaign`.
- `GET /api/mobile/iap/products` (`apps/web/src/app/api/mobile/iap/products/route.ts`) reads `MOBILE_{IOS,ANDROID}_PRODUCT_*` runtime-config keys and returns a public plan->SKU map. No auth (product IDs are public; acceptable).
- Native price load: `fetchSubscriptionProducts(skus)` (`apps/mobile/src/lib/iap.ts:97`) over `expo-iap`.

### Step 2 — Disclosure + native purchase
- Trigger: `handleUpgrade(planKey, cycle)` (`subscription.tsx:646`). Gates on `canStartNativePurchase` (blocks managed-elsewhere + inherited members), shows a campaign disclosure `Alert`, then calls `purchaseSubscription({ productId, offerToken })` (`apps/mobile/src/lib/iap.ts:184`).
- `purchaseSubscription` registers a single-fire purchase listener, calls `IAP.requestPurchase(...)`, and on the resulting transaction builds the verify body (`buildVerifyBodyForPurchase`, `iap.ts:147`) and POSTs to `/api/mobile/iap/verify`. `finishTransaction` is called ONLY after the server confirms (`iap.ts:254`) — correct ordering (no ack before entitlement).

### Step 3 — Server receipt verification
- File: `apps/web/src/app/api/mobile/iap/verify/route.ts`.
- Auth: `requireDbUserId()` (`route.ts:55`). Throws `UNAUTHORIZED` -> 401.
- Rate limit: 30/min per IP + 10/min per user (`route.ts:56-67`), `failClosed: "if-redis-configured"`.
- Body: zod discriminated union on `platform` (`route.ts:33-45`).
- iOS: locally verify client JWS via `verifyAppleJws` (`iap-apple.ts:174`) — full x5c chain to AppleRootCA-G3 + Apple leaf/intermediate OID enforcement + cert time-bounds + ES256 signature. Then `refreshAppleSubscriptionFor(originalTransactionId)` calls the App Store Server API; falls back to the locally-verified signed transaction (`normalizeAppleTransactionPayload`) on server-lookup failure.
- Android: `refreshGoogleSubscriptionFor(purchaseToken)` calls Google Play Developer API; checks `normalized.productId === body.productId` (`route.ts:132`).
- DB write: `applyIapStateToUser` (`iap-common.ts:574`).
- Response: `buildUnifiedEntitlementSnapshot(subscription)` + subscription summary.

### Step 4 — Entitlement persistence (`applyIapStateToUser`, `iap-common.ts:574`)
- Cross-account guard: refuses if `originalTransactionId` (`:583`) or purchase-token hash/plaintext (`:592`) is owned by another `userId` -> `IAP_TXN_OWNED_BY_ANOTHER_USER` (409).
- Provider conflict: if the user already has an active managed sub from a DIFFERENT provider -> `ACTIVE_SUBSCRIPTION_MANAGED_ELSEWHERE` (409).
- Sandbox/test gates: `assertAppleSandboxPurchaseAllowedForUser` / `assertGooglePlayTestPurchaseAllowedForUser` (`:547`, `:514`) restrict sandbox/test receipts to allowlisted emails in production-like billing.
- Upsert keyed on `userId`; clears Stripe + admin-grant fields; stores `purchaseTokenEncrypted` + `purchaseTokenHash` (encrypted at rest); P2002 on the unique keys -> ownership error.
- Side effects: `reconcileSeatsForOwner(userId)` (best-effort), lifecycle emails + admin purchase alert via `sendIapLifecycleEmail` (deduped).

### Step 5 — External-billing guard
- `isMobileAppClient(request)` checks header `x-client-type: mobile` (`mobile-external-billing-guard.ts:6`). Used by `/api/stripe/checkout`, `/api/stripe/portal`, `/api/subscription/change-plan`, `/api/subscription/switch-cycle` to 403 mobile clients away from web/Stripe billing.

### Step 6 — Async lifecycle (webhooks)
- `/api/webhooks/appstore`: verifies Apple JWS, bundle id, 72h replay window, DB idempotency via `reserveWebhookEvent(notificationUUID)`, resolves owner via `findUserByIapIdentifier`, refreshes + `applyIapStateToUser`.
- `/api/webhooks/playstore`: OIDC Pub/Sub verification, idempotency, owner lookup, refresh + apply.

---

## 3. Happy-path correctness

The happy path is sound and notably careful:
- Server is the single source of truth; client receipt is never trusted for entitlement beyond cryptographic proof.
- `finishTransaction` is gated on server success (`iap.ts:254`) — a verify failure leaves the store transaction unfinished for retry.
- A cold-start `reconcilePendingPurchases` (`iap.ts:430`) settles charged-but-unverified transactions and only finishes them after a successful verify.
- Apple JWS verification is thorough (chain + Apple-specific OIDs + time-bounds + signature), closing the "any Apple-rooted leaf forges a transaction" hole.
- Product-id -> plan mapping is anchored to server-only runtime-config keys (`mapProductIdToPlan`, `iap-common.ts:315`); an attacker cannot smuggle an arbitrary SKU.
- Cross-account receipt sharing is blocked on both `originalTransactionId` and purchase-token identifiers, with a DB unique constraint backstop.

---

## 4. Edge cases & reverse-logic

- Auth/role: `requireDbUserId` enforced on verify. Products endpoint is intentionally public. OK.
- Empty/invalid input: zod schema bounds lengths; bad body -> 400 `INVALID_BODY`.
- iOS `transactionId` mismatch: if client sends `transactionId` that disagrees with the JWS payload -> 400 (`route.ts:100`). Good.
- Network failure to store API: Apple lookup failure falls back to locally-verified JWS; Google timeout/5xx mapped to 424 `IAP_PROVIDER_UNAVAILABLE` so the client keeps the transaction for retry.
- Double-submit/idempotency (verify): the verify endpoint itself is idempotent at the DB layer because the upsert is keyed on `userId` and `originalTransactionId` is unique — re-verifying the same receipt just rewrites the same row. Webhooks use `reserveWebhookEvent`. OK.
- Token expiry: bearer/token caches refresh before expiry (`iap-apple.ts`, `iap-google.ts`).
- Partial failure: emails + `reconcileSeatsForOwner` are best-effort (`.catch`), so a notification failure does not roll back the entitlement (intended).
- Race conditions: see Finding `mobile-iap-purchase-04` — the cross-account ownership check is a read-then-write that is NOT inside a transaction; the DB unique constraints are the real backstop (and they are present), so the race collapses to a P2002 handled as an ownership error. Net: safe, but the pre-checks are advisory not authoritative.
- Direct deep-link entry: verify requires a session regardless of how the screen was reached.
- Apple FREE_TRIAL / clock-skew / refunded handling in `normalizeAppleResult` is defensive (downgrades stale ACTIVE to EXPIRED, etc.).

---

## 5. Security review of the flow

Authz at each step: products (public, OK), verify (`requireDbUserId`, OK), Stripe endpoints (mobile guard + `requireDbUserId`), webhooks (cryptographic provider auth). No raw workspace IDs are accepted from the client in this flow; the subscription is per-user.

Key issues (detailed in findings):
- `mobile-iap-purchase-01` (High): Apple `appAccountToken` and Google `obfuscatedExternalAccountId` are captured in the type definitions but never compared against the authenticated user. The purchase is bound to whoever is logged in at verify time, not to the account that initiated the StoreKit/Play purchase. Combined with the absence of an `inAppOwnershipType` check (`mobile-iap-purchase-02`), a Family-Sharing recipient or a receipt obtained out-of-band can be claimed by a different authenticated account on a first-come basis.
- `mobile-iap-purchase-02` (Medium): `inAppOwnershipType` is parsed (`iap-apple.ts:124`) but never enforced; a `FAMILY_SHARED` transaction is treated identically to `PURCHASED`, granting a full independent paid entitlement to a Family-Sharing member.
- `mobile-iap-purchase-03` (Medium): the iOS JWS-fallback path (`normalizeAppleTransactionPayload`) trusts the client-supplied signed transaction's `expiresDate`/status when the App Store Server API is unreachable. The JWS is cryptographically genuine, but a transaction replayed long after expiry would be normalized using only the embedded fields (it does downgrade to EXPIRED when `expiresDate < now`, mitigating the worst case) — there is no freshness/`signedDate` bound on this fallback like the webhook's 72h check.
- `mobile-iap-purchase-05` (Low): Google `linkedPurchaseToken` (upgrade/downgrade/re-subscribe chain) is captured in the type but not used to supersede the prior token, so a stale prior `Subscription` row keyed to an old token can linger after an in-store plan change until a webhook/refresh overwrites it.
- Validation/secrets/PII: purchase tokens are encrypted at rest (`encryptPurchaseTokenForStorage`) with a hash index; private keys come from runtime-config; no secret logging observed. Good.
- Rate limiting: present on verify (IP + per-user). Good.

### Reverse-logic spot checks
- `IAP_PURCHASE_BLOCKING_STATUSES` / `IAP_MANAGED_PROVIDERS` logic in `applyIapStateToUser` only blocks a cross-provider takeover when the existing provider differs (`existingProvider !== state.provider`). A same-provider re-purchase is allowed to overwrite — correct for renewals/plan changes.
- `autoRenew: !IAP_CANCELED_STATUSES.has(state.status)` and `cancelAtPeriodEnd` derivation look consistent with the status set.

---

## 6. Reliability

- Retry: verify maps store-unavailable to 424 so the client retries; `reconcilePendingPurchases` is a robust cold-start settle-up; webhook reservations are released on failure for redelivery.
- Transaction consistency: see Finding `mobile-iap-purchase-04` — ownership pre-checks + upsert are not wrapped in a single DB transaction. Backstopped by unique constraints.
- Partial-failure recovery: lifecycle email / seat reconcile failures are swallowed and logged; entitlement still persists.
- Loading/empty/error UX: the screen has explicit loading, load-error retry card, managed-elsewhere notices, and per-cycle disabled/processing states. Good.
- Finding `mobile-iap-purchase-06` (Low): the active in-purchase listener has a 120s timeout that resolves `IAP_PURCHASE_FAILED`; if the user was charged but verify hadn't completed, recovery depends on `reconcilePendingPurchases`/manual restore. This is handled but worth a regression test.

---

## 7. Cross-module impact

- Billing/entitlement: writes the shared per-user `Subscription` row consumed by `buildUnifiedEntitlementSnapshot` and the web subscription UI.
- Workspaces: `reconcileSeatsForOwner` demotes over-limit members on plan change.
- Email: activation/cancellation/payment-failed lifecycle emails + admin purchase alert.
- Web Stripe billing: `mobile-external-billing-guard` keeps mobile clients on IAP (Apple/Play policy compliance).
- Webhooks: appstore/playstore lifecycle reuse `applyIapStateToUser`, so any entitlement-mapping fix benefits both sync and async paths.

---

## 8. Findings Summary

| ID | Severity | Category | Finding | Impact | Recommendation | Files |
|----|----------|----------|---------|--------|----------------|-------|
| mobile-iap-purchase-01 | High | Security | Purchase not bound to the account that initiated it; `appAccountToken`/`obfuscatedExternalAccountId` parsed but unused | First authenticated user to verify a given receipt claims it; enables receipt-claim abuse / mis-attribution | Set `appAccountToken`/`obfuscatedExternalAccountId` to the userId at purchase request time and assert it equals the authenticated userId in verify | `apps/web/src/lib/iap-apple.ts:137`, `apps/web/src/lib/iap-google.ts:230`, `apps/web/src/app/api/mobile/iap/verify/route.ts`, `apps/mobile/src/lib/iap.ts:184` |
| mobile-iap-purchase-02 | Medium | Logic | `inAppOwnershipType` never enforced; `FAMILY_SHARED` granted full entitlement | A Family-Sharing recipient gets an independent paid entitlement they did not buy | Reject or down-scope `inAppOwnershipType !== "PURCHASED"` in `normalizeAppleResult`/`normalizeAppleTransactionPayload` | `apps/web/src/lib/iap-apple.ts:124`, `apps/web/src/lib/iap-common.ts:348` |
| mobile-iap-purchase-03 | Medium | Reliability | iOS JWS-fallback trusts client signed transaction with no freshness bound when App Store API is down | A genuine-but-stale signed transaction can drive entitlement state during an Apple outage | Add a `signedDate` freshness window (mirror the 72h webhook check) and prefer server-API state; mark fallback rows for re-validation | `apps/web/src/app/api/mobile/iap/verify/route.ts:110-123`, `apps/web/src/lib/iap-common.ts:410` |
| mobile-iap-purchase-04 | Low | Reliability | Ownership pre-checks + upsert not in one DB transaction (read-then-write) | Concurrent verifies rely on unique-constraint backstop rather than the explicit guard | Wrap the ownership check + upsert in an interactive transaction, or document the constraint as the authoritative guard | `apps/web/src/lib/iap-common.ts:583-685` |
| mobile-iap-purchase-05 | Low | Logic | Google `linkedPurchaseToken` not used to supersede prior token row | Stale subscription row may persist after an in-store upgrade/downgrade until a later refresh | On Google verify, look up + reconcile the `linkedPurchaseToken` predecessor row | `apps/web/src/lib/iap-google.ts:225`, `apps/web/src/lib/iap-common.ts:453` |
| mobile-iap-purchase-06 | Low | Reliability | 120s in-purchase timeout charges-without-entitlement recovery depends on reconcile/restore | Edge timeout can leave a charged user temporarily without access until next reconcile | Add a regression test asserting `reconcilePendingPurchases` recovers a timed-out purchase; surface a clearer retry CTA | `apps/mobile/src/lib/iap.ts:202`, `apps/mobile/src/lib/iap.ts:430` |
| mobile-iap-purchase-07 | Info | Security | iOS verify body packs the JWS into a field also named `purchaseToken` on the client side | Field-name overloading (`getIosSignedTransaction` reads `purchase.purchaseToken` first) is fragile but currently correct | Prefer explicit `jwsRepresentation*` fields; keep `purchaseToken` last in the fallback chain | `apps/mobile/src/lib/iap.ts:133` |

---

## 9. Flow TODO

1. [High] Bind purchases to the initiating account via `appAccountToken` (Apple) and `obfuscatedAccountId` (Google) set at `requestPurchase` time, and assert equality in `/api/mobile/iap/verify` and both webhooks.
2. [Medium] Enforce `inAppOwnershipType === "PURCHASED"` (reject/down-scope Family-Sharing recipients) in Apple normalization.
3. [Medium] Add a freshness bound to the iOS local-JWS fallback and flag those rows for App Store Server API re-validation.
4. [Low] Use Google `linkedPurchaseToken` to supersede the predecessor subscription row on plan changes.
5. [Low] Wrap ownership-check + upsert in a single DB transaction (or document the unique-constraint backstop as authoritative).
6. [Low] Add regression tests for the charged-but-timed-out purchase recovery path.
