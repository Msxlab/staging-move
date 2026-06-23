# Module Audit: Mobile IAP Billing (Apple App Store / Google Play)

> READ-ONLY audit. Evidence cited from source. Paths are relative to repo root
> `C:/Users/Windows/Desktop/Staging/staging-move`. Items that could not be
> confirmed from code are marked **[needs verification]**.

## 1. Module Summary

Server-side In-App Purchase (IAP) verification and entitlement sync for the
Expo/React-Native mobile app. The mobile client drives StoreKit2 (iOS) / Play
Billing (Android) natively, then posts purchase proof to
`POST /api/mobile/iap/verify`. The server is the single source of truth:

- **iOS**: client sends a StoreKit2 `signedTransaction` (JWS). Server verifies
  the JWS locally against Apple's `AppleRootCA-G3` chain + Apple App Store OID
  enforcement (`apps/web/src/lib/iap-apple.ts`), then pivots to the App Store
  Server API (`getAppleSubscriptionStatus`) for authoritative status.
- **Android**: client sends a `purchaseToken` + `productId`. Server calls the
  Google Play Developer API `subscriptionsv2.get` (`apps/web/src/lib/iap-google.ts`).
- Verified state is normalized (`apps/web/src/lib/iap-common.ts`) and written to
  the single per-user `Subscription` row, keyed by a globally-unique
  `originalTransactionId` (Apple) / `purchaseTokenHash` (Google) to prevent
  receipt sharing across accounts.
- Store webhooks (`/api/webhooks/appstore`, `/api/webhooks/playstore`) keep the
  row in sync (renewals, refunds, cancellations) with DB-backed idempotency.
- A guard (`apps/web/src/lib/mobile-external-billing-guard.ts`) blocks the mobile
  client from hitting the web Stripe checkout/portal/plan-change routes (store
  policy compliance).

The implementation is mature and shows clear evidence of prior audit rounds
(comments reference "audit round-2 billing #5", "finding 2", etc.). Core
cryptographic verification is solid. The findings below are mostly gaps in
defense-in-depth (user↔receipt binding, ownership-type handling) and a few
edge-case/reliability concerns.

## 2. Related Files

| File | Role |
|------|------|
| `apps/web/src/lib/iap-apple.ts` | Apple JWS verification (x5c chain + OID), App Store Server API client, bearer-token mint/cache |
| `apps/web/src/lib/iap-google.ts` | Google Play Developer API client, SA/OAuth token mint, subscriptionsv2.get, acknowledge, Pub/Sub OIDC verify |
| `apps/web/src/lib/iap-common.ts` | Cross-store normalization, productId→plan map, `applyIapStateToUser`, ownership/sandbox guards, lifecycle emails |
| `apps/web/src/lib/mobile-external-billing-guard.ts` | `isMobileAppClient` + external-billing 403 response |
| `apps/web/src/lib/webhook-idempotency.ts` | reserve/release ProcessedWebhookEvent markers |
| `apps/web/src/lib/billing-config.ts` | `isBillingProductionLike`, `requireAppleEnvironmentForBilling` |
| `apps/web/src/lib/shared-encryption.ts` → `packages/shared/src/encryption.ts` | AES-256-GCM purchaseToken encryption |
| `apps/web/src/app/api/mobile/iap/verify/route.ts` | Verify endpoint (authenticated) |
| `apps/web/src/app/api/mobile/iap/products/route.ts` | Public product-ID map endpoint |
| `apps/web/src/app/api/webhooks/appstore/route.ts` | Apple Server Notifications v2 |
| `apps/web/src/app/api/webhooks/playstore/route.ts` | Google RTDN via Pub/Sub |
| `apps/mobile/src/lib/iap.ts` | expo-iap bridge: purchase, restore, reconcile |
| `apps/mobile/src/lib/iap-offers.ts` | product normalization, Android offer-token selection |
| `apps/mobile/src/lib/billing-flags.ts` | store-purchase enablement flags |
| `apps/mobile/app/settings/subscription.tsx` | Paywall / subscription management screen |

Note: scope mentioned `apps/web/src/lib/iap-status.ts` — **it does not exist**;
only `apps/web/src/lib/iap-status.test.ts` is present (it tests `mapAppleStatus`
/ `mapGoogleSubscriptionState` exported from the two store libs).

## 3. Related Routes / Screens

- Mobile screen: `apps/mobile/app/settings/subscription.tsx` (1694 lines;
  `LegacySubscriptionScreen` + a newer variant). Buttons: Upgrade (annual/monthly
  per plan), Manage billing, Restore purchases, Open web billing.
- API routes: `/api/mobile/iap/verify`, `/api/mobile/iap/products`,
  `/api/webhooks/appstore`, `/api/webhooks/playstore`.
- Web routes gated against mobile: `/api/stripe/checkout`, `/api/stripe/portal`,
  `/api/subscription/change-plan`, `/api/subscription/switch-cycle`.

## 4. Related APIs

External: Apple App Store Server API (`api.storekit.itunes.apple.com` +
sandbox), Apple `appstoreconnect-v1` token audience; Google Play Developer API
(`androidpublisher.googleapis.com`), Google OAuth token endpoint, Google JWKS
(`oauth2/v3/certs`) for Pub/Sub OIDC. Internal: `/api/profile` (entitlement
read), `/api/acquisition/public-trial-campaign` (disclosure copy).

## 5. Related Components

Mobile-only RN components used by the screen: `HeroCard`, `MoveCard`,
`SectionHeader`, `Pill` (`@/components/move`), `LinearGradient`, lucide icons.
No web UI components in this module (server + mobile only).

## 6. Related State / Hooks / Stores

Mobile screen local state (`useState`): `subscription`, `entitlement`,
`workspaceEntitlement`, `iapProducts`, `localizedStorePrices`,
`androidOfferTokens`, `storeProductsLoading/Loaded/Availability`,
`processingPlan`, `loadError`. Connection state in `iap.ts` is module-level
(`connectionReady`, `connecting`, `iapModule`). Server is stateless per request
except in-memory token caches (`appleBearerCache`, `tokenCache`).

## 7. Related Database / Models

Single model: `Subscription` (`packages/db/prisma/schema.prisma`). Relevant
columns: `userId @unique`, `originalTransactionId @unique`,
`purchaseTokenHash @unique @db.VarChar(64)`, `purchaseToken @db.Text`,
`purchaseTokenEncrypted @db.Text`, `provider`, `platform`, `status`, `plan`,
`accessType`, `billingInterval`, `currentPeriodEndsAt`, `gracePeriodEndsAt`,
`appStoreEnvironment`, `latestTransactionId`, `lastValidatedAt`,
`lastSyncedAt`. Webhook idempotency: `ProcessedWebhookEvent` (id + source).

## 8. Impact Map

- **UI**: mobile paywall + management screen; web has no IAP UI.
- **API**: verify + products + 2 webhooks.
- **DB**: Subscription row (one per user), ProcessedWebhookEvent.
- **Auth**: verify requires `requireDbUserId` (custom JWT session). Webhooks are
  authenticated by Apple JWS (appstore) / Pub/Sub OIDC (playstore).
- **Admin**: `sendAdminPurchaseAlert` fires on first activation. Admin grants
  (`premiumGrantedBy`/`premiumUntil`) are cleared when a store purchase lands.
- **Mobile**: primary consumer; expo-iap native module (dev client only).
- **Notifications**: activation/cancel/payment-failed lifecycle emails.
- **Integrations**: Apple App Store + Google Play.
- **Analytics**: `captureException`/`captureMessage` (Sentry).
- **SEO**: N/A.
- **Tests**: vitest unit/integration for libs + routes (see §17).

## 9. Buttons / Actions / Functions

### `handleUpgrade(planKey, cycle)` — subscription.tsx
- **Where**: paywall plan cards (annual/monthly CTA).
- **Expected**: show disclosure, run native purchase, verify, refresh.
- **Actual**: matches. Sets `processingPlan`; gated by `canStartNativePurchase`.
- **Loading**: `ActivityIndicator` per-cycle key. **Disabled**: per-cycle
  `disabled={processingPlan===...}`. **Error**: `Alert` + `hapticError`.
  **Success**: `hapticSuccess` + `fetchSubscription`. **Permission**: blocked for
  inherited members and managed-elsewhere subs.
- **Edge cases**: double-tap covered by `settled`/`handlingPurchase` guards in
  `purchaseSubscription`; 120s timeout (`IAP_PURCHASE_TIMEOUT_MS`).

### `purchaseSubscription(opts)` — iap.ts
- Registers purchase/error listeners + `requestPurchase`, posts proof to verify,
  only `finishTransaction` AFTER server success. Correct ordering (no
  finish-before-verify). **Gap**: on verify failure/timeout the transaction is
  left unfinished and the per-purchase listener torn down — see
  `reconcilePendingPurchases` cold-start reconciler (good mitigation).

### `restorePurchases()` / `reconcilePendingPurchases()` — iap.ts
- Restore is user-initiated, leaves transactions unfinished; reconcile is silent
  cold-start settle-up and DOES finish after verify. Both post each owned
  purchase to `/verify`. Permission: server enforces ownership.

### `applyIapStateToUser(opts)` — iap-common.ts
- Server-side entitlement writer. Ownership guards (txn + token), cross-provider
  block, sandbox/test-purchase allowlist, upsert, seat reconcile, lifecycle email.

### Webhook handlers
- `appstore` POST: verify JWS, bundle check, replay window (72h), idempotency
  reserve, refresh+apply / manual-cancel on REVOKE/REFUND.
- `playstore` POST: OIDC verify, package check, idempotency reserve, refresh+apply
  / void / revoke handling.

## 10. UI/UX Audit

- **UX-1 (Low)**: On the mobile screen, `handleManageBilling` for Stripe-managed
  subs falls to an Alert telling the user it's managed elsewhere, and the
  "Open web billing" button only renders when `hasActiveStripeSubscription`
  (subscription.tsx:950). For an iOS user whose sub is APP_STORE-managed but on a
  different device platform (`isOtherPlatformStoreManaged`), there is no
  actionable deep link — only an informational message. *Evidence*:
  subscription.tsx:603-627, 943-966. *Impact*: dead-end for cross-platform store
  subs. *Recommendation*: surface "manage in <other store>" copy with the correct
  store deep-link target. *Priority*: Low.
- **UX-2 (Info)**: `nativePurchaseUnavailableMessage` has good graduated copy for
  every unavailable reason (subscription.tsx:349-365). Positive.
- **UX-3 (Low)**: Restore "nothing to restore" vs error are conflated — any
  result with no `status==="ok"` shows "nothing to restore" even if every item
  failed with a network error (subscription.tsx:835-843). *Recommendation*:
  distinguish all-errored from genuinely-empty.

## 11. Logic Audit

Expected flow (purchase): native buy → JWS/token → `/verify` → store API →
normalize → ownership guards → upsert → snapshot. This is implemented correctly.

- **LOGIC-1 (Medium) — iOS Server-API-down fallback trusts a client-supplied,
  potentially stale JWS.** In `verify/route.ts:110-123`, if
  `refreshAppleSubscriptionFor` (App Store Server API) throws OR returns null,
  the route falls back to `normalizeAppleTransactionPayload(jwsPayload)` using the
  client's signed transaction. `normalizeAppleTransactionPayload`
  (iap-common.ts:410-451) derives status purely from the JWS fields
  (`revocationDate`, `expiresDate`, `offerDiscountType`) — it never re-queries
  Apple. A client could submit an OLD-but-validly-signed `signedTransaction`
  whose `expiresDate` is in the future relative to its issuance but which has
  since been refunded/expired; with the Server API momentarily erroring, the
  fallback would grant `ACTIVE`/`TRIALING`. The JWS signature is genuine so it
  passes `verifyAppleJws`, and there is no freshness/`signedDate` bound on the
  client JWS in the verify path (`grep` confirms no `signedDate`/`Date.now`
  freshness check in `verify/route.ts`). *Impact*: transient store-API outage
  widens a replay window for stale-but-signed transactions. *Recommendation*:
  bound the accepted JWS `signedDate`/`purchaseDate` (e.g. reject if older than a
  few minutes) before using the fallback, and prefer returning a transient 424
  over granting from an un-refreshed JWS when the sub is a renewable subscription.
- **LOGIC-2 (Low) — `mapProductIdToPlan` runs N runtime-config reads per call**
  (iap-common.ts:333-338, 6 `getRuntimeConfigValue` per verify). Functionally
  correct; see PERF-1.
- **LOGIC-3 (Info) — grace backstop is duplicated** between Apple (iap-common.ts
  :388-391) and Google (453-476) with identical 7-day logic; both anchor to
  `expiresAt ?? now`. Intentional symmetry; fine.
- **LOGIC-4 (Low) — `appStoreEnvironment` is overwritten by whichever environment
  the Server-API probe last matched.** `getAppleSubscriptionStatus` probes
  Production then Sandbox; the returned `env` becomes `state.environment`. This is
  correct, but the column name `appStoreEnvironment` is reused for Play Store rows
  too (`"Sandbox"`/`"Production"` from `testPurchase`). Cosmetic naming only.

## 12. Reverse Logic Audit

- **Unauthorized user**: `/verify` calls `requireDbUserId` first
  (verify/route.ts:55) → 401. Good.
- **Empty data**: products route returns `available:false` maps when no SKUs
  configured; screen shows graceful unavailable copy.
- **API error**: verify maps store errors to static codes without leaking
  secrets (verify/route.ts:166-192; test asserts no secret leakage).
- **Slow network**: Google calls have a 10s `AbortController` timeout
  (iap-google.ts:35-59 → 424). Apple Server API calls have **no timeout** — see
  REL-1.
- **Double-click**: server upsert is keyed on `userId`; concurrent
  `originalTransactionId` claims serialize on the `@unique` constraint (P2002 →
  `IAP_TXN_OWNED_BY_ANOTHER_USER`). Client guards re-entrancy.
- **Stale data**: webhooks refresh from the store; no `lastStripeEventAt`-style
  ordering guard exists for store webhooks — see LOGIC/REL notes.
- **Direct route access**: products route is public (by design; product IDs are
  public). Verify requires auth.
- **Mobile viewport / dark theme**: screen uses `useAppTheme` light/dark; CTAs
  use gradient + onAccent text. Looks consistent (not exhaustively verified).
- **Role change / token expiry**: verify re-auths per call. Webhooks independent
  of user session.

## 13. Security Audit

### SEC-1 (High) — No user↔receipt binding; `appAccountToken` (Apple) and `obfuscatedExternalAccountId` (Google) are defined but never validated
- **Severity**: High
- **Affected Area**: `apps/web/src/app/api/mobile/iap/verify/route.ts`,
  `apps/web/src/lib/iap-common.ts` (`applyIapStateToUser`).
- **Evidence**: `AppleTransactionPayload.appAccountToken` is declared
  (iap-apple.ts:137) and `GoogleSubscriptionV2Response.externalAccountIdentifiers
  .obfuscatedExternalAccountId` is declared (iap-google.ts:230), but a repo-wide
  `grep` for `appAccountToken` / `obfuscatedExternalAccountId` outside type
  definitions returns **zero** usages. The only anti-sharing control is
  "first authenticated user to call `/verify` with a given
  `originalTransactionId`/`purchaseTokenHash` owns it forever"
  (iap-common.ts:582-598).
- **Risk**: A valid signed transaction / purchase token that has **not yet been
  claimed** by any account can be claimed by **whichever account submits it
  first**. There is no cryptographic proof the submitting user is the buyer.
  Apple explicitly provides `appAccountToken` (set by the app at purchase to the
  in-app user id) and Google provides `obfuscatedExternalAccountId` precisely to
  bind a receipt to a server-side account; both are ignored.
- **Defensive Abuse Scenario (high-level)**: If an attacker obtains another
  user's still-unclaimed signed transaction or purchase token (e.g. leaked from a
  proxy/log, or a shared family device before the legitimate client verifies), the
  attacker's account can be the first to POST it to `/verify` and gain the paid
  entitlement, locking the real buyer out (the buyer then gets
  `RECEIPT_OWNED_BY_ANOTHER_ACCOUNT`).
- **Prevention**: Have the mobile client set `appAccountToken`
  (StoreKit2 `Purchase.appAccountToken`) / `obfuscatedAccountId` (Play) to the
  authenticated user id at purchase time, and on the server REQUIRE
  `payload.appAccountToken === userId` (and the Google obfuscated id) before
  granting, rejecting mismatches.
- **Detection**: alert when a verify call's `appAccountToken` is absent or does
  not match the session user; count first-claim races.
- **Analysis (root cause)**: feature designed around DB-uniqueness rather than
  store-provided account binding; the binding fields were typed but never wired.
- **Recommendation**: implement and enforce account-token binding; treat absence
  as a warning today (older builds) but require it once the client sets it.
- **Tests To Add**: verify rejects a JWS whose `appAccountToken` ≠ session user;
  Google verify rejects mismatched `obfuscatedExternalAccountId`.

### SEC-2 (Medium) — `inAppOwnershipType` (FAMILY_SHARED) is never checked
- **Severity**: Medium
- **Affected Area**: `apps/web/src/lib/iap-common.ts`
  (`normalizeAppleResult`, `normalizeAppleTransactionPayload`).
- **Evidence**: `inAppOwnershipType` is declared on `AppleTransactionPayload`
  (iap-apple.ts:124) and appears only in test fixtures (`"PURCHASED"`), never in
  a branch. `grep` confirms no `FAMILY_SHARED` handling anywhere in the IAP code.
- **Risk**: Apple returns `inAppOwnershipType: "FAMILY_SHARED"` for transactions
  obtained via Family Sharing. The code treats a FAMILY_SHARED transaction
  identically to a directly purchased one, so a Family-Sharing recipient can claim
  a full paid entitlement on a separate LocateFlow account. Combined with SEC-1
  (no buyer binding), this expands who can self-provision premium.
- **Defensive Abuse Scenario (high-level)**: A user added to an Apple Family group
  that shares a LocateFlow subscription installs the app, and the shared
  transaction is verified into their own (different-email) LocateFlow account as a
  full paid sub — multiplying entitlements beyond seat limits the product intends.
- **Prevention**: decide a policy. If Family Sharing should NOT grant standalone
  premium, reject `inAppOwnershipType !== "PURCHASED"`. If it should, account for
  it in seat/MRR logic explicitly.
- **Detection**: log distribution of `inAppOwnershipType` on verify.
- **Analysis (root cause)**: ownership type not part of the normalization
  contract.
- **Recommendation**: branch on `inAppOwnershipType` and document the intended
  Family-Sharing behavior.
- **Tests To Add**: normalize/verify path for a FAMILY_SHARED transaction.

### SEC-3 (Medium) — `isBillingProductionLike` vs webhook `isProductionLikeRuntime` diverge on staging/preview, weakening the sandbox/test-purchase gate in non-prod
- **Severity**: Medium
- **Affected Area**: `apps/web/src/lib/billing-config.ts:3-9`,
  `apps/web/src/lib/iap-common.ts:515,548`,
  `apps/web/src/app/api/webhooks/*/route.ts`.
- **Evidence**: `isBillingProductionLike` returns **false** for
  `staging`/`preview`/`test`/`dev` (billing-config.ts:5-7). The sandbox gates
  `assertGooglePlayTestPurchaseAllowedForUser` / `assertAppleSandboxPurchaseAllowed
  ForUser` only enforce the email allowlist when `isBillingProductionLike()` is
  true (iap-common.ts:515, 548). The webhook routes' LOCAL
  `isProductionLikeRuntime()` instead returns **true** for
  `staging`/`preview` (appstore/route.ts:46-54, playstore/route.ts:81-89).
- **Risk**: In a `staging`/`preview` deployment that points at real production
  store credentials, the sandbox/test-purchase allowlist is NOT enforced (the
  billing-config gate is off), so any authenticated user could claim a sandbox /
  Google test purchase as premium there. Meanwhile the webhook signature gates ARE
  on. The two notions of "production-like" are inconsistent, which is easy to
  misconfigure. **[needs verification]** that staging never uses live store creds.
- **Defensive Abuse Scenario (high-level)**: On a publicly-reachable preview/staging
  build wired to real store apps, a tester uses a sandbox Apple ID / Google license
  tester to obtain a $0 sub and is granted full premium because the allowlist gate
  is disabled in non-production billing mode.
- **Prevention**: unify the environment predicate; have the sandbox allowlist gate
  also engage for staging/preview (or never ship store creds to those envs).
- **Detection**: assert at boot that store creds are absent unless
  `isBillingProductionLike()`.
- **Analysis (root cause)**: two independent environment helpers with different
  inclusion sets.
- **Recommendation**: consolidate to one shared predicate and document which
  environments may hold live store credentials.
- **Tests To Add**: gate behavior under `APP_ENV=staging` with a sandbox state.

### SEC-4 (Low) — Apple App Store Server API calls have no request timeout
- **Severity**: Low
- **Affected Area**: `apps/web/src/lib/iap-apple.ts:374-392`.
- **Evidence**: the Apple `fetch` loop uses a bare `fetch` with no
  `AbortController`/timeout, unlike the Google client which wraps every call in a
  10s timeout (`fetchWithGoogleTimeout`, iap-google.ts:37-59).
- **Risk**: a hung Apple endpoint can stall the verify request / webhook handler,
  tying up a serverless invocation and degrading throughput; the per-user/IP rate
  limiter does not bound upstream latency. Not a direct compromise — reliability/
  DoS-amplification.
- **Prevention**: add an AbortController timeout to all Apple fetches.
- **Detection**: latency alarms on the verify route.
- **Recommendation**: mirror `fetchWithGoogleTimeout` for Apple.
- **Tests To Add**: simulate slow Apple host → bounded failure.

### SEC-5 (Low) — Products endpoint is fully unauthenticated and uncached
- **Severity**: Low (by design, but worth noting)
- **Evidence**: `/api/mobile/iap/products` (products/route.ts:18) has no auth, no
  rate limit, and `dynamic="force-dynamic"`; each call performs 12
  `getRuntimeConfigValue` reads.
- **Risk**: product IDs are public so confidentiality is fine, but the endpoint is
  a cheap unauthenticated amplifier against the runtime-config store (12 reads per
  hit). *Recommendation*: add light caching / a short `revalidate`, or a basic
  rate limit.

### Positive security observations (confirmed in code)
- Apple JWS verification enforces the full x5c chain to `AppleRootCA-G3` AND the
  Apple App Store leaf/intermediate OIDs (iap-apple.ts:204-218) — this correctly
  prevents a different Apple-rooted cert from forging a "valid transaction" JWS.
- Bundle-id is checked on both API-returned and client-supplied transactions
  (iap-apple.ts:405-407, 440-442; iap-common.ts:417-419) → `APPLE_JWS_BUNDLE_MISMATCH`.
- Webhook idempotency is reserve-before-act with release-on-failure
  (webhook-idempotency.ts; appstore/route.ts:160-253, playstore/route.ts:218-346)
  — prevents double-grant on concurrent redelivery.
- Apple webhook enforces a 72h replay window (appstore/route.ts:114-121).
- Play webhook verifies Pub/Sub OIDC token, audience, service-account email, and
  subject, and **fails closed in production** when identity config is missing
  (playstore/route.ts:139-189).
- Error responses are sanitized — store error strings (which can contain tokens/
  secrets) are mapped to static codes (verify/route.ts:166-192; asserted by tests).
- purchaseToken is stored AES-256-GCM encrypted (`purchaseTokenEncrypted`) with a
  separate SHA-256 `purchaseTokenHash` for lookups; production refuses to store
  plaintext if the key is missing (encryption.ts:42-46).
- Cross-provider takeover guard: an active sub managed by a DIFFERENT provider
  blocks a new IAP grant (`ACTIVE_SUBSCRIPTION_MANAGED_ELSEWHERE`,
  iap-common.ts:614-621).

## 14. Performance Audit

- **PERF-1 (Low)** — `mapProductIdToPlan` issues 6 `getRuntimeConfigValue` reads
  per call (iap-common.ts:333-338), called once per verify and once per
  normalize; plus `/products` does 12. If `getRuntimeConfigValue` is uncached
  this is chatty. **[needs verification]** of runtime-config caching.
- **PERF-2 (Low)** — `applyIapStateToUser` performs several sequential DB reads
  (findUnique by txn, findFirst by token, findUnique by user) before the upsert
  (iap-common.ts:582-666). Acceptable per purchase; not in a hot loop.
- **PERF-3 (Info)** — Apple/Google bearer tokens are cached in-memory with TTL
  (iap-apple.ts:310-335, iap-google.ts:98-197). Good. Note: per-instance only;
  acceptable.
- **Mobile**: products are fetched in one batched `fetchProducts` call
  (subscription.tsx:368-405). Good.

## 15. Reliability Audit

- **REL-1 (Medium)** — No timeout on Apple Server API (see SEC-4); a hung Apple
  call has no upper bound. Recommend AbortController.
- **REL-2 (Medium)** — Store webhooks have no event-ordering guard. The Subscription
  model has `lastStripeEventAt` for Stripe out-of-order protection, but the IAP
  apply path always overwrites `status`/period from the latest `refresh*` result.
  Because each webhook re-queries the store for current state (rather than trusting
  the notification body), late/out-of-order RTDN/ASSN deliveries mostly converge to
  truth — but a REVOKE/REFUND manual-cancel (`updateMany ... status:"CANCELED"`,
  appstore/route.ts:210-219, playstore/route.ts:303-310) could be undone by a
  later stale renewal refresh if redelivered after the store API briefly still
  reports active. *Recommendation*: gate manual-cancel overwrites on event time /
  re-verify, and/or record the notification timestamp. **[needs verification]** of
  real-world ordering exposure.
- **REL-3 (Low)** — `reconcilePendingPurchases` (iap.ts:430-471) is the safety net
  for charged-but-unverified iOS purchases (listener torn down on timeout). It must
  be invoked on app start with a session; confirm the call site exists.
  **[needs verification]** — call site not located in this audit pass.
- **REL-4 (Low)** — Lifecycle emails are fire-and-forget (`fireAndLogIapEmail`)
  and swallow errors; acceptable but means a missed activation email is silent.
- **Error handling**: verify route has comprehensive error→status mapping with
  Sentry capture only for unexpected errors. Good.

## 16. Dead Code / Cleanup

- **DEAD-1 (Info)** — `iap-apple.ts` exports `verifyAndLookupSignedTransaction`
  (iap-apple.ts:434-444). `grep` shows it is not referenced by the verify route or
  webhooks (the verify route inlines verify + `refreshAppleSubscriptionFor`).
  Likely unused. **[needs verification]** — confirm no other caller before removal.
- **DEAD-2 (Info)** — `mobile-external-billing-guard.ts` exports
  `MOBILE_EXTERNAL_BILLING_NOT_ALLOWED` constant; used in tests. Fine.
- **DEAD-3 (Info)** — `resetGoogleIapTokenCacheForTests` (iap-google.ts:199) is a
  test-only export; acceptable.
- No abandoned routes detected. `iap-status.ts` referenced in scope does not exist
  (only its test) — not dead code, just a non-existent path in the task scope.

## 17. Tests

**Existing**: `iap-apple.test.ts`, `iap-google.test.ts`, `iap-common.test.ts`,
`iap-status.test.ts`, `verify/route.test.ts`, `webhooks/appstore/route.test.ts`,
`webhooks/playstore/route.test.ts`; mobile `iap.test.ts`, `iap-offers.test.ts`,
`subscription-app-review.test.ts`, `subscription-visible-plans.test.ts`. Coverage
includes JWS/OID verification, status mapping, grace backstops, secret-redaction
on error, sandbox/test-purchase gating, fail-open rate-limit mode.

**Missing / suggested**:
- SEC-1: verify rejects mismatched/absent `appAccountToken` and Google
  `obfuscatedExternalAccountId` (once binding implemented).
- SEC-2: FAMILY_SHARED `inAppOwnershipType` handling.
- SEC-3: sandbox gate behavior under `APP_ENV=staging`/`preview`.
- LOGIC-1: stale-but-signed JWS rejected when Server API is down (freshness bound).
- REL-1/SEC-4: Apple Server API timeout behavior.
- REL-2: out-of-order webhook (renewal after refund) convergence.
- e2e: full purchase → verify → entitlement, and restore on reinstall.

## 18. Findings Summary

| ID | Severity | Category | Finding | Impact | Recommendation | Files |
|----|----------|----------|---------|--------|----------------|-------|
| mobile-iap-billing-01 | High | Security | No user↔receipt binding; `appAccountToken`/`obfuscatedExternalAccountId` typed but never enforced; only first-claim DB uniqueness protects ownership | Unclaimed receipt/token can be claimed by any account that submits it first; buyer lockout / entitlement theft | Set + require `appAccountToken`/`obfuscatedAccountId` == session user | iap-apple.ts:137, iap-google.ts:230, iap-common.ts:582-598, verify/route.ts |
| mobile-iap-billing-02 | Medium | Security | `inAppOwnershipType` (FAMILY_SHARED) never checked | Family-Sharing recipient gets standalone premium on a separate account; bypasses seat intent | Branch on ownership type; define Family-Sharing policy | iap-common.ts:348-451, iap-apple.ts:124 |
| mobile-iap-billing-03 | Medium | Security | `isBillingProductionLike` (false for staging/preview) vs webhook `isProductionLikeRuntime` (true) diverge; sandbox/test-purchase allowlist gate off in staging/preview | Sandbox/test purchase grants real premium on a staging/preview build wired to live store creds | Unify env predicate; engage allowlist for staging/preview | billing-config.ts:3-9, iap-common.ts:515,548, webhooks/*/route.ts |
| mobile-iap-billing-04 | Medium | Logic | iOS Server-API-down fallback grants from client JWS with no freshness bound | Transient Apple outage widens replay window for stale-but-signed transactions | Bound JWS `signedDate`/`purchaseDate`; prefer 424 over un-refreshed grant for renewables | verify/route.ts:110-123, iap-common.ts:410-451 |
| mobile-iap-billing-05 | Medium | Reliability | No event-ordering guard on store webhooks; manual REVOKE/REFUND cancel can be undone by a later stale refresh | Refunded/revoked sub could be re-activated by out-of-order redelivery | Gate cancel overwrites on event time / re-verify | appstore/route.ts:210-219, playstore/route.ts:300-320 |
| mobile-iap-billing-06 | Low | Reliability/Security | Apple Server API calls lack request timeout (Google has 10s) | Hung Apple endpoint stalls verify/webhook invocations | Add AbortController timeout to Apple fetches | iap-apple.ts:374-392 |
| mobile-iap-billing-07 | Low | Security/Performance | `/api/mobile/iap/products` unauthenticated, uncached, 12 config reads/hit | Cheap unauthenticated amplifier on runtime-config | Cache / rate-limit | products/route.ts |
| mobile-iap-billing-08 | Low | UI/UX | Cross-platform store-managed subs reach a dead-end manage flow; restore conflates all-errored with empty | Confusing management UX | Add correct store deep-link; distinguish errored vs empty restore | subscription.tsx:603-627,835-843 |
| mobile-iap-billing-09 | Info | Dead Code | `verifyAndLookupSignedTransaction` appears unused | Maintenance noise | Confirm + remove | iap-apple.ts:434-444 |
| mobile-iap-billing-10 | Info | Reliability | `reconcilePendingPurchases` call site not confirmed | Charged-but-unverified iOS purchases unrecovered if reconciler not invoked on launch | Confirm app-start invocation | iap.ts:430-471 |

## 19. Module TODO

- [ ] **(High) Enforce store account binding** — *Reason*: SEC-1 receipt theft /
  buyer lockout. *Files*: `verify/route.ts`, `iap-common.ts`, mobile `iap.ts`
  (set `appAccountToken`/`obfuscatedAccountId`). *Fix*: client sets token to user
  id; server requires match. *Dependencies*: mobile + server coordinated release;
  tolerate absence for old builds. *Complexity*: med. *Risk*: med.
- [ ] **(Medium) Handle `inAppOwnershipType`** — *Reason*: SEC-2 Family-Sharing
  multiplies entitlements. *Files*: `iap-common.ts`. *Fix*: branch / reject
  FAMILY_SHARED per policy. *Dependencies*: product decision. *Complexity*: low.
  *Risk*: med (could reject legitimate users if policy wrong).
- [ ] **(Medium) Unify production-like env predicate** — *Reason*: SEC-3 gate gap.
  *Files*: `billing-config.ts`, `iap-common.ts`, webhook routes. *Fix*: single
  shared helper; engage sandbox allowlist on staging/preview. *Dependencies*:
  confirm staging never holds live creds. *Complexity*: low. *Risk*: low.
- [ ] **(Medium) Bound client-JWS freshness in iOS fallback** — *Reason*: LOGIC-1
  replay window. *Files*: `verify/route.ts`, `iap-common.ts`. *Fix*: reject stale
  `signedDate`; prefer transient error. *Complexity*: low. *Risk*: low.
- [ ] **(Medium) Add webhook event-ordering guard** — *Reason*: REL-2 refund
  undo. *Files*: webhook routes, possibly schema (notification timestamp). *Fix*:
  record + compare event time before cancel-overwrites. *Complexity*: med.
  *Risk*: med.
- [ ] **(Low) Add Apple Server API timeout** — *Files*: `iap-apple.ts`.
  *Complexity*: low. *Risk*: low.
- [ ] **(Low) Cache/rate-limit products endpoint** — *Files*: `products/route.ts`.
  *Complexity*: low. *Risk*: low.
- [ ] **(Low) Polish manage/restore UX** — *Files*: `subscription.tsx`.
  *Complexity*: low. *Risk*: low.
- [ ] **(Info) Confirm/remove `verifyAndLookupSignedTransaction`; confirm
  `reconcilePendingPurchases` call site** — *Files*: `iap-apple.ts`, mobile app
  start. *Complexity*: low. *Risk*: low.
