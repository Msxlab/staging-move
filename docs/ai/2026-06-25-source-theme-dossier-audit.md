# Source Theme and Dossier Audit - 2026-06-25

Scope: source bundle at `C:/Users/Windows/Downloads/New folder/Initial check requested-handoff (7)/initial-check-requested`, current web/mobile source, user-supplied staging screenshots.

Evidence rules: existing repo memory/docs were not used as product evidence. Findings below are based on source bundle files, app source, tests, config/source routes, and user screenshots.

## Verified Source Bundle Facts

- `project/Move.dc.html` defines the main authenticated app prototype.
- Light source token includes `bg: #EFEADF`, `surface: #FFFFFF`, `surface2: #F5F0E7`, `surface3: #ECE6DA`, and a greige page gradient.
- Source Home Dossier is not a plain data table. It uses scene-first cards with an 82px animated scene band and card rail/grid behavior.
- `project/DossierScene.dc.html` includes scene variants for weather, air, water, area, transit, cost, housing, and weather states such as sun/cloud/rain/snow/storm/fog/wind/heat/cold.

## Current Web Findings

- Light app shell had drifted too far into a flat/muddy beige after the previous fix. The latest patch uses the source-style radial greige page background (`#EFEEEA -> #DEDCD3 -> #D4D2C8`) while keeping dashboard cards/surfaces white for contrast.
- Route map labels in light mode were too translucent for a light basemap. The latest patch makes them more opaque and higher contrast.
- Dossier scene wiring exists in code: `home-dossier.tsx` renders `lf-dossier-scene-card`, `dossier-ambient.tsx` renders source-style scene markup, and `source-dossier-scene.css` is imported globally.
- The latest patch adds a source-style `lf-dossier-source-deck` above the detailed rows so the animated scenes appear as scene-first cards instead of only faint row decoration.
- Visual parity is still not proven because the available staging screenshots show the old/non-prominent scene treatment, and this environment could not capture a fresh staging screenshot.

## Cache Findings

- Web Home Dossier uses browser `sessionStorage` keyed by address with TTL derived from the server `Cache-Control` header, with a 10 minute fallback.
- Web dossier API also has an in-process LRU cache with summary/preview/full TTLs and a `CONSUMER_FREE` epoch so a flag flip bypasses stale gated payloads.
- The service worker does not cache `/api/*`.
- Mobile Home Dossier uses memory cache first, then disk/offline cache, and only calls the API when no fresh cache is available or force/stale behavior applies.

## PDF Findings

- The PDF route delegates to the dossier JSON route and then `generateDossierReportPdf`.
- The current code includes a `pdfkit` standard-font shim for standalone builds and defensive PDF rendering for omitted sections.
- Tests pass locally for the route and real generator.
- If staging still returns `{"error":"Failed to build dossier PDF"}`, the next required evidence is the Dokploy runtime log line emitted by the route: `Failed to build dossier PDF` with `code`, `message`, and `stack`.

## Workspace / Free Pivot Findings

- `CONSUMER_FREE` defaults on in code unless disabled by env/DB flag, and free/no-management consumers resolve to PRO-level access through consumer entitlement paths.
- Workspace creation/invites are still separately gated by `WORKSPACE_MODEL_ENABLED`.
- If staging shows “Shared workspaces are coming soon,” the code path indicates `WORKSPACE_MODEL_ENABLED` is false/not set, even if `CONSUMER_FREE` is active.
- I did not modify deployment/runtime config.

## Mobile Findings

- Mobile has a separate Home Dossier card, cache module, theme module, and animated scene port.
- Mobile was inspected but not changed in this follow-up.
- Targeted mobile Home Dossier tests passed.

## Latest Patch

- `apps/web/src/styles/globals.css`
  - Restored the authenticated light shell to a source-style radial greige page background with white surfaces.
  - Reduced light shell backdrop/grid wash.
  - Added source-style Home Dossier scene deck styling.
- `apps/web/src/lib/pricing-free-tier-contract.test.ts`
  - Updated guard so the light shell stays on the source greige radial and rejects previous flat/incorrect backgrounds.
- `apps/web/src/components/dashboard/home-dossier.tsx`
  - Added a source-style visual scene deck built from the same real derived dossier data.
- `apps/web/src/components/dashboard/home-dossier.test.tsx`
  - Added render guards for the source deck/stage/bars.

## Verification

- `pnpm tokens:check`
- `pnpm --filter @locateflow/web test -- home-dossier`
- `pnpm --filter @locateflow/web test -- pricing-free-tier-contract`
- `pnpm --filter @locateflow/web test -- dossier-ambient route-map-card standard-font-data`
- `pnpm --filter @locateflow/web test -- "src/app/api/addresses/[id]/dossier/pdf/route.test.ts"`
- `pnpm --filter @locateflow/web test -- workspace-routes`
- `pnpm --filter @locateflow/web lint`
- `pnpm --filter @locateflow/web build`

Note: all commands warn that local Node is `v24.13.0` while the repo requests Node `22.x`.
