# Handoff: 2026-06-23 Full QA Audit

## Status

Partial QA/audit completed. Authenticated web QA with `mobile.qa@locateflow.com` is complete, including logout self-reset. Native Android authenticated QA is blocked by the installed APK lacking staging API config. Application source code was not modified. Reports and screenshots were saved under `docs/ai`.

## What Changed

- Pulled latest GitHub `origin/main` and fast-forwarded to `5fa41375e24082206e754ef73c043907d0343a48`.
- Created branch `codex/full-qa-audit-2026-06-23`.
- Saved audit report: `docs/ai/audits/2026-06-23-full-qa-audit.md`.
- Saved completion matrix: `docs/ai/audits/2026-06-23-full-qa-completion-matrix.md`.
- Saved screenshots: `docs/ai/screenshots/2026-06-23-full-qa/`.
- Added source page-route inventory and screenshot coverage summaries under `docs/ai/screenshots/2026-06-23-full-qa/route-inventory/`.
- Added link-check artifacts under `docs/ai/screenshots/2026-06-23-full-qa/link-check/`.
- Added live Browser health and mobile source inventory artifacts.
- Added authenticated web signup/onboarding/dashboard screenshots, authenticated desktop/mobile route batch, dynamic address/service screenshots, authenticated link crawl, live Dossier summary, Android installed-APK config evidence, and logout self-reset proof.
- Updated Product Brain task/risk memory.

## Verification Run

- Passed `pnpm verify:typecheck`.
- Passed `pnpm --filter @locateflow/web build`.
- Passed `pnpm --filter @locateflow/admin build`.
- Passed `pnpm --filter @locateflow/mobile test`.
- Passed `pnpm --filter @locateflow/shared test`.
- Passed `pnpm --filter @locateflow/connectors test`.
- Failed `pnpm verify:tests` due web test failure, then admin package failures when run separately.
- Failed `pnpm --filter @locateflow/admin test` due stale static source tests after page/client split.

## Main Findings

1. Mobile public web header overflows at 390px viewport.
   - Evidence: `docs/ai/screenshots/2026-06-23-full-qa/public-web/mobile-home-viewport-check.png`.
   - Evidence: `docs/ai/screenshots/2026-06-23-full-qa/web-static-missing/025-mobile-account-delete.png`.
   - Source: `apps/web/src/components/marketing/marketing-header.tsx:49-69`.

2. Mover/partner portal magic-link enter routes redirect invalid links to `https://0.0.0.0:3000/...` on staging.
   - Source: `apps/web/src/app/movers/portal/enter/route.ts:13-14`.
   - Source: `apps/web/src/app/partners/portal/enter/route.ts:13-14`.

3. Public sitemap is empty on staging.

4. Test suite is red:
   - Web Dossier pricing/free-copy contract test likely needs product decision.
   - Admin step-up and plan-option tests read old wrapper files instead of current client files.

5. Public link check was green for linked internal routes, but direct portal enter sentinels are red.
   - Public internal links: 18 unique staging links, 0 issues.
   - Sentinel issue: `/movers/portal/enter` and `/partners/portal/enter` redirect to `https://0.0.0.0:3000/...`.

6. Dossier source contract is internally coherent, with one copy/product decision remaining.
   - Runtime contract: Free preview, Individual+ full Dossier, Pro PDF/neighborhood unless `CONSUMER_FREE` intentionally promotes consumer read paths to Pro.
   - Copy/test drift: shared billing says Free preview, web i18n says included/consumer-free active, failing test expects paid-ladder copy boundaries.

7. In-app Browser desktop health check was green for 6 key routes.
   - Routes: `/`, `/pricing`, `/account/delete`, `/sign-in`, `/movers/portal`, `/partners/portal`.
   - No blank page, framework overlay, relevant console warning/error, or desktop horizontal overflow.

8. Mobile source route inventory was built.
   - 50 Expo routes total: 37 static, 13 dynamic.
   - Authenticated runtime screenshots remain pending a current staging/preview Android build.

9. Authenticated web QA found new live issues.
   - Dossier PDF export returns HTTP 500 with `Failed to build dossier PDF`.
   - Onboarding move-plan creation rejects a visibly filled destination/date form.
   - Cookie preferences panel can overlap lower-right authenticated form actions.

10. Installed Android APK is not usable for staging authenticated QA.
   - Embedded config has no `extra.apiUrl`, `extra.appUrl`, or `extra.environment`.
   - APK string evidence has no `staging.locateflow.com` / `https://staging.locateflow.com/api`.
   - Source fallback returns `https://locateflow.com/api` when no public API URL is present.

11. Logout self-reset works for the web QA account.
   - After logout, the same email/password attempt stayed on `/sign-in` and showed `Invalid email or password.`

## Blocker

Native Android authenticated QA needs a current staging/preview Android build or OTA with `EXPO_PUBLIC_API_URL=https://staging.locateflow.com/api`. The user approved the QA account and the web account lifecycle is complete.

The completion matrix at `docs/ai/audits/2026-06-23-full-qa-completion-matrix.md` maps every original request to current evidence and the remaining proof gap.

## Screenshot Coverage

- Web source inventory: 74 page routes; 58 static and 16 dynamic.
- Static web screenshots: all 58 static routes now have saved desktop/mobile or public sweep screenshots.
- Follow-up protected-route set: `docs/ai/screenshots/2026-06-23-full-qa/web-static-missing/` contains 48 screenshots for the 24 static web routes missed by the public link sweep.
- Admin source inventory: 62 page routes; 53 static and 9 dynamic.
- Admin unauthenticated static sweep: `docs/ai/screenshots/2026-06-23-full-qa/admin-static/` contains 106 screenshots; 104 landed on `/login`, and 2 landed on `/set-password`.
- Authenticated web batch: `docs/ai/screenshots/2026-06-23-full-qa/authenticated-web-batch/` contains 44 screenshots for 22 logged-in routes in desktop/mobile viewports.
- Authenticated dynamic web: `docs/ai/screenshots/2026-06-23-full-qa/authenticated-web-dynamic/` contains address detail/edit, service create/detail/edit, budget, and mobile dashboard follow-up screenshots.
- Logout self-reset: `docs/ai/screenshots/2026-06-23-full-qa/authenticated-web-logout/`.
- Native Android logged-in pages remain pending because the installed build does not target staging.

## Link / Dossier Evidence

- `docs/ai/screenshots/2026-06-23-full-qa/link-check/public-internal-link-check.json`: 18 unique public/protected web internal links checked, no 404/5xx/bad redirect.
- `docs/ai/screenshots/2026-06-23-full-qa/link-check/portal-enter-sentinel-check.json`: confirms 2 bad `0.0.0.0:3000` invalid-token redirects.
- `docs/ai/screenshots/2026-06-23-full-qa/browser-health/in-app-browser-public-health.json`: in-app Browser live desktop health check for 6 public/auth-entry routes.
- `docs/ai/screenshots/2026-06-23-full-qa/authenticated-web-links/authenticated-internal-link-check.json`: 27 logged-in internal links checked; only Dossier PDF failed.
- `docs/ai/screenshots/2026-06-23-full-qa/dossier-live/dossier-live-summary.json`: full Dossier HTTP 200 with flood/school/weather/hazards/radon/water/air/housing/EV/neighborhood sections; summary mode HTTP 200; PDF HTTP 500.
- `docs/ai/screenshots/2026-06-23-full-qa/mobile-android-auth/mobile-installed-apk-api-config-summary.json`: installed Android APK staging-config blocker evidence.
- `docs/ai/screenshots/2026-06-23-full-qa/mobile-source-inventory/mobile-app-route-inventory.json`: mobile route/source QA matrix.
- Dossier source references are recorded in the main audit report under "Dossier Source Contract Review"; live Dossier references are under "Authenticated Web QA".

## Next Agent Task

1. Install or publish a current Android `preview` / `staging-preview` build with staging API config.
2. Re-run native Android logged-in flow on `Pixel_7a` and capture each tab/screen from the mobile route matrix.
3. Fix/retest Dossier PDF export.
4. Fix/retest onboarding moving-plan creation validation.
5. Fix public mobile header overflow and portal invalid-link redirect.
6. Resolve red test contracts and re-run `pnpm verify:tests`.

## Notes

- `.env` and secret files were intentionally not read.
- Staging `/api/ready` returned ready with one warning, but `/api/build-info` returned 401.
- Local Node is `v24.12.0`; repo asks for Node `22.x`, so checks emitted engine warnings.
