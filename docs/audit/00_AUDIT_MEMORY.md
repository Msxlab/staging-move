# Audit Memory

Date: 2026-06-22
Branch observed: `codex/staging-audit-2026-06-21`
Scope: documentation-only first-pass audit package for LocateFlow / move-main.

## Operating Constraints

- Application source code was not modified.
- Existing markdown, README, changelog, memory, and previous summaries were used only for operating/orientation rules, not as product-behavior evidence.
- `.env`, `.env.*`, private keys, tokens, certificates, browser profiles, and credential stores were not read.
- Production data, production migrations, deploys, package installs, pushes, merges, and destructive commands were not run.
- Findings are based on source code, manifests, dependency/build config, tests, CI/CD config, migrations, and safe local command output unless explicitly labeled as repository hygiene.

## Repository Snapshot

- Monorepo package manager is `pnpm@9.15.0` in `package.json:67`.
- Workspace packages are `apps/*` and `packages/*` in `pnpm-workspace.yaml:1-3`.
- Root scripts include `build`, `lint`, `verify:typecheck`, `verify:tests`, and provider audits in `package.json:11-30`.
- Root database deploy migration script exists at `package.json:39`; it was not run.
- App/package inventory:
  - `apps/web`
  - `apps/admin`
  - `apps/mobile`
  - `packages/db`
  - `packages/shared`
  - `packages/connectors`
- Route/test counts observed with `rg`:
  - Web pages: 74
  - Web API route files: 171
  - Admin pages: 62
  - Admin API route files: 125
  - Mobile screen files: 54
  - Test/spec files: 504
- Prisma schema currently has 87 models, 1 enum, and 72 migration directories.

## Initial Security/Quality Signals

- Web middleware implements public API classification, request body limits, CSRF checks, rate limiting, session checks, CSP, and HSTS. Evidence: `apps/web/src/middleware.ts:76`, `apps/web/src/middleware.ts:156-157`, `apps/web/src/middleware.ts:192`, `apps/web/src/middleware.ts:302`, `apps/web/src/middleware.ts:575`, `apps/web/src/middleware.ts:752`, `apps/web/src/middleware.ts:768`.
- Admin middleware implements public path classification, request body limits including backup-specific size, CSRF, route rate limiting, HSTS, and admin session gating. Evidence: `apps/admin/src/middleware.ts:24`, `apps/admin/src/middleware.ts:253`, `apps/admin/src/middleware.ts:327`, `apps/admin/src/middleware.ts:355`, `apps/admin/src/middleware.ts:554`, `apps/admin/src/middleware.ts:657`, `apps/admin/src/middleware.ts:671`.
- Admin authorization helpers include `requireAdmin`, `requireRole`, `requirePermission`, and `requirePasswordConfirm`. Evidence: `apps/admin/src/lib/auth.ts:316`, `apps/admin/src/lib/auth.ts:347`, `apps/admin/src/lib/auth.ts:491`, `apps/admin/src/lib/auth.ts:652`.
- Workspace context has explicit member-status checks and stale selection self-healing. Evidence: `apps/web/src/lib/workspace-context.ts:149`, `apps/web/src/lib/workspace-context.ts:191`, `apps/web/src/lib/workspace-context.ts:207`.
- CI runs production dependency audit and gitleaks. Evidence: `.github/workflows/ci.yml:85-89`.

## Checks Run

- `git status --short --branch`
- Repository inventory via `Get-ChildItem`, `rg --files`, and package manifest reads.
- Source/config evidence search via `rg`.
- Codex Security config preflight with bundled Python.
- `pnpm audit --prod --audit-level high` attempted, but timed out after about 124 seconds. Result is inconclusive.
- Static web/admin route guard inventory for `apps/web/src/app/api/**/route.ts` and `apps/admin/src/app/api/**/route.ts`.
- Focused workspace member/invitation step-up review.
- Focused billing/IAP route matrix covering Stripe checkout/portal/subscription actions, mobile IAP verify, billing webhooks, and admin billing actions.
- Focused connector/address-change route matrix covering connector catalog/dispatch/webhook/consent/OAuth, admin connector controls, fallback actions, runtime helpers, and connector package contracts.
- Focused privacy/export/account-deletion matrix covering self-service deletion, restore, retention cron, export/PDF export, consent/CCPA, admin hard-delete, and related tests/helpers.
- Focused admin backup/import matrix covering backup create/cron/verify/import/download/SQL dump/retention and backup helper policies/tests.
- Codex Security preflight re-run with bundled Python. Result remained `incomplete` because usable multi-agent worker slots could not be verified by the runtime.

## Audit Limitations

- This is a parent-agent, first-pass audit package. It is not a completed exhaustive multi-agent Codex Security scan.
- Security preflight reported `incomplete` because worker-slot capability could not be verified in this environment, even though goal/delegation capability checks passed.
- No browser, simulator, or production/staging live QA was run in this pass.
- Dependency vulnerability status is not verified because the local `pnpm audit` attempt timed out.
- UI/UX findings are source-based. Visual regressions still require rendered web/admin and mobile emulator review.
- Route matrix is still incomplete. Billing/IAP, connector/address-change, privacy/export/deletion, and admin backup/import now have focused source-backed matrices, but full one-row-per-route manual proof remains open.
- This package still cannot be claimed as a completed exhaustive Codex Security scan because the security preflight remains incomplete.

## Next Audit Memory Update

Update this file after the next deep-dive pass with:

- Modules completed.
- Findings promoted, downgraded, or closed.
- Commands run and their outcomes.
- Whether any application source code changed.
- Link to the next handoff under `docs/ai/handoffs/`.
