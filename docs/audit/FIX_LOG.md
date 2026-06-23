# Fix Log — Sprint 1 (audit → remediation)

> Durable record of remediation work applied from the merged audit backlog
> (`TODO_MERGED.md`). All work is on branch **`fix/audit-sprint1`** (nothing pushed
> or merged; `main` untouched). Each item = one focused, tested commit. Dynamic
> verification: `pnpm install` done (Node 24 present; project pins 22 — engines
> warning only), per-change Vitest + per-app `tsc --noEmit` (web + admin = 0 errors).

**Sprint 1 goal:** low-risk, high-value security / compliance / flow / a11y quick wins.
**Status:** 6 items applied (7 commits). All touched test suites green; web & admin typecheck clean.

---

## Items applied

### 1. Partner self-service + unsubscribe pages made public — `route-map-01/02`
- **Commit:** `d3ff3bd0`
- **Why:** `/partners/apply`, `/partners/portal`, `/unsubscribe` were missing from web middleware `PUBLIC_PATHS`, so logged-out visitors were redirected to `/sign-in` — killing partner acquisition and breaking CAN-SPAM one-click unsubscribe. Each page owns its own gate (partner-portal session / HMAC token), mirroring the already-public `/movers/*`.
- **Files:** `apps/web/src/middleware.ts`, `apps/web/src/middleware.test.ts`
- **Tests:** added a middleware regression test (4 paths). Web middleware suite 37/37.

### 2. CCPA/CPRA Do-Not-Sell opt-out enforced — `account-deletion-export-04`
- **Commit:** `ce9f531a`
- **Why:** `hasCcpaOptOut` had zero business callers → recorded opt-out was inert. Now enforced on the genuine sell/share paths.
- **Decision (user):** *suppress pending* — a later opt-out suppresses still-QUEUED leads.
- **Changes:** `affiliate/click` skips the attributed-click write on opt-out (URL still returned); `lead-dispatch` cron suppresses QUEUED leads whose owner opted out (`FAILED`/`CCPA_OPT_OUT`, no partner email, no CPL charge, no retry) via new `hasCcpaOptOutForUser()` (cookie-less, DB-authoritative); `sponsored/click` (anonymous counter) + `affiliate/postback` (inbound) documented as intentionally exempt.
- **Files:** `lib/ccpa.ts`, `api/affiliate/click/route.ts`, `lib/leads/dispatch-leads.ts`, `api/sponsored/click/route.ts`, `api/affiliate/postback/[network]/route.ts` (+2 tests)
- **Tests:** opt-out (affiliate) + suppression (lead-dispatch) tests. 20/20.

### 3. EmailLog purged on self-service GDPR Art.17 erasure — `account-deletion-export-01`
- **Commit:** `8d995673`
- **Why:** `processAccountDeletionRequest` purged WaitlistSignup + NotificationQueue but **not** EmailLog, leaving the deleted user's plaintext recipient email behind — inconsistent with the admin hard-delete path. Mirrored that purge.
- **Files:** `lib/account-deletion.ts` (+ test). 10/10.
- **Follow-up flagged:** `Lead`/`LeadDispatch`/`AddressChangeEvent` no-FK PII is purged by **neither** path → address both via a shared purge helper (`database-schema-03`).

### 4. `/api/build-info` gated; `/api/ready` recon docstring corrected — `app-bootstrap-config-04/05`
- **Commit:** `db3b38a0`
- **Why:** build-info exposed commit SHA / branch / environment unauthenticated (recon aid) and is consumed by no client or deploy/monitoring config → removed from both apps' public allowlists (now session-gated). `/api/ready` already returns counts only (not key names); only the docstring claimed otherwise → corrected so a future change doesn't "restore" the leak.
- **Files:** `web /api/ready/route.ts`, `web + admin middleware.ts` (+ both middleware tests). Web 37/37, admin 16/16.

### 5a. Single-use replay guard on Google OAuth — `auth-session-01` / `signup-login-01`
- **Commit:** `699f45c8`
- **Why:** the Google callback validated cookie-only state with no DB-backed single-use record (Apple atomically consumes an `OAuthState` row), so a captured Google `state+code` was replayable. Mirrored Apple: initiate persists `OAuthState` (stateHash + PKCE-verifier nonceHash, 10-min TTL); callback atomically consumes it (`updateMany` count===1) **before** exchanging the code.
- **Files:** `api/auth/oauth/google/route.ts` + `callback/route.ts` (+ init test, new callback replay-reject test). 4/4.

### 5b. Verified-email gate + rate-limit on workspace invite accept — `workspace-invitation-household-01/02`
- **Commit:** `0bf3d016`
- **Why:** `POST /api/invitations/[token]/accept` used `getUserSession` (not the email-verification gate) and was unthrottled, so an account that signed up with — but never verified — the invited address could claim the seat, and a held link could be hammered. Added an `emailVerifiedAt` gate (after the email-match check) + a per-account rate limit.
- **Files:** `api/invitations/[token]/accept/route.ts` (+ test). Invitations suite 26/26.

### 6. Dark-mode contrast on EmptyState CTA + skip-link — `component-theme-system-02`
- **Commit:** `74a400bb`
- **Why:** EmptyState primary button + AppShell keyboard skip-link rendered white text on the light Gold accent in dark mode (~2.33:1, below WCAG AA). Aligned both to the canonical app-wide `Button` "default" pairing (`bg-primary` + `text-primary-foreground`), contrast-safe in both themes.
- **Files:** `components/shared/empty-state.tsx`, `components/layout/app-shell.tsx`. Web typecheck clean.
- **Deferred (`component-theme-system-01`, solid success/warning/info badges):** needs semantic `*-foreground` tokens that don't yet exist + a runtime contrast check given the token drift → handled in the **theme-renewal track** (`docs/ui-renewal/`).

---

## Sprint 2 — additional remediation (branch `fix/audit-sprint2`)

### S2.1 EV-charging upstream host corrected — `nlr.gov → NREL nrel.gov`
- **Commit:** `a143482a`. Replaced the wrong `developer.nlr.gov` host with `developer.nrel.gov` (the real NREL Alt-Fuel Stations API) in `lib/nlr-alt-fuel-stations.ts` (+test). Dead/incorrect upstream → working data source.

### S2.2 `TRUSTED_PROXY_HEADERS` required in prod (fail-closed) — `app-bootstrap-config`
- **Commit:** `8d5e8107`. `production-readiness.ts` now **fails** (was `warn`) when `TRUSTED_PROXY_HEADERS` is unset/compat/unknown in prod, so client-IP spoofing via forged proxy headers can't slip through a soft warning. Added `TRUSTED_PROXY_HEADERS="cloudflare"` to `.env.example` + `.env.production.example`.

### S2.3 Impersonated-mutation audit helper + initial wiring — `admin-impersonation-02`
- **Commit:** `f3b0d50d`. Added `auditImpersonatedMutation(request, {action, entityType, entityId, route?, details?})` (best-effort, no-op for normal sessions) and wired it into `account/delete` + `export`. Forensic `AdminAuditLog` attribution for actions taken while a SUPER_ADMIN impersonates a user.

### S2.4 Affiliate postback + leads hardening — `partners-affiliate-movers-01/04`, `api-map-02`
- **Commit:** `c17a6c94`. (a) postback no longer **cross-attributes** a conversion to a different provider — a resolvable `clickId` whose owner disagrees with an explicit `providerId` now 400s, and the click's owner is authoritative; (b) **IP-keyed rate limit** added BEFORE the HMAC/DB work so unsigned floods can't burn CPU/DB (fail-open — a Redis outage must not drop real network postbacks); (c) `/api/leads` limiter is now **`failClosed:true`** (no lead-cap bypass / PII fan-out / CPL over-charge under a Redis outage). +2 cross-attribution tests. 12/12.
- **Files:** `api/affiliate/postback/[network]/route.ts` (+test), `api/leads/route.ts`.

### S2.5 Impersonated-mutation audit rollout extended — `admin-impersonation-02`
- **Commit:** `b4b90328`. Continued the S2.3 rollout into the two core relocation-PII mutations: `addresses/[id]` PATCH+DELETE and `moving/[id]` PATCH+DELETE. Typecheck clean; impersonation+addresses+moving suites 104/104.

### S2.6 Impersonated-mutation audit — FULL rollout — `admin-impersonation-02`
- **Commits:** `202c3efa` (+ `fe65c58e` /api/ready fixture follow-up for S2.2). Completed the rollout across **all 51 user-scoped mutating routes** via a `classify → reconcile → wire → adversarial-verify` workflow (61 candidates analyzed). **10 routes deliberately SKIPPED** as non-user-data mutations: external Places/USPS proxies (`address-autocomplete`, `address-autocomplete/details`, `addresses/validate`), anonymous attribution counters (`affiliate/click`, `sponsored/click`, `movers`), system/cron connector dispatch (`connector-dispatch`, `workspaces/[id]/sync`), cache-only AI briefing (`onboarding/briefing`), pre-auth public (`waitlist`). 51/51 adversarially verified; web typecheck clean; **851 api route tests green**.
- **Side-finding fixed:** the S2.2 trusted-proxy fail-closed broke the `/api/ready` valid-config test (it now requires `TRUSTED_PROXY_HEADERS`); fixture updated (`fe65c58e`).

### S2.7 Impersonation BLOCK on account-control + billing — `admin-impersonation-02` (security)
- **Commit:** `4739bb26`. The classify pass surfaced **11 routes where logging is insufficient** — an impersonating SUPER_ADMIN could take over the account or change billing. Added `blockIfImpersonating(request, {action, route})` → returns **403 `IMPERSONATION_FORBIDDEN`** (and records the blocked attempt) when impersonated, `null` for the genuine user; wired AFTER auth / BEFORE any side effect into: `auth/password/change`, `auth/mfa/{setup,confirm,disable}`, `auth/security`, `auth/resend-verification`, `acquisition/redeem`, `mobile/iap/verify`, `subscription/{actions,change-plan,switch-cycle}`. **User-approved** (block both auth + billing). 11/11 adversarially verified (placement after-auth/before-mutation); helper unit-tested; 177 tests green.

### S2.8 Fail-open backstop for public-by-prefix routes — `security-surface-02` (roadmap 2.8)
- **Commit:** (this branch). `/api/{internal,cron,webhooks}/*` are public-by-omission in `middleware.ts`, so each route must self-authenticate. **Audited all 36** — none are fail-open today: cron (29) → `guardCronRequest`; internal (3) → `verifyInternalAuth` / `INTERNAL_WEBHOOK_SECRET` / `CRON_SECRET`; webhooks (4) → Apple JWS (`verifyAppleJws`), Stripe (`constructEvent`), Resend svix (`verifyResendSignature`), Google Play Pub/Sub OIDC (`verifyPubsubOidcToken`). Added a structural **regression test** (`apps/web/src/app/api/__tests__/public-prefix-auth.guard.test.ts`) that fails the build if a future route under these prefixes omits a recognized guard. 39/39 green.

### S2.9 Page-level guards on client-shell admin pages — `route-map-03` (roadmap 2.6)
- **Commit:** (this branch). Re-audit (with the full guard token set — the first pass missed `requirePermission`) found **blog pages already guarded** + **tickets pages are redirect-aliases**; the true residual was **17 `"use client"` admin pages** with no page-level guard. These leak NO server data (the admin layout already gates to an active admin, and the pages' data is fetched client-side via permission-enforced APIs) — the exposure was UI-shell fingerprinting only. Split each into a **server wrapper** (`await requirePagePermission(...)` / `requirePageAdmin()` matching the page's own admin API resource/action/role) + a `<name>-client.tsx` component, so the whole admin surface now fails closed before the bundle ships. Pages: analytics, help-center, moving, provider-governance, providers (+`[id]`, `[id]/edit`, coverage, needs-logo, new), reports, settings/health, settings/two-factor, state-rules, support, users, waitlist. 17/17 adversarially verified; **admin typecheck clean + admin production build green** (all 17 → dynamic server-rendered). Built via the `admin-page-guard-rollout` multi-agent workflow.

---

## Deferred / flagged follow-ups (not lost — tracked here)

| Item | Why deferred | Where it belongs |
|---|---|---|
| `database-schema-03` — purge Lead/LeadDispatch/AddressChangeEvent PII | Affects BOTH self-service + admin paths; needs a shared purge helper + an encrypted-Lead decision | Next remediation sprint |
| `component-theme-system-01` — solid badge contrast | Missing `*-foreground` tokens + token drift + needs runtime contrast verification | Theme renewal (`docs/ui-renewal/`) |
| Invite `decline` / `validate` / `pending accept` rate-limit + verify | Item 5b covered the primary accept path | Next remediation sprint |
| `/api/build-info` external monitor (if any) | No in-repo/deploy consumer found; gating is reversible | Confirm with ops if a monitor 401s |

## Verification method (per item)
1. `pnpm install` once (workspace deps + Prisma client generated).
2. Per change: `pnpm --filter @locateflow/web|admin test <file>` (Vitest).
3. After all: `tsc --noEmit` web + admin → 0 errors.
4. ⚠️ Not run (needs broader setup / a running app): full `pnpm verify:tests`, `pnpm build`, E2E, and **runtime visual contrast** checks.

_Last updated: 2026-06-22 (Sprint 2: S2.1–S2.9 on `fix/audit-sprint2` — impersonation hardening + public-prefix backstop + admin page-level guards)._
