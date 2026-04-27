# Emergency Auth State Machine Stabilization

Date: 2026-04-26

Branch: `emergency-auth-state-machine-stabilization`

## Deploy / Live State

- Branch started from latest `move-main/main` at `8a65d06`, which includes the merged deleted-user/SW hotfix PR.
- Latest `main` still had public auth pages calling normal `/api/auth/me`, so logged-out `/sign-in` and `/sign-up` could still show console-visible `401` noise.
- DigitalOcean deployed SHA was not verified locally. Treat live as stale until the deployed commit matches this branch.

## Decision Map

### `apps/web/src/middleware.ts`

- Redirects: yes, only unauthenticated non-public page routes to `/sign-in?redirect=...`.
- Fetches auth state: no DB fetch; edge JWT/cookie validation only.
- Calls `/api/auth/me`: no.
- Legal check: no.
- Email verification check: no.
- Deleted check: no DB-backed check; invalid/absent JWT is treated as logged out.
- Loop risk: low, because `/sign-in`, `/sign-up`, `/verify-email`, and public auth APIs are public.
- Final responsibility: keep coarse routing only.

### `apps/web/src/app/(app)/layout.tsx`

- Redirects: yes, for protected app routes.
- Fetches auth state: yes, DB-backed through `requireDbUserId()` plus shared post-auth state helper.
- Calls `/api/auth/me`: no.
- Legal check: yes, through `getPostAuthUserState()`.
- Email verification check: yes, through `resolvePostAuthRedirect()`.
- Deleted check: yes, `requireDbUserId()` rejects users whose row is missing or soft-deleted.
- Loop risk: reduced by using the shared resolver and only redirecting when target differs from current path.
- Final responsibility: protected app gate for `/dashboard`, `/settings`, `/addresses`, `/services`, `/moving`, `/budget`, `/providers`, `/support`, and related app routes.

### `apps/web/src/app/onboarding/layout.tsx`

- Redirects: yes.
- Fetches auth state: yes, DB-backed.
- Calls `/api/auth/me`: no.
- Legal check: no; legal missing must be allowed so `/onboarding?step=legal` can render.
- Email verification check: yes.
- Deleted check: yes, via `requireDbUserId()`.
- Loop risk: low; logged-out users go to sign-in and unverified password users go to verify-email.
- Final responsibility: allow only authenticated, email-eligible users into onboarding.

### `apps/web/src/app/sign-in/page.tsx`

- Redirects: after successful password login only.
- Fetches auth state: no.
- Calls `/api/auth/me`: no.
- Legal check: no.
- Email verification check: no.
- Deleted check: login API handles it.
- Loop risk: removed; no public-page auth polling remains.
- Final responsibility: collect credentials or start OAuth.

### `apps/web/src/app/sign-up/page.tsx`

- Redirects: no client auth-state redirect.
- Fetches auth state: no.
- Calls `/api/auth/me`: no.
- Legal check: no blocking panel; only non-blocking Terms/Disclaimer copy remains.
- Email verification check: no; registration sends verification email.
- Deleted check: register API rejects existing active or deleted email rows.
- Loop risk: removed.
- Final responsibility: email/password registration only.

### `apps/web/src/app/verify-email/page.tsx`

- Redirects: verified signed-in users to safe requested redirect.
- Fetches auth state: yes, server-side session plus DB lookup.
- Calls `/api/auth/me`: no.
- Legal check: no.
- Email verification check: yes.
- Deleted check: yes, DB lookup filters `deletedAt: null`.
- Loop risk: low; `SessionTracker` is disabled on this route.
- Final responsibility: pending verification page and resend entry point.

### `apps/web/src/components/tracking/session-tracker.tsx`

- Redirects: no.
- Fetches auth state: only when enabled.
- Calls `/api/auth/me`: indirectly through `useCurrentUser()`, now optional mode.
- Legal check: no.
- Email verification check: no.
- Deleted check: no direct DB check.
- Loop risk: reduced by disabling on `/sign-in`, `/sign-up`, `/verify-email`, `/verify-email/*`, `/onboarding`, `/onboarding/*`, `/reset-password*`, and `/forgot-password*`.
- Final responsibility: analytics/session telemetry only, never auth gating.

### `apps/web/src/hooks/use-current-user.ts`

- Redirects: only sign-out hard-redirects to `/`.
- Fetches auth state: yes, optional auth state.
- Calls `/api/auth/me`: yes, only `/api/auth/me?optional=1`.
- Legal check: no.
- Email verification check: no.
- Deleted check: server route clears stale/deleted sessions.
- Loop risk: low; one request per enabled mount/refresh, logged-out state is `200 user:null`.
- Final responsibility: hydrate UI identity only.

### `/api/auth/me`

- Redirects: no.
- Normal mode: logged out or stale/deleted session returns `401`.
- Optional mode: logged out or stale/deleted session returns `200 { authenticated:false, user:null }`.
- Fetches auth state: yes, session plus active user row.
- Legal check: no.
- Email verification check: returns `emailVerified` but does not gate.
- Deleted check: yes, filters `deletedAt: null` and best-effort clears stale cookies.
- Final responsibility: current-user API, not route gating.

### Google OAuth Callback

- Redirects: yes, based on verified provider email and shared post-auth state.
- Fetches auth state: provider token verification, OAuthAccount/User DB lookup, post-auth state helper.
- Calls `/api/auth/me`: no.
- Legal check: yes, through `resolvePostAuthRedirect()`.
- Email verification check: provider email must be verified; provider-verified users get `emailVerifiedAt`.
- Deleted check: yes, deleted OAuth link or email match is rejected.
- Loop risk: low; all failures clear OAuth cookies and return to sign-in with safe error codes.
- Final responsibility: provider verification, safe account link/create, session creation, post-auth redirect.

### Apple OAuth Callback

- Same responsibility split as Google, with Apple `form_post` and Apple email verification claim handling.

### Legal Acceptance Helpers

- Redirects: no.
- Fetches auth state: legal route requires DB user id.
- Calls `/api/auth/me`: no.
- Legal check/write: yes, idempotent current-version consent recording.
- Email verification check: app/onboarding gates decide route access.
- Deleted check: via `requireDbUserId()`.
- Final responsibility: record consent only from onboarding legal gate.

### Service Worker / `register-sw.js`

- Redirects: no.
- Fetches auth state: no.
- Calls `/api/auth/me`: no.
- Legal/email/deleted checks: no.
- Loop/offline risk: shut off for now.
- Final responsibility: unregister existing service workers and clear `locateflow-*` caches. No new SW registration until a safe offline shell exists.

## Final Single Source Of Truth

- Middleware is the coarse unauthenticated protected-route gate.
- `apps/web/src/lib/post-auth-redirect.ts` is the shared DB-backed state resolver for email verification, legal consent, onboarding completion, and safe post-auth redirect.
- `apps/web/src/app/(app)/layout.tsx` uses that resolver for protected app routes.
- OAuth callbacks use that resolver after creating/linking a verified provider account and creating a session.
- Auth pages do not decide global auth state.
- `SessionTracker` and `useCurrentUser` are UI hydration/telemetry helpers only.

## Root Cause Summary

- Public auth pages still called normal `/api/auth/me`; logged-out users received expected 401 responses, but the client surfaced them as repeated console errors and made QA look broken.
- `SessionTracker` was a second auth-state reader in the root layout and was not disabled for every auth/legal route.
- Protected app layout and OAuth callbacks had parallel copies of the same email/legal/onboarding redirect logic.
- The service worker had already been disabled, but `sw.js` and `register-sw.js` needed a harder no-store/self-unregister posture to remove stale browser behavior.
- OAuth unavailable errors were consistent with deleted OAuth/email matches; logs used safe reason codes, but diagnostics needed a clearer non-token, non-secret reason trail.

## Fixes Applied

- Removed `/api/auth/me` polling from `/sign-in` and `/sign-up` entirely.
- Switched `useCurrentUser()` to `/api/auth/me?optional=1`.
- Added optional mode to `/api/auth/me`; normal mode still returns `401` when logged out.
- Made `/api/auth/me` filter `deletedAt: null` and best-effort clear stale/deleted sessions.
- Disabled `SessionTracker` on sign-in, sign-up, verify-email, onboarding, reset-password, and forgot-password routes.
- Simplified protected app layout to use `getPostAuthUserState()` and `resolvePostAuthRedirect()` instead of duplicating legal/email/onboarding logic.
- Hardened SW shutoff with v7 disabled marker, activate/fetch self-unregister, cache clearing, and no-store headers for `/sw.js` and `/register-sw.js`.
- Added safe OAuth account-link diagnostics with reason codes and user-id hints only, never provider tokens.
- Kept soft-deleted users blocked until admin restore/unblock.
- Kept sign-up legal consent removed; consent remains in onboarding legal route only.

## Deleted User Policy

- `deletedAt` remains a deletion/recovery marker, not a ban/suspend system.
- Soft-deleted users cannot log in by password or OAuth.
- Admin restore/unblock remains SUPER_ADMIN-only, password-confirmed, audited as `RESTORE_USER`, and leaves sessions revoked.
- Explicit statuses remain deferred to `account-status-policy`: `ACTIVE`, `SUSPENDED`, `BANNED`, `SOFT_DELETED`, `PURGE_PENDING`.

## Final Auth / Legal State Machine

1. Logged out protected route -> `/sign-in?redirect=...`.
2. Email/password unverified -> `/verify-email?redirect=...`.
3. Provider-verified Google/Apple -> no email verification gate.
4. Legal missing -> `/onboarding?step=legal`.
5. Legal accepted and onboarding incomplete -> `/onboarding`.
6. Complete user -> requested safe app path or `/dashboard`.
7. Soft-deleted user -> session cleared/rejected; admin restore required.
8. Unsafe redirect -> `/dashboard`.

## Tests Added / Updated

- Auth page regression coverage asserts sign-in/sign-up do not call `/api/auth/me`.
- `/api/auth/me` tests cover normal 401, optional 200 logged-out state, and stale/deleted session clearing.
- Service worker tests cover v7 disabled worker, self-unregister, cache clearing, disabled registration, and no-store headers.
- OAuth linking tests cover deleted link rejection, restored active OAuth login, active password-user linking, new verified user creation, and safe diagnostics.
- Existing tests cover verify-email, registration without legal consent, onboarding legal consent, legal idempotency, and post-auth redirects.

## Tests Run

- `pnpm --filter @locateflow/web test -- src/app/api/auth/me/route.test.ts src/app/auth-page-regression.test.ts src/lib/service-worker-cache.test.ts src/lib/user-auth-oauth.test.ts src/lib/post-auth-redirect.test.ts src/app/api/auth/register/route.test.ts src/app/api/profile/route.test.ts src/app/api/legal/acceptance/route.test.ts src/app/api/auth/verify-email/route.test.ts src/lib/legal-acceptance.test.ts src/lib/email-verification-gate.test.ts`
- `pnpm --filter @locateflow/web exec tsc --noEmit`
- `pnpm verify:typecheck`
- `pnpm --filter @locateflow/admin exec tsc --noEmit`
- `pnpm --filter @locateflow/web test`
- `pnpm --filter @locateflow/admin test`
- `pnpm --filter @locateflow/web build`
- `$env:ADMIN_JWT_SECRET='test-admin-jwt-secret-32-characters-minimum'; pnpm --filter @locateflow/admin build`
- `git diff --check`

## Migrations

- No schema migration added.

## Manual QA Checklist

- Load `/sign-in` while logged out; confirm no `/api/auth/me` request from the page.
- Load `/sign-up` while logged out; confirm no `/api/auth/me` request from the page and no blocking legal panel.
- Visit `/dashboard` while logged out; confirm redirect to `/sign-in?redirect=%2Fdashboard`.
- Register with email/password; confirm verification email flow and `/verify-email?redirect=%2Fdashboard` page render.
- Verify the email; confirm next gate is `/onboarding?step=legal`.
- Accept legal; refresh legal step; confirm no duplicate consent record.
- Complete onboarding; confirm `/dashboard` renders.
- Start Google OAuth with a verified new account; confirm `/onboarding?step=legal`.
- Start Google OAuth for an existing complete active account; confirm `/dashboard`.
- Attempt Google OAuth for a soft-deleted account; confirm safe unavailable message and no auto-restore.
- Restore/unblock the soft-deleted user in admin; confirm old sessions remain revoked and OAuth/password login works afterward.
- Open `https://locateflow.com/sw.js`; confirm v7 disabled marker.
- Reload the app and confirm Application tab has no active `locateflow.com` service worker and no `locateflow-*` caches.
