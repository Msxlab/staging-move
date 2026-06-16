# Project Map

Updated: 2026-06-15

Evidence basis: generated inventory, manifests, config, source, Prisma schema/migrations, tests list, CI, Docker. Existing docs were not used as audit evidence.

## Repository Shape

- Root: pnpm 9.15.0 + turbo monorepo, Node 22.
- `apps/web`: Next.js user app and primary public/user API.
- `apps/admin`: Next.js admin/control-plane app.
- `apps/mobile`: Expo SDK 55 / React Native mobile app.
- `packages/db`: Prisma MySQL schema, migrations, soft-delete extension, seed scripts.
- `packages/shared`: shared validators, runtime config, permissions, billing/entitlement, encryption, API client, trusted IP resolver.
- `packages/connectors`: provider connector framework and USPS reference connector.
- `scripts`: operational/audit/data scripts.
- `.github/workflows`: CI, security checks, tests, production migrate job, scheduled cron workflow.
- Docker: web/admin/prod/dev/migrate images and compose stacks.

## Important Counts

- Generated inventory included files: 2457.
- Web API routes: 160.
- Admin API routes: 119.
- Mobile source files: 112.
- Prisma migration SQL files: 67.
- Test/spec files: 432.

## Primary Runtime Surfaces

### Web

- Middleware: auth edge check, public path allowlists, CSRF, body limits, rate limits, cron/internal prelimits, CSP, security headers, noindex.
- Auth: user password login, OAuth, mobile Bearer sessions, email verification, MFA, password reset, account restore/delete.
- Product flows: addresses, services, budget, moving plans, move tasks, providers, recommendations, exports, notifications, tickets, workspaces, movers.
- Billing: Stripe checkout/portal/webhooks, mobile IAP products/verify, subscription actions.
- Integrations: provider catalog, maps/static proxy, partner consents/connectors, cron jobs, internal webhooks.

### Admin

- Middleware: admin JWT edge check, IP rules, break-glass login bypass, body limit, CSRF, route rate limit, forced password change, MFA setup, session fingerprint, CSP/security headers.
- Admin APIs: users, team, settings, runtime config, billing, subscriptions, providers, movers, blog, backups, security dashboard, reports, logs, connector control, state rules, acquisition campaigns.
- High-risk admin actions use permissions and often password/MFA step-up.

### Mobile

- Expo app with EAS profiles for development/preview/production.
- Auth token stored through SecureStore-backed auth store.
- API client enforces HTTPS/default production API in release builds.
- OAuth PKCE stored in SecureStore and exchanged server-side.
- IAP uses expo-iap and server-side verification before finishing transactions.
- App-lock uses platform local authentication.

## Data Layer

- Prisma schema uses MySQL.
- Soft-delete extension covers user-owned/domain models such as User, Address, Service, MovingPlan, Budget, ServiceProvider, MoveTask, UserCustomProvider, BlogPost, Workspace.
- Raw Prisma client exists for paths that must see physical rows or perform hard deletes/restore.
- Schema contains models for users, admin users, sessions, OAuth, subscriptions, runtime config, backups, webhooks, workspaces, connectors, movers, blog, tickets, analytics/events, notifications.

## Deployment and Operations

- CI runs lint/typecheck, package tests, dependency audit, gitleaks, Prisma validate, provider audits, and gated production migrate.
- Scheduled cron workflow calls production `/api/cron/*` endpoints with `CRON_SECRET`.
- Dockerfile runtime currently runs `prisma migrate deploy` before starting web server.
- Production compose also models a one-shot migrate service before app services.

## First-Pass Incomplete Areas

- Not all 279 route handlers were inspected line-by-line.
- No tests/builds were run.
- No live environment or provider dashboards were inspected.
