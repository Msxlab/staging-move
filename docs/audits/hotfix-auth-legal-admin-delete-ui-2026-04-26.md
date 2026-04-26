# Hotfix Auth Legal Admin Delete UI

Branch: `hotfix-auth-legal-admin-delete-ui`

Latest main checked: `b0491b5eed421db14bf735b6e2b17df0b3622357`

## Branch / Deploy Consistency

- Main includes `auth-email-security-audit-fixes`, `admin-web-ux-security-fixes`, and `onboarding-provider-governance-audit-fixes`.
- Main does not include `ops-dr-redis-billing-audit-fixes` at the time this branch was cut.
- A stale DigitalOcean deploy could still explain live behavior after this branch merges; redeploy web and admin from merged main before QA.

## Issue 1: Admin User Delete Ineffective

Root cause: admin user delete routes only created or reused a `GDPRRequest` and wrote audit logs, but did not immediately set `User.deletedAt`, revoke active user sessions, or filter deleted users out of the default admin users list. The single-user route also wrote `DELETE_USER` audit logs before the deletion request/mutation path completed.

Files inspected:

- `apps/admin/src/app/api/users/route.ts`
- `apps/admin/src/app/api/users/[id]/route.ts`
- `apps/admin/src/app/(admin)/users/page.tsx`
- `apps/admin/src/app/(admin)/users/[id]/page.tsx`
- `packages/db/prisma/schema.prisma`

Fix applied:

- Default admin user list now filters `deletedAt: null`.
- Single and bulk delete now soft-delete `User.deletedAt` immediately.
- Active `UserLoginSession` and `UserSession` rows are revoked during the delete transaction.
- GDPR cleanup remains queued/reused for staged hard deletion.
- `DELETE_USER` / `BULK_DELETE_USER` audit logs are written inside the successful mutation transaction only.
- PROCESSING GDPR delete requests return a structured skipped reason.
- UI copy now says delete, not only queue, and bulk delete surfaces skipped reasons.

Tests added/updated:

- `apps/admin/src/app/api/users/route.test.ts`
- `apps/admin/src/app/api/users/[id]/route.test.ts`

## Issue 2: Google / Apple Button Contrast

Root cause: auth pages used low-emphasis disabled opacity and theme-dependent foreground/background combinations that made OAuth buttons appear washed out in light theme.

Files inspected:

- `apps/web/src/app/sign-in/page.tsx`
- `apps/web/src/app/sign-up/page.tsx`
- `apps/web/src/i18n/messages/en.json`
- `apps/web/src/i18n/messages/es.json`

Fix applied:

- Google uses card/input/foreground tokens with visible border, shadow, hover, and focus ring.
- Apple uses explicit high-contrast black/white pairing with dark-theme inverse.
- Disabled states keep `opacity-100`, readable muted colors, `aria-disabled`, and clear unavailable labels.

Tests added:

- `apps/web/src/app/auth-social-buttons.test.ts`

## Issue 3: Social Sign-In / Legal Flow

Root cause: OAuth callbacks passed `allowNewAccount: acceptedLegal`, so a new Google/Apple user who started from Sign In without the old sign-up legal cookie was redirected to `/sign-up?error=legal-acceptance-required`.

Files inspected:

- `apps/web/src/app/api/auth/oauth/google/callback/route.ts`
- `apps/web/src/app/api/auth/oauth/apple/callback/route.ts`
- `apps/web/src/lib/user-auth.ts`
- `apps/web/src/lib/oauth.ts`
- `apps/web/src/lib/legal-acceptance.ts`
- `apps/web/src/app/onboarding/page.tsx`
- `apps/web/src/app/api/profile/route.ts`

Fix applied:

- Verified Google/Apple OAuth users may create/link accounts from either Sign In or Sign Up.
- OAuth-created users keep `emailVerifiedAt` set from provider-verified email.
- New OAuth users now land at `/onboarding?step=legal`.
- Social users no longer need to visit `/sign-up` to satisfy legal acknowledgement.
- Legal consent remains required before onboarding can progress.
- Legal consent writes are idempotent for the current legal document versions.

Tests added/updated:

- `apps/web/src/lib/oauth.test.ts`
- `apps/web/src/lib/onboarding-progress.test.ts`
- `apps/web/src/lib/legal-acceptance.test.ts`
- `apps/web/src/app/api/profile/route.test.ts`

## Issue 4: Redirect Loop

Root cause: middleware redirected `/sign-in` and `/sign-up` to `/dashboard` based only on JWT signature validity. The protected app layout then performed DB-backed checks and could redirect the same stale/incomplete session back to `/sign-in`, causing a loop. The app layout also hardcoded the email verification gate redirect target to `/onboarding`.

Files inspected:

- `apps/web/src/middleware.ts`
- `apps/web/src/middleware.test.ts`
- `apps/web/src/app/(app)/layout.tsx`
- `apps/web/src/app/onboarding/layout.tsx`
- `apps/web/src/lib/email-verification-gate.ts`
- `apps/web/src/lib/safe-redirect.ts`

Fix applied:

- Middleware no longer redirects public auth pages based on edge-only JWT checks.
- Sign-in and sign-up pages perform a fresh `/api/auth/me` check before redirecting active users.
- Middleware forwards the current pathname to server layouts.
- Protected app layout now redirects unverified email/password users to `/verify-email?redirect=<current path>`.
- Missing legal consent redirects to `/onboarding?step=legal`.
- Unsafe redirect paths remain rejected.

Tests added/updated:

- `apps/web/src/middleware.test.ts`
- `apps/web/src/lib/email-verification-gate.test.ts`
- `apps/web/src/lib/safe-redirect.test.ts`

## Manual QA Checklist

- Logged-out `/dashboard` redirects to `/sign-in?redirect=/dashboard`.
- Logged-out `/sign-in` and `/sign-up` load normally.
- Email/password unverified user visiting `/dashboard` lands on `/verify-email?redirect=/dashboard`.
- Verified user with missing legal consent visiting `/dashboard` lands on `/onboarding?step=legal`.
- New Google user lands on onboarding legal step and is not asked for email verification.
- Existing Google/Apple user with complete onboarding lands on dashboard.
- Unknown/unsafe redirect params default safely.
- Admin single user delete removes the user from the default list.
- Admin bulk delete reports deleted and skipped counts.
- PROCESSING GDPR delete request shows a skipped reason.
- Failed password confirmation does not create a delete audit log.
- Google and Apple buttons are readable in light and dark themes.
- Logout still makes `/api/auth/me` return 401 and `/dashboard` redirect to sign-in.
