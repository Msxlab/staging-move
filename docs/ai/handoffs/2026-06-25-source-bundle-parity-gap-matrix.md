# 2026-06-25 Source bundle parity gap matrix

Scope: compared the current repo against the source bundle at
`C:\Users\Windows\Downloads\New folder\Initial check requested-handoff (7)\initial-check-requested`
for web/mobile/admin theme, route map, dossier animation, cache, PDF export,
workspace gating, and consumer-free entitlements. No secrets, env files,
production data, or destructive commands were used.

## Source contract checked

- `project/Move.dc.html` lines 244-257 defines the route map as a themed map
  surface (`--mapBg`, `--mapGrid`, `--mapRouteBase`) with a dashed route and a
  `mv-travel` moving vehicle on the route.
- `project/Move.dc.html` lines 996-1048 defines the light source theme with
  `bg:'#EFEADF'`, `surface:'#FFFFFF'`, and light map
  `linear-gradient(180deg,#dde6ef,#cdd8e6)`.
- `project/DossierScene.dc.html` lines 13-49 defines the dossier scene motion
  keyframes. The current web CSS/React coverage was compared by source class
  names and no missing `ds-*` keyframe/class used by web was found.
- `project/Admin.dc.html` is a compact dark operations console. Current admin is
  a broader Aurora enterprise retune, not a direct source clone.

## Fixed in web in this pass

- `apps/web/src/components/dashboard/route-map-card.tsx`
  - Added a source-style route base stroke and route traveler on the fallback
    SVG.
  - Changed the fallback canvas from dark-fixed chrome to theme-aware source-map
    variables.
- `apps/web/src/styles/globals.css`
  - Added `@keyframes lf-route-map-travel`.
  - Added `.lf-route-map-canvas` dark/light source map variables:
    dark `#0d1830 -> #0a1120`, light `#dde6ef -> #cdd8e6`.
  - Added reduced-motion handling for the traveler.
- `apps/web/src/components/dashboard/route-map-card.test.tsx`
  - Added assertions for the source light map palette, route base stroke, and
    traveler animation.

Note: the prior hotfix already restored the light app canvas to source beige
`#EFEADF` in `apps/web/src/styles/globals.css` and `apps/web/src/app/layout.tsx`.

## Verified web facts

- Dossier source deck exists in web code:
  `apps/web/src/components/dashboard/home-dossier.tsx` lines 876, 929, 954, and
  989 render `lf-dossier-source-deck` and hide the row grid in compact source
  mode. If staging still shows only the old row-list, the deployed JS/CSS is not
  the latest branch output or the source-card preconditions are not met.
- Household invite initial focus is already fixed in web:
  `apps/web/src/components/dashboard/household-activation-card.tsx` lines 105,
  135, 229-230, and 482 focus the first email field; test coverage is in
  `household-activation-card.test.tsx` lines 162-164.
- Consumer-free entitlement is wired for web:
  `packages/shared/src/consumer-free.ts` lines 48-65 upgrades eligible consumers
  to `PRO`; `apps/web/src/lib/feature-flags.ts` lines 24-32 defaults
  `CONSUMER_FREE` on; `apps/web/src/lib/plan-limits.ts` lines 137-182 returns
  `plan: "PRO"` / `hasPremium: true`.
- Workspace creation is separately feature-flagged:
  `apps/web/src/lib/workspace-context.ts` lines 97-98 reads
  `WORKSPACE_MODEL_ENABLED`; `apps/web/src/app/api/workspaces/route.ts` lines
  13-24 returns `workspaceModelEnabled:false` when off; the settings UI shows
  "Shared workspaces are coming soon" in
  `apps/web/src/app/(app)/settings/workspace/workspace-client.tsx` lines
  617-622. This is not an entitlement miss; staging must enable the workspace
  model flag to show creation.
- Web cache is not browser API caching:
  `apps/web/public/sw.js` lines 13, 30, 34, and 54 explicitly exclude `/api/*`;
  dossier API uses private response cache headers and `X-Dossier-Cache` in
  `apps/web/src/app/api/addresses/[id]/dossier/route.ts` lines 60-62 and
  123-124; section data is cached server-side through `getOrFetchSection` at
  lines 813-834.
- PDF 500 needs staging server logs if it persists:
  local regression tests pass for the route and the standalone `pdfkit` font
  shim. `apps/web/src/app/api/addresses/[id]/dossier/pdf/route.ts` lines 88-96
  logs the real server error before returning the generic JSON. The browser only
  sees `{"error":"Failed to build dossier PDF"}`.

## Read-only gaps still open

- Mobile dossier parity is not complete:
  `apps/mobile/src/components/ui/HomeDossierCard.tsx` lines 137 and 576 still
  describe paid-plan/Pro-only dossier behavior; `apps/mobile/src/lib/plan-comparison.ts`
  lines 121-124 and 228-231 still expose the old paid ladder. Mobile was not
  modified in this pass.
- Mobile source deck parity is not complete:
  the mobile dossier card still renders the older row-list pattern, not the web
  source deck/toggle/dots model.
- Admin visual parity is a product decision:
  `apps/admin/src/app/aurora.css` lines 2-5 declares a Phase 3 corporate retune;
  `apps/admin/src/lib/admin-nav.ts` lines 77-139 contains a much larger real
  admin IA than the source Admin prototype. This may be intentional, but it is
  not a direct source match.

## Staging diagnosis order

1. Confirm Dokploy deployed a commit at or after this branch HEAD.
2. Hard-reload staging and check that `/dashboard` has `#EFEADF` page canvas,
   white panels, and light route-map labels/fallback map.
3. If PDF still returns 500, read the Dokploy container log line emitted by
   `console.error("Failed to build dossier PDF:", ...)`; local route/shim tests
   are green, so the next clue must be the runtime error code/message/stack.
4. Enable `WORKSPACE_MODEL_ENABLED=true` on staging only if the workspace model
   is intended to be live; consumer-free/pro entitlement alone will not show the
   create flow.
5. After web is stable, update mobile dossier/plan-copy parity in a separate
   focused pass and test mobile UI.
