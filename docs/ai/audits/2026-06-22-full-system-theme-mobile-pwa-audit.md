# 2026-06-22 Full System Theme, Mobile, PWA Audit

## Latest Follow-Up: Full-Free And Theme Drift Recheck

Updated after the `Mobile.qa@locateflow.com` emulator QA pass.

What changed in this follow-up:

- Confirmed the last 50 commits already include the Claude reskin commits for web, mobile, admin, public pages, and free-pivot documentation. Key merged commits include `50107bc4`, `43aaab18`, `146cb869`, `0d6a41f8`, `957693cf`, and `0fe82d23`.
- Found and fixed a staging runtime drift where active `FREE_ACCESS` accounts could still see mobile plan cards because the staging API shape did not match the newer `consumer-free` helper assumptions.
- Added `CONSUMER_FREE_DEFAULT=true` to the Dokploy compose default and env catalog/examples so missing DB feature-flag rows do not silently re-enable caps/paywall behavior in staging.
- Removed remaining app-gate CTAs from Dossier, AI Briefing, movers, move command center, and service/address limit surfaces. These now route into the product workflow or show access-review copy instead of `/pricing`, upgrade, lock, or plan-card messaging.
- Updated the mobile Subscription screen so `FREE_ACCESS` shows an included full-access panel, no plan chooser, no upgrade action, no mobile-purchases unavailable footer, and no small mascot icon in the plan card.
- Regenerated Android launcher/splash resources from the current mobile assets and rebuilt the standalone `debugOptimized` APK.

Evidence saved:

- Android Home after rebuild: `C:\Users\Kutay\Documents\staging-move\tmp-live-qa-2026-06-22\android\61-home-after-rebuild.png`
- Android tabs after rebuild: `62-addresses-after-rebuild.png`, `63-moving-after-rebuild.png`, `64-services-after-rebuild.png`, `65-more-after-rebuild.png`
- Failed subscription check before the final fix: `66-subscription-free-panel.png`
- Passing subscription check after the final fix: `C:\Users\Kutay\Documents\staging-move\tmp-live-qa-2026-06-22\android\70-subscription-final-crown-free-panel.png`
- UI tree proof for the passing screen: `70-subscription-final-crown-free-panel.xml`

Verification passed after the follow-up:

- `pnpm --filter @locateflow/mobile exec tsc --noEmit`
- `pnpm --filter @locateflow/mobile test` -> 34 files / 326 tests passed
- `pnpm --filter @locateflow/web exec tsc --noEmit`
- `pnpm --filter @locateflow/admin exec tsc --noEmit`
- `pnpm --filter @locateflow/web test -- ...` targeted free/theme regression set -> 7 files / 142 tests passed
- `gradlew :app:assembleDebugOptimized --no-daemon --console=plain` -> Android APK build successful
- `git diff --check` -> only CRLF warnings

Theme note:

- The supplied HTML theme sources do use Gold tokens directly. Examples: `(9)\Move.dc.html`, `(9)\Raccoon.dc.html`, and `(5)\Move Web.dc.html` reference `#CBA45E`, `#DCBC7C`, and `#B0852F`.
- Current local code still follows the recorded dark-Gold / light-Sapphire split. If the owner decision is now "Sapphire in both light and dark", that should be treated as a deliberate palette override of the supplied source HTML, not as a missing import.
- Remaining visual risk: several source-theme mascot placements remain across mobile auth/home/blog/onboarding and web marketing/blog/empty states. The subscription plan card mascot was removed in this pass because it was visibly confusing in the full-free state. A no-mascot pass should be tracked as a separate explicit visual cleanup if desired.

Browser / Chrome note:

- Existing Chrome did not expose a CDP debug port on `9222`, `9223`, `9224`, or `9333`; no new Chrome window was opened. Local rendered QA used ADB and command-line checks. Live staging browser QA still needs either an existing debug-enabled Chrome session or a Dokploy deploy followed by HTTP/Playwright fallback.

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

`mobile.qa@locateflow.com` is the current QA account for mobile/web runtime checks. The registration API has allowlisted QA-account handling, including auto-verification/reset behavior for the allowlisted address, so this account can be used for login/onboarding/logout self-destruct testing without waiting for a mailbox verification link. Do not store or paste its test password in docs or chat.

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

- Push and deploy the latest full-free/mobile subscription/theme cleanup commit to Dokploy; live staging remains behind until the new commit is deployed.
- After deploy, verify `/api/build-info` reports the new commit and rerun live public smoke for `/`, `/blog`, `/features`, `/why-free`, `/sign-in`, `/sign-up`, `/onboarding`, `/offline`, `/manifest.json`, `/sw.js`, `/api/ready`, and `/api/build-info`.
- Run authenticated live web dashboard QA with `mobile.qa@locateflow.com`, including dashboard, Dossier, AI Briefing, Moving, Addresses, Services, More/Settings, logout self-destruct behavior, and PWA display/manifest checks.
- Run authenticated live admin dashboard QA once the existing Mustafa Chrome/Dokploy session can be controlled through a debug-enabled browser path or manual operator assistance.
- Decide whether to keep the source theme's Gold accent in dark mode or override all modes to Sapphire. The source HTML uses Gold, but the owner previously requested Sapphire everywhere.
- Decide whether to remove all remaining source mascot placements. The subscription plan card no longer uses it, but source-theme mascot components remain in selected auth, home, onboarding, blog, and empty states.
- Decide whether Dokploy project metadata should be renamed from "Staging Move" to a LocateFlow staging label. This is cosmetic/admin metadata, not runtime UI.
- Optional cleanup: serve `/manifest.webmanifest` as an alias to `/manifest.json` for tool compatibility.
- Optional cleanup: migrate local shell/runtime to Node 22.x to remove engine warnings and match repo expectations.
