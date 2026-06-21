# API Inventory

Updated: 2026-06-21

Evidence basis: route file inventory and selected source inspection. This is a first-pass inventory, not a full per-handler proof.

## Route Counts

- Web API route files: 171.
- Admin API route files: 124.

## Web API Groups

### Public or Route-Authenticated

- Health/readiness: `/api/health`, `/api/ready`.
- Auth: `/api/auth/login`, `/api/auth/logout`, `/api/auth/register`, `/api/auth/me`, `/api/auth/verify-email`, password reset routes, OAuth provider/init/callback routes.
- Mobile auth: `/api/mobile/auth/login`, `/api/mobile/auth/exchange`, `/api/mobile/auth/apple/native`.
- Public content/catalog: `/api/help`, `/api/providers`, `/api/blog/*`, `/api/movers`, `/api/movers/apply`, mover portal request/logout/placement request.
- Webhooks: `/api/webhooks/stripe`, `/api/webhooks/appstore`, `/api/webhooks/playstore`, `/api/webhooks/resend`.
- Cron: `/api/cron/*`, protected in route handlers by `guardCronRequest`.
- Internal: `/api/internal/*`, protected in route handlers by kind-specific internal secrets.
- Tracking: `/api/tracking/session`, `/api/tracking/event`; public in middleware but route code requires consent and authenticated session.

### Authenticated User APIs

- Account/profile/security: `/api/profile`, `/api/account/delete`, `/api/account/restore`, `/api/auth/security`, MFA/password routes.
- Address/service/move domain: `/api/addresses`, `/api/services`, `/api/moving`, `/api/move-tasks`, `/api/budget`.
- Workspaces: `/api/workspaces`, members, invitations, transfer, rename, restore, delete, sync, managed-sync.
- Providers: saved, compare, popular, recommendations, feedback, revalidate.
- Partner connectors: `/api/connectors/*`, `/api/partner-consents/*`, `/api/connector-dispatch`.
- Exports: `/api/export`, `/api/export/pdf`; require auth, rate limit, and step-up.
- Billing: `/api/stripe/checkout`, `/api/stripe/portal`, subscription change/switch/actions.
- Mobile IAP: `/api/mobile/iap/products`, `/api/mobile/iap/verify`.
- Notifications, push registration, tickets, consent/legal/user preferences/locale.

## Admin API Groups

### Public or Route-Authenticated

- Auth/login/set-password/health: `/api/auth/login`, `/api/auth/set-password`, `/api/healthz`, `/api/health`.
- Cron/internal: `/api/cron/*`, `/api/internal/*`; route handlers verify shared secrets.

### Authenticated Admin APIs

- Admin auth/session/MFA/password/login-history.
- Users, subscriptions, billing, workspace transfer/rename/member/invitation management.
- Provider governance/catalog/logos/bulk/merge/coverage.
- Movers and mover applications/documents/FMCSA checks.
- Runtime config, feature flags, settings, security dashboard/key rotation.
- Backups: create, verify, import, retention, download, SQL dump.
- Blog posts/categories/tags/uploads/image/preview/publish.
- Logs/reports/analytics, notifications, state rules, acquisition campaigns, affiliate exports/conversions, sponsored placements, help center, tickets.

## API Controls Observed

- Middleware public allowlists are explicit.
- Most sensitive web user routes call `requireDbUserId`, `requireVerifiedUser`, `requireAppMutationUser`, `requireWorkspaceContext`, or connector/cron/internal guards.
- Admin routes generally use `requireAdmin`, `requirePermission`, and for destructive actions `requirePasswordConfirm`.
- Webhook routes rely on provider signatures/JWS/OIDC-style verification rather than user sessions.
- Export and account deletion routes require step-up and emit audit/security events.

## API Risks and Notes

- Runtime migrations on startup were removed from root runtime entrypoints in the staging audit branch; live platform run commands still need verification.
- Admin middleware route limiting now has an Upstash REST path when Redis env is configured; missing Redis remains a staging readiness risk.
- Legacy `/api/partner-consents/[id]/refresh` is absent; canonical refresh is `/api/cron/partner-consents/[id]/refresh`, and middleware keeps the legacy path sealed.
- SQL dump filenames are sanitized and encoded before `Content-Disposition`; real staging download still needs runtime proof.
- User-facing workspace operations now filter active membership through a non-deleted workspace; restore/delete are lifecycle exceptions that still need browser proof during soft-delete testing.
- Sensitive admin auth responses now use no-store headers for login success/MFA challenge, MFA setup/verify, and session list/revoke flows.
- Manual backup retention cleanup now requires password/MFA step-up for real deletes; backup-secret cron and dry-run paths remain available for automation and preview.
- Static literal route/API target inventory for web, admin, and mobile currently reports no page/API misses after fixing the mover application Terms link; this is not a substitute for rendered navigation QA.
- Static route guard inventory found no unexpected unguarded admin mutations. Web mutation candidates without session/admin guards are expected public flows and each has a feature gate, token proof, enumeration-safe response, or rate limiting: password reset request, help feedback, mover/partner applications, mover/partner portal magic-link request, and unsubscribe.
- Static GET guard inventory found only expected public read surfaces without session/admin guards: public campaign offers, build-info, invite-token preview, mobile IAP product IDs, and provider catalog details.

## Incomplete

- Full authorization proof for every route remains incomplete.
- Full request/response schema inventory remains incomplete.
