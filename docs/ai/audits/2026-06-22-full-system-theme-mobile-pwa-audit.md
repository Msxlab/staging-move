# 2026-06-22 Full System Theme, Mobile, PWA Audit

## Scope

- Repo: `C:\Users\Kutay\Documents\staging-move`
- Branch: `codex/staging-audit-2026-06-21`
- Theme source: `C:\Users\Kutay\Downloads\tema-20260621T192823Z-3-001\tema`
- Live staging base: `https://staging.locateflow.com`
- Android target: local Pixel emulator via Android SDK / Android Studio JBR

## Source Theme Inventory

Current source bundle handoff `(7)` contains the active web/admin/mobile reference screens:

- `Move Web.dc.html`, `Web.dc.html`, `Web Blog.dc.html`, `Web Features.dc.html`, `Web Login.dc.html`, `Web Onboarding.dc.html`, `Web Why-Free.dc.html`
- `Move.dc.html`, `DossierScene.dc.html`, `Onboarding.dc.html`, `Auth.dc.html`
- `Admin.dc.html`, `Providers.dc.html`, `CustomProviders.dc.html`, `Invitations.dc.html`, `Reminders.dc.html`, `Search.dc.html`, `Help.dc.html`

Mobile-only handoff `(9)` still contains `Move.dc.html`, `DossierScene.dc.html`, and the source mascot reference. No extra missing top-level product page was found in the latest bundle beyond the areas above.

## Theme Status

- Dark mode: Gold is the intended default accent. Verified on Android runtime; sign-in uses dark navy surfaces and Gold primary/links.
- Light mode: Sapphire is the intended accent. Verified on Android runtime; sign-in/sign-up buttons, links, checkboxes, legal cards, and inputs use the Sapphire family after local token fixes.
- Emerald/green remains semantic only: success, money/positive states, approvals. It is not the product primary.
- Dossier integration exists on both web and mobile through shared dossier data mapping plus `DossierAmbient` / scene components. Static parity is present; authenticated visual QA still needs a verified session.
- Animations present in runtime code: ambient dossier motion, animated splash, press-scale buttons, shimmer/gradient button surface, skeleton loading, success toast, count-up, and tab/screen transitions.
- Icons: lucide icons and source SVG brand assets are integrated. SVG icon assets were aligned to the new Sapphire light token where stale blue remained. PNG app icons were not regenerated in this pass.
- Branding: public runtime pages use LocateFlow. The remaining "Staging Move" label visible in Chrome is Dokploy project metadata, not the product UI.

## Fixes Applied In This Pass

- Tightened Sapphire light tokens in `packages/shared/src/design-tokens.ts`.
- Synced mobile runtime theme and notification color to the stronger Sapphire scale.
- Synced admin light/dark primary/ring/foil variables so dark is Gold and light is Sapphire.
- Updated admin/mobile SVG brand assets away from the older blue drift.
- Removed stale "Move" wording from comments where it described the source theme rather than the LocateFlow product.

## Live Staging Smoke

All public routes below returned HTTP 200 before the new local fixes were deployed:

- `/`
- `/blog`
- `/features`
- `/why-free`
- `/sign-in`
- `/sign-up`
- `/onboarding`
- `/offline`
- `/manifest.json`
- `/sw.js`
- `/api/ready`
- `/api/build-info`

Current live build-info at audit time:

- commit: `3f7aaf91d8c441ac9b77c62d7761404a40e75109`
- branch: `codex/staging-audit-2026-06-21`
- builtAt: `2026-06-22T04:35:16.596Z`

PWA status:

- `/manifest.json` exists and declares `name: LocateFlow - Relocation Intelligence`, `short_name: LocateFlow`, `display: standalone`, `start_url: /dashboard`, and app icons.
- `/sw.js` exists.
- `/manifest.webmanifest` is not served. This is non-blocking because the app links `/manifest.json`, but it is a stale-path footnote if any external tool expects `.webmanifest`.

## Android Build And Runtime QA

Builds:

- `assembleDebug`: succeeds, but the APK is not standalone because it does not embed the JS bundle. Launching it shows "Unable to load script"; use Metro or the optimized artifact for local QA.
- `assembleDebugOptimized`: succeeds and embeds the bundle. This is the correct local emulator QA artifact.

Runtime evidence:

- Pixel 7a first launch was killed by Android low memory pressure, not by an app JS crash.
- Pixel 10 Pro launched `app-debugOptimized.apk` successfully.
- Light sign-in and sign-up screens rendered correctly.
- Legal acknowledgements, password policy validation, and registration submit worked.
- Dark mode sign-in rendered correctly with Gold accents.

Warnings to keep:

- Current local Node is `v24.12.0`; repo requests `22.x`.
- Android build warns that `NODE_ENV` is not set and falls back to `.env.local` / `.env`.
- iOS config warns `ios.appleTeamId` is missing; iOS builds may fail until supplied.
- Gradle deprecation warnings remain for future Gradle 9 compatibility.
- Some CMake object path warnings remain for generated native code paths.

## Test Account Result

`Mobile.qa@outlook.com` registration was submitted on staging with a QA password. The server accepted the account creation path and returned the "Check your email" verification screen. Web login against `/api/auth/login` currently returns the generic invalid-credentials response, consistent with an unverified or unavailable password-login state. Onboarding cannot be completed until the mailbox verification link is handled or a verified QA account is supplied.

## Verification Commands

Passed:

- `pnpm --filter @locateflow/mobile test` -> 34 files / 325 tests passed
- `pnpm --filter @locateflow/mobile exec tsc --noEmit`
- `pnpm --filter @locateflow/web exec tsc --noEmit`
- `pnpm --filter @locateflow/admin exec tsc --noEmit`
- `git diff --check` -> clean except expected CRLF warnings
- `gradlew assembleDebug`
- `gradlew assembleDebugOptimized`

## Remaining Items

- Deploy the local Sapphire/Gold alignment fixes to Dokploy; live staging is still on `3f7aaf91` until pushed/deployed.
- Verify the email for `Mobile.qa@outlook.com` or provide an already verified test account so onboarding and authenticated dashboards can be tested end-to-end.
- Regenerate PNG mobile app icons if the exact source icon changed; SVG assets are aligned, PNGs were not rebuilt from source artwork in this pass.
- Decide whether Dokploy project metadata should be renamed from "Staging Move" to a LocateFlow staging label. This is cosmetic/admin metadata, not runtime UI.
- Optional cleanup: serve `/manifest.webmanifest` as an alias to `/manifest.json` for tool compatibility.
- Optional cleanup: migrate local shell/runtime to Node 22.x to remove engine warnings and match repo expectations.
