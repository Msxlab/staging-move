# Flow Audit: Auth And Session

Status: sampled.

## Verified Flow

1. Browser/API request enters middleware.
2. Middleware applies body, CSRF, rate limit, and session checks depending on route class.
3. Route helpers perform stronger DB/session checks where invoked.
4. Admin routes additionally use role/permission helpers and password confirmation for sensitive operations.
5. User self-service export/account deletion routes use server-side step-up in the inspected routes.
6. Admin backup/import/download/SQL dump and hard-delete routes use password/MFA step-up in the inspected routes.

Evidence:

- `apps/web/src/middleware.ts:809`, `apps/web/src/middleware.ts:812`, `apps/web/src/middleware.ts:819`
- `apps/admin/src/middleware.ts:657`, `apps/admin/src/middleware.ts:671`
- `apps/admin/src/lib/auth.ts:316`, `apps/admin/src/lib/auth.ts:347`, `apps/admin/src/lib/auth.ts:491`, `apps/admin/src/lib/auth.ts:652`
- `docs/audit/reports/privacy-export-deletion-matrix.md`
- `docs/audit/reports/admin-backup-import-matrix.md`

## Risks

- Route-by-route classification is not complete yet.
- Session invalidation edge cases need review.
- Workspace member administration and connector fallback parity findings remain open.

## Recommendation

- Build and keep a route auth matrix under `docs/audit/reports/route-auth-matrix.md`.
