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
- DigitalOcean app spec contains:
  - Stripe Individual/Family/Pro monthly/yearly price IDs.
  - Mobile iOS and Android product IDs.
  - Apple App Store Server API config.
  - Android package name.
- Android emulator launch/sign-in/sign-up UI works after native fixes.
- Android emulator `debugOptimized` local QA works through a debug-only `10.0.2.2` proxy path; production EAS builds remain HTTPS-only.
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

## Remaining Blockers

- Android paid IAP is not production-ready until Google Play backend credentials are added to DigitalOcean:
  - `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL`
  - `GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY`
  - `EXPECTED_PLAYSTORE_WEBHOOK_SERVICE_ACCOUNT_EMAIL` or `EXPECTED_PLAYSTORE_WEBHOOK_SUBJECT`
- Code fails closed correctly while those are missing:
  - Android purchase verification returns `IAP_NOT_CONFIGURED`.
  - `GOOGLE_PLAY_RTDN_AUDIENCE` and `GOOGLE_PLAY_PACKAGE_NAME` are present, but Play RTDN rejects production-like pushes until expected OIDC identity is configured.
- Mobile subscription UI could not be fully verified on the emulator with the fake QA account because the account is correctly blocked by email verification before onboarding completion. Verification tokens are hash-only and EmailLog stores no body, so completing this requires a verified test inbox/OAuth account or explicit approval for a controlled QA-user verification mutation.
- Full paid Stripe upgrade/downgrade completion was not run against live production payments to avoid production payment risk. A staging/test-mode Stripe catalog/customer is still required for card-completion E2E.
- Store-console submission items remain manual/human-gated:
  - App Review notes and demo credentials.
  - Apple Privacy form.
  - Google Data Safety form.
  - Play Console product/closed-test confirmation.
  - Production rollout.
- Native crash reporting decision remains open:
  - Add production `EXPO_PUBLIC_SENTRY_DSN`, or explicitly ship v1 without native crash reporting.
- `FEATURE_API_CONNECTORS` is absent in DigitalOcean, so Pro annual API sync remains hidden/disabled in live client UI until the connector launch is intentionally enabled and a connector is registered.

## Release Recommendation

READY FOR INTERNAL TESTING ONLY

Safe to merge the code hardening and Android build fixes after review. Not safe to market-launch Android paid subscriptions until the missing Google Play Developer API/RTDN credentials are configured and verified. Not safe to advertise live partner auto-sync until connector runtime config/control-plane registration is enabled and partner agreements are complete.
