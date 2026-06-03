# LocateFlow Release Readiness TODO - Stripe, Plans, Mobile, Stores

Started: 2026-06-03

Scope: verify Stripe, entitlements, Individual/Family/Pro, mobile Android/Expo, Play Store/App Store readiness from real code/config/tests and safe local execution. Do not perform live charges, production rollout, secret rotation, external console re-auth, or irreversible production actions without explicit approval.

Status legend:
- [ ] Not started
- [~] In progress
- [x] Verified
- [!] Needs fix
- [BLOCKED] Blocked by real external dependency
- [SKIP] Intentionally skipped by safety rule

## 0. Source Reports And Baseline

- [x] Read requested historical QA report path.
  - Requested file `reports/stripe-plan-full-qa-2026-06-02.md` is not present.
  - Read equivalent committed report: `docs/audits/payments/stripe-plan-full-qa-2026-06-02.md`.
- [x] Read module audit payment/mobile/admin/connector reports under `reports/module-audit/`.
- [x] Confirm current worktree status before new edits.
- [x] Confirm current safety constraints: no production payment risk, no production Play Store rollout, no re-auth/secret rotation/irreversible action.

## 1. Real Code/Config Inspection

- [x] Shared plan definitions: `packages/shared/src/billing.ts`.
- [x] Effective entitlement resolver: `packages/shared/src/entitlement.ts`.
- [x] Workspace plan features and seat limits: `packages/shared/src/workspace-entitlements.ts`.
- [x] Web Stripe price mapping and entitlement snapshots: `apps/web/src/lib/billing.ts`.
- [x] Stripe checkout route: `apps/web/src/app/api/stripe/checkout/route.ts`.
- [x] Stripe change-plan route: `apps/web/src/app/api/subscription/change-plan/route.ts`.
- [x] Stripe switch-cycle route: `apps/web/src/app/api/subscription/switch-cycle/route.ts`.
- [x] Stripe subscription actions/cancel/resume route: `apps/web/src/app/api/subscription/actions/route.ts`.
- [x] Stripe webhook route: `apps/web/src/app/api/webhooks/stripe/route.ts`.
- [x] Connector sync entitlement: `apps/web/src/lib/connector-oauth.ts`.
- [x] Mobile IAP product endpoint: `apps/web/src/app/api/mobile/iap/products/route.ts`.
- [x] Mobile IAP verify endpoint: `apps/web/src/app/api/mobile/iap/verify/route.ts`.
- [x] IAP normalization and DB writer: `apps/web/src/lib/iap-common.ts`.
- [x] Google Play API client: `apps/web/src/lib/iap-google.ts`.
- [x] Apple App Store API client: `apps/web/src/lib/iap-apple.ts`.
- [x] Mobile subscription screen: `apps/mobile/app/settings/subscription.tsx`.
- [x] Mobile IAP bridge and offer handling: `apps/mobile/src/lib/iap.ts`, `apps/mobile/src/lib/iap-offers.ts`.
- [x] Mobile Expo/EAS config: `apps/mobile/app.json`, `apps/mobile/eas.json`, `apps/mobile/package.json`.
- [x] Mobile store submission/data inventories: `apps/mobile/STORE_SUBMISSION_CHECKLIST.md`, `apps/mobile/STORE_QA_CHECKLIST.md`, `apps/mobile/MOBILE_DATA_INVENTORY.md`.
- [x] Android native Gradle/config files.
- [x] Play/App Store screenshots/assets directory supplied by user.
  - Found `C:\Users\Kutay\Downloads\locateflow-20260602T141618Z-3-001`.
  - Opened sample `01_Manage_Your_Move_1284x2778.jpg`; no upload/submission action taken.

## 2. Static Findings To Verify With Tests

- [x] Individual, Family, Pro are all paid plans in shared billing.
- [x] Public plan definitions contain expected monthly/yearly labels.
- [x] Family seat limit is 6; Pro seat limit is 10.
- [x] API connector sync is Pro-only at feature-matrix level.
- [x] API connector sync additionally requires active access and annual Pro, except admin manual override.
- [x] Mobile IAP product mapping supports all six plan/cycle SKUs for iOS and Android.
- [x] Mobile store purchases are disabled in development/preview and enabled in production EAS profile.
- [x] Mobile blocks web Stripe checkout from native app client.
- [x] Verify web pricing page renders Individual/Family/Pro and monthly/annual tabs in a live or local browser.
  - Live `https://locateflow.com/pricing`: Annual default shows Individual/Family/Pro; Monthly tab also shows all three.
  - Pro Annual copy includes partner connection/guided handoff language instead of unconditional auto-submit.
- [x] Verify web settings subscription UI renders current plan and plan-change controls.
  - Live `https://locateflow.com/settings/subscription`: logged-in customer sees Free Access ended state, Monthly/Annual tabs, Individual/Family/Pro cards.
  - Terms checkbox gates checkout; clicking Pro upgrade before terms does not open checkout and surfaces the terms error.
  - Live charge/checkout completion intentionally not performed.
- [x] Verify paid plan/cycle mutation APIs enforce explicit terms acceptance server-side.
  - Fixed `/api/subscription/change-plan` and `/api/subscription/switch-cycle` so direct API calls without `acceptedSubscriptionTerms: true` return `TERMS_NOT_ACCEPTED` before Stripe mutation.
  - Updated web UI payloads and Individual billing-cycle switch UI to require/send the same acceptance.
- [x] Verify admin UI can observe plan/status/provider/interval/pending plan.
  - Focused admin tests passed for subscription/user actions/settings/runtime-config.
  - Live admin connectors page shows deployed expanded sidebar plus connector metrics/catalog state.
- [x] Verify live Google Places autocomplete/details runtime path for an authenticated QA user.
  - Exact QA signup/login path produced a live bearer token.
  - `GET /api/address-autocomplete?input=123%20Main&sessionToken=qa_session_20260603` returned `enabled: true` with 5 predictions.
  - `GET /api/address-autocomplete/details` using the first returned `placeId` returned `enabled: true` with a resolved result.
  - The QA bearer logout path succeeded with `x-client-type: mobile`, and the next QA login returned HTTP 401, confirming the hard-reset cleanup still works.

## 3. Automated Test Matrix

- [x] Run focused shared billing/entitlement/workspace tests.
- [x] Run focused web billing tests:
  - `apps/web/src/lib/billing.test.ts`
  - `apps/web/src/lib/billing-config.test.ts`
  - `apps/web/src/lib/connector-oauth.test.ts`
  - `apps/web/src/lib/iap-common.test.ts`
  - `apps/web/src/app/api/stripe/checkout/route.test.ts`
  - `apps/web/src/app/api/stripe/checkout/cancel/route.test.ts`
  - `apps/web/src/app/api/subscription/change-plan/route.test.ts`
  - `apps/web/src/app/api/subscription/switch-cycle/route.test.ts`
  - `apps/web/src/app/api/subscription/actions/route.test.ts`
  - `apps/web/src/app/api/webhooks/stripe/route.test.ts`
  - `apps/web/src/app/api/webhooks/appstore/route.test.ts`
  - `apps/web/src/app/api/webhooks/playstore/route.test.ts`
  - `apps/web/src/app/api/mobile/iap/products/route.test.ts` if present
  - `apps/web/src/app/api/mobile/iap/verify/route.test.ts` if present
- [x] Run focused workspace/family invite/sync tests.
- [x] Run focused mobile IAP tests.
- [x] Run admin billing/runtime-config tests.
- [x] Run root typecheck.
- [x] Run root test suite.

## 4. Stripe Checkout Completion Matrix

Safety rule: use only test-mode/staging Stripe customer and test cards. Do not complete a live charge.

Current live environment is production. Completing any checkout would create production payment risk, so all charge-completion rows remain blocked until a Stripe test-mode/staging customer/catalog is available.

- [ ] Individual monthly checkout creates Stripe Checkout and activates Individual Monthly after webhook.
- [ ] Individual yearly checkout creates Stripe Checkout/trial and activates Individual Annual after webhook.
- [ ] Family monthly checkout creates Stripe Checkout and activates Family Monthly after webhook.
- [ ] Family yearly checkout creates Stripe Checkout and activates Family Annual after webhook.
- [ ] Pro monthly checkout creates Stripe Checkout and activates Pro Monthly; API sync remains unavailable.
- [ ] Pro yearly checkout creates Stripe Checkout and activates Pro Annual; API sync becomes available when connector feature/catalog is enabled.
- [ ] Checkout cancel restores usable subscription/free state and does not leave stuck pending checkout.
- [ ] Declined card/failure does not activate premium and surfaces recoverable billing state.
- [ ] Duplicate checkout for an active paid subscription is blocked or routes to billing recovery.
- [ ] Store-managed active subscription blocks web Stripe checkout.
- [BLOCKED] Historical report says Stripe test-mode catalog is incomplete/incorrect; re-verify before test-card completion.
- [SKIP] Live Stripe checkout completion skipped by safety rule: production payment risk.

## 5. Stripe Plan Change And Downgrade Matrix

Expected behavior from code:
- Upgrades and same-tier Month -> Year apply immediately with Stripe proration.
- Downgrades and same-tier Year -> Month are scheduled at period end.
- No data loss; seat reconciliation is best-effort after owner entitlement changes.

Code/test verification completed for immediate vs scheduled behavior. Full end-to-end Stripe subscription mutation against live Billing was not executed because it would touch production customer/subscription state.

- [ ] Individual Monthly -> Individual Annual: immediate.
- [ ] Individual Annual -> Individual Monthly: scheduled.
- [ ] Individual Monthly -> Family Monthly: immediate.
- [ ] Individual Monthly -> Family Annual: immediate.
- [ ] Individual Annual -> Family Monthly: immediate.
- [ ] Individual Annual -> Family Annual: immediate.
- [ ] Individual Monthly -> Pro Monthly: immediate; sync unavailable.
- [ ] Individual Monthly -> Pro Annual: immediate; sync available.
- [ ] Individual Annual -> Pro Monthly: immediate; sync unavailable.
- [ ] Individual Annual -> Pro Annual: immediate; sync available.
- [ ] Family Monthly -> Family Annual: immediate.
- [ ] Family Annual -> Family Monthly: scheduled.
- [ ] Family Monthly -> Individual Monthly: scheduled.
- [ ] Family Monthly -> Individual Annual: scheduled.
- [ ] Family Annual -> Individual Monthly: scheduled.
- [ ] Family Annual -> Individual Annual: scheduled.
- [ ] Family Monthly -> Pro Monthly: immediate.
- [ ] Family Monthly -> Pro Annual: immediate; sync available.
- [ ] Family Annual -> Pro Monthly: immediate.
- [ ] Family Annual -> Pro Annual: immediate; sync available.
- [ ] Pro Monthly -> Pro Annual: immediate; sync becomes available.
- [ ] Pro Annual -> Pro Monthly: scheduled; sync remains until period end, then removed.
- [ ] Pro Monthly -> Family Monthly: scheduled.
- [ ] Pro Monthly -> Family Annual: scheduled.
- [ ] Pro Annual -> Family Monthly: scheduled.
- [ ] Pro Annual -> Family Annual: scheduled.
- [ ] Pro Monthly -> Individual Monthly: scheduled.
- [ ] Pro Monthly -> Individual Annual: scheduled.
- [ ] Pro Annual -> Individual Monthly: scheduled.
- [ ] Pro Annual -> Individual Annual: scheduled.
- [ ] Same plan + same interval is rejected as no-op.
- [ ] Pending downgrade banner appears on web subscription UI.
- [ ] Pending downgrade state appears in admin UI.
- [SKIP] Live plan mutation/downgrade execution skipped by safety rule: production payment risk.

## 6. Family Plan Functional Matrix

- [x] Family owner sees workspace/family management entry points.
  - Code/UI inspection: `/settings/workspace` shows workspace management when workspace model is enabled and the owner has a shared plan.
- [x] Family owner can send an invite.
  - Route/test verification: invite POST requires owner/admin role, paid shared plan, rate limit, valid email, and Serializable seat re-check.
- [x] Invite email/API response is generated without leaking raw token in production UI/log output.
  - Route inspection: plaintext invite URL is returned only when `NODE_ENV !== "production"` and email sending failed; production response exposes only token last4.
- [x] Invited member can accept and joins correct workspace.
  - Route/test verification: accept requires matching signed-in email, pending/unexpired invite, workspace existence, and Serializable seat check.
- [x] Member role cannot manage billing.
  - Permission matrix keeps `billing.manage` owner-only; workspace members/admins do not inherit billing ownership.
- [x] Owner/admin can remove or revoke member/invite.
  - Member remove/role tests verify owner/admin boundaries; invite revoke route is present and manager-gated.
- [x] Family member cap is enforced.
  - Family limit is 6; invite creation and invite acceptance both re-check used seats.
- [x] Family -> Individual downgrade preserves access until period end.
  - Change-plan matrix schedules Family -> Individual reductions at Stripe period end rather than demoting immediately.
- [x] After effective Individual downgrade, Family-only write paths are hidden or blocked.
  - Seat reconciliation demotes overflow members to `OVERFLOW`; permission matrix makes suspended/overflow members read-only.
- [BLOCKED] Mobile displays active Family plan as current account state.
  - Mobile QA auth/onboarding is no longer blocked: exact QA signup auto-verifies, dashboard loads, and `More -> Subscription` opens on Android.
  - Granting a live Family/Pro paid entitlement for the QA account still requires admin step-up/production subscription mutation; this was not bypassed.

## 7. Pro Sync/Connector Matrix

- [x] Code inspection: Pro annual is required for API connector entitlement.
- [x] Code inspection: Pro monthly does not unlock API sync.
- [x] API sync action requires active partner consent.
- [x] Disconnect/revoke clears stored token and queued/in-flight dispatches.
- [x] Workspace sync verifies workspace address ownership and non-deleted address.
- [x] Workspace on-behalf sync verifies target member is active and in same workspace.
- [x] Team owner/admin does not see member tokens; member consent is used for that member.
- [x] Partner API absent falls back to guided/manual update, not auto-submit.
- [x] Admin connector UI accurately shows registered/enabled/circuit-open state.
  - Live admin page: Supported 1, Registered 0, Enabled 0, API sync ready 0; built-in USPS catalog row visible; no registered control-plane row yet.
- [x] Client connections UI matches entitlement and catalog state.
  - Live client `https://locateflow.com/settings/connections`: no partner connections available because connector catalog/control-plane is not enabled.
  - This matches live admin connectors state: supported USPS adapter exists, but no registered/enabled control-plane row exists yet.

## 8. Mobile Android/Expo/Play Store Matrix

- [x] Locate Android SDK and adb.
  - SDK: `C:\Users\Kutay\AppData\Local\Android\Sdk`; device: `emulator-5554`.
- [x] Locate Android emulators.
  - AVDs: `Pixel_10_Pro`, `Pixel_7a`.
- [x] Boot emulator if needed.
  - Used running `Pixel_7a`.
- [x] Check whether Expo Orbit is installed/running.
  - No Orbit process found in current process list.
- [x] Install/run app locally on Android through Expo/dev client or Gradle.
  - Gradle `:app:installDebug` succeeded after native Expo host and Gradle memory fixes.
- [x] If build fails, classify the blocker without weakening TLS/SSL checks.
  - Initial Gradle wrapper/Maven TLS was local Java truststore issue; fixed by temporary Java truststore import from Windows roots, no repo/system TLS weakening.
  - Initial app RedBox was `expo-updates` initialization order; fixed by using `ExpoReactHostFactory`.
- [x] Launch app on emulator.
- [x] Capture UI tree and screenshot evidence.
  - `C:\Users\Kutay\AppData\Local\Temp\locateflow-android-after-fix.png`.
  - `C:\Users\Kutay\AppData\Local\Temp\locateflow-android-signup-password-rules-expanded.png`.
- [x] Verify sign-in screen or signed-in state.
  - Sign-in renders, Google button active, Apple unavailable on Android, email/password controls present.
  - Backend mobile login API returned HTTP 200 for the test user; token not recorded in this report.
- [x] Verify subscription screen loads current backend plan.
  - Live QA reset flow verifies the exact `QA_RESETTABLE_ACCOUNT_EMAIL` account on signup and hard-resets it on logout; malformed/multi-email values are inert.
  - Android emulator signed in through the local QA proxy, completed onboarding via live mobile APIs, reached Home, then opened `More -> Subscription`.
  - Mobile subscription UI showed the live backend account state as `Free Access` / `FREE_ACCESS` with the store-disabled notice.
  - Exact QA lifecycle was verified live: signup 201/auto-verified, login 200, profile/address/service/onboarding writes 200/201, logout 200, old login 401, re-signup 201, clean onboarding step `profile`.
- [BLOCKED] Verify mobile shows read-only Stripe-managed state for web subscriptions.
  - Authenticated, verified, onboarding-complete mobile session is working.
  - Applying a live admin Pro/Stripe-managed grant for the QA account requires the admin step-up modal (admin password plus MFA/backup code); this was not bypassed.
- [x] Verify Android IAP product fetch path handles missing/unavailable store products gracefully.
  - Code/tests verify Android offer-token handling and safe failure when offerToken is missing.
  - Current dev/preview launch logs Android IAP disabled and subscription screen is expected read-only.
- [x] Verify Android logcat has no billing/subscription crash.
  - No billing/subscription crash observed during launch/sign-in/sign-up UI checks.
- [x] Verify production EAS profile has Play IAP flags enabled.
  - `eas.json` production and `play-internal` set mobile store purchases true; preview/development stay false.
- [x] Verify Family/Pro plan cards are visible in local Android QA when mobile purchases are disabled.
  - Found and fixed a mobile UI visibility gap where native store-disabled builds hid Family/Pro because those tiers are not app-store-purchasable in that build.
  - Added a small shared visibility helper and focused tests so store-disabled builds still show Individual/Family/Pro while keeping purchase actions read-only/disabled.
  - Rebuilt and reinstalled `debugOptimized`; emulator screenshots verified Individual, Family, and Pro cards plus the correct read-only copy.
- [x] Fix local Android emulator QA path without weakening production transport.
  - Added debug-only Android network security config for `10.0.2.2`/`localhost`.
  - Added a production-build guard exception that permits `http://10.0.2.2:<port>/api` only when `EXPO_PUBLIC_ENV=development`; production EAS remains HTTPS-only.
  - Added mobile API tests for production HTTPS fallback and local emulator proxy allowance.
- [x] Fix `debugOptimized` embedded bundle QA build.
  - Added `debuggableVariants = ["debug"]` so React Native embeds the JS bundle for `debugOptimized`; this removed the local RedBox caused by missing `assets/index.android.bundle`.
- [x] Build Android Play internal AAB through EAS.
  - Started EAS build `9d3c92a9-5e58-4eac-ba12-79bd63065081` with profile `play-internal`; this is a store-distribution AAB build, not a Play rollout/submission.
  - EAS used remote Android credentials and incremented remote versionCode from 14 to 15.
  - Final status: `FINISHED`; artifact exists. Build page: `https://expo.dev/accounts/axtra-solutions-llc/projects/locateflow/builds/9d3c92a9-5e58-4eac-ba12-79bd63065081`.
- [x] Fix Android native manifest drift vs `app.json`: removed stale `locateflow.app` / `app.locateflow.com` app-link hosts, added `/invitations`, added Android 13+ `POST_NOTIFICATIONS` permission.
- [x] Fix Expo app config drift: added `android.permission.POST_NOTIFICATIONS` to `apps/mobile/app.json` permissions.
- [x] Verify `/api/mobile/iap/products` returns all six iOS and Android plan/cycle IDs.
- [x] Verify Play Console subscription product IDs against `/api/mobile/iap/products` only if already authenticated and no re-auth is required.
  - Play Console subscriptions page shows all six Android product IDs: Individual/Family/Pro monthly/yearly.
  - Each subscription shows one active base plan.
  - Live product endpoint returns the full Individual/Family/Pro monthly/yearly map for both stores.
  - No Play rollout/submission was performed.
- [BLOCKED] Do not perform production Play Store rollout.

## 9. Store Submission Readiness

- [x] Verify App Store/Play product IDs match Runtime Config product IDs without printing secrets.
  - Live `/api/mobile/iap/products` returns Individual/Family/Pro monthly/yearly for both platforms.
  - DigitalOcean app spec uses the code-defined monthly keys (`MOBILE_IOS_PRODUCT_INDIVIDUAL`, `MOBILE_ANDROID_PRODUCT_PRO`, etc.) plus yearly keys; all six iOS and all six Android product IDs are present.
- [x] Verify Apple App Store Server API config presence; missing credential is a blocker.
  - DigitalOcean app spec/admin Runtime Config show `APPLE_BUNDLE_ID`, Apple App Store issuer/key/private key/environment present from ENV; values intentionally not recorded.
- [x] Verify Google Play Developer API config presence; missing credential is a blocker.
  - DigitalOcean app spec shows Android product IDs, `GOOGLE_PLAY_PACKAGE_NAME`, and `GOOGLE_PLAY_RTDN_AUDIENCE` present.
  - Android Publisher API is enabled in Google Cloud.
  - Google Play service account was created and granted active LocateFlow app access in Play Console.
  - Service-account JSON key creation is blocked by Google organization policy `iam.disableServiceAccountKeyCreation`; no private key was downloaded or added to DigitalOcean.
  - DigitalOcean app spec now includes `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL` and `EXPECTED_PLAYSTORE_WEBHOOK_SERVICE_ACCOUNT_EMAIL`; values intentionally not recorded.
  - DigitalOcean app spec still does not show `GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY` or `EXPECTED_PLAYSTORE_WEBHOOK_SUBJECT`.
  - Implemented and deployed minimal OAuth refresh-token fallback for Android Publisher auth; existing service-account private-key path remains unchanged.
  - DigitalOcean now includes `GOOGLE_PLAY_OAUTH_CLIENT_ID`, `GOOGLE_PLAY_OAUTH_CLIENT_SECRET`, and `GOOGLE_PLAY_OAUTH_REFRESH_TOKEN`; values intentionally not recorded.
  - Live fake-token Android purchase verification returns JSON HTTP 424 `IAP_PROVIDER_UNAVAILABLE`, not `IAP_NOT_CONFIGURED`, and no secret-like values in the response.
  - Play RTDN fake-bearer smoke now returns 401 invalid-token class instead of the previous missing-identity 503.
  - Pub/Sub API is enabled, topic `play-rtdn` exists, and Google Play's notification service account has Publisher on the topic.
  - Play Console RTDN topic value is now saved to `projects/project-20494d44-c9e3-4fc2-9f4/topics/play-rtdn`.
  - Pub/Sub push subscription `play-rtdn-locateflow-webhook` is active on topic `play-rtdn`.
  - Push endpoint is `https://locateflow.com/api/webhooks/playstore`.
  - Push OIDC service account and audience match DigitalOcean `EXPECTED_PLAYSTORE_WEBHOOK_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PLAY_RTDN_AUDIENCE`; values intentionally not recorded.
  - No redeploy/restart was needed because DigitalOcean env already matched the final RTDN identity.
  - Invalid RTDN tests fail closed: missing bearer returns HTTP 401 `Missing OIDC token`; fake bearer returns HTTP 401 `Invalid OIDC token`.
  - Valid RTDN-format payload published through Google Cloud Pub/Sub delivered to the live webhook with OIDC; DigitalOcean logs showed `[PLAYSTORE WEBHOOK] received TEST notification`.
  - Play Console's own "Send test notification" path redirected to a Play Console Terms of Service acceptance page; Codex did not accept legal terms on the user's behalf.
- [BLOCKED] Verify App Review notes include IAP navigation path and demo account.
  - Checklist requires a reviewer sandbox/demo account and IAP path (`More -> Subscription` or `More -> Settings -> Subscription`); console submission/re-auth was not performed.
- [BLOCKED] Verify Google Data Safety and Apple Privacy forms match `MOBILE_DATA_INVENTORY.md`.
  - Source inventory exists, but final console form submission/confirmation requires store-console review.
- [x] Verify Android account deletion URL and privacy URL are live.
  - Code/config points to `https://locateflow.com`; public API/web checks succeeded for live host.
- [x] Verify Sentry/native crash reporting decision for v1.
  - DigitalOcean app spec includes `NEXT_PUBLIC_SENTRY_DSN` and now has a populated `EXPO_PUBLIC_SENTRY_DSN`.
  - Mobile code uses the lightweight Sentry envelope path for captured app errors.
  - Native crash capture through `@sentry/react-native` is still not integrated; this is acceptable for v1 only if lightweight JS-level reporting is the intended launch posture.

## 10. Execution Log

- 2026-06-03: Created TODO after reading historical QA report and real billing/mobile code paths.
- 2026-06-03: Fixed Android native manifest drift so existing native project matches release deep-link/privacy expectations.
- 2026-06-03: Focused web billing/workspace/IAP tests passed: 14 files / 202 tests.
- 2026-06-03: Focused admin billing/runtime/connector tests passed: 11 files / 67 tests.
- 2026-06-03: Focused mobile IAP offer test passed: 1 file / 5 tests.
- 2026-06-03: Shared entitlement/workspace tests passed: 3 files / 29 tests.
- 2026-06-03: Root typecheck passed.
- 2026-06-03: Root test suite passed: web 191 files / 1414 tests, admin 89 files / 480 tests, mobile 9 files / 21 tests, connectors 13 files / 87 tests.
- 2026-06-03: Android build/install initially failed with Gradle memory and Expo Updates initialization; fixed Gradle metaspace and switched MainApplication to `ExpoReactHostFactory`.
- 2026-06-03: Android app launches on emulator and renders sign-in/sign-up screens without RedBox.
- 2026-06-03: Live public pricing verified in Chrome: Individual/Family/Pro visible on Monthly and Annual tabs.
- 2026-06-03: Live client subscription page verified in Chrome: Free Access ended state, plan cards, annual Pro sync copy, and terms gate.
- 2026-06-03: Live admin connectors page verified in Chrome: expanded sidebar deployed, USPS catalog row visible, no registered control-plane connector rows yet.
- 2026-06-03: Live `/api/mobile/iap/products` returns all six iOS and Android product IDs.
- 2026-06-03: Live `/api/mobile/auth/login` returned 200 for the test account; bearer token intentionally not recorded.
- 2026-06-03: Added mobile sign-up password policy feedback and shared mobile password rule helper; focused mobile tests passed: 2 files / 7 tests.
- 2026-06-03: Mobile typecheck passed after sign-up/password policy and app config changes.
- 2026-06-03: Full root test suite passed after the final mobile fixes: web 191 files / 1414 tests, admin 89 files / 480 tests, mobile 10 files / 23 tests, connectors 13 files / 87 tests.
- 2026-06-03: Dirty worktree review created at `reports/current-dirty-worktree-review-2026-06-03.md`; no secrets found in changed files.
- 2026-06-03: Baseline verification passed again: `git diff --check`, `pnpm verify:typecheck`, `pnpm verify:tests`, `pnpm lint`, `pnpm build`, `pnpm db:generate`, `prisma validate` with `DATABASE_URL` loaded from local env, and `pnpm verify:ci`.
- 2026-06-03: Known environment warning remains: repository expects Node 22.x, local machine is Node v24.12.0.
- 2026-06-03: Fixed direct API terms bypass for paid plan changes and billing-cycle switches; focused web tests passed: 8 files / 113 tests, then 2 payment route files / 44 tests.
- 2026-06-03: Live client connections and admin connectors were consistent: USPS supported in code, no registered/enabled connector control-plane row, client catalog empty.
- 2026-06-03: DigitalOcean app spec was checked without printing values: Stripe Family/Pro prices, Apple App Store keys, mobile product IDs, and Android package name exist; Google Play service account/RTDN keys and `FEATURE_API_CONNECTORS` are absent.
- 2026-06-03: Re-checked DigitalOcean with the exact code-defined mobile product key names; all iOS/Android product IDs are present, while Google Play Developer API/RTDN credential keys remain absent.
- 2026-06-03: EAS Play internal Android AAB build started: `9d3c92a9-5e58-4eac-ba12-79bd63065081`, versionCode 15, remote credentials, no Play rollout.
- 2026-06-03: EAS Play internal Android AAB build finished successfully; artifact exists, no Play rollout/submission was performed.
- 2026-06-03: Post-fix verification passed: `pnpm verify:typecheck`, `pnpm verify:tests`, and `pnpm lint`.
- 2026-06-03: Local Android emulator QA was unblocked with a debug-only `10.0.2.2` proxy path and `debugOptimized` embedded bundle fix; focused mobile tests passed: 10 files / 25 tests, mobile typecheck passed.
- 2026-06-03: Mobile onboarding still blocks the fake QA account at email verification before subscription UI; token recovery is intentionally impossible because tokens are hashed and EmailLog stores no body.
- 2026-06-03: DigitalOcean app spec rechecked: Apple Store Server keys and all mobile product IDs are present; Google Play service account email/private key and RTDN expected identity are still absent.
- 2026-06-03: Live `/api/ready` returned ready; live `/api/mobile/iap/products` returned all iOS/Android plan-cycle IDs; Play RTDN smoke with fake bearer returned a 503 class failure consistent with missing expected identity/backend readiness.
- 2026-06-03: Final pre-commit verification passed again: `git diff --check`, `pnpm verify:typecheck`, and `pnpm verify:tests` (web 191 files / 1416 tests, admin 89 files / 480 tests, mobile 10 files / 25 tests, connectors 13 files / 87 tests).
- 2026-06-03: Added deployment-only `QA_RESETTABLE_ACCOUNT_EMAIL` guard: exact QA account auto-verifies on signup and hard-resets itself on logout; malformed/multi-email values are inert. Verification passed: `pnpm verify:typecheck` and `pnpm verify:tests` (web 192 files / 1430 tests, admin 89 files / 481 tests, mobile 10 files / 25 tests, connectors 13 files / 87 tests).
- 2026-06-03: Added exact-QA signup self-reset fallback so a stale `mobile.qa@locateflow.com` account can be cleaned and recreated even when no active session exists to trigger logout reset; normal existing accounts still return 409. Verification passed: focused auth/QA tests (3 files / 29 tests), `git diff --check`, `pnpm verify:typecheck`, and `pnpm verify:tests` (web 192 files / 1436 tests, admin 89 files / 481 tests, mobile 11 files / 29 tests, connectors 13 files / 87 tests).
- 2026-06-03: Android emulator app launch instability was traced to low-memory killer pressure on the 2GB AVD; relaunching the same AVD with 4GB memory stabilized local QA.
- 2026-06-03: Live QA account lifecycle verified through mobile APIs: reset-on-logout, re-register, auto-verify, login, legal/profile/address/onboarding completion; bearer token intentionally not recorded.
- 2026-06-03: Android QA used a local `10.0.2.2` proxy because the emulator trust store rejects the live TLS chain; production transport remains HTTPS-only.
- 2026-06-03: Android emulator reached Home and opened `More -> Subscription`; the screen loaded live `Free Access` / `FREE_ACCESS` backend state and the mobile purchases disabled notice.
- 2026-06-03: Fixed mobile subscription plan visibility so native store-disabled builds still show Individual/Family/Pro cards while keeping Family/Pro read-only; focused mobile tests and mobile lint passed.
- 2026-06-03: Rebuilt and reinstalled Android `debugOptimized` after stopping a stale Gradle daemon/file lock; emulator verified Individual, Family, and Pro cards plus read-only Family/Pro copy.
- 2026-06-03: Active Pro Annual mobile state was attempted but remains blocked by real external controls: admin plan grant requires admin password plus MFA/backup code, and direct local DB access to the DigitalOcean database is blocked by network/firewall.
- 2026-06-03: Final verification after the mobile Family/Pro visibility fix passed: `git diff --check`, focused mobile tests 2 files / 7 tests, mobile lint, `pnpm verify:typecheck`, `pnpm verify:tests` (web 192 files / 1432 tests, admin 89 files / 481 tests, mobile 11 files / 29 tests, connectors 13 files / 87 tests), and root `pnpm lint`.
- 2026-06-03: Play Console subscriptions were verified against live `/api/mobile/iap/products`: all six Android product IDs exist and each has one active base plan; no Play rollout/submission was performed.
- 2026-06-03: Google Cloud Android Publisher API and Pub/Sub API were enabled; service account `locateflow-play-api` was created, granted app-scoped Play access, and Pub/Sub topic `play-rtdn` was created with Google Play Publisher access.
- 2026-06-03: Google service-account key creation was blocked by organization policy `iam.disableServiceAccountKeyCreation`; no JSON key was downloaded, so Android paid IAP verification needed keyless auth or policy-approved credential provisioning.
- 2026-06-03: Play RTDN topic value was initially not saved in Play Console and no push subscription was created because Chrome input automation could not reliably write the custom console field; later steps completed the topic save and push subscription.
- 2026-06-03: Added register response fields for auto-verified QA accounts and updated mobile sign-up to immediately create a mobile session when the backend reports no verification requirement; normal users still go through email verification.
- 2026-06-03: Final validation for this patch passed: `git diff --check`, focused register route test 14/14, mobile tests 11 files / 29 tests, mobile lint, `pnpm verify:typecheck`, `pnpm verify:tests`, root `pnpm lint`, root `pnpm build`, `pnpm verify:ci`, and `expo-doctor` 18/18 with Node system CA enabled.
- 2026-06-03: DigitalOcean deployment `a6292036-a3ba-4544-ad0b-b176bdbc128d` for commit `0f70be4` became ACTIVE. Live smoke passed: `/api/ready` HTTP 200, `/api/mobile/iap/products` HTTP 200, and `/api/auth/register` now returns `emailVerified` plus `requiresEmailVerification` fields for a normal smoke signup.
- 2026-06-03: DigitalOcean deployment `e5551dea-9d04-426d-afdd-5c22a545ea3f` for commit `da3f291` became ACTIVE; exact QA signup self-reset is live.
- 2026-06-03: DigitalOcean app-spec update deployment `e6aa96d0-19c0-42d8-81a5-fa7329a2c28c` became ACTIVE; `EXPO_PUBLIC_SENTRY_DSN`, `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL`, and `EXPECTED_PLAYSTORE_WEBHOOK_SERVICE_ACCOUNT_EMAIL` are present with values, while `GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY` remains absent due Google org policy.
- 2026-06-03: Post-env live smoke passed: `/api/ready` HTTP 200, `/api/mobile/iap/products` HTTP 200, and Play RTDN fake bearer returned HTTP 401 invalid-token class rather than missing expected identity.
- 2026-06-03: Live QA cleanup completed after Android testing: exact QA signup 201, login 200, mobile-style logout 200, and post-logout login 401; Android app data was cleared.
- 2026-06-03: Added and deployed minimal Google Play OAuth refresh-token fallback while keeping service-account private-key auth unchanged; focused web/admin tests passed.
- 2026-06-03: DigitalOcean OAuth env update completed without printing secrets; temporary local OAuth/spec files were removed after deployment.
- 2026-06-03: Deployments for commits `809d75e`, `478c00f`, and `b2212a4` became ACTIVE.
- 2026-06-03: Live post-deploy smoke passed: `/api/ready` HTTP 200 ready=true, `/api/mobile/iap/products` HTTP 200 with six unique iOS and Android products, fake Android purchase verify HTTP 424 JSON `IAP_PROVIDER_UNAVAILABLE`, not `IAP_NOT_CONFIGURED`.
- 2026-06-03: Play Console RTDN topic value was saved; Google Cloud Pub/Sub push subscription creation was then blocked by missing `pubsub.subscriptions.create` / `serviceusage.services.list` permission for the signed-in account until the user added the required IAM roles.
- 2026-06-03: Post-report validation passed: `pnpm verify:typecheck`, `pnpm verify:tests` (web 194 files / 1445 tests, admin 89 files / 486 tests, mobile 11 files / 29 tests, connectors 13 files / 87 tests), and `pnpm lint`.
- 2026-06-03: Google Cloud Pub/Sub push subscription `play-rtdn-locateflow-webhook` was created for topic `play-rtdn` with endpoint/audience `https://locateflow.com/api/webhooks/playstore` and the expected Play API service account.
- 2026-06-03: DigitalOcean RTDN env matched the final Google Cloud OIDC identity, so no redeploy/restart was needed.
- 2026-06-03: Live RTDN invalid-path tests passed: missing bearer returned HTTP 401 `Missing OIDC token`; fake bearer returned HTTP 401 `Invalid OIDC token`.
- 2026-06-03: Live RTDN valid push path passed by publishing an RTDN-format test payload through Google Cloud Pub/Sub; DigitalOcean run logs showed `[PLAYSTORE WEBHOOK] received TEST notification`.
- 2026-06-03: Play Console direct test notification remains human-gated by Play Console Terms of Service acceptance; no Terms acceptance, Play rollout, production release, or live payment was performed.
- 2026-06-03: Live Google Places smoke passed with the exact QA account: register auto-verified, mobile login returned a bearer token, `/api/address-autocomplete` returned `enabled=true` with 5 predictions, `/api/address-autocomplete/details` returned `enabled=true` with a resolved result, and logout hard-reset the QA account so the next login returned HTTP 401.
- 2026-06-03: DigitalOcean app spec rechecked after the Places/QA smoke: `FEATURE_API_CONNECTORS` is still absent, which matches the live admin/client connector UI state.
- 2026-06-03: Full validation rerun after the Places/report updates passed: `git diff --check`, `pnpm verify:typecheck`, `pnpm verify:tests` (web 194 / 1445, admin 89 / 486, mobile 11 / 29, connectors 13 / 87), `pnpm lint`, `pnpm build`, and `pnpm verify:ci`. Local Node engine warning remains: repo expects Node 22.x, machine is Node v24.12.0.
