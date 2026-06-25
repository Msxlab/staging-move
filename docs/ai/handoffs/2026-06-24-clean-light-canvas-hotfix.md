# 2026-06-24 Clean Light Canvas Hotfix

## Scope

Fixed the light-mode dashboard canvas after the source beige token was applied too broadly.

## Change

- Restored the global light `--background` to the prior clean cool canvas.
- Restored light `--muted`, `--accent`, and `--surface-secondary` away from the heavy beige wash.
- Restored `.light --lf-app-bg` to the previous warm off-white app shell value.
- Increased the white wash in `.light .app-shell-backdrop` so the dashboard no longer reads as muddy beige.

## Verification

- `pnpm --filter @locateflow/web exec tsc --noEmit`
- `pnpm --filter @locateflow/web test -- dossier-ambient home-dossier route-map-card`
- `git diff --check -- apps/web/src/styles/globals.css`

## Notes

Only `apps/web/src/styles/globals.css` changes application UI behavior in this hotfix. Existing dirty files were left untouched.
