# Adversarial Verification: mobile-iap-purchase-01

**Finding under review:** IAP purchase not bound to the initiating account (`appAccountToken` / `obfuscatedExternalAccountId` unused)
**Original severity:** High · Category: Security
**Verdict:** CONFIRMED (the finding is real; my mandate was to refute it, but the code proves it)

## What the claim asserts
The store account-binding fields that Apple (`appAccountToken`) and Google
(`externalAccountIdentifiers.obfuscatedExternalAccountId`) provide to tie a
purchase to the in-app account are declared as types but never set by the
client and never validated by the server. Therefore a verified receipt is
claimed by the first authenticated account that submits it, not the account
that actually paid.

## Code I read (evidence)

1. **Type declarations exist, nothing else.**
   - `apps/web/src/lib/iap-apple.ts:137` — `appAccountToken?: string;` on `AppleTransactionPayload`.
   - `apps/web/src/lib/iap-google.ts:230` — `externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };` on `GoogleSubscriptionV2Response`.
   - A repo-wide grep for `appAccountToken|obfuscatedExternalAccountId|externalAccountIdentifiers` returns matches ONLY at those two type lines plus audit `.md` docs — no read in any route, lib, or webhook.

2. **Server verify binds to the session user, never to a store account id.**
   - `apps/web/src/app/api/mobile/iap/verify/route.ts:55` resolves `userId = await requireDbUserId()` and at line 139 calls `applyIapStateToUser({ userId, state: normalized })`. The Apple JWS is cryptographically verified (line 92) and the Google token re-fetched (line 128), but `appAccountToken` / `obfuscatedExternalAccountId` are never extracted or compared to `userId`.

3. **`applyIapStateToUser` grants to whoever calls.**
   - `apps/web/src/lib/iap-common.ts:574-598`. The grant key is the caller's `userId`. The only cross-account protection is a uniqueness guard: lines 583-591 (`existingByTxn ... existingByTxn.userId !== userId → IAP_TXN_OWNED_BY_ANOTHER_USER`) and 592-598 (same for the purchase-token hash). This guard fires ONLY AFTER some row already owns the receipt — i.e. it is a first-claim lock, not buyer verification. The upsert at line 669 writes the row under `where: { userId }`.

4. **Mobile client never sets the binding token at purchase.**
   - `apps/mobile/src/lib/iap-offers.ts:104-129` `buildSubscriptionPurchaseRequest` produces `{ request: { ios: { sku } } }` / `{ request: { android: { skus, subscriptionOffers } } }` — no `appAccountToken` (StoreKit2) and no `obfuscatedAccountId` (Play). This is the exact object passed to `IAP.requestPurchase` at `apps/mobile/src/lib/iap.ts:291`.
   - `apps/mobile/src/lib/iap.ts:147-165` `buildVerifyBodyForPurchase` sends only `{ platform, signedTransaction, transactionId? }` (iOS) or `{ platform, purchaseToken, productId }` (Android) — no account identifier travels to the server.

5. **Restore / reconcile widen the exposure.**
   - `apps/mobile/src/lib/iap.ts:354` (`restorePurchases`) and `:421` (`buildReconcileVerifyBody`) both reuse `buildVerifyBodyForPurchase` and POST every owned/available transaction to `/api/mobile/iap/verify`. Any owned receipt can therefore be submitted by a different signed-in account and is bound to that account on a first-come basis.

## Why CONFIRMED rather than refuted
I looked specifically for the false-positive patterns I was warned about:
- A binding check done elsewhere (middleware/wrapper) — none exists; grep shows zero reads of the fields outside type defs.
- Validation in the webhook path — the verify route and `applyIapStateToUser` (the shared write path used by webhooks too) contain no account-id comparison.
- The uniqueness guard being mistaken for buyer verification — it is real but only prevents a *second* account from stealing an *already-claimed* receipt; it does not establish that the *first* claimant is the buyer.

The mechanism the original finding describes is exactly what the code does. The
store layer offers a buyer-identity field on both platforms; the app neither
sets nor checks it.

## Severity assessment
High is appropriate. Realistic exploitation requires possession of a valid,
unclaimed store receipt/token (e.g. a shared device, a leaked StoreKit JWS, or a
TestFlight/sandbox transaction — though sandbox is separately gated by
`assertAppleSandboxPurchaseAllowedForUser` at iap-common.ts:547). The abuse is
mis-attribution / buyer lockout rather than free arbitrary premium, which keeps
it at High rather than Critical. No severity change.

## Recommendation (high level)
- Client: set `appAccountToken` (StoreKit2) and `obfuscatedAccountId` (Play) to the authenticated user id at `requestPurchase`.
- Server: in `/api/mobile/iap/verify` (and the shared `applyIapStateToUser`), read the store-returned `appAccountToken` / `obfuscatedExternalAccountId` and reject when present-and-mismatched against the session user; alert when absent.
- Add tests asserting verify rejects a JWS / Google response whose account id != session user.

## Related files
- `apps/web/src/lib/iap-apple.ts:137`
- `apps/web/src/lib/iap-google.ts:230`
- `apps/web/src/app/api/mobile/iap/verify/route.ts:55,139`
- `apps/web/src/lib/iap-common.ts:574-598,669`
- `apps/mobile/src/lib/iap-offers.ts:104-129`
- `apps/mobile/src/lib/iap.ts:147-165,291,354,421`
