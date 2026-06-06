# LocateFlow Audit Remaining Work

## Status

The priority audit items are complete.

Completed priority investigations:

1. Mobile auth vs web middleware compatibility
2. User fingerprint enforcement coverage
3. Backup import dependency ordering and backup table consistency

This file is the single consolidated remaining-work backlog for continuing the project.

## Confirmed Priority Findings

### 1. Mobile auth is incompatible with web middleware for protected API routes

Severity: High

Evidence:

- `apps/mobile/src/lib/auth-store.ts`
  - Mobile persists the JWT and sends it as `Authorization: Bearer <token>`.
- `packages/shared/src/api-client.ts`
  - Shared client injects the `Authorization` header for all requests when a token exists.
- `apps/mobile/src/hooks/use-services.ts`
  - Mobile calls protected routes such as `/api/services`.
- `apps/mobile/app/settings/notifications.tsx`
  - Mobile calls `/api/notifications/preferences`, which is a protected route.
- `apps/web/src/app/api/notifications/preferences/route.ts`
  - Route uses `requireDbUserId()` and is therefore protected.
- `apps/web/src/lib/user-auth.ts`
  - Route-level auth supports both cookie and bearer token via `readTokenFromRequest()`.
- `apps/web/src/middleware.ts`
  - Middleware runs on `/api/(.*)` and rejects protected API requests unless `request.cookies.get("user_session")` exists and verifies.
  - `hasValidSession()` only checks the cookie, not the `Authorization` header.
- `apps/mobile/src/lib/auth-store.ts`
  - `refreshUser()` calls `/api/auth/me` with bearer token.
- `apps/web/src/middleware.ts`
  - `/api/auth/` is public, so `/api/auth/me` can pass middleware while other protected routes fail.

Conclusion:

- Mobile login can succeed.
- `/api/auth/me` can still work because `/api/auth/` is public in middleware.
- But protected non-public API routes can be blocked by middleware before route-level bearer auth executes.
- This is a real cross-platform auth break, not a theoretical mismatch.

### 2. User fingerprint is generated and stored, but not enforced on protected web requests

Severity: High

Evidence:

- `apps/web/src/app/api/auth/login/route.ts`
  - Login generates a fingerprint and stores it via `createUserSession()`.
- `apps/web/src/app/api/auth/oauth/google/callback/route.ts`
  - OAuth flow generates and stores fingerprint.
- `apps/web/src/app/api/auth/oauth/apple/callback/route.ts`
  - OAuth flow generates and stores fingerprint.
- `apps/web/src/app/api/auth/password/change/route.ts`
  - Password change regenerates session with fingerprint.
- `apps/web/src/lib/user-auth.ts`
  - `validateFingerprint()` exists.
- Search result across `apps/web`
  - `validateFingerprint(` is only defined in `src/lib/user-auth.ts`; no protected route or middleware usage was found.
- `apps/admin/src/middleware.ts`
  - Admin middleware actively recomputes and enforces fingerprint on every request.

Conclusion:

- User sessions carry a fingerprint claim.
- Web user request handling does not currently enforce it at middleware or route level.
- Admin sessions are materially better protected than user sessions.
- The current user-side fingerprint design does not provide actual hijack resistance.

### 3. Backup import has confirmed ordering and catalog integrity problems

Severity: High

Evidence:

- `apps/admin/src/app/api/backup/route.ts`
  - `BACKUP_TABLES` order is:
    - users
    - profiles
    - addresses
    - services
    - providers
    - movingPlans
    - tasks
    - reviews
    - documents
    - badges
    - budgets
    - subscriptions
    - auditLogs
    - notifications
- `apps/admin/src/app/api/backup/import/route.ts`
  - `selectedTables` preserves caller/input order or `Object.keys(data)` order.
  - `REPLACE` mode deletes and recreates records in selected table order.
  - `MERGE` mode also inserts in selected table order.
- `packages/db/prisma/schema.prisma`
  - `Service.providerId` references `ServiceProvider.id`.
  - `MovingPlan.fromAddressId` and `toAddressId` reference `Address.id`.
  - `Task.movingPlanId` references `MovingPlan.id`.
  - `Budget.addressId` references `Address.id`.
- `apps/admin/src/app/api/backup/route.ts`
  - Backup export lists `reviews`, `documents`, `badges` in `BACKUP_TABLES`.
- `apps/admin/src/app/api/backup/import/route.ts`
  - Import allows `reviews`, `documents`, `badges` via `MODEL_MAP`.
- `packages/db/prisma/schema.prisma`
  - No `model Review`, `model Document`, or `model Badge` definitions were found.
- `apps/admin/src/app/api/backup/route.ts`
  - `BACKUP_TABLE_OPS` does not contain export handlers for `reviews`, `documents`, or `badges`.
- `apps/admin/src/app/api/backup/import/route.ts`
  - `IMPORT_MODEL_OPS` does not contain merge handlers for `reviews`, `documents`, or `badges`.

Conclusion:

- Restore/import is not dependency-aware.
- Valid relational datasets can fail depending on selected table order.
- Backup UI/catalog advertises tables that are not backed by schema and not fully supported by export/import ops.
- This is both a correctness issue and an operator safety issue.

## Remaining Work

## P0 - Immediate Remediation Backlog

### A. Fix mobile/web auth compatibility

Priority: P0

Tasks:

1. Update `apps/web/src/middleware.ts` so protected API auth accepts bearer tokens in addition to cookie sessions.
2. Keep edge-safe behavior: JWT verification in middleware may stay stateless, but it must parse `Authorization: Bearer` for mobile clients.
3. Re-test these paths explicitly:
   - `/api/auth/login`
   - `/api/auth/me`
   - `/api/services`
   - `/api/notifications/preferences`
   - one write route such as `/api/services` POST
4. Ensure unauthorized handling does not clear or depend on cookie state for bearer-only clients.
5. Add regression tests for:
   - cookie-auth web request
   - bearer-auth mobile request
   - missing auth
   - malformed bearer token

Acceptance criteria:

- Mobile bearer requests reach protected routes successfully when token is valid.
- Middleware blocks invalid or missing auth for both cookie and bearer flows.
- No public-route expansion is required to make mobile work.

### B. Enforce user fingerprint validation consistently

Priority: P0

Tasks:

1. Decide enforcement layer:
   - middleware enforcement for cookie and bearer JWTs, or
   - route-level enforcement inside `requireDbUserId()` / `getUserSession()`.
2. Align user behavior with admin behavior wherever feasible.
3. Define safe handling for legitimate fingerprint drift:
   - mobile network change
   - app upgrade / user-agent drift
   - proxy/CDN header variability
4. On mismatch:
   - invalidate session row if appropriate
   - clear cookie if cookie-based session
   - return consistent unauthorized response
   - emit security event if desired
5. Add tests for:
   - matching fingerprint
   - mismatched fingerprint
   - legacy sessions without fingerprint

Acceptance criteria:

- User fingerprint is either actively enforced or explicitly removed as a non-goal.
- There is no dead security mechanism that appears enabled but is not used.

### C. Make backup import dependency-aware and truthful

Priority: P0

Tasks:

1. Introduce canonical dependency order for import/export.
   - Example base ordering:
     - users
     - profiles
     - providers
     - addresses
     - movingPlans
     - tasks
     - services
     - budgets
     - subscriptions
     - notifications
     - auditLogs
   - Final order must be derived from actual schema dependencies.
2. Enforce that order regardless of caller-provided table order.
3. Validate selected table subsets before import.
   - If a selected table depends on a non-selected parent table, either reject or warn clearly.
4. Remove unsupported tables from backup catalog, or implement them fully.
   - `reviews`
   - `documents`
   - `badges`
5. Add dry-run dependency diagnostics.
6. Add regression tests for:
   - REPLACE with related tables
   - MERGE with related tables
   - partial imports with missing parent tables
   - unsupported table names

Acceptance criteria:

- Import result is deterministic regardless of input order.
- Backup UI/catalog only exposes actually supported tables.
- Dry-run can predict dependency failures before mutation.

## P1 - High-Value Remaining Audit/Hardening Work

### D. Export masking consistency review

Priority: P1

Tasks:

1. Review `apps/web/src/app/api/export/route.ts` masking logic for all encrypted fields.
2. Confirm whether `phone` is stored encrypted everywhere and whether export currently masks ciphertext instead of plaintext.
3. Verify `notes` treatment and whether sensitive free text should be exported raw, masked, or excluded.
4. Add tests for encrypted service-field export behavior.

### E. Backup creation response minimization

Priority: P1

Tasks:

1. Review whether backup creation should return full `downloadData` in API response.
2. Decide whether download should move to a separate fetch or signed retrieval path.
3. Reduce accidental exposure through logs, proxies, or error monitoring.
4. Verify large-response operational impact.

### F. Public/protected API surface consistency pass

Priority: P1

Tasks:

1. Re-check `apps/web/src/middleware.ts` public API allowlist against real route requirements.
2. Identify any route families made public by broad prefix rules.
3. Confirm `/api/auth/` prefix is intentionally fully public, including `me` and any future routes.
4. Add guardrails so future protected auth-adjacent routes do not accidentally become public through prefix inheritance.

## P2 - Provider/Recommendation Follow-Up

### G. Provider data quality cleanup

Priority: P2

Tasks:

1. Remove duplicate providers where same entity appears multiple times under slight naming/category variations.
2. Correct miscategorized providers.
3. Define rules for multi-category provider representation.
4. Re-run coverage and recommendation audits after cleanup.

### H. ZIP recommendation realism gap

Priority: P2

Tasks:

1. Align recommendation depth with actual seed/provider data quality.
2. Decide whether ZIP-exact and ZIP-prefix ranking should remain active when most providers are state-scoped only.
3. Expand seed realism or simplify ranking promises.

## P3 - Quality / Tooling / Documentation

### I. Lint and typecheck cleanup

Priority: P3

Tasks:

1. Resolve mobile TypeScript/lint issues.
2. Resolve admin lint/a11y/import-order issues.
3. Re-run web/admin/mobile lint and tests.

### J. Documentation drift cleanup

Priority: P3

Tasks:

1. Update `apps/mobile/README.md` to reflect current auth model and Expo SDK.
2. Review auth/session documentation across web/admin/mobile.
3. Document final backup/import limitations and supported tables.

### K. Version drift review

Priority: P3

Tasks:

1. Review `apps/web` and `apps/admin` Next.js version drift.
2. Decide whether drift is intentional or an upgrade gap.
3. Normalize where practical.

## Suggested Execution Order

1. Fix mobile/web auth compatibility
2. Enforce or retire user fingerprint mechanism
3. Repair backup import ordering and backup catalog truthfulness
4. Review export masking and backup response surface
5. Re-run API surface audit
6. Resume provider/recommendation cleanup
7. Finish lint/doc/version cleanup

## Final Note

The highest-risk unfinished work is not general polish.
It is concentrated in:

- cross-platform authentication correctness
- real session hijack resistance for user sessions
- safe, deterministic backup restore behavior

Those three areas should be treated as the next implementation wave before lower-priority cleanup.
