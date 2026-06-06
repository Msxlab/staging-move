# LocateFlow Mobile IAP QA Final - 2026-06-03

## Scope

Verified Android mobile subscription readiness from real code, live APIs, EAS store builds, local emulator evidence, safe store-disabled QA behavior, and Google Play internal-test Billing. No live payment, production subscription mutation, store rollout, or secret exposure was performed.

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
- The previous local/debug emulator package was removed so future evidence can distinguish a Play-installed internal build from a local QA build.
- On 2026-06-04, Play internal build `15 (1.0.0)` was installed from Google Play on `emulator-5554`; package manager reports `installerPackageName=com.android.vending`.
- A Google-authenticated account with an active web/Stripe-managed `Individual Monthly` subscription showed the expected mobile read-only/manage-on-web state instead of offering a duplicate native purchase.
- A clean QA account completed onboarding through live mobile APIs, opened `More -> Subscription` from the Play-installed build, and launched the Google Play Billing sheet for `Individual Annual` at `$39.99/year`.
- Play Console License testing was corrected by selecting tester list `LOCATEFLOW`; the Billing sheet then showed `Test card, always approves` and the no-charge Google Play test subscription notice.
- Android build `15` completed the Individual Annual purchase through the Play test-card/no-charge flow and the app showed `Individual Annual` as the current plan.
- Google Play subscription management cancellation completed; the app read back `CANCEL_AT_PERIOD_END` for Individual Annual while access remains active until the period end.
- `Restore purchases` returned the expected `Restored` / `Your active subscription was restored.` alert.

## Fixes Applied

- Fixed mobile plan visibility so store-disabled native builds still show Individual/Family/Pro cards.
- Added focused mobile tests for store-disabled visibility.
- Added register response fields so exact `QA_RESETTABLE_ACCOUNT_EMAIL` signups tell mobile whether the backend auto-verified the account.
- Updated mobile sign-up to immediately create a mobile session when the backend reports no email-verification requirement.
- Fixed Google Play test-purchase handling for safe QA: Google-verified Play `testPurchase` responses remain blocked for non-allowlisted production users, but are accepted for `QA_RESETTABLE_ACCOUNT_EMAIL` / optional `GOOGLE_PLAY_TEST_PURCHASE_USER_EMAILS`.
- Added local mobile copy polish so `CANCEL_AT_PERIOD_END` summary says `Ends {{date}}` instead of `Renews {{date}}`; this is pending the next mobile build/update and is not in Play build `15`.

## Evidence

- Screenshot: `C:\Users\Kutay\AppData\Local\Temp\locateflow-mobile-subscription-family-pro-20260603.png`
- Screenshot: `C:\Users\Kutay\AppData\Local\Temp\locateflow-subscription-qa-before-purchase.png`
- Screenshot: `C:\Users\Kutay\AppData\Local\Temp\locateflow-google-play-real-payment-sheet.png`
- Screenshot: `C:\Users\Kutay\AppData\Local\Temp\locateflow-google-play-test-payment-sheet-20260604.png`
- Screenshot: `C:\Users\Kutay\AppData\Local\Temp\locateflow-android-individual-annual-current-after-play-test-20260604.png`
- Screenshot: `C:\Users\Kutay\AppData\Local\Temp\locateflow-android-restore-success-20260604.png`
- Screenshot: `C:\Users\Kutay\AppData\Local\Temp\locateflow-android-cancel-at-period-end-after-restore-20260604.png`
- Android package: `com.locateflow.mobile`
- Play-installed version: `versionCode=15`, `versionName=1.0.0`, `installerPackageName=com.android.vending`
- Emulator: `emulator-5554`

## Remaining Blockers

- Play-installed build `15` still carries the older `Renews {{date}}` summary copy for `CANCEL_AT_PERIOD_END`; local code now changes that to `Ends {{date}}`, but a new mobile build/update is needed before this polish is visible in the Play-installed app.
- Android `play-internal` build candidate `97ece373-6c37-4394-8e43-7781cd51781b`, versionCode `16`, later finished successfully for commit `3cfd03f`; it was not uploaded to Play and no production rollout was performed.
