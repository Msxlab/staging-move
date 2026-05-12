# LocateFlow Mobile — Pre-submission QA Checklist

Run the full list on a real iOS device through TestFlight AND a real Android device through Internal Testing **before** moving to App Store review / Play production.

Status codes:
- `PASS` — verified to work
- `FAIL` — verified to break (must fix)
- `SKIP-PHYS` — requires physical hardware not currently available
- `SKIP-CONSOLE` — requires App Store Connect / Play Console access

| # | Test | iOS | Android |
|---|---|---|---|
| 1 | Fresh install completes; app launches in < 5s | | |
| 2 | Cold launch shows animated splash, then sign-in; no font fallback flash | | |
| 3 | Email sign-up succeeds; verification email arrives | | |
| 4 | Email sign-in succeeds; auth token persists across cold launch | | |
| 5 | Google OAuth: button opens in-app browser; redirect returns to app; lands on `/onboarding` | | |
| 6 | Apple Sign-In on iOS: **native sheet** appears (not Safari View Controller) | (iOS only) | n/a |
| 7 | Apple Sign-In on iOS simulator: falls back to web flow gracefully | (iOS only) | n/a |
| 8 | Sign-up with private-relay email (`@privaterelay.appleid.com`): account created, email retained as-is | (iOS only) | n/a |
| 9 | Logout from Settings → clears session → next launch returns to sign-in | | |
| 10 | Forgot password: deep-link from email opens `/reset-password` inside the app | | |
| 11 | Onboarding completion: profile + address + services + moving steps all save | | |
| 12 | Address autocomplete: typing into ZIP/street suggests matches without device location permission | | |
| 13 | Subscription page loads; localized price from store appears | | |
| 14 | Sandbox subscription purchase succeeds; backend verify returns success; entitlement updates | | |
| 15 | Restore Purchases finds the sandbox subscription and re-verifies | | |
| 16 | Manage Subscription deep-links to App Store / Play store subscription page | | |
| 17 | Push notification soft-prompt screen appears **before** the OS prompt (after onboarding or in settings) | | |
| 18 | Declining the soft prompt does not show the OS prompt and does not block app | | |
| 19 | Accepting the soft prompt then declining the OS prompt does not crash; settings still toggle | | |
| 20 | Accepting both: device receives a test push from the backend | | |
| 21 | Account deletion (email/password user): types DELETE + password → account deleted, session cleared, push token unregistered, routed to sign-in | | |
| 22 | Account deletion (Google-only user): types DELETE → account deleted **without** setting a password | | |
| 23 | Account deletion (Apple-only user): types DELETE → account deleted **without** setting a password | | |
| 24 | After deletion: kill + reinstall + launch → no auto-login, no cached profile | | |
| 25 | Deep link `locateflow://oauth` from another app: handled correctly | | |
| 26 | Universal/App link `https://locateflow.com/blog/...`: opens inside app (autoVerify) | | |
| 27 | Offline mode: app shows queued/error states, does not crash; reconnect flushes queue | | |
| 28 | Background → foreground after 1 hour: session intact OR graceful 401 → sign-in | | |
| 29 | App update (TestFlight v1 → v2): no data loss, no forced sign-out | | |
| 30 | Crash reporter (if DSN configured): manual test error appears in dashboard with PII scrubbed | | |
| 31 | No debug menus / dev-only screens reachable in production build | | |
| 32 | Network inspector (proxy): no traffic to `localhost`, `staging.locateflow.com`, or internal IPs | | |
| 33 | App Lock: enabling biometric, killing the app, relaunching → biometric prompt before content | | |
| 34 | Settings → Privacy → Privacy Policy: opens `https://locateflow.com/privacy` in browser | | |
| 35 | Settings → Privacy → Export data: triggers backend export job | | |
| 36 | i18n: switching to Spanish in onboarding flips all visible copy | | |
| 37 | Tab navigator: all 5 tabs reachable and render | | |
| 38 | Subscription page on non-subscriber: shows plans and CTA | | |
| 39 | Subscription page when subscription managed elsewhere (Stripe web): shows read-only notice | | |
| 40 | Permissions screen of OS Settings shows only Notifications + Face ID (iOS) / Notifications + Biometric (Android) | | |

---

## Required-before-submission console checks

| Check | Owner |
|---|---|
| Apple Team ID set in production env (`APPLE_TEAM_ID`) so AASA serves the real `appID` | Release manager |
| Play App Signing SHA-256 + upload key SHA-256 added to `ANDROID_APP_FINGERPRINTS` env | Release manager |
| App Store Connect: bundle ID exists, Sign in with Apple capability enabled, IAP product created | App Store admin |
| Play Console: package exists, subscription product created, Data Safety form filled, account-deletion URL set | Play admin |
| Privacy Policy URL live and matches `MOBILE_DATA_INVENTORY.md` | Legal / web team |
| Account-deletion URL live: `https://locateflow.com/account/delete` | Web team |
