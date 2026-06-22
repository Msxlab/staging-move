# Module Audit: Mobile App (Expo / React Native)

> Scope: `apps/mobile/app/**` (54 screens), `apps/mobile/src/**`, `app.config.js`,
> `app.json`, `eas.json`, `metro.config.js`, `babel.config.js`, `index.js`, and the
> shared `packages/shared/src/api-client.ts` consumed by the mobile API client.
> Evidence is source-only; doc/MD claims are not cited as proof.

## 1. Module Summary

The LocateFlow mobile app is an Expo SDK 55 / React Native 0.83 app using expo-router
(typed routes), a custom JWT bearer-token auth (no next-auth), zustand stores, TanStack
Query (in-memory only), NativeWind/StyleSheet theming, i18n (en/es), and native IAP
(`expo-iap`) for App Store / Play Store billing. The server (`apps/web`) is the single
source of truth for auth, entitlement, and billing verification; the app holds a
long-lived (30-day) JWT in `expo-secure-store` and attaches it as `Authorization: Bearer`
plus client-identity headers used for server-side session fingerprinting.

Overall the security posture is solid for a native app: tokens live in the Keychain/
Keystore (`auth.ts`), OAuth uses PKCE with the verifier kept in SecureStore (`pkce.ts`),
IAP purchases are always re-verified server-side before any entitlement is granted
(`iap.ts`), and forced-logout/manual-logout/delete all route through a shared sensitive-
state teardown (`local-cleanup.ts`). The most material findings are privacy-at-rest
(personal data echoed into unencrypted AsyncStorage offline caches), a cleartext-HTTP
allowance in the dev-gated API-URL resolver, and several reliability/observability gaps
(Sentry environment mis-tagging, hardcoded analytics locale, thin automated coverage of
the AuthGuard routing state machine).

## 2. Related Files

Auth / session / API:
- `apps/mobile/src/lib/api.ts` — API base-URL resolution + ApiClient wiring.
- `packages/shared/src/api-client.ts` — shared HTTP client (headers, 401/429 handling).
- `apps/mobile/src/lib/auth.ts` — SecureStore token cache (`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`).
- `apps/mobile/src/lib/auth-store.ts` — zustand auth store (token, user, planTier, hydrate/clear).
- `apps/mobile/src/lib/client-identity.ts` — client headers + `buildMobileAuthHeaders`.
- `apps/mobile/src/lib/workspace-selection.ts` — `x-workspace-id` header value.

OAuth / deep links / invites:
- `apps/mobile/src/lib/mobile-oauth.ts`, `mobile-oauth-handoff.ts`, `pkce.ts`, `apple-auth.ts`.
- `apps/mobile/app/oauth.tsx`, `src/components/OAuthCallbackScreen.tsx`.
- `apps/mobile/src/lib/workspace-invite.ts`, `app/invitations/[token].tsx`, `app/workspace/accept-invite.tsx`.
- `apps/mobile/app/reset-password/[token].tsx`, `app/setup-password.tsx`.

Billing / IAP:
- `apps/mobile/src/lib/iap.ts`, `iap-offers.ts`, `billing-flags.ts`, `subscription-gate.ts`,
  `subscription-visible-plans.ts`, `subscription-app-review.ts`, `plan-comparison.ts`.
- `apps/mobile/app/settings/subscription.tsx`.

App shell / security gates / cleanup:
- `apps/mobile/app/_layout.tsx` (AuthGuard, deep-link router, notification router, IAP reconcile).
- `apps/mobile/src/components/AppLockGate.tsx`, `src/lib/app-lock-store.ts`.
- `apps/mobile/src/lib/local-cleanup.ts`, `offline-cache.ts`, `session-cleanup-hook.ts`.
- `apps/mobile/src/components/ErrorBoundary.tsx`, `SessionTracker.tsx`.
- `apps/mobile/src/lib/sentry.ts`, `analytics.ts`, `push.ts`.

Config: `app.json`, `app.config.js`, `eas.json`, `metro.config.js`, `babel.config.js`,
`index.js`, `.env.example`, `tsconfig.json`, `package.json`.

## 3. Related Routes / Screens

54 route files. Public (no token) per AuthGuard allow-list (`_layout.tsx:287`,
`AppLockGate.tsx:24`): `(auth)/*`, `oauth`, `reset-password/*`, `blog/*`. Everything else
requires a token (unauthenticated access redirects to `/(auth)/sign-in`).

Groups: `(auth)` (sign-in, sign-up, forgot-password), `(tabs)` (index/dashboard,
addresses, moving, services, more), and stacks for `addresses`, `blog`, `budget`,
`custom-providers`, `help`, `invitations`, `moving`, `notifications`, `providers`,
`reminders`, `search`, `services`, `settings/*`, `workspace`, plus `onboarding`,
`setup-password`, `+not-found`.

## 4. Related APIs (called from mobile)

- Auth: `/api/mobile/auth/login`, `/api/mobile/auth/exchange`, `/api/mobile/auth/apple/native`,
  `/api/auth/me`, `/api/auth/logout`, `/api/auth/oauth/providers`, `/api/auth/oauth/{provider}`,
  `/api/auth/password/reset/confirm`, `/api/auth/security`, `/api/auth/mfa/setup`.
- Profile / entitlement: `/api/profile`, `/api/consent`, `/api/legal/acceptance`, `/api/account/delete`.
- IAP: `/api/mobile/iap/products`, `/api/mobile/iap/verify`.
- Acquisition: `/api/acquisition/public-trial-campaign`.
- Invitations: `/api/invitations/{token}`, `/api/invitations/{token}/accept`,
  `/api/invitations/pending`, `/api/invitations/pending/{id}/accept|decline`.
- Domain CRUD: `/api/addresses/*`, `/api/services/*`, `/api/moving/*`, `/api/budget/*`,
  `/api/custom-providers/*`, `/api/notifications`, `/api/reminders`, help/tickets, etc.
- Tracking: `/api/tracking/session`, `/api/tracking/event`. Push: `/api/push/register`.
- Maps proxy (image): `/api/maps/static` (via `TransitRouteMap`).

## 5. Related Components

`AppLockGate`, `SessionTracker`, `ErrorBoundary`, `AnimatedSplash`, `OAuthCallbackScreen`,
`EmailVerificationBanner`, `LegalConsentPanel`, `AddressesMap`/`TransitRouteMap`, the
`components/ui/*` design system (Button, Input, Card, EmptyState, ErrorState, LoadingScreen,
Skeleton, ThemeSelector, LanguageSelector, etc.), `components/move/*`, `components/provider/*`,
`components/onboarding/*`, and the Android home-screen `widgets/MoveWidget`.

## 6. Related State / Hooks / Stores

- `useAuthStore` (zustand) — token/user/planTier; `hydrate/setSession/clearSession/refreshUser/patchUser/setPlanTier`.
- `useAppLockStore` (zustand) — biometric app-lock capability + locked state.
- `store/app-store.ts` (zustand `app-store`), `compare-store.ts`.
- `createQueryClient()` — TanStack Query, memory-only (no persistence by design, `query-client.ts`).
- Hooks: `useThemePreference`/`useAppTheme` (`lib/theme.ts`), `useDetailOfflineCache`, `usePressScale`.
- Module singletons: analytics queue (`analytics.ts`), OAuth in-flight/completed maps
  (`mobile-oauth-handoff.ts`), IAP connection (`iap.ts`), pending invite token (`workspace-invite.ts`).

## 7. Related Database / Models

The mobile app holds no database; it consumes the web API. Locally persisted state:
- SecureStore (encrypted): `locateflow.session` (JWT), `locateflow.oauth.pkce.<state>` (PKCE verifier).
- AsyncStorage (NOT encrypted): `locateflow.planTier`, `locateflow.onboardingCompleted`,
  `locateflow.offline.*` (Services/Moving last-known lists), `locateflow.dashboard.snapshot.v1`,
  `locateflow.widget.snapshot.v1`, `locateflow.lastPlan.v1`, `locateflow.handledOAuthCodes`,
  `locateflow.pendingInviteToken`, `locateflow.pendingLegalConsents`, `locateflow.selectedWorkspaceId`,
  `locateflow.appLock.enabled`, `locateflow.locale`, `locateflow.pushSoftPromptDecision`.
Server-side models touched indirectly: User, Subscription/Entitlement, Workspace/Invitation,
Address/Service/MovingPlan/Budget, Session, PushToken (per API surface).

## 8. Impact Map

- **UI**: All 54 screens; theme + i18n shell in `_layout.tsx`/`theme.ts`.
- **API**: All reads/writes go through `ApiClient` (`api.ts`) + cold-start bare `fetch` in `refreshUser`.
- **DB**: Indirect via API; local persistence split SecureStore (secrets) vs AsyncStorage (prefs + PII snapshots).
- **Auth**: JWT bearer, fingerprint via client headers; AuthGuard routing state machine; PKCE OAuth; native Apple.
- **Admin**: None directly (no admin surface in mobile).
- **Mobile**: This module.
- **Notifications**: `push.ts` registration + `_layout.tsx` notification-tap routing; Android channels.
- **Integrations**: Stripe (web-managed, read-only on mobile), Apple/Google IAP, Geoapify static map proxy, Expo Push, GlitchTip/Sentry.
- **Analytics**: `analytics.ts` + `SessionTracker.tsx`, consent-gated via `/api/consent`.
- **SEO**: N/A for native (universal-link associated domains in `app.json`).
- **Tests**: Vitest unit tests for many libs; AuthGuard/screens largely untested (see §17).

## 9. Buttons / Actions / Functions

For each: behavior / state handling / permission / edge cases.

**Sign in (email/password)** — `sign-in.tsx:handleSubmit`. POSTs `/api/mobile/auth/login`.
Loading via `loading`; submit disabled until email+password (and MFA ≥6 chars) present
(`:264`). MFA branch keys off `res.code === "MFA_REQUIRED"` (403) — correct since the shared
client drops body on non-2xx. Error surfaced inline + haptic. Edge: trims email; 6-digit →
`mfaCode`, else `backupCode`. No client password-policy (server enforces). OK.

**Continue with Apple / Google** — `sign-in.tsx:openOAuth`. iOS prefers native Apple sheet
(`apple-auth.ts`), else `startMobileOAuthSession` (PKCE web flow). Buttons disabled when
provider not ready or another OAuth in flight (`:282`, `:293`). Cancelled → silent. Errors
inline. Good.

**OAuth deep-link completion** — `_layout.tsx` effect (`:153`) + `mobile-oauth.ts`. Idempotent,
race-coalesced via `mobile-oauth-handoff.ts`. On success: `setSession`, post pending legal
consents (only clears on ack), consume pending invite, route to post-auth. Edge: catches
exchange failure with an Alert. See §11 for a double-handle nuance.

**Purchase subscription (annual/monthly)** — `subscription.tsx:handleUpgrade` → `iap.ts:purchaseSubscription`.
Per-cycle processing key drives spinner + disabled state. Disclosure Alert gate before native
sheet (Apple/Play parity). Blocks purchase when managed elsewhere or inherited member
(`canStartNativePurchase`). Server verify required before `finishTransaction`. Cancelled →
silent; error → retry Alert. Strong.

**Restore purchases** — `subscription.tsx:handleRestore` → `iap.ts:restorePurchases`. Gated by
`canUseNativePurchases && !managedSubscriptionBlocksPurchase`. Spinner via `processingPlan="RESTORE"`.
Note: `restorePurchases` deliberately does NOT `finishTransaction` (the cold-start reconciler does).

**Manage / open web billing** — `handleManageBilling` (store-managed → native settings) and
`handleOpenWebBilling` (Stripe-managed → in-app browser to `/settings/subscription`). Correctly
avoids linking out to a non-IAP purchase flow (store policy). OK.

**Accept invite (deep link + pending)** — `invitations/[token].tsx:accept` → `workspace-invite.ts:acceptInvite`.
`accepting` disables button + spinner. Errors mapped to localized copy by stable code.
Token stashed for cross-auth handoff and cleared after. Server email-matches. Good.

**Reset password** — `reset-password/[token].tsx:submit`. Validates token presence + match;
POSTs confirm. `saving` + disabled when fields empty. No min-length client check (server enforces). OK.

**Delete account** — `settings/delete-account.tsx:handleDelete`. Phrase + (for password
accounts) password gate; OAuth-only path sends `confirmAccountDeletion:true`. Unregisters push,
clears session + sensitive state, handles `SCHEDULED` (grace) response. Strong.

**Sign out** — `(tabs)/more.tsx:handleSignOut` and `AppLockGate.tsx:handleSignOut`. Both
unregister push, POST `/api/auth/logout`, `clearSession`, `clearSensitiveLocalState`, route to
sign-in. Consistent. Good.

**App lock enable/disable/unlock** — `app-lock-store.ts`. Biometric with device-passcode
fallback (`disableDeviceFallback:false`) so a removed fingerprint never bricks access; disable-
while-locked guarded; recovery sign-out available. Solid.

## 10. UI/UX Audit

- **Loading/empty/error states are consistently handled** on detail screens (e.g.
  `addresses/[id]/index.tsx` distinguishes not-found vs transient error and offers retry;
  `subscription.tsx` shows a tappable load-error card). Evidence: `addresses/[id]/index.tsx:67-131`,
  `subscription.tsx:881-891`. Impact: positive. Recommendation: keep this pattern for all list tabs.
- **Subscription screen is very large** (`subscription.tsx`, ~1694 lines) with dense derived
  state. Impact: maintainability/UX-regression risk on edits. Recommendation: extract
  plan-card + pricing-derivation into tested helpers (some already exist). Priority: Low.
- **Hardcoded English strings** remain in user-facing copy on otherwise-i18n screens (e.g.
  `addresses/[id]/index.tsx:145` `"Seasonal"/"Past"/"Active"`, `:241,264` `"Needs attention"`,
  `subscription.tsx` savings strings `Save .../year`). Impact: Spanish users see English.
  Recommendation: move to i18n keys. Priority: Low (UI/UX).
- **Accessibility is generally good** (buttons have `accessibilityRole`/`Label`/`Hint`/`State`,
  map has `accessibilityLabel`, reduce-motion respected in `_layout.tsx:438`). Gap: some
  `TouchableOpacity` rows (e.g. category tiles `addresses/[id]/index.tsx:273`) lack
  `accessibilityRole="button"`/labels. Priority: Low (Accessibility).
- **Light/dark theme**: chrome (StatusBar, SystemUI, Android nav) is synced to resolved scheme
  and the Stack remounts on scheme change (`_layout.tsx:420-462`). No hardcoded background that
  fights the theme except deliberate dark map placeholders. OK.

## 11. Logic Audit

- **Auth routing state machine** (`_layout.tsx` effects 1–6) is intricate: hydrate → refreshUser
  → onboarding check → route → notification tap → IAP reconcile. Failure policy is sound
  (transient `/api/profile` failure defaults a brand-new account to "needs onboarding", returning
  users unblocked via cache). Risk: the logic is hard to reason about and has thin automated
  coverage (only `auth-navigation.test.ts` asserts the presence of the setup-password screen and
  a comment string — it does not exercise routing). See §17.
- **Double-handling of OAuth callback**: both the WebBrowser success path
  (`mobile-oauth.ts:startMobileOAuthSession`) and the system deep-link path (`_layout.tsx:153`)
  can receive the same code; `mobile-oauth-handoff.ts` coalesces via in-flight/completed maps +
  an AsyncStorage handled-set. This is correct, but correctness depends on a singleton module
  surviving for the process lifetime. Stale-data risk is low. [verified by code]
- **`getInitialURL` runs the OAuth handler for every launch deep link** including invite/reset
  links; `readMobileOAuthCallback` returns null for non-OAuth URLs, so it is a safe no-op, while
  invite tokens are separately stashed. No incorrect branch observed.
- **Onboarding re-check** (`_layout.tsx:310`) guards against bouncing a just-completed user back
  to step 1 — good. Minor: two `/api/profile` calls can fire close together (effect 3 + effect 4
  re-check); acceptable.
- **`refreshUser` uses a bare `fetch`** (not the ApiClient) and must replicate client-identity
  headers, which it does (`auth-store.ts:176`). If those headers drift from `client-identity.ts`,
  cold-start hydration would 401 and force logout. Coupling is documented but fragile.
- **`SessionTracker` consent gating**: analytics only enabled when `/api/consent` grants ANALYTICS
  (`SessionTracker.tsx:60`), and disabled on sign-out. Correct.

## 12. Reverse Logic Audit

- **Unauthorized / direct route access**: AuthGuard redirects any tokenless access of a non-public
  segment to sign-in (`_layout.tsx:287`); deep links to `/moving/[id]` etc. bounce to sign-in
  (invite token preserved). Server still authorizes every request, so client routing is defense-in-depth.
- **Empty data / API error / slow network**: detail screens differentiate not-found vs error and
  offer retry; offline caches hydrate last-known lists; ApiClient enforces a 20s timeout
  (`api.ts:124`, `api-client.ts:82`). Good.
- **Double-click**: purchase/restore/accept/delete buttons are disabled while processing; IAP
  `purchaseSubscription` guards re-entry with `settled`/`handlingPurchase`. Good.
- **Stale data**: `useFocusEffect` re-fetches subscription on focus; planTier normalized against a
  known set so a renamed/corrupt tier can't leak (`auth-store.ts:54`). Good.
- **Mobile viewport**: tablet support disabled on iOS (`app.json:18`); portrait-locked.
- **Dark theme**: covered (§10).
- **Role change / entitlement change**: inherited Family/Pro members are blocked from a redundant
  purchase (`subscription.tsx:485`); effective entitlement drives display. Good.
- **Token expiry**: 401 anywhere → `onUnauthorized` → `clearSession` → cleanup hook → routed to
  sign-in (`api.ts:130`). 30-day JWT, no refresh by design; expiry is a clean forced logout.
  Edge: MFA-confirm passes `skipUnauthorizedHandler` so a wrong code doesn't log the user out
  (`api-client.ts:160`). Correct.

## 13. Security Audit

### mobile-app-01 — Personal data persisted to unencrypted AsyncStorage (offline caches/snapshots)
- **Severity**: Medium
- **Affected Area**: `offline-cache.ts`, `local-cleanup.ts`, dashboard/widget/last-plan snapshots, `auth-store.ts` (planTier).
- **Evidence**: `offline-cache.ts:18-70` writes Services/Moving list payloads (addresses,
  provider/service names, costs) to AsyncStorage under `locateflow.offline.*`; `local-cleanup.ts:8-30`
  enumerates dashboard/widget/last-plan snapshots that "echo the last signed-in user's move
  route, task titles, saved addresses and providers." AsyncStorage is plaintext on device
  (unlike `auth.ts` SecureStore). Tokens/PKCE are correctly in SecureStore; PII snapshots are not.
- **Risk**: On a rooted/jailbroken or forensically-imaged device, an attacker with filesystem
  access can read the last user's addresses, services, costs and plan tier without the JWT.
- **Defensive Abuse Scenario (high-level)**: Device compromise / shared-device residue exposes the
  prior user's location and financial-adjacent data even after the token would have expired.
- **Prevention**: Store PII snapshots in SecureStore, or encrypt the AsyncStorage envelope with a
  SecureStore-held key, or scope caches to a per-user namespace and shorten retention.
- **Detection**: Add a test asserting no PII keys are written outside SecureStore; review the
  snapshot key inventory on each release.
- **Analysis (root cause)**: Deliberate trade-off (offline UX) documented in the files, but the
  privacy stance ("private AsyncStorage, cleared on logout") assumes the sandbox is confidential,
  which is not true on compromised devices.
- **Recommendation**: Encrypt-at-rest or move snapshots to SecureStore; keep the logout wipe.
- **Tests To Add**: Unit test enumerating written keys; assert PII payloads are not in plaintext storage.

### mobile-app-02 — Cleartext HTTP allowed for local debug proxy in "development" env
- **Severity**: Low
- **Affected Area**: `api.ts:resolveApiUrl`/`enforceProductionApiUrl`.
- **Evidence**: `api.ts:62-74` returns the URL unchanged (instead of forcing `https://locateflow.com/api`)
  when `publicEnv === "development"` and the URL points to `10.0.2.2|localhost|127.0.0.1`; in `__DEV__`
  it also derives `http://<expoHost>:3000/api` (`api.ts:55`). `app.json` sets ATS `NSAllowsLocalNetworking:true`
  and Android `usesCleartextTraffic:false` globally.
- **Risk**: Bearer token + PII sent over cleartext HTTP to a LAN host if a release somehow carries
  `EXPO_PUBLIC_ENV=development`. `eas.json` production sets `EXPO_PUBLIC_ENV=production`, so this is
  effectively dev-only.
- **Defensive Abuse Scenario (high-level)**: A mis-built/internal artifact pointed at a LAN proxy
  could leak the session over plaintext to a same-network attacker.
- **Prevention**: The non-`__DEV__` HTTPS enforcement already covers production; keep the
  cleartext allowance strictly behind `__DEV__` rather than a public env string an artifact could carry.
- **Detection**: `release-config.test.ts` already asserts prod env values; extend to assert no
  release profile sets `EXPO_PUBLIC_ENV=development`.
- **Analysis (root cause)**: The local-proxy convenience exception keys off `EXPO_PUBLIC_ENV` (a
  build-injected public string) in addition to `__DEV__`.
- **Recommendation**: Gate the cleartext exception on `__DEV__` only; or restrict to RFC1918 hosts AND `__DEV__`.
- **Tests To Add**: Assertion that production/preview profiles never use cleartext or `development` env.

### mobile-app-03 — Custom-scheme OAuth callback interception (mitigated by PKCE)
- **Severity**: Low (residual)
- **Affected Area**: `app.json` `scheme:"locateflow"`, `mobile-oauth.ts`, `pkce.ts`, `mobile-oauth-handoff.ts`.
- **Evidence**: The OAuth redirect can land on `locateflow://oauth?code=...` (`mobile-oauth.ts:30-50`).
  A hostile app registering the same custom scheme on Android could receive the code. Mitigation:
  PKCE verifier never leaves SecureStore and the server enforces `sha256(verifier)==challenge`
  (`pkce.ts:1-18`, `mobile-oauth-handoff.ts:121`); Android App Links use `autoVerify:true` for the
  `https` path (`app.json:79`). Codes are also single-use + dedup'd.
- **Risk**: Without PKCE the intercepted code would be exchangeable; with PKCE the attacker still
  needs the verifier from the legit app's Keychain.
- **Defensive Abuse Scenario (high-level)**: Redirect hijack on Android; blocked by PKCE binding.
- **Prevention**: Prefer the verified `https` universal link; keep PKCE mandatory server-side.
- **Detection**: Server logs `PKCE_VERIFIER_REQUIRED/INVALID` (already mapped client-side).
- **Analysis (root cause)**: Custom schemes are inherently claimable; PKCE is the correct countermeasure.
- **Recommendation**: Confirm the server REQUIRES `code_verifier` for the mobile exchange (do not
  accept verifier-less exchange) and treat any verifier-less mobile exchange as a hard failure.
- **Tests To Add**: Server-side test rejecting mobile exchange without a valid verifier; client test
  that `startMobileOAuthSession` always persists a verifier before opening the browser.

### mobile-app-04 — `/api/mobile/iap/verify` is the trust boundary; client never grants entitlement (positive control)
- **Severity**: Info
- **Affected Area**: `iap.ts`, `subscription.tsx`.
- **Evidence**: All purchase/restore/reconcile paths POST the store proof to `/api/mobile/iap/verify`
  and only `finishTransaction` AND grant UI on `res.data.success` (`iap.ts:241-263, 364-372, 456-466`).
  Subscription display reads server `/api/profile` entitlement, not a client flag.
- **Risk**: Low — entitlement parity with web is server-enforced.
- **Recommendation**: Keep server-side receipt validation authoritative; ensure the verify endpoint
  rejects replayed/forged `signedTransaction`/`purchaseToken` (server-side concern). No client change.
- **Tests To Add**: Already partially covered (`iap.test.ts`, `iap-offers.test.ts`); add a test that a
  failed verify never calls `finishTransaction`.

### mobile-app-05 — No PII/secret logging or hardcoded secrets found (positive control)
- **Severity**: Info
- **Affected Area**: whole module.
- **Evidence**: Grep for token/password/secret logging and for `sk_live`/`AIza`/`client_secret`
  returned no real secrets; only labels/regex/comments. `analytics.ts:17-46` actively scrubs PII
  keys/values and emails before sending; `sentry.ts` runs `scrubObject` on tags/extra. The Geoapify
  key is server-side only (`TransitRouteMap.tsx:20`).
- **Recommendation**: Maintain the analytics PII regex and Sentry scrub on new fields.

### mobile-app-06 — Map image fetched via authenticated proxy (no SSRF/key leak) (positive control)
- **Severity**: Info
- **Evidence**: `TransitRouteMap.tsx` builds a path against the app's own `API_URL` and sends the
  Bearer token via image headers; coordinates are rounded; the server proxy holds the API key. No
  arbitrary host is fetched client-side.
- **Recommendation**: Ensure the server `/api/maps/static` validates/bounds coordinates server-side.

## 14. Performance Audit

- **No persisted query cache** by design (`query-client.ts`) — good for privacy; offline UX is
  bridged by the AsyncStorage snapshot helpers. `staleTime 60s`, `retry 1`, `offlineFirst`. Reasonable.
- **Batched analytics** with queue cap and re-queue cap to avoid memory leak (`analytics.ts:90-114`). Good.
- **IAP product prices fetched in one batched `fetchProducts`** call (`subscription.tsx:368-405`). Good.
- **`subscription.tsx` derives a large amount of state per render** (~1694 lines, many `useMemo`s);
  acceptable but a re-render hotspot on a single screen. Priority: Low.
- **Fonts**: ~20 font weights loaded on boot and the splash held until all resolve (`_layout.tsx:489-523`).
  Impact: larger first-load font payload / delayed first paint. The comment notes Fraunces/Geist are
  transitional ("reskin transition"). Recommendation: drop unused transitional faces once migration
  completes to cut boot cost. Priority: Low (Performance / also see §16).
- **Map tile caching**: width rounded to a single cache entry per route (`TransitRouteMap.tsx:96-107`). Good.

## 15. Reliability Audit

- **Error boundary** wraps the whole tree and reports to Sentry (`ErrorBoundary.tsx`, `_layout.tsx:532`). Good.
- **Forced + manual logout teardown unified** via `session-cleanup-hook` so an expired session can't
  leave prior-user PII (`auth-store.ts:131-147`, `_layout.tsx:478-481`). Strong.
- **IAP charged-but-unverified recovery**: cold-start `reconcilePendingPurchases` finishes/verifies
  pending transactions once per launch (`_layout.tsx:395-401`, `iap.ts:430-471`). Strong reliability design.
- **Timeouts** on every request (20s ApiClient, 12s `refreshUser`, 120s IAP purchase wait). Good.
- **Sentry environment mis-tagging** (see mobile-app-07): events from production builds may be tagged
  `development`, undermining triage. Reliability/observability gap.
- **`sentry.ts` SDK version hardcoded `"0.1.0"`** and release pulled from `expoConfig.version`
  ("1.0.2" in app.json) — acceptable but the SDK version string is meaningless for triage.
- **Offline caches** read back as `null` on any malformation (never crash) — good defensive posture.

### mobile-app-07 — Sentry/analytics environment + locale mis-reporting
- **Severity**: Low
- **Affected Area**: `sentry.ts:84` (`environment: process.env.NODE_ENV`), `SessionTracker.tsx:38` (`language:"en"`).
- **Evidence**: `sentry.ts` sets `environment` to `process.env.NODE_ENV` rather than the EAS profile
  (`EXPO_PUBLIC_ENV`), so prod crash events can be grouped under the wrong environment.
  `SessionTracker.getDeviceInfo` hardcodes `language:"en"` regardless of the user's actual locale
  (i18n supports en/es).
- **Risk**: Mis-bucketed crash data and inaccurate analytics locale; not a security issue.
- **Recommendation**: Source Sentry `environment` from `Constants.expoConfig.extra.environment ||
  EXPO_PUBLIC_ENV`; pass the resolved i18n locale into device info.
- **Tests To Add**: Unit test asserting `buildEvent().environment` reflects the configured env;
  device-info test asserting locale is propagated.

## 16. Dead Code / Cleanup

- **Transitional fonts (Fraunces, Geist, Geist Mono)** are loaded alongside the new face set
  (`_layout.tsx:489-511`) with a comment that they remain "during the reskin transition." If the
  reskin is complete these can be removed to cut bundle/boot cost. [needs verification — confirm no
  screen still references `fonts.serif*`/Geist before removing.]
- **`getPostAuthMobileRoute`** (`post-auth-route.ts`) ignores its argument and always returns
  `/onboarding` (`void user; return "/onboarding"`). This is intentional (OAuth-only users are not
  forced to setup-password; covered by `auth-navigation.test.ts`), but the param + `PostAuthMobileRoute`
  type union of a single value is now vestigial. Recommendation: simplify or document. Priority: Info.
- **`monthlySku`/`yearlySku` in `handleManageBilling` deps** (`subscription.tsx:806-808`) appear unused
  in the callback body after the comment change. [needs verification] Low.
- No abandoned routes detected; all 54 route files are reachable (tabs, stacks, deep links).

## 17. Tests

Existing (Vitest, `apps/mobile/src/**/__tests__` + co-located `*.test.ts`): broad unit coverage of
pure libs — `api.test.ts` (URL resolution incl. cleartext cases), `iap.test.ts`/`iap-offers.test.ts`,
`auth.test.ts`, `password-policy.test.ts`, `plan-comparison.test.ts`, `subscription-visible-plans.test.ts`,
`workspace-selection.test.ts`, `offline-cache.test.ts`, `release-config.test.ts`, `post-auth-route.test.ts`,
`mobile-oauth-handoff.test.ts`, etc.

Missing / critical scenarios:
- **AuthGuard routing state machine** (`_layout.tsx`): only `auth-navigation.test.ts` asserts a screen
  registration + a comment substring; the actual redirect logic (tokenless→sign-in, onboarding gating,
  notification routing, IAP reconcile guard) is untested. Suggest integration tests with mocked
  router/segments/auth-store.
- **`AppLockGate`** background-grace → lock → unlock flow and recovery sign-out — untested.
- **IAP purchase happy/failure path end-to-end** (verify-fail must not `finishTransaction`) — add.
- **`local-cleanup`** PII-key inventory and "no PII in plaintext storage" invariant — add (ties to mobile-app-01).
- **Deep-link OAuth double-handling** coalescing across the two entry points — partial in handoff test; add a race test.

## 18. Findings Summary

| ID | Severity | Category | Finding | Impact | Recommendation | Files |
|----|----------|----------|---------|--------|----------------|-------|
| mobile-app-01 | Medium | Security | PII snapshots/offline lists persisted to unencrypted AsyncStorage | Prior-user addresses/services/costs/plan readable on compromised device | Encrypt-at-rest or move to SecureStore; keep logout wipe | `offline-cache.ts`, `local-cleanup.ts`, `auth-store.ts` |
| mobile-app-02 | Low | Security | Cleartext HTTP allowed when `EXPO_PUBLIC_ENV=development` (LAN proxy) | Token/PII over plaintext if a non-dev artifact carries that env | Gate cleartext on `__DEV__` only; assert in release-config test | `api.ts` |
| mobile-app-03 | Low | Security | Custom-scheme OAuth callback can be intercepted (Android) | Mitigated by PKCE verifier in SecureStore | Require server-side `code_verifier`; prefer verified https link | `mobile-oauth.ts`, `pkce.ts`, `app.json` |
| mobile-app-04 | Info | Security | IAP entitlement granted only after server verify (positive) | Strong store↔web parity | Keep server receipt validation authoritative | `iap.ts`, `subscription.tsx` |
| mobile-app-05 | Info | Security | No secret/PII logging; analytics+Sentry scrub PII (positive) | Low leakage risk | Maintain scrub patterns on new fields | `analytics.ts`, `sentry.ts` |
| mobile-app-06 | Info | Security | Map proxy fetch is server-keyed, no SSRF/key leak (positive) | — | Bound coords server-side | `TransitRouteMap.tsx` |
| mobile-app-07 | Low | Reliability | Sentry env = NODE_ENV; analytics locale hardcoded "en" | Mis-bucketed crashes / wrong analytics locale | Source env from EAS profile; pass real locale | `sentry.ts`, `SessionTracker.tsx` |
| mobile-app-08 | Low | Test | AuthGuard routing + AppLockGate flows largely untested | Regressions in critical auth routing go uncaught | Add integration tests with mocked router/stores | `_layout.tsx`, `AppLockGate.tsx` |
| mobile-app-09 | Low | UI/UX | Hardcoded English strings on i18n screens | es users see English labels | Move literals to i18n keys | `addresses/[id]/index.tsx`, `subscription.tsx` |
| mobile-app-10 | Info | Dead Code | Transitional fonts + vestigial `getPostAuthMobileRoute` param | Bundle/boot cost; confusing API | Remove unused faces once reskin done; simplify helper | `_layout.tsx`, `post-auth-route.ts` |

## 19. Module TODO

- [ ] **mobile-app-01 (Medium)** Encrypt or relocate PII snapshots off plaintext AsyncStorage.
  Reason: data-at-rest exposure on compromised devices. Files: `offline-cache.ts`, `local-cleanup.ts`,
  dashboard/widget/last-plan snapshot writers, `auth-store.ts`. Fix: SecureStore-backed key to encrypt
  the envelope, or move to SecureStore; retain logout wipe. Dependencies: SecureStore size limits.
  Complexity: med. Risk of change: med.
- [ ] **mobile-app-02 (Low)** Restrict cleartext-HTTP exception to `__DEV__` only. Files: `api.ts`,
  `release-config.test.ts`. Fix: drop the `EXPO_PUBLIC_ENV==='development'` branch from prod-reachable
  code; add release-profile assertions. Dependencies: none. Complexity: low. Risk: low.
- [ ] **mobile-app-03 (Low)** Confirm server rejects verifier-less mobile OAuth exchange; prefer https
  universal link. Files: `mobile-oauth.ts`, `pkce.ts` (+ server). Fix: hard-require `code_verifier`.
  Dependencies: web API. Complexity: low (client). Risk: low.
- [ ] **mobile-app-07 (Low)** Fix Sentry `environment` + analytics `language`. Files: `sentry.ts`,
  `SessionTracker.tsx`. Fix: read env from `expoConfig.extra.environment`; pass resolved i18n locale.
  Dependencies: none. Complexity: low. Risk: low.
- [ ] **mobile-app-08 (Low)** Add integration tests for AuthGuard routing + AppLockGate. Files:
  `_layout.tsx`, `AppLockGate.tsx`, new tests. Fix: mock router/segments/stores; assert redirects.
  Dependencies: test harness for expo-router. Complexity: med. Risk: low.
- [ ] **mobile-app-09 (Low)** Localize remaining hardcoded English strings. Files: `addresses/[id]/index.tsx`,
  `subscription.tsx`, i18n message files. Complexity: low. Risk: low.
- [ ] **mobile-app-10 (Info)** Remove transitional fonts once reskin verified; simplify
  `getPostAuthMobileRoute`. Files: `_layout.tsx`, `post-auth-route.ts`. Complexity: low. Risk: low
  (verify no `fonts.serif*`/Geist references remain first).
```
