# Dead Code & Tech Debt Static Sweep

Area slug: `dead`. Read-only static sweep of the LocateFlow monorepo for dead/duplicate/debt code.
Evidence is source-code only; doc references used for orientation are marked.

## Summary

The codebase is unusually clean on classic debt markers: only a handful of `TODO/FIXME/HACK/XXX`
occurrences exist (mostly in tests or intentional fail-safe placeholders), no `.bak/.old/.orig`
files, and no `@deprecated` annotations. The real debt is concentrated in:

1. **Duplicated validation logic with drift** between `apps/web/src/lib/validators.ts` and
   `packages/shared/src/validators.ts` (schemas have actually diverged).
2. **SQLite-era one-shot migration tooling** left in the active prisma directory
   (`_migrate-to-mysql.ts` + a 653 KB `_migration-data.json` + `legacy-sqlite-migrations/`).
3. **An unused `recharts` dependency** declared in both web and admin (charts are hand-rolled SVG).
4. **A parallel/orphaned seed system** — standalone `seed-*.ts` scripts alongside the canonical
   `seed-master.ts` + `seed-data/` modules; `seed.ts` and `seed-state-rules.ts` have no script.
5. **Ad-hoc debug script** `packages/db/check-admin.mjs` (dumps all admin users) committed to repo.
6. **Deep-relative re-export wrappers** (`apps/*/src/lib/shared-*.ts`) bypassing the package alias.
7. **Root-level prototype/scratch directories** (`NEW GENERATION/`, `design-src/`, `previews/`).

---

## Findings

### dead-01 — Duplicated `validators.ts` (web vs shared) has drifted (Medium, Data)
Evidence: `apps/web/src/lib/validators.ts` (177 lines) and `packages/shared/src/validators.ts`
(174 lines) are near-identical zod schema files. `diff` shows real divergence:
- `petTypes`: web validates `z.array(z.string().min(1).max(50))`; shared validates `z.array(z.string())`.
- visa enum: web includes `"O1"`; shared omits it (`CITIZEN, GREEN_CARD, H1B, L1, F1, OTHER_VISA`).
- web has provider `coverage`/`submitForGlobalReview` fields and comments; shared has a different
  budget-actual comment block.

The web app imports its local copy (10 importers of `@/lib/validators`); the shared copy is
re-exported via `packages/shared/src/index.ts` (`export * from "./validators"`) and
`index.mobile.ts`, so it can be pulled transitively by mobile/admin. Two copies of the same
validation contract that have already diverged is a correctness hazard (web and mobile/admin can
accept/reject different inputs for the same profile/provider form).

Impact: validation drift between platforms; a fix applied to one copy silently misses the other.
Recommendation: make `apps/web/src/lib/validators.ts` a thin re-export of
`@locateflow/shared/validators` (as already done for `recommendation-engine.ts`,
`shared-billing.ts`, etc.), then reconcile the diverged rules into the single shared source.
needsVerification: false (drift proven by diff). Whether the shared copy is actively consumed by
mobile/admin is [needs verification] because the barrel re-export obscures direct importers.

### dead-02 — SQLite→MySQL one-shot migration tooling left in active prisma dir (Medium, Dead Code)
Evidence: `packages/db/prisma/_migrate-to-mysql.ts` (export/import CLI for the SQLite→MySQL cutover,
self-documented as `npx tsx prisma/_migrate-to-mysql.ts export|import`) and its companion data file
`packages/db/prisma/_migration-data.json` (653 KB). Neither is referenced by any `package.json`
script, `scripts/`, docker compose, or source import — the only references are its own usage
comments. The datasource is now `provider = "mysql"` (`schema.prisma:6`), so the SQLite path is
obsolete. Additionally `packages/db/prisma/legacy-sqlite-migrations/20260211195621_add_compound_indexes/migration.sql`
is a single SQLite-era migration; the active migration set lives in `prisma/migrations/` starting at
`20260314100500_mysql_baseline`. Grep finds `legacy-sqlite-migrations` referenced only in docs, never in code/tooling.

Impact: a 653 KB JSON snapshot and dead tooling bloat the repo and the prisma directory, and
`_migrate-to-mysql.ts` references models that may no longer exist in the schema (confusing for anyone
running prisma commands).
Recommendation: archive/remove `_migrate-to-mysql.ts`, `_migration-data.json`, and
`legacy-sqlite-migrations/` out of the active prisma directory.
needsVerification: false (no code references found).

### dead-03 — `recharts` declared but never imported in web and admin (Medium, Dead Code)
Evidence: `apps/web/package.json:47` declares `"recharts": "^3.8.1"` and the web lockfile pins
`recharts@2.15.4`, but `grep recharts apps/web/src` yields zero source imports (only lockfile/manifest
hits). `apps/admin/package.json` also declares recharts; `apps/admin/src` has zero recharts imports —
admin charts are hand-rolled SVG (e.g. `apps/admin/src/components/aurora/revenue-trend.tsx` imports
only React, no chart lib). There is also a version mismatch in web (`package.json ^3.8.1` vs lockfile
`2.15.4`), implying it has lingered through dependency churn unused.
Impact: unused dependency inflates install size / lockfile and the version skew is a supply-chain smell.
Recommendation: remove `recharts` from both `apps/web/package.json` and `apps/admin/package.json`
(or wire up the intended charts). Verify no dynamic/lazy import exists first.
needsVerification: false for web/admin static imports; a dynamic import elsewhere would be the only caveat.

### dead-04 — Parallel/orphaned seed scripts alongside canonical seed-master (Low, Architecture)
Evidence: `packages/db/prisma/` contains the canonical `seed-master.ts` (wired to `seed`, `seed:master`,
`seed:all`) which imports modular data from `prisma/seed-data/` (`provider-seed.ts`, `state-rules.ts`,
`email-templates.ts`, `help-center.ts`). In parallel, standalone scripts with their own large inline
datasets exist: `seed-providers.ts` (~37 KB), `seed-providers-expanded.ts` (~50 KB),
`seed-providers-all-states.ts`, `seed-providers-government.ts`, and `seed-providers-phase2.ts`. The
`seed:providers/expanded/all-states/government` package.json scripts still point at these standalone
files, but `seed-providers-phase2.ts` is referenced only by a comment in `seed-data/providers.ts`
("seed-providers-phase2.ts merged + ~200 new providers added"). Furthermore `prisma/seed.ts` (badge
seeding) and `prisma/seed-state-rules.ts` have NO package.json script reference at all.
Impact: two competing provider-seed sources risk divergence; `seed.ts`/`seed-state-rules.ts` and
`seed-providers-phase2.ts` appear superseded but remain, confusing which seed path is authoritative.
Recommendation: confirm `seed-master.ts` + `seed-data/` is the single source of truth, then retire
the superseded standalone seeders (especially `seed-providers-phase2.ts`, and `seed.ts`/`seed-state-rules.ts`
if their data is now folded into seed-data).
needsVerification: true — standalone seeders may still be intentionally run manually for partial reseeds.

### dead-05 — `packages/db/check-admin.mjs` ad-hoc debug script committed (Low, Dead Code)
Evidence: `packages/db/check-admin.mjs` is a one-line script that instantiates Prisma and
`console.log`s every admin user's id/email/isActive, then disconnects. Not referenced by any
package.json script or other source. File begins with a UTF-8 BOM.
Impact: ad-hoc debug tooling in the repo; running it dumps the full admin-user table to stdout.
Such helpers tend to rot and can leak data if copied into other contexts.
Recommendation: remove or move to a gitignored local-scripts area; if kept, document it as a maintenance tool.
needsVerification: false (no references found).

### dead-06 — Deep-relative `shared-*.ts` re-export wrappers bypass the package alias (Low, Architecture)
Evidence: `apps/web/src/lib/shared-encryption.ts`, `shared-billing.ts`, `shared-relocation.ts`,
`shared-runtime-config.ts`, `shared-address-autocomplete.ts` (and admin equivalents like
`apps/admin/src/lib/shared-encryption.ts`, `shared-runtime-config.ts`) are pure re-export files that
reach into the package via deep relative paths, e.g. `shared-encryption.ts` re-exports from
`"../../../../packages/shared/src/encryption"` rather than the `@locateflow/shared` alias. They are
actively used (encryption wrapper has 36 importers, billing 14, autocomplete 7, relocation 5,
runtime-config 3), so NOT dead — but they add an indirection layer and the `../../../../` paths are
brittle to refactors and inconsistent with the package's public entry point.
Impact: maintenance friction and fragile relative paths; two ways to import the same shared symbols.
Recommendation: standardize on `@locateflow/shared` / subpath exports and collapse the wrappers, or
keep them but import via the package alias rather than `../../../../packages/shared/src/...`.
needsVerification: false (wrappers and their importers confirmed). Not a dead-code removal — an architecture cleanup.

### dead-07 — Root-level prototype/scratch directories outside the workspace (Low, Architecture)
Evidence: repo root contains `NEW GENERATION/` (assets, deck, landing, prototype, screenshots,
`tweaks-panel.jsx`, video, index.html), plus `design-src/` and `previews/`. `pnpm-workspace.yaml`
only globs `apps/*` and `packages/*`, and grep finds no app/turbo/package.json reference to
`NEW GENERATION`. These are design/prototype scratch areas not part of any build.
Impact: repo clutter; unclear ownership; risk of stale prototype code being mistaken for production.
Recommendation: relocate to a clearly-labeled `/design` or external store, or gitignore/remove if superseded.
needsVerification: true — confirm with maintainers these are not intentionally version-controlled design sources.

### dead-08 — `seed.ts` / `seed-state-rules.ts` not wired to any script (Info, Dead Code)
Covered under dead-04 but called out separately: `prisma/seed.ts` (badge catalog) and
`prisma/seed-state-rules.ts` have zero references in `packages/db/package.json` scripts or `scripts/`.
If their data is now in `seed-data/` they are dead; if not, the badge/state-rule seed path is
unreachable via npm scripts.
Recommendation: either remove or re-wire into `seed-master.ts`.
needsVerification: true.

---

## Notes on what is NOT dead (checked, cleared)

- `apps/{web,admin,mobile}/src/lib/recommendation-engine.ts` are thin re-export wrappers of
  `@locateflow/shared` — correct pattern, not duplicate logic.
- `packages/connectors/` is fully test-covered and active (USPS connector + core framework).
- `apps/admin/src/lib/runtime-config.ts` (415 lines) vs web's (97 lines) are NOT duplicates — admin
  carries app-specific DB-override logic.
- `lib/{fallback-actions,help-fallback,qa-account,store-review-account,provider-empty-state,db-schema-compat}.ts`
  all have at least one importer.
- The `"TEAMID-TODO"` placeholder in `apps/web/src/app/.well-known/apple-app-site-association/route.ts`
  is an intentional fail-safe (documented to make App Review reject a build without a real team ID), not debt.
