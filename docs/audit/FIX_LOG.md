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

_Last updated: 2026-06-22._
