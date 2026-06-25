# Handoff - 2026-06-24 Light Canvas Feedback Hotfix

## Scope

Follow-up after staging feedback that the light dashboard became too muddy and grey-beige. This pass keeps the source handoff's warm-paper intent, but removes the heavy app-wide wash that made `/dashboard` look darker and lower quality.

## Source Evidence Used

- `C:/Users/Windows/Downloads/New folder/Initial check requested-handoff (7)/initial-check-requested/project/Move.dc.html`
- Application source files in this repository.

## Code Changes

- Added `lf-app-shell` and `--lf-app-bg` so the app canvas can be tuned without editing generated token files.
- Set light app canvas to a cleaner warm paper `#F8F5EF`.
- Reduced the light app-shell grid/backdrop intensity and removed the broad grey-brown wash.
- Remapped dark-first `bg-foreground/*` translucent utility fills to white panels in light mode, so dashboard cards do not become grey overlays.
- Preserved the existing dossier scene-card fixes: source-style top scene band, two-column dossier grid, visible scene animations, and safe low-walkability mapping.

## Verification

- `pnpm --filter @locateflow/web test -- home-dossier dossier-ambient route-map-card`
- `pnpm --filter @locateflow/web exec tsc --noEmit`
- `pnpm --filter @locateflow/web exec tsx "../../docs/ai/audits/2026-06-24-source-dossier-qa/render-web-dossier-qa.tsx"`

Known command warning:

- Node engine warning: repo wants Node 22.x, current local Node is v24.13.0.

## Not Changed

- Did not modify generated token files.
- Did not modify mobile source code.
- Did not modify billing, entitlement, database, secrets, production config, or deployment config.
- Did not stage unrelated local files: `docs/design-system/colors_and_type.css` and `docs/ui-renewal/30_UIUX_REMEDIATION_PLAN_2026-06-24.md`.

## Next QA

- After Dokploy deploys this branch, hard-refresh staging `/dashboard` in light mode and confirm the canvas is warm but clean, with white panels instead of a grey-beige screen-wide haze.
- Re-check route map labels and Home Dossier cards on staging after deploy.
- Continue separate PDF 500 investigation from Dokploy runtime logs or an authenticated staging session.
