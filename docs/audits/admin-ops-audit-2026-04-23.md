# Admin-First Product And Operations Audit

Date: 2026-04-23
Scope owner: Codex audit + implementation pass

## Scope

This pass intentionally went beyond the earlier auth-heavy review. The audit inspected the admin app as the primary operational surface, then checked cross-surface consistency in web, mobile, backend APIs, database schema, and env/runtime configuration.

No admin page was intentionally skipped. Two routes turned out to be aliases rather than standalone modules:

- `/tickets` redirects to `/support`
- `/tickets/[id]` redirects to `/support/[id]`

## Admin Pages Inspected

- `/`
- `/analytics`
- `/analytics/intelligence`
- `/backups`
- `/billing`
- `/email-templates`
- `/feature-flags`
- `/help-center`
- `/logs`
- `/logs/activity`
- `/moving`
- `/notifications`
- `/providers`
- `/providers/new`
- `/providers/[id]`
- `/providers/[id]/edit`
- `/reports`
- `/runtime-config`
- `/security`
- `/security/dashboard`
- `/settings`
- `/settings/health`
- `/settings/two-factor`
- `/state-rules`
- `/subscriptions`
- `/support`
- `/support/[id]`
- `/team`
- `/tickets`
- `/tickets/[id]`
- `/users`
- `/users/[id]`
- `/waitlist`

## Admin API Routes Inspected

- `/api/users`
- `/api/users/[id]`
- `/api/tickets`
- `/api/tickets/[id]`
- `/api/team`
- `/api/team/[id]`
- `/api/feature-flags`
- `/api/runtime-config`
- `/api/settings`
- `/api/security`
- `/api/security/dashboard`
- `/api/auth/sessions`
- `/api/auth/login-history`
- `/api/auth/me`
- `/api/subscriptions`
- `/api/billing`
- `/api/providers`
- `/api/providers/[id]`
- `/api/providers/bulk`
- `/api/state-rules`
- `/api/state-rules/[id]`
- `/api/moving`
- `/api/notifications`
- `/api/email-templates`
- `/api/help-center`
- `/api/waitlist`
- `/api/analytics`
- `/api/analytics/activity-intelligence`
- `/api/reports`
- `/api/logs`
- `/api/analytics/admin-activity`
- `/api/backup`
- `/api/backup/verify`

## Cross-Surface Files Inspected

- `apps/web` auth and account settings flows
- `apps/mobile` auth and privacy/account flows
- `packages/db/prisma/schema.prisma`
- `packages/shared/src/runtime-config.ts`
- `.env.example`
- `.env.production.example`

## Module Findings

### Dashboard (`/`)

Severity: Medium

- Current: overview cards plus quick links into major admin areas.
- Operational job: landing zone for triage and navigation.
- Weaknesses:
  - mostly a launcher, not a true control tower
  - little incident visibility for failed backups, stale mobile billing validation, unresolved support, risky admin activity, or runtime gaps
  - one quick action linked to the wrong location
- Fixed now:
  - corrected the quick action so "Add Provider" goes to `/providers/new`
- Still needed:
  - unresolved-queue cards
  - exception cards for stale subscriptions, pending GDPR deletes, and failed backups
  - cross-module "needs attention" rollup

### Analytics (`/analytics`)

Severity: Medium

- Current: read-only user/session/device/platform metrics with some recent-session drill-down.
- Operational job: product telemetry overview.
- Weaknesses:
  - useful as a read surface but not connected to support or lifecycle operations
  - no segmenting by acquisition source, subscription plan, auth method, or provider engagement
  - no export or saved reporting workflow
- Backend mismatch:
  - analytics exists, but product-facing actionability is low
- Remaining direction:
  - turn important cohorts into links to users, subscriptions, and moving plans

### Activity Intelligence (`/analytics/intelligence`)

Severity: Medium

- Current: onboarding funnel, engagement buckets, churn risk, top events, DAU.
- Operational job: identify user behavior risk and retention opportunities.
- Weaknesses:
  - no direct operator action from churn-risk users
  - no CRM-like follow-up queues or campaign hooks
  - no confidence notes for event coverage quality
- Remaining direction:
  - direct drill-down into at-risk users and trial-expiring cohorts

### Backups (`/backups`)

Severity: Medium

- Current: one of the stronger admin modules. Can create backups, inspect storage readiness, verify archives, and handle import/export flows.
- Operational job: resilience, disaster recovery, and break-glass export/import.
- Strengths:
  - integrity verification exists
  - storage readiness is surfaced
  - step-up auth already exists for backup creation
- Weaknesses:
  - restore/import is still a high-blast-radius flow without staging/promote workflow
  - no routine restore drill history or operator checklist
  - no explicit owner/SLA metadata on backup records
- Remaining direction:
  - scheduled backup policy UI
  - restore rehearsal logs
  - import dry-run diff summary before execution

### Billing (`/billing`)

Severity: Medium

- Current: stronger than subscriptions. Shows revenue, churn, plan/provider/platform distributions, mobile validation gaps, and stale store records.
- Operational job: finance and subscription-health oversight.
- Strengths:
  - exposes mobile billing operational gaps
  - surfaces stale validation and missing receipt identifiers
- Weaknesses:
  - still mostly observational
  - no operator actions for retry, reconcile, or link to affected subscriptions/users
  - no refund/dispute/refund-request tooling
- Remaining direction:
  - one-click drill-down to subscriptions and users
  - finance workflow surfaces for refund and reconciliation

### Email Templates (`/email-templates`)

Severity: Medium

- Current: CRUD for templates plus a recent send log.
- Operational job: maintain transactional and marketing content.
- Weaknesses:
  - no version history
  - no test-send workflow
  - no approval/review flow before publish
  - no variable validation or render preview with example payloads
- Fixed now:
  - added admin audit logging for create, update, and delete
- Remaining direction:
  - test-send, versioning, draft/review/publish states, and template health

### Feature Flags (`/feature-flags`)

Severity: Medium

- Current: CRUD and enable/disable with basic targeting shapes.
- Operational job: controlled rollouts and kill switches.
- Weaknesses:
  - no search/filter/audit view in UI
  - no environment scoping, ownership, expiry, or rollout notes
  - no blast-radius summary before changing a flag
- Fixed now:
  - added admin audit logging for create, update, and delete
- Remaining direction:
  - flag owner, sunset date, rollout note, impact preview, and emergency kill-switch grouping

### Help Center (`/help-center`)

Severity: Medium

- Current: CRUD for articles and FAQs with publish toggles and some article stats.
- Operational job: self-serve support content management.
- Weaknesses:
  - no review/publish workflow
  - no article version history
  - no broken-link or stale-content checks
  - no mapping from support-ticket categories to recommended articles
- Fixed now:
  - added admin audit logging for FAQ/article create, update, and delete
- Remaining direction:
  - draft/review/publish lifecycle and support deflection metrics

### Audit Logs (`/logs`)

Severity: Medium

- Current: useful admin/user audit search, filters, and CSV export.
- Operational job: operator accountability and forensic review.
- Strengths:
  - decent filter set
  - expandable change payloads
- Weaknesses:
  - no saved views
  - weak correlation across related entities
  - no timeline view per user/provider/subscription/ticket
- Improvement impact:
  - stronger now because more modules write admin audit logs after this pass

### Admin Activity Analytics (`/logs/activity`)

Severity: Medium

- Current: admin leaderboard, action types, critical actions, and daily activity.
- Operational job: monitor admin usage and risky behavior.
- Weaknesses:
  - no drill-down from critical actions into affected entities
  - no anomaly detection or change-review workflow

### Moving Plans (`/moving`)

Severity: Medium

- Current: list/filter view with status, route information, and user linkouts.
- Operational job: customer-success and relocation-progress monitoring.
- Weaknesses:
  - largely read-only
  - no milestone correction, assignment, exception flags, or notes
  - no operational surfaces for delayed moves, missing required services, or provider readiness
- Remaining direction:
  - queueing by move date/risk and support notes per plan

### Notifications (`/notifications`)

Severity: High

- Current before fixes:
  - could send notifications, but direct sends required raw user IDs
  - queue existed in the backend schema but UI ignored it
  - UI implied more maturity than the system actually had
- Operational job: outbound internal messaging, broadcast alerts, lifecycle nudges.
- Weaknesses:
  - no user picker
  - no honest scheduling UX
  - no queue visibility
  - no audit logs on send
- Backend mismatch:
  - `NotificationQueue` exists, but no real delayed-delivery worker was found in this pass
- Fixed now:
  - added direct-user search instead of raw ID entry
  - surfaced queue records
  - added explicit messaging that scheduled delivery is not live yet
  - added admin audit logs for direct and broadcast sends
  - backend now rejects future scheduling instead of pretending it works
- Remaining direction:
  - real job worker, retries, failure states, recipient cohorts, and campaign history

### Providers List (`/providers`)

Severity: High

- Current: rich browse surface with filters, bulk actions, import/export, multiple display modes.
- Operational job: maintain provider catalog and coverage data.
- Strengths:
  - import/export exists
  - bulk actions exist
  - category organization is decent
- Weaknesses:
  - destructive actions were inconsistent with backend step-up auth
  - no review workflow for new providers or edits
  - no duplicate resolution console
  - limited visibility into downstream user impact
- Fixed now:
  - list delete now prompts for admin password and works with the secured API
  - bulk delete now requires password confirmation
  - bulk mutations now revalidate provider cache
- Remaining direction:
  - provider approval states, duplicate merge tools, and impact summaries

### New Provider (`/providers/new`)

Severity: Medium

- Current: better than a basic form; includes duplicate-slug checking and stepped entry.
- Operational job: create new catalog entries.
- Weaknesses:
  - no reviewer/owner metadata
  - no draft mode
  - no "coverage preview" before save
  - no provenance/source tracking for why a provider exists

### Provider Detail (`/providers/[id]`)

Severity: High

- Current before fixes: useful details, but missing activity/timeline context and the delete flow was not aligned with API security.
- Operational job: inspect, edit, and safely remove providers.
- Fixed now:
  - added coverage count visibility
  - added recent admin activity log for the provider
  - delete flow now asks for admin password and matches backend requirements
- Remaining direction:
  - related-user drill-down, subscriptions/services using this provider, and change timeline

### Provider Edit (`/providers/[id]/edit`)

Severity: High

- Current before fixes: optimistic locking existed in backend but the UI did not send the version field.
- Operational job: prevent silent overwrite when two admins edit the same provider.
- Fixed now:
  - edit screen sends `version`
  - conflict messaging is surfaced instead of silently last-write-wins

### Reports (`/reports`)

Severity: Medium

- Current: date-range comparison and CSV export.
- Operational job: ad hoc business reporting.
- Weaknesses:
  - mostly static summary reporting
  - no saved reports or scheduled delivery
  - no drill-through from summary metrics

### Runtime Config (`/runtime-config`)

Severity: Medium

- Current: one of the better admin modules. Supports masked secret management, DB overrides, env fallback, and password-confirmed changes.
- Operational job: runtime operations and secret/config readiness.
- Strengths:
  - secrets masked
  - DB/env source clarity
  - step-up auth for edits
- Weaknesses:
  - no approval flow for sensitive changes
  - no config-diff history UI
  - no link from each config to dependent modules

### Security (`/security`)

Severity: Medium

- Current: IP rules, rate-limit logs, GDPR requests, readiness baseline.
- Operational job: security operations and compliance handling.
- Strengths:
  - meaningful readiness snapshot
  - some actionability on IP rules and GDPR state changes
- Weaknesses:
  - no trust-and-safety case management
  - no fraud/risk investigation workspace
  - GDPR requests lack richer fulfillment artifacts and reviewer notes
- Fixed now:
  - corrected a misleading cleanup error message

### Security Dashboard (`/security/dashboard`)

Severity: Medium

- Current: active sessions, login history, security events.
- Operational job: security visibility for admin accounts.
- Strengths:
  - useful session visibility
  - revoke flows
  - login failure metrics
- Weaknesses:
  - no correlation to role changes, permission changes, or linked auth providers
  - no session timeline per admin beyond the current tables

### Settings (`/settings`)

Severity: High

- Current before fixes:
  - looked complete, but several values were hard-coded or misleading
  - included fake/pseudo settings that did not persist
- Operational job: admin self-service, runtime readiness, export controls, and operational links.
- Fixed now:
  - removed fake AI moderation save flow
  - replaced hard-coded system info with actual runtime detection
  - added integration readiness summary
  - added runtime missing-key visibility
  - limited exports to real supported datasets
  - linked to actual ops modules
- Remaining direction:
  - change history for settings and stronger owner metadata

### State Rules (`/state-rules`)

Severity: Medium

- Current: CRUD for state-level relocation rules with audit logging already present in the backend.
- Operational job: maintain state-specific guidance for DMV, utilities, tax, insurance, and voter-registration workflows.
- Weaknesses:
  - no search/filter/sort
  - no relational links to affected moving plans, providers, or help-center content
  - no review/publish workflow for regulatory content
  - no export or diff/history view for policy changes
- Remaining direction:
  - policy governance, impact drill-down, and cross-linking into moving/support workflows

### Health (`/settings/health`)

Severity: Medium

- Current: useful read-only service health and basic infra metrics.
- Operational job: health checks and connectivity verification.
- Weaknesses:
  - no acknowledge/investigate incident workflow
  - no links from failing services to exact config/runtime modules

### Two-Factor (`/settings/two-factor`)

Severity: Medium

- Current: solid MFA enrollment/disable flow with required enrollment gating for high roles.
- Operational job: admin account hardening.
- Strengths:
  - clear enforced setup path
  - backup codes and QR flow
- Remaining direction:
  - last-used dates for backup codes and device/session impacts after disable

### Subscriptions (`/subscriptions`)

Severity: High

- Current: searchable list plus a modal with basic detail.
- Operational job: subscription support and customer billing triage.
- Weaknesses:
  - too read-only for real finance/support operations
  - no cancellation, retry, revalidation, grace-period, or billing-note workflow
  - underexposes provider/platform/store metadata compared with `/billing`
  - no direct timeline/history beyond static fields
- Remaining direction:
  - turn this into the main operator workspace and keep `/billing` as summary analytics

### Support (`/support`)

Severity: High

- Current: good baseline list with filters and pagination.
- Operational job: support queue management.
- Weaknesses:
  - no SLA indicators
  - no bulk assignment or team queue views
  - no macros/saved replies
  - no article recommendations or related account security flags inline
- Remaining direction:
  - queue ownership, SLA timers, and support notes/macros

### Support Detail (`/support/[id]`)

Severity: High

- Current: conversation thread, internal notes, status and priority updates.
- Operational job: resolve a support case safely and quickly.
- Weaknesses before fix:
  - backend supported assignment, but UI barely exposed it
- Fixed now:
  - added explicit assignment controls for assign-to-me and unassign
- Remaining direction:
  - assignee identity display, SLA clock, linked account/security context, and canned replies

### Team (`/team`)

Severity: High

- Current before fixes:
  - showed admins, but lacked operational detail and safe lifecycle handling
  - archive/delete flow did not match backend password-confirm requirement
  - deleting an admin would destroy audit history through cascade behavior
- Operational job: admin-user lifecycle and permission management.
- Fixed now:
  - team list now includes role, status, MFA, active sessions, failed logins, permission summary
  - search and filter added
  - SUPER_ADMIN permission matrix editing added
  - archive flow is explicit and password-confirmed
  - backend archive preserves audit history instead of hard-deleting it
  - role changes can reset to sensible default permissions
- Remaining direction:
  - invite flow, enforced reviewer approval for role elevation, and richer admin timeline

### Tickets Alias (`/tickets`) and Ticket Detail Alias (`/tickets/[id]`)

Severity: Medium

- Current: redirect-only aliases to support pages.
- Operational job: backward compatibility / navigation alias.
- Weaknesses:
  - misleading if treated as standalone modules
  - duplicates mental model without adding capability
- Recommendation:
  - keep only if external links depend on them, otherwise standardize on `/support`

### Users (`/users`)

Severity: Medium

- Current: solid browse surface with filters, exports, bulk selection, and links to detail.
- Operational job: support/customer-success account overview.
- Strengths:
  - better list tooling than many other modules
  - bulk delete is staged through GDPR deletion requests, not direct destructive deletion
- Weaknesses:
  - no auth-method visibility in the list
  - no lifecycle cohorts like unverified, risky, churn-risk, or recent failed logins
  - no internal notes at the user level

### User Detail (`/users/[id]`)

Severity: High

- Current before fixes: deep enough to be useful, but the destructive flow did not satisfy backend password confirmation.
- Fixed now:
  - delete flow now asks for admin password and successfully calls the staged deletion API
- Remaining direction:
  - linked auth methods, session history, support timeline, and notes should be first-class

### Waitlist (`/waitlist`)

Severity: Medium

- Current before fixes: decent list, but status handling and segmentation were too thin.
- Operational job: launch ops, acquisition tracking, and conversion management.
- Fixed now:
  - summary cards expanded to pending/notified/converted
  - added source and converted filters
  - exposed linked user drill-down
  - added admin audit logging for status changes
- Remaining direction:
  - source-performance reporting, notes, and outreach history

## Cross-Surface Consistency Findings

### Web + Mobile OAuth

- Google and Apple entry points existed in web/mobile UX before credentials were present.
- Result: product looked enabled when it was not.
- Fixed now:
  - public provider-readiness route in web
  - honest disabled states on web and mobile sign-in/sign-up
  - clear messaging that password auth works now and social sign-in will unlock after credentials are configured

### Env And Runtime Config

- Runtime config catalog was more complete than the env examples.
- Fixed now:
  - added missing env scaffolding for yearly Stripe pricing and mobile billing/store verification settings
  - documented that OAuth/mobile billing keys can remain blank until rollout

### Admin Visibility vs Backend Capability

- Provider optimistic locking existed but UI ignored it
- Team permission matrix existed but UI barely exposed it
- Support assignment existed but detail view underexposed it
- Notification queue existed in schema but there was no honest queue/worker story in UI
- Settings page looked more complete than backend truth

## Implemented In This Pass

- truthful OAuth readiness and disabled states across web/mobile
- env template expansion for OAuth and mobile billing readiness
- team page rewrite with permission matrix editing, MFA/session/login visibility, and safe archival
- backend change to archive admins instead of deleting audit history
- settings page rewrite to reflect actual runtime state
- waitlist filters, conversion state, source segmentation, audit logging, and user drill-down
- provider detail activity, coverage visibility, optimistic-lock support in edit flow, and safe delete UX
- provider list delete and bulk delete step-up auth fixes
- notifications page rewrite for honest targeting and queue visibility
- notifications audit logging and scheduling guardrail
- support detail assignment controls
- feature-flag, email-template, and help-center audit logging
- dashboard quick-action correction
- user detail delete password-confirm flow fix

## Blocked Only By Future Credentials

- live Google OAuth
- live Apple OAuth
- production email provider validation beyond readiness state
- live Stripe/mobile store verification depending on production secrets
- encrypted offsite backup uploads when storage credentials are absent

## Product Decisions Still Needed

- whether notifications should become a true campaign/scheduler tool or remain a simple operator send surface
- whether subscriptions should support direct admin actions such as cancel, refund, revalidate, grace, and retry
- whether provider changes require approval and reviewer ownership
- whether support should have SLA/macros/notes and case ownership rules
- whether trust-and-safety/fraud tooling lives inside security or becomes its own module
- whether waitlist should support outreach sequences and attribution analytics

## Recommended Next Sprint

1. Turn subscriptions into an actual support/finance workspace with lifecycle actions and mobile-store drill-down.
2. Add user-level timelines: linked auth methods, sessions, support, subscription events, and internal notes.
3. Add provider governance: draft/review/publish, duplicate merge, and user-impact drill-down.
4. Add support operations: ownership views, SLA clocks, macros, and related help-center suggestions.
5. Build or explicitly defer the notification scheduler worker so queue semantics are no longer ambiguous.
