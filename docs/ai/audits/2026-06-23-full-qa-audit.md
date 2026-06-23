# 2026-06-23 Full QA Audit

Status: partial. Authenticated web QA completed with `mobile.qa@locateflow.com`; native Android authenticated QA is blocked by the installed APK targeting production fallback config instead of staging.

Completion matrix: `docs/ai/audits/2026-06-23-full-qa-completion-matrix.md`.

## Scope

- Pulled latest GitHub `origin/main` into a new audit branch.
- Reviewed the last 40 commits at a source-code level, focusing on billing/IAP, auth, onboarding, workspace scope, notifications, Dossier, mobile Home Dossier, admin guards, and UI changes.
- Ran safe local checks only. No `.env`, `.env.*`, credentials, private keys, browser profiles, or production data were read.
- Captured public web, protected-route auth-gate, admin unauthenticated, and Android emulator auth screenshots.
- After user approval, created and exercised the staging QA account `mobile.qa@locateflow.com` with a random password kept only in runtime memory.
- Completed web onboarding, created a QA address, opened authenticated web desktop/mobile pages, created a custom QA service, checked live Dossier data, and verified logout self-reset.
- Added a requirement-by-requirement completion matrix so remaining proof gaps are explicit.
- Did not modify application source code.

## Git / Runtime

- Started from `codex/fix-web-mobile-overflow`.
- Fetched GitHub and fast-forward merged `origin/main`.
- Current audit branch: `codex/full-qa-audit-2026-06-23`.
- Current HEAD after pull: `5fa41375e24082206e754ef73c043907d0343a48`.
- Staging `/api/ready`: HTTP 200, `ready: true`, `requiredOk: true`, `missingRequiredCount: 0`, `warningCount: 1`.
- Staging `/api/build-info`: HTTP 401, so commit parity could not be verified through that endpoint.
- Staging `sitemap.xml`: HTTP 200 but empty `<urlset>`.

## Screenshot Artifacts

Saved under `docs/ai/screenshots/2026-06-23-full-qa/`.

- `public-web/`: 68 full-page screenshots plus `public-web-screenshot-index.json`.
- `public-web-viewports/`: 68 desktop/mobile viewport screenshots plus `public-web-viewport-index.json`.
- `web-static-missing/`: 48 desktop/mobile screenshots for source-inventoried web static routes not covered by the public link sweep, plus `web-static-missing-index.json`.
- `admin-static/`: 106 desktop/mobile screenshots for all source-inventoried admin static routes, plus `admin-static-index.json`.
- `route-inventory/`: source page-route inventory, initial coverage, and final static coverage summaries.
- `link-check/`: public internal link check and portal enter sentinel redirect check.
- `browser-health/`: in-app Browser live desktop route health checks.
- `authenticated-web/`: staging signup, sign-in, onboarding, dashboard, and Dossier PDF failure screenshots.
- `authenticated-web-batch/`: 44 authenticated web screenshots across 22 routes in desktop and mobile viewports.
- `authenticated-web-dynamic/`: address detail/edit, service custom-provider form, service create/detail/edit, budget after service, and mobile dashboard follow-up screenshots.
- `authenticated-web-links/`: authenticated internal link crawl.
- `authenticated-web-logout/`: logout and self-reset verification screenshots.
- `dossier-live/`: live authenticated Dossier API summary.
- `mobile-source-inventory/`: Expo mobile route inventory and authenticated QA matrix.
- `mobile-android/`: 4 Android screenshots and 5 UI XML dumps.
- `mobile-android-auth/`: Android staging-login attempt, installed APK public config summary, and API-target blocker evidence.
- Total saved after authenticated pass: 386 `.png`, 8 `.xml`, 21 `.json`.

Important files:

- `public-web-viewports/037-mobile-home.png`
- `public-web/mobile-home-viewport-check.png`
- `web-static-missing/025-mobile-account-delete.png`
- `admin-static/admin-static-index.json`
- `link-check/public-internal-link-check.json`
- `link-check/portal-enter-sentinel-check.json`
- `browser-health/in-app-browser-public-health.json`
- `authenticated-web-batch/authenticated-web-batch-index.json`
- `authenticated-web-dynamic/authenticated-custom-service-check.json`
- `authenticated-web-links/authenticated-internal-link-check.json`
- `authenticated-web-logout/logout-self-reset-check.json`
- `dossier-live/dossier-live-summary.json`
- `mobile-source-inventory/mobile-app-route-inventory.json`
- `mobile-android/001-launch.png`
- `mobile-android/002-sign-up.png`
- `mobile-android/003-sign-up-acknowledgements.png`
- `mobile-android/004-forgot-password.png`
- `mobile-android-auth/mobile-installed-apk-api-config-summary.json`

## Route Inventory / Coverage

Source page-route inventory:

- Web: 74 page routes, 58 static, 16 dynamic.
- Admin: 62 page routes, 53 static, 9 dynamic.

Web screenshot coverage:

- The first public web sweep covered 34 of 58 static web page routes.
- The follow-up source-inventory sweep captured the remaining 24 static routes in desktop and mobile viewports.
- Result: all 58 static web page routes now have at least one saved screenshot artifact.
- Auth-required web routes correctly redirected to `/sign-in?redirect=...` while unauthenticated.
- Authenticated batch pass captured 22 logged-in routes in desktop and mobile viewports: `/dashboard`, `/addresses`, `/addresses/new`, `/services`, `/services/new`, `/providers`, `/budget`, `/expenses` -> `/budget`, `/moving`, `/moving/new`, `/notifications`, `/settings`, seven settings subpages, `/support`, and `/help`.
- Authenticated dynamic pass visited `/addresses/cmqqtosf4000pbuyqyv6buarl`, `/addresses/cmqqtosf4000pbuyqyv6buarl/edit`, `/services/cmqqufmw10032buyqbutrjkd7`, and `/services/cmqqufmw10032buyqbutrjkd7/edit`.
- Token-only routes such as reset/verify token pages and admin authenticated pages were not exercised.

Admin screenshot coverage:

- All 53 static admin page routes were visited in desktop and mobile viewports.
- 104 of 106 admin captures ended at `/login`.
- The two `set-password` captures ended at `/set-password`.
- No admin static capture had horizontal overflow while unauthenticated.
- Authenticated admin content remains unverified because no admin credential use was approved in this pass.

## Link / Redirect Checks

- Public internal link check: 18 unique staging-internal links collected from the public/protected web screenshot indexes; all returned an acceptable status/redirect chain.
- Sentinel portal enter check: `/movers/portal/enter` and `/partners/portal/enter` both returned HTTP 307 to `https://0.0.0.0:3000/...`, confirming the portal redirect finding.
- Authenticated internal link check: 27 links collected from logged-in web screenshots. 26 passed; `/api/addresses/cmqqtosf4000pbuyqyv6buarl/dossier/pdf` returned HTTP 500 with `{"error":"Failed to build dossier PDF"}`.
- External links, `mailto:`, `tel:`, and destructive/form-submit actions were intentionally not crawled.

## Browser Health Checks

- In-app Browser live check covered `/`, `/pricing`, `/account/delete`, `/sign-in`, `/movers/portal`, and `/partners/portal`.
- At the Browser tab's desktop viewport (`1280px`), all 6 routes had meaningful DOM content, no framework overlay text/selectors, no relevant console errors/warnings, and no horizontal overflow.
- This does not replace the mobile viewport screenshot evidence; the 390px mobile overflow remains open and is recorded separately.

## Mobile Source Route Inventory

- Expo mobile app inventory: 50 routes total, 37 static, 13 dynamic.
- Main tabs: `/`, `/addresses`, `/moving`, `/services`, `/more`.
- Settings routes: 10 static settings screens.
- Dynamic routes include address/service/move/provider/custom-provider/blog/budget/help ticket/reset/invite token screens that require seed data, IDs, or tokens.
- The inventory was saved as a QA matrix; it does not prove runtime rendering of authenticated mobile screens.

## Dossier Source Contract Review

Verified from source:

- The web Dossier route is authenticated, workspace scoped, and foreign-scope addresses 404 instead of 403 (`apps/web/src/app/api/addresses/[id]/dossier/route.ts:499`).
- `summary=1` returns the lightweight current-home summary using AirNow and HUD housing only (`apps/web/src/app/api/addresses/[id]/dossier/route.ts:518-571`).
- Free/free-trial without full entitlement gets the preview subset: flood, school, moving-day weather, and locked sections list (`apps/web/src/app/api/addresses/[id]/dossier/route.ts:574-669`).
- Full Dossier includes flood, school, weather, hazards, radon, water, air, housing, EV charging, and neighborhood (`apps/web/src/app/api/addresses/[id]/dossier/route.ts:858-870`).
- Neighborhood Intelligence is Pro-only; non-Pro entitled users get a locked per-section teaser (`apps/web/src/app/api/addresses/[id]/dossier/route.ts:219-225`, `apps/web/src/app/api/addresses/[id]/dossier/route.ts:840-856`).
- Dossier PDF is Pro-only and delegates to the data route instead of re-implementing lookups (`apps/web/src/app/api/addresses/[id]/dossier/pdf/route.ts:13-54`).
- Mobile fetches the full dossier, caches it offline/memory, and degrades to cached/hidden state on network errors (`apps/mobile/src/lib/home-dossier-cache.ts:167-210`, `apps/mobile/src/components/ui/HomeDossierCard.tsx:175-177`).
- Mobile presentation sanitizes each row independently and hides missing/degraded data instead of fabricating fallback facts (`apps/mobile/src/lib/home-dossier.ts:277-581`).

Open contract/copy issue:

- The feature matrix and shared billing definitions still describe Free as `Home Dossier preview` and Individual+ as full (`packages/shared/src/workspace-entitlements.ts:56-59`, `packages/shared/src/billing.ts:63-75`).
- Web i18n currently says Free has `Home Dossier included` and that full sections/exports are included when consumer-free access is active (`apps/web/src/i18n/messages/en.json:388`, `apps/web/src/i18n/messages/en.json:641`).
- `CONSUMER_FREE` can legitimately make free/no-management consumers resolve to Pro limits (`apps/web/src/lib/plan-limits.ts:115-150`), so this may be an intentional free-pivot copy state rather than a runtime bug.
- The failing web test still asserts the paid-ladder copy boundary and expects `Individual` and `Pro` to appear in the preview copy (`apps/web/src/lib/pricing-free-tier-contract.test.ts:149-187`).

## Authenticated Web QA

QA account:

- User-approved staging signup: `mobile.qa@locateflow.com`.
- Random password was generated and kept in runtime memory only; it was not written to disk or printed.
- Signup showed `Account ready`; sign-in redirected to `/onboarding?step=legal`.
- Legal terms/disclaimer checkboxes enabled the continue action.
- Profile step used the signup name.
- Address step saved the public landmark address `350 5th Avenue, New York, NY 10118` as `QA Home`.
- Services onboarding correctly showed no listed providers for NY and allowed continuing without providers.
- Moving onboarding reproduced a validation bug: after selecting or manually entering `1600 Amphitheatre Pkwy, Mountain View, CA 94043` and a move date of `2026-06-26`, `Create Plan & Go` stayed on the same step with `Please fill in destination city, state, ZIP, and move date.` even though the fields were visibly populated.
- Completing onboarding without a move plan led to `/dashboard`.

Authenticated route coverage:

- Batch screenshots: 44 desktop/mobile captures across 22 logged-in routes.
- Dynamic screenshots: address detail/edit, custom provider form, custom service creation, service detail/edit, budget after service, and mobile dashboard.
- Created QA data:
  - Address: `QA Home` in New York, NY.
  - Custom provider/service: `QA Electric Utility`, category `Electric`.
- The services list updated to one active service and budget stayed `$0.00` because no recurring cost was entered.
- Logout self-reset was verified: after web logout, the same email/password attempt stayed on `/sign-in` with `Invalid email or password.`

Authenticated Dossier live result:

- `/api/addresses/cmqqtosf4000pbuyqyv6buarl/dossier`: HTTP 200.
- Full live sections present: flood, school, weather, hazards, radon, water, air, housing, EV charging, neighborhood, and `dossierPdf`.
- Example live values: flood zone `X`, school district `New York City Department Of Education`, hazard rating `Relatively Low`, radon zone `3`, air AQI `31 Good`, HUD area `New York, NY HUD Metro FMR Area`, EV charging nearest distance `0.08741` miles, neighborhood walk score `16.3`.
- `/api/addresses/cmqqtosf4000pbuyqyv6buarl/dossier?summary=1`: HTTP 200 with air and housing only.
- `/api/addresses/cmqqtosf4000pbuyqyv6buarl/dossier/pdf`: HTTP 500 with `Failed to build dossier PDF` despite `dossierPdf: true` in the full Dossier payload and the visible dashboard export link.

## Local Checks

Environment note: local Node is `v24.12.0`; repo engine asks for Node `22.x`. Commands emitted engine warnings but ran.

Passed:

- `pnpm verify:typecheck`
- `pnpm --filter @locateflow/web build`
- `pnpm --filter @locateflow/admin build`
- `pnpm --filter @locateflow/mobile test`
- `pnpm --filter @locateflow/shared test`
- `pnpm --filter @locateflow/connectors test`

Failed:

- `pnpm verify:tests`
- `pnpm --filter @locateflow/admin test`

Failures:

1. Web `apps/web/src/lib/pricing-free-tier-contract.test.ts:149-187`
   - The test expects dossier/free-preview copy to mention `Individual` and `Pro`.
   - Current EN copy at `apps/web/src/i18n/messages/en.json:640-641` says full Home Dossier and exports are included when `consumer-free` access is active.
   - This is either accepted consumer-free copy drift with stale test expectations, or a real pricing/package copy inconsistency. Product decision needed.

2. Admin `apps/admin/src/app/admin-step-up-ui.test.ts:13-18`
   - Test reads `src/app/(admin)/state-rules/page.tsx`.
   - Current protected UI lives in `src/app/(admin)/state-rules/state-rules-client.tsx`.
   - Source evidence shows `PasswordConfirmModal`, `confirmPassword`, `requiresPassword`, and `fetch("/api/state-rules")` are present in the client file.
   - Likely stale test target after page/client split, not a broken UI path.

3. Admin `apps/admin/src/app/admin-plan-options.test.ts:11-28`
   - Test reads `src/app/(admin)/users/page.tsx`, but plan controls moved into `src/app/(admin)/users/users-client.tsx`.
   - `users-client.tsx:73-103` includes `FREE_TRIAL`, `INDIVIDUAL`, `FAMILY`, and `PRO` filter/chip options.
   - `users/[id]/user-detail-client.tsx:72-76` grant action still exposes only `INDIVIDUAL`, `FAMILY`, `PRO`; that may be intentional because manual premium grants are not trial creation. Product/admin decision needed before changing.

## Findings

### P1: Mobile public web header overflows on public pages

Evidence:

- Screenshot: `docs/ai/screenshots/2026-06-23-full-qa/public-web/mobile-home-viewport-check.png`
- Screenshot: `docs/ai/screenshots/2026-06-23-full-qa/web-static-missing/025-mobile-account-delete.png`
- Runtime DOM at 390px viewport: document width `495`, viewport width `390`.
- Header action group had bounds `left=190`, `right=495`, width `305`.
- Source: `apps/web/src/components/marketing/marketing-header.tsx:49-69`.

Impact:

- On mobile, the right-side `Sign In` / `Get started` area is cut off and creates horizontal scrolling.
- The same header appears across many public pages; the issue was reproduced on the homepage and `/account/delete`.

Recommended fix:

- Hide or collapse desktop auth buttons at mobile widths and rely on `MarketingMobileNav`, or make the header action group responsive with strict max-width and no document overflow.
- Re-test mobile public pages at 390px and 360px widths.

### P1: Portal magic-link enter routes redirect to `https://0.0.0.0:3000`

Evidence:

- Live staging:
  - `/movers/portal/enter` returns `307 Location: https://0.0.0.0:3000/movers/portal?error=invalid`.
  - `/partners/portal/enter` returns `307 Location: https://0.0.0.0:3000/partners/portal?error=invalid`.
- Source:
  - `apps/web/src/app/movers/portal/enter/route.ts:13-14`
  - `apps/web/src/app/partners/portal/enter/route.ts:13-14`

Impact:

- Invalid/expired magic links expose an internal host and send users to a dead origin.
- The code uses `new URL(dest, request.url)`; staging appears to build `request.url` from the internal listener instead of the public host.

Recommended fix:

- Build redirects from a trusted public app URL helper, or normalize forwarded host/proto before redirecting.
- Add route tests for forwarded-host/proxy scenarios and invalid-token redirects.

### P2: Public sitemap is empty

Evidence:

- `https://staging.locateflow.com/sitemap.xml` returned HTTP 200 with an empty `<urlset>`.

Impact:

- Search/discovery QA cannot rely on sitemap.
- Public route coverage may be invisible to crawlers if production has the same behavior.

Recommended fix:

- Populate sitemap from canonical public routes/blog posts, or explicitly document why staging sitemap is intentionally empty.

### P2: Test contracts are stale or product copy needs a decision

Evidence:

- Web and admin test failures listed above.

Impact:

- `pnpm verify:tests` is red after latest pull even though typecheck/build pass.
- Future agents cannot use root test success as a release signal until these are resolved.

Recommended fix:

- Decide consumer-free Dossier copy contract.
- Update admin static source tests to read the actual `*-client.tsx` files after page/client split.
- Decide whether admin manual grants should include `FREE_TRIAL`.

### P1: Authenticated Dossier PDF export fails

Evidence:

- Dashboard displayed a visible `Export PDF` link for `QA Home`.
- Manual Browser open of `/api/addresses/cmqqtosf4000pbuyqyv6buarl/dossier/pdf` showed `{"error":"Failed to build dossier PDF"}`.
- Authenticated internal link crawl reproduced the same route as HTTP 500.
- Live Dossier data route returned HTTP 200 and included `dossierPdf: true`.
- Source catch path: `apps/web/src/app/api/addresses/[id]/dossier/pdf/route.ts:71-88`.

Impact:

- A user with visible/full Dossier access cannot export the PDF proof packet.
- The UI advertises an action that fails server-side.

Recommended fix:

- Inspect `generateDossierReportPdf(data as PdfDossier, userName)` against the current Dossier payload shape.
- Add a route test using a current full Dossier fixture and assert `Content-Type: application/pdf`.

### P1: Installed Android build cannot authenticate against staging QA

Evidence:

- Android login with `mobile.qa@locateflow.com` returned `Invalid email or password` after the same credentials worked on staging web.
- Installed APK config summary: `docs/ai/screenshots/2026-06-23-full-qa/mobile-android-auth/mobile-installed-apk-api-config-summary.json`.
- Installed APK public config has no `extra.apiUrl`, `extra.appUrl`, or `extra.environment`.
- APK string scan found no `https://staging.locateflow.com/api` or `staging.locateflow.com`, while production API fallback string evidence is present.
- Installed APK embedded build commit: `12cfb8377ec1`, older than current audit HEAD `5fa41375e24082206e754ef73c043907d0343a48`.
- Source fallback: `apps/mobile/src/lib/api.ts:37-60` returns `envApiUrl || "https://locateflow.com/api"` when no Expo extra API URL exists.
- `apps/mobile/eas.json:32-60` defines the expected preview/staging env values, so the installed build does not match the intended staging QA profile.

Impact:

- Native Android logged-in tabs, mobile Home Dossier, mobile services, mobile moving, and mobile settings cannot be verified against staging with the installed app.
- A tester may think the staging QA account is wrong when the app is actually pointed at production/fallback config.

Recommended fix:

- Install a current `preview` or `staging-preview` Android build whose embedded config/OTA includes `EXPO_PUBLIC_API_URL=https://staging.locateflow.com/api`.
- Add a visible non-secret build/environment indicator on internal builds, or expose an authenticated-safe diagnostics row for API base/environment.

### P2: Onboarding moving-plan creation validation blocks a filled form

Evidence:

- Authenticated onboarding moving step screenshots: `docs/ai/screenshots/2026-06-23-full-qa/authenticated-web/016-onboarding-moving-filled.png`, `017-onboarding-after-create-plan.png`, `019-onboarding-moving-refilled-manual.png`, `020-onboarding-after-manual-create-plan.png`.
- Both autocomplete-selected and manually-filled destination forms showed destination city/state/ZIP/date, then returned `Please fill in destination city, state, ZIP, and move date.`
- Source validation message: `apps/web/src/app/onboarding/onboarding-client.tsx:834-850`.

Impact:

- New users who choose `Yes, plan my move` during onboarding cannot complete move-plan creation even when the visible fields are populated.
- The user can continue only by cancelling and choosing `Not right now`, which skips the main move-plan activation moment.

Recommended fix:

- Check whether the autocomplete/manual input values update `movingForm.city`, `movingForm.state`, `movingForm.zip`, and `movingForm.moveDate` before `validateMovingForm()`.
- Add an onboarding e2e/regression test for selecting a Places autocomplete destination plus manually entering city/state/ZIP/date.

### P3: Cookie banner can obscure lower-right form actions in authenticated web

Evidence:

- Screenshots: `authenticated-web-dynamic/005-services-custom-provider-form.png`, `002-address-details.png`, and `013-service-edit-after-click.png`.
- The cookie preference panel overlays the lower-right action area on authenticated pages until dismissed.

Impact:

- First-session users may have to dismiss cookie preferences before seeing or clicking lower-right save/create actions.

Recommended fix:

- Consider placing the cookie banner so it does not cover authenticated form CTAs, or auto-hide it after an explicit decline/accept state is stored.

## Source Review Notes

The last-40-commit source review did not find obvious regressions in:

- IAP account-token binding and flag-gated enforcement.
- Register/profile/budget transaction wrapping.
- Server-side onboarding completion gate requiring at least one scoped address.
- Workspace-scoped moving migration and budget actual paths.
- Notification preference fan-out and feed load-error handling.
- GDPR/account deletion Lead and residual cleanup.
- Admin page-level guards, including `runtime-config` using `requirePageRole("SUPER_ADMIN")`.
- Dossier route summary/preview/full modes and Pro-only PDF route delegation.
- Mobile Home Dossier chip-row and self-fetching card contract.
- Mobile API fallback logic; the installed APK did not contain staging API config, so native staging auth was blocked by build/config rather than the QA credentials.

Nuance:

- Mobile Home Dossier comment says current home by default, while active move destination wins when moving (`apps/mobile/app/(tabs)/index.tsx:1181-1186`). This appears intentional from the comment itself, but product should confirm if "current home by default" should always beat destination.

## Mobile Android

Environment:

- Android SDK found at `%LOCALAPPDATA%\Android\Sdk`.
- AVDs: `Pixel_10_Pro`, `Pixel_7a`.
- Booted `Pixel_7a` as `emulator-5554`.
- Installed app: `com.locateflow.mobile`, `versionName=1.0.2`, `versionCode=21`.

Screens captured:

- Sign in.
- Sign up top/form.
- Sign up acknowledgements.
- Forgot password.
- Authenticated login attempt with `mobile.qa@locateflow.com`, showing `Invalid email or password`.
- Installed APK public config summary and API-target evidence.

Completed:

- Verified native Android package/version and activity.
- Verified installed APK lacks staging API config and therefore cannot authenticate against the staging QA account.

Not completed:

- Native Android logged-in tabs, Dossier, moving, services, addresses, notifications, and dynamic mobile screens. A current staging/preview Android build is required before these can be completed.

## Recommended Next Actions

1. Fix mobile public web header overflow.
2. Fix portal enter redirect public-origin handling.
3. Fix Dossier PDF generation for the current live Dossier payload shape.
4. Fix onboarding moving-plan creation validation for the filled destination/date form.
5. Install or publish a current Android staging/preview build with `EXPO_PUBLIC_API_URL=https://staging.locateflow.com/api`, then re-run native logged-in mobile QA.
6. Decide/update the Dossier pricing/free copy contract.
7. Update stale admin static tests after page/client split.
8. Re-run `pnpm verify:typecheck`, `pnpm verify:tests`, web/admin builds, and native Android staging screenshot QA.
