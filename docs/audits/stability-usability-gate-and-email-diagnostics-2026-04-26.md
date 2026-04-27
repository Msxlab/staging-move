# Stability: Usability Gates And Email Diagnostics

Date: 2026-04-26

Branch: `stability-usability-gate-and-email-diagnostics`

Mode: initial diagnostic written before code changes, then updated after fixes

## Live / Deploy Snapshot

- `move-main/main` currently contains the emergency auth state machine branch (`d401bec`, merge of `emergency-auth-state-machine-stabilization`).
- `https://locateflow.com/sw.js` returned `200` with `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`.
- Live `sw.js` contains `locateflow-v7-auth-stabilization-disabled` and `DISABLE_SERVICE_WORKER = true`.
- `https://locateflow.com/register-sw.js` returned `200` with `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`.
- Live web `/api/health` returned `504 Gateway Timeout` during the diagnostic check, so live platform health could not be proven from this workstation.
- Admin `/api/health` returned `401 Unauthorized`, which is expected without an admin session.
- No live database rows were queried from this workstation. Email row analysis below is based on schema and code paths, not secret-bearing production DB output.

## Current Auth State Machine

1. Logged out:
   - Middleware protects app routes and redirects protected pages to `/sign-in?redirect=...`.
   - Public auth pages (`/sign-in`, `/sign-up`, `/verify-email`) are public.
   - Sign-in and sign-up pages do not call `/api/auth/me`.
   - `useCurrentUser` calls `/api/auth/me?optional=1` only where enabled.

2. Email/password unverified:
   - Login API creates a session and returns `user.emailVerified = false`.
   - Current sign-in client still redirects to requested route first.
   - `(app)/layout.tsx` then redirects to `/verify-email?redirect=...`.
   - This is secure, but causes a double redirect/flicker.

3. Email/password verified but legal missing:
   - Shared post-auth resolver sends the user to `/onboarding?step=legal`.
   - Legal acceptance is expected in onboarding, not on sign-up.

4. Legal accepted but onboarding incomplete:
   - Shared post-auth resolver sends the user to `/onboarding`.
   - Onboarding progress is computed from profile, legal consent, address, service, moving plan, and onboarding events.

5. Complete user:
   - Shared post-auth resolver allows safe requested app path.
   - If requested path is `/onboarding`, complete users are sent to `/dashboard`.

6. Google/Apple verified user:
   - OAuth callback links or creates an account only for provider-verified email.
   - Provider-verified OAuth users do not need email verification.
   - Post-auth redirect uses the shared resolver.

7. Soft-deleted user:
   - Password login queries `deletedAt: null`; soft-deleted users cannot log in.
   - OAuth linking blocks soft-deleted matches.
   - Current `requireDbUserId` also queries `deletedAt: null`, but throws `UNAUTHORIZED`, not `ACCOUNT_DELETED`.

8. Restored user:
   - Admin restore clears `deletedAt`.
   - Existing sessions remain revoked.
   - User must sign in again; OAuth can work after explicit restore.

## Current Onboarding State Machine

1. Profile:
   - Profile API writes profile data after auth.
   - Profile creation is not subscription-gated.

2. Legal:
   - Legal consent is recorded in onboarding via user events.
   - The helper is idempotent and should not duplicate required consent records.

3. Address:
   - Onboarding posts to `/api/addresses`.
   - Current `canCreateAddress` can block if trial/subscription is considered inactive.

4. Services:
   - Onboarding listed providers post to `/api/services`.
   - If no providers are selected, onboarding can continue without services.
   - Current onboarding service save ignores non-OK service responses and can advance even when no service was created.

5. Moving:
   - Onboarding can create a moving plan through `/api/moving`.
   - Current moving plan creation is subscription-gated.

6. Dashboard:
   - Completed users route to dashboard.
   - Incomplete users are sent back to onboarding.

7. Skip services:
   - UI supports "Continue without listed providers".
   - The skip path is product-safe, but failed service POSTs need clearer feedback.

8. Continue without providers:
   - Allowed today when no providers are selected.
   - Should remain allowed during setup.

## Current Subscription / Trial Gate

| Action | Current Gate | Product-Safe Target |
|---|---|---|
| create profile | Auth only | Always allowed for signed-in onboarding user |
| accept legal | Auth only | Always allowed |
| verify email | Public token + rate limit | Always allowed |
| create address | `canCreateAddress` | Allow first setup addresses during onboarding/setup grace |
| add first services during onboarding | `canCreateService` | Allow limited initial services during onboarding/setup grace |
| add listed provider as service | `canCreateService` | Allow within setup/trial quota, block expired complete users clearly |
| add custom provider | `canCreateCustomProvider` | Allow limited setup custom providers; avoid orphan create when service attach will fail |
| create moving plan | `canCreateMovingPlan` | Allow first setup moving plan during active trial/setup grace |
| generate move tasks | `canGenerateMoveTasks` | Trial/paid gated after setup allowance |
| edit existing service | Auth + ownership | Should remain allowed, especially for user data maintenance |
| view dashboard | Auth/legal/onboarding gate | Allowed for complete signed-in user; protected from logged-out users |
| export data | Auth only | Always allowed even expired |
| delete account | Auth + rate limit | Always allowed even expired |
| support ticket | Auth + rate/open-ticket limit | Always allowed within abuse limits |
| forgot password | Public + rate limit + generic response | Always allowed |
| resend verification | Signed-in unverified password user + rate limit | Always allowed within rate limits |

## Why `/api/services` Returns 403

Exact current cause:

- `apps/web/src/app/api/services/route.ts` calls `canCreateService(userId)` before validating address/provider details.
- `canCreateService` calls `getUserPlan`.
- `getUserPlan` defaults missing subscription to plan `FREE_TRIAL` and status `TRIALING`, but marks the trial expired when `subscription?.trialEndsAt` is missing.
- Therefore a user with no subscription row, or a trial row with `trialEndsAt = null`, is treated as inactive and receives `Your free trial has expired. Please upgrade to continue.`

This is not caused by:

- role/auth after session creation
- CSRF
- provider validation
- address ownership validation
- duplicate service guard
- service route rate limit

Current verdict:

- Too strict during onboarding and setup.
- Correct only for a complete user whose trial has actually ended.
- UI also needs to stop repeated POSTs when the server already says the action is blocked.
- Fixed in this branch with setup grace and structured entitlement errors.

## Email Failures Diagnostic

Schema:

- `EmailTemplate` stores `slug`, `name`, `subject`, `body`, `category`, and active/default flags.
- `EmailLog` stores `templateId`, `dedupeKey`, `providerMessageId`, `to`, `subject`, `status`, `error`, `sentAt`, `openedAt`, `metadata`, and timestamps.

Current code path:

- `sendLoggedEmail` creates a PENDING row, calls `sendEmailWithResult`, then updates the row to SENT or FAILED.
- Safe provider errors are redacted in `sendEmailWithResult` and written to `EmailLog.error`.
- Failed dedupe rows can be reclaimed and resent; SENT/PENDING dedupe rows are skipped.
- The admin API returns recent logs, but currently includes raw `to` and does not include `error`, `metadata`, or a masked failure-detail view in the UI.
- Fixed in this branch: the admin API now returns masked recipients, safe error reason, template linkage, from address, config/provider error booleans, retry availability, and the UI exposes details in an expanded row.

Last failed rows:

- Live rows were not queried locally because no live DB credentials were available and no destructive production access was allowed.
- The admin Email Templates page cannot currently answer the required operator questions from the UI because failure reasons are not displayed.
- The safe fields that should be displayed per failed row are template slug/name, masked recipient, status, safe error, providerMessageId, templateId presence, from address, config error yes/no, dedupe conflict yes/no, Resend API error yes/no, and retry availability.

## Welcome Email Diagnostic

- Email/password users: welcome email is sent after successful email verification in `/api/auth/verify-email`.
- Google users: welcome email is sent after new Google account creation in the OAuth callback.
- Apple users: welcome email is sent after new Apple account creation in the OAuth callback.
- Welcome email uses template slug `welcome` and dedupe key `welcome:${user.id}`.
- A welcome send failure does not block login or onboarding.
- If the `welcome` template is missing/inactive, this branch records a failed `EmailLog` diagnostic row instead of failing invisibly.
- If Resend/config fails after a log row is created, `EmailLog.error` records the safe reason, but the admin UI currently hides it.
- The admin UI now shows the safe failure reason and does not expose tokens or raw recipient addresses.

## PWA / Service Worker

- Service worker is intentionally disabled.
- `sw.js` and `register-sw.js` have `no-store` headers locally and on live.
- Auth/protected pages are not supposed to be cached.
- `sw.js` now uses a one-time unregister guard in disabled fetch handling and claims clients during disabled activation before unregistering.
- `register-sw.js` now no-ops when there are no registrations and no LocateFlow caches.
- The PWA install prompt is disabled while the service worker is disabled.

## Claude EMG Validation

| ID | Status | Notes |
|---|---|---|
| EMG-001 | FIXED_IN_THIS_BRANCH | `(app)/layout.tsx` catches `AUTH_STATE_USER_UNAVAILABLE`, destroys stale session best-effort, and redirects to sign-in. |
| EMG-002 | FIXED_IN_THIS_BRANCH | `requireDbUserId({ distinguishDeleted: true })` makes deleted-account layout branches meaningful while API callers still receive `UNAUTHORIZED`. |
| EMG-003 | FIXED_IN_THIS_BRANCH | Removed conflicting `Permissions-Policy` from `next.config.js`; middleware remains the source of truth. |
| EMG-004 | FIXED_IN_THIS_BRANCH | `signOut` tracks in-flight requests, does not silently treat server failure as success, clears client state, and redirects to `logout-failed` on failure. |
| EMG-005 | FIXED_IN_THIS_BRANCH | Added `/notifications`, `/help`, `/documents`, and `/community` to safe redirect prefixes. |
| EMG-006 | FIXED_IN_THIS_BRANCH | Sign-in now sends unverified email/password users directly to `/verify-email?redirect=...`. |
| EMG-007 | FIXED_IN_THIS_BRANCH | Onboarding layout now uses `getPostAuthUserState` and `resolveOnboardingGateRedirect`. |
| EMG-008 | FIXED_IN_THIS_BRANCH | Disabled service worker fetch unregister is guarded to run once. |
| EMG-009 | FIXED_IN_THIS_BRANCH | Disabled service worker activation calls `clients.claim()` before unregister cleanup. |
| EMG-010 | FIXED_IN_THIS_BRANCH | `register-sw.js` no-ops when no service workers/caches exist. |
| EMG-013 | FIXED_IN_THIS_BRANCH | Optional `/api/auth/me` has a dedicated soft 200/min rate limit in middleware and route handler. |
| EMG-014 | DEFERRED | `getPostAuthUserState` query count is real, but memoization is lower risk to defer than to change during this gate/email stabilization. |

## Root Cause Summary

- The `/api/services` 403 is caused by inconsistent trial fallback semantics: one billing helper treats missing subscription as active trial, while `plan-limits` treats missing trial expiry as expired.
- Onboarding write actions are using the same hard subscription gate as post-onboarding growth actions.
- Email sending is logged, but admin diagnostics do not expose safe failure reasons.
- Welcome email can fail safely, but missing/inactive templates are not logged as EmailLog failures.
- Several emergency auth fixes stabilized loops but left duplicated or dead logic in app/onboarding gates.

## Too Strict

- Missing subscription rows block first address/service setup as expired.
- Initial onboarding service/provider setup is paywalled before activation.
- Soft-deleted sessions collapse to generic unauthorized instead of a clear safe account-unavailable state.

## Correctly Strict

- Deleted users cannot login or relink through OAuth.
- Email/password users must verify email before app/dashboard/onboarding access.
- Legal consent remains required before full product use.
- Protected routes still require a valid session.
- Password reset and signup avoid public account enumeration.

## Not Strict Enough / Not Targeted Enough

- Optional `/api/auth/me` lacks handler-level soft rate limiting.
- Sign-out failure is hidden from the user.
- Onboarding services can submit repeated POSTs after an entitlement block.
- Admin Email Templates hides safe failure details that operators need.

## Product-Safe Recommended Rules

- New accounts get an active setup/trial allowance by default.
- Onboarding users may create first profile, first addresses, limited initial services, custom providers, and first moving setup within abuse limits.
- Complete expired users may read/export/delete/contact support, but cannot add more paid/trial-gated artifacts without a structured upgrade response.
- Server responses for product gates should include stable codes such as `TRIAL_EXPIRED`, `SERVICE_LIMIT_REACHED`, `SETUP_SERVICE_LIMIT_REACHED`, or `SUBSCRIPTION_INACTIVE`.
- UI should preempt known blocks and never spam repeated POSTs after a gate failure.
- Email failures should be visible to admins with masked recipients and redacted provider/config reasons.

## Fixes Applied

- Added setup grace to plan limits:
  - missing subscription row now behaves as active default trial
  - incomplete users can create initial setup addresses/services/custom providers/moving plan within explicit quotas
  - complete expired users receive structured `TRIAL_EXPIRED` responses
  - setup quota blocks use structured `SETUP_*_LIMIT_REACHED` codes
- Updated `/api/services`, `/api/addresses`, `/api/custom-providers`, `/api/moving`, and `/api/move-tasks` to return structured gate errors.
- Stopped `/services/new` from repeatedly POSTing selected providers after a structured gate block.
- Made onboarding service save fail clearly when selected provider POSTs are blocked instead of silently advancing with zero services.
- Prevented custom provider creation when the user cannot also create the backing service record.
- Fixed `AUTH_STATE_USER_UNAVAILABLE` handling in app and onboarding layouts.
- Made deleted-account detection meaningful for layouts without turning every API caller into a 500 risk.
- Removed the `Permissions-Policy` conflict and kept middleware as the source of truth.
- Fixed sign-out failure handling and added `logout-failed` sign-in copy.
- Added missing safe redirect prefixes.
- Sent unverified password-login users directly to verify-email after login.
- Shared onboarding gate logic through `resolveOnboardingGateRedirect`.
- Added optional `/api/auth/me` rate limiting.
- Kept the service worker disabled but reduced unregister/cache-cleanup churn.
- Disabled the PWA install prompt while the service worker remains off.
- Added email diagnostics:
  - safe `fromAddress`, config/provider booleans, retry availability in `EmailLog` metadata
  - missing/inactive templates now create failed diagnostic rows
  - admin API masks recipients and returns safe failure details
  - admin Email Templates UI exposes an expanded failure detail row

## Fixes Deferred

- `getPostAuthUserState` per-request memoization (`EMG-014`) unless tests show a low-risk path.
- Full account status model (`ACTIVE`, `SUSPENDED`, `BANNED`, `SOFT_DELETED`, `PURGE_PENDING`) remains deferred to `account-status-policy`.
- Automatic retry queue for failed email sends remains deferred to avoid retry storms.

## Manual QA Checklist

- New email signup -> verify email -> legal -> onboarding.
- New Google signup -> legal -> onboarding.
- Onboarding address creation works for a new setup user.
- Onboarding listed service creation works within setup allowance.
- Onboarding custom provider creation does not create orphan provider records when service attach is blocked.
- Expired complete user sees a clear upgrade message when adding services.
- No repeated `/api/services` POST spam after a structured gate block.
- Email Templates shows safe failure detail for failed Welcome and Password Reset sends.
- Welcome email success/failure does not block onboarding.
- Forgot password shows generic public UI while admin logs show safe failure reason.
- Sign-out failure is not silently swallowed.
- `/sw.js` and `/register-sw.js` remain no-store and service worker remains disabled.
- PWA install prompt is hidden or warning is documented as harmless while SW is disabled.
