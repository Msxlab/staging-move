# Source Bundle Theme Audit and Inline Token Fix - 2026-06-24

## Summary

Reviewed the supplied source bundle at `C:\Users\Windows\Downloads\New folder\Initial check requested-handoff (7)\initial-check-requested\project` against the current repo implementation. Fixed the immediate web light-mode regression that made `/dashboard` read muddy/gray: the model-generated light shadcn tokens were correct, but the inline `@layer base` block in `apps/web/src/styles/globals.css` was stale and still used the older darker beige HSL values.

Application source code was modified: yes.

## Source Bundle Map

- `Move.dc.html`: primary source prototype for the mobile app shell, light/dark tokens, main tabs, home dossier cards, and app-level animations. Repo parity is partial: web uses the theme/tokens and dossier idea, but the web dossier is a vertical row-list rather than the source horizontal dossier card rail.
- `DossierScene.dc.html`: source animation scene matrix for `weather`, `air`, `water`, `area`, `transit`, `cost`, and `housing` with many `ds-*` keyframes. Repo web ports this through `apps/web/src/components/dashboard/dossier-ambient.tsx` and `apps/web/src/styles/source-dossier-scene.css`.
- `Admin.dc.html`: source admin operations dashboard direction. Repo admin has separate Aurora token files and should be audited independently before claiming full parity.
- `Web.dc.html`, `Move Web.dc.html`, and other `Web *` files: public marketing shell, PWA registration, and marketing/onboarding routes. Not fully reworked in this pass.
- `sw.js`: source PWA cache is service-worker, offline-first, GET cache-backed. Current repo web dossier cache is not the same mechanism.
- `manifest.json` and icons: source PWA metadata/assets.
- `Auth.dc.html`, `Onboarding.dc.html`, `Providers.dc.html`, `CustomProviders.dc.html`, `Reminders.dc.html`, `Search.dc.html`, `Help.dc.html`, `Invitations.dc.html`: mobile/source flow modules. Repo mobile has native counterparts, but this pass did not modify mobile.

## Verified Findings

- Web light theme drift: `packages/shared/src/design-tokens-css.ts` and `_tokens-shadcn.generated.css` emitted `--background: 42 50% 96.08%`, but `apps/web/src/styles/globals.css` still inlined `--background: 41.25 33.33% 90.59%`. That stale inline value explains why Tailwind `bg-background` surfaces could still look gray/muddy after the prior token commit.
- Token drift guard gap: `pnpm tokens:check` previously checked generated files, but not the inline shadcn block that the app actually uses in `globals.css`.
- Web dossier scene gap: production rows include `flood`, `school`, `radon`, `evCharging`, and `neighborhood`; source `DossierScene.dc.html` does not define all of those types. The current web port now adds dedicated source-style scenes for `radon`, `school`, `ev`, and `hood` instead of mapping them onto unrelated area/transit scenes.
- Web cache: `apps/web/src/components/dashboard/home-dossier.tsx` uses browser `sessionStorage` with TTL from `Cache-Control`, and `apps/web/src/app/api/addresses/[id]/dossier/route.ts` also has request-level and coordinate-keyed backend cache. It should not constantly fetch during a fresh browser session, but it is not source-style service-worker offline-first cache.
- Mobile cache: `apps/mobile/src/lib/home-dossier-cache.ts` uses memory plus device offline cache for dossier payloads. Mobile is closer to the "user device should cache" expectation.
- Mobile light theme risk, not changed: `packages/shared/src/design-tokens.ts` still has mobile/shared `surfaceLight.background: "#EFEADF"`, and `apps/mobile/src/components/ui/HomeDossierCard.tsx` uses a dark-mode row alpha (`rgba(255,255,255,0.025)`) that is likely too weak on light paper. Mobile requires a separate notified pass.

## Changes Made

- Updated the inline light shadcn block in `apps/web/src/styles/globals.css` to match the generated model:
  - `--background: 42 50% 96.08%`
  - `--muted` / `--accent: 36 100% 97.06%`
  - `--surface-secondary: #FFF9F0`
- Updated `scripts/emit-design-tokens.ts` so `pnpm tokens:emit` also refreshes the inline web shadcn block and `pnpm tokens:check` fails if it drifts again.
- Added dedicated web source-style dossier scenes for `radon`, `school`, `evCharging`, and `neighborhood`, with matching unit coverage.
- Removed a broad `.ds-char` position shift from the dossier scene CSS before committing because it would have moved every scene character and could create unrelated visual regressions.

## Tests Run

- `pnpm tokens:emit`
- `pnpm tokens:check`
- `pnpm --filter @locateflow/web test -- dossier-ambient home-dossier route-map-card`
- `pnpm --filter @locateflow/web exec tsc --noEmit`

All passed. Local commands warned that Node `v24.13.0` is installed while the repo expects Node `22.x`.

## Not Changed

- Mobile source was not modified in this pass.
- PDF export 500 was not changed in this pass.
- Staging was not deployed from this session.
- Existing unrelated dirty files were not staged: `apps/web/src/components/marketing/landing-theme-toggle.tsx`, `docs/design-system/colors_and_type.css`, and `docs/ui-renewal/30_UIUX_REMEDIATION_PLAN_2026-06-24.md`.

## Risks

- Visual parity still needs browser screenshot QA against the supplied screenshots after staging deploy. This pass used code evidence and unit/type checks, not a live screenshot comparison.
- The source bundle's dossier card model is a horizontal card rail; current web production remains a vertical row list. That is a product/design decision to confirm, not a bug fixed here.
- The source service worker cache is broader than the current web session cache. If true offline-first web cache is required, it needs a separate PWA/cache design pass.

## Recommended Next Action

Push this follow-up commit to the existing PR branch, deploy that branch to staging, then re-check `/dashboard`, the Home Dossier rows, and the route-map labels in light mode. After that, run a separate pass for PDF export 500 and a notified mobile theme/cache visual audit.
