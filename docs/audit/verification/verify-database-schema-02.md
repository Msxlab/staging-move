# Adversarial Verification: database-schema-02

**Finding:** Tenant isolation is application-only (no DB-level row scoping; workspaceId nullable)
**Claimed severity:** High / Security
**Verdict:** uncertain (facts accurate; severity inflated — adjust to Low / defense-in-depth)

## What the code proves (finding's factual claims are ACCURATE)

### Schema — `packages/db/prisma/schema.prisma`
- `Address.workspaceId String? @db.VarChar(30)` (line 442), `Address.userId String` plain column (line 436).
- `Service.workspaceId String?` (line 493), `Service.userId String` (line 490).
- `MovingPlan.workspaceId String?` (line 610), `MovingPlan.userId String` (line 607).
- `Budget.workspaceId String?` (line 654), `Budget.userId String` (line 651). Budget's only composite unique is `@@unique([userId, scopeKey, month])` (line 679) — does NOT bind a child row to its tenant via workspaceId.
- No `@@unique` on any of these models ties a child to its tenant; `workspaceId` appears only in `@@index`, never in a uniqueness/identity constraint.

### Migration — `migrations/20260529002000_workspace_phase1_foundation/migration.sql`
- Lines 102-120: `workspaceId` added as `VARCHAR(30) NULL` on Address/Service/MovingPlan/Budget, with FKs to `Workspace`. Header comments (lines 1-5) explicitly state these are "NULLABLE workspaceId columns … inert until the migration backfill + WORKSPACE_MODEL_ENABLED" and "promoted to NOT NULL in Phase 3." So workspaceId remaining nullable in Phase 1 is confirmed verbatim.

### Isolation is application-only (confirmed)
- `apps/web/src/lib/workspace-data-scope.ts`: `scopedRecordWhere` (line 82), `recordBelongsToScope` (line 97), `assertScopedRecordAction` (line 120) are the isolation primitives.
- The `[id]` routes fetch by primary key with **no tenant predicate**, then rely entirely on the app-layer assert:
  - `app/api/addresses/[id]/route.ts`: `findUnique({ where: { id } })` (lines 28, 95, 214) → `assertScopedRecordAction(...)` (lines 61, 99, 218).
  - `app/api/services/[id]/route.ts`: `findUnique({ where: { id } })` (lines 102, 146, 267) → `assertScopedRecordAction(...)` (lines 115, 150, 271).
  - `app/api/moving/[id]/route.ts`: `findUnique({ where: { id } })` (lines 40, 69, 157) → `assertScopedRecordAction(...)` (lines 51, 73, 161).
- `apps/web/src/lib/db.ts`: the shared Prisma client applies only a `withSoftDelete` extension — there is **no** global tenant-scoping middleware/extension. So there is no DB-level and no client-level row scoping; isolation lives solely in each route's helper call. This matches the finding.

## Why the verdict is "uncertain," not "confirmed"

The finding's IMPACT is stated **conditionally**: "A route that builds a Prisma where *without* the scope helper *can* read/mutate another tenant's rows." Across every cited model's `[id]` route I inspected, the helper **is** applied consistently (unscoped `findUnique` immediately followed by `assertScopedRecordAction`). No live unscoped route — i.e. no demonstrated cross-tenant IDOR — was found. The finding does not cite one either.

"Centralized scope helper, consistently applied at the application layer, over plain owner columns" is a normal and widely accepted multi-tenancy pattern. Database row-level security (RLS) and composite tenant-binding uniques are **defense-in-depth hardening**, not a baseline requirement, and their absence is not by itself an exploitable vulnerability. The phrasing "cross-tenant IDOR / data leak" implies an exploitable condition the code does not demonstrate.

## Adjusted severity

Down to **Low** (Architecture / defense-in-depth). The descriptive facts (nullable workspaceId, no RLS, no composite tenant-unique, app-only enforcement) are all correct, but they describe a hardening gap, not a proven High-severity tenant-isolation bug. A High rating would require evidence of at least one route that queries these models by id/attribute without the scope helper (or that builds a `where` omitting the tenant predicate on a list/mutation path) — not found in the cited code.

## Recommendation
Treat as a hardening backlog item, not a release blocker: (1) when `workspaceId` is promoted to NOT NULL in Phase 3, add it to identity-bearing constraints where a child must inherit its parent's tenant; (2) consider a Prisma client extension that injects the tenant predicate by default for the workspace-scoped models, so a future route cannot silently omit it; (3) add a lint/test guard asserting every `[id]` route on these models calls an isolation assert. None of these are urgent given consistent current helper usage.
