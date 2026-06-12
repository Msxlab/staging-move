# Admin Audit

Status: source-reviewed and verified.

## Verification

- `pnpm --filter @locateflow/admin exec tsc --noEmit`: passed after regenerating Prisma Client.
- `pnpm --filter @locateflow/admin test`: 116 files / 733 tests passed.

## Findings

1. Prisma Client stale state affects admin too.
   - Same generated-client issue as web: new mover models exist in schema but generated client was stale until `prisma generate`.

2. Admin blog image proxy is intentionally public but constrained.
   - `apps/admin/src/app/api/blog/image/route.ts` redirects only keys matching `blog/YYYY-MM/...`.
   - Risk is low; it depends on public web image route enforcing its own storage safety.

3. Admin cron/internal routes use shared secret guards.
   - `blog-image-cleanup` accepts cron secret via Bearer or `x-cron-secret`.
   - `internal/security-event` requires internal secret.

4. Open: admin client IP trust should be explicit.
   - Middleware and login route trust forwarded IP headers before rate-limit/IP-rule decisions.
   - Risk depends on whether the production edge strips caller-supplied forwarding headers.

5. Open: backup/retention cron should use narrower secrets.
   - The routes are authenticated, but high-impact backup actions should not share the broad web cron secret.

## What Looks Good

- Admin middleware enforces CSP/security headers, CSRF/body-size, route rate limits, IP rules, break-glass event logging, MFA and forced-password-change gates.
- `requirePermission` rechecks DB role/permissions and fails closed except super admin.
- Sensitive admin flows have password/step-up patterns, OTP for hard delete, and audit logging.
