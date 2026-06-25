# 2026-06-25 Web Light Canvas User Feedback Correction

## Context

The latest staging screenshot showed that applying the source bundle paper color (`#EFEADF`) as the global light app canvas made the dashboard look muddy and low-contrast. The correction keeps the source paper color available only as an opt-in dossier/source accent while restoring the operational app canvas to the cleaner neutral light background.

## Changed

- Restored shared light surface tokens to the neutral app canvas:
  - `background: #F8FAFC`
  - `card: #F6F8FB`
  - `cardHover: #EEF2F7`
- Restored web generated light tokens:
  - `--bg: #F8FAFC`
  - `--bg-deep: #F1F5F9`
  - `--surface-2: #F6F8FB`
  - `--surface-3: #EEF2F7`
  - shadcn `--background: 210 40% 98.04%`
- Kept `--lf-source-paper-bg: #EFEADF` for dossier/source-specific styling.
- Restored `--lf-app-bg: #F8FAFC` and the light app-shell fallback to `#F8FAFC`.
- Updated the light browser `theme-color` to `#F8FAFC`.
- Updated regression tests so `--lf-app-bg: #EFEADF` is explicitly forbidden.

## Validation

- `pnpm tokens:emit`
- `pnpm tokens:check`
- `pnpm --filter @locateflow/web test -- src/components/dashboard/dossier-ambient.test.tsx src/lib/pricing-free-tier-contract.test.ts`
- `pnpm --filter @locateflow/web lint`
- `git diff --check`

All checks passed. The local Node warning remains: the repo wants Node 22.x, while this machine uses Node v24.13.0.

## Notes

- No mobile source files were manually edited in this correction.
- Older handoff files may describe previous color decisions; this file records the latest user-feedback correction.
