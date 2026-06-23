# Flow Audit: Workspace Invitation

Status: mapped.

## Verified Flow Components

- Workspace, member, invitation, and auth challenge models exist.
- Workspace request context resolves header/cookie selection and member status.

Evidence:

- `packages/db/prisma/schema.prisma:2176`
- `packages/db/prisma/schema.prisma:2206`
- `packages/db/prisma/schema.prisma:2244`
- `packages/db/prisma/schema.prisma:2276`
- `apps/web/src/lib/workspace-context.ts:121-126`
- `apps/web/src/lib/workspace-context.ts:191`

## Not Verified In Code

- Invitation token entropy/expiry/revocation.
- Invite acceptance UX across web/mobile.
- Overflow/read-only enforcement across all mutations.

## Recommendation

- Add route and test matrix for invite create, accept, revoke, member role/status change, and stale workspace selection.
