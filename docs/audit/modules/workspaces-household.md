# Module Audit: Workspaces And Household Sharing

Status: scanned for context helper, mapped for routes.

## Source Inspected

- `apps/web/src/lib/workspace-context.ts`
- Prisma workspace models.

## Verified Facts

- Workspace model is feature-flagged.
- Request workspace selection can come from header or cookie.
- Membership status must be `ACTIVE` or `OVERFLOW`.
- Stale workspace selection can self-heal.

Evidence:

- `apps/web/src/lib/workspace-context.ts:95`
- `apps/web/src/lib/workspace-context.ts:121-126`
- `apps/web/src/lib/workspace-context.ts:167-180`
- `apps/web/src/lib/workspace-context.ts:191`
- `apps/web/src/lib/workspace-context.ts:207`
- `packages/db/prisma/schema.prisma:2176`
- `packages/db/prisma/schema.prisma:2206`
- `packages/db/prisma/schema.prisma:2244`

## Findings

- `SEC-WORKSPACE-001`: privileged workspace invitation/member administration lacks step-up parity with workspace delete, restore, and transfer.

## Not Verified In Code

- Every workspace-scoped route uses the context helper.
- Invite acceptance/revocation behavior.
- Overflow read-only enforcement at every mutation boundary.
- UX clarity when stale workspace fallback occurs.
- Whether every membership action should require step-up or only admin invite, admin promotion, role/status change, and member removal.

## Next Steps

- Generate workspace route matrix.
- Test stale cookie/header and overflow user cases.
- Add or explicitly waive step-up for sensitive membership operations.
