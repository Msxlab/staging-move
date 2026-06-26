# 2026-06-25 Source Bundle UI Integration Audit

## Evidence Rules

- External source README was read from `C:\Users\Windows\Downloads\New folder\Initial check requested-handoff (7)\initial-check-requested\README.md`.
- Existing repository `.md` memory/docs were not used as audit evidence.
- Findings below are based on external source HTML/CSS/JS, source screenshots/assets, and current web/mobile/admin source code.

## Source Bundle Map

| Source file | Intended surface | Current implementation status |
| --- | --- | --- |
| `Move.dc.html` | Primary app/mobile relocation experience: dark default, optional light Greige theme, command center, move route, dossier deck, app tabs. | Partially adapted in authenticated web dashboard and mobile moving detail. Not pixel-perfect as a single source screen because production has modular dashboard widgets. |
| `DossierScene.dc.html` | Animated dossier scene matrix for weather, air, water, area, transit, cost, housing. | Web has a `DossierAmbient` source-scene bridge and CSS keyframes. Mobile has a separate React Native ambient implementation, not the exact source scene deck. |
| `Move Web.dc.html`, `Web.dc.html`, `Web *.dc.html` | Dark marketing/landing site with phone demo, why-free/features/login/onboarding pages. | Web marketing is implemented as React marketing components; direction is aligned, not a direct HTML port. |
| `Admin.dc.html` | Dark navy/gold "Move Operations" admin overview and operational screens. | Admin has Aurora/admin components and dark admin direction; not a pixel-perfect port of the single prototype. |
| `Auth.dc.html`, `Onboarding.dc.html`, `Providers.dc.html`, `Reminders.dc.html`, `Search.dc.html`, `Help.dc.html`, `Invitations.dc.html`, `CustomProviders.dc.html` | Mobile/app subflows and modal-like screens. | Covered by existing web/mobile routes in product architecture, but no 1:1 source-screen audit was completed in this pass. |
| `sw.js`, `support.js` | Prototype runtime/cache helpers. | Not copied directly. Production intentionally uses safer service worker/cache layers. |

## Verified Web State

- Source light Greige theme is `#EFEADF` in `Move.dc.html` and current shared/web tokens keep that value in `packages/shared/src/design-tokens.ts` and `apps/web/src/styles/_tokens.generated.css`.
- Authenticated web app shell now uses `--lf-app-bg: var(--bg)` in `apps/web/src/styles/globals.css`, so the full light app canvas is the source beige background.
- Web dossier deck exists in `apps/web/src/components/dashboard/home-dossier.tsx` with source-style toolbar, scroll deck, cards, stage, tag, meter bars, band, and dots.
- Web detailed dossier rows also remain visible. The previous behavior that hid `.lf-dossier-grid[data-source-compact="true"]` was removed.
- Source deck animation stage is forced to full scene width in CSS with `.lf-dossier-source-stage > .da-layer { inset: 0; width: 100%; mask-image: none; }`.
- Web `DossierAmbient` maps production sections to source-scene types/levels and renders `data-source-type` / `data-source-level`.

## Verified Cache State

- Web dossier API has in-process private cache with `X-Dossier-Cache`, max-age, and a cache epoch for entitlement/consumer-free gating.
- Web external dossier lookups use a durable area cache through `apps/web/src/lib/address-data-cache.ts`.
- Web HomeDossier component also uses browser `sessionStorage` based on the route `Cache-Control` max-age, so it does not need to re-fetch on every render in one browser session.
- Web service worker intentionally does not cache `/api` or authenticated HTML; it only precaches safe offline/static assets.
- Mobile HomeDossier uses memory + AsyncStorage offline cache through `apps/mobile/src/lib/home-dossier-cache.ts` and `apps/mobile/src/lib/offline-cache.ts`.
- Mobile React Query is memory-only with `staleTime: 60_000`, `gcTime: 30m`, and `networkMode: offlineFirst`.

## Mobile Read-Only Findings

- Mobile light theme consumes shared `surfaceLight.background`, so the beige token is available on mobile.
- `apps/mobile/src/components/ui/HomeDossierCard.tsx` renders the dossier as animated rows using `DossierAmbient`.
- Mobile does not implement the source `Move.dc.html` dossier deck/full-view/swipe toggle.
- Mobile source files were not modified in this pass.

## Admin Read-Only Findings

- External admin source is dark navy/gold operations UI.
- Current admin has Aurora dark/slate admin theming, admin sidebar/topbar, data pages, and overview widgets.
- Admin should not inherit the web light beige app background globally; its source target is a separate operations surface.
- Admin source files were not modified in this pass.

## Remaining Gaps

1. P1: Staging may still look wrong until Dokploy deploys the latest PR head. The beige and visible-row fixes are in source, but visual proof requires a deployed page or local browser capture.
2. P1: Mobile is not source-dossier-deck complete. It has animated rows, but not the source deck/full-view interaction.
3. P1: Authenticated web dashboard is not a direct `Move.dc.html` single-screen port. It is a modular dashboard with collapsible widgets, so source composition is only partially applied.
4. P2: Web dossier currently shows both source deck and detailed rows. This restores missing animations, but product/design should decide whether this is final or a transitional combined layout.
5. P2: Route map uses a real static basemap instead of the prototype SVG map. Light labels have dedicated CSS overrides, but still need visual QA in the deployed browser.
6. P2: Admin prototype coverage is broad; current admin direction is aligned but not pixel-perfect.
7. P2: Auth/onboarding/providers/reminders/search/help/invitations source subflows were inventoried but not each rendered against current routes in this pass.

## Safe Next Implementation Order

1. Deploy latest web PR and capture dashboard/dossier screenshots in light mode.
2. If animations still appear missing, inspect the deployed CSS bundle for `source-dossier-scene.css`, `.lf-dossier-grid[data-source-compact="true"]`, and `.lf-dossier-source-stage > .da-layer`.
3. Tighten web dossier layout after visual QA: either keep deck + rows, or make deck the compact preview and rows the expanded/full view.
4. Start a separate mobile-approved task to port the source dossier deck/full-view behavior into React Native.
5. Run a separate admin visual audit against `Admin.dc.html` screenshots before changing admin theme.

