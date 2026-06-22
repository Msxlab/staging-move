# Handoff: Route Auth Matrix Pass

Date: 2026-06-22
Branch: `codex/staging-audit-2026-06-21`

## Request

Continue the docs-only end-to-end audit package.

## Completed

- Re-read operating rules, Product Brain startup context, and Codex Security scan rules.
- Kept this as parent-agent source-backed audit work, not an exhaustive multi-agent security scan.
- Generated a first-pass static guard inventory for web/admin API route files.
- Added `docs/audit/reports/route-auth-matrix.md`.
- Promoted one source-backed medium finding: `SEC-WORKSPACE-001`.
- Updated global findings, medium report, route map, workspaces module, roadmap, audit TODO, audit memory, and next-agent tasks.

## Application Source Code Modified

No.

## Key Evidence

- Web middleware public API allowlists: `apps/web/src/middleware.ts:76`.
- Web middleware API matcher: `apps/web/src/middleware.ts:852`.
- Admin public exact paths: `apps/admin/src/middleware.ts:24`.
- Admin matcher: `apps/admin/src/middleware.ts:809`.
- Workspace delete/restore/transfer step-up: `apps/web/src/app/api/workspaces/[id]/delete/route.ts:35`, `apps/web/src/app/api/workspaces/[id]/restore/route.ts:29`, `apps/web/src/app/api/workspaces/[id]/transfer/route.ts:41`.
- Workspace member/invitation operations without detected step-up in sampled files: `apps/web/src/app/api/workspaces/[id]/members/[memberId]/route.ts`, `apps/web/src/app/api/workspaces/[id]/invitations/route.ts`.

## Checks Run

- `git status --short --branch`
- `rg` and PowerShell route guard inventory commands
- focused `rg` evidence checks for workspace member/invitation/delete/restore/transfer routes

## New Finding

- `SEC-WORKSPACE-001` Medium/P1: Workspace member invitation, role/status change, and removal rely on session plus workspace permission checks, while workspace delete/restore/transfer use `requireWorkspaceStepUp`. Recommend applying step-up parity to privileged membership administration.

## Not Completed

- Full one-row-per-route manual matrix.
- Full admin permission/step-up matrix.
- Billing/IAP transition matrix.
- Connector/address-change audit.
- Browser/emulator QA.

## Recommended Next Action

Continue with the full manual route matrix or switch to the next P1 fix after explicit approval for source-code changes.
