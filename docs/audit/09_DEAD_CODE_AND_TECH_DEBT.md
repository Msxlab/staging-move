# 09 — Dead Code & Tech Debt (Synthesis)

**Area slug:** `synth-dead`
**Scope:** Consolidation of (a) the dead-code static sweep over the LocateFlow monorepo and (b) every **Dead Code** / **Architecture** category finding surfaced by the module audits.
**Method:** Every "unused"/"duplicate"/"dead" claim below was re-checked against source (Grep/Glob/Read) during this synthesis. Where a module finding's premise was confirmed against code it is marked **[verified]**; where it could not be confirmed (or was contradicted) it is marked **[needs verification]** / **[REFUTED]** with the evidence. Existing `.md`/report files were used only for orientation, never as proof.

> Evidence convention: file paths are relative to repo root. Line numbers were taken from the current source at audit time.

---

## 0. Executive Summary

The codebase is **structurally clean of classic rot** (the TODO/FIXME density is near-zero — see §9), but it carries three recurring tech-debt themes:

1. **Manual cross-app duplication of the design system** — design tokens, Tailwind configs, theme provider, and UI primitives are hand-mirrored across web/admin/mobile with no compile-time link. This is the single largest maintenance liability (multiple Medium findings converge here).
2. **Dead one-shot migration / debug tooling left in active package dirs** — the SQLite→MySQL migration CLI + 653 KB data snapshot, legacy SQLite migration, and an ad-hoc admin-dump script sit in `packages/db`.
3. **A scatter of genuinely unused exports/components** — `initSentry`, `decodeJwtPayload`, `verifyAndLookupSignedTransaction`, `getAllFlags`, the `TestimonialQuote` component, and an unreachable impersonation backend endpoint (no UI caller).

Two module-audit "dead/duplicate" premises were **corrected during this synthesis**:
- `module-map-02` (recommendation engine "implemented in three+ locations" / forked) — **the web/admin/mobile copies are thin re-export wrappers around `@locateflow/shared`, not forks.** Divergent-logic risk does not exist; only file-level wrapper duplication remains. See §6.
- `dashboard-web-app-10` (`recordUserSecurityAudit` "may be unused") — **REFUTED: it has many production callers.** See §3.

The single unused dependency (`recharts`) is declared in two apps with zero imports (§5).

---

## 1. Unused Files

| File | Status | Evidence |
|---|---|---|
| `packages/db/prisma/_migrate-to-mysql.ts` | **[verified] dead** | One-shot SQLite→MySQL export/import CLI. No `package.json`/script/docker reference (db `package.json` scripts inspected — only `seed*`, `migrate*`, `studio`). Its `TABLES` list (lines 25–36, 81–92) names ~9 models that **do not exist** in the current schema: `FamilyMember`, `Task`, `MovingBox`, `KeywordBlacklist`, `ModerationStat`, `ChatSession`, `ChatMessage`, `ReferralCode`, `ReferralReward` (cross-checked vs `_inventory/prisma-models.txt`). Datasource is now `mysql` (`schema.prisma:6`). |
| `packages/db/prisma/_migration-data.json` | **[verified] dead** | 653,048-byte data snapshot consumed only by `_migrate-to-mysql.ts`. |
| `packages/db/prisma/legacy-sqlite-migrations/20260211195621_add_compound_indexes/` | **[verified] dead** | A single SQLite-era migration superseded by the MySQL baseline under `migrations/`. Lives outside the active `migrations/` dir. |
| `packages/db/check-admin.mjs` | **[verified] dead** | One-liner that `PrismaClient().adminUser.findMany()` and `console.log`s `id/email/isActive` (full file read). Not referenced by any script or import. |
| `apps/web/src/components/marketing/testimonial-quote.tsx` | **[verified] unimported** | `<TestimonialQuote/>` is referenced in `apps/web/src/app/page.tsx:479` **only inside a removal comment** ("was removed because…"); there is no `import` of the component anywhere in `apps/web/src` (grep). Component file still present. Carries a fabricated-named-attribution risk if re-introduced. |

**Related:** `marketing-seo-content-10`, `database-schema-11`, `dead-02`, `dead-05`.

---

## 2. Unused Components

| Component | Status | Evidence |
|---|---|---|
| `TestimonialQuote` (`apps/web/src/components/marketing/testimonial-quote.tsx`) | **[verified] unused** | See §1 — only a removal comment references it; no import. |
| Admin shared UI primitives | **[verified] absent (not dead, but the gap drives duplication)** | `apps/admin/src/components/ui/` **does not exist** (Glob returns nothing). Admin re-implements `confirm-dialog`, `empty-state`, `theme-provider`, `theme-toggle`, `language-selector` independently of web. This is the structural duplication tracked in §7, not a single dead file. |

**Related:** `component-system-01`, `component-theme-system-04`, `module-map-03`.

---

## 3. Unused Functions / Exports

| Export | Status | Evidence |
|---|---|---|
| `initSentry()` — `apps/web/src/lib/sentry.ts:17` | **[verified] dead** | Bare `Sentry.init` lacking the `sentry-options` `beforeSend` PII scrubber. Grep across `apps/web/src`: referenced **only** in `apps/web/src/app/api/stripe/checkout/route.test.ts:60` (a `vi.fn()` mock). No production caller. `captureException`/`captureMessage` from the same file *are* used. **Latent footgun**: if ever wired, it creates a competing init bypassing the scrubber. |
| `decodeJwtPayload<T>()` — `apps/web/src/lib/oauth.ts:352` | **[verified] dead** | Parses a JWT body **without signature verification**. Grep across repo: only its own definition + docs; no production caller. Trust footgun if a future caller treats the result as authenticated. |
| `verifyAndLookupSignedTransaction()` — `apps/web/src/lib/iap-apple.ts:434` | **[verified] dead** | Exported but grep finds no caller; **not** re-exported via `packages/shared/src/index.ts` (grep: no match). The verify route inlines `verifyAppleJws` + `refreshAppleSubscriptionFor` instead. |
| `getAllFlags()` — `apps/web/src/lib/feature-flags.ts:99` | **[verified] dead + misleading** | Returns `{name: f.enabled}`, ignoring `targetType`/`targetValue`. Grep across `apps/`: only its definition + docs; no production caller. If adopted later it reports raw `enabled`, not effective state. |
| `readSingleTokenFromRequestForLegacyPath` — `apps/web/src/lib/user-auth.ts:447` | **[needs verification]** | Module finding `auth-session-08` flagged it as likely-unused by the current `getUserSession` path. Not independently re-confirmed in this sweep — keep `needsVerification`. |
| `recordUserSecurityAudit` — `apps/web/src/lib/user-security-audit.ts:8` | **[REFUTED — actively used]** | `dashboard-web-app-10` flagged it as "may be unused by in-scope routes." App-wide grep shows **many** production callers: `api/auth/logout`, `api/auth/password/{reset/request,reset/confirm,change}`, `api/auth/mfa/{confirm,disable}`, and `lib/password-login.ts` (3 call sites). **Not dead.** |
| `validateFingerprint` — `apps/admin/src/lib/auth.ts:304` | **[needs verification]** | `admin-auth-security-11` notes it is exported but the live fingerprint check is inline in `middleware.ts`. Verify caller set before pruning. |

**Related:** `app-bootstrap-config-07`, `auth-session-08`, `mobile-iap-billing-09`, `analytics-flags-runtime-09`, `dashboard-web-app-10` (corrected), `admin-auth-security-11`.

---

## 4. Unused / Unreachable Routes & Pages

| Route | Status | Evidence |
|---|---|---|
| `POST apps/admin/src/app/api/users/[id]/impersonate/route.ts` | **[verified] live backend, no UI entry point** | Endpoint is fully implemented (`requirePermission` SUPER_ADMIN, `requirePasswordConfirm`, internal handoff, audit, notification). Grep across `apps/admin/src/**/*.tsx` for `/impersonate`, `handoffToken`, `handoffUrl` returns **no client caller**. `user-detail-client.tsx` only renders an "Impersonated" badge on existing sessions; it has no Impersonate button/handler. The end-to-end impersonation flow is unreachable through the product UI. (Severity adjusted to Low by the module verifier — endpoint is auth-gated, so this is an unfinished-feature / hidden-capability concern, not an exposure.) |

**Note (separate auth surfaces, not dead):** `route-map-05` (Info) catalogs token/cookie sub-sessions (mover-portal, partner-portal, HMAC token pages). These are **live alternate trust boundaries**, not dead code; listed here only so the cleanup of "extra session paths" is not mistaken for dead-code removal.

**Related:** `admin-impersonation-01`, `route-map-05`.

---

## 5. Unused Dependencies

| Dependency | Status | Evidence |
|---|---|---|
| `recharts` (web) — `apps/web/package.json:47` declares `^3.8.1` | **[verified] unused** | Grep `recharts` across `apps/web/src` → **zero** source imports. Lockfile/version skew noted by `dead-03` (declared `^3.8.1`). |
| `recharts` (admin) — `apps/admin/package.json:38` declares `^3.8.1` | **[verified] unused** | Grep across `apps/admin/src` → **zero** imports. Admin charts are hand-rolled SVG (e.g. `apps/admin/src/components/aurora/revenue-trend.tsx`). |

**Risk before removal:** confirm no dynamic/lazy/`import()` usage (grep covered static imports). Low risk.

**Related:** `dead-03`.

---

## 6. Duplicate Code

### 6.1 Confirmed byte-for-byte / logic duplicates

| Duplicate | Status | Evidence |
|---|---|---|
| Email HTML sanitizer | **[verified] byte-for-byte identical** | `packages/shared/src/email-html-sanitizer.ts` and `apps/admin/src/lib/email-template-sanitizer.ts` are **identical** (both read in full — 380 lines, same `ALLOWED_TAGS`, `sanitizeStyleAttr`, `sanitizeEmailHtml`, `sanitizeEmailSubject`). Admin route imports the local copy; web render imports the shared one. **Drift risk: a security fix to one does not reach the other.** |
| Stripe status mappers | **[verified] duplicated** | `mapStripeStatus`/`mapStripeStatusWithRenewal` defined locally in `apps/web/src/app/api/webhooks/stripe/route.ts:1332,1352` **and** in `apps/web/src/lib/stripe-subscription-mapping.ts:15,34`. The reconcile cron uses the shared lib copy; the webhook uses its local copy. Two copies of the same paused→CANCELED / trial-cancel logic that were previously unified. |
| Theme provider | **[verified per module finding]** | `apps/admin/src/components/theme-provider.tsx` ≈ line-for-line copy of `apps/web/src/components/theme-provider.tsx`, differing only in `storageKey`. |
| Tailwind config | **[verified per module finding]** | `apps/web/tailwind.config.ts` and `apps/admin/tailwind.config.ts` share the same `theme.extend` color/fontSize/boxShadow block (admin comment "Mirrors apps/web/tailwind.config.ts"). |
| Notification presentation map | **[needs verification — Info]** | `notificationPresentation` (notification-center) vs `presentationFor` ((app)/notifications/page) implement slightly-divergent type→icon/tone maps. |

### 6.2 Re-export wrappers (file-level duplication, NOT forks)

| Wrapper set | Status | Evidence |
|---|---|---|
| `recommendation-engine.ts` ×4 | **[verified — NOT a fork; corrects `module-map-02`]** | `apps/web/src/lib/recommendation-engine.ts` is `export { … } from "@locateflow/shared"` (re-export only; header: "All scoring logic is now in @locateflow/shared"). `apps/mobile/src/lib/recommendation-engine.ts` likewise re-exports from shared. `apps/admin/src/lib/recommendation-engine.ts` re-exports a small subset from shared. **No app re-implements scoring** — divergent-ranking risk does not exist. `apps/web/src/lib/recommendation-weights.ts` is a *separate* web-only runtime weights-override layer, not a duplicate engine. Remaining cost: 4 trivial wrapper files. |
| `shared-*.ts` deep-relative re-export wrappers | **[verified — used, not dead]** | `apps/web/src/lib/shared-encryption.ts` re-exports from `"../../../../packages/shared/src/encryption"` (and `shared-billing`, `shared-runtime-config`, `shared-relocation`, `shared-address-autocomplete`; plus admin `shared-billing/encryption/runtime-config`). Confirmed present via Glob. Actively imported, so **not dead** — but the brittle `../../../../` path bypasses the `@locateflow/shared` alias and creates two import styles for the same symbols. |

**Related:** `email-pipeline-09`, `payments-billing-web-10`, `component-system-08`, `component-system-09`, `module-map-02` (corrected), `dead-06`, `notifications-push-06`.

---

## 7. Deprecated / Legacy

| Item | Status | Evidence |
|---|---|---|
| Legacy SQLite migration dir | **[verified]** | `packages/db/prisma/legacy-sqlite-migrations/` (single `20260211195621_add_compound_indexes`) superseded by the MySQL baseline in `migrations/`. |
| SQLite→MySQL one-shot tooling | **[verified]** | `_migrate-to-mysql.ts` + `_migration-data.json` (see §1) — references removed models. |
| Legacy color naming (`orange`→gold) aliases | **[verified per module finding — intentional]** | `design-tokens.ts` and `globals.css` intentionally alias `brand.orange`/`--orange-*`/tone `orange` onto Gold/Sapphire values so the mobile palette flips without a codemod (`design-tokens.ts:10-15`). Cosmetic reasoning trap, not dead — flagged for a future rename codemod. |
| Transitional mobile fonts | **[needs verification]** | `apps/mobile/app/_layout.tsx` loads Fraunces/Geist/Geist-Mono "during the reskin transition" alongside new faces; remove after confirming no screen references the old families. |
| Legacy JWT token reader | **[needs verification]** | `readSingleTokenFromRequestForLegacyPath` (`user-auth.ts:447`) — see §3. |

**Related:** `dead-02`, `database-schema-11`, `ui-ux-09`, `mobile-app-10`, `auth-session-08`.

---

## 8. Unnecessary Abstractions

| Abstraction | Status | Evidence |
|---|---|---|
| `getAllFlags()` | **[verified] dead abstraction** | See §3 — unused and semantically misleading. |
| `decodeJwtPayload()` | **[verified] dead abstraction** | See §3 — unverified-JWT reader with no caller. |
| `recommendation-engine.ts` wrappers ×4 | **[verified] thin indirection** | See §6.2 — re-export shims; acceptable for cross-app symbol sharing but add a layer. |
| `shared-*.ts` deep-relative wrappers | **[verified] redundant import path** | See §6.2 — duplicate of the `@locateflow/shared` alias via `../../../../`. |
| Onboarding completion derived from event rows | **[Architecture, Info]** | `onboarding-flow-09`: completion/step reconstructed each request from `UserEvent` rows + cross-table counts (`onboarding-progress.ts`, `post-auth-redirect.ts`), rather than a durable `User.onboardingCompletedAt` column. Fragile + multi-query per gate. **[needs verification of the perf claim]** |
| Self-service erasure non-transactional | **[Architecture, Info]** | `account-deletion-export-09`: `processAccountDeletionRequest` runs sequential deletes without `$transaction`, unlike the admin hard-delete path. Not dead; refactor candidate. |

**Related:** `analytics-flags-runtime-09`, `auth-session-08`, `module-map-02`, `dead-06`, `onboarding-flow-09`, `account-deletion-export-09`.

---

## 9. TODO / FIXME Inventory

A repo-wide sweep of `TODO|FIXME|HACK|XXX` across `apps/{web,admin,mobile}/src` and `packages/shared/src` (`*.ts`/`*.tsx`) returns **only the following** — the codebase is essentially free of inline debt markers:

| Location | Marker | Nature |
|---|---|---|
| `apps/web/src/app/.well-known/apple-app-site-association/route.ts:36` | `"TEAMID-TODO"` | **Real placeholder** — emitted when `APPLE_TEAM_ID` env is unset (covered by `well-known.test.ts:35-38`, which asserts the placeholder ships when the env is missing). The only genuine source TODO. |
| `apps/web/src/app/.well-known/well-known.test.ts:35,38` | `TODO` | Test assertions about the above placeholder. |
| `apps/web/src/lib/blog/preview-token.test.ts:13` | `XXX` | Test string (tampered-token fixture), not a marker. |
| `apps/admin/src/app/login/page.tsx:142` | `XXXXXXXX` | Input `placeholder` text, not a marker. |
| `apps/admin/src/lib/backup-tables.test.ts:95` | `TODO` (in a comment) | Note that a previously-deferred table is now core; informational. |

**Assessment:** TODO/FIXME density is negligible. The one actionable item is wiring a real `APPLE_TEAM_ID` so the AASA file stops shipping the `TEAMID-TODO` placeholder (deep-link/universal-links correctness).

---

## 10. Cleanup Recommendations

Each item lists **risk** and **needsVerification**. Nothing below should be executed by this audit (read-only); these are recommendations for the owning team.

### High value, low risk

1. **Import the shared email sanitizer in admin; delete the duplicate.**
   - Files: `apps/admin/src/lib/email-template-sanitizer.ts` → use `sanitizeEmailHtml`/`sanitizeEmailSubject` from `packages/shared/src/email-html-sanitizer.ts`.
   - Risk: **Low** (byte-for-byte identical today). Security upside: single source for future XSS fixes. needsVerification: **false**.

2. **Remove `recharts` from both `package.json`s.**
   - Files: `apps/web/package.json:47`, `apps/admin/package.json:38`.
   - Risk: **Low** — confirm no dynamic `import("recharts")` first (static grep already clean). needsVerification: **false**.

3. **Archive the SQLite→MySQL one-shot tooling out of the active prisma dir.**
   - Files: `packages/db/prisma/_migrate-to-mysql.ts`, `_migration-data.json` (653 KB), `legacy-sqlite-migrations/`.
   - Risk: **Low** — references removed models; not wired to any script. needsVerification: **false**.

4. **Remove `packages/db/check-admin.mjs`** (or move to a gitignored local-scripts area).
   - Risk: **Low**. Running it dumps the admin-user table to stdout — keeping ad-hoc data-dump scripts in-repo is a minor data-handling smell. needsVerification: **false**.

5. **Delete `initSentry()`** and its setup-wizard doc comment; keep `captureException`/`captureMessage`.
   - File: `apps/web/src/lib/sentry.ts:17-40`.
   - Risk: **Low** — only a test mock references it; removing the mock too. Removes a latent PII-scrubber-bypass footgun. needsVerification: **false**.

6. **Remove `decodeJwtPayload()`** (or rename to make non-verification explicit).
   - File: `apps/web/src/lib/oauth.ts:352`. Risk: **Low** (no caller). needsVerification: **false**.

7. **Remove the duplicate Tailwind class** `backdrop-blur-sm backdrop-blur-sm`.
   - File: `apps/web/src/components/layout/app-shell.tsx:117`. Risk: **Negligible**. needsVerification: **false**.

### Medium value / medium risk

8. **Consolidate the two Stripe status mappers.** Import the shared `stripe-subscription-mapping.ts` mapper into the webhook route and delete the local copy.
   - Files: `apps/web/src/app/api/webhooks/stripe/route.ts:1332-1356`, `apps/web/src/lib/stripe-subscription-mapping.ts:15-38`.
   - Risk: **Medium** — webhook path is correctness-sensitive; ship behind tests. needsVerification: **false** (duplication confirmed).

9. **Generate web/admin CSS variables + Tailwind color maps from `design-tokens.ts` at build time** (or import the token object into the configs), eliminating the manual-sync mirrors.
   - Files: `packages/shared/src/design-tokens.ts`, `apps/web/src/styles/globals.css`, `apps/admin/src/app/globals.css`, `apps/web/src/styles/aurora.css`, `apps/{web,admin,mobile}/tailwind.config.ts`.
   - Risk: **Medium** (build-pipeline change; palette regressions if mis-mapped). Highest-leverage structural fix — converges `module-map-01`, `component-system-02`, `component-theme-system-03`, `ui-ux-08`. needsVerification: **false** (manual-sync comment confirmed at `design-tokens.ts:14-23`).

10. **Extract shared web+admin UI primitives** (Button/Input/Select/Badge/EmptyState/ConfirmDialog/theme-provider/theme-toggle/language-selector) into a `packages/ui` (or `packages/shared`), consumed by both Next.js+Tailwind apps; keep mobile as an RN sibling on shared tokens.
    - Files: `apps/web/src/components/ui/`, `apps/admin/src/components/` (no `ui/` dir exists), `apps/mobile/src/components/ui/`.
    - Risk: **Medium** (broad refactor, a11y/focus parity to preserve). needsVerification: **false** (admin `ui/` absence confirmed).

11. **Standardize on `@locateflow/shared` subpath imports**, collapsing the deep-relative `shared-*.ts` wrappers (or at least replacing `../../../../packages/shared/src/...` with the alias).
    - Files: `apps/{web,admin}/src/lib/shared-*.ts`.
    - Risk: **Medium** (touches many importers: encryption ~36, billing ~14). needsVerification: **false**.

### Needs verification before action

12. **Confirm & remove `verifyAndLookupSignedTransaction`** — appears unused (grep clean), but verify no out-of-tree caller. needsVerification: **true**.
13. **Confirm & remove `getAllFlags()`** or document debug-only semantics. needsVerification: **true** (grep clean; confirm no planned admin/debug surface).
14. **Confirm & remove `TestimonialQuote`** component (only a removal comment references it) — or gate behind a real consented-quote. Re-introduction risk: fabricated attribution. needsVerification: **true**.
15. **Decide impersonation endpoint exposure** — build the UI entry or feature-flag/remove `POST /api/users/[id]/impersonate`. needsVerification: **false** (no UI caller confirmed) but the *intended* exposure needs a product decision.
16. **Retire superseded seed scripts** after confirming `seed-master.ts` + `seed-data/` is the single source of truth. `seed.ts`, `seed-state-rules.ts`, and `seed-providers-phase2.ts` have **no `package.json` script** (db scripts inspected). `seed-providers-phase2.ts` is described as "merged" in `seed-data/providers.ts:5`. Coverage drift risk: `seed-state-rules.ts` seeds 5 states vs `seed-data/state-rules.ts` 51. needsVerification: **true** (confirm no docker/CI invokes the standalone scripts before deleting).
17. **Confirm & prune** `readSingleTokenFromRequestForLegacyPath` (`user-auth.ts:447`) and admin `validateFingerprint` / orphaned `auth-cookie.test.ts`. needsVerification: **true**.
18. **Remove transitional mobile fonts** after verifying no screen references the old families. needsVerification: **true**.
19. **Relocate root prototype/scratch dirs** (`NEW GENERATION/`, `design-src/`, `previews/`) to a labeled `/design` area or remove. `pnpm-workspace.yaml` only globs `apps/*`/`packages/*`; none are referenced by any app. needsVerification: **true** (confirm no asset pipeline reads them).

### Structural backstops (Architecture)

20. **Add a CI/lint guard** asserting every route under `/api/internal`, `/api/cron`, `/api/webhooks` calls its in-route guard (these prefixes are public at the middleware layer — `security-surface-02`). needsVerification: **false** (the fail-open-by-omission property is confirmed; module verifier adjusted severity to Low given current handlers are guarded).
21. **Add a Prisma `$extends`/middleware (or lint) backstop** requiring an explicit scope token on tenant-scoped models, so a future bare `findUnique({where:{id}})` cannot IDOR (`authorization-workspaces-05`). needsVerification: **false**.
22. **Fix misleading file headers / stale comments:** `workspace-context.ts:1-12` says "tested, unused" but the resolver is on the hot path (31 files reference it) — `authorization-workspaces-10`; and the stale `?workspace=` override comment (`workspace-context.ts:115-118`) points to code not found in scope — `authorization-workspaces-07` (needsVerification: **true**).

---

## 11. Cross-reference: module findings consolidated here

Architecture / Dead-Code findings folded into this synthesis (with verification status):

- **Verified duplication/dead:** `module-map-01`, `module-map-03`, `component-system-01`, `component-system-02`, `component-system-08`, `component-system-09`, `component-theme-system-03`, `component-theme-system-04`, `ui-ux-08`, `ui-ux-13`, `ui-ux-09`, `app-bootstrap-config-07`, `payments-billing-web-10`, `email-pipeline-09`, `database-schema-11`, `admin-impersonation-01`, `marketing-seo-content-10` (component still present), `dead-02`..`dead-07`.
- **Corrected during synthesis:** `module-map-02` (re-export wrappers, **not forks**), `dashboard-web-app-10` (`recordUserSecurityAudit` **actively used**).
- **Architecture (not dead, refactor candidates):** `route-map-05`, `api-map-04`, `security-surface-02/05/06`, `security-platform-02`, `authorization-workspaces-05/07/10`, `payments-billing-web-S3`, `subscription-payment-web-07` (positive), `mobile-iap-purchase-07`, `workspace-invitation-household-05`, `notifications-push-06`, `external-data-integrations-08`, `onboarding-flow-09`, `address-change-relocation-10`, `account-deletion-export-09`, `notification-email-digest-08`, `dashboard-web-app-08`, `app-bootstrap-config-03`, `admin-auth-security-11`, `mobile-app-10`, `analytics-flags-runtime-09`, `auth-session-08`, `mobile-iap-billing-09`.
