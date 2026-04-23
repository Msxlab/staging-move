# Surface Sync Audit

- Date: 2026-04-23
- Scope: `apps/web`, `apps/mobile`, `apps/admin`, `packages/db`, environment templates

## Executive Summary

The platform already shares one core backend and one MySQL schema across web, mobile, and admin. Core relocation flows are mostly synchronized across web and mobile, and admin has strong operational coverage.

The main gaps are in account/auth lifecycle and security observability:

1. Social sign-in exists in backend and web UI, but production OAuth credentials are not configured.
2. Mobile social sign-in is not a full native session flow yet.
3. Email change is not implemented.
4. "Add password after Google/Apple login" is only implicitly possible through the register endpoint, not through an explicit settings flow.
5. Mobile does not expose password change or MFA setup/disable.
6. Admin cannot see linked auth methods, user login sessions, consent history, or email-verification state in a support-friendly way.
7. The production database is a managed MySQL instance, but the current connection string allows invalid TLS certificates.

## Cross-Surface Matrix

| Capability | Web | Mobile | Admin | Backend / DB | Notes |
| --- | --- | --- | --- | --- | --- |
| Email/password sign-in | Yes | Yes | Separate admin auth | Yes | Shared user auth stack for web/mobile |
| Google sign-in UI | Yes | Yes | No | Yes | Disabled in current prod env because OAuth vars are empty |
| Apple sign-in UI | Yes | Yes | No | Yes | Disabled in current prod env because OAuth vars are empty |
| Social account linking by email match | Indirect | Indirect | No visibility | Yes | Implemented via `OAuthAccount[]` + `findOrLinkOAuthUser()` |
| Add password to OAuth-only account | No explicit UI | No explicit UI | No | Partially | Possible only through `POST /api/auth/register` when the same email exists without `passwordHash` |
| Change existing password | Yes | No | Yes (admin only) | Yes | User route exists only on web settings |
| MFA setup/disable | Yes | No | Yes | Yes | Mobile has no user MFA screens |
| Email verification | Yes | Web-first via email link | No visibility | Yes | Verify/reset endpoints exist; mobile has no in-app verify flow |
| Email change | No | No | No | No | Missing flow entirely |
| Profile / household info | Yes | Yes | Read/edit partial | Yes | Shared `/api/profile` |
| Addresses CRUD | Yes | Yes | Read through user detail | Yes | Shared endpoints |
| Services CRUD | Yes | Yes | Read through user detail | Yes | Shared endpoints |
| Moving plans | Yes | Yes | Read through user detail | Yes | Shared endpoints |
| Budget | Yes | Yes | Read in user detail | Yes | Shared endpoints |
| Providers browse/detail | Yes | Yes | Full management | Yes | Shared provider data |
| Notifications preferences | Yes | Yes | Admin sends/monitors | Yes | Shared preference storage |
| Push registration | No native push UI | Yes | Push devices visible per user | Yes | Shared `PushDevice` model |
| Support tickets / help center | Yes | Yes | Yes | Yes | Good cross-surface coverage |
| Subscription management | Yes | Yes | Yes | Yes | Web Stripe + mobile IAP paths present |
| Export data | Yes | Yes | GDPR tracking | Yes | Shared export endpoint |
| Delete account | Yes | Yes | Yes | Yes | Staged GDPR delete flow exists |
| IP rules / blocked traffic | No | No | Yes | Yes | Admin security surface exists |
| Rate-limit visibility | No | No | Partial | Partial | Admin page exists, but web blocked events are not broadly persisted |
| User auth method visibility | No | No | No | Yes | `OAuthAccount` stored but not surfaced |
| User login-session visibility | No | No | No | Yes | `UserLoginSession` exists but admin user page shows analytics sessions instead |

## System Exists But UI Does Not Surface It Well

- `OAuthAccount[]` on `User`
  - Stored in DB, but no user or admin screen shows which auth methods are linked.
- `UserLoginSession`
  - Real auth session table exists, but admin user detail relies on `UserSession` analytics instead of auth sessions.
- Email verification tokens / password reset tokens
  - Backend exists, but there is no admin troubleshooting view.
- `DataConsent`
  - Consent records exist in DB, but there is no admin-facing consent history panel.
- Ability to attach a password to an OAuth-only user
  - Backend allows it indirectly via the register route, but users are not guided through it.

## UI Exists But Backend Is Missing, Partial, Or Operationally Disabled

- Mobile Google/Apple sign-in
  - Buttons exist, but they currently hand off to the web OAuth flow and do not complete a native token handoff into SecureStore.
- Email change
  - Expected user capability, but there is no API or DB flow for pending email verification + swap.
- User password management on mobile
  - Missing screens even though backend already supports password change on web.
- User MFA management on mobile
  - Missing screens even though backend already supports MFA on web.
- Production social sign-in
  - Backend code exists, but `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `APPLE_OAUTH_CLIENT_ID`, `APPLE_OAUTH_TEAM_ID`, `APPLE_OAUTH_KEY_ID`, and `APPLE_OAUTH_PRIVATE_KEY` are empty in the current production env file.

## Security / Detection / Response Coverage

### Already Present

- Admin security dashboard
- IP allow/block rules
- Admin session visibility and revocation
- Admin login history
- Security alert persistence via `AdminAuditLog`
- GDPR delete/export request tracking
- Backup readiness checks
- Rate limiting in user auth routes

### Main Gaps

- User-facing auth anomalies are not promoted to admin as clearly as admin anomalies.
- Admin cannot inspect linked providers (`google`, `apple`, password) for a user.
- Admin cannot inspect user auth session inventory from `UserLoginSession`.
- Web blocked-rate-limit visibility is weaker than the admin UI suggests.
- Production DB TLS verification is not strict enough.

## Recommended Next Steps

1. Implement a first-class account security model for users:
   - linked login methods
   - set password
   - change password
   - change email
   - MFA state
2. Build a native mobile OAuth completion flow:
   - app deep link callback
   - exchange / handoff into bearer token
   - SecureStore persistence
3. Add admin visibility for:
   - linked auth methods
   - `UserLoginSession`
   - email verification state
   - consent history
4. Add a dedicated change-email flow:
   - `pendingEmail`
   - verification token
   - re-auth requirement
   - audit log entry
5. Expose "set password" in settings for OAuth-only users.
6. Tighten database transport:
   - replace permissive TLS settings with strict certificate validation
7. Ensure all web blocked-rate-limit events are persisted for admin review.

## Required Inputs To Fully Enable Google / Apple Sign-In

- Google:
  - `GOOGLE_OAUTH_CLIENT_ID`
  - `GOOGLE_OAUTH_CLIENT_SECRET`
  - authorized redirect URI for `/api/auth/oauth/google/callback`
- Apple:
  - `APPLE_OAUTH_CLIENT_ID`
  - `APPLE_OAUTH_TEAM_ID`
  - `APPLE_OAUTH_KEY_ID`
  - `APPLE_OAUTH_PRIVATE_KEY`
  - authorized redirect URI for `/api/auth/oauth/apple/callback`

## Changes Applied During This Audit

1. Mobile sign-out now attempts backend logout and push-token cleanup before clearing the local session.
2. User logout invalidation now works for bearer-token sessions, not only cookie sessions.
3. Security readiness now warns when database TLS is configured with invalid-certificate acceptance.
4. `.env.example` now includes the missing Google/Apple OAuth environment variables.
