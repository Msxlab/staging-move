# Commands

This file records the safe command matrix for LocateFlow / move-main after
inspecting the workspace package manifests.

## Runtime

- Node version: `22` / `22.x`
- Package manager: `pnpm@9.15.0`
- Workspace: pnpm workspaces with Turbo
- Do not use npm, yarn, or bun commands unless the manifests are changed first.
- Do not install packages without Mustafa's explicit approval.

## Root Verification

```powershell
pnpm verify:typecheck
pnpm verify:tests
pnpm verify:provider-guards
pnpm verify:ci
pnpm lint
pnpm build
```

Notes:

- `pnpm lint` runs `turbo lint`; package lint scripts are mostly TypeScript checks.
- `pnpm verify:ci` runs typecheck plus provider guards.
- CI also runs `pnpm audit --prod --audit-level=high`.

## Web App

Package: `@locateflow/web` in `apps/web`

```powershell
pnpm --filter @locateflow/web dev
pnpm --filter @locateflow/web build
pnpm --filter @locateflow/web start
pnpm --filter @locateflow/web lint
pnpm --filter @locateflow/web test
pnpm --filter @locateflow/web test:watch
pnpm --filter @locateflow/web e2e
pnpm --filter @locateflow/web e2e:install
pnpm --filter @locateflow/web analyze
```

## Admin App

Package: `@locateflow/admin` in `apps/admin`

```powershell
pnpm --filter @locateflow/admin dev
pnpm --filter @locateflow/admin build
pnpm --filter @locateflow/admin start
pnpm --filter @locateflow/admin lint
pnpm --filter @locateflow/admin test
pnpm --filter @locateflow/admin test:watch
```

The admin dev/start scripts use port `3001`.

## Mobile App

Package: `@locateflow/mobile` in `apps/mobile`

```powershell
pnpm mobile:dev
pnpm mobile:dev:client
pnpm mobile:prebuild
pnpm mobile:prebuild:clean
pnpm mobile:android
pnpm mobile:ios
pnpm mobile:build:dev:android
pnpm mobile:build:dev:ios
pnpm mobile:build:simulator:ios
pnpm --filter @locateflow/mobile lint
pnpm --filter @locateflow/mobile test
```

Direct package scripts also include:

```powershell
pnpm --filter @locateflow/mobile build:android
pnpm --filter @locateflow/mobile build:ios
pnpm --filter @locateflow/mobile update:preview
pnpm --filter @locateflow/mobile update:production
```

## Database

Package: `@locateflow/db` in `packages/db`

```powershell
pnpm db:generate
pnpm --filter @locateflow/db build
pnpm --filter @locateflow/db exec prisma validate
```

Database commands below require explicit approval before running:

```powershell
pnpm db:migrate
pnpm db:migrate:deploy
pnpm db:push
pnpm db:seed
pnpm db:seed:all
pnpm db:seed:master
pnpm db:studio
```

## High-Caution Commands

Ask Mustafa explicitly before running any command that can touch production,
live credentials, billing, mobile releases, migrations, provider data writes,
or persistent data. High-caution examples:

```powershell
pnpm start
pnpm db:migrate
pnpm db:migrate:deploy
pnpm db:push
pnpm db:seed
pnpm db:seed:all
pnpm mobile:update:production
pnpm --filter @locateflow/mobile build:android
pnpm --filter @locateflow/mobile build:ios
pnpm stripe:sync-prices
pnpm campaigns:sync-billing
pnpm backfill:subscriptions
pnpm audit:providers:write
pnpm audit:providers:state-completeness:write
pnpm inventory:providers:coverage-surface
pnpm research:providers:official-coverage
pnpm docker:reset
```

Never run production migrations, deploys, or commands using live Stripe, Apple,
Google, USPS, carrier, billing, or customer-data credentials unless Mustafa has
approved that exact action and environment.

## Recommended Before PR

For most code changes:

```powershell
pnpm verify:typecheck
pnpm verify:tests
pnpm verify:provider-guards
pnpm build
```

For web changes:

```powershell
pnpm --filter @locateflow/web test
pnpm --filter @locateflow/web build
```

For admin changes:

```powershell
pnpm --filter @locateflow/admin test
pnpm --filter @locateflow/admin build
```

For mobile changes:

```powershell
pnpm --filter @locateflow/mobile lint
pnpm --filter @locateflow/mobile test
```

For database/schema changes:

```powershell
pnpm --filter @locateflow/db exec prisma validate
pnpm --filter @locateflow/db build
```

Run narrower commands first when a change is scoped, then broaden to root
verification before opening a PR.

## Known Gaps

- `packages/shared` contains tests but has no `test` script.
- `packages/db` has no `lint` or `test` script.
- Root `verify:tests` covers web, admin, mobile, and connectors, but not shared
  or db directly.
- CI runs web/admin/mobile tests, but connector/shared test coverage should be
  clarified against the intended PR gate.
- There is a nested `apps/web/pnpm-lock.yaml`; clarify whether this is
  intentional or whether the root `pnpm-lock.yaml` is the only authoritative
  lockfile.
