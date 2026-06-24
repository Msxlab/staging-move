# 2026-06-23 Free Pivot Follow-up: Staging Deploy + Runtime QA

Status: CONCERNS FOUND, no application source modified
Branch: `codex/free-pivot-verification-2026-06-23`
Primary artifact root: `docs/ai/screenshots/2026-06-23-free-pivot-followup/`

## Scope

This follow-up was run after the first free-pivot verification because mobile runtime QA was previously blocked by an installed APK that targeted production, and the staging deploy branch needed proof.

Covered:

- Staging deploy/build-info check after authenticated web login.
- Android emulator install using a local debug APK with staging public env.
- Mobile runtime login, seeded move data, core tab screenshots, More/settings screenshots, and account cleanup using `mobile.qa@locateflow.com`.
- Staging public web screenshots on desktop plus selected 390px mobile routes.
- Staging authenticated web screenshots for dashboard, address/Dossier, services, moving, and settings flows.
- Staging admin host discovery and unauthenticated login screenshot.
- Safe local checks: web/mobile tests and typecheck.

Not covered:

- Official signed EAS `staging-preview` APK install. The local debug APK used staging env and is valid runtime evidence, but it is not the release/preview artifact a QA device should sign off.
- Authenticated admin runtime pages. No admin QA credentials were provided or approved.
- Production data, production deploys, production migrations, or production credentials.

## Executive Summary

The earlier answer is important: the full mobile runtime test had not been completed before this follow-up. It has now been repeated against staging APIs with a staging-targeted local debug Android install, and the QA account was cleaned up afterward.

Results:

1. P1: Live staging web is not on the latest staging/main candidate. Authenticated `/api/build-info` reports `sourceBranch: feat/design-foundation`, commit `38cb3718abf1958f6fd1c6cd731abd3974047b23`, built `2026-06-23T16:16:25.779Z`. That commit is 59 commits behind `origin/staging` and 74 commits behind `origin/main`. `origin/staging` is also still 15 commits behind `origin/main`.
2. P1/process: The Android runtime test used a local debug APK with staging env, not an official signed EAS preview APK. Staging API targeting was proven in logcat, but the official preview artifact still needs to be built/uploaded/installed before final mobile release sign-off.
3. PASS: `mobile.qa@locateflow.com` could be registered/login-tested with automatic email verification, seeded with fake moving/address/service data, used in the Android UI, and deleted afterward. Re-login after delete returned 401.
4. PASS with stale-deploy caveat: Authenticated web dashboard, addresses, services, moving, settings/profile, settings/subscription, and settings/privacy rendered and screenshoted on staging. Dossier-related address/dashboard data appeared in the authenticated web screenshots.
5. P2: Public mobile web routes still show horizontal overflow by DOM measurement on `home-mobile`, `pricing-mobile`, and `why-free-mobile` at 390px.
6. BLOCKED: Authenticated admin pages were not tested because admin QA credentials were not provided. Public admin staging login host exists and returns HTTP 200.

## Staging Deploy Evidence

Authenticated staging web build-info:

- Artifact: `docs/ai/screenshots/2026-06-23-free-pivot-followup/web-staging/auth-web-build-info.json`
- Login status: 200
- Build-info status: 200
- Service: `web`
- Commit: `38cb3718abf1958f6fd1c6cd731abd3974047b23`
- Source branch: `feat/design-foundation`
- Built at: `2026-06-23T16:16:25.779Z`
- Environment: `staging`

Git comparison:

- `origin/staging` HEAD: `bcbb4e1ade7288ecb7a5165ac448fe5b162c5c26`
- `origin/main` HEAD: `a620391f230fdd2a9942022690eca696cfac18ee`
- `origin/staging...origin/main`: `0 15`
- Staging web build commit to `origin/staging`: 59 commits behind
- Staging web build commit to `origin/main`: 74 commits behind

Impact:

- Runtime screenshots are valuable for the deployed staging state, but they do not prove the latest `origin/staging` or `origin/main` code is deployed.
- Any final QA sign-off should happen after redeploying the intended branch/commit and re-checking `/api/build-info`.

## Android Runtime Evidence

Installed runtime:

- Emulator: Pixel 7a AVD, Android 17
- Install command: `apps/mobile/android/.gradlew.bat app:installDebug --console=plain`
- APK type: local debug APK
- API target proof: `docs/ai/screenshots/2026-06-23-free-pivot-followup/logs/mobile-launch-logcat.txt`
- Log evidence includes mobile base URL `https://staging.locateflow.com/api`

QA account API lifecycle:

- Artifact: `docs/ai/screenshots/2026-06-23-free-pivot-followup/staging-runtime/staging-mobile-qa-api-smoke.json`
- `POST /api/auth/register`: 201
- `emailVerified`: true
- `requiresEmailVerification`: false
- Mobile login: 200
- Token/password saved in artifacts: false

Seeded fake QA data:

- Artifact: `docs/ai/screenshots/2026-06-23-free-pivot-followup/staging-runtime/staging-mobile-qa-seed-summary.json`
- Profile update: 200
- Address create: 201
- Service create: 201
- Moving plan create: 201
- Onboarding completed: true
- Final entitlement shown by API: `PRO`, active true
- Counts: 2 addresses, 1 service, 1 moving plan
- Primary address: Austin, TX 78701 with coordinates

Mobile screenshots:

- `mobile-runtime/01-mobile-launch.png`: sign-in launch state
- `mobile-runtime/06-mobile-login-fields-filled.png`: UI login form filled
- `mobile-runtime/07-mobile-after-signin-submit.png`: post-login onboarding/profile state
- `mobile-runtime/14-mobile-home-loaded.png`: Home dashboard loaded
- `mobile-runtime/15-mobile-addresses-loaded.png`: Addresses tab with route/address data
- `mobile-runtime/16-mobile-moving-loaded.png`: Moving tab with Austin to Denver move
- `mobile-runtime/17-mobile-services-loaded.png`: Services tab with internet service
- `mobile-runtime/19-mobile-more-main-top.png`: More top section
- `mobile-runtime/20-mobile-more-main-lower.png`: More lower section
- `mobile-runtime/21-mobile-settings-profile.png`: Profile settings
- `mobile-runtime/22-mobile-settings-subscription.png`: Subscription/free-plan state
- `mobile-runtime/23-mobile-settings-privacy.png`: Privacy/security state

Mobile findings:

- Core authenticated tabs rendered with seeded staging data.
- Subscription page clearly states free/no subscription/no renewal/no credit card.
- The More tab initially surfaced a workspace empty state in one capture, but the follow-up More screenshots captured the expected account/tools/privacy/support menu after additional navigation.
- Official signed EAS preview artifact remains pending.

Account cleanup:

- Artifact: `docs/ai/screenshots/2026-06-23-free-pivot-followup/staging-runtime/staging-mobile-qa-cleanup-summary.json`
- Delete status: 200
- Delete response status: `COMPLETED`
- Re-login after deletion: 401
- Password/cookie saved in artifacts: false

## Web Runtime Evidence

Public staging screenshots:

- Artifact index: `docs/ai/screenshots/2026-06-23-free-pivot-followup/web-staging/public-web-screenshot-index.json`
- Desktop screenshots captured for home, features, pricing, why-free, FAQ, refund, billing policy, terms, privacy, sign-in, and sign-up.
- Mobile screenshots captured for home, pricing, why-free, sign-in, and sign-up.

Public web findings:

- Desktop routes rendered.
- Free/no-card copy is visible on pricing.
- Auth pages render, but sign-up still says "Checkout terms shown before purchase", which is a stale trust/copy risk for the free pivot.
- Horizontal overflow by DOM measurement is true at 390px for:
  - `home-mobile-390x844.png`
  - `pricing-mobile-390x844.png`
  - `why-free-mobile-390x844.png`

Authenticated staging web screenshots:

- Artifact index: `docs/ai/screenshots/2026-06-23-free-pivot-followup/web-staging/auth-web-screenshot-index.json`
- `dashboard-auth-1366x900.png`
- `addresses-auth-1366x900.png`
- `services-auth-1366x900.png`
- `moving-auth-1366x900.png`
- `settings-profile-auth-1366x900.png`
- `settings-subscription-auth-1366x900.png`
- `settings-privacy-auth-1366x900.png`

Authenticated web findings:

- Dashboard rendered the move briefing and active move data.
- Addresses rendered the seeded Austin and Denver homes.
- Services rendered the seeded internet service and affiliate disclosure copy.
- Moving rendered the active move plan.
- Settings subscription rendered free-plan copy with no subscription/no credit-card language.
- Authenticated pages checked in the index reported no horizontal overflow.

## Admin Runtime Evidence

Admin staging host:

- Artifact: `docs/ai/screenshots/2026-06-23-free-pivot-followup/admin-staging/admin-staging-index.json`
- Login URL: `https://admin-staging.locateflow.com/login`
- Status: 200
- Title: `LocateFlow Admin`
- Screenshot: `admin-staging/admin-staging-login-1366x900.png`
- Unauthenticated `/api/build-info`: 401 Unauthorized

Admin finding:

- Authenticated admin dashboard/pages remain blocked until a real admin QA credential is provided or an approved admin test account is created.

## Verification Matrix

| Area | Status | Evidence |
| --- | --- | --- |
| Staging deploy branch/commit | FAIL | Live web reports `feat/design-foundation` commit `38cb3718`, 59 commits behind `origin/staging` and 74 behind `origin/main`. |
| Official staging-preview APK | BLOCKED | Local debug staging APK installed and tested; signed EAS preview APK was not available/installed. |
| Mobile staging API targeting | PASS | Logcat shows `https://staging.locateflow.com/api`. |
| Mobile QA register/login auto verification | PASS | Register 201, email verified true, mobile login 200. |
| Mobile fake-user runtime | PASS | Home, addresses, moving, services, More, profile, subscription, privacy screenshots saved. |
| Mobile account cleanup | PASS | Delete 200 `COMPLETED`; re-login 401. |
| Public web desktop screenshots | PASS | Captured public/legal/auth desktop pages. |
| Public web mobile screenshots | CONCERN | Captured selected mobile pages; 390px overflow flagged on home/pricing/why-free. |
| Authenticated web screenshots | PASS with stale-deploy caveat | Dashboard/address/service/moving/settings pages rendered and saved. |
| Admin public login | PASS | `admin-staging` login returns 200 and screenshot saved. |
| Admin authenticated runtime | BLOCKED | No admin QA credentials provided/approved. |

## Tests And Checks Run

- `git fetch --all --prune`
- `pnpm verify:typecheck` - PASS
- `pnpm --filter @locateflow/mobile test` - PASS, 341 tests
- `pnpm --filter @locateflow/web test` - PASS, 2909 tests
- `apps/mobile/android/.gradlew.bat app:installDebug --console=plain` - PASS
- ADB/UIAutomator mobile screenshots and XML dumps - PASS for captured flows
- In-app/browser staging screenshots - PASS for captured web/admin pages

Warnings:

- Local Node is `v24.12.0`; repo engine wants Node `22.x`.
- Initial Metro localhost startup did not load in the Android app until Metro was restarted with a LAN host/limited workers.
- Android debug build emitted non-blocking Gradle/CMake/Expo warnings.

## Risk Register

### P1 - Staging deploy does not match latest target branch

Impact:

- Current staging runtime QA cannot be used as final sign-off for the latest `origin/staging` or `origin/main`.

Fix:

- Redeploy staging from the intended branch/commit.
- Re-open authenticated `/api/build-info` and confirm the expected commit before final QA.

### P1 - Official preview APK still missing from runtime sign-off

Impact:

- The local debug Android test proves app behavior against staging APIs, but not the exact signed staging/preview package users/testers would install.

Fix:

- Produce or retrieve an official EAS `staging-preview` APK/AAB, install it on the emulator/device, and repeat the mobile smoke/screenshots.

### P2 - Public mobile overflow on staging

Impact:

- Mobile web pages can have horizontal scroll or clipped layout at 390px.

Fix:

- Reproduce and fix overflow on home, pricing, and why-free; rerun mobile screenshots after deploy.

### P2 - Auth page copy still mentions checkout

Impact:

- Sign-up trust copy conflicts with the "free/no credit card" pivot and may confuse users.

Fix:

- Replace "Checkout terms shown before purchase" with free/no-card/review-terms language consistent with legal and pricing pages.

### P2 - Authenticated admin runtime remains unverified

Impact:

- Admin dashboard data/control-plane accuracy is not runtime-proven on staging.

Fix:

- Provide approved admin QA credentials or an approved admin test account, then capture admin dashboard/settings/billing/user pages.

## Recommended Next Action

1. Redeploy staging from the intended branch and verify `/api/build-info` before another sign-off pass.
2. Build or fetch the official EAS `staging-preview` Android artifact, install it, and rerun the same mobile QA path.
3. Fix public mobile overflow and sign-up free-pivot copy.
4. Provide/admin-approve an admin QA credential for authenticated admin screenshots.
5. Re-run web + mobile screenshots after the redeploy so the artifacts prove the latest branch, not the stale staging build.
