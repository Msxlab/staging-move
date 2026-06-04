# LocateFlow Mobile IAP QA Final - 2026-06-03

## Scope

Verified Android mobile subscription readiness from real code, live APIs, EAS store builds, local emulator evidence, and safe store-disabled QA behavior. No live payment, production subscription mutation, store rollout, or secret exposure was performed.

## Verified

- Android emulator build/install path works for `debugOptimized`.
- Local Android QA uses a debug-only `10.0.2.2` proxy; production EAS builds remain HTTPS-only.
- Live QA account lifecycle works through mobile APIs: reset-on-logout, re-register, auto-verify, login, profile/address setup, and onboarding completion.
- Mobile app reached Home, opened `More -> Subscription`, and loaded live backend account state.
- Subscription screen showed `Free Access` / `FREE_ACCESS` with mobile purchases disabled in the local QA build.
- Individual, Family, and Pro plan cards are visible in the store-disabled Android build, while purchase actions remain disabled/read-only.
- Android logcat check showed no fatal billing/subscription crash during the verified flow.
- Live `/api/mobile/iap/products` returns all six iOS and all six Android plan/cycle product IDs.
- Production EAS iOS store build `3474e1a9-8458-493a-9b56-150be860a963` remains `FINISHED` for app version `1.0.0`, build `13`.
- Android EAS `play-internal` store AAB build `9d3c92a9-5e58-4eac-ba12-79bd63065081` remains `FINISHED` for versionCode `15`.
- DigitalOcean production/staging health smokes pass after the latest report push deployment, and the production product endpoint still returns six unique iOS and six unique Android SKU values.
- The currently installed emulator package is not a Play-installed build (`installerPackageName=null`, `versionCode=1`), so it is not valid evidence for real Play Billing purchase/restore/cancel.

## Fixes Applied

- Fixed mobile plan visibility so store-disabled native builds still show Individual/Family/Pro cards.
- Added focused mobile tests for store-disabled visibility.
- Added register response fields so exact `QA_RESETTABLE_ACCOUNT_EMAIL` signups tell mobile whether the backend auto-verified the account.
- Updated mobile sign-up to immediately create a mobile session when the backend reports no email-verification requirement.

## Evidence

- Screenshot: `C:\Users\Kutay\AppData\Local\Temp\locateflow-mobile-subscription-family-pro-20260603.png`
- Android package: `com.locateflow.mobile`
- Emulator: `emulator-5554`

## Remaining Blockers

- Backend Stripe-managed paid state exists in QA/staging after the matrix, ending as active `PRO` annual with `CANCEL_AT_PERIOD_END`; mobile visual verification of that state still needs Chrome/test credentials or a store/internal build path.
- Full Android paid IAP purchase/restore/cancel verification remains blocked until build `15` is available through Play internal testing and an internal tester can complete a real test purchase.
- Play internal submit for build `15` stopped before upload because EAS non-interactive submit requires Google service-account key setup; no Play edit, upload, track commit, rollout, or live payment occurred.
