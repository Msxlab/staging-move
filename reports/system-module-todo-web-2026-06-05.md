# Web Module Todo Audit - 2026-06-05

Source rule followed: existing `.md`, README/docs, and memory summaries were not used as audit inputs. This report is based on code, config, package metadata, route files, and command output inspected in this run.

## Completed Audit Todo

- [x] Identify module entry points, package, framework, and build/test commands.
- [x] Inventory public/protected API boundary from middleware and route files.
- [x] Check user auth, DB-backed sessions, cookies, and mobile bearer compatibility.
- [x] Check mutation gates for verified email, legal consent, and subscription requirements.
- [x] Check ownership boundaries for addresses, moving plans, services, move tasks, and workspaces.
- [x] Check public/cron/internal routes for route-level secrets or handler guards.
- [x] Check blog/public HTML rendering and upload sanitization flow.
- [x] Check security headers, CSP, body limits, CSRF, and rate-limit shape.
- [x] Run web TypeScript verification.
- [x] Run web test suite.
- [x] Write findings and release todo.

## Module Map

| Area | Code/config evidence | Result |
| --- | --- | --- |
| Package | `apps/web/package.json` | Next.js 16, React 19, App Router, Prisma-backed API routes. |
| Runtime boundary | `apps/web/src/middleware.ts:52-95` | Public API prefixes/exacts are explicit; all other API/page routes require session at middleware layer. |
| User session | `apps/web/src/lib/user-auth.ts:27-30`, `apps/web/src/lib/user-auth.ts:217-267` | `user_session` JWT is backed by a DB `userLoginSession` token hash and 30-day expiry. |
| Mutation gate | `apps/web/src/lib/api-gates.ts:101-130` | Mutations can require verified email, legal consent, and active/premium subscription. |
| Cron guard | `apps/web/src/lib/cron-guard.ts:44-76` | Cron handlers verify shared secret and call fail-closed rate limiting before work. |
| Public API list | `apps/web/src/middleware.ts:52-95` | Public auth/OAuth/webhook/blog/provider/read routes are intentionally enumerated. |
| Release runtime | `package.json:62-65` | Repo declares `pnpm@9.15.0` and Node `22.x`. |

## Route/Boundary Todo Status

- [x] Public auth endpoints checked: login, logout, register, OAuth, password reset, mobile login/exchange, Apple native auth.
- [x] Public read endpoints checked: providers, blog posts/image/indexnow key, health/ready/help, invite details, waitlist, unsubscribe, tracking.
- [x] Public webhook/internal/cron paths checked for route-handler guard expectations.
- [x] Protected user data endpoints checked for DB session validation and ownership checks.
- [x] Workspace endpoints checked for feature gate, membership lookup, permission checks, step-up on transfer/delete, and soft-delete/grace behavior.
- [x] Blog HTML path checked: admin write path sanitizes HTML before web renders it with `dangerouslySetInnerHTML`.
- [x] Service worker behavior checked: web SW is disabled/unregistering and clears old LocateFlow caches.

## Findings

| ID | Severity | Status | Evidence | Finding | Todo |
| --- | --- | --- | --- | --- | --- |
| W-REL-001 | Low | Open | `package.json:62-65`; local command warning showed Node `v24.12.0` while engine requires `22.x` | Web typecheck/tests passed, but the local verification runtime did not match the declared release runtime. This is a verification confidence issue, not a product bug. | [ ] Re-run web typecheck, tests, and production build in Node 22.x CI or local shell before release sign-off. |

## Positive Checks

- [x] Middleware does not rely only on URL privacy: protected APIs require a valid session unless listed as public.
- [x] User route handlers use DB-backed auth helpers, so middleware JWT-only checks are not the sole authorization layer.
- [x] Cron routes are intentionally public at middleware, but protected in handlers with `guardCronRequest`.
- [x] Blog rich HTML is not raw user HTML at render time; write/upload paths sanitize content and validate image types.
- [x] Workspace membership/role operations have owner/admin permission checks and prevent dangerous self-actions.

## Verification

- [x] `pnpm --filter @locateflow/web exec tsc --noEmit` passed.
- [x] `pnpm --filter @locateflow/web test` passed: 199 test files, 1478 tests.
- [x] Caveat recorded: local Node was `v24.12.0`; release engine is `22.x`.

## Release Todo

- [ ] Run Node 22.x release verification for web.
- [ ] Run production `next build`/standalone smoke for web in the deployment image.
- [ ] Confirm production Redis/Upstash limiter health before exposing cron/webhook routes at scale.
