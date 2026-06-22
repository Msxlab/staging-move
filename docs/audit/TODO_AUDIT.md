# Master Audit TODO — LocateFlow Monorepo

> Synthesis of all area, map, flow, and sweep reports for the LocateFlow monorepo (Next.js 16 web + admin, Expo/React-Native mobile, Prisma/MySQL, custom JWT auth via `jose`, Stripe web billing + Apple/Google IAP).
> Refuted findings are excluded from all counts and lists; verdict `adjustedSeverity` is respected throughout.
> Counts in the Progress table are **active/effective** (post-verdict) severities, so a module row may differ from that module report's raw header counts where a finding was refuted, downgraded, or where Low/Info were summarized in the compact aggregate.
> Generated 2026-06-22.

**Active totals:** Critical 0 · High 10 · Medium 125 · Low 181 · Info 58. **Refuted (excluded):** 2 (`repo-overview-01`, `security-platform-01`).

---

## Audit Progress

| Module | Status | Report File | Critical | High | Medium | Low |
|--------|--------|-------------|:-:|:-:|:-:|:-:|
| App Bootstrap / Config / Env | done | `modules/app-bootstrap-config.md` | 0 | 0 | 1 | 6 |
| Authentication & Session | done | `modules/auth-session.md` | 0 | 0 | 2 | 6 |
| Authorization & Workspaces (multi-tenant + RBAC) | done | `modules/authorization-workspaces.md` | 0 | 0 | 1 | 7 |
| Payments & Billing (Stripe / Web) | done | `modules/payments-billing-web.md` | 0 | 0 | 3 | 8 |
| Mobile IAP Billing (Apple/Google) | done | `modules/mobile-iap-billing.md` | 0 | 1 | 4 | 3 |
| Security Platform (rate-limit, secrets, encryption, cron, kill-switches) | done | `modules/security-platform.md` | 0 | 0 | 2 | 3 |
| onboarding | done | `modules/onboarding.md` | 0 | 0 | 4 | 0 |
| Addresses & Address Validation | done | `modules/addresses-validation.md` | 0 | 0 | 5 | 5 |
| Providers & Connectors | done | `modules/providers-connectors.md` | 0 | 0 | 1 | 4 |
| Moving & Move Tasks | done | `modules/moving-tasks.md` | 0 | 0 | 6 | 6 |
| Budget & Expenses | done | `modules/budget-expenses.md` | 0 | 0 | 2 | 8 |
| services-catalog | done | `modules/services-catalog.md` | 0 | 0 | 1 | 6 |
| Notifications & Push | done | `modules/notifications-push.md` | 0 | 0 | 3 | 6 |
| Email Pipeline | done | `modules/email-pipeline.md` | 0 | 0 | 4 | 7 |
| External Data Integrations (gov/data APIs) | done | `modules/external-data-integrations.md` | 0 | 1 | 0 | 5 |
| marketing-seo-content | done | `modules/marketing-seo-content.md` | 0 | 1 | 4 | 6 |
| Partners, Affiliate & Movers Portal | done | `modules/partners-affiliate-movers.md` | 0 | 0 | 0 | 6 |
| Consumer Dashboard / Account (web app) | done | `modules/dashboard-web-app.md` | 0 | 0 | 6 | 3 |
| Admin Auth & Security | done | `modules/admin-auth-security.md` | 0 | 1 | 4 | 3 |
| Admin Management Surfaces | done | `modules/admin-management.md` | 0 | 0 | 1 | 0 |
| Database Schema & Data Layer | done | `modules/database-schema.md` | 0 | 0 | 3 | 7 |
| Component & Theme System | done | `modules/component-theme-system.md` | 0 | 1 | 5 | 4 |
| Analytics, Feature Flags & Runtime Config | done | `modules/analytics-flags-runtime.md` | 0 | 0 | 3 | 4 |
| Mobile App (Expo / React Native) | done | `modules/mobile-app.md` | 0 | 0 | 1 | 5 |
| repo-overview | done | `01_REPO_OVERVIEW.md` | 0 | 0 | 3 | 1 |
| module-map | done | `02_MODULE_MAP.md` | 0 | 0 | 3 | 2 |
| route-map | done | `03_ROUTE_MAP.md` | 0 | 1 | 2 | 1 |
| api-map | done | `04_API_MAP.md` | 0 | 0 | 1 | 2 |
| data-flow-map | done | `05_DATA_FLOW_MAP.md` | 0 | 0 | 3 | 5 |
| component-system | done | `06_COMPONENT_SYSTEM.md` | 0 | 0 | 7 | 3 |
| security-surface | done | `07_SECURITY_SURFACE.md` | 0 | 0 | 5 | 4 |
| ui-ux-baseline | done | `08_UI_UX_BASELINE.md` | 0 | 0 | 4 | 10 |
| Signup / Login / Session flow (apps/web) | done | `flows/signup-login.md` | 0 | 0 | 2 | 4 |
| onboarding-flow | done | `flows/onboarding-flow.md` | 0 | 0 | 3 | 3 |
| Address Change / Relocation flow (web) | done | `flows/address-change-relocation.md` | 0 | 0 | 4 | 5 |
| Subscription Payment (Stripe / Web) | done | `flows/subscription-payment-web.md` | 0 | 0 | 3 | 3 |
| Mobile IAP Purchase flow | done | `flows/mobile-iap-purchase.md` | 0 | 1 | 2 | 3 |
| Workspace Invitation / Household | done | `flows/workspace-invitation-household.md` | 0 | 0 | 3 | 3 |
| Provider / Connector Dispatch | done | `flows/provider-connector-dispatch.md` | 0 | 0 | 3 | 3 |
| Admin Impersonation flow | done | `flows/admin-impersonation.md` | 0 | 1 | 2 | 3 |
| Notification / Email / Digest flow | done | `flows/notification-email-digest.md` | 0 | 0 | 3 | 2 |
| Account Deletion / Data Export (CCPA) | done | `flows/account-deletion-export.md` | 0 | 2 | 3 | 2 |
| Dead Code & Tech Debt Static Sweep | done | `dead-code-tech-debt-sweep.md` | 0 | 0 | 3 | 4 |
| **TOTAL (active)** | — | — | **0** | **10** | **125** | **181** |

_Map phases: `01_REPO_OVERVIEW`–`08_UI_UX_BASELINE`. Synthesis docs: `10_GLOBAL_FINDINGS.md`, `11_FIX_PRIORITY_ROADMAP.md`. Low/Info per row reflect findings surfaced in the compact aggregate; full per-module Low/Info detail lives in each report file._

---

## Global Critical Issues

_No active Critical-severity findings after verdict adjustment._ The two findings originally raised at higher severity in this band were refuted (`repo-overview-01`, `security-platform-01`). The highest-blast-radius items are tracked under **Global High Priority Issues** below.

---

## Global High Priority Issues

Active High-severity findings (effective severity). These are the top remediation targets.

- [ ] **mobile-iap-billing-01** — No user-to-receipt binding; appAccountToken/obfuscatedExternalAccountId never enforced
  - Category: Security · Report: `modules/mobile-iap-billing.md` · Fix order: P1.1 · Depends on: none
  - Files: `apps/web/src/lib/iap-apple.ts:137; iap-google.ts:230; iap-common.ts:582-598; api/mobile/iap/verify/route.ts`
- [ ] **mobile-iap-purchase-01** — IAP purchase not bound to the initiating account (appAccountToken/obfuscated id unused)
  - Category: Security · Report: `flows/mobile-iap-purchase.md` · Fix order: P1.1 · Depends on: none
  - Files: `apps/web/src/lib/iap-apple.ts:137; iap-google.ts:230; api/mobile/iap/verify/route.ts; iap-common.ts:574; apps/mobile/src/lib/iap.ts:184`
- [ ] **account-deletion-export-04** — CCPA Do-Not-Sell opt-out is recorded but never enforced (dead resolver)
  - Category: Security · Report: `flows/account-deletion-export.md` · Fix order: P1.2 · Depends on: none
  - Files: `apps/web/src/lib/ccpa.ts:32-68; api/affiliate/click/route.ts; sponsored/click/route.ts; cron/lead-dispatch/route.ts`
- [ ] **account-deletion-export-01** — Self-service Art. 17 erasure does not purge EmailLog (plaintext email survives)
  - Category: Data · Report: `flows/account-deletion-export.md` · Fix order: P1.3 · Depends on: none
  - Files: `apps/web/src/lib/account-deletion.ts:364-371; apps/admin/src/lib/hard-delete-user.ts:309-316; schema.prisma:1564-1585`
- [ ] **external-data-integrations-01** — EV-charging integration targets a likely-wrong upstream host (developer.nlr.gov)
  - Category: Reliability · Report: `modules/external-data-integrations.md` · Fix order: P1.4 · Depends on: Verify live NREL host first (needsVerification)
  - Files: `apps/web/src/lib/nlr-alt-fuel-stations.ts:9,61,70,79; nlr-alt-fuel-stations.test.ts:75; packages/shared/src/runtime-config.ts:651-678`
- [ ] **route-map-01** — Partner self-service pages (/partners/apply, /partners/portal) unreachable while logged out
  - Category: Logic · Report: `03_ROUTE_MAP.md` · Fix order: P1.5 · Depends on: none
  - Files: `apps/web/src/middleware.ts:26-59,838-848; apps/web/src/app/partners/portal/page.tsx; partners/apply/page.tsx`
- [ ] **marketing-seo-content-01** — Legal entity name and mailing address are unresolved placeholders on legal pages
  - Category: Data · Report: `modules/marketing-seo-content.md` · Fix order: P1.6 · Depends on: Real legal entity name + mailing address from business
  - Files: `apps/web/src/lib/legal-info.ts:1-15; app/contact/page.tsx:124-130; .env.example:138-139`
- [ ] **admin-auth-security-02** — Default 'compat' proxy mode trusts client-supplied IP headers
  - Category: Security · Report: `modules/admin-auth-security.md` · Fix order: P2.1 · Depends on: Confirmed deployment edge (Cloudflare/Vercel/standard)
  - Files: `packages/shared/src/trusted-client-ip.ts; apps/admin/src/middleware.ts; auth/login/route.ts; lib/audit.ts`
- [ ] **admin-impersonation-02** — Per-mutation impersonation audit (recordImpersonatedMutation) is never invoked
  - Category: Logic · Report: `flows/admin-impersonation.md` · Fix order: P2.2 · Depends on: Decision on impersonation action allow/deny policy
  - Files: `apps/web/src/lib/impersonation-audit.ts; apps/web/src/app/api/**/route.ts`
- [ ] **component-theme-system-02** — Accent-on-white CTAs fail dark-mode contrast (EmptyState button, AppShell skip-link)
  - Category: Accessibility · Report: `modules/component-theme-system.md` · Fix order: P5.1 · Depends on: none
  - Files: `apps/web/src/components/shared/empty-state.tsx:36; layout/app-shell.tsx:108`

---

## Module TODOs

Active **Medium and above** findings per area, each as a task with Severity, Category, Report, Files, Depends on, and Fix order. Low/Info items are summarized per area (full detail in the linked report).

### App Bootstrap / Config / Env
Report: `modules/app-bootstrap-config.md`

- [ ] **app-bootstrap-config-01** — docker-compose.prod.yml does not hard-fail on several catalog-required secrets
  - Severity: Medium · Category: Security · Fix order: —
  - Files: `docker-compose.prod.yml:136-155; apps/web/src/lib/production-readiness.ts:225-243; packages/shared/src/env-catalog.ts`
  - Depends on: none

<details><summary>Low (6) / Info (1) — summarized</summary>

- **Low:** `app-bootstrap-config-02`, `app-bootstrap-config-03`, `app-bootstrap-config-04`, `app-bootstrap-config-05`, `app-bootstrap-config-06`, `app-bootstrap-config-07`
- **Info:** `app-bootstrap-config-08`

</details>

### Authentication & Session
Report: `modules/auth-session.md`

- [ ] **auth-session-02** — Step-up (verifyUserStepUp) TOTP/backup has no MFA-specific brute-force limit
  - Severity: Medium · Category: Security · Fix order: P2.4
  - Files: `apps/web/src/lib/user-step-up.ts; api/account/delete/route.ts; api/export/route.ts; export/pdf/route.ts`
  - Depends on: none
- [ ] **auth-session-01** — Google OAuth callback uses cookie-only state with no DB single-use record
  - Severity: Medium · Category: Security · Fix order: P2.5
  - Files: `apps/web/src/app/api/auth/oauth/google/callback/route.ts; oauth/google/route.ts`
  - Depends on: none

<details><summary>Low (6) / Info (1) — summarized</summary>

- **Low:** `auth-session-07`, `auth-session-04`, `auth-session-03`, `auth-session-09`, `auth-session-08`, `auth-session-10`
- **Info:** `auth-session-05`

</details>

### Authorization & Workspaces (multi-tenant + RBAC)
Report: `modules/authorization-workspaces.md`

- [ ] **authorization-workspaces-01** — Runtime-config read error fails open to legacy per-user scope with no alert
  - Severity: Medium · Category: Reliability · Fix order: P5.7
  - Files: `apps/web/src/lib/workspace-data-scope.ts:35-44; plan-limits.ts:202`
  - Depends on: none

<details><summary>Low (7) / Info (2) — summarized</summary>

- **Low:** `authorization-workspaces-02`, `authorization-workspaces-03`, `authorization-workspaces-04`, `authorization-workspaces-05`, `authorization-workspaces-06`, `authorization-workspaces-07`, `authorization-workspaces-08`
- **Info:** `authorization-workspaces-09`, `authorization-workspaces-10`

</details>

### Payments & Billing (Stripe / Web)
Report: `modules/payments-billing-web.md`

- [ ] **payments-billing-web-02** — checkout.session.completed activates side-effects without checking payment_status
  - Severity: Medium · Category: Logic · Fix order: P4.1
  - Files: `apps/web/src/app/api/webhooks/stripe/route.ts:675-797`
  - Depends on: none
- [ ] **payments-billing-web-03** — Webhook maps price to plan by identity only; no amount/currency re-verification
  - Severity: Medium · Category: Data · Fix order: P4.1
  - Files: `apps/web/src/app/api/webhooks/stripe/route.ts; lib/billing.ts:79-108; api/stripe/checkout/route.ts:60-85`
  - Depends on: none
- [ ] **payments-billing-web-01** — Schema-compat fallback silently drops webhook out-of-order write guard
  - Severity: Medium · Category: Reliability · Fix order: P4.3
  - Files: `apps/web/src/app/api/webhooks/stripe/route.ts:321-345,451-460; lib/db-schema-compat.ts`
  - Depends on: none

<details><summary>Low (8) / Info (1) — summarized</summary>

- **Low:** `payments-billing-web-04`, `payments-billing-web-05`, `payments-billing-web-06`, `payments-billing-web-07`, `payments-billing-web-08`, `payments-billing-web-09`, `payments-billing-web-10`, `payments-billing-web-S3`
- **Info:** `payments-billing-web-S2`

</details>

### Mobile IAP Billing (Apple/Google)
Report: `modules/mobile-iap-billing.md`

- [ ] **mobile-iap-billing-01** — No user-to-receipt binding; appAccountToken/obfuscatedExternalAccountId never enforced
  - Severity: High · Category: Security · Fix order: P1.1
  - Files: `apps/web/src/lib/iap-apple.ts:137; iap-google.ts:230; iap-common.ts:582-598; api/mobile/iap/verify/route.ts`
  - Depends on: none
- [ ] **mobile-iap-billing-02** — inAppOwnershipType (FAMILY_SHARED) never validated
  - Severity: Medium · Category: Security · Fix order: P4.2
  - Files: `apps/web/src/lib/iap-common.ts:348-451; iap-apple.ts:124`
  - Depends on: mobile-iap-billing-01 (account binding)
- [ ] **mobile-iap-billing-04** — iOS Server-API-down fallback grants from client JWS with no freshness bound
  - Severity: Medium · Category: Logic · Fix order: P4.2
  - Files: `apps/web/src/app/api/mobile/iap/verify/route.ts:110-123; iap-common.ts:410-451`
  - Depends on: mobile-iap-billing-01
- [ ] **mobile-iap-billing-05** — No event-ordering guard on store webhooks; refund/revoke can be undone by stale refresh
  - Severity: Medium · Category: Reliability · Fix order: P4.2
  - Files: `apps/web/src/app/api/webhooks/{appstore,playstore}/route.ts; packages/db/prisma/schema.prisma`
  - Depends on: mobile-iap-billing-01
- [ ] **mobile-iap-billing-03** — Divergent prod-like env predicates disable sandbox/test-purchase gate on staging/preview
  - Severity: Medium · Category: Security · Fix order: P4.4
  - Files: `apps/web/src/lib/billing-config.ts:3-9; iap-common.ts:515,548; webhooks/appstore,playstore/route.ts`
  - Depends on: none

<details><summary>Low (3) / Info (2) — summarized</summary>

- **Low:** `mobile-iap-billing-06`, `mobile-iap-billing-07`, `mobile-iap-billing-08`
- **Info:** `mobile-iap-billing-09`, `mobile-iap-billing-10`

</details>

### Security Platform (rate-limit, secrets, encryption, cron, kill-switches)
Report: `modules/security-platform.md`

- [ ] **security-platform-02** — Rate limiter reads Upstash creds from process.env only while same keys are Runtime-Config
  - Severity: Medium · Category: Architecture · Fix order: P4.6
  - Files: `apps/web/src/lib/rate-limit.ts:12-19; packages/shared/src/runtime-config.ts:949,962; lib/security-alerts.ts:82-97`
  - Depends on: Redis (Upstash) provisioned in prod
- [ ] **security-platform-03** — Multiple fail-open controls share a Redis/Runtime-Config failure domain
  - Severity: Medium · Category: Reliability · Fix order: P4.6
  - Files: `apps/web/src/lib/cron-guard.ts:74-79; ip-rules.ts; global-spend-guard.ts:62,84; kill-switches.ts:25-27`
  - Depends on: Redis + Runtime-Config DB resilience

<details><summary>Low (3) / Info (3) — summarized</summary>

- **Low:** `security-platform-04`, `security-platform-05`, `security-platform-06`
- **Info:** `security-platform-07`, `security-platform-08`, `security-platform-09`

</details>

_Refuted (excluded): `security-platform-01`._

### onboarding
Report: `modules/onboarding.md`

- [ ] **onboarding-02** — Web never persists Profile.isMilitary=true
  - Severity: Medium · Category: Logic · Fix order: P3.2
  - Files: `apps/web/src/app/onboarding/onboarding-client.tsx; lib/onboarding-profile-payload.ts`
  - Depends on: none
- [ ] **onboarding-03** — Gating scope mismatch: raw userId vs scoped counts
  - Severity: Medium · Category: Logic · Fix order: P3.2
  - Files: `apps/web/src/lib/post-auth-redirect.ts; api/profile/route.ts`
  - Depends on: none
- [ ] **onboarding-04** — Service saves fire N sequential POSTs
  - Severity: Medium · Category: Performance · Fix order: P4.9
  - Files: `apps/web/src/app/onboarding/onboarding-client.tsx`
  - Depends on: none
- [ ] **onboarding-05** — Partial service-save failure + non-atomic completion
  - Severity: Medium · Category: Reliability · Fix order: —
  - Files: `apps/web/src/app/onboarding/onboarding-client.tsx`
  - Depends on: none

### Addresses & Address Validation
Report: `modules/addresses-validation.md`

- [ ] **addresses-validation-01** — Autocomplete per-minute cost limit is IP-keyed, not user-keyed
  - Severity: Medium · Category: Security · Fix order: P2.4
  - Files: `apps/web/src/app/api/address-autocomplete/cost-controls.ts:46`
  - Depends on: none
- [ ] **addresses-validation-03** — handleSelect has no catch; failed details fetch silently no-ops
  - Severity: Medium · Category: UI/UX · Fix order: P3.4
  - Files: `apps/web/src/components/address/address-autocomplete-input.tsx:122`
  - Depends on: none
- [ ] **addresses-validation-02** — No timeout on Google Places server fetch
  - Severity: Medium · Category: Reliability · Fix order: P4.7
  - Files: `apps/web/src/lib/address-autocomplete.ts:172,219`
  - Depends on: none
- [ ] **addresses-validation-04** — Durable area cache returns unchecked JSON cast with no shape/version guard
  - Severity: Medium · Category: Data · Fix order: P4.10
  - Files: `apps/web/src/lib/address-data-cache.ts:117`
  - Depends on: none
- [ ] **addresses-validation-09** — No tests for USPS orchestrator or /api/addresses/validate route
  - Severity: Medium · Category: Test · Fix order: P6.5
  - Files: `apps/web/src/lib/usps-address-validation.ts; api/addresses/validate/route.ts`
  - Depends on: none

<details><summary>Low (5) / Info (1) — summarized</summary>

- **Low:** `addresses-validation-05`, `addresses-validation-06`, `addresses-validation-07`, `addresses-validation-08`, `addresses-validation-11`
- **Info:** `addresses-validation-10`

</details>

### Providers & Connectors
Report: `modules/providers-connectors.md`

- [ ] **providers-connectors-01** — Sponsored click counter inflatable by any authenticated user
  - Severity: Medium · Category: Security · Fix order: P2.4
  - Files: `apps/web/src/app/api/sponsored/click/route.ts; lib/movers.ts`
  - Depends on: none

<details><summary>Low (4) / Info (1) — summarized</summary>

- **Low:** `providers-connectors-02`, `providers-connectors-03`, `providers-connectors-04`, `providers-connectors-05`
- **Info:** `providers-connectors-06`

</details>

### Moving & Move Tasks
Report: `modules/moving-tasks.md`

- [ ] **moving-tasks-06** — /api/moving/migration ignores workspace scoping and evaluates entitlement unscoped
  - Severity: Medium · Category: Security · Fix order: P3.3
  - Files: `apps/web/src/app/api/moving/migration/route.ts:31-99`
  - Depends on: none
- [ ] **moving-tasks-03** — COMPLETE transaction lacks optimistic status guard; concurrent double-complete double-creates services
  - Severity: Medium · Category: Reliability · Fix order: P4.5
  - Files: `apps/web/src/lib/move-task-local-effects.ts:115-248; api/move-tasks/route.ts:335-349`
  - Depends on: none
- [ ] **moving-tasks-01** — CLASSIFIER move tasks never pruned when a service is removed/not regenerated
  - Severity: Medium (adjusted from High) · Category: Reverse Logic · Fix order: P4.8
  - Files: `apps/web/src/lib/move-task-generation.ts:547-631; api/moving/[id]/route.ts:116-126; cron/task-reminders/route.ts:86-120`
  - Depends on: prune pass must not touch COMPLETED/DISMISSED/user-edited
- [ ] **moving-tasks-02** — Destination-state change spawns duplicate tasks via state-suffixed idempotency keys
  - Severity: Medium · Category: Logic · Fix order: P4.8
  - Files: `apps/web/src/lib/move-task-generation.ts:285-327,443-454`
  - Depends on: none
- [ ] **moving-tasks-04** — Task-reminder cron is not entitlement-gated
  - Severity: Medium · Category: Logic · Fix order: P4.8
  - Files: `apps/web/src/app/api/cron/task-reminders/route.ts:86-120; lib/plan-limits.ts:413-433`
  - Depends on: none
- [ ] **moving-tasks-09** — 1000-provider catalog scan plus serviceability enrichment runs on every sync
  - Severity: Medium · Category: Performance · Fix order: P4.9
  - Files: `apps/web/src/lib/move-task-generation.ts:100-122`
  - Depends on: none

<details><summary>Low (6) / Info (0) — summarized</summary>

- **Low:** `moving-tasks-05`, `moving-tasks-07`, `moving-tasks-08`, `moving-tasks-10`, `moving-tasks-U2`, `moving-tasks-T1`

</details>

### Budget & Expenses
Report: `modules/budget-expenses.md`

- [ ] **budget-expenses-01** — /budget/[month] server page ignores workspace scope and omits deletedAt filter
  - Severity: Medium · Category: Security · Fix order: P3.3
  - Files: `apps/web/src/app/(app)/budget/[month]/page.tsx; lib/workspace-data-scope.ts; lib/service-active.ts`
  - Depends on: none
- [ ] **budget-expenses-02** — Client-supplied actualExpenses persisted inconsistently with server-computed savingsRate
  - Severity: Medium · Category: Data · Fix order: P3.3
  - Files: `apps/web/src/app/api/budget/route.ts; lib/validators.ts`
  - Depends on: none

<details><summary>Low (8) / Info (0) — summarized</summary>

- **Low:** `budget-expenses-04`, `budget-expenses-05`, `budget-expenses-07`, `budget-expenses-13`, `budget-expenses-17`, `budget-expenses-15`, `budget-expenses-08`, `budget-expenses-11`

</details>

### services-catalog
Report: `modules/services-catalog.md`

- [ ] **services-catalog-01** — StateRule dmvRules stored as JSON in seed.ts but plain text elsewhere; rendered raw
  - Severity: Medium · Category: Data · Fix order: P5.5
  - Files: `packages/db/prisma/seed.ts:107; seed-data/state-rules.ts:2; api/state-rules/route.ts:28; moving/[state]/page.tsx:222`
  - Depends on: none

<details><summary>Low (6) / Info (3) — summarized</summary>

- **Low:** `services-catalog-02`, `services-catalog-03`, `services-catalog-04`, `services-catalog-05`, `services-catalog-08`, `services-catalog-09`
- **Info:** `services-catalog-06`, `services-catalog-07`, `services-catalog-10`

</details>

### Notifications & Push
Report: `modules/notifications-push.md`

- [ ] **notifications-push-05** — Header notification dropdown renders feed errors as empty 'all caught up' state
  - Severity: Medium · Category: UI/UX · Fix order: P3.4
  - Files: `apps/web/src/components/layout/notification-center.tsx`
  - Depends on: none
- [ ] **notifications-push-01** — Scheduled-delivery worker fans out push/email with no preference or opt-out gate
  - Severity: Medium · Category: Security · Fix order: P3.5
  - Files: `apps/web/src/app/api/cron/scheduled-delivery/route.ts; lib/notifications.ts; apps/admin/src/lib/notify-dispatch.ts`
  - Depends on: none
- [ ] **notifications-push-04** — Notifications page sends two PATCH requests per row mark-read
  - Severity: Medium · Category: Performance · Fix order: P4.9
  - Files: `apps/web/src/app/(app)/notifications/page.tsx; lib/notification-feed-client.ts`
  - Depends on: none

<details><summary>Low (6) / Info (1) — summarized</summary>

- **Low:** `notifications-push-02`, `notifications-push-03`, `notifications-push-07`, `notifications-push-08`, `notifications-push-09`, `notifications-push-10`
- **Info:** `notifications-push-06`

</details>

### Email Pipeline
Report: `modules/email-pipeline.md`

- [ ] **email-pipeline-01** — Unsubscribe token never expires and kind is attacker-mutable (defaults to 'all')
  - Severity: Medium · Category: Security · Fix order: P2.7
  - Files: `apps/web/src/lib/unsubscribe.ts; api/unsubscribe/route.ts; lib/email-service.ts`
  - Depends on: Dedicated EMAIL_UNSUBSCRIBE_SECRET
- [ ] **email-pipeline-02** — Unsubscribe HMAC secret silently falls back to USER_JWT_SECRET
  - Severity: Medium · Category: Security · Fix order: P2.7
  - Files: `apps/web/src/lib/unsubscribe.ts; .env.example`
  - Depends on: Dedicated EMAIL_UNSUBSCRIBE_SECRET
- [ ] **email-pipeline-04** — renderTemplate substitutes raw (unescaped) value into subject while body is escaped
  - Severity: Medium · Category: Logic · Fix order: P2.7
  - Files: `apps/web/src/lib/email-service.ts:362-400`
  - Depends on: none
- [ ] **email-pipeline-03** — Non-transactional send-then-log-update leaves delivered mail stuck PENDING
  - Severity: Medium · Category: Reliability · Fix order: P4.7
  - Files: `apps/web/src/lib/email-service.ts:192-298`
  - Depends on: none

<details><summary>Low (7) / Info (1) — summarized</summary>

- **Low:** `email-pipeline-05`, `email-pipeline-06`, `email-pipeline-07`, `email-pipeline-08`, `email-pipeline-09`, `email-pipeline-10`, `email-pipeline-11`
- **Info:** `email-pipeline-12`

</details>

### External Data Integrations (gov/data APIs)
Report: `modules/external-data-integrations.md`

- [ ] **external-data-integrations-01** — EV-charging integration targets a likely-wrong upstream host (developer.nlr.gov)
  - Severity: High · Category: Reliability · Fix order: P1.4
  - Files: `apps/web/src/lib/nlr-alt-fuel-stations.ts:9,61,70,79; nlr-alt-fuel-stations.test.ts:75; packages/shared/src/runtime-config.ts:651-678`
  - Depends on: Verify live NREL host first (needsVerification)

<details><summary>Low (5) / Info (2) — summarized</summary>

- **Low:** `external-data-integrations-02`, `external-data-integrations-03`, `external-data-integrations-05`, `external-data-integrations-06`, `external-data-integrations-07`
- **Info:** `external-data-integrations-04`, `external-data-integrations-08`

</details>

### marketing-seo-content
Report: `modules/marketing-seo-content.md`

- [ ] **marketing-seo-content-01** — Legal entity name and mailing address are unresolved placeholders on legal pages
  - Severity: High · Category: Data · Fix order: P1.6
  - Files: `apps/web/src/lib/legal-info.ts:1-15; app/contact/page.tsx:124-130; .env.example:138-139`
  - Depends on: Real legal entity name + mailing address from business
- [ ] **marketing-seo-content-04** — Unsourced '4.9 on the App Store' rating hard-coded in homepage hero
  - Severity: Medium (adjusted from High) · Category: Logic · Fix order: P1.6
  - Files: `apps/web/src/app/page.tsx:249`
  - Depends on: none
- [ ] **marketing-seo-content-02** — Free-tier messaging contradicts default paid pricing across public pages
  - Severity: Medium · Category: Logic · Fix order: —
  - Files: `apps/web/src/app/why-free/page.tsx:7-44; page.tsx:236,592; faq/faq-data.ts:27-31; lib/feature-flags.ts:22-25`
  - Depends on: none
- [ ] **marketing-seo-content-03** — Default Open Graph image shows an 'M' brand glyph for 'LocateFlow'
  - Severity: Medium · Category: UI/UX · Fix order: —
  - Files: `apps/web/src/app/opengraph-image.tsx:46`
  - Depends on: none
- [ ] **marketing-seo-content-05** — /faq page and FAQPage JSON-LD always describe paid plans, not gated by CONSUMER_FREE
  - Severity: Medium · Category: Logic · Fix order: —
  - Files: `apps/web/src/app/faq/faq-data.ts:27-62; faq/structured-data.ts:37-54`
  - Depends on: none

<details><summary>Low (6) / Info (0) — summarized</summary>

- **Low:** `marketing-seo-content-06`, `marketing-seo-content-07`, `marketing-seo-content-08`, `marketing-seo-content-10`, `marketing-seo-content-09`, `marketing-seo-content-11`

</details>

### Partners, Affiliate & Movers Portal
Report: `modules/partners-affiliate-movers.md`

_No active Medium+ findings; 6 Low / 4 Info (see report)._

<details><summary>Low (6) / Info (4) — summarized</summary>

- **Low:** `partners-affiliate-movers-01`, `partners-affiliate-movers-02`, `partners-affiliate-movers-03`, `partners-affiliate-movers-04`, `partners-affiliate-movers-05`, `partners-affiliate-movers-06`
- **Info:** `partners-affiliate-movers-07`, `partners-affiliate-movers-08`, `partners-affiliate-movers-09`, `partners-affiliate-movers-10`

</details>

### Consumer Dashboard / Account (web app)
Report: `modules/dashboard-web-app.md`

- [ ] **dashboard-web-app-01** — Inline /settings account-delete never sends MFA code; MFA users hit a dead end
  - Severity: Medium (adjusted from High) · Category: Logic · Fix order: P3.1
  - Files: `apps/web/src/app/(app)/settings/page.tsx; api/account/delete/route.ts; lib/user-step-up.ts`
  - Depends on: dashboard-web-app-08 (consolidate on DeleteAccountDialog)
- [ ] **dashboard-web-app-02** — OAuth-only users cannot export their data (step-up unsatisfiable)
  - Severity: Medium · Category: Security · Fix order: P3.1
  - Files: `apps/web/src/app/api/export/route.ts; export/pdf/route.ts; (app)/settings/export/page.tsx; lib/user-step-up.ts`
  - Depends on: none
- [ ] **dashboard-web-app-08** — Two divergent account-delete UIs (inline vs DeleteAccountDialog)
  - Severity: Medium · Category: Architecture · Fix order: P3.1
  - Files: `apps/web/src/app/(app)/settings/page.tsx; components/settings/delete-account-dialog.tsx`
  - Depends on: none
- [ ] **dashboard-web-app-04** — Client fetches treat HTTP errors as empty success (no res.ok check)
  - Severity: Medium · Category: Reliability · Fix order: P3.4
  - Files: `apps/web/src/app/(app)/dashboard/dashboard-client.tsx; support/page.tsx; support/[id]/page.tsx; settings/export/page.tsx`
  - Depends on: none
- [ ] **dashboard-web-app-06** — Profile save is non-atomic (name committed before profile upsert)
  - Severity: Medium · Category: Data · Fix order: P4.5
  - Files: `apps/web/src/app/api/profile/route.ts`
  - Depends on: none
- [ ] **dashboard-web-app-05** — Notifications inbox never paginates (only first 20 reachable)
  - Severity: Medium · Category: UI/UX · Fix order: —
  - Files: `apps/web/src/app/(app)/notifications/page.tsx; api/notifications/feed/route.ts`
  - Depends on: none

<details><summary>Low (3) / Info (1) — summarized</summary>

- **Low:** `dashboard-web-app-03`, `dashboard-web-app-07`, `dashboard-web-app-09`
- **Info:** `dashboard-web-app-10`

</details>

### Admin Auth & Security
Report: `modules/admin-auth-security.md`

- [ ] **admin-auth-security-02** — Default 'compat' proxy mode trusts client-supplied IP headers
  - Severity: High · Category: Security · Fix order: P2.1
  - Files: `packages/shared/src/trusted-client-ip.ts; apps/admin/src/middleware.ts; auth/login/route.ts; lib/audit.ts`
  - Depends on: Confirmed deployment edge (Cloudflare/Vercel/standard)
- [ ] **admin-auth-security-01** — Web impersonation endpoint trusts an unverified adminId (audit-actor spoof)
  - Severity: Medium (adjusted from High) · Category: Security · Fix order: P2.2
  - Files: `apps/web/src/app/api/internal/impersonate/route.ts; apps/admin/.../users/[id]/impersonate/route.ts; auth/impersonate-handoff/route.ts`
  - Depends on: none
- [ ] **admin-auth-security-04** — Login username enumeration via bcrypt response-timing side channel
  - Severity: Medium · Category: Security · Fix order: P2.4
  - Files: `apps/admin/src/app/api/auth/login/route.ts`
  - Depends on: none
- [ ] **admin-auth-security-03** — CSRF middleware has a header-absent pass-through window for non-logout mutations
  - Severity: Medium · Category: Security · Fix order: P2.8
  - Files: `apps/admin/src/middleware.ts; lib/auth.ts`
  - Depends on: none
- [ ] **admin-auth-security-05** — IP-rule cache is fail-open with up to ~60s/instance ban lag
  - Severity: Medium · Category: Reliability · Fix order: P4.6
  - Files: `apps/admin/src/lib/ip-rules.ts; api/internal/ip-rules/route.ts`
  - Depends on: none

<details><summary>Low (3) / Info (3) — summarized</summary>

- **Low:** `admin-auth-security-06`, `admin-auth-security-07`, `admin-auth-security-08`
- **Info:** `admin-auth-security-09`, `admin-auth-security-10`, `admin-auth-security-11`

</details>

### Admin Management Surfaces
Report: `modules/admin-management.md`

- [ ] **admin-management-01** — Single-user EMAIL/PUSH notification send has no step-up
  - Severity: Medium · Category: Security · Fix order: P2.4
  - Files: `apps/admin/src/app/api/notifications/route.ts:384-414`
  - Depends on: none

### Database Schema & Data Layer
Report: `modules/database-schema.md`

- [ ] **database-schema-03** — GDPR erasure does not purge Lead/LeadDispatch/AddressChangeEvent PII
  - Severity: Medium (adjusted from High) · Category: Security · Fix order: P1.3
  - Files: `apps/web/src/lib/account-deletion.ts; packages/db/prisma/schema.prisma:2385-2429,2114-2143`
  - Depends on: none
- [ ] **database-schema-04** — Legacy plaintext Subscription.purchaseToken lingers until organic re-validation
  - Severity: Medium · Category: Security · Fix order: P2.7
  - Files: `packages/db/prisma/migrations/20260621110000_*/migration.sql; apps/web/src/lib/iap-common.ts`
  - Depends on: FIELD_ENCRYPTION_KEY available to runtime backfill job
- [ ] **database-schema-01** — Soft-delete read filter does not cascade into include/select relations
  - Severity: Medium · Category: Data · Fix order: —
  - Files: `packages/db/src/soft-delete.ts; api/cron/bill-reminders/route.ts; contract-reminders/route.ts`
  - Depends on: none

<details><summary>Low (7) / Info (1) — summarized</summary>

- **Low:** `database-schema-02`, `database-schema-05`, `database-schema-06`, `database-schema-07`, `database-schema-08`, `database-schema-09`, `database-schema-10`
- **Info:** `database-schema-11`

</details>

### Component & Theme System
Report: `modules/component-theme-system.md`

- [ ] **component-theme-system-02** — Accent-on-white CTAs fail dark-mode contrast (EmptyState button, AppShell skip-link)
  - Severity: High · Category: Accessibility · Fix order: P5.1
  - Files: `apps/web/src/components/shared/empty-state.tsx:36; layout/app-shell.tsx:108`
  - Depends on: none
- [ ] **component-theme-system-01** — Dark-mode solid semantic badges fail WCAG contrast (white on light fills)
  - Severity: Medium (adjusted from High) · Category: Accessibility · Fix order: P5.1
  - Files: `apps/web/src/components/ui/badge.tsx:14-16; apps/web/src/styles/globals.css:89-96`
  - Depends on: none
- [ ] **component-theme-system-05** — Custom Dialog: no scroll lock, asChild ignored, focusables computed once
  - Severity: Medium · Category: Accessibility · Fix order: P5.2
  - Files: `apps/web/src/components/ui/dialog.tsx:39-46,53-89,108`
  - Depends on: none
- [ ] **component-theme-system-06** — ConfirmDialog swallows onConfirm errors and closes regardless of success
  - Severity: Medium · Category: Reliability · Fix order: P5.2
  - Files: `apps/web/src/components/shared/confirm-dialog.tsx:51-59`
  - Depends on: none
- [ ] **component-theme-system-03** — Three-way design-token drift (design-tokens.ts vs web/admin globals.css)
  - Severity: Medium · Category: Architecture · Fix order: P5.6
  - Files: `packages/shared/src/design-tokens.ts:13-23; apps/web/src/styles/globals.css; apps/admin/src/app/globals.css; aurora.css`
  - Depends on: none
- [ ] **component-theme-system-04** — Component duplication across web/admin with no shared UI layer (incl. 3 theme toggles)
  - Severity: Medium · Category: Dead Code · Fix order: P5.6
  - Files: `apps/web/src/components/shared/confirm-dialog.tsx; apps/admin/src/components/confirm-dialog.tsx; landing-theme-toggle.tsx; admin/theme-toggle.tsx; admin/empty-state.tsx`
  - Depends on: none

<details><summary>Low (4) / Info (2) — summarized</summary>

- **Low:** `component-theme-system-07`, `component-theme-system-08`, `component-theme-system-09`, `component-theme-system-10`
- **Info:** `component-theme-system-11`, `component-theme-system-12`

</details>

### Analytics, Feature Flags & Runtime Config
Report: `modules/analytics-flags-runtime.md`

- [ ] **analytics-flags-runtime-01** — Non-Phase-1 internal events persist arbitrary attacker-controlled metadata
  - Severity: Medium · Category: Security · Fix order: P2.8
  - Files: `apps/web/src/app/api/tracking/event/route.ts; lib/analytics.ts`
  - Depends on: none
- [ ] **analytics-flags-runtime-02** — Feature-flag cache never invalidated; 60s staleness with no break-glass refresh
  - Severity: Medium · Category: Reliability · Fix order: P4.4
  - Files: `apps/web/src/lib/feature-flags.ts; apps/admin/src/app/api/feature-flags/route.ts`
  - Depends on: none
- [ ] **analytics-flags-runtime-03** — PERCENTAGE flag evaluation is non-deterministic without userId (Math.random fallback)
  - Severity: Medium · Category: Logic · Fix order: P4.4
  - Files: `apps/web/src/lib/feature-flags.ts:76`
  - Depends on: none

<details><summary>Low (4) / Info (3) — summarized</summary>

- **Low:** `analytics-flags-runtime-05`, `analytics-flags-runtime-06`, `analytics-flags-runtime-07`, `analytics-flags-runtime-08`
- **Info:** `analytics-flags-runtime-09`, `analytics-flags-runtime-10`, `analytics-flags-runtime-11`

</details>

### Mobile App (Expo / React Native)
Report: `modules/mobile-app.md`

- [ ] **mobile-app-01** — Personal data persisted to unencrypted AsyncStorage (offline caches/snapshots)
  - Severity: Medium · Category: Security · Fix order: P2.7
  - Files: `apps/mobile/src/lib/offline-cache.ts; local-cleanup.ts; auth-store.ts`
  - Depends on: SecureStore-held key for AsyncStorage envelope

<details><summary>Low (5) / Info (2) — summarized</summary>

- **Low:** `mobile-app-02`, `mobile-app-03`, `mobile-app-07`, `mobile-app-08`, `mobile-app-09`
- **Info:** `mobile-app-04`, `mobile-app-10`

</details>

### repo-overview
Report: `01_REPO_OVERVIEW.md`

- [ ] **repo-overview-02** — Edge middleware authenticates by JWT signature only; revocation depends on every route handler
  - Severity: Medium · Category: Security · Fix order: P2.8
  - Files: `apps/web/src/middleware.ts; apps/web/src/lib/auth.ts; user-auth.ts`
  - Depends on: none
- [ ] **repo-overview-03** — Hand-maintained public-route allowlists with prefix matching can over-expose nested routes
  - Severity: Medium · Category: Security · Fix order: P2.8
  - Files: `apps/web/src/middleware.ts; apps/admin/src/middleware.ts`
  - Depends on: none
- [ ] **repo-overview-04** — Admin rate limiter falls back to per-process in-memory store when Redis unconfigured
  - Severity: Medium · Category: Reliability · Fix order: P4.6
  - Files: `apps/admin/src/middleware.ts`
  - Depends on: Redis provisioned; deployment instance count

<details><summary>Low (1) / Info (0) — summarized</summary>

- **Low:** `repo-overview-05`

</details>

_Refuted (excluded): `repo-overview-01`._

### module-map
Report: `02_MODULE_MAP.md`

- [ ] **module-map-04** — Auth gating split: edge verifies JWT signature only, DB validation in handlers
  - Severity: Medium · Category: Security · Fix order: P2.8
  - Files: `apps/web/src/middleware.ts; lib/auth.ts; lib/user-auth.ts`
  - Depends on: none
- [ ] **module-map-01** — Design tokens duplicated by manual sync across web/admin/mobile
  - Severity: Medium · Category: Architecture · Fix order: P5.6
  - Files: `packages/shared/src/design-tokens.ts; apps/web/src/styles/globals.css; apps/admin/src/app/aurora.css; apps/mobile/src/lib/theme.ts`
  - Depends on: Phase 1-4 stable (refactor)
- [ ] **module-map-02** — Recommendation engine implemented in three+ locations
  - Severity: Medium · Category: Architecture · Fix order: P5.6
  - Files: `packages/shared/src/recommendation-engine.ts; apps/{web,mobile,admin}/src/lib/recommendation-engine.ts`
  - Depends on: none

<details><summary>Low (2) / Info (0) — summarized</summary>

- **Low:** `module-map-05`, `module-map-03`

</details>

### route-map
Report: `03_ROUTE_MAP.md`

- [ ] **route-map-01** — Partner self-service pages (/partners/apply, /partners/portal) unreachable while logged out
  - Severity: High · Category: Logic · Fix order: P1.5
  - Files: `apps/web/src/middleware.ts:26-59,838-848; apps/web/src/app/partners/portal/page.tsx; partners/apply/page.tsx`
  - Depends on: none
- [ ] **route-map-02** — /unsubscribe page is session-gated although its API is public
  - Severity: Medium · Category: Logic · Fix order: P1.5
  - Files: `apps/web/src/middleware.ts:26-59,104,660; apps/web/src/app/unsubscribe/page.tsx`
  - Depends on: none
- [ ] **route-map-03** — Privileged admin pages with no page-level role guard (fail-open chrome)
  - Severity: Medium · Category: Security · Fix order: P2.6
  - Files: `apps/admin/src/lib/page-guard.ts; apps/admin/src/app/(admin)/{users,waitlist,providers,reports,...}/page.tsx; (admin)/layout.tsx`
  - Depends on: none

<details><summary>Low (1) / Info (1) — summarized</summary>

- **Low:** `route-map-04`
- **Info:** `route-map-05`

</details>

### api-map
Report: `04_API_MAP.md`

- [ ] **api-map-01** — Admin API relies on global auth gate without per-route rate limiting
  - Severity: Medium · Category: Security · Fix order: —
  - Files: `apps/admin/src/middleware.ts; lib/auth.ts; users/export, providers/export, analytics routes`
  - Depends on: none

<details><summary>Low (2) / Info (2) — summarized</summary>

- **Low:** `api-map-02`, `api-map-03`
- **Info:** `api-map-04`, `api-map-05`

</details>

### data-flow-map
Report: `05_DATA_FLOW_MAP.md`

- [ ] **data-flow-map-06** — Lead PII keyed by loose userId is not explicitly purged on account deletion
  - Severity: Medium · Category: Data · Fix order: P1.3
  - Files: `packages/db/prisma/schema.prisma:2385-2429; apps/web/src/lib/account-deletion.ts:359-371`
  - Depends on: none
- [ ] **data-flow-map-01** — UserCustomProvider stores contact/address PII in plaintext and has no tenant scope
  - Severity: Medium · Category: Data · Fix order: P2.7
  - Files: `packages/db/prisma/schema.prisma:1025-1068; api/custom-providers/route.ts; api/services/route.ts:274`
  - Depends on: FIELD_ENCRYPTION_KEY
- [ ] **data-flow-map-03** — AddressChangeEvent.fullName is plaintext PII while connector pipeline is encrypted
  - Severity: Medium · Category: Data · Fix order: P2.7
  - Files: `packages/db/prisma/schema.prisma:2114-2143`
  - Depends on: FIELD_ENCRYPTION_KEY

<details><summary>Low (5) / Info (0) — summarized</summary>

- **Low:** `data-flow-map-04`, `data-flow-map-05`, `data-flow-map-02`, `data-flow-map-07`, `data-flow-map-08`

</details>

### component-system
Report: `06_COMPONENT_SYSTEM.md`

- [ ] **component-system-03** — Same-named UI primitives forked per app (web/admin/mobile)
  - Severity: Medium · Category: Theme · Fix order: P5.1
  - Files: `apps/web/src/components/shared/confirm-dialog.tsx; apps/admin/src/components/confirm-dialog.tsx; language-selector.tsx (both)`
  - Depends on: none
- [ ] **component-system-04** — Mobile NativeWind className palette is fixed-dark and ignores light theme
  - Severity: Medium · Category: Theme · Fix order: P5.1
  - Files: `apps/mobile/tailwind.config.ts; apps/mobile/src/lib/theme.ts:40-45`
  - Depends on: none
- [ ] **component-system-07** — Web Dialog is a hand-rolled modal (no Radix), incomplete a11y
  - Severity: Medium · Category: Accessibility · Fix order: P5.2
  - Files: `apps/web/src/components/ui/dialog.tsx; apps/admin/src/components/confirm-dialog.tsx; password-confirm-modal.tsx`
  - Depends on: none
- [ ] **component-system-05** — Web Button primitive exists but is bypassed across the app
  - Severity: Medium · Category: UI/UX · Fix order: P5.6
  - Files: `apps/web/src/components/ui/button.tsx; shared/empty-state.tsx; apps/admin/src/components/data-table-page.tsx`
  - Depends on: none
- [ ] **component-system-06** — Empty-state and loading components duplicated 3x with diverging APIs
  - Severity: Medium · Category: UI/UX · Fix order: P5.6
  - Files: `apps/web/src/components/shared/empty-state.tsx; premium/foil-empty-state.tsx; apps/admin/src/components/empty-state.tsx; apps/mobile/.../EmptyState.tsx; shared/loading-state.tsx`
  - Depends on: none
- [ ] **component-system-01** — component-system-01
  - Severity: Medium (adjusted from High) · Category: Architecture · Fix order: —
  - Files: `—`
  - Depends on: none
- [ ] **component-system-02** — component-system-02
  - Severity: Medium (adjusted from High) · Category: Architecture · Fix order: —
  - Files: `—`
  - Depends on: none

<details><summary>Low (3) / Info (0) — summarized</summary>

- **Low:** `component-system-08`, `component-system-09`, `component-system-10`

</details>

### security-surface
Report: `07_SECURITY_SURFACE.md`

- [ ] **security-surface-04** — Client-IP resolver defaults to permissive 'compat' mode honoring client headers
  - Severity: Medium (adjusted from High) · Category: Security · Fix order: P2.1
  - Files: `packages/shared/src/trusted-client-ip.ts; apps/web/src/lib/client-ip.ts; middleware.ts (web+admin)`
  - Depends on: Confirmed deployment edge shape (TRUSTED_PROXY_HEADERS)
- [ ] **security-surface-01** — Audit-log free-text fields are not value-scrubbed for PII
  - Severity: Medium · Category: Data · Fix order: P2.7
  - Files: `packages/shared/src/audit-redaction.ts; apps/web/src/lib/audit.ts; sentry-redaction.ts`
  - Depends on: none
- [ ] **security-surface-05** — Edge auth is JWT-signature-only; revocation/scoping rely on per-route guards
  - Severity: Medium · Category: Architecture · Fix order: P2.8
  - Files: `apps/web/src/middleware.ts; lib/user-auth.ts; lib/workspace-data-scope.ts; lib/workspace-context.ts`
  - Depends on: none
- [ ] **security-surface-03** — Rate-limit in-memory fallback is per-process and silently weak without Redis
  - Severity: Medium · Category: Reliability · Fix order: P4.6
  - Files: `apps/web/src/lib/rate-limit.ts; rate-limit-policy.ts; apps/admin/src/middleware.ts`
  - Depends on: Redis provisioned
- [ ] **security-surface-09** — Body-size/signature coverage of all /api/webhooks/* routes unconfirmed
  - Severity: Medium · Category: Reliability · Fix order: P4.7
  - Files: `apps/web/src/app/api/webhooks/{playstore,resend,stripe,appstore}/route.ts; middleware.ts`
  - Depends on: none

<details><summary>Low (4) / Info (2) — summarized</summary>

- **Low:** `security-surface-02`, `security-surface-07`, `security-surface-11`, `security-surface-10`
- **Info:** `security-surface-06`, `security-surface-08`

</details>

### ui-ux-baseline
Report: `08_UI_UX_BASELINE.md`

- [ ] **ui-ux-12** — Input/Textarea primitives have no error/invalid state or label association
  - Severity: Medium · Category: Accessibility · Fix order: P5.2
  - Files: `apps/web/src/components/ui/{input,textarea,label}.tsx`
  - Depends on: none
- [ ] **ui-ux-15** — Mobile bottom nav lacks aria-current and nav label; active state color-only
  - Severity: Medium · Category: Accessibility · Fix order: P5.2
  - Files: `apps/web/src/components/layout/mobile-nav.tsx`
  - Depends on: none
- [ ] **ui-ux-08** — Web/admin do not import design tokens at runtime — manual palette copies (drift)
  - Severity: Medium · Category: Architecture · Fix order: P5.6
  - Files: `packages/shared/src/design-tokens.ts; apps/web/src/styles/globals.css; apps/admin/src/app/globals.css`
  - Depends on: Phase 1-4 stable (refactor)
- [ ] **ui-ux-14** — No centralized Table / Tabs / Dropdown / Loading-spinner primitives
  - Severity: Medium · Category: UI/UX · Fix order: P5.6
  - Files: `apps/web/src/components/ui/; apps/admin/src/app/(admin)`
  - Depends on: none

<details><summary>Low (10) / Info (3) — summarized</summary>

- **Low:** `ui-ux-05`, `ui-ux-06`, `ui-ux-18`, `ui-ux-02`, `ui-ux-10`, `ui-ux-03`, `ui-ux-07`, `ui-ux-04`, `ui-ux-11`, `ui-ux-16`
- **Info:** `ui-ux-13`, `ui-ux-09`, `ui-ux-19`

</details>

### Signup / Login / Session flow (apps/web)
Report: `flows/signup-login.md`

- [ ] **signup-login-01** — Google OAuth callback lacks server-side single-use/replay state binding
  - Severity: Medium · Category: Security · Fix order: P2.5
  - Files: `apps/web/src/app/api/auth/oauth/google/route.ts; google/callback/route.ts; apple/callback/route.ts`
  - Depends on: none
- [ ] **signup-login-03** — Registration is non-transactional; failure after user.create orphans the account
  - Severity: Medium · Category: Reliability · Fix order: P4.5
  - Files: `apps/web/src/app/api/auth/register/route.ts`
  - Depends on: none

<details><summary>Low (4) / Info (1) — summarized</summary>

- **Low:** `signup-login-02`, `signup-login-04`, `signup-login-05`, `signup-login-07`
- **Info:** `signup-login-06`

</details>

### onboarding-flow
Report: `flows/onboarding-flow.md`

- [ ] **onboarding-flow-01** — COMPLETED event short-circuits address/service requirement with no server-side validation
  - Severity: Medium · Category: Reverse Logic · Fix order: P3.2
  - Files: `apps/web/src/lib/onboarding-progress.ts:39-61; api/onboarding/progress/route.ts:62-76; onboarding-client.tsx:939-951`
  - Depends on: none
- [ ] **onboarding-flow-02** — Onboarding record counts use different scoping in the gate vs /api/profile
  - Severity: Medium · Category: Data · Fix order: P3.2
  - Files: `apps/web/src/lib/post-auth-redirect.ts:85-146; api/profile/route.ts:48-116`
  - Depends on: shared scoping helper (with onboarding-03)
- [ ] **onboarding-flow-03** — isMilitary (SENSITIVE) hardcoded false on resume and overwritten on next save
  - Severity: Medium · Category: Logic · Fix order: P3.2
  - Files: `apps/web/src/app/onboarding/onboarding-client.tsx:249-269,1655-1669; lib/onboarding-profile-payload.ts:38`
  - Depends on: none

<details><summary>Low (3) / Info (1) — summarized</summary>

- **Low:** `onboarding-flow-06`, `onboarding-flow-07`, `onboarding-flow-08`
- **Info:** `onboarding-flow-09`

</details>

### Address Change / Relocation flow (web)
Report: `flows/address-change-relocation.md`

- [ ] **address-change-relocation-01** — Migration analysis scoped by plan.userId equality, ignoring workspace membership
  - Severity: Medium · Category: Reverse Logic · Fix order: P3.3
  - Files: `apps/web/src/app/api/moving/migration/route.ts:66,81`
  - Depends on: none
- [ ] **address-change-relocation-03** — buildMoveTransitionContext gates on plan.userId, inconsistent with workspace-scoped task reads
  - Severity: Medium · Category: Reverse Logic · Fix order: P3.3
  - Files: `apps/web/src/lib/move-task-generation.ts:58; api/move-tasks/route.ts:180`
  - Depends on: none
- [ ] **address-change-relocation-04** — Inline move-destination address bypasses USPS validation/correction
  - Severity: Medium · Category: Logic · Fix order: P3.6
  - Files: `apps/web/src/app/api/moving/route.ts:213; (app)/moving/new/page.tsx:216`
  - Depends on: none
- [ ] **address-change-relocation-02** — Move-task generation find-then-create is non-transactional with no unique-conflict handling
  - Severity: Medium · Category: Reliability · Fix order: P4.5
  - Files: `apps/web/src/lib/move-task-generation.ts:551,619; packages/db/prisma/schema.prisma:1008`
  - Depends on: none

<details><summary>Low (5) / Info (1) — summarized</summary>

- **Low:** `address-change-relocation-05`, `address-change-relocation-06`, `address-change-relocation-07`, `address-change-relocation-08`, `address-change-relocation-09`
- **Info:** `address-change-relocation-10`

</details>

### Subscription Payment (Stripe / Web)
Report: `flows/subscription-payment-web.md`

- [ ] **subscription-payment-web-01** — checkout.session.completed entitles metadata userId without verifying session customer ownership
  - Severity: Medium · Category: Security · Fix order: P4.1
  - Files: `apps/web/src/app/api/webhooks/stripe/route.ts:684-720,188-192`
  - Depends on: none
- [ ] **subscription-payment-web-03** — firstChargeAt can become stale after trial resume/cancel and not normalized for monthly offers
  - Severity: Medium · Category: Data · Fix order: P4.1
  - Files: `apps/web/src/app/api/stripe/checkout/route.ts:606-637; webhooks/stripe/route.ts:431-433; components/settings/subscription-management.tsx:363-368`
  - Depends on: none
- [ ] **subscription-payment-web-02** — Webhook idempotency reservation-release on failure is best-effort and unmonitored
  - Severity: Medium · Category: Reliability · Fix order: P4.3
  - Files: `apps/web/src/app/api/webhooks/stripe/route.ts:1316-1322; lib/webhook-idempotency.ts:35-37`
  - Depends on: none

<details><summary>Low (3) / Info (1) — summarized</summary>

- **Low:** `subscription-payment-web-04`, `subscription-payment-web-05`, `subscription-payment-web-06`
- **Info:** `subscription-payment-web-07`

</details>

### Mobile IAP Purchase flow
Report: `flows/mobile-iap-purchase.md`

- [ ] **mobile-iap-purchase-01** — IAP purchase not bound to the initiating account (appAccountToken/obfuscated id unused)
  - Severity: High · Category: Security · Fix order: P1.1
  - Files: `apps/web/src/lib/iap-apple.ts:137; iap-google.ts:230; api/mobile/iap/verify/route.ts; iap-common.ts:574; apps/mobile/src/lib/iap.ts:184`
  - Depends on: none
- [ ] **mobile-iap-purchase-02** — inAppOwnershipType not enforced; FAMILY_SHARED receipts grant full entitlement
  - Severity: Medium · Category: Logic · Fix order: P4.2
  - Files: `apps/web/src/lib/iap-apple.ts:124; iap-common.ts:348,410`
  - Depends on: mobile-iap-purchase-01
- [ ] **mobile-iap-purchase-03** — iOS local-JWS fallback trusts client signed transaction with no freshness bound
  - Severity: Medium · Category: Reliability · Fix order: P4.2
  - Files: `apps/web/src/app/api/mobile/iap/verify/route.ts:110; iap-common.ts:410; webhooks/appstore/route.ts:115`
  - Depends on: mobile-iap-purchase-01

<details><summary>Low (3) / Info (1) — summarized</summary>

- **Low:** `mobile-iap-purchase-04`, `mobile-iap-purchase-05`, `mobile-iap-purchase-06`
- **Info:** `mobile-iap-purchase-07`

</details>

### Workspace Invitation / Household
Report: `flows/workspace-invitation-household.md`

- [ ] **workspace-invitation-household-01** — Token-accept route lacks email-verification gate (inconsistent with in-app accept)
  - Severity: Medium · Category: Security · Fix order: P2.3
  - Files: `apps/web/src/app/api/invitations/[token]/accept/route.ts; lib/email-verification-gate.ts; auth/register/route.ts`
  - Depends on: none
- [ ] **workspace-invitation-household-02** — No rate limiting on invite accept/decline or public validate routes
  - Severity: Medium · Category: Security · Fix order: P2.3
  - Files: `apps/web/src/app/api/invitations/[token]/accept/route.ts; [token]/route.ts; pending/[id]/accept/route.ts`
  - Depends on: none
- [ ] **workspace-invitation-household-03** — Joiner's personal data absorbed into workspace on accept, not restored on removal/leave
  - Severity: Medium · Category: Data · Fix order: P2.3
  - Files: `apps/web/src/lib/workspace-invite-accept.ts; workspaces/[id]/members/[memberId]/route.ts; members/leave/route.ts`
  - Depends on: none

<details><summary>Low (3) / Info (2) — summarized</summary>

- **Low:** `workspace-invitation-household-04`, `workspace-invitation-household-05`, `workspace-invitation-household-06`
- **Info:** `workspace-invitation-household-07`, `workspace-invitation-household-08`

</details>

### Provider / Connector Dispatch
Report: `flows/provider-connector-dispatch.md`

- [ ] **provider-connector-dispatch-03** — Webhook idempotency keyed on raw-body hash, not dispatch ref + outcome
  - Severity: Medium · Category: Reliability · Fix order: P4.7
  - Files: `apps/web/src/app/api/connectors/[key]/webhook/route.ts:118-134`
  - Depends on: none
- [ ] **provider-connector-dispatch-02** — Double-enqueue / double-file race on dispatch (perUserPerDay cap counted pre-commit)
  - Severity: Medium · Category: Logic · Fix order: P4.8
  - Files: `apps/web/src/lib/connector-runtime.ts:220,258-286,294-332`
  - Depends on: none
- [ ] **provider-connector-dispatch-01** — Hot-path mode derivation does 5 sequential runtime-config DB reads per row per attempt
  - Severity: Medium · Category: Performance · Fix order: P4.9
  - Files: `apps/web/src/lib/connector-runtime.ts:133-164,448; lib/runtime-config.ts:28-54`
  - Depends on: none

<details><summary>Low (3) / Info (2) — summarized</summary>

- **Low:** `provider-connector-dispatch-04`, `provider-connector-dispatch-05`, `provider-connector-dispatch-06`
- **Info:** `provider-connector-dispatch-07`, `provider-connector-dispatch-08`

</details>

### Admin Impersonation flow
Report: `flows/admin-impersonation.md`

- [ ] **admin-impersonation-02** — Per-mutation impersonation audit (recordImpersonatedMutation) is never invoked
  - Severity: High · Category: Logic · Fix order: P2.2
  - Files: `apps/web/src/lib/impersonation-audit.ts; apps/web/src/app/api/**/route.ts`
  - Depends on: Decision on impersonation action allow/deny policy
- [ ] **admin-impersonation-04** — Impersonated session is full-privilege with no action allow/deny scoping
  - Severity: Medium · Category: Security · Fix order: P2.2
  - Files: `apps/web/src/lib/user-auth.ts; middleware.ts; api/auth/security/route.ts`
  - Depends on: Decision on impersonation action allow/deny policy; admin-impersonation-02
- [ ] **admin-impersonation-05** — Impersonation browser cookie omits fp claim (not device-bound for 15 min)
  - Severity: Medium · Category: Security · Fix order: P2.2
  - Files: `apps/web/src/app/api/internal/impersonate/route.ts; auth/impersonate-handoff/route.ts`
  - Depends on: none

<details><summary>Low (3) / Info (2) — summarized</summary>

- **Low:** `admin-impersonation-01`, `admin-impersonation-06`, `admin-impersonation-07`
- **Info:** `admin-impersonation-08`, `admin-impersonation-09`

</details>

### Notification / Email / Digest flow
Report: `flows/notification-email-digest.md`

- [ ] **notification-email-digest-04** — Scheduled/broadcast worker fans out EMAIL/PUSH without re-checking per-user opt-out
  - Severity: Medium · Category: Logic · Fix order: P3.5
  - Files: `apps/web/src/app/api/cron/scheduled-delivery/route.ts:111-137; lib/notifications.ts:31-90`
  - Depends on: none
- [ ] **notification-email-digest-01** — Resend bounce (any subtype) triggers permanent opt-out from ALL email
  - Severity: Medium · Category: Reliability · Fix order: P4.7
  - Files: `apps/web/src/app/api/webhooks/resend/route.ts:104-105; lib/unsubscribe-actions.ts:18-69; unsubscribe.ts:96-100`
  - Depends on: none
- [ ] **notification-email-digest-02** — Unsubscribe HMAC token has no expiry, binds only userId, falls back to USER_JWT_SECRET
  - Severity: Medium · Category: Security · Fix order: —
  - Files: `apps/web/src/lib/unsubscribe.ts:19-67; lib/email-service.ts:155-176`
  - Depends on: Dedicated EMAIL_UNSUBSCRIBE_SECRET

<details><summary>Low (2) / Info (3) — summarized</summary>

- **Low:** `notification-email-digest-03`, `notification-email-digest-06`
- **Info:** `notification-email-digest-05`, `notification-email-digest-07`, `notification-email-digest-08`

</details>

### Account Deletion / Data Export (CCPA)
Report: `flows/account-deletion-export.md`

- [ ] **account-deletion-export-04** — CCPA Do-Not-Sell opt-out is recorded but never enforced (dead resolver)
  - Severity: High · Category: Security · Fix order: P1.2
  - Files: `apps/web/src/lib/ccpa.ts:32-68; api/affiliate/click/route.ts; sponsored/click/route.ts; cron/lead-dispatch/route.ts`
  - Depends on: none
- [ ] **account-deletion-export-01** — Self-service Art. 17 erasure does not purge EmailLog (plaintext email survives)
  - Severity: High · Category: Data · Fix order: P1.3
  - Files: `apps/web/src/lib/account-deletion.ts:364-371; apps/admin/src/lib/hard-delete-user.ts:309-316; schema.prisma:1564-1585`
  - Depends on: none
- [ ] **account-deletion-export-08** — Web export page has no MFA input; MFA users cannot export their data
  - Severity: Medium · Category: UI/UX · Fix order: P3.1
  - Files: `apps/web/src/app/(app)/settings/export/page.tsx:175-197,401-413; lib/user-step-up.ts:61-122; apps/mobile/app/settings/export.tsx:67-101`
  - Depends on: none
- [ ] **account-deletion-export-03** — Typed-DELETE intent gate validated server-side only for OAuth-only path
  - Severity: Medium · Category: Logic · Fix order: —
  - Files: `apps/web/src/app/api/account/delete/route.ts:19-25,66-86`
  - Depends on: none
- [ ] **account-deletion-export-05** — No uniqueness guard against duplicate active DELETE GDPRRequests
  - Severity: Medium · Category: Reliability · Fix order: —
  - Files: `apps/web/src/lib/account-deletion.ts:158-197; api/account/delete/route.ts:140-159`
  - Depends on: none

<details><summary>Low (2) / Info (1) — summarized</summary>

- **Low:** `account-deletion-export-06`, `account-deletion-export-07`
- **Info:** `account-deletion-export-09`

</details>

### Dead Code & Tech Debt Static Sweep
Report: `dead-code-tech-debt-sweep.md`

- [ ] **dead-02** — SQLite->MySQL one-shot migration tooling left in active prisma dir
  - Severity: Medium · Category: Dead Code · Fix order: P5.4
  - Files: `packages/db/prisma/_migrate-to-mysql.ts; _migration-data.json; legacy-sqlite-migrations/`
  - Depends on: none
- [ ] **dead-03** — recharts declared but never imported in web and admin
  - Severity: Medium · Category: Dead Code · Fix order: P5.4
  - Files: `apps/web/package.json; apps/admin/package.json; apps/admin/src/components/aurora/revenue-trend.tsx`
  - Depends on: none
- [ ] **dead-01** — Duplicated validators.ts (web vs shared) has drifted
  - Severity: Medium · Category: Data · Fix order: P5.6
  - Files: `apps/web/src/lib/validators.ts; packages/shared/src/validators.ts; packages/shared/src/index.ts`
  - Depends on: none

<details><summary>Low (4) / Info (0) — summarized</summary>

- **Low:** `dead-04`, `dead-05`, `dead-06`, `dead-07`

</details>

---

## Questions To Resolve

Open items requiring code re-verification, an external/business decision, or a deployment-fact confirmation before the linked fix can be closed.

### Code re-verification (`needsVerification = true`)

72 active findings still need a code-level confirmation:

- [ ] **external-data-integrations-01** (High/Reliability) — EV-charging integration targets a likely-wrong upstream host (developer.nlr.gov) · Report: `modules/external-data-integrations.md`
- [ ] **route-map-01** (High/Logic) — Partner self-service pages (/partners/apply, /partners/portal) unreachable while logged out · Report: `03_ROUTE_MAP.md`
- [ ] **addresses-validation-04** (Medium/Data) — Durable area cache returns unchecked JSON cast with no shape/version guard · Report: `modules/addresses-validation.md`
- [ ] **admin-auth-security-01** (Medium/Security) — Web impersonation endpoint trusts an unverified adminId (audit-actor spoof) · Report: `modules/admin-auth-security.md`
- [ ] **analytics-flags-runtime-01** (Medium/Security) — Non-Phase-1 internal events persist arbitrary attacker-controlled metadata · Report: `modules/analytics-flags-runtime.md`
- [ ] **component-system-04** (Medium/Theme) — Mobile NativeWind className palette is fixed-dark and ignores light theme · Report: `06_COMPONENT_SYSTEM.md`
- [ ] **data-flow-map-01** (Medium/Data) — UserCustomProvider stores contact/address PII in plaintext and has no tenant scope · Report: `05_DATA_FLOW_MAP.md`
- [ ] **data-flow-map-06** (Medium/Data) — Lead PII keyed by loose userId is not explicitly purged on account deletion · Report: `05_DATA_FLOW_MAP.md`
- [ ] **mobile-iap-billing-03** (Medium/Security) — Divergent prod-like env predicates disable sandbox/test-purchase gate on staging/preview · Report: `modules/mobile-iap-billing.md`
- [ ] **mobile-iap-billing-05** (Medium/Reliability) — No event-ordering guard on store webhooks; refund/revoke can be undone by stale refresh · Report: `modules/mobile-iap-billing.md`
- [ ] **module-map-02** (Medium/Architecture) — Recommendation engine implemented in three+ locations · Report: `02_MODULE_MAP.md`
- [ ] **module-map-04** (Medium/Security) — Auth gating split: edge verifies JWT signature only, DB validation in handlers · Report: `02_MODULE_MAP.md`
- [ ] **notification-email-digest-04** (Medium/Logic) — Scheduled/broadcast worker fans out EMAIL/PUSH without re-checking per-user opt-out · Report: `flows/notification-email-digest.md`
- [ ] **repo-overview-02** (Medium/Security) — Edge middleware authenticates by JWT signature only; revocation depends on every route handler · Report: `01_REPO_OVERVIEW.md`
- [ ] **repo-overview-03** (Medium/Security) — Hand-maintained public-route allowlists with prefix matching can over-expose nested routes · Report: `01_REPO_OVERVIEW.md`
- [ ] **repo-overview-04** (Medium/Reliability) — Admin rate limiter falls back to per-process in-memory store when Redis unconfigured · Report: `01_REPO_OVERVIEW.md`
- [ ] **route-map-02** (Medium/Logic) — /unsubscribe page is session-gated although its API is public · Report: `03_ROUTE_MAP.md`
- [ ] **route-map-03** (Medium/Security) — Privileged admin pages with no page-level role guard (fail-open chrome) · Report: `03_ROUTE_MAP.md`
- [ ] **security-surface-04** (Medium/Security) — Client-IP resolver defaults to permissive 'compat' mode honoring client headers · Report: `07_SECURITY_SURFACE.md`
- [ ] **security-surface-05** (Medium/Architecture) — Edge auth is JWT-signature-only; revocation/scoping rely on per-route guards · Report: `07_SECURITY_SURFACE.md`
- [ ] **security-surface-09** (Medium/Reliability) — Body-size/signature coverage of all /api/webhooks/* routes unconfirmed · Report: `07_SECURITY_SURFACE.md`
- [ ] **subscription-payment-web-03** (Medium/Data) — firstChargeAt can become stale after trial resume/cancel and not normalized for monthly offers · Report: `flows/subscription-payment-web.md`
- [ ] **ui-ux-14** (Medium/UI/UX) — No centralized Table / Tabs / Dropdown / Loading-spinner primitives · Report: `08_UI_UX_BASELINE.md`
- [ ] **auth-session-03** (Low/Security) · Report: `modules/auth-session.md`
- [ ] **auth-session-08** (Low/Dead Code) · Report: `modules/auth-session.md`
- [ ] **authorization-workspaces-07** (Low/Dead Code) · Report: `modules/authorization-workspaces.md`
- [ ] **budget-expenses-04** (Low/Data) · Report: `modules/budget-expenses.md`
- [ ] **budget-expenses-07** (Low/Logic) · Report: `modules/budget-expenses.md`
- [ ] **data-flow-map-04** (Low/Data) · Report: `05_DATA_FLOW_MAP.md`
- [ ] **data-flow-map-08** (Low/Reliability) · Report: `05_DATA_FLOW_MAP.md`
- [ ] **database-schema-07** (Low/Data) · Report: `modules/database-schema.md`
- [ ] **dead-04** (Low/Architecture) · Report: `dead-code-tech-debt-sweep.md`
- [ ] **dead-07** (Low/Architecture) · Report: `dead-code-tech-debt-sweep.md`
- [ ] **marketing-seo-content-08** (Low/Performance) · Report: `modules/marketing-seo-content.md`
- [ ] **marketing-seo-content-09** (Low/Performance) · Report: `modules/marketing-seo-content.md`
- [ ] **marketing-seo-content-10** (Low/Dead Code) · Report: `modules/marketing-seo-content.md`
- [ ] **mobile-app-03** (Low/Security) · Report: `modules/mobile-app.md`
- [ ] **module-map-05** (Low/Security) — Large hand-maintained public-route allow-list with prefix matching · Report: `02_MODULE_MAP.md`
- [ ] **moving-tasks-05** (Low/Logic) · Report: `modules/moving-tasks.md`
- [ ] **moving-tasks-08** (Low/Security) · Report: `modules/moving-tasks.md`
- [ ] **notifications-push-02** (Low/Security) · Report: `modules/notifications-push.md`
- [ ] **onboarding-flow-06** (Low/Reliability) · Report: `flows/onboarding-flow.md`
- [ ] **repo-overview-05** (Low/Security) · Report: `01_REPO_OVERVIEW.md`
- [ ] **security-surface-07** (Low/Reliability) · Report: `07_SECURITY_SURFACE.md`
- [ ] **security-surface-10** (Low/Security) · Report: `07_SECURITY_SURFACE.md`
- [ ] **security-surface-11** (Low/Security) · Report: `07_SECURITY_SURFACE.md`
- [ ] **services-catalog-02** (Low/Architecture) · Report: `modules/services-catalog.md`
- [ ] **services-catalog-05** (Low/Security) · Report: `modules/services-catalog.md`
- [ ] **signup-login-05** (Low/Logic) · Report: `flows/signup-login.md`
- [ ] **subscription-payment-web-05** (Low/Security) · Report: `flows/subscription-payment-web.md`
- [ ] **ui-ux-03** (Low/Theme) · Report: `08_UI_UX_BASELINE.md`
- [ ] **ui-ux-04** (Low/UI/UX) · Report: `08_UI_UX_BASELINE.md`
- [ ] **ui-ux-06** (Low/Theme) · Report: `08_UI_UX_BASELINE.md`
- [ ] **ui-ux-07** (Low/Accessibility) · Report: `08_UI_UX_BASELINE.md`
- [ ] **ui-ux-10** (Low/Performance) · Report: `08_UI_UX_BASELINE.md`
- [ ] **ui-ux-11** (Low/Accessibility) · Report: `08_UI_UX_BASELINE.md`
- [ ] **ui-ux-16** (Low/Accessibility) · Report: `08_UI_UX_BASELINE.md`
- [ ] **workspace-invitation-household-04** (Low/Logic) · Report: `flows/workspace-invitation-household.md`
- [ ] **workspace-invitation-household-06** (Low/Logic) · Report: `flows/workspace-invitation-household.md`
- [ ] **addresses-validation-10** (Info/Security) · Report: `modules/addresses-validation.md`
- [ ] **admin-auth-security-11** (Info/Dead Code) · Report: `modules/admin-auth-security.md`
- [ ] **analytics-flags-runtime-09** (Info/Dead Code) · Report: `modules/analytics-flags-runtime.md`
- [ ] **api-map-04** (Info/Architecture) · Report: `04_API_MAP.md`
- [ ] **dashboard-web-app-10** (Info/Dead Code) · Report: `modules/dashboard-web-app.md`
- [ ] **mobile-app-10** (Info/Dead Code) · Report: `modules/mobile-app.md`
- [ ] **mobile-iap-billing-09** (Info/Dead Code) · Report: `modules/mobile-iap-billing.md`
- [ ] **mobile-iap-billing-10** (Info/Reliability) · Report: `modules/mobile-iap-billing.md`
- [ ] **partners-affiliate-movers-10** (Info/Test) · Report: `modules/partners-affiliate-movers.md`
- [ ] **provider-connector-dispatch-07** (Info/Logic) · Report: `flows/provider-connector-dispatch.md`
- [ ] **security-platform-09** (Info/Security) · Report: `modules/security-platform.md`
- [ ] **services-catalog-07** (Info/Reliability) · Report: `modules/services-catalog.md`
- [ ] **services-catalog-10** (Info/Reliability) · Report: `modules/services-catalog.md`

### External / business / deployment decisions

- [ ] **Deployment edge shape** — Confirm the real edge (Cloudflare / Vercel / standard) and set `TRUSTED_PROXY_HEADERS` explicitly in every environment; without it the IP resolver defaults to permissive `compat`. Blocks `admin-auth-security-02`, `security-surface-04`, and downstream IP-keyed controls (`security-platform-05`, `repo-overview-04`).
- [ ] **Live NREL host** — Verify the EV-charging upstream host/path against current NREL developer docs (`developer.nrel.gov` vs the hard-coded `developer.nlr.gov`) before repointing. Blocks `external-data-integrations-01`.
- [ ] **Legal entity + mailing address** — Obtain the real legal entity name and public mailing address from the business; legal/contact pages currently render placeholders. Blocks `marketing-seo-content-01`.
- [ ] **Pricing model decision** — Decide whether `CONSUMER_FREE` ships on or off and reconcile all "free" vs paid marketing/SEO copy + FAQ/structured-data. Blocks `marketing-seo-content-02/05`.
- [ ] **App-store rating** — Remove or source the hard-coded "4.9 on the App Store" chip from a verified, attributable value. Blocks `marketing-seo-content-04`.
- [ ] **Impersonation action policy** — Decide an allow/deny scoping policy for impersonated sessions (which user mutations are permitted while impersonating). Blocks `admin-impersonation-02/04`.
- [ ] **Redis provisioning** — Provision Upstash Redis for prod and decide fail-closed posture for auth/abuse limiters + lockout; unify env vs Runtime-Config source of truth. Blocks `security-platform-02/03`, `security-surface-03`, `repo-overview-04`, `signup-login-04`.
- [ ] **Dedicated unsubscribe secret** — Provision a dedicated `EMAIL_UNSUBSCRIBE_SECRET` (currently falls back to `USER_JWT_SECRET`). Blocks `email-pipeline-01/02`, `notification-email-digest-02`.
- [ ] **Encryption-key backfill window** — Schedule an app-runtime backfill (needs `FIELD_ENCRYPTION_KEY`) to encrypt remaining plaintext PII (`Subscription.purchaseToken`, custom-provider contact, `AddressChangeEvent.fullName`). Blocks `database-schema-04`, `data-flow-map-01/03`.
- [ ] **Workspace-inclusive export/tax scope** — Decide intended scope for data export and tax-report builder under workspace mode (self-only vs workspace-inclusive). Blocks `dashboard-web-app-03`, `budget-expenses-04`, `address-change-relocation-01`.
- [ ] **Stable scheduler owner** — Confirm the single canonical cron scheduler per environment (DigitalOcean+GitHub Actions vs Vercel vs ofelia). Relates to `repo-overview-01` (refuted as env-partitioned) — keep the partition documented and enforced.

### Open architectural questions

- [ ] Is application-only tenant isolation (`database-schema-02`, `authorization-workspaces-05`) acceptable, or should a Prisma `$extends`/RLS backstop + `workspaceId` NOT NULL land (Phase 5.7)? (uncertain verdict — accepted pattern under watch.)
- [ ] Confirm the `?workspace=` admin override referenced by a stale comment (`authorization-workspaces-07`) does not exist as an un-gated bypass handler.
- [ ] Confirm `reconcilePendingPurchases` is invoked on mobile app start with a session (`mobile-iap-billing-10`).
- [ ] Confirm the mobile OAuth server exchange strictly REQUIRES `code_verifier` (PKCE) and rejects verifier-less exchanges (`mobile-app-03`).
- [ ] Confirm seed source-of-truth (`seed-master.ts` + `seed-data/`) and retire divergent StateRule/provider seeders (`services-catalog-02`, `dead-04`).

---

## Completed Audit Items

All audit phases below are complete (reports written). This TODO is the read-only synthesis; no source files were modified.

### Survey / map phases
- [x] repo-overview — `01_REPO_OVERVIEW.md`
- [x] module-map — `02_MODULE_MAP.md`
- [x] route-map — `03_ROUTE_MAP.md`
- [x] api-map — `04_API_MAP.md`
- [x] data-flow-map — `05_DATA_FLOW_MAP.md`
- [x] component-system — `06_COMPONENT_SYSTEM.md`
- [x] security-surface — `07_SECURITY_SURFACE.md`
- [x] ui-ux-baseline — `08_UI_UX_BASELINE.md`

### Module deep-dives
- [x] App Bootstrap / Config / Env — `modules/app-bootstrap-config.md`
- [x] Authentication & Session — `modules/auth-session.md`
- [x] Authorization & Workspaces (multi-tenant + RBAC) — `modules/authorization-workspaces.md`
- [x] Payments & Billing (Stripe / Web) — `modules/payments-billing-web.md`
- [x] Mobile IAP Billing (Apple/Google) — `modules/mobile-iap-billing.md`
- [x] Security Platform (rate-limit, secrets, encryption, cron, kill-switches) — `modules/security-platform.md`
- [x] onboarding — `modules/onboarding.md`
- [x] Addresses & Address Validation — `modules/addresses-validation.md`
- [x] Providers & Connectors — `modules/providers-connectors.md`
- [x] Moving & Move Tasks — `modules/moving-tasks.md`
- [x] Budget & Expenses — `modules/budget-expenses.md`
- [x] services-catalog — `modules/services-catalog.md`
- [x] Notifications & Push — `modules/notifications-push.md`
- [x] Email Pipeline — `modules/email-pipeline.md`
- [x] External Data Integrations (gov/data APIs) — `modules/external-data-integrations.md`
- [x] marketing-seo-content — `modules/marketing-seo-content.md`
- [x] Partners, Affiliate & Movers Portal — `modules/partners-affiliate-movers.md`
- [x] Consumer Dashboard / Account (web app) — `modules/dashboard-web-app.md`
- [x] Admin Auth & Security — `modules/admin-auth-security.md`
- [x] Admin Management Surfaces — `modules/admin-management.md`
- [x] Database Schema & Data Layer — `modules/database-schema.md`
- [x] Component & Theme System — `modules/component-theme-system.md`
- [x] Analytics, Feature Flags & Runtime Config — `modules/analytics-flags-runtime.md`
- [x] Mobile App (Expo / React Native) — `modules/mobile-app.md`

### End-to-end flow audits
- [x] Signup / Login / Session flow (apps/web) — `flows/signup-login.md`
- [x] onboarding-flow — `flows/onboarding-flow.md`
- [x] Address Change / Relocation flow (web) — `flows/address-change-relocation.md`
- [x] Subscription Payment (Stripe / Web) — `flows/subscription-payment-web.md`
- [x] Mobile IAP Purchase flow — `flows/mobile-iap-purchase.md`
- [x] Workspace Invitation / Household — `flows/workspace-invitation-household.md`
- [x] Provider / Connector Dispatch — `flows/provider-connector-dispatch.md`
- [x] Admin Impersonation flow — `flows/admin-impersonation.md`
- [x] Notification / Email / Digest flow — `flows/notification-email-digest.md`
- [x] Account Deletion / Data Export (CCPA) — `flows/account-deletion-export.md`

### Static sweeps & synthesis
- [x] Dead Code & Tech Debt Static Sweep — `dead-code-tech-debt-sweep.md`
- [x] Global Findings synthesis — `10_GLOBAL_FINDINGS.md`
- [x] Fix Priority Roadmap — `11_FIX_PRIORITY_ROADMAP.md`
- [x] Verdict verification passes — `verify/`, `verify-*.md` (16 high-signal findings re-checked against source)
- [x] Severity-bucketed aggregates — `reports/{critical,high,medium,low,questions}.md`
- [x] Master TODO synthesis — `TODO_AUDIT.md` (this file)
