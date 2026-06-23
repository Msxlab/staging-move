# 11 — Fix Priority Roadmap

> Sequenced, dependency-aware remediation plan derived from `10_GLOBAL_FINDINGS.md`.
> Ordering priority: prod security → data loss/corruption → auth/permission → critical
> user-flow breaks → API validation/error handling → revenue (billing/subscription) → UI/UX →
> accessibility → performance → tests → dead code → refactor.
> Refuted findings excluded; `adjustedSeverity` respected.
> Each task is a checkbox with **Why / Files / Risk / Depends on / Validation**.

---

## Phase 1 — Critical Stabilization

Highest blast-radius security + compliance + data-loss items, plus the broken acquisition flow.

- [ ] **1.1 Bind IAP receipts to the purchasing account** (`mobile-iap-billing-01`, `mobile-iap-purchase-01`)
  - **Why:** Receipts are claimed first-come; no buyer↔account proof → entitlement theft / buyer lockout.
  - **Files:** `apps/mobile/src/lib/iap.ts` (set `appAccountToken`/`obfuscatedAccountId` at `requestPurchase`); `apps/web/src/app/api/mobile/iap/verify/route.ts`; `apps/web/src/lib/iap-common.ts`; `apps/web/src/lib/iap-apple.ts`, `iap-google.ts`; both store webhooks.
  - **Risk:** Med — must not break existing entitlements; gate verify-side enforcement behind a flag while clients roll out.
  - **Depends on:** none.
  - **Validation:** unit test — mismatched token/userId is rejected; existing-owner receipt still grants to owner; e2e purchase round-trip.

- [ ] **1.2 Enforce CCPA Do-Not-Sell in every sharing path** (`account-deletion-export-04`)
  - **Why:** Opt-out is recorded but `hasCcpaOptOut()` has zero callers → CPRA control is inert.
  - **Files:** `apps/web/src/lib/ccpa.ts`; `apps/web/src/app/api/affiliate/click/route.ts`, `sponsored/click/route.ts`, `affiliate/postback/[network]/route.ts`; `apps/web/src/app/api/cron/lead-dispatch/route.ts`; lead matching libs.
  - **Risk:** Low — additive guard; document any deliberately-exempt surface.
  - **Depends on:** none.
  - **Validation:** test — opted-out user skips affiliate/sponsored/lead share; opted-in unaffected.

- [ ] **1.3 Complete self-service GDPR erasure (EmailLog + Lead PII)** (`account-deletion-export-01`, `database-schema-03`)
  - **Why:** Erasure leaves plaintext `EmailLog.to` and encrypted `Lead` PII while admin hard-delete purges them → incomplete Art. 17.
  - **Files:** `apps/web/src/lib/account-deletion.ts:364-371` (mirror `apps/admin/src/lib/hard-delete-user.ts:309-316`); cross-check `AddressChangeEvent`, `LeadDispatch`.
  - **Risk:** Med — destructive deletes; reuse the admin path's tested queries.
  - **Depends on:** none.
  - **Validation:** schema test — every no-FK PII table is in the purge list; integration delete leaves no residue.

- [ ] **1.4 Fix the EV-charging integration host** (`external-data-integrations-01`)
  - **Why:** `developer.nlr.gov` almost certainly wrong (NREL is `developer.nrel.gov`); section silently never appears.
  - **Files:** `apps/web/src/lib/nlr-alt-fuel-stations.ts:9,61,70,79`; `nlr-alt-fuel-stations.test.ts:75`; `packages/shared/src/runtime-config.ts:651-678`.
  - **Risk:** Low.
  - **Depends on:** verify live NREL host first (`needsVerification`).
  - **Validation:** live call returns stations; host-pin test repointed.

- [ ] **1.5 Restore partner self-service routes** (`route-map-01`)
  - **Why:** `/partners/apply` & `/partners/portal` absent from `PUBLIC_PATHS` → entire partner acquisition surface dead when logged out.
  - **Files:** `apps/web/src/middleware.ts:26-59`.
  - **Risk:** Low — keep the in-page partner-session gate on `/partners/portal`.
  - **Depends on:** none.
  - **Validation:** logged-out GET of both routes renders (200), portal still gates actions.

- [ ] **1.6 Populate legal-entity placeholders + boot guard; remove fabricated rating** (`marketing-seo-content-01`, `marketing-seo-content-04` [adj. Med])
  - **Why:** Legal/contact pages show placeholder entity/address; homepage shows unsourced "4.9 on the App Store" → legal-completeness & FTC risk.
  - **Files:** `apps/web/src/lib/legal-info.ts`; `apps/web/src/app/contact/page.tsx`; `apps/web/src/app/page.tsx:249`; `.env.example`; `production-readiness.ts`.
  - **Risk:** Low.
  - **Depends on:** real legal values from business.
  - **Validation:** readiness check fails if placeholder persists; rating chip removed/sourced.

---

## Phase 2 — Security & Permissions

- [ ] **2.1 Pin trusted-proxy IP resolution; fail closed in prod** (`admin-auth-security-02`, `security-surface-04`)
  - **Why:** Default `compat` trusts client IP headers → spoofing poisons rate limits, IP bans, login lockout, fingerprint, audit IPs.
  - **Files:** `packages/shared/src/trusted-client-ip.ts`; `apps/web/src/lib/client-ip.ts`; `apps/web/src/lib/production-readiness.ts` (warn→fail); `.env.example`; admin middleware.
  - **Risk:** Med — wrong edge value breaks IP attribution; validate edge first.
  - **Depends on:** confirmed deployment edge (Cloudflare/Vercel/standard).
  - **Validation:** spoofed header ignored in prod-like; readiness fails when unset.

- [ ] **2.2 Invoke per-mutation impersonation audit; scope & bind the session** (`admin-impersonation-02/04/05`, `admin-auth-security-01`)
  - **Why:** Impersonated mutations are unattributed; session is full-privilege, no `fp` claim, replayable 15 min; web endpoint trusts unverified `adminId`.
  - **Files:** `apps/web/src/lib/impersonation-audit.ts`; mutating routes under `apps/web/src/app/api`; `apps/web/src/app/api/internal/impersonate/route.ts`; `impersonate-handoff/route.ts`; `apps/web/src/lib/user-auth.ts`.
  - **Risk:** Med — audit wrapper must not regress latency; validate `adminId` is active SUPER_ADMIN.
  - **Depends on:** decision on impersonation action allow/deny policy.
  - **Validation:** every impersonated write emits `AdminAuditLog`; spoofed `adminId` rejected; cookie bound to UA.

- [ ] **2.3 Require email-verification on token-accept; rate-limit invite routes** (`workspace-invitation-household-01/02`)
  - **Why:** Token-accept bypasses `requireVerifiedUser`; accept/decline/validate routes unthrottled.
  - **Files:** `apps/web/src/app/api/invitations/[token]/accept/route.ts`, `[token]/route.ts`, `pending/[id]/accept/route.ts`.
  - **Risk:** Low.
  - **Depends on:** none.
  - **Validation:** unverified token-accept rejected; rate-limit returns 429 on flood.

- [ ] **2.4 Add step-up to privileged actions** (`authorization-workspaces-02`, `admin-management-01`, `auth-session-02/07`)
  - **Why:** member promote-to-ADMIN, single-user admin EMAIL/PUSH, TOTP/backup brute-force, and password-change lack auth-grade gating.
  - **Files:** `apps/web/src/app/api/workspaces/[id]/members/[memberId]/route.ts`; `apps/web/src/lib/workspace-step-up.ts`; `apps/admin/src/app/api/notifications/route.ts`; `apps/web/src/lib/user-step-up.ts`; `apps/web/src/app/api/auth/password/change/route.ts`.
  - **Risk:** Low.
  - **Depends on:** none.
  - **Validation:** each action requires step-up; MFA brute-force locks via `mfa_verify`.

- [ ] **2.5 Add server-side single-use state to Google OAuth** (`auth-session-01`, `signup-login-01`)
  - **Why:** Google callback validates cookie-only state (Apple has atomic DB single-use).
  - **Files:** `apps/web/src/app/api/auth/oauth/google/route.ts`, `google/callback/route.ts`.
  - **Risk:** Low — mirror Apple's `OAuthState` consume.
  - **Depends on:** none.
  - **Validation:** replayed state rejected.

- [x] **2.6 Add page-level role guards to privileged admin pages** (`route-map-03`) — DONE `fix/audit-sprint2` (S2.9). Re-audit found blog pages already guarded (`requirePermission`) + tickets pages are redirect-aliases; the true residual was 17 **client-shell** pages (no server data leak — API-enforced — just shell fingerprinting). Split all 17 into guarded server wrappers + client components. Admin build green.
  - **Why:** Several privileged admin pages rely only on layout `requirePageAdmin()` + API 403 → VIEWER loads chrome / pre-API data.
  - **Files:** `apps/admin/src/app/(admin)/{users,waitlist,providers,reports,settings/health,...}/page.tsx`; `apps/admin/src/lib/page-guard.ts`.
  - **Risk:** Low.
  - **Depends on:** none.
  - **Validation:** under-privileged role gets fail-closed redirect before render.

- [ ] **2.7 Harden tokens & encrypt remaining plaintext PII** (`email-pipeline-01/02`, `database-schema-04`, `data-flow-map-01/03`, `mobile-app-01`)
  - **Why:** Unsubscribe token never expires + JWT-secret fallback; legacy `purchaseToken`, custom-provider PII, `AddressChangeEvent.fullName`, mobile AsyncStorage snapshots are plaintext.
  - **Files:** `apps/web/src/lib/unsubscribe.ts`; `apps/web/src/lib/iap-common.ts` + backfill job; `custom-providers/route.ts`; `apps/mobile/src/lib/offline-cache.ts`, `local-cleanup.ts`.
  - **Risk:** Med — token-format change invalidates outstanding links; phase carefully.
  - **Depends on:** dedicated `EMAIL_UNSUBSCRIBE_SECRET`, `FIELD_ENCRYPTION_KEY`.
  - **Validation:** expired token rejected; `purchaseToken` plaintext count → 0; no PII keys in plaintext storage.

- [x] **2.8 Add CI/lint backstop for public-by-prefix routes** (`security-surface-02`, `security-platform-04`) — DONE `fix/audit-sprint2` (S2.8). Audited all 36 routes: none fail-open today; added a structural regression test.
  - **Why:** `/api/internal|cron|webhooks` are fail-open by omission.
  - **Files:** `apps/web/src/middleware.ts`; test asserting each route file calls its guard.
  - **Risk:** Low.
  - **Depends on:** none.
  - **Validation:** test fails if a route under those prefixes omits the guard.

---

## Phase 3 — Core UX & Logic Fixes

- [ ] **3.1 Unify account-delete & data-export step-up across web** (`dashboard-web-app-01` [adj. Med], `dashboard-web-app-02/08`, `account-deletion-export-08`)
  - **Why:** Inline `/settings` delete and web export pages have no MFA input → MFA/OAuth-only users hit a dead end (and are blocked from GDPR export).
  - **Files:** `apps/web/src/app/(app)/settings/page.tsx`; `settings/export/page.tsx`; `components/settings/delete-account-dialog.tsx`; `api/export/route.ts`, `export/pdf/route.ts`.
  - **Risk:** Low — consolidate on `DeleteAccountDialog`.
  - **Depends on:** none.
  - **Validation:** MFA & OAuth-only users can delete and export.

- [ ] **3.2 Server-validate onboarding completion + unify scoping** (`onboarding-flow-01/02`, `onboarding-03`, `onboarding-02`)
  - **Why:** COMPLETED short-circuits before address check; gate vs `/api/profile` use different scoping; `isMilitary` dropped on web.
  - **Files:** `apps/web/src/lib/onboarding-progress.ts`; `api/onboarding/progress/route.ts`; `apps/web/src/lib/post-auth-redirect.ts`; `onboarding-client.tsx`; `onboarding-profile-payload.ts`.
  - **Risk:** Med — redirect-loop risk; share one scoping helper.
  - **Depends on:** none.
  - **Validation:** COMPLETED rejected without prerequisites; workspace member resumes correct step; military flag persists.

- [ ] **3.3 Fix workspace scope on migration/budget/export paths** (`address-change-relocation-01`, `moving-tasks-06`, `budget-expenses-01`, `dashboard-web-app-03`, `budget-expenses-04`)
  - **Why:** Several routes/pages scope by raw `userId`, ignoring workspace → members 404 on shared plans, deleted budgets resurface, exports incomplete.
  - **Files:** `api/moving/migration/route.ts`; `(app)/budget/[month]/page.tsx`; `api/export/route.ts`, `export/pdf/route.ts`; `lib/tax-report-data.ts`.
  - **Risk:** Med — must use `resolveWorkspaceDataScope`/`assertWorkspaceAction` consistently.
  - **Depends on:** confirm intended export scope.
  - **Validation:** member sees shared data; soft-deleted budget hidden.

- [ ] **3.4 Surface backend errors instead of empty-success** (`notifications-push-05`, `dashboard-web-app-04`, `budget-expenses-13`, `addresses-validation-03/06`)
  - **Why:** `res.ok` unchecked; errors render as "all caught up" / empty with no retry.
  - **Files:** `components/layout/notification-center.tsx`; `dashboard-client.tsx`; `(app)/budget/page.tsx`; `components/address/address-autocomplete-input.tsx`; support pages.
  - **Risk:** Low.
  - **Depends on:** none.
  - **Validation:** simulated 500 shows error/retry, not empty state.

- [ ] **3.5 Gate notification fan-out on opt-out/prefs** (`notifications-push-01`, `notification-email-digest-04`, `notifications-push-07`)
  - **Why:** Scheduled/broadcast worker sends EMAIL/PUSH ignoring opt-outs; web users can't mute push.
  - **Files:** `api/cron/scheduled-delivery/route.ts`; `apps/web/src/lib/notifications.ts`; `api/notifications/route.ts`; reuse `apps/admin/src/lib/notify-dispatch.ts`.
  - **Risk:** Med — must not suppress transactional types.
  - **Depends on:** none.
  - **Validation:** opted-out user gets only IN_APP; push toggle works from web.

- [ ] **3.6 Validate destination addresses + improve restore/manage UX** (`address-change-relocation-04`, `mobile-iap-billing-08`)
  - **Why:** Inline move destinations bypass USPS validation; mobile cross-platform manage is a dead-end and conflates restore states.
  - **Files:** `api/moving/route.ts`; `(app)/moving/new/page.tsx`; `apps/mobile/app/settings/subscription.tsx`.
  - **Risk:** Low.
  - **Depends on:** none.
  - **Validation:** destination runs USPS correction; restore distinguishes errored vs empty.

---

## Phase 4 — Revenue, Reliability & Performance

### Billing / Subscription (revenue)

- [ ] **4.1 Verify customer↔user binding & price integrity in webhooks** (`subscription-payment-web-01`, `payments-billing-web-02/03`)
  - **Why:** `checkout.session.completed` trusts metadata `userId`; entitlements fire without `payment_status`; price→plan by identity only (no amount/currency re-check).
  - **Files:** `api/webhooks/stripe/route.ts`; `lib/billing.ts`; `api/stripe/checkout/route.ts`.
  - **Risk:** Med.
  - **Depends on:** none.
  - **Validation:** mismatch alerts; unpaid checkout sends no activation email/redemption.

- [ ] **4.2 Reject FAMILY_SHARED / freshness-bound JWS / IAP ordering** (`mobile-iap-billing-02/04/05`, `mobile-iap-purchase-02/03`)
  - **Why:** `inAppOwnershipType` & JWS freshness unchecked; no IAP event-ordering guard → refund can be undone by stale refresh.
  - **Files:** `apps/web/src/lib/iap-common.ts`; `iap-apple.ts`; store webhook routes; `schema.prisma` (IAP event timestamp).
  - **Risk:** Med.
  - **Depends on:** 1.1.
  - **Validation:** FAMILY_SHARED rejected; stale JWS rejected; refund not re-activated.

- [ ] **4.3 Harden webhook idempotency release & seat reconcile observability** (`subscription-payment-web-02/06`, `payments-billing-web-01`)
  - **Why:** Best-effort release can permanently drop one-shot side effects; seat reconcile errors swallowed; schema-compat fallback warns only once.
  - **Files:** `api/webhooks/stripe/route.ts`; `lib/webhook-idempotency.ts`; `change-plan/route.ts`.
  - **Risk:** Low.
  - **Depends on:** none.
  - **Validation:** failed release/reconcile emits Sentry alert.

- [ ] **4.4 Unify production-like detectors & sandbox gating** (`mobile-iap-billing-03`, `app-bootstrap-config-06`)
  - **Why:** Divergent env predicates disable sandbox allowlist on staging/preview.
  - **Files:** `lib/billing-config.ts`; `iap-common.ts`; store webhook routes; `production-readiness.ts`; `env-catalog.ts`.
  - **Risk:** Low.
  - **Depends on:** none.
  - **Validation:** staging enforces sandbox allowlist.

### Reliability

- [ ] **4.5 Wrap multi-step writes in transactions** (`signup-login-03`, `dashboard-web-app-06`, `budget-expenses-17`, `account-deletion-export-09`, `moving-tasks-03`, `address-change-relocation-02`)
  - **Files:** `api/auth/register/route.ts`; `api/profile/route.ts`; `api/budget/actuals/route.ts`; `lib/account-deletion.ts`; `lib/move-task-generation.ts`.
  - **Risk:** Med.
  - **Depends on:** none.
  - **Validation:** mid-sequence failure leaves no partial state; concurrent generate yields one row set.

- [ ] **4.6 Require Redis / fail-closed for limiters & lockout in prod** (`security-platform-02/03`, `security-surface-03`, `signup-login-04`, `repo-overview-04`)
  - **Files:** `lib/rate-limit.ts`, `rate-limit-policy.ts`; `login-lockout.ts`; admin middleware; readiness checks.
  - **Risk:** Med — fail-closed could deny if Redis flaps; alert + scope to auth/abuse policies.
  - **Depends on:** Redis provisioned.
  - **Validation:** prod boot fails when limiter unconfigured; `limiterMode==='memory'` alerts.

- [ ] **4.7 Soft/hard bounce distinction + stale-PENDING reconcile + webhook coverage** (`notification-email-digest-01`, `email-pipeline-03/08`, `security-surface-09`)
  - **Files:** `api/webhooks/resend/route.ts`; `lib/email-service.ts`; playstore/resend webhook routes.
  - **Risk:** Low.
  - **Depends on:** none.
  - **Validation:** transient bounce doesn't permanently opt-out; PENDING reconciled; all webhooks verify signature + cap body.

- [ ] **4.8 Prune stale move tasks; entitlement-gate reminder cron; alert on integration breakage** (`moving-tasks-01` [adj. Med], `moving-tasks-04`, `external-data-integrations-06`)
  - **Files:** `lib/move-task-generation.ts`; `api/cron/task-reminders/route.ts`; `lib/integration-telemetry.ts`.
  - **Risk:** Med — prune must not touch COMPLETED/DISMISSED/user-edited.
  - **Depends on:** none.
  - **Validation:** removed service prunes open CLASSIFIER tasks; lapsed user stops reminders; error-ratio alert fires.

### Performance

- [ ] **4.9 Reduce hot-path query/IO amplification** (`provider-connector-dispatch-01`, `authorization-workspaces-08`, `onboarding-04`, `moving-tasks-09/10`, `payments-billing-web-06`, `notifications-push-04`)
  - **Files:** connector runtime, `api/workspaces/route.ts`, onboarding client, move-task generation, billing config, notifications page.
  - **Risk:** Low.
  - **Depends on:** none.
  - **Validation:** per-request query count drops; no behavior change.

- [ ] **4.10 Cache/queue heavy per-request work** (`providers-connectors-04`, `data-flow-map-07`, `database-schema-10`, `external-data-integrations-05`, `marketing-seo-content-08`)
  - **Files:** recommendations route, scheduled-delivery, contract-reminders, integration caches, SEO pages.
  - **Risk:** Low.
  - **Depends on:** none.
  - **Validation:** broadcast chunked; cron cursor-paginates; SEO pages CDN-cached.

---

## Phase 5 — UI/UX, Accessibility, Cleanup & Refactor

### Accessibility / Theme

- [ ] **5.1 Fix dark-mode contrast on badges & accent CTAs** (`component-theme-system-01` [adj. Med], `component-theme-system-02`, `ui-ux-07`)
  - **Files:** `components/ui/badge.tsx`; `shared/empty-state.tsx`; `layout/app-shell.tsx`; `globals.css`; `design-tokens.ts`.
  - **Risk:** Low. **Validation:** dark-mode contrast tests pass WCAG AA.

- [ ] **5.2 Accessibility primitives: Dialog scroll-lock/asChild/aria, progressbar, aria-current, form error wiring** (`component-theme-system-05`, `ui-ux-12/15/11/16`, `budget-expenses-11`, `component-theme-system-08`)
  - **Files:** `components/ui/dialog.tsx`, `input.tsx`, `textarea.tsx`, `card.tsx`, `status-badge.tsx`; `layout/mobile-nav.tsx`; budget page.
  - **Risk:** Low. **Validation:** a11y audit on key flows.

- [ ] **5.3 i18n the remaining hardcoded strings + theme-color/light-mode meta** (`ui-ux-18`, `component-theme-system-07`, `mobile-app-09`, `marketing-seo-content-11`, `ui-ux-05`, `component-theme-system-09`)
  - **Files:** marketing header/footer, theme/dialog controls, mobile screens, web/admin layout meta.
  - **Risk:** Low. **Validation:** es locale renders translated; light-mode chrome matches.

### Cleanup / Dead Code

- [ ] **5.4 Remove dead tooling, unused deps & exports** (`dead-02/03/05/07`, `database-schema-11`, `app-bootstrap-config-07`, `auth-session-08`, `mobile-iap-billing-09`, `analytics-flags-runtime-09`, `dashboard-web-app-10`, `marketing-seo-content-09/10`, `admin-impersonation-01`)
  - **Files:** prisma migrator/JSON/legacy dirs, `check-admin.mjs`, `recharts` in web/admin, prototype dirs, unused exports/components, legacy fonts.
  - **Risk:** Low — confirm no dynamic imports first.
  - **Validation:** build/test green after removal.

- [ ] **5.5 Fix stale comments/constraints & confusing config** (`partners-affiliate-movers-07`, `authorization-workspaces-07/10`, `workspace-invitation-household-05`, `app-bootstrap-config-03/08`, `database-schema-05`, `workspace-invitation-household-08`)
  - **Risk:** Low. **Validation:** comments match code; enum-like fields validated at boundary.

### Refactor (Architecture)

- [ ] **5.6 Extract shared web/admin primitive + token + config package** (`component-system-01/02/08/09`, `module-map-01/02/03`, `dead-01`, `email-pipeline-09`, `security-surface-06`)
  - **Why:** Eliminate 3-system / 4-token-copy drift; codegen CSS vars from `design-tokens.ts`; collapse drifted `validators.ts` and duplicated sanitizer.
  - **Files:** `packages/shared`, `apps/web/src/components/ui`, `apps/admin/src/components`, both `tailwind.config.ts`, `globals.css`.
  - **Risk:** Med — large surface; do incrementally (tokens → primitives → composites).
  - **Depends on:** Phase 1–4 stable.
  - **Validation:** token-parity test; visual regression; single source consumed by both apps.

- [ ] **5.7 Structural tenant-isolation backstop** (`database-schema-02`, `authorization-workspaces-05`, `database-schema-01`)
  - **Why:** Isolation is application-only; add Prisma `$extends`/lint requiring a scope token, promote `workspaceId` to NOT NULL after backfill, join-time soft-delete guard.
  - **Files:** `lib/workspace-data-scope.ts`; `packages/db/prisma/schema.prisma`; `packages/db/src/soft-delete.ts`.
  - **Risk:** Med. **Validation:** cross-tenant IDOR tests return 404/403; lint fails on unscoped scoped-model query.

---

## Phase 6 — Tests & Regression Safety

- [ ] **6.1 Authz / tenant-isolation suite** (`authorization-workspaces-09`, `services-catalog-08`, `database-schema-02`)
  - IDOR matrix, `can()` golden table, seat-concurrency, CHILD self-only, sensitive-field redaction.

- [ ] **6.2 Auth & impersonation suite** (`auth-session-10`, `admin-impersonation-*`)
  - Google callback (state/replay/verify/link), step-up brute-force, per-mutation impersonation audit.

- [ ] **6.3 Billing regression suite** (`subscription-payment-web-07`, `providers-connectors-06`, `payments-billing-web-S2`)
  - IAP binding/FAMILY_SHARED/ordering, price-integrity, ranking-integrity + FTC label, customer↔user binding.

- [ ] **6.4 Move-task & relocation lifecycle suite** (`moving-tasks-T1`, `address-change-relocation-*`)
  - Classifier branches, lifecycle transitions, completion side-effects, re-sync no-dup, prune-on-removal, workspace migration access.

- [ ] **6.5 Integrations, flags & email/notification suite** (`addresses-validation-09`, `external-data-integrations-02/07`, `analytics-flags-runtime-11`, `notification-email-digest-*`)
  - USPS orchestrator, SSRF negative tests, community-popularity privacy floor, feature-flag determinism/fail-closed, opt-out fan-out, bounce handling.

- [ ] **6.6 UI a11y & dark-mode contrast suite** (`component-theme-system-12`)
  - Dark-mode contrast, token-parity, Dialog/ConfirmDialog/StatusBadge a11y, mobile auth routing / AppLockGate, portal-auth revocation.

  - **Risk (all):** Low — additive; **Depends on:** the corresponding fix landing first so tests pin intended behavior.
  - **Validation:** each suite fails against the pre-fix code and passes after.
