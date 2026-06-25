# 2026-06-25 Web Dossier Theme And Animation Source Audit

## Scope
- Read the external handoff bundle under `C:\Users\Windows\Downloads\New folder\Initial check requested-handoff (7)\initial-check-requested`.
- Used bundle README only for routing, then inspected source HTML/CSS/code directly.
- Changed web only. Mobile was inspected but not modified.

## Source Findings
- `Move.dc.html` is the primary in-app design source.
- Light app canvas token is `#EFEADF`; light cards remain white or warm secondary surfaces.
- Home Dossier source first view is a horizontal animated scene deck using an 82px dark stage.
- `DossierScene.dc.html` defines the animated scene matrix and keyframes.
- `Move Web.dc.html` is the public web/landing source, including separate reveal animation and free-entitlement messaging.

## Changes
- Web light app shell now uses the source paper canvas `#EFEADF` directly.
- Removed the light app-shell backdrop overlay that made the page look muddy/dirty.
- Restored the compact Home Dossier source scene deck as the desktop first view instead of forcing the row/list dossier open beside it.
- Restored visible 82px animated stages for desktop dossier rows when the full/list view is shown.
- Routed light scene character color variables through light theme CSS variables instead of locking them to the dark palette.
- Updated web tests to assert the new source-aligned contract.

## Verification
- `pnpm --filter @locateflow/web test -- dossier-ambient home-dossier`
- `pnpm --filter @locateflow/web lint`
- `pnpm --filter @locateflow/web build`
- `git diff --check`

## Notes
- Build emitted existing environment warnings: local Node is v24 while the repo asks for 22.x, Next middleware convention deprecation, and a Prisma CommonJS export warning.
- `apps/web/next-env.d.ts` was touched by build and restored because it was unrelated.
- Mobile still needs a separate implementation pass if the source animated scene deck should replace its current row-based dossier presentation.
