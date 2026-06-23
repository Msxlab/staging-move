# Module Audit: Auth, Session, Permissions

Status: scanned, needs route matrix.

## Source Inspected

- `apps/web/src/middleware.ts`
- `apps/web/src/lib/user-auth.ts`
- `apps/admin/src/middleware.ts`
- `apps/admin/src/lib/auth.ts`
- selected auth/session route references through `rg`

## Verified Facts

- Web middleware applies CSRF, rate limiting, session checks, CSP, and HSTS.
- Admin middleware applies session gating, CSRF, route rate limiting, HSTS, MFA/password-rotation gates, and body limits.
- Admin route helpers include `requireAdmin`, `requireRole`, `requirePermission`, and `requirePasswordConfirm`.

Evidence:

- `apps/web/src/middleware.ts:192`, `apps/web/src/middleware.ts:302`, `apps/web/src/middleware.ts:575`, `apps/web/src/middleware.ts:752`, `apps/web/src/middleware.ts:768`
- `apps/admin/src/middleware.ts:355`, `apps/admin/src/middleware.ts:554`, `apps/admin/src/middleware.ts:657`, `apps/admin/src/middleware.ts:671`
- `apps/admin/src/lib/auth.ts:316`, `apps/admin/src/lib/auth.ts:347`, `apps/admin/src/lib/auth.ts:491`, `apps/admin/src/lib/auth.ts:652`

## Findings

No critical/high source-backed auth finding was verified in this pass.

## Not Verified In Code

- Every web API route's auth classification.
- Every admin API route's permission and step-up level.
- Session invalidation behavior across password change, MFA change, role change, and account deletion.
- Brute-force and enumeration behavior for every auth endpoint.

## Next Steps

- Build a full API authorization matrix.
- Add tests where route classification is missing or unclear.
