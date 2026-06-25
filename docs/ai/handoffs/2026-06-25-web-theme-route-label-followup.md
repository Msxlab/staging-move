# 2026-06-25 Web Theme + Route Label Follow-up

## Context

- User reported the latest staging light theme looked materially worse: the app shell read as a muddy beige wash.
- External source bundle checked: `C:\Users\Windows\Downloads\New folder\Initial check requested-handoff (7)\initial-check-requested`.
- Primary source file remains `project/Move.dc.html`; it uses a warm paper token for app surfaces, but not a flat full-desktop beige wash.

## Changes Made

- Restored the web light app shell from a flat `#EFEADF` background to the prior white-to-warm-paper gradient:
  - `#FFFFFF` / `#FAF8F3` / `#F3EFE6` / `#EFEADF`
- Kept the source dossier paper token (`--lf-source-paper-bg: #EFEADF`) and dossier stage scene behavior intact.
- Strengthened light-mode route map overlay labels:
  - White chip backgrounds.
  - Higher contrast border/shadow.
  - Dark text for both old-home and new-home labels.
- Updated the affected contract tests.

## Verified Facts

- Web Home Dossier uses browser `sessionStorage` under `lf:home-dossier:v1:<addressId>` with TTL from `Cache-Control` and a 10-minute fallback.
- Mobile Home Dossier uses memory cache plus persisted offline cache via `home-dossier-cache.ts`, with a 30-minute default freshness window.
- Mobile Home Dossier still renders row-based ambient scenes, not the source bundle's horizontal dossier source deck. Mobile source code was not modified in this pass.
- Mobile plan comparison still contains the older paid ladder copy/feature matrix, including Free preview-only Home Dossier and paid full dossier/PDF/workspace capabilities. That needs a separate mobile entitlement/copy pass.

## Tests Run

- `pnpm --filter @locateflow/web test -- src/components/dashboard/dossier-ambient.test.tsx src/components/dashboard/route-map-card.test.tsx src/lib/pricing-free-tier-contract.test.ts src/components/dashboard/home-dossier.test.tsx`
  - 4 files passed, 134 tests passed.
- `pnpm --filter @locateflow/web lint`
  - Passed (`tsc --noEmit`).

## Notes

- Node warning seen during tests: repo wants Node `22.x`; local runtime is Node `v24.13.0`. Tests still passed.
- No production data, environment files, dependency files, mobile source, or deployment config changed.
