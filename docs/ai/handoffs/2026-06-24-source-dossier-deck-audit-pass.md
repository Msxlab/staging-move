# 2026-06-24 Source Dossier Deck Audit Pass

## Scope

- Continued the source bundle integration audit requested by the user.
- Source bundle inspected from:
  `C:\Users\Windows\Downloads\New folder\Initial check requested-handoff (7)\initial-check-requested`
- Existing repo `.md` memory files were not used as evidence.
- Web source changed.
- Mobile was inspected read-only; no mobile files were changed.

## Source Inventory

- Main design: `project/Move.dc.html`.
- Main imports from `Move.dc.html`: `DossierScene`, `Raccoon`, `Reminders`, `Help`, `Search`, `Providers`, `CustomProviders`, `Invitations`.
- Web/marketing entry: `project/Web.dc.html`, which imports `Move Web`, `Web Features`, `Web Why-Free`, `Web Blog`, `Web Login`, `Web Onboarding`, and embedded `Move`.
- Admin entry: `project/Admin.dc.html`, a separate dark operations surface.
- Home Dossier visual truth:
  - `Move.dc.html` light app canvas uses `bg: #EFEADF`.
  - The greige radial in `lightPage()` is the outer prototype page, not the app interior.
  - The dossier section is a priority-ordered scene-card deck with `View full / Swipe view`, animated `DossierScene`, stage tags, five segment bars, band labels, and dots.
  - `DossierScene.dc.html` contains weather, air, water, area, transit, cost, housing, and state-level animation variants.

## Findings

- Web had the source animation matrix ported, but the source deck interaction was incomplete.
- Web source deck existed but lacked source controls/tags/band labels/dots and converted to a desktop grid by default.
- Web deck card accents and bar colors depended on `--ds-tone`, but the variable was only applied inside the nested scene layer before the previous hotfix.
- Mobile has light `#EFEADF` tokens and row-based `DossierAmbient`, but not the source horizontal scene-card deck.
- Mobile dossier cache is device-side memory + offline disk cache, with a 30-minute fresh TTL.
- Web dossier cache is browser `sessionStorage` plus server in-process/HTTP cache; the client uses the response `Cache-Control max-age` and falls back to 10 minutes.

## Web Changes

- Added source-style priority sorting to Home Dossier scene cards.
- Added `View full / Swipe view` toggle.
- Kept default scene deck as horizontal swipe instead of auto-grid on desktop.
- Added source stage tags (`GOOD`, `CHECK`, `ALERT`).
- Added source-like band labels and scroll dots.
- Added i18n labels for English and Spanish.
- Updated regression coverage for the source deck controls and visual markers.
- Updated `design-qa.md` with the current blocked visual QA state.

## Verification

- `pnpm --filter @locateflow/web test -- home-dossier` passed.
- `pnpm --filter @locateflow/web test -- dossier-ambient` passed.
- `pnpm --filter @locateflow/web lint` passed.
- `pnpm --filter @locateflow/web build` passed.

## Known Warnings

- Local Node is `v24.13.0`; repo wants Node `22.x`.
- Next build still warns about the deprecated `middleware` convention.
- Next build still warns about Prisma CommonJS external export usage in the workspace invitations route.

## Still Open

- Fresh rendered visual QA is still blocked until the latest commit is deployed or captured locally in the user's approved browser.
- Mobile source deck parity remains unimplemented because the user requested notice before mobile edits.
- The broader source bundle still has surfaces to audit beyond the dossier deck: mobile app navigation parity, marketing pages, onboarding, auth, admin, providers/search/help/invitations overlays, and route-map visual parity.
