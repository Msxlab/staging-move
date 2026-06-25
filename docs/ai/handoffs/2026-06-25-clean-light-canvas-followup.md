# 2026-06-25 Clean Light Canvas Follow-Up

## Context

The previous source-beige pass made the deployed web dashboard read muddy in light mode. The regression came from applying the source mobile/app paper color (`#EFEADF`) as the full web app canvas.

## Changed

- Restored the web light app canvas to the cleaner warm value `#FBFAF6`.
- Restored soft panel/supporting surface values to `#F7F3EA`.
- Kept white app chrome/panels and the dark dossier animation stages intact.
- Updated the theme-color fallback and AppShell light fallback to match the clean canvas.
- Updated the dossier ambient style test so future changes do not reapply `#EFEADF` as `--lf-app-bg`.

## Verification

- `pnpm tokens:emit`
- `pnpm tokens:check`
- `pnpm --filter @locateflow/web test -- src/components/dashboard/dossier-ambient.test.tsx src/components/dashboard/home-dossier.test.tsx`
- `pnpm --filter @locateflow/web lint`

Local commands emitted the existing Node engine warning because this machine uses Node `v24.13.0` while the repo asks for Node `22.x`.

## Not Changed

- No mobile source changes.
- No deployment or production configuration changes.
- No PDF/cache/workspace logic changes in this follow-up.
