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
- Fixed the mobile password/account-management follow-through after removing the post-auth password gate:
  - OAuth-only users still get a secure `Set password` email-link action from mobile Privacy settings.
  - Password-login users now get a dedicated `Change password` email-reset action from the same screen.
  - OAuth-only account deletion remains supported by typed confirmation plus the signed-in bearer session, without forcing password creation first.
- Fixed mobile subscription plan visibility so store-disabled Android QA builds still show Individual, Family, and Pro cards while keeping purchase actions read-only.
- Cleaned public legal/contact fallbacks in code:
  - `terms`, `contact`, and `dpa` now use the product name fallback instead of exposing the raw legal-entity placeholder.
  - Public legal/contact pages no longer need to print the raw mailing-address placeholder when the address env is absent.
- Refreshed deployment checklists to match the current billing matrix:
  - `docs/deploy/billing-and-iap-setup-checklist.md` now covers Family/Pro Stripe prices, the current in-app mutation routes, and the six-SKU mobile store catalog.
  - `docs/deploy/mobile-store-submission-copy.md` now provides operator-ready App Review / Play Console copy without committing secrets.
- Added minimal Google Play Android Publisher OAuth refresh-token fallback:
  - Existing service-account private-key auth path remains unchanged.
  - OAuth fallback uses `GOOGLE_PLAY_OAUTH_CLIENT_ID`, optional `GOOGLE_PLAY_OAUTH_CLIENT_SECRET`, and `GOOGLE_PLAY_OAUTH_REFRESH_TOKEN`.
  - Runtime/admin readiness treats Google Play as configured when either service-account private-key auth or OAuth refresh-token auth is complete.
  - Google OAuth/Publisher failures fail closed with static errors and no secret-like response values.

## Verified

- Public pricing shows Individual, Family, and Pro on Monthly and Annual tabs.
- Client subscription page shows plan cards, Pro annual sync copy, and terms gating.
- Public legal/store-support pages now render the exact production company identity:
  - `https://locateflow.com/terms`
  - `https://locateflow.com/privacy`
  - `https://locateflow.com/contact`
  - All three show `AXTRA SOLUTIONS LLC` and the Woodland Park mailing address after the DigitalOcean app-level env update.
- Live Google Places server-side autocomplete works for authenticated users:
  - QA bearer request to `/api/address-autocomplete` returned `enabled: true` with 5 predictions.
  - Using the first returned `placeId`, `/api/address-autocomplete/details` returned `enabled: true` with a resolved address result.
- Live public store/legal/support URLs are reachable:
  - `https://locateflow.com/privacy`
  - `https://locateflow.com/terms`
  - `https://locateflow.com/contact`
  - `https://locateflow.com/help`
  - `https://locateflow.com/billing-policy`
  - `https://locateflow.com/refund`
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
- Latest Apple rejection artifacts were inspected from Downloads and live App Store Connect:
  - Forced password creation after Sign in with Apple mapped to the former mobile `needsPasswordSetup` gate.
  - Subscription billed-amount prominence issue mapped to the annual CTA/card hierarchy on the mobile subscription screen.
  - App Review also asked whether `Pro Annual` at `$199.99` is intentional; shared code currently defines Pro yearly as `$199/year`.
- Mobile account-management paths remain coherent after the Apple fix:
  - OAuth-only users can request a secure set-password link from `Settings -> Privacy`.
  - Password-login users can request a secure reset/change-password link from the same screen.
  - OAuth-only delete-account already works through typed `DELETE` plus the authenticated session; password users still confirm with their current password.
- Live exact QA account lifecycle:
  - Signup auto-verifies only `mobile.qa@locateflow.com`.
  - Mobile API login succeeds after signup.
  - Android `More -> Sign Out` with confirmation returns the app to the Sign In screen.
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
  - Play Console internal testing is active with release `1.0.0-internal-1`, and the tester list currently shows 4 configured testers.
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
  - `/api/address-autocomplete`: authenticated QA request returns `enabled: true` with live predictions.
  - `/api/address-autocomplete/details`: authenticated QA request returns `enabled: true` with a resolved result.
  - Play RTDN fake bearer returns HTTP 401 invalid-token class, not missing expected identity.
  - Play RTDN missing bearer returns HTTP 401 `Missing OIDC token`.
  - Pub/Sub-published RTDN test notification reaches the live webhook and logs `[PLAYSTORE WEBHOOK] received TEST notification`.
  - Fake Android IAP verify returns JSON HTTP 424 `IAP_PROVIDER_UNAVAILABLE`, no `IAP_NOT_CONFIGURED`, and no secret-like response content.
- Final validation rerun after the Places/report updates passed:
  - `git diff --check`
  - `pnpm verify:typecheck`
  - `pnpm verify:tests`
  - `pnpm lint`
  - `pnpm build`
  - `pnpm verify:ci`

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
- Active paid Stripe-managed Pro/Family state on mobile was not granted in production because the live admin mutation flow requires step-up secrets:
  - The admin UI now reaches the QA user's detail page successfully.
  - Attempting a manual Family/Pro grant opens the expected step-up modal requiring the admin password plus MFA code or backup code.
  - Codex did not bypass or guess those factors, and direct DigitalOcean DB access is network/firewall blocked.
- Apple re-review still needs one more honest pass:
  - The forced Sign in with Apple password gate and annual billed-amount hierarchy issues were fixed in code.
  - A fresh iOS build / TestFlight or App Review pass is still required to prove the rejection is fully cleared.
  - App Review also explicitly asked whether `Pro Annual` priced at `$199.99` is intentional; shared code currently says `$199/year`, so product/store pricing still needs human confirmation.
- Stripe staging/test-mode still is not ready for full E2E plan-matrix QA:
  - The live Stripe sandbox catalog currently shows only `LocateFlow Individual Annual`.
  - Visible Family monthly/yearly, Pro monthly/yearly, and Individual monthly sandbox products are still missing, so staging upgrade/downgrade and checkout-completion coverage cannot yet be run honestly.
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

## Additional Live QA Since The Prior Report

- Public legal pages were rechecked in live Chrome after deployment:
  - `/terms`, `/privacy`, and `/contact` no longer show raw placeholder legal/entity strings.
- Public legal pages were then rechecked again after the DigitalOcean env update deployment completed:
  - `/terms`, `/privacy`, and `/contact` now show the exact public legal entity `AXTRA SOLUTIONS LLC`.
  - The mailing address now renders as `188 Overmount Ave APT A, Woodland Park, NJ 07424-3255, United States`.
- Live client subscription QA found and then cleared a production hydration issue:
  - Before the patch, `/settings/subscription` emitted production React hydration errors in Chrome dev logs.
  - Fix shipped in commit `529aad9` by making the annual-offer date calculation use a server-stable `initialNowIso` prop instead of a raw render-time `new Date()` inside the client component.
  - Deployment `ec0cafd6-2cf7-4b15-ae8b-73fb491cca1f` became ACTIVE.
  - Fresh live retest after that deployment showed no console errors and confirmed Monthly / Annual tabs plus Individual / Family / Pro annual cards, including the Pro annual connector copy.
- Android emulator QA re-verified the resettable QA flow from the real UI:
  - `More -> Sign Out` opened the destructive confirmation dialog and returned to the Sign In screen after confirmation.
  - The old QA credentials were then rejected with HTTP 401 until the exact QA email was re-registered.
  - Re-registering `mobile.qa@locateflow.com` succeeded again, confirming the server-side hard reset.
  - A rapid immediate re-login sequence on the local debug proxy surfaced the expected auth lockout banner (`Retry after ... seconds`) rather than silently reusing stale local state.
- Play Console live smoke added two more confirmations:
  - Internal testing is Active with release `1.0.0-internal-1`.
  - The Internal testing tester list currently contains 4 configured testers.
- Live admin smoke improved from the prior checkpoint:
  - User detail for `mobile.qa@locateflow.com` now opens normally in admin.
  - The remaining blocker is only the deliberate step-up secret challenge for manual paid-plan mutation.
- Live Stripe sandbox smoke added one more concrete blocker:
  - The visible test-mode catalog currently contains only `LocateFlow Individual Annual`.
  - That means the staged Stripe matrix is still missing the rest of the Individual/Family/Pro catalog needed for honest test-card E2E coverage.
- Latest Apple rejection evidence was inspected from Downloads plus App Store Connect:
  - `Screenshot-0603-132041.png` matched the forced post-Apple-sign-in password setup screen.
  - `Screenshot-0603-132317.png` matched the annual subscription card hierarchy complaint.
  - Code fixes were applied for both issues, and the follow-up mobile password management path now exposes set/reset-password email links from Privacy settings instead of forcing setup immediately after auth.
- Android `debugOptimized` was rebuilt and reinstalled after the Apple/mobile account-management patch:
  - Emulator retest still opened `More -> Subscription`.
  - Live `Free Access` state, the store-disabled notice, and the read-only Family/Pro cards remained intact.

## Release Recommendation

READY FOR INTERNAL TESTING ONLY

Safe to merge the code hardening, Android QA fixes, Google Play OAuth fallback, RTDN setup, DigitalOcean public legal env updates, store-submission copy docs, and reporting updates after review. Not safe to market-launch Android paid subscriptions until a real internal-test Play purchase verifies entitlement activation and the remaining store-console human checks are complete. Not safe to advertise live partner auto-sync until connector runtime config/control-plane registration is enabled and partner agreements are complete.
