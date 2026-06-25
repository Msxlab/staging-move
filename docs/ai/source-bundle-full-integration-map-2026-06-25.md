# Source Bundle Full Integration Map - 2026-06-25

## Evidence Policy

- Evidence used here: external source bundle files under `C:\Users\Windows\Downloads\New folder\Initial check requested-handoff (7)\initial-check-requested\project`, application source code, tests, and build/config files.
- Repo memory/docs are not used as product evidence.
- Visual parity is not marked passed because a same-state browser screenshot comparison was not captured in this run.

## External Bundle Inventory

| Source file | Purpose in bundle | Current app mapping |
| --- | --- | --- |
| `Move.dc.html` | Primary app prototype. Contains shell, dashboard, moving/services/addresses/settings flows, route map, Home Dossier source deck, theme tokens, and interaction states. | Partially integrated in web. Light token `#EFEADF` exists in shared/web tokens. PR #63 restores web app shell to `--bg` and promotes source-style Home Dossier deck. |
| `DossierScene.dc.html` | Animated dossier scene library with weather/air/water/area/transit/cost/housing and state variants. | Ported to `apps/web/src/components/dashboard/dossier-ambient.tsx` plus `apps/web/src/styles/source-dossier-scene.css`. Tests now assert keyframes and rendered scene roots. |
| `Admin.dc.html` | Admin operations prototype. | Admin code exists under `apps/admin`, but source visual/interaction parity is not verified in code during this pass. |
| `Move Web.dc.html` | Public marketing home/landing surface. | Marketing code exists under `apps/web/src/components/marketing`; full parity not verified in this pass. |
| `Web*.dc.html` files | Public site feature, why-free, blog, login, onboarding, and related marketing surfaces. | Counterparts exist in web routes/components, but each needs targeted visual QA before parity can be claimed. |
| `Onboarding.dc.html` | App onboarding prototype. | Web onboarding exists under `apps/web/src/app/onboarding`; parity not verified. |
| `Auth.dc.html` | Auth/login/signup prototype. | Web auth routes exist; parity not verified. |
| `Providers.dc.html` / `CustomProviders.dc.html` | Provider discovery/custom provider flows. | Provider/service screens exist in web; parity not verified. |
| `Invitations.dc.html` | Invitation/household invite prototype. | Web household/invite code exists; the user-reported invite input bug needs separate focused verification. |
| `Reminders.dc.html` | Reminder flow prototype. | Reminder/checklist logic exists; parity not verified. |
| `Search.dc.html` | Search surface prototype. | Web top search exists; parity not verified. |
| `Help.dc.html` | Help/support prototype. | Web support/help routes exist; parity not verified. |
| `Raccoon.dc.html` | Brand character component source. | Web has `DossierRaccoon`/dossier ambient character code; parity not verified pixel-by-pixel. |
| `support.js` | Prototype runtime/component loader with external module cache. | Not a production runtime target. This is not the product API cache design. |
| `sw.js` | Prototype service worker using browser Cache API for GET requests. | Production cache behavior must be audited in app code. It should not be copied blindly because app auth/API freshness differs from static prototype needs. |
| `manifest.json`, icons | Prototype PWA metadata/assets. | Web/mobile app metadata should be audited separately before copying. |
| `screenshots/`, `uploads/` | Visual references captured with the bundle. | Useful for visual QA only; not source logic. |

## Web Status

Verified in code:

- Light source paper token is present: `apps/web/src/styles/_tokens.generated.css` defines light `--bg: #EFEADF` and `--surface: #FFFFFF`.
- Shared source token is present: `packages/shared/src/design-tokens.ts` defines `surfaceLight.background: "#EFEADF"` and `surfaceLight.surface: "#FFFFFF"`.
- App shell mapping is corrected in PR #63: `.light { --lf-app-bg: var(--bg); }`.
- Light dashboard low-alpha foreground surfaces are remapped to white/near-white so `bg-foreground/5` does not create muddy gray cards on beige.
- Home Dossier source deck is wired as the primary visual deck with `View full` / swipe state, source cards, scene tags, bars, dots, and `DossierAmbient` scenes.
- Route map light labels have a white/ink style override to avoid unreadable dark labels on light maps.

Not yet verified visually:

- Same-state browser screenshot comparison for dashboard, Home Dossier collapsed/expanded, route map, settings, and responsive widths.
- Production/staging PDF export runtime after Dokploy deploy.
- Full marketing/onboarding/provider/auth parity.

## Mobile Status

Read-only inspection only; no mobile edits were made.

- Mobile light theme already consumes shared `surfaceLight.background`, so it should inherit source `#EFEADF`.
- Mobile Home Dossier is still a native row/list component, not the source swipe/full deck.
- Mobile dossier ambience uses React Native/Reanimated motion, but deck interaction parity is not implemented.
- Any mobile change should be approved separately because it affects native interaction and layout.

## Admin Status

- Admin source prototype exists in `Admin.dc.html`.
- Admin app code exists, but no visual parity pass has been completed.
- Admin should be audited after web staging is stable because it has separate information density and theme needs.

## Cache Notes

- The source bundle's `support.js` cache and `sw.js` cache are prototype/browser-runtime caches.
- Product web/mobile cache behavior should be verified from production code, not inferred from those prototype files.
- Mobile has app-side dossier caching; web has client/API-level caching in code. A deeper cache audit should answer freshness, invalidation, and whether repeated API calls are expected per screen.

## Current Integration Gaps

1. Web source Home Dossier is implemented in PR #63 but not visible on live staging until the PR is merged and Dokploy deploys that commit.
2. Visual QA remains blocked without a rendered screenshot comparison in the user's browser/state.
3. Mobile dossier structure does not match the source deck.
4. Admin/marketing/onboarding/auth/provider/search/reminder/help parity is not verified.
5. PDF 500 is a separate runtime issue and needs staging logs if it persists after merge/deploy.

## Recommended Order

1. Merge/deploy PR #63 after tests pass.
2. Hard refresh staging and verify dashboard light mode, Home Dossier animations, route map labels, settings/workspace access, and PDF export.
3. If PDF still fails, inspect Dokploy server logs for the exact stack of `Failed to build dossier PDF`.
4. Run a mobile-specific design pass before changing native Home Dossier.
5. Audit admin and public/onboarding flows in separate focused passes.
