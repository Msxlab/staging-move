# 2026-06-25 Web Light Color Follow-up

## Scope

- User reported the staging dashboard light background became visually worse and too muddy.
- Kept this follow-up intentionally narrow: web light-theme color correction only.

## Changed

- `apps/web/src/styles/globals.css`
  - Kept the source handoff paper palette documented in the `.light` block.
  - Stopped applying the raw `#EFEADF` paper token as the full wide web dashboard canvas.
  - Set the app canvas to a lighter warm paper undertone (`#FAF7F0`).
  - Restored crisp white shell chrome and panel surfaces for dashboard readability.
  - Kept source warmth in `--surface-secondary` with `#F7F1E8`.

## Verification

- `pnpm --filter @locateflow/web test -- route-map-card home-dossier dossier-ambient`
  - Passed: 4 files, 123 tests.
- `pnpm --filter @locateflow/web lint`
  - Passed.
- `pnpm --filter @locateflow/web build`
  - Failed after successful compile and TypeScript phases.
  - Failure occurred during Next page-data worker startup with OS resource errors:
    - `Insufficient system resources exist to complete the requested service. (os error 1450)`
    - `memory allocation ... failed`
  - Existing warnings also appeared:
    - Node version mismatch: local Node is `v24.13.0`, repo wants `22.x`.
    - Next middleware convention deprecation.
    - Prisma CommonJS export warning from `apps/web/src/app/api/workspaces/[id]/invitations/route.ts`.

## Not Changed

- Did not change mobile source files.
- Did not change deployment, environment, package, lockfile, or config files.
- Did not touch the unrelated mobile worktree changes visible during this session:
  - `apps/mobile/app/(auth)/sign-in.tsx`
  - `apps/mobile/src/components/ui/Button.tsx`
  - `apps/mobile/src/lib/theme.ts`

## Risk

- Visual QA on staging is still required after deploy because this is a palette correction based on the user's staging screenshot and the source handoff tokens.
- Full local web build could not be completed in this Windows session due to local OS resource exhaustion after compile/typecheck succeeded.
