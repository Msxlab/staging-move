# Ground Truth Remediation Manual QA Checklist

Date: 2026-04-27
Branch: full-ground-truth-remediation

Use a non-production environment with test-only secrets, test Stripe/IAP credentials, and disposable users.

## User Lifecycle

- [ ] Web signup creates a subscription row, records legal acceptance, saves profile, and reaches dashboard.
- [ ] Mobile email signup creates a subscription row, persists legal acceptance, saves profile, stores mobile session, and reaches dashboard.
- [ ] Web Google OAuth new-user signup creates a subscription row and preserves normal cookie session behavior.
- [ ] Mobile Google OAuth redirects through a deep link with a one-time code, exchanges it for mobile tokens, stores them in SecureStore, and reaches dashboard.
- [ ] Mobile Apple OAuth follows the same one-time-code exchange flow.
- [ ] A replayed or expired mobile OAuth code is rejected with a safe structured error.
- [ ] A soft-deleted user cannot sign in and receives support-oriented copy after authentication state is known.

## Account Security

- [ ] Account deletion with no password/MFA step-up is blocked before deletion request creation.
- [ ] Account deletion with the wrong password/MFA step-up is blocked.
- [ ] Account deletion with valid step-up creates the deletion request, processes cleanup, and writes audit events.
- [ ] Self-service account deletion UI copy matches the staged cleanup behavior.

## Admin Security

- [ ] Admin create requires current admin password confirmation.
- [ ] Admin role, permissions, active state, and password reset updates require current admin password confirmation.
- [ ] Admin subscription, premium, plan, and trial entitlement edits require current admin password confirmation.
- [ ] Backup archive download requires current admin password confirmation and writes a download audit event.
- [ ] Admin sensitive-action UIs use password modals, not browser prompts.

## Product Gates

- [ ] Custom-provider-only creation still works when service quota is full.
- [ ] Service creation still respects service quota.
- [ ] First moving plan can create one destination address under setup allowance.
- [ ] Later additional addresses still respect address quota.
- [ ] Trial expiry gates block expansion without blocking export, deletion, support, or security settings.

## Email, Cost, And PWA

- [ ] Required/default email templates cannot be hard-deleted.
- [ ] Password reset email failures show provider/config diagnostics in logs without exposing secrets or tokens.
- [ ] Places autocomplete returns a safe disabled response when `PLACES_AUTOCOMPLETE_ENABLED=false`.
- [ ] Places autocomplete blocks after per-user/day and per-IP/day caps.
- [ ] Service worker remains disabled and no PWA install banner is shown.
