# Hotfix: Auth Onboarding Service Worker And Deleted User Recovery

Date: 2026-04-26

Branch: `hotfix-auth-onboarding-sw-deleted-user-recovery`

## Deploy / Live State

- `move-main/main` contained `hotfix-auth-legal-admin-delete-ui`.
- `move-main/main` did not contain `hotfix-social-auth-signup-legal-regression`, so this branch cherry-picked that hotfix before applying the current fixes.
- DigitalOcean deployed SHA could not be proven locally because `doctl` and DigitalOcean API credentials were unavailable.
- Live origin check for `https://locateflow.com/sign-in?redirect=/onboarding` returned the sign-in page over the network, not a 503. The observed `503 Offline` is therefore suspected to be stale service-worker/browser-cache behavior.
- Live `https://locateflow.com/sw.js` still advertised `locateflow-v4` and did not make `/sign-in`, `/sign-up`, or `/verify-email` network-only.
- Live `https://locateflow.com/sign-up` still contained the old blocking legal acknowledgement copy, so live is stale or missing the prior social/legal hotfix.
- Live `/api/health` returned 504 during the check, so platform health was also suspicious.

## Root Causes

- Follow-up finding: email verification gates redirected unverified email/password users to `/verify-email?redirect=...`, but the app only implemented `/verify-email/[token]`. That made the intended gate URL return 404, and browsers with the stale service worker could surface it as `503 Offline`.
- Service worker: `sw.js` only bypassed cached/offline handling for authenticated app prefixes. Auth pages such as `/sign-in?redirect=/onboarding` could fall through to the offline fallback and surface `503 Offline` from a stale installed worker.
- Auth fetch loop: auth pages and global session tracking could both check `/api/auth/me`; prior hotfix introduced one-shot auth checks on sign-in/sign-up and disabled `SessionTracker` current-user polling on auth pages. Follow-up also treats `/verify-email` and `/verify-email/[token]` as auth pages so the tracker does not poll `/api/auth/me` there.
- Google OAuth account unavailable: the safe current behavior rejects OAuth links or email matches when the user row is soft-deleted. The observed `OAUTH_ACCOUNT_UNAVAILABLE` is consistent with a soft-deleted test/user account or an OAuth link attached to one. This branch keeps that block and adds an admin restore path instead of auto-reactivating via OAuth.
- Sign-up legal panel: live still had the old sign-up legal panel, but current branch includes the prior fix that removes sign-up legal acceptance and keeps legal consent in onboarding only.
- Deleted user recovery gap: admin could soft-delete and revoke sessions, but there was no clear restore/reactivation control for legitimate test/support recovery.

## Files Inspected

- `apps/web/public/sw.js`
- `apps/web/public/register-sw.js`
- `apps/web/src/hooks/use-current-user.ts`
- `apps/web/src/components/tracking/session-tracker.tsx`
- `apps/web/src/app/sign-in/page.tsx`
- `apps/web/src/app/sign-up/page.tsx`
- `apps/web/src/app/verify-email/page.tsx`
- `apps/web/src/app/verify-email/[token]/page.tsx`
- `apps/web/src/app/api/auth/me/route.ts`
- `apps/web/src/app/api/auth/resend-verification/route.ts`
- `apps/web/src/app/api/auth/oauth/google/route.ts`
- `apps/web/src/app/api/auth/oauth/google/callback/route.ts`
- `apps/web/src/app/api/auth/oauth/apple/route.ts`
- `apps/web/src/app/api/auth/oauth/apple/callback/route.ts`
- `apps/web/src/lib/oauth.ts`
- `apps/web/src/lib/user-auth.ts`
- `apps/web/src/lib/post-auth-redirect.ts`
- `apps/web/src/lib/legal-acceptance.ts`
- `apps/admin/src/app/api/users/route.ts`
- `apps/admin/src/app/api/users/[id]/route.ts`
- `apps/admin/src/app/(admin)/users/page.tsx`
- `apps/admin/src/app/(admin)/users/[id]/page.tsx`
- `packages/db/prisma/schema.prisma`

## Fixes Applied

- Bumped service-worker caches to `locateflow-v5` / `locateflow-static-v5`.
- Made `/api/*`, `/_next/*`, auth pages, and protected app navigations network-only in the service worker.
- Restricted offline fallback to safe public/static pages only.
- Deleted old LocateFlow caches on service-worker activate and clears/unregisters service workers on logout.
- Follow-up: bumped to `locateflow-v6`, disabled the service worker, made the worker unregister itself on activate, and made `register-sw.js` unregister/clear caches instead of registering a new worker. This is intentional until a safe authenticated offline shell exists.
- Added a real `/verify-email?redirect=...` pending-verification page.
- Added a rate-limited `/api/auth/resend-verification` endpoint for the signed-in unverified password user to request one verification email at a time.
- Disabled `SessionTracker` current-user polling on `/verify-email` and `/verify-email/[token]`.
- Added OAuth error mapping for account unavailable/deleted, unverified provider email, and provider-disabled cases with safe non-enumerating copy.
- Kept OAuth soft-deleted-user rejection in place; no OAuth auto-reactivation.
- Added admin user list account-state filter: active, deleted, all.
- Added deleted timestamp display and disabled bulk deletion for deleted rows.
- Added SUPER_ADMIN-only restore/unblock action with password confirmation.
- Restore sets `user.deletedAt = null`, leaves sessions revoked, writes `RESTORE_USER` audit log, and rejects restore if GDPR deletion cleanup is already processing.
- Restore marks pending admin/admin_bulk GDPR DELETE cleanup as `REJECTED` with restore metadata. Non-admin-originated pending delete requests are not canceled by this hotfix.
- Documented deferring explicit account status fields to a future `account-status-policy` branch:
  - `ACTIVE`
  - `SUSPENDED`
  - `BANNED`
  - `SOFT_DELETED`
  - `PURGE_PENDING`

## Tests Added / Updated

- Service worker cache policy:
  - auth/protected routes are network-only
  - `/api/auth/me` is not cached
  - old cache names are purged
  - logout cache clearing unregisters service workers
  - service worker registration is disabled and existing workers are unregistered
- Auth page regression:
  - sign-up has no blocking legal panel
  - sign-in/sign-up/verify-email auth checks are guarded from retry loops
  - `/verify-email?redirect=...` has a real page
  - OAuth error codes map to safe copy
- Resend verification:
  - logged-in unverified password user gets a single verification email on request
  - logged-out requests are rejected
  - verified/OAuth-only users do not receive unnecessary verification mail
- OAuth user linking:
  - new Google-style verified user creates OAuth account with `emailVerifiedAt`
  - existing active OAuth user logs in without duplication
  - existing active password user can be linked and marked verified
  - soft-deleted OAuth/email matches are rejected
- Admin users API:
  - active/deleted/all filters
  - restore soft-deleted user
  - restore requires password confirmation
  - restore writes audit log
  - restore does not reactivate sessions
  - processing GDPR delete requests block restore

## Auth / Legal State Machine

1. Logged out: `/dashboard` redirects to `/sign-in?redirect=/dashboard`.
2. Email/password newly registered, unverified: protected app and onboarding routes redirect to `/verify-email`.
3. Email/password verified, legal missing: redirect to `/onboarding?step=legal`.
4. Legal accepted, onboarding incomplete: redirect to `/onboarding`.
5. Google/Apple verified email, new user: create user/session and redirect to `/onboarding?step=legal`.
6. Google/Apple verified email, existing active user with missing legal: create session and redirect to `/onboarding?step=legal`.
7. Google/Apple verified email, existing complete user: create session and redirect to `/dashboard` or safe requested app path.
8. Soft-deleted user: password and OAuth login remain blocked until admin restore/unblock.
9. Unsafe redirect params fall back to `/dashboard`.

## Manual QA Checklist

- In a browser with the old service worker installed, load `https://locateflow.com/sign-in?redirect=/onboarding`; verify no `503 Offline` is served.
- Open devtools Application tab and confirm old `locateflow-v4` caches are removed after the new service worker activates.
- Confirm `/api/auth/me` on logged-out `/sign-in` returns at most one 401 and does not repeat in a render loop.
- Confirm logged-out `/sign-up` returns at most one `/api/auth/me` 401 and no loop.
- Confirm `/verify-email?redirect=%2Fdashboard` renders the pending verification page and does not return 404 or 503.
- Confirm `/verify-email` does not repeatedly call `/api/auth/me`.
- Confirm existing service workers are unregistered after any successful page load.
- Confirm an unverified signed-in email/password user can request a single resend from `/verify-email`.
- Confirm `/sign-up` has no `Required acknowledgements` blocking panel.
- Register with email/password; verify no legal consent is recorded until onboarding legal step.
- Verify email/password account cannot reach dashboard before email verification and legal consent.
- Start Google OAuth from `/sign-in`; for a verified new Google user, confirm redirect to `/onboarding?step=legal`.
- Start Google OAuth from `/sign-up`; confirm no bounce back to `/sign-up` and redirect to `/onboarding?step=legal`.
- Confirm existing complete Google user reaches `/dashboard`.
- Confirm a soft-deleted Google-linked user sees the safe account-unavailable message and is not auto-restored.
- In admin, filter Users by `Deleted`; verify soft-deleted users appear with `deletedAt`.
- Restore/unblock a soft-deleted test user as SUPER_ADMIN with password confirmation; verify audit log and `deletedAt = null`.
- After restore, verify old sessions remain invalid and the user must sign in again.
- Verify a restored OAuth user can sign in normally after admin restore.
- Verify logout clears LocateFlow caches and unregisters the service worker.
