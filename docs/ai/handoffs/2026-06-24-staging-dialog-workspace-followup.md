# 2026-06-24 Staging Dialog / Workspace Follow-Up

## Summary

Continued the staging regression review after PR #50 was merged into `origin/staging`.
This follow-up fixes the household invite modal focus regression at the shared
dialog layer, then records the remaining staging/runtime checks that still need
operator-side verification.

## Verified From Code / Git

- `origin/staging` contains PR #50: merge commit `f47d1936`, with `089d7f58`
  (`fix web theme and dossier scene fidelity`) as its parent.
- The household invite focus bug is caused by `DialogContent` re-running its
  focus effect whenever a controlled `onOpenChange` callback gets a new identity
  during child re-renders. Typing in the email input re-rendered the modal and
  focus returned to the first input.
- Web dossier cache is server-side in-process plus private HTTP caching. It is
  not an app-level browser persistent cache.
- Mobile dossier cache is device-side memory + offline cache with a 30-minute
  fresh window and stale fallback on network errors.
- Workspace creation/invites remain gated by `WORKSPACE_MODEL_ENABLED`. Dokploy
  compose defaults `CONSUMER_FREE_DEFAULT=true` but leaves
  `WORKSPACE_MODEL_ENABLED` empty unless explicitly set.
- The current web dossier visual system is closer after PR #50, but it is not a
  full direct port of the source `DossierScene.dc.html` swipe-card scene system.

## Changed Files

- `apps/web/src/components/ui/dialog.tsx`
  - Keeps the latest `setOpen` callback in a ref.
  - Runs dialog focus-trap setup only when `open` changes, not on every child
    render.
- `apps/web/src/components/ui/dialog.test.tsx`
  - Adds a happy-dom regression test proving focus stays on the invite email
    input after controlled dialog children re-render.

## Tests Run

- `pnpm --filter @locateflow/web test -- src/components/ui/dialog.test.tsx`
- `pnpm --filter @locateflow/web test -- src/components/ui/dialog.test.tsx src/components/dashboard/household-activation-card.test.tsx src/app/api/workspaces/route.test.ts "src/app/api/addresses/[id]/dossier/pdf/route.test.ts" src/lib/pdf/standard-font-data.test.ts`
- `pnpm --filter @locateflow/web exec tsc --noEmit`

All passed. Local warning only: repo requests Node 22.x, local shell is Node
v24.13.0.

## Remaining Risks

- Staging PDF 500 cannot be fully diagnosed from the browser error alone. The
  route now logs `code`, `message`, and `stack`; Dokploy web logs are needed if
  the latest image still returns 500.
- `/api/build-info` is session-gated, so the deployed commit could not be
  verified anonymously from the shell.
- If `/settings/workspace` still shows "coming soon", confirm
  `WORKSPACE_MODEL_ENABLED=true` in Dokploy runtime config or the runtime
  config table. Code intentionally keeps workspace routes inert when that flag is
  off.
- Full source-parity for `DossierScene.dc.html` is still a larger design/build
  task, not included in this focused follow-up.

## Manual QA

1. Open staging on the new deployment and confirm `/api/build-info` while signed
   in reports the latest staging merge commit.
2. Open the household invite modal, click the first email field, type multiple
   characters, and confirm focus remains in that email field.
3. Click "Export PDF" on a Pro/free-full-access dossier and check Dokploy web
   logs if the response is still HTTP 500.
4. Open `/settings/workspace`; if it still says coming soon, verify
   `WORKSPACE_MODEL_ENABLED=true` and redeploy/restart the web container.
