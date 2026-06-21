# Staging Runtime QA Evidence - 2026-06-21

## Scope

Runtime QA pass for the Dokploy staging deployment of `Msxlab/staging-move` on
branch `codex/staging-audit-2026-06-21`.

Live targets:

- Web: `https://staging.locateflow.com`
- Admin: `https://admin-staging.locateflow.com`
- Imgproxy: `https://img-staging.locateflow.com`
- Dokploy compose service: `Staging Move` / `staging-move-phkdb4`

## Captured Screenshots

Captured with the already-open Chrome session, not a new browser.

| Step | Screenshot | Result |
| --- | --- | --- |
| 1 | `01-web-home-desktop.jpg` | Web homepage rendered at desktop size. Hero, nav, CTA, theme/language controls, and cookie preference panel are visible. |
| 2 | `02-web-pricing-desktop.jpg` | Pricing rendered at desktop size with annual/monthly control and Individual/Family/Pro cards. |
| 3 | `03-web-dashboard-auth-redirect-desktop.jpg` | `/dashboard` redirected to `/sign-in?redirect=%2Fdashboard` and rendered the sign-in form. |
| 4 | `05-dokploy-containers-desktop.jpg` | Dokploy containers show web/admin healthy, migrate exited 0, mysql healthy, imgproxy running, cron exited. |

Admin login screenshot was intentionally rejected and deleted because the local
Chrome profile autofilled account data into the form. Code inspection confirms
`apps/admin/src/app/login/page.tsx` initializes `email` and `password` as empty
state; the visible fill was browser autofill, not an app default.

## Live HTTP Smoke

Last checked after deploy commit `32c4a7d6d0105c990fa8acf799c54a8497e9e4cd`.

| Check | Result |
| --- | --- |
| Web `/api/ready` | `200`, `ready:true`, `requiredOk:true`, `missingRequiredCount:0`, `database:"ready"` |
| Admin `/api/ready` | `200`, `ready:true`, `requiredOk:true`, `missingRequiredCount:0`, `database:"ready"` |
| Web `/api/build-info` | `service:"web"`, commit `32c4a7d6...`, branch `codex/staging-audit-2026-06-21`, `environment:"staging"` |
| Admin `/api/build-info` | `service:"admin"`, commit `32c4a7d6...`, branch `codex/staging-audit-2026-06-21`, `environment:"staging"` |
| Web `/api/health` | `200`, `status:"healthy"`, `ready:true` |
| Admin `/api/healthz` | `200`, `{"ok":true,"service":"admin"}` |
| Web `/dashboard` | `307` to `/sign-in?redirect=%2Fdashboard` |
| Admin `/` | `307` to `/login` |
| Admin `/login` | `200` |
| Web `robots.txt` | `200`, `Disallow: /` |
| Imgproxy `/` | `200` |
| Staging noindex | Web and admin responses include `X-Robots-Tag: noindex, nofollow, noarchive`. |

## Docker Node 22 Verification

The host Node remains `v24.12.0`; repo verification was run in Docker Node 22
with named `node_modules` volumes.

Commands passed:

- `pnpm verify:typecheck`
- `pnpm verify:tests`
- `pnpm --filter @locateflow/admin test src/middleware.test.ts src/app/api/ready/route.test.ts`
- `pnpm --filter @locateflow/db exec prisma validate`

Known test-environment noise:

- Docker/Corepack needed `NODE_TLS_REJECT_UNAUTHORIZED=0` because this local
  container path still has registry certificate-chain verification issues.
- Some tests intentionally print Prisma dummy-DB, Redis fallback/fail-closed,
  backup mock-model, and Stripe/API failure logs while still exiting 0.

## Mobile Smoke Status

Confirmed from source and the Docker Node 22 gates:

- `apps/mobile/eas.json` preview and staging-preview profiles point to
  `https://staging.locateflow.com/api` and `https://staging.locateflow.com`.
- Production profile still targets `https://locateflow.com`.
- iOS associated domains and Android intent filters remain canonical
  `locateflow.com`, matching the narrowed default OAuth callback allowlist.
- Mobile typecheck and tests were covered by `pnpm verify:typecheck` and
  `pnpm verify:tests`.

Not completed:

- Android emulator/device runtime QA was not run because `adb` is not installed
  or available in this Windows environment.
- iOS simulator QA was not run from this Windows environment.

## Product Design / UX Notes

Evidence comes from the captured screenshots only, so this is not a full WCAG
claim.

Strengths:

- Homepage and pricing use the same dark Aurora visual language and typography.
- Dashboard auth redirect lands on a clear sign-in surface.
- Dokploy status evidence is clean after the admin healthcheck/readiness fixes.

Risks / follow-ups:

| ID | Severity | Area | Evidence | Problem | Risk | Fix | Test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RTQA-001 | P2 | Public UX | `01-web-home-desktop.jpg`, `02-web-pricing-desktop.jpg`, `03-web-dashboard-auth-redirect-desktop.jpg` | Cookie preferences panel persisted over public and auth screens at bottom-right. It did not block the primary form on desktop, but occupied a large visual region and could cover lower-page content. | Lower trust/clarity on first visit, especially on smaller screens. | Fixed in source after the initial screenshots: `apps/web/src/components/shared/cookie-consent.tsx` now uses a compact non-modal region, smaller radius/padding, bounded height, mobile-safe max width, and an auth-surface compact mode. | `pnpm --filter @locateflow/web test src/components/shared/cookie-consent.test.ts`, `pnpm verify:typecheck`, and `pnpm verify:tests` passed in Docker Node 22. Live browser recapture remains required after redeploy. |
| RTQA-004 | P2 | Admin theme integration | Static repo baseline after the user reported staging theme drift. `apps/admin/src/app/globals.css` claimed to mirror web/shared Aurora, but legacy `--rose` / `--brand-orange` aliases resolved to honey while web/shared resolve them to cool-blue primary. `apps/admin/src/app/aurora.css` also redirected scoped `--rose` / `--brand-orange` to the legacy `--au-violet` variable, which currently stores honey. | Admin surfaces could render primary/legacy classes with premium honey instead of the shared cool-blue primary, making staging feel only partially integrated with the web/mobile theme. | Fixed in source: admin global and scoped Aurora token bridges now keep `rose/orange` aliases on cool-blue and leave `foil/amber` on honey/champagne. Added `apps/admin/src/app/aurora-theme-regression.test.ts`. | `pnpm --filter @locateflow/admin test src/app/aurora-theme-regression.test.ts`, `pnpm verify:typecheck`, and `pnpm verify:tests` passed in Docker Node 22. User-provided external theme source is still pending for final pixel/token diff. |
| RTQA-002 | P2 | Security scan coverage | Codex Security preflight returned `status:"incomplete"` because active multi-agent mode/usable worker slots were unknown to the helper. | A full delegated repository-wide Codex Security scan cannot be honestly claimed complete from this parent-agent pass. | Overstated security assurance if treated as exhaustive. | Start a proper Codex Security scan workspace or provide verified multi-agent runtime facts/capacity, then run threat-model, discovery, validation, attack-path, and final report phases. | Codex Security scan artifacts under the scan directory with coverage ledger and final report. |
| RTQA-003 | P2 | Mobile runtime QA | `adb devices` failed because `adb` is not installed/available. | Mobile source/config tests pass, but real Android runtime, deep links, app lock, OAuth handoff, and performance were not exercised on device. | Store/runtime regressions can remain hidden. | Provide Android SDK/ADB or an emulator target, then run the Android QA/performance pass. | Emulator screenshots/logs and `adb devices` evidence. |

## Current Runtime Conclusion

Staging web/admin/imgproxy are live and healthy on subdomains. Automated Node 22
typecheck, full test gate, Prisma validation, the focused cookie-banner
regression gate, and the focused admin theme-token regression gate pass.
Remaining work is not basic deployment; it is authenticated web/admin flow QA,
real mobile device QA, live recapture after redeploy, final diff against the
user-provided theme package, and the proper delegated Codex Security scan if
exhaustive security coverage is required.
