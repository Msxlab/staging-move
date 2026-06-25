# 2026-06-25 Web Clean Light Canvas Correction

## Scope
- Corrected the light-mode web app canvas after the full-page source beige background made staging look muddy.
- Kept the source/dossier warm tone as a soft surface accent instead of using the phone prototype canvas color as the desktop app shell.
- No mobile source files were changed in this pass.

## Changed
- Web light app canvas now uses `#FBFAF6`.
- Web soft source/paper surfaces now use `#F7F3EA`.
- The app shell fallback and light `theme-color` meta now match the clean web canvas.
- Web token model and generated token CSS were re-emitted so the palette is not a one-off override.
- Dossier ambient regression coverage now fails if `--lf-app-bg: #EFEADF` comes back.

## Verification
- `pnpm tokens:emit`
- `pnpm tokens:check`
- `pnpm --filter @locateflow/web test -- src/components/dashboard/dossier-ambient.test.tsx`
- `pnpm --filter @locateflow/web lint`
- `git diff --check`

## Notes
- Local Node is `v24.13.0`; repo declares Node `22.x`, so pnpm prints an engine warning.
- `git diff --check` only printed CRLF working-copy warnings for CSS files; no whitespace errors.
