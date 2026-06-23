# Audit TODO

## Completed In This Pass

- [x] Read repo operating rules and attached audit request.
- [x] Read Product Brain startup docs as required for audit/planning work.
- [x] Inspect git status first.
- [x] Inventory apps, packages, route counts, test counts, Prisma model/migration counts.
- [x] Review package scripts before assuming commands.
- [x] Review core web/admin middleware and auth helpers.
- [x] Review workspace context helper.
- [x] Review tracking event route.
- [x] Review selected webhook, cron, internal, and affiliate routes.
- [x] Review theme/token source and mobile theme architecture.
- [x] Review CI and production-like compose config.
- [x] Create `docs/audit/` package.
- [x] Create Product Brain handoff.
- [x] Create first-pass static route auth matrix.
- [x] Promote workspace membership step-up gap to a source-backed medium finding.
- [x] Create billing/IAP source-backed route matrix.
- [x] Create connector/address-change source-backed route matrix.
- [x] Promote connector fallback action step-up parity gap to a source-backed low finding.
- [x] Create privacy/export/account-deletion source-backed route matrix.
- [x] Create admin backup/import source-backed route matrix.

## Not Completed

- [ ] Full manual web API route authorization matrix, one row per route.
- [ ] Full manual admin API route authorization and permission matrix, one row per route.
- [ ] Full billing/subscription/IAP transition test matrix.
- [ ] Full account deletion/export/privacy model-by-model policy table.
- [ ] Full address-change connector audit beyond the first connector route matrix.
- [ ] Full provider/recommendation/affiliate ranking audit.
- [ ] Admin backup/import disposable restore drill and test-suite run.
- [ ] Full mobile emulator QA.
- [ ] Full web/admin browser visual QA.
- [ ] Full accessibility scan.
- [ ] Full dependency vulnerability audit; local attempt timed out.
- [ ] Full dead-code/import graph scan.
- [ ] Full performance/bundle/database query audit.

## Safe Commands To Consider Next

Run only after confirming time budget:

- `pnpm verify:typecheck`
- `pnpm verify:tests`
- `pnpm --filter @locateflow/web test`
- `pnpm --filter @locateflow/admin test`
- `pnpm --filter @locateflow/mobile test`
- `pnpm audit --prod --audit-level=high` with a longer approved timeout

Do not run without explicit approval:

- Package install/update commands.
- Production migrations.
- Destructive database commands.
- Deploy/publish/release/store submission.
- Live billing/provider credential flows.
