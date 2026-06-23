# Adversarial Verification: admin-impersonation-02

**Finding:** Per-mutation impersonation audit (`recordImpersonatedMutation`) is never invoked
**Claimed severity:** High · **Category:** Logic
**Verdict: CONFIRMED** (severity retained: High)

## What the prior auditor claimed
`recordImpersonatedMutation` in `apps/web/src/lib/impersonation-audit.ts` is only referenced
by its own test. No route handler calls it, so mutations performed by an admin while
impersonating a user are not attributed to the admin (only `IMPERSONATION_STARTED` /
`IMPERSONATE_HANDOFF` rows exist). This defeats the stated forensic guarantee.

## What I verified in code

### 1. The helper exists and is purpose-built for route handlers
`apps/web/src/lib/impersonation-audit.ts:17` defines `recordImpersonatedMutation(...)`.
Its docstring (lines 9-11) explicitly says: *"Call this from inside POST/PUT/PATCH/DELETE
route handlers right before (or right after) the mutation runs."* It writes an
`adminAuditLog` row attributed to `session.impersonatedByAdminId` (lines 34-45) and no-ops
for non-impersonated sessions (line 26).

### 2. It is never invoked outside its own test
Repo-wide grep for `recordImpersonatedMutation` returns matches only in:
- `apps/web/src/lib/impersonation-audit.ts` (definition)
- `apps/web/src/lib/impersonation-audit.test.ts:15,23,56,71` (its own test)
- `docs/...` markdown files (not evidence)

Repo-wide grep for the module import `impersonation-audit` (`.ts` files) returns exactly one
hit: `apps/web/src/lib/impersonation-audit.test.ts:15`. No file under
`apps/web/src/app/api/**/route.ts` imports or calls the helper.

### 3. A representative mutating route confirms the gap
`apps/web/src/app/api/auth/security/route.ts` POST handles three mutations:
- `request_set_password` → `prisma.auditLog.create` at line 245
- `revoke_session` → `prisma.auditLog.create` at line 284
- `revoke_other_sessions` → `prisma.auditLog.create` at line 314

Every one writes a **user-scoped** `auditLog` row keyed on `userId: session.userId`. None
reads `session.impersonatedByAdminId`, none writes an `adminAuditLog` row, and none calls
`recordImpersonatedMutation`. So an admin impersonating a user can, e.g., revoke that user's
other sessions, and the resulting audit row is attributed to the *user*, not the admin.

### 4. The only admin-attributed audit rows are at session lifecycle, not per action
`apps/web/src/app/api/internal/impersonate/route.ts` creates the impersonation session; its
docstring (lines 25-27) claims *"every request leaves an audit breadcrumb"* but it writes no
audit row itself. `apps/web/src/app/api/auth/impersonate-handoff/route.ts:159-175` writes one
`adminAuditLog` row with `action: "IMPERSONATE_HANDOFF"` when the cookie is issued. After that
handoff, in-session mutations carry no admin attribution. This matches the impact claim.

## Assessment
All three sub-claims (helper unwired, security route writes only user-scoped audit, only
lifecycle events are admin-attributed) are accurate against the source. The finding is REAL.

**Mitigations present (do not negate the finding):** impersonation TTL is hard-capped at 15
minutes (`internal/impersonate/route.ts:32,56`); the session is flagged in the DB via
`impersonatedByAdminId` and surfaced through a banner; session creation + handoff are
admin-attributed. These reduce blast radius but do not provide per-action attribution, which
is the explicit forensic guarantee the docstrings promise. High is retained.
