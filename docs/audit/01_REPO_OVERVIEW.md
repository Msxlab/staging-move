# Repo Overview

## Verified Shape

LocateFlow is a TypeScript monorepo using pnpm workspaces.

Evidence:

- `package.json:67` declares `pnpm@9.15.0`.
- `pnpm-workspace.yaml:1-3` includes `apps/*` and `packages/*`.
- Root scripts in `package.json:11-30` cover build, lint, typecheck, tests, and provider audits.

## Apps

| App | Location | Verified role | Notes |
| --- | --- | --- | --- |
| Web | `apps/web` | Public/user Next.js app and API surface | 74 page files and 171 API route files observed. |
| Admin | `apps/admin` | Admin Next.js app and API surface | 62 page files and 125 API route files observed. |
| Mobile | `apps/mobile` | Expo/React Native app | 54 screen files observed under `apps/mobile/app`. |

## Packages

| Package | Location | Verified role | Notes |
| --- | --- | --- | --- |
| DB | `packages/db` | Prisma schema, migrations, seed/runtime DB tooling | 87 models and 72 migration directories observed. |
| Shared | `packages/shared` | Shared design tokens and utilities | Design token source consumed by web/admin/mobile. |
| Connectors | `packages/connectors` | Connector package exports | Needs deeper route-to-connector flow audit. |

## Data Layer

Prisma schema includes models for auth/session, subscriptions, addresses, services, providers, audit logs, admin sessions, runtime config, notifications, blog/content, consent, connectors, workspaces, leads, partners, invoices, and mover applications.

Representative evidence:

- `packages/db/prisma/schema.prisma:12` defines `User`.
- `packages/db/prisma/schema.prisma:232` defines `Subscription`.
- `packages/db/prisma/schema.prisma:1190` defines `UserEvent`.
- `packages/db/prisma/schema.prisma:1258` defines `AdminSession`.
- `packages/db/prisma/schema.prisma:2059` defines `ConnectorDispatch`.
- `packages/db/prisma/schema.prisma:2114` defines `AddressChangeEvent`.
- `packages/db/prisma/schema.prisma:2176` defines `Workspace`.
- `packages/db/prisma/schema.prisma:2385` defines `Lead`.
- `packages/db/prisma/schema.prisma:2469` defines `Partner`.

## CI/CD And Deployment

Verified controls:

- CI has least-privilege root permissions in `.github/workflows/ci.yml:11-12`.
- CI sets Node 22 in multiple jobs, for example `.github/workflows/ci.yml:26`.
- CI runs `pnpm audit --prod --audit-level=high` at `.github/workflows/ci.yml:85-86`.
- CI runs gitleaks at `.github/workflows/ci.yml:89`.
- CI runs Prisma migration status, not deployment, at `.github/workflows/ci.yml:138`.
- Production-like compose includes required environment guards, but uses mutable third-party image tags in `docker-compose.dokploy.yml:343` and `docker-compose.dokploy.yml:372`.

## Not Verified In Code

- Current production/staging runtime configuration.
- Actual Stripe, Apple, Google, USPS, carrier, or billing credential configuration.
- Current live database state.
- Customer traffic, conversion, revenue, analytics results, or partner demand.
