# Hotfix: Social Auth Signup Legal Regression

Date: 2026-04-26
Branch: `hotfix-social-auth-signup-legal-regression`

## Deploy / Live Validation

- Local branch was created from fetched `move-main/main` at `695806aca6106b38c69b58c240140e986e9a4e9d`.
- `move-main/main` contains:
  - `auth-email-security-audit-fixes`
  - `admin-web-ux-security-fixes`
  - `onboarding-provider-governance-audit-fixes`
  - `hotfix-auth-legal-admin-delete-ui`
  - `ops-dr-redis-billing-audit-fixes`
  - hotfix commit `0091ae3d3e74845ebd4425e2f3deda5f7af111c3`
- Live DigitalOcean deployed SHA could not be verified from this machine: `doctl` is not installed and no `DIGITALOCEAN_ACCESS_TOKEN` / `DO_API_TOKEN` env var was available.
- Live suspicion:
  - `https://locateflow.com/sign-up` returned 200 and still included the old "Required acknowledgements" / "Accept these before creating your LocateFlow account" text.
  - `https://locateflow.com/api/health` returned 504.
  - Because the deployed SHA is unavailable, live deployment status is `unknown`, with a strong stale-or-unhealthy-deploy suspicion.

## Root Cause

- Sign-up legal panel: `/sign-up` still rendered `LegalConsentPanel`, disabled submit until legal was accepted, sent `legalConsents` to registration, and `/api/auth/register` required and recorded legal consent at account creation.
- OAuth account failure: OAuth callbacks still carried the old `oauth_legal_acceptance` cookie path and mapped multiple account-link/create failures into generic `oauth-account-failed`. Post-auth routing also did not explicitly resolve legal/profile completion state after session creation.
- `/api/auth/me` 401 loop: the root `SessionTracker` called `useCurrentUser()` on auth pages while `/sign-in` and `/sign-up` also performed their own `/api/auth/me` checks. The auth-page checks were not one-shot guarded, so rerenders could create repeated logged-out 401 probes.
- Legal/dashboard gate: onboarding completion was allowed to win before legal consent in `getOnboardingProgress`, which could let stale completion markers bypass the legal gate.

## Files Inspected

- `apps/web/src/app/sign-in/page.tsx`
- `apps/web/src/app/sign-up/page.tsx`
- `apps/web/src/app/onboarding/page.tsx`
- `apps/web/src/app/api/auth/register/route.ts`
- `apps/web/src/app/api/auth/oauth/google/route.ts`
- `apps/web/src/app/api/auth/oauth/google/callback/route.ts`
- `apps/web/src/app/api/auth/oauth/apple/route.ts`
- `apps/web/src/app/api/auth/oauth/apple/callback/route.ts`
- `apps/web/src/app/api/profile/route.ts`
- `apps/web/src/app/(app)/layout.tsx`
- `apps/web/src/app/onboarding/layout.tsx`
- `apps/web/src/components/tracking/session-tracker.tsx`
- `apps/web/src/hooks/use-current-user.ts`
- `apps/web/src/lib/user-auth.ts`
- `apps/web/src/lib/oauth.ts`
- `apps/web/src/lib/legal-acceptance.ts`
- `apps/web/src/lib/onboarding-progress.ts`
- `apps/web/public/sw.js`
- Admin user delete regression tests under `apps/admin/src/app/api/users`

## Fixes Applied

- Removed blocking legal acknowledgement UI and submit dependency from `/sign-up`.
- Changed email/password registration to create the unverified account and verification token without creating legal consent records.
- Added `POST /api/legal/acceptance` for the unified onboarding legal gate at `/onboarding?step=legal`.
- Moved onboarding legal acceptance out of profile save; `/api/profile` now requires existing legal consent before profile save.
- Added explicit post-auth redirect resolution:
  - email verification
  - legal gate
  - onboarding resume
  - dashboard/safe requested route
- Removed OAuth `acceptLegal` and legacy sign-up legal cookie dependency, while still clearing the old cookie on callbacks.
- Added debug-safe OAuth logging for account create failures, deleted-user blocks, unverified OAuth email, session creation failures, legal redirects, and onboarding redirects.
- Added known safe OAuth error mapping for unavailable/deleted accounts and account-create failures.
- Skipped global `SessionTracker` auth probes on auth pages and added one-shot guards to auth-page `/api/auth/me` checks.
- Made legal consent override stale onboarding completion markers.

## Tests Added / Updated

- Added `apps/web/src/app/api/legal/acceptance/route.test.ts`.
- Added `apps/web/src/app/auth-page-regression.test.ts`.
- Added `apps/web/src/lib/post-auth-redirect.test.ts`.
- Updated registration, profile, onboarding progress, OAuth linking, and onboarding profile payload tests.

## Manual QA Checklist

- Visit logged-out `/sign-up`; confirm no blocking legal acknowledgement card is visible.
- Create email/password account; confirm no legal consent row is created at registration.
- Verify email, sign in, and confirm `/dashboard` redirects to `/onboarding?step=legal`.
- Accept legal on `/onboarding?step=legal`; refresh the legal step and confirm only one current consent row exists.
- Confirm `/dashboard` remains blocked until legal is accepted.
- Start Google OAuth from `/sign-in` with a verified email; confirm new users land on `/onboarding?step=legal`.
- Start Google OAuth from `/sign-up` with a verified email; confirm no `/sign-up` legal bounce and landing is `/onboarding?step=legal`.
- Confirm existing complete Google users land on `/dashboard`.
- Confirm existing Google users missing legal land on `/onboarding?step=legal`.
- Confirm unverified provider email is rejected with a safe user-facing error.
- Confirm soft-deleted users cannot be re-linked.
- In browser dev tools on `/sign-in` and `/sign-up`, confirm logged-out `/api/auth/me` is at most one request per page load and 401 is handled normally.
- Confirm service worker does not cache `/api/auth/me`.
- Run admin delete regression tests before deploy.
- Redeploy DigitalOcean web and admin components from merged main, then smoke test active domains.
