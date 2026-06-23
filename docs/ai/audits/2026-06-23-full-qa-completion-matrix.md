# 2026-06-23 Full QA Completion Matrix

Status: incomplete. Authenticated web QA and self-reset are complete; native Android authenticated QA is blocked because the installed APK does not contain staging API config.

This matrix checks the original requested objective against current evidence in the worktree. It is not a release signoff.

## Requirement Matrix

| Requirement | Current State | Evidence | Gap / Next Proof Needed |
| --- | --- | --- | --- |
| Pull latest GitHub data | Done | `docs/ai/audits/2026-06-23-full-qa-audit.md` records fetch/fast-forward to `5fa41375e24082206e754ef73c043907d0343a48`. | None for this pass. |
| Review last 40 commits for logic/data consistency | Partial but substantial | `docs/ai/audits/2026-06-23-full-qa-audit.md` Source Review Notes and Dossier Source Contract Review. | A full source-security audit of every touched file was not requested as a fix pass and not all changed code was exhaustively line-reviewed. |
| Save reports/memory for illogical findings | Done, updated after authenticated QA | `docs/ai/audits/2026-06-23-full-qa-audit.md`, `docs/ai/handoffs/2026-06-23-full-qa-audit.md`, `docs/ai/memory/RISK_REGISTER.md`, `docs/ai/03_NEXT_AGENT_TASKS.md`. | Keep updating after native Android staging QA. |
| Capture public web screenshots | Done for static/public and auth-gate state | `docs/ai/screenshots/2026-06-23-full-qa/public-web/`, `public-web-viewports/`, `web-static-missing/`. Static web coverage summary says all 58 static web page routes have saved screenshots. | Authenticated content and dynamic token/id pages still need session/data. |
| Capture admin/web auth-gate screenshots | Done for unauthenticated state | `docs/ai/screenshots/2026-06-23-full-qa/admin-static/` contains all 53 admin static routes in desktop/mobile, landing on `/login` or `/set-password`. | Authenticated admin dashboards/pages not verified. |
| Capture mobile screenshots | Partial, native auth blocked | `mobile-android/` has auth-surface screenshots. `mobile-android-auth/` has sign-in attempt, UI XML, and installed APK config evidence. `mobile-source-inventory/mobile-app-route-inventory.json` lists 50 Expo routes. | Logged-in native mobile tabs require a current staging/preview APK or OTA with staging API URL. |
| Visit every web page | Mostly done for static and QA-data-backed authenticated routes | All 58 static web routes captured. Authenticated batch captured 22 routes in desktop/mobile. Dynamic QA-data routes captured for address detail/edit and service detail/edit. | Token-only reset/verify pages, blog dynamic slugs, authenticated admin, and some dynamic plan routes still need appropriate data/tokens. |
| Visit every mobile screen | Partial | Mobile source inventory: 50 Expo routes; 37 static, 13 dynamic. Auth screens were visited on Android. Installed APK API config blocked staging login. | Install staging/preview Android build, then navigate logged-in tabs, settings, Dossier, services, addresses, moving, notifications, and dynamic detail screens. |
| Test all features | Partial, broader than before | Web signup/sign-in/onboarding/address/services/custom-provider/service detail/edit/budget/Dossier/link crawl/logout self-reset were exercised. Source review and local checks cover billing/IAP, auth, onboarding, workspace scope, notifications, Dossier, mobile Home Dossier, admin guards. | Native Android logged-in runtime, authenticated admin, billing/store dashboards, and destructive/export edge flows remain outside this pass. |
| Verify Dossier data correctness | Done for authenticated web payload; PDF failed | `dossier-live/dossier-live-summary.json` records HTTP 200 full Dossier sections and HTTP 200 summary mode. Dashboard screenshots show Dossier. `authenticated-web-links/authenticated-internal-link-check.json` and `authenticated-web/026-dossier-pdf-opened.png` show PDF HTTP 500. | Fix PDF generation, then re-test PDF. Native mobile Dossier still requires staging Android build. |
| Verify links | Partial but expanded | `link-check/public-internal-link-check.json`: 18 internal links ok. `portal-enter-sentinel-check.json`: 2 bad portal redirects. `authenticated-web-links/authenticated-internal-link-check.json`: 27 logged-in internal links checked, 1 failing Dossier PDF endpoint. | External links and form-submit side effects were not exhaustively crawled. |
| Check UI/UX hidden or invisible features | Partial, expanded | Mobile public header overflow found; Dossier PDF fail found; onboarding move-plan validation fail found; Android staging config blocker found; cookie banner overlap noted. Authenticated web batch had no desktop/mobile horizontal overflow. | Native logged-in Android visual QA remains blocked. |
| Run tests | Partial | Typecheck, web/admin builds, mobile/shared/connectors tests passed. Root/admin tests failed and findings recorded. | Fix/product decisions needed before green full verification. |
| Use `mobile.qa@locateflow.com` as real user and verify self-reset | Done for web | User approved signup. `authenticated-web/` records signup/sign-in/onboarding/dashboard. `authenticated-web-logout/logout-self-reset-check.json` records logout and failed re-login with old credentials. | Native mobile could not authenticate to staging because installed APK lacks staging API config. |

## Current Blocking Requirement

Native Android authenticated QA now needs a current staging/preview Android build or OTA. Evidence shows the installed APK has no `extra.apiUrl`, no staging host/API string, and falls back to production API behavior from `apps/mobile/src/lib/api.ts:37-60`.

## Open Findings To Carry Forward

1. Mobile public web header overflows at 390px.
2. Mover/partner portal invalid magic-link redirects leak `https://0.0.0.0:3000/...`.
3. Staging sitemap is empty.
4. Authenticated Dossier PDF export returns HTTP 500.
5. Onboarding moving-plan creation validation rejects a visibly filled destination/date form.
6. Installed Android APK lacks staging API config and blocks native authenticated staging QA.
7. Cookie banner can overlap lower-right authenticated form actions.
8. `pnpm verify:tests` is red because Dossier/free copy and stale admin static tests need decisions/updates.
9. Authenticated admin and native logged-in mobile QA remain incomplete.
