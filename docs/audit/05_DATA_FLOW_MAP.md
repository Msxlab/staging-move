# Data Flow Map

This map captures verified source-level flows and flags unverified areas for later proof.

## User Authentication

1. User authenticates through web/mobile auth routes.
2. Auth helpers create or validate JWT cookies and DB-backed session rows.
3. Middleware performs coarse auth checks; route helpers perform stronger DB checks where used.

Evidence:

- Web session validation is referenced by middleware at `apps/web/src/middleware.ts:575` and applied at `apps/web/src/middleware.ts:819`.
- Admin session helper exists at `apps/admin/src/lib/auth.ts:316`.

Not verified in code in this pass:

- Every auth route's brute-force, enumeration, and device/session invalidation behavior.
- OAuth account-link conflict behavior across all providers.

## Workspace Request Flow

1. Request may provide workspace ID through `x-workspace-id` or `lf_workspace_id`.
2. `requireWorkspaceContext` resolves membership and workspace state.
3. Inactive/suspended membership fails closed.
4. Stale workspace selection can fall back to oldest valid workspace and self-heal the cookie.

Evidence:

- Workspace resolver and helper: `apps/web/src/lib/workspace-context.ts:121`, `apps/web/src/lib/workspace-context.ts:149`.
- Stale selection behavior: `apps/web/src/lib/workspace-context.ts:167-180`.
- Member status check: `apps/web/src/lib/workspace-context.ts:191`.
- Self-heal cookie behavior: `apps/web/src/lib/workspace-context.ts:207`.

Not verified in code in this pass:

- Every workspace-scoped route invokes this helper.
- UX copy for stale workspace fallback is clear to users.

## Tracking/Event Flow

1. User event request is authenticated and tied to a consented tracking session.
2. Event metadata is sanitized.
3. Metadata is serialized and stored in `UserEvent`.

Evidence:

- PII key pattern and sanitizer: `apps/web/src/app/api/tracking/event/route.ts:13`, `apps/web/src/app/api/tracking/event/route.ts:28-32`.
- Metadata persistence: `apps/web/src/app/api/tracking/event/route.ts:105`, `apps/web/src/app/api/tracking/event/route.ts:156`, `apps/web/src/app/api/tracking/event/route.ts:161`.
- Prisma `UserEvent` model: `packages/db/prisma/schema.prisma:1190`.

Finding:

- `PRIV-TRACK-001`: metadata sanitizer is not a strict event-schema allowlist for all event types.

## Billing/IAP Webhook Flow

Verified in sampled files:

- Apple App Store webhook route verifies signed payload and bundle constraints.
- Google Play webhook route verifies Pub/Sub OIDC/audience/package constraints.
- Processed webhook event model exists at `packages/db/prisma/schema.prisma:1693`.

Not verified in code in this pass:

- Complete entitlement transition matrix for purchase, renewal, expiration, refund, revocation, sandbox/test, duplicate, and out-of-order events.
- Consistency between mobile client entitlement UI and server subscription state.

## Connector/Address-Change Flow

Verified data models:

- `ConnectorConfig`: `packages/db/prisma/schema.prisma:2039`
- `ConnectorDispatch`: `packages/db/prisma/schema.prisma:2059`
- `AddressChangeEvent`: `packages/db/prisma/schema.prisma:2114`
- `ConnectorFallbackAction`: `packages/db/prisma/schema.prisma:2150`

Not verified in code in this pass:

- Provider-specific submission behavior.
- PII minimization and retention at connector boundaries.
- Retry, idempotency, fallback, and user-notification behavior.

## Admin Backup/Import Flow

Verified in sampled source:

- Admin backup routes use permission helpers and/or internal auth in sampled files.
- Backup-specific body limit exists in middleware at `apps/admin/src/middleware.ts:327`.

Not verified in code in this pass:

- Backup contents, encryption, retention, restore safety, audit-log completeness, and production separation.

## Deletion/Export/Privacy Flow

Verified models:

- `GDPRRequest` exists at `packages/db/prisma/schema.prisma:1702`.
- Consent-related models exist, including `DataConsent` and `PartnerConsent`.

Not verified in code in this pass:

- User-visible export/delete flows.
- Data deletion completeness across logs, analytics, backups, connector dispatches, and partner/lead records.
