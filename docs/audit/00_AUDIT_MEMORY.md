# Audit Memory

> Central, persistent memory for the end-to-end audit of LocateFlow / move-main.
> Updated continuously. Evidence = source code only. Existing `docs/ai`, `reports/`, `SYSTEM_AUDIT_REPORT/` and other `.md` files are used for **orientation only**, never as proof. Anything not confirmed in code is marked **[needs verification]**.

**Audit started:** 2026-06-22
**Repo:** https://github.com/Msxlab/staging-move (branch `main`, HEAD `36ea3521`)
**Local path:** `C:\Users\Windows\Desktop\Staging\staging-move`
**Auditor mode:** Read-only. No source/production code is modified in this phase. Only `docs/audit/**` is written.

---

## Project Summary

LocateFlow (a.k.a. **move-main**) is a US relocation / address-change management platform. It helps a household plan a move, validate addresses, discover and transition utility/service providers, generate move task checklists, track a relocation budget, and surface location intelligence (schools, flood/risk, air/water quality, ISPs, etc.). It has a consumer web app, a marketing homepage, an admin/operations panel, and a mobile app. Monetization combines Stripe web subscriptions and mobile in-app purchases (Apple/Google IAP), with a "free pivot" strategy layered on top (see `docs/ai/free-pivot/`). **[product framing needs verification against code]**

## Tech Stack

| Layer | Technology (verified from code/manifests) |
|---|---|
| Monorepo | pnpm@9.15.0 workspaces + Turborepo (`turbo.json`); Node **22.x** required (`.nvmrc`, `engines`) |
| Web app | Next.js **16.2.6** (App Router), React **19**, TypeScript, Tailwind **3.4**, TanStack Query 5, Zustand store (`apps/web/src/store`) |
| Admin app | Next.js 16.2.6 (App Router), React 19, Tailwind 3.4, custom "aurora" theme |
| Mobile app | Expo **~55**, expo-router ~55, React Native **0.83.6**, NativeWind 4, expo-iap |
| Backend | Next.js Route Handlers (`app/api/**/route.ts`) in both web and admin; no separate server |
| Database | MySQL via Prisma **5.22** (`packages/db`, schema 2696 lines, 88 models/enums, 13 migrations under `migrations/`) |
| Auth | **Custom JWT auth** using `jose` (no next-auth). Separate user auth (web/mobile) and admin auth. Migration `20260417120000_custom_auth`. |
| Payments | Stripe **16.12** (web), Apple/Google IAP via `expo-iap` (mobile) |
| Email | Resend (webhook handler present), HTML sanitizer in shared |
| Observability | Sentry (`@sentry/nextjs` 10, `sentry.*.config.ts`, `instrumentation.ts`), PostHog analytics |
| Validation | Zod 3.24 |
| Tests | Vitest (`vitest run`) in web/admin/mobile/shared; Playwright config in web; many `*.test.ts` colocated |
| CI/CD | GitHub Actions `.github/workflows/ci.yml`, `cron.yml`; Docker (`Dockerfile`, multiple `docker-compose.*.yml`, Dokploy/DigitalOcean); Vercel (`apps/web/vercel.json`) |

## Main Apps / Packages

| Workspace | Name | Code files (approx) | Role |
|---|---|---|---|
| `apps/web` | `@locateflow/web` | ~900 | Consumer web app + marketing homepage + most public APIs |
| `apps/admin` | `@locateflow/admin` | ~490 | Internal admin/operations panel + admin APIs |
| `apps/mobile` | `@locateflow/mobile` | ~219 | Expo/React Native consumer app |
| `packages/db` | `@locateflow/db` | ~27 | Prisma schema, migrations, seeds |
| `packages/connectors` | `@locateflow/connectors` | ~35 | Provider/address-change connector framework (core + USPS) |
| `packages/shared` | `@locateflow/shared` | ~80 | Cross-app domain logic (billing, entitlements, permissions, providers, validators, design tokens) |

**Surface scale (verified counts):** web = 74 pages + 171 API route files; admin = 62 pages + 125 API route files; mobile = 54 screens; Prisma = 88 models/enums; ~80k LOC (ts/tsx). `apps/web/src/lib` holds ~200 files (incl. ~15 external gov/data integrations). Web middleware = 853 lines; admin middleware = 810 lines.

## Known Rules From Existing Docs (orientation only — verify against code)

- `AGENTS.md`: never touch production data/secrets, never deploy/merge, never use live billing/USPS/carrier credentials; default to local/staging/QA; high-risk areas = billing, IAP, auth, account deletion, address-change connectors, env vars, migrations, webhooks. Audit findings must come from source, not docs.
- `docs/ai/00_START_HERE.md`: "Product Brain" memory model under `docs/ai`; separate verified capability vs hypothesis; do not store secrets/PII; do not claim integrations live unless verified.
- `docs/ai/free-pivot/**`: a free-tier / monetization-flag pivot is in progress (entitlements, gates, monetization engine). **[scope & live state needs verification]**
- Prior audits exist (`SYSTEM_AUDIT_REPORT/`, `reports/AUDIT_REPORT*.md`, `docs/ai/audits/**`) — treated as leads to verify, not evidence.

## Important Commands

| Purpose | Command |
|---|---|
| Install | `pnpm install` (Node 22) — **not run yet; requires approval (long-running)** |
| Dev (all) | `pnpm dev` (turbo) |
| Build | `pnpm build` (turbo) |
| Lint | `pnpm lint` |
| Typecheck | `pnpm verify:typecheck` (tsc --noEmit per package) |
| Tests | `pnpm verify:tests` (vitest) / per-app `pnpm --filter @locateflow/web test` |
| Full CI gate | `pnpm verify:ci` |
| Prisma generate | `pnpm db:generate` |
| Provider audits | `pnpm audit:providers*` (existing static scripts) |

> ⚠️ Dynamic checks (typecheck/lint/test/build) **cannot run without `pnpm install`** (no `node_modules`). Install is long-running and needs explicit approval per `AGENTS.md`. This audit phase is therefore **static-analysis based**; dynamic verification is flagged as a follow-up.

## Important Constraints

- **Do not modify** application/production source, `.env`/`.env.*`, secrets, migrations; no deploy/migrate/seed-reset/db-wipe/force-push/delete.
- Node version mismatch: environment has Node v24.13.0 but project pins 22.x — may affect install/build fidelity. **[impact needs verification]**
- Multi-tenant via **workspaces** — every data-access path must be workspace-scoped; this is a primary IDOR/authorization risk surface.
- Dual billing (Stripe web + IAP mobile) with an "external billing guard" — high-risk for entitlement drift / revenue leakage.
- Custom auth (no framework) — JWT signing/verification, session, lockout, step-up/TOTP all hand-rolled → primary security surface.
- Many outbound third-party fetches (gov/data APIs) — SSRF / cost / rate-limit / cache surface.

## Open Questions

- O-1: Exact auth model (cookie vs bearer, JWT claims, refresh, admin vs user separation) — to confirm in `auth-session` / `admin-auth-security` modules.
- O-2: Is the "free pivot" monetization live or behind flags? Which gates are enforced server-side vs client-only?
- O-3: Runtime config / kill switches / feature flags — source of truth (DB vs env) and who can change them?
- O-4: Are external data integrations actually wired into user-facing flows, or partially dead?
- O-5: Production DB engine confirmation (MySQL baseline migration present; legacy SQLite migrations also present).

## Audit Progress

| Phase | Status |
|---|---|
| 0. Scoping & inventory | ✅ done (counts, structure, stack verified) |
| 0. Skeleton + central memory | ✅ done (this file + `docs/audit/` tree + `_inventory/`) |
| 1. Top-level maps (01–08) | ✅ done (8 map files) |
| 2. Module deep-dives (`modules/*`) | ✅ done (24 module reports) |
| 3. Flow audits (`flows/*`) | ✅ done (10 flow reports) |
| 4. Dead code / tech debt sweep | ✅ done (→ `09_DEAD_CODE_AND_TECH_DEBT.md`) |
| 5. Adversarial verification (High) | ✅ done (10 High verified: 8 confirmed, 2 downgraded; evidence in `verification/`) |
| 6. Global synthesis (09, 10, 11, reports/*, TODO) | ✅ done |
| 7. Dynamic checks (typecheck/test/build) | ⛔ blocked on `pnpm install` approval — follow-up |

### Final tallies (static audit, 2026-06-22)

- **43 producer agents** (8 maps + 24 modules + 10 flows + 1 dead-code), **71 agents total** incl. verification + synthesis.
- **376 findings** raised → **374 active**, **2 downgraded** after adversarial verification.
- Severity (active): **Critical 0 · High 10 (8 confirmed, 2 downgraded to Low) · Medium 125 · Low 181 · Info 58**.
- Surface mapped: **136 web/admin pages + 54 mobile screens (190 routes/screens)**, **296 API route handlers** (171 web + 125 admin), **88 Prisma models/enums**.
- Reports: `reports/{critical(0),high(10),medium,low,questions}.md`; consolidated in `10_GLOBAL_FINDINGS.md`; fix order in `11_FIX_PRIORITY_ROADMAP.md`; per-module TODO in `TODO_AUDIT.md`.
- Supporting adversarial-verification write-ups: `verification/` (20 files).

### Top confirmed High findings (independently code-checked ✓ where noted)

1. `route-map-01` — `/partners/apply` & `/partners/portal` missing from middleware `PUBLIC_PATHS` → whole partner self-serve surface unreachable logged-out. ✓ (only `/movers/*` are public)
2. `mobile-iap-billing-01` / `mobile-iap-purchase-01` — IAP receipts not bound to account (`appAccountToken`/`obfuscatedExternalAccountId` typed but never enforced) → entitlement theft/claim abuse.
3. `account-deletion-export-01` — self-service Art.17 erasure skips `EmailLog` (plaintext email survives); admin hard-delete purges it. ✓ (inconsistency confirmed)
4. `account-deletion-export-04` — CCPA Do-Not-Sell opt-out recorded but never enforced (dead resolver).
5. `admin-impersonation-02` — `recordImpersonatedMutation` never invoked → no per-action impersonation audit trail.
6. `admin-auth-security-02` — default `compat` proxy mode trusts client IP headers → IP-rule/lockout/audit integrity.
7. `marketing-seo-content-01` — legal entity name/address are placeholders on Terms/Privacy/DPA/CCPA/Contact.
8. `external-data-integrations-01` — EV-charging host typo `developer.nlr.gov` (should be NREL `developer.nrel.gov`). ✓
9. `component-theme-system-02` — accent-on-white CTAs fail dark-mode contrast (EmptyState button, skip-link).
- Downgraded: `security-platform-01` (dup of admin-auth-security-02), `repo-overview-01` (cron schedulers env-partitioned by design).

### ChatGPT audit reconciliation (2026-06-22)

Verified the prior ChatGPT audit (`SYSTEM_AUDIT_REPORT/`, 15 `AUD-*` + section claims) against current code and merged with this audit.

- **43 claims extracted → 31 unique** (deduped); verified against current code.
- Status: **~7 confirmed_valid · ~14 partially_valid · ~14 already_fixed (~45% stale) · 1 inaccurate** (`SURF-12`). 1 claim (`SEC-01`) skipped on transient API error — manually assessed as non-serious (covered by AUD-004/005/007).
- **Key conclusion:** the ChatGPT report was accurate against an *older* architecture (Clerk/SQLite/Next 15, "Snap a bill"/auto-USPS copy, JSON-`contains` dedupe, end-of-processing webhook markers) but is **substantially stale** — the migration + "security round 2" hardening already fixed ~45% of it. Surviving items are mostly **Low/Info QA-coverage, cron-batching, and copy/doc-drift**; its P1/P2 severities no longer hold.
- **The ChatGPT audit missed every serious live defect** this audit found (EmailLog/Lead GDPR erasure, IAP receipt binding, CCPA do-not-sell, impersonation audit, trusted-proxy IP). The two audits are largely **orthogonal** (ChatGPT = QA/copy hygiene; Claude = runtime defects).
- Deliverables: `12_CHATGPT_AUDIT_RECONCILIATION.md` (status table + already-fixed/inaccurate detail) and **`TODO_MERGED.md`** (single deduplicated prioritized backlog, source-tagged `[CLAUDE]`/`[CHATGPT]`/`[BOTH]`).

> Scope note: only `SYSTEM_AUDIT_REPORT/` was reconciled (user-chosen). The broader `reports/**` history (~100 dated files incl. `reports/AUDIT_REPORT.md`, which describes the pre-migration Clerk/SQLite/Next-15 system) and `audit-memory-2026-06-12/` were **not** reconciled.

### Remediation — Sprint 1 (2026-06-22, branch `fix/audit-sprint1`)

First remediation pass applied from `TODO_MERGED.md` (the audit phase itself is read-only; this is the follow-on fix phase, explicitly approved). `pnpm install` is now done → dynamic checks unblocked (Vitest + `tsc --noEmit`).

- **6 items / 7 commits**, all tested (touched Vitest suites green) and typecheck-clean (web + admin = 0 errors). Full detail: `FIX_LOG.md`.
  1. Partner/`/unsubscribe` pages → `PUBLIC_PATHS` (`route-map-01/02`)
  2. CCPA Do-Not-Sell enforced on sell/share paths (`account-deletion-export-04`)
  3. EmailLog purge on self-service GDPR erasure (`account-deletion-export-01`)
  4. `/api/build-info` gated + `/api/ready` recon docstring (`app-bootstrap-config-04/05`)
  5. Google OAuth single-use replay guard + invite verified-email/rate-limit (`auth-session-01`, `workspace-invitation-household-01/02`)
  6. Dark-mode contrast on EmptyState CTA + skip-link (`component-theme-system-02`)
- **Deferred (flagged in `FIX_LOG.md`):** `database-schema-03` (Lead/AddressChangeEvent PII purge — needs shared helper), `component-theme-system-01` (badge contrast — needs tokens + runtime check), invite decline/validate hardening, build-info external-monitor confirm.
- Still NOT run: full `pnpm verify:tests`, `pnpm build`, E2E, runtime visual checks.

### Theme / UI-UX renewal memory (2026-06-22)

A durable UI/theme inventory was built for the upcoming full theme + UI/UX renewal (every page/screen, the token + light/dark system, component catalog, brand/layout) → **`docs/ui-renewal/`** (8 files: `00_INDEX`, `01_THEME_SYSTEM`, `02_COMPONENT_CATALOG`, `03_BRAND_AND_LAYOUT`, `10_WEB_PUBLIC_PAGES`, `11_WEB_APP_PAGES`, `12_ADMIN_PAGES`, `13_MOBILE_SCREENS`, `20_RENEWAL_PLAYBOOK`). Key theme finding confirmed during Sprint 1: the design-token system is genuinely **multi-source / drifted** (hex vars at globals.css ~89-96/301-308 AND HSL vars ~338/390 + design-tokens.ts + tailwind configs), which is why contrast fixes need runtime verification and a single source of truth (see `20_RENEWAL_PLAYBOOK.md`).

_Last updated: 2026-06-22 (static audit + ChatGPT reconciliation + Sprint 1 remediation + UI-renewal memory complete)._
