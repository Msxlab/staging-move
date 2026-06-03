# LocateFlow Release Readiness Final Report - 2026-06-03

## Scope

Verified Stripe plan logic, Individual/Family/Pro entitlement behavior, Pro annual connector gating, mobile Android/Expo readiness, DigitalOcean runtime configuration presence, and safe store-readiness checks.

No live card charge, production subscription mutation, Play/App Store rollout, secret rotation, or irreversible console action was performed.

## Fixes Applied

- Hardened web subscription mutation APIs:
  - `/api/subscription/change-plan`
  - `/api/subscription/switch-cycle`
  - Direct API calls now require `acceptedSubscriptionTerms: true` before Stripe mutation.
- Updated web subscription UI to send explicit terms acceptance for plan changes and billing-cycle switches.
- Fixed Android native release drift:
  - Android app links now match `locateflow.com` only and include `/invitations`.
  - Added Android 13+ `POST_NOTIFICATIONS`.
  - Increased Gradle JVM/metaspace for local native builds.
  - Switched Android React host to `ExpoReactHostFactory`, fixing the Expo Updates initialization RedBox.
- Added shared mobile password policy helper and live sign-up password rule feedback.
- Added deployment-safe QA signup handoff:
  - Register API now returns whether the new account is already verified.
  - Mobile sign-up creates a session immediately only when the backend reports no email-verification requirement.
  - Normal users still go through email verification.
- Fixed mobile subscription plan visibility so store-disabled Android QA builds still show Individual, Family, and Pro cards while keeping purchase actions read-only.
- Added minimal Google Play Android Publisher OAuth refresh-token fallback:
  - Existing service-account private-key auth path remains unchanged.
  - OAuth fallback uses `GOOGLE_PLAY_OAUTH_CLIENT_ID`, optional `GOOGLE_PLAY_OAUTH_CLIENT_SECRET`, and `GOOGLE_PLAY_OAUTH_REFRESH_TOKEN`.
  - Runtime/admin readiness treats Google Play as configured when either service-account private-key auth or OAuth refresh-token auth is complete.
  - Google OAuth/Publisher failures fail closed with static errors and no secret-like response values.

## Verified

- Public pricing shows Individual, Family, and Pro on Monthly and Annual tabs.
- Client subscription page shows plan cards, Pro annual sync copy, and terms gating.
- Admin connector page and client connections page match the live state:
  - USPS adapter supported in code/catalog.
  - No registered/enabled control-plane connector row yet.
  - Client catalog is empty until connector runtime config/control-plane is enabled.
- Family/Pro plan logic is verified by code and automated tests:
  - Family seat limit: 6.
  - Pro seat limit: 10.
  - API connector sync is Pro annual only unless admin override is active.
  - Workspace sync validates address ownership/non-deleted state.
  - On-behalf sync validates active workspace member isolation.
- Mobile product endpoint returns all iOS and Android plan/cycle product IDs.
- Play Console subscription catalog matches the Android product IDs returned by the live mobile product endpoint; all six products exist and each has one active base plan.
- DigitalOcean app spec contains:
  - Stripe Individual/Family/Pro monthly/yearly price IDs.
  - Mobile iOS and Android product IDs.
  - Apple App Store Server API config.
  - Android package name.
  - Sentry DSN for the lightweight mobile JS-level reporting path.
- Android emulator launch/sign-in/sign-up UI works after native fixes.
- Android emulator `debugOptimized` local QA works through a debug-only `10.0.2.2` proxy path; production EAS builds remain HTTPS-only.
- Android emulator reached `More -> Subscription` with a verified/onboarded QA session:
  - Loaded live `Free Access` / `FREE_ACCESS` account state.
  - Showed the mobile purchases disabled notice.
  - Showed Individual, Family, and Pro plan cards.
  - Pro card shows guided partner update / partner queue copy.
- Live exact QA account lifecycle:
  - Signup auto-verifies only `mobile.qa@locateflow.com`.
  - Mobile API login succeeds after signup.
  - Logout hard-resets the QA account and owned QA data.
  - Post-logout login returns 401, and a new signup starts clean at onboarding.
- Google Cloud/Play readiness:
  - Android Publisher API enabled.
  - Pub/Sub API enabled.
  - Topic `play-rtdn` created.
  - Google Play notification publisher principal granted Publisher on the topic.
  - Service account `locateflow-play-api` created and granted active app-scoped Play access.
  - Play Console RTDN topic value saved to `projects/project-20494d44-c9e3-4fc2-9f4/topics/play-rtdn`.
  - Pub/Sub push subscription `play-rtdn-locateflow-webhook` created and active.
  - RTDN push endpoint and OIDC audience are `https://locateflow.com/api/webhooks/playstore`.
  - Push OIDC service account matches the expected DigitalOcean identity; values intentionally not recorded.
  - Android Publisher OAuth fallback configured in DigitalOcean without recording secret values.
  - Live fake Android purchase verification fails closed as JSON HTTP 424 `IAP_PROVIDER_UNAVAILABLE`, not `IAP_NOT_CONFIGURED`; this confirms the missing private key is no longer the backend-auth blocker.
- EAS Android `play-internal` store build finished successfully:
  - Build ID: `9d3c92a9-5e58-4eac-ba12-79bd63065081`
  - Version code: `15`
  - Build page: `https://expo.dev/accounts/axtra-solutions-llc/projects/locateflow/builds/9d3c92a9-5e58-4eac-ba12-79bd63065081`

## Verification Commands

- `git diff --check`
- `pnpm verify:typecheck`
- `pnpm verify:tests`
- `pnpm lint`
- `pnpm build`
- `pnpm verify:ci`
- Focused billing/workspace/connector/mobile/shared tests listed in `reports/release-readiness-todo-2026-06-03.md`.
- `expo-doctor`: 18/18 checks passed.
- EAS Android `play-internal` build: `FINISHED`.
- Focused mobile tests after the Android QA/proxy fix: 10 files / 25 tests.
- Mobile typecheck after the Android QA/proxy fix.
- Focused register/mobile signup tests after the QA auto-login patch.
- DigitalOcean deployment for commit `0f70be4`: ACTIVE.
- DigitalOcean deployment for commit `da3f291`: ACTIVE.
- DigitalOcean app-spec update deployment `e6aa96d0-19c0-42d8-81a5-fa7329a2c28c`: ACTIVE.
- DigitalOcean deployments for Google Play OAuth fallback commits became ACTIVE:
  - `809d75e`
  - `478c00f`
  - `b2212a4`
- Live smoke after deployment:
  - `/api/ready`: HTTP 200.
  - `/api/mobile/iap/products`: HTTP 200.
  - `/api/auth/register`: returns `emailVerified` and `requiresEmailVerification` response fields.
  - Play RTDN fake bearer returns HTTP 401 invalid-token class, not missing expected identity.
  - Play RTDN missing bearer returns HTTP 401 `Missing OIDC token`.
  - Pub/Sub-published RTDN test notification reaches the live webhook and logs `[PLAYSTORE WEBHOOK] received TEST notification`.
  - Fake Android IAP verify returns JSON HTTP 424 `IAP_PROVIDER_UNAVAILABLE`, no `IAP_NOT_CONFIGURED`, and no secret-like response content.

## Remaining Blockers

- Android paid IAP is not production-ready until a real internal-test Play purchase verifies entitlement activation:
  - Service-account JSON key creation is still blocked by organization policy `iam.disableServiceAccountKeyCreation`.
  - The new OAuth refresh-token fallback is deployed and configured, so the missing private key is no longer the Android Publisher auth blocker.
  - Fake-token verification now reaches the provider dependency path and fails closed as `IAP_PROVIDER_UNAVAILABLE`.
- Play RTDN Pub/Sub push delivery is complete from Google Cloud:
  - Subscription `play-rtdn-locateflow-webhook` is active.
  - DigitalOcean RTDN identity env matches the final endpoint/audience/service account, so no redeploy/restart was needed.
  - Invalid bearer paths fail closed with HTTP 401.
  - A valid RTDN-format Pub/Sub publish reached the live webhook and was logged as a test notification.
  - Play Console's own "Send test notification" button still requires human Terms of Service acceptance; Codex did not accept legal terms.
- Active paid Stripe-managed Pro/Family state on mobile was not granted in production because admin plan changes required password plus MFA/backup code, and direct DigitalOcean DB access is network/firewall blocked.
- Full paid Stripe upgrade/downgrade completion was not run against live production payments to avoid production payment risk. A staging/test-mode Stripe catalog/customer is still required for card-completion E2E.
- Store-console submission items remain manual/human-gated:
  - App Review notes and demo credentials.
  - Apple Privacy form.
  - Google Data Safety form.
  - Closed-test/release submission.
  - Production rollout.
- Native crash reporting is lightweight for v1:
  - `EXPO_PUBLIC_SENTRY_DSN` is present.
  - `@sentry/react-native` native crash capture is not integrated yet.
- `FEATURE_API_CONNECTORS` is absent in DigitalOcean, so Pro annual API sync remains hidden/disabled in live client UI until the connector launch is intentionally enabled and a connector is registered.

## Release Recommendation

READY FOR INTERNAL TESTING ONLY

Safe to merge the code hardening, Android QA fixes, Google Play OAuth fallback, RTDN setup, and reporting updates after review. Not safe to market-launch Android paid subscriptions until a real internal-test Play purchase verifies entitlement activation and the remaining store-console human checks are complete. Not safe to advertise live partner auto-sync until connector runtime config/control-plane registration is enabled and partner agreements are complete.
