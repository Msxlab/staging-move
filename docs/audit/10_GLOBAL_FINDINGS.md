# 10 — Global Findings

> Synthesis of the verified, area-level audit findings for the LocateFlow monorepo
> (Next.js 16 web + admin, Expo/React-Native mobile, Prisma/MySQL, custom JWT auth via
> `jose`, Stripe web billing + Apple/Google IAP). Refuted findings are excluded;
> `adjustedSeverity` from verdicts is respected. Doc-only claims are not treated as proof.

---

## Executive Summary

The codebase is broadly well-engineered: signature-verified webhooks, reserve-before-act
webhook idempotency, server-authoritative entitlements, encrypted PII fields, a hardened
map proxy, and disciplined per-route auth guards are all present. The risk concentration is
**not** in any single broken control but in three structural patterns that recur across
modules:

1. **Defense distributed to every route.** Edge middleware authenticates by JWT signature
   only; DB revocation, workspace isolation, opt-out enforcement, and step-up all live in
   individual handlers (`security-surface-05`, `module-map-04`, `authorization-workspaces-05`,
   `database-schema-02`). Any one forgotten guard is a hole, and several have already slipped
   (migration route, budget page, scheduled-delivery fan-out).

2. **Identity not bound to value.** Mobile IAP receipts and Stripe completion are claimed by
   the first submitter / trusted metadata rather than a cryptographic buyer↔account binding
   (`mobile-iap-billing-01`, `mobile-iap-purchase-01`). These are the highest-severity items.

3. **Compliance gaps that are live, not theoretical.** CCPA "Do-Not-Sell" is recorded but
   never enforced; GDPR erasure leaves plaintext `EmailLog`/`Lead` PII; legal-entity name and
   app-store rating are placeholders/fabricated (`account-deletion-export-04`,
   `account-deletion-export-01`, `database-schema-03`, `marketing-seo-content-01`).

Cross-cutting tech-debt: three parallel UI systems with no shared package and four hand-synced
token copies (`component-system-01/02`, `module-map-01`), dark-mode contrast failures in the
default theme (`component-theme-system-01/02`), and pervasive "fetch errors render as empty
success" UI patterns.

---

## Critical Risks

There are **no surviving Critical-severity findings** after verdict adjustment. The items with
the greatest blast radius (treated as top priority below) are High-severity security/compliance
defects:

- **`mobile-iap-billing-01` / `mobile-iap-purchase-01` (High, Security):** IAP purchases are not
  bound to the initiating account. `appAccountToken` (Apple) and `obfuscatedExternalAccountId`
  (Google) are typed but never set or verified; entitlement goes to the first account to submit a
  receipt to `/verify`. Enables entitlement theft / buyer lockout.
- **`account-deletion-export-04` (High, Security):** CCPA Do-Not-Sell opt-out is persisted but
  `hasCcpaOptOut()` is called by zero data-sharing paths (affiliate/sponsored/lead-dispatch) —
  the privacy control is inert. CPRA exposure.
- **`account-deletion-export-01` / `database-schema-03` (High, Data):** Self-service GDPR erasure
  does not purge `EmailLog.to` (plaintext email) or `Lead.payloadEncrypted` PII, while the admin
  hard-delete path does. Incomplete Art. 17 erasure.

---

## High Priority Issues

| ID | Title | Category |
|----|-------|----------|
| `mobile-iap-billing-01` / `mobile-iap-purchase-01` | IAP receipt not bound to initiating account | Security |
| `account-deletion-export-04` | CCPA Do-Not-Sell never enforced | Security |
| `account-deletion-export-01` | Erasure skips EmailLog (plaintext email survives) | Data |
| `database-schema-03` | Erasure skips Lead PII (encrypted name/contact survives) | Security |
| `admin-impersonation-02` | Per-mutation impersonation audit never invoked (no attribution) | Logic |
| `admin-auth-security-02` | Default `compat` proxy mode trusts client IP headers | Security |
| `route-map-01` | `/partners/apply` & `/partners/portal` unreachable logged-out (dead acquisition surface) | Logic |
| `external-data-integrations-01` | EV-charging integration targets wrong host (`developer.nlr.gov`) | Reliability |
| `marketing-seo-content-01` | Legal entity name / mailing address are placeholders on legal pages | Data |
| `component-theme-system-02` | Accent-on-white CTAs fail dark-mode contrast | Accessibility |

Notes on adjusted items (now Medium, were High): `admin-auth-security-01`/`admin-impersonation-01`
(impersonation endpoint trust / no UI caller), `component-system-01/02`,
`marketing-seo-content-04` (fabricated 4.9 rating), `dashboard-web-app-01`, `component-theme-system-01`,
`database-schema-02` (app-only tenant isolation — accepted pattern, kept under watch).
Refuted and excluded: `repo-overview-01`, `security-surface-01`, `security-surface-02`,
`security-platform-01`.

---

## Product Consistency Issues (logo / theme / UI / UX)

- **Brand:** Default Open Graph image shows an "M" glyph for "LocateFlow"
  (`marketing-seo-content-03`); two divergent wordmark lockups marketing vs app
  (`ui-ux-02`); fabricated "4.9 on the App Store" hero chip (`marketing-seo-content-04`).
- **Theme drift:** Design tokens hand-mirrored across 3–4 copies with no compile-time link
  (`module-map-01`, `component-system-02`, `ui-ux-08`, `component-theme-system-03`);
  `bg-orange-*` resolves to different hues per app/scheme (`component-system-03`); mobile
  NativeWind palette is fixed-dark and ignores light theme (`component-system-04`,
  `ui-ux-06`, `component-theme-system-10`); static `theme-color` meta stays dark in light mode
  (`ui-ux-05`, `component-theme-system-09`).
- **Component duplication:** No shared UI primitive package — Button/Input/Dialog/EmptyState
  forked 2–3× across web/admin/mobile (`component-system-01/05/06/07/08`, `module-map-03`,
  `component-theme-system-04`). Web `<Button>` exists but is bypassed in ~most call sites.
- **i18n leaks:** Marketing header, theme/dialog controls, mobile screens, and footer copyright
  hardcode English (`ui-ux-18`, `component-theme-system-07`, `mobile-app-09`,
  `marketing-seo-content-11`).
- **Error-as-empty UX:** Notification dropdown, dashboard, support, budget actuals, and address
  autocomplete render backend/network errors as benign empty states with no retry
  (`notifications-push-05`, `dashboard-web-app-04`, `budget-expenses-13`, `addresses-validation-03/06`).

---

## Architecture Issues

- **No shared UI / token / config layer.** Three component systems, four token copies,
  duplicated Tailwind configs, duplicated theme providers, duplicated email sanitizer, two
  rate-limiter implementations, duplicated `validators.ts` that has **drifted**
  (`component-system-01/02/08/09`, `dead-01`, `email-pipeline-09`, `security-surface-06`).
- **Recommendation engine implemented in 3–4 locations** with divergence risk (`module-map-02`).
- **Fail-open by omission at the middleware layer.** `/api/internal`, `/api/cron`, `/api/webhooks`
  are public-by-prefix; protection lives only in each handler with no CI/lint backstop
  (`security-surface-02` [adj. Low], `security-platform-04`). Tenant isolation is application-only
  with no Prisma/RLS backstop (`authorization-workspaces-05`, `database-schema-02`).
- **Onboarding completion derived from event rows** rather than a durable column, with scope
  mismatches between gate and `/api/profile` (`onboarding-flow-09/02`, `onboarding-03`).
- **Schema-compat fallbacks** silently degrade webhook/impersonation guards during migrations,
  logged only once via `console.warn` (`api-map-05`, `payments-billing-web-01`, `database-schema-09`).
- **Dead one-shot tooling** (SQLite→MySQL migrator + 653 KB JSON, `check-admin.mjs`, prototype
  dirs) and deep-relative shared-import wrappers (`dead-02/05/06/07`, `database-schema-11`).

---

## Security Issues

- **IAP / billing identity binding** (`mobile-iap-billing-01`, `mobile-iap-purchase-01`,
  `subscription-payment-web-01`, `payments-billing-web-S2`).
- **CCPA Do-Not-Sell inert; GDPR erasure incomplete** (`account-deletion-export-04/01`,
  `database-schema-03`).
- **Client-IP spoofing in default `compat` mode** poisons IP-keyed rate limits, IP bans,
  login lockout, fingerprint, and audit IPs (`admin-auth-security-02`, `security-surface-04`
  [adj. Low], `addresses-validation-01`).
- **Impersonation:** web endpoint trusts unverified `adminId`; minted session omits `fp` claim
  and has no action scoping; per-mutation audit never called (`admin-auth-security-01`,
  `admin-impersonation-02/04/05`).
- **Step-up gaps:** member promote-to-ADMIN, single-user admin EMAIL/PUSH, TOTP/backup brute-force,
  password-change rate limit (`authorization-workspaces-02`, `admin-management-01`,
  `auth-session-02/07`).
- **OAuth replay asymmetry:** Google callback has cookie-only state, no DB single-use record
  (`auth-session-01`, `signup-login-01`).
- **Unsubscribe token** never expires, attacker-mutable `kind`, falls back to `USER_JWT_SECRET`
  (`email-pipeline-01/02`, `notification-email-digest-02/03`).
- **Plaintext-at-rest:** legacy `Subscription.purchaseToken`, `UserCustomProvider` PII,
  `AddressChangeEvent.fullName`, mobile AsyncStorage PII snapshots (`database-schema-04`,
  `data-flow-map-01/03`, `mobile-app-01`).
- **Audit free-text not value-scrubbed** for PII (`security-surface-01` [adj. Low]).
- **Workspace invite token-accept lacks email-verification gate** (`workspace-invitation-household-01`).
- **Sponsored-click counter inflatable** by any authenticated user (`providers-connectors-01`,
  `api-map-03`).

---

## Reliability Issues

- **Non-transactional multi-step writes:** registration provisioning, profile save, actuals
  write, self-service erasure, move-task generation (`signup-login-03`, `dashboard-web-app-06`,
  `budget-expenses-17`, `account-deletion-export-09`, `address-change-relocation-02`,
  `moving-tasks-03`).
- **In-memory rate-limit / counter fallback** silently weakens enforcement without Redis on
  multi-instance deploys (`security-platform-02/03/06`, `security-surface-03`, `repo-overview-04`,
  `signup-login-04`).
- **Webhook fragility:** idempotency release best-effort; missing body-size/signature coverage
  unconfirmed for playstore/resend; no event-ordering guard on IAP webhooks; Resend bounce =
  permanent opt-out with no soft/hard distinction (`subscription-payment-web-02`,
  `security-surface-09`, `mobile-iap-billing-05`, `notification-email-digest-01`,
  `email-pipeline-03/08`).
- **Silent failures:** integration error ratios counted but never alerted; schema-compat
  fallbacks; seat reconcile `.catch(()=>{})`; fire-and-forget preference saves
  (`external-data-integrations-06`, `subscription-payment-web-06`, `dashboard-web-app-09`).
- **Cron unbounded scans:** broadcast fan-out, contract-reminders `take:1000` with no cursor
  (`data-flow-map-07`, `database-schema-10`).

---

## Performance Issues

- **N+1 / sequential I/O hot paths:** `GET /api/workspaces`, onboarding service POSTs,
  move-task sync, connector mode derivation (5 config reads/row), Stripe price-config fan-out,
  notification double-PATCH, provider duplicate full-category scan
  (`authorization-workspaces-08`, `onboarding-04`, `moving-tasks-10`,
  `provider-connector-dispatch-01`, `payments-billing-web-06`, `notifications-push-04`,
  `providers-connectors-05`).
- **Per-process caches** amplify upstream calls on multi-instance deploys
  (`external-data-integrations-05`, `admin-auth-security-09`).
- **Force-dynamic SEO pages** (51 state + metro) render per request for the CSP nonce
  (`marketing-seo-content-08`).
- **Heavy per-request work:** governance-issue upserts and 1000-provider serviceability
  enrichment on the recommendations / move-task path (`providers-connectors-04`,
  `moving-tasks-09`).

---

## Dead Code / Cleanup

- SQLite→MySQL migrator + `_migration-data.json` (653 KB) + legacy migrations; `check-admin.mjs`;
  root prototype dirs (`dead-02/05/07`, `database-schema-11`).
- Drifted/duplicated `validators.ts`, email sanitizer, theme provider, Tailwind configs
  (`dead-01`, `email-pipeline-09`, `component-system-08/09`).
- Unused exports/components: `initSentry`, `decodeJwtPayload`, `verifyAndLookupSignedTransaction`,
  `getAllFlags`, `recordUserSecurityAudit`, `TestimonialQuote`, legacy fonts, impersonation
  start endpoint with no UI caller (`app-bootstrap-config-07`, `auth-session-08`,
  `mobile-iap-billing-09`, `analytics-flags-runtime-09`, `dashboard-web-app-10`,
  `marketing-seo-content-10/09`, `ui-ux-10`, `admin-impersonation-01`).
- `recharts` declared but never imported in web/admin (`dead-03`).
- Stale comments/headers claiming non-existent constraints/state (`partners-affiliate-movers-07`,
  `authorization-workspaces-07/10`, `workspace-invitation-household-05`,
  `app-bootstrap-config-03/08`).

---

## Testing Gaps

The most security-critical modules have the thinnest coverage:

- **Authz / tenant isolation:** no IDOR matrix, `can()` role table, seat-concurrency, or
  sensitive-field redaction tests (`authorization-workspaces-09`, `services-catalog-08`).
- **Auth:** no Google OAuth callback or step-up brute-force tests (`auth-session-10`).
- **Billing:** no IAP binding / FAMILY_SHARED / reconcile-ordering regression tests;
  ranking-integrity and FTC-label invariants untested (`providers-connectors-06`).
- **Move-task lifecycle / classifier / completion side-effects / prune** untested
  (`moving-tasks-T1`).
- **USPS orchestrator, community-popularity privacy floor, feature-flags determinism, dark-mode
  contrast** untested (`addresses-validation-09`, `external-data-integrations-07`,
  `analytics-flags-runtime-11`, `component-theme-system-12`).
- **Mobile auth routing / AppLockGate / portal-auth revocation** untested (`mobile-app-08`,
  `partners-affiliate-movers-10`).

---

## Recommended Strategy

1. **Bind identity to value before launch.** Make IAP and Stripe completion verify
   buyer↔account, not first-claim/trusted-metadata. This is the single highest-leverage fix
   (`mobile-iap-billing-01`, `mobile-iap-purchase-01`, `subscription-payment-web-01`).
2. **Close the live compliance gaps.** Enforce CCPA opt-out in sharing paths; extend self-service
   erasure to EmailLog/Lead; populate legal-entity placeholders with a boot guard; remove the
   fabricated rating (`account-deletion-export-04/01`, `database-schema-03`,
   `marketing-seo-content-01/04`).
3. **Convert distributed defense into structural backstops.** Add a typed route wrapper that
   makes the DB session check + workspace scope non-optional, and CI/lint asserting cron/internal/
   webhook routes call their guard. This neutralizes a whole class of "forgotten guard" findings
   (`security-surface-02/05`, `authorization-workspaces-05`, `database-schema-02`).
4. **Pin the deployment edge.** Require explicit `TRUSTED_PROXY_HEADERS` and fail-closed in
   production; require Redis for limiters/lockout. This de-risks IP spoofing and silent limiter
   degradation at once (`admin-auth-security-02`, `security-platform-02/03`).
5. **Then invest in product consistency & tests.** Build a shared web/admin primitive + token
   package, fix dark-mode contrast, and add the authz/billing/auth regression suites that would
   have caught these findings.

See `11_FIX_PRIORITY_ROADMAP.md` for the sequenced, dependency-aware execution plan.
