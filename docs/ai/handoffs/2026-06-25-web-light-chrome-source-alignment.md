# Web Light Chrome Source Alignment Handoff

## Scope

Continue the source integration pass for the authenticated web shell. The user reported that the prior light color looked worse and expected the dossier beige/warm-paper tone to carry across the light theme.

## Source Evidence

- Source `Move.dc.html` defines light app tokens:
  - `bg: #EFEADF`
  - `surface: #FFFFFF`
  - `surface2: #F5F0E7`
  - `surface3: #ECE6DA`
- The user's staging screenshot showed the dashboard shell reading as a greyed-out wash with white chrome surfaces around it.

## Repository Evidence

- `apps/web/src/components/layout/app-shell.tsx` uses `--lf-app-bg` for the authenticated app shell.
- `apps/web/src/components/layout/header.tsx` used an inline background based on `var(--surface)`.
- `apps/web/src/components/layout/sidebar.tsx` used desktop `bg-foreground/[0.02]`, plus global `.light aside { background: var(--surface); }`.
- `apps/web/src/components/layout/mobile-nav.tsx` used an inline background based on `var(--surface)`.
- Current `origin/staging` remained at `775c0e6f`; PR branch fixes are not visible on staging until merge/deploy.

## Change Made

Updated `apps/web/src/styles/globals.css` only:

- Added `--lf-app-chrome-bg` and `--lf-app-chrome-bg-strong` in `.light`.
- Applied those warm-paper chrome tokens to:
  - `.light .lf-app-shell > aside`
  - `.light .lf-app-shell header`
  - `.light .lf-app-shell nav.fixed`
- Updated the older `.light aside` fallback to use the same warm-paper chrome token.

This keeps the wide page shell on the cleaner source `surface2` family, without returning to the muddy grey look.

## Verification

Passed:

- `pnpm --filter @locateflow/web test -- route-map-card home-dossier dossier-ambient`
- `pnpm --filter @locateflow/web lint`
- `pnpm --filter @locateflow/web build`

Known build warnings:

- Local Node is `v24.13.0`; project wants Node `22.x`.
- Next warns that `middleware` convention is deprecated in favor of `proxy`.
- Turbopack reports an existing Prisma CommonJS external warning in the workspace invitations route.

## Not Changed

- No mobile files changed.
- No staging branch merge or deploy.
- No generated `apps/web/next-env.d.ts` change kept from the build.

## Remaining

- Merge/deploy this branch to staging before expecting `staging.locateflow.com` to change.
- Capture a fresh staging screenshot and compare it with the source visual in one QA input.
- Mobile Home Dossier still needs an approved mobile parity pass.
