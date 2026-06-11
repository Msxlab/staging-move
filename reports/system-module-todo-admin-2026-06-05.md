# Admin Module Todo Audit - 2026-06-05

Source rule followed: existing `.md`, README/docs, and memory summaries were not used as audit inputs. This report is based on code, config, package metadata, route files, and command output inspected in this run.

## Completed Audit Todo

- [x] Identify module entry points, package, framework, and build/test commands.
- [x] Inventory admin middleware, public routes, and protected API route posture.
- [x] Check admin auth, DB-backed sessions, cookie settings, role/MFA gates, and step-up flows.
- [x] Check admin permission matrix and sensitive route handlers.
- [x] Check export/import/backup/team/runtime-config high-risk APIs.
- [x] Check CSRF, body limits, security headers, CSP, and service worker posture.
- [x] Scan admin API route handlers for missing direct auth/permission checks.
- [x] Run admin TypeScript verification.
- [x] Run admin test suite.
- [x] Write findings and release todo.

## Module Map

| Area | Code/config evidence | Result |
| --- | --- | --- |
| Package | `apps/admin/package.json` | Next.js admin app, App Router, separate runtime from web. |
| Middleware public boundary | `apps/admin/src/middleware.ts:498-510` | Internal/cron are passed to handlers for shared-secret auth; public paths are explicit; API mutations get CSRF checks. |
| Admin session | `apps/admin/src/lib/auth.ts:21-50`, `apps/admin/src/lib/auth.ts:201-265` | `admin_session` cookie is httpOnly/sameSite strict and backed by active DB `adminSession` rows. |
| Middleware session check | `apps/admin/src/middleware.ts:516-531` | Edge middleware verifies JWT only; route handlers enforce DB active state through `requireAdmin`. |
| Step-up/MFA | `apps/admin/src/lib/auth.ts:454-540` | Sensitive operations require password confirmation, optional MFA, lockout tracking, and audit events. |
| Admin rate limit | `apps/admin/src/middleware.ts:378-424`, `apps/admin/src/middleware.ts:495-496` | Process-local in-memory limiter is applied before handler auth. |
| Runtime config | `apps/admin/src/lib/runtime-config.ts:201-240`, `apps/admin/src/lib/runtime-config.ts:354-360` | Per-key shape validation runs before deployment-only/editability checks. |

## Route/Boundary Todo Status

- [x] Login/health public surface checked.
- [x] API routes without direct auth pattern checked: `api/blog/image` is a public redirect with strict key handling; `api/healthz` is health.
- [x] Team/admin-user mutation rules checked for role hierarchy, last-super-admin protection, and self-delete/deactivate blocks.
- [x] Provider bulk operations checked for permission and step-up on destructive actions.
- [x] User/log export routes checked for permission, step-up/MFA, masking, no-store, and CSV safety.
- [x] Backup import route checked for SUPER_ADMIN, password/MFA, signature/backup guard, restore lock, and audit.
- [x] Runtime config route family checked for catalog/upsert/reset validation and override controls.
- [x] Admin SW checked: unregisters and clears caches rather than caching admin shell.

## Findings

| ID | Severity | Status | Evidence | Finding | Todo |
| --- | --- | --- | --- | --- | --- |
| A-SEC-001 | Medium | Open | `apps/admin/src/middleware.ts:378-424`; call site `apps/admin/src/middleware.ts:495-496` | Admin route throttling is a module-level `Map`. In multi-instance/serverless production, login and sensitive write limits are per-process and reset on restart/deploy, so an attacker can spread attempts across instances. | [ ] Move admin rate limiting to the shared Redis/Upstash limiter or another distributed store; fail closed for login, runtime-config, backup, key-rotation, and destructive admin writes. |
| A-CFG-001 | Low | Open | `apps/admin/src/lib/runtime-config.ts:213-240`; `apps/admin/src/lib/runtime-config.ts:354-360` | `DATABASE_URL` and `REDIS_URL` are in `URL_KEYS`; non-HTTP schemes throw `INVALID_RUNTIME_CONFIG_VALUE:non_http_scheme` before the later branch/comment that says those keys may legitimately use non-HTTP schemes. Because shape validation runs before editability/deployment-only handling, admins can get the wrong error path. | [ ] Exclude DB/Redis from HTTP-only validation before protocol rejection, or check deployment-only/editability before shape validation for those keys. |
| A-REL-001 | Low | Open | `package.json:62-65`; local command warning showed Node `v24.12.0` while engine requires `22.x` | Admin typecheck/tests passed, but local verification did not match the declared release runtime. | [ ] Re-run admin typecheck, tests, and production build in Node 22.x CI or local shell before release sign-off. |

## Positive Checks

- [x] Admin sessions are DB-backed, and stale/expired/inactive session rows are cleared.
- [x] SUPER_ADMIN-sensitive paths require MFA enrollment and step-up confirmation in route handlers.
- [x] Export routes mask sensitive values for non-SUPER_ADMIN users and set no-store behavior.
- [x] Backup import has multiple controls: permission, step-up, signature/guard, restore lock, safety backup, and audit.
- [x] Static admin route scan did not find unguarded sensitive API route handlers beyond intentional public health/image routes.

## Verification

- [x] `pnpm --filter @locateflow/admin exec tsc --noEmit` passed.
- [x] `pnpm --filter @locateflow/admin test` passed: 91 test files, 501 tests.
- [x] Caveat recorded: local Node was `v24.12.0`; release engine is `22.x`.

## Release Todo

- [ ] Replace process-local admin rate limiting before high-confidence production release.
- [ ] Fix runtime-config URL validation ordering for DB/Redis/deployment-only keys.
- [ ] Run Node 22.x release verification and admin production build.
