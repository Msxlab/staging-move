# Module Map

Status legend:

- `scanned`: source/config read enough for initial facts and likely risks.
- `mapped`: inventory-level map only.
- `needs deep dive`: requires focused route, test, and UI/runtime review.

| Module | Primary paths | Status | Verified facts | Key risks / follow-up |
| --- | --- | --- | --- | --- |
| Web app shell and middleware | `apps/web/src/app`, `apps/web/src/middleware.ts` | scanned | Middleware gates body size, CSRF, rate limiting, session presence, CSP, and HSTS. | Route-by-route auth matrix still needed for 171 API routes. |
| Web user auth/session | `apps/web/src/lib/user-auth.ts`, `apps/web/src/app/api/auth` | scanned | JWT cookies and DB-backed session validation are present. | OAuth/mobile login flows need end-to-end happy/error path review. |
| Workspace model | `apps/web/src/lib/workspace-context.ts`, workspace routes, Prisma workspace models | scanned | Master feature flag, membership checks, stale selection fallback, and overflow read-only behavior are present. | Confirm every workspace-scoped API route calls `requireWorkspaceContext`. |
| Admin app shell and middleware | `apps/admin/src/app`, `apps/admin/src/middleware.ts` | scanned | Admin middleware has CSRF, rate limiting, CSP/HSTS, forced password rotation and MFA gates. | Route-level permission matrix still needs completion. |
| Admin authorization | `apps/admin/src/lib/auth.ts`, `apps/admin/src/lib/admin-permissions.ts` | scanned | `requireAdmin`, `requireRole`, `requirePermission`, and step-up password confirmation exist. | Verify all destructive/admin-sensitive endpoints use the right permission and step-up level. |
| Mobile app | `apps/mobile/app`, `apps/mobile/src` | scanned | Expo app uses shared tokens and a context-based theme provider. | Static theme usage remains broad; live theme switching is incomplete for static call sites. |
| Billing/subscriptions/IAP | `apps/web/src/app/api/webhooks`, subscription models, mobile IAP code | mapped | Apple and Google webhook verification paths exist. | Billing lifecycle, entitlement sync, refund/cancel edge cases require full audit. |
| Address/service/moving plan | address, service, moving plan, task routes and Prisma models | mapped | Data models exist for addresses, services, budgets, reminders, tasks. | Need flow audit for PII minimization, deletion/export, and provider connector boundaries. |
| Provider/recommendation/affiliate | provider routes, affiliate postback, provider models | mapped | HMAC affiliate postback route exists; provider audit scripts exist. | Need verify provider ranking logic, sponsored disclosure, and affiliate attribution correctness. |
| Connectors/address-change | `packages/connectors`, connector routes/models | mapped | Connector config/dispatch/address-change event models exist. | High-risk area; needs dedicated connector flow audit before any fixes. |
| Notifications/email/push | notification models/routes, mobile push storage | mapped | Notification, queue, preference, email log, and push device models exist. | Need consent/preference audit and retry/dedupe review. |
| Blog/help/content | web/admin blog/help routes and Prisma content models | mapped | Blog, FAQ, help, revisions, views models exist. | Need content auth, image proxy, draft/publish, and XSS audit. |
| Runtime config/rate limiting | runtime config models and rate-limit helpers | scanned | Redis-backed rate limiting with fallback paths is present. | Need validate fail-open/fail-closed choices against production SLO/security policy. |
| CI/deploy/ops | `.github/workflows`, Dockerfiles, compose files, scripts | scanned | CI runs audit/gitleaks/type/test/provider checks. | Mutable image tags and inconclusive local dependency audit need follow-up. |
