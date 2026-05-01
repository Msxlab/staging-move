Full System Audit Report
Repository: c:/Users/Windows/Downloads/move-main/move-main (LocateFlow monorepo)
Date: 2026-05-01
Mode: Read-only. No files were modified, created, deleted, or formatted. Working tree at end matches pre-audit state.
Method: Five parallel deep-dive agents (DB/shared, admin app, web app, mobile app, cross-cutting security) plus independent inventory of CI, tests, dead-code signals, console-log usage, raw SQL, sanitization patterns. All findings are evidence-based with file paths.

1. Executive Summary
   Overall system health
   LocateFlow is a substantially mature monorepo: pnpm workspace with three Next.js/Expo apps, a Prisma DB package (49 models, 26 sequential MySQL migrations) and a shared TS package. The codebase shows real defensive engineering — AES-256-GCM field encryption with rotation support, JWT + DB-backed sessions with fingerprint binding, signed cron secrets with constant-time compare, four webhook providers each with signature + replay protection, MFA + backup codes, append-only audit logs, R2-backed encrypted offsite backups, RBAC permission matrix, gitleaks in CI, login lockout escalation, CCPA/GDPR consent flows, sanitize-html for blog content. 131 unit/integration tests plus Playwright e2e on the web app.

But the maturity is uneven. Web app is the most carefully built surface; admin is broad with several validation gaps (only ~4 of ~70 routes use Zod); mobile is recent and has correctness gaps (typo file outh.tsx, no PKCE on OAuth, no API timeout, hand-rolled validation despite shipped RHF+Zod). DB schema is large but uses string columns instead of enums, soft-delete is opt-in and incomplete, two parallel type/validator stacks exist (@locateflow/shared/validators.ts is dead, web's is live).

Biggest risks
packages/db/prisma/\_migration-data.json (652 KB) committed to source control — likely contains real or near-real records. Inspect contents and remove from git history.
Web app CSP includes 'unsafe-inline' on script-src in production (apps/web/next.config.js:48-50). Any HTML-injection bug becomes immediate JS execution. Admin app already migrated to nonce + strict-dynamic; web has not.
OAuth on mobile uses Linking.openURL without PKCE/state. The custom scheme locateflow:// is hijack-prone on Android.
AdminAuditLog.adminUser onDelete: Cascade wipes the admin's audit history when the row is deleted — defeats compliance purpose.
Admin login route does not validate request body with Zod (apps/admin/src/app/api/auth/login/route.ts:214). Admin password reset has no self-service path either.
Mass-assignment risks in admin help-center PUT, email-templates PUT, notifications POST: unfiltered body spread into Prisma update.
Backups silently truncate at hardcoded take: 50000 per table. Tables larger than that ship a partial backup.
Most urgent fixes (one-week horizon)
Remove \_migration-data.json from VCS, rotate any secrets it might contain.
Fix apps/admin/src/app/api/reports/route.ts:250 user-visible typo "backuprisma.".
Tighten Stripe invoice.payment_succeeded scope to (stripeCustomerId, stripeSubscriptionId) to prevent multi-sub re-activation.
Replace bare === cron-secret compares in blog-publish/blog-cleanup with verifyInternalAuth.
Migrate admin login route to Zod-validated body.
Confirm /api/mobile/auth/exchange and /api/acquisition/public-trial-campaign reachability — neither appears in the public allow-list.
Remove placeholder outh.tsx typo file once safe; it is byte-identical to oauth.tsx.
Main architectural concerns
Two parallel type stacks: @locateflow/shared/types.ts declares User/Service/Address etc. as plain interfaces (with refs to deleted models), competing with @prisma/client. Drift is visible (Document, Review, Badge, UserBadge types still exist for dropped models).
Two parallel validator stacks: @locateflow/shared/validators.ts is unused; apps/web/src/lib/validators.ts is the live one. Mobile re-implements ad-hoc validation as a third stack.
Free-form String enums in DB instead of Prisma enums for status/plan/provider/scope/channel; canonical lists live in TS constants files. Schema can ingest anything.
settings RBAC resource is overloaded (covers feature-flags, runtime-config, IP rules, GDPR, backups, notifications, help-center, email-templates, waitlist).
Maturity by surface
Surface Score Notes
Web app Mature Edge middleware + route gates + transactional one-time-token claims. Strongest area.
Admin app Functional → Mature Strong RBAC + audit logs; broad validation gaps; many small holes.
Mobile app Partial → Functional Recent build; no tests at all; hand-rolled validation; OAuth/timeout gaps.
DB / shared Functional Mature Prisma layout but dead types, dead validators, schema-side enum gaps.
Backend/API Functional Most webhooks/crons are well-defended; some CSP/CORS/body-cap inconsistencies.
Tests Partial 131 web/admin tests, but 0 mobile tests and middleware is undertested. 2. Repository Map

move-main/ Root (pnpm workspace, turbo, Node 22)
├── apps/
│ ├── admin/ Next.js admin panel (App Router, 26 modules)
│ │ ├── src/app/(admin)/ Admin pages (dashboard, users, etc.)
│ │ ├── src/app/api/ Admin REST API (~70 route files)
│ │ ├── src/app/login/ Admin login page
│ │ ├── src/middleware.ts 485 lines — IP rules, CSRF, CSP nonce, fingerprint
│ │ └── src/lib/ 49 admin libs (auth, backup, runtime-config, etc.)
│ ├── web/ Next.js consumer app (App Router)
│ │ ├── src/app/(app)/ Authenticated app pages
│ │ ├── src/app/api/ ~95 route files (auth, billing, providers, …)
│ │ ├── src/app/{public marketing pages}
│ │ ├── src/middleware.ts 549 lines
│ │ ├── src/lib/ 115 lib files (user-auth.ts is 837 lines)
│ │ └── tests/e2e/ Playwright (accessibility, public-pages)
│ └── mobile/ Expo React Native (file-based routing)
│ ├── app/ Routes — (auth), (tabs), settings, etc.
│ ├── src/components, hooks, lib, store, i18n, styles
│ └── android/ Native overrides (Secure Store backup rules)
├── packages/
│ ├── db/ @locateflow/db — Prisma client + helpers
│ │ ├── prisma/schema.prisma 1618 lines, 49 models, 1 enum
│ │ ├── prisma/migrations/ 26 dated MySQL migrations
│ │ ├── prisma/seed*.ts 5 provider seeds + master + admin + state-rules
│ │ └── src/ soft-delete, optimistic-locking, provider-coverage
│ └── shared/ @locateflow/shared — TS-only utilities
│ └── src/ encryption, validators (dead), types, constants,
│ billing, acquisition, blog, recommendation-engine,
│ migration-engine, runtime-config, api-client, etc.
├── scripts/ Provider audits (tsx runners), Stripe sync
├── docker/, docker-compose*.yml, Dockerfile Container deployment (Caddy + MySQL + ofelia cron)
├── .github/workflows/ci.yml Lint, typecheck, prisma validate, tests, e2e
├── .env.example, .env.production.example, .env.docker
└── docs/ audits, deploy, design-system, runbooks, etc. 3. Module Map
Admin app (apps/admin/src/app/(admin))
Module Pages API Models Permissions
Dashboard (admin)/page.tsx, health-card.tsx n/a many (read-only aggregates) VIEWER
Users users/{page,[id]/page}.tsx /api/users, /api/users/[id], [id]/impersonate, [id]/subscription-actions User, Subscription VIEWER read; ADMIN delete; SUPER_ADMIN impersonate
Subscriptions subscriptions/page.tsx /api/subscriptions, /api/billing Subscription, AcquisitionRedemption VIEWER read
Acquisition Campaigns acquisition-campaigns/page.tsx /api/acquisition-campaigns, [id], validate-price AcquisitionCampaign ADMIN
Billing billing/page.tsx /api/billing Subscription ADMIN
Providers providers/{page,new,[id],[id]/edit,needs-logo}/page.tsx /api/providers, [id], [id]/logo/{auto-fetch,upload,candidates/[id]}, bulk, needs-logo ServiceProvider, ServiceProviderCoverage, ProviderLogoCandidate MODERATOR write
Provider Governance provider-governance/page.tsx /api/provider-governance ProviderGovernanceIssue MODERATOR write
State Rules state-rules/page.tsx /api/state-rules, [id] StateRule ADMIN write
Moving moving/page.tsx /api/moving MovingPlan, MoveTask VIEWER (read-only — see findings)
Tickets / Support tickets/{page,[id]}.tsx, support/{page,[id]}.tsx /api/tickets, [id] SupportTicket, TicketMessage ADMIN
Notifications notifications/page.tsx /api/notifications Notification, NotificationQueue ADMIN
Email Templates email-templates/page.tsx /api/email-templates, /api/email-health EmailTemplate, EmailLog ADMIN
Help Center help-center/page.tsx /api/help-center HelpArticle, FAQ ADMIN
Waitlist waitlist/page.tsx /api/waitlist WaitlistSignup ADMIN
Analytics analytics/{page,intelligence}/page.tsx /api/analytics, admin-activity, activity-intelligence, user-spending UserSession, UserEvent, AdminAuditLog ADMIN
Reports reports/page.tsx /api/reports aggregates VIEWER
Feature Flags feature-flags/page.tsx /api/feature-flags FeatureFlag ADMIN
Security security/{page,dashboard}/page.tsx /api/security, dashboard, key-rotation IPRule, RateLimitLog, GDPRRequest, BackupRecord ADMIN multi-action; SUPER_ADMIN key-rotation
Runtime Config runtime-config/page.tsx /api/runtime-config RuntimeConfigEntry SUPER_ADMIN + step-up
Backups backups/page.tsx /api/backup, import, verify, retention, [id]/download, /api/cron/backup BackupRecord ADMIN + step-up
Audit Logs logs/{page,activity}/page.tsx /api/logs AdminAuditLog, AuditLog ADMIN
Settings settings/{page,health,two-factor}/page.tsx /api/settings runtime cfg, integration health ADMIN read; SUPER_ADMIN write
Blog blog/{page,new,[id]/edit,analytics}/page.tsx /api/blog/posts, [id], [id]/publish, [id]/preview-token, image, uploads BlogPost, BlogCategory, BlogTag, BlogPostTag, BlogRevision, BlogView MODERATOR (uses Zod consistently)
Team team/page.tsx /api/team, [id] AdminUser, AdminPermission SUPER_ADMIN + step-up
Web app (apps/web/src/app)
Surface Pages API
Auth sign-in, sign-up, forgot-password, reset-password/[token], verify-email, unsubscribe /api/auth/{login, register, logout, me, forgot-password, reset-password, password/{change,reset/{request,confirm}}, verify-email, resend-verification, security, mfa/{setup,confirm,disable}, oauth/{google,apple,providers}, oauth/{google,apple}/callback, impersonate-handoff}
(app) authenticated addresses, budget, dashboard, help, moving, notifications, providers, services, settings, support /api/{addresses, budget, custom-providers, moving, move-tasks, notifications, profile, providers, services, state-rules, tickets, user/{locale,preferences}, account/delete, export, legal/acceptance, onboarding/progress, services, subscription/actions}
Stripe / IAP settings/subscription /api/stripe/{checkout,checkout/cancel,portal}, /api/mobile/{auth/exchange, iap/products, iap/verify}, /api/webhooks/{stripe,appstore,playstore,resend}
Cron n/a /api/cron/{admin-daily-digest, bill-reminders, blog-cleanup, blog-publish, checkout-cleanup, contract-reminders, data-retention, move-reminders, provider-stats, stripe-reconcile, trial-check, weekly-digest}
Internal n/a /api/internal/{impersonate, ip-rules, rate-limit-log}
Public marketing pricing, terms, privacy, disclaimer, dpa, faq, how-it-works, refund, security, cookie-policy, acceptable-use, billing-policy, ccpa-privacy-notice, contact, expenses, blog, blog/[slug], blog/preview/[token], offline, not-found, error, llms.txt, sitemap.ts, robots.ts /api/health, /api/help, /api/blog/{posts,view,image,revalidate,indexnow-key/[key]}, /api/state-rules, /api/providers, /api/providers/[id], /api/acquisition/public-trial-campaign, /api/consent/ccpa, /api/waitlist
Mobile app (apps/mobile/app)
Group Screens
(auth) \_layout, sign-in, sign-up, forgot-password
(tabs) index (Dashboard), addresses, moving, services, more
addresses [id]/edit, [id]/index, new
budget index, [id], new
custom-providers index, [id], [id]/edit
help index, tickets, tickets/[id]
moving [id], new
notifications index
providers index, [id]
services [id], [id]/edit, new
settings index, profile, notifications, privacy, subscription, export, delete-account
blog index, [slug], \_layout
OAuth oauth.tsx, outh.tsx (typo duplicate), \_layout.tsx (AuthGuard + deep-link handler)
Onboarding onboarding.tsx (1207 lines) 4. Module-by-Module Findings
Module: Auth (admin)
What exists
JWT cookie sessions with fingerprint binding, MFA via TOTP + 8 backup codes (hashed), bcrypt cost-12, login lockout escalation (5/15min → 30min ban), step-up password confirm with in-memory grace window, generic error to prevent enumeration, audit logs for all branches.

Problems found
apps/admin/src/app/api/auth/login/route.ts:214 — does not validate request body with Zod; only loose destructure. No length cap on password (CPU DoS via long bcrypt input).
:296 — JSON.parse((admin as any).mfaBackupCodes || "[]") lacks try/catch; corrupted DB row crashes login.
:275, 284, 295, 332, 338 — (admin as any).mfaSecret casts everywhere indicate stale Prisma client; regen needed.
apps/admin/src/lib/auth.ts:354-398 — requirePasswordConfirm keeps 15-min grace in an in-memory Map. Doesn't survive serverless cold starts; not shared cross-instance.
:358 — setInterval registered in route module — leaks on hot reload.
requireAdmin returns the JWT-claim role unmodified (session.role); requireRole re-reads from DB. Subtle footgun.
apps/admin/src/app/login/page.tsx:145 — backup code field placeholder reads "XXXXXXXX" — looks like never-replaced TODO copy.
No "Forgot password?" link on admin login. Admins have no self-service recovery; require DB edit + bcrypt rehash.
Missing or incomplete pieces
middleware.test.ts covers only 3 specs (CSP image-src, SW); zero coverage of JWT verify, fingerprint mismatch, MFA gate, body limit, CSRF, IP block.
Security concerns
Soft-deleted (isActive=false) admins still browse the admin shell because middleware can't reach the DB; only API calls re-validate via requireAdmin.
Recommendations
Add Zod to login. Wrap JSON.parse in try/catch. Replace in-memory requirePasswordConfirm Map with a Redis row keyed on adminId. Add "Forgot password?" admin recovery flow (or document the DB-edit runbook). Expand middleware tests.

Priority
Critical (login validation, MFA crash on corrupt row); High (everything else).

Module: Auth (web)
What exists
Zod-validated login/register/reset, atomic one-time-token claim transactions for password reset and email verification, per-IP and per-user rate limits with fail-closed on auth, session JWT fingerprint with web-tolerates-IP-drift / mobile-tolerates-UA-only, MFA setup/confirm/disable with re-auth, OAuth (Google + Apple) with state cookie, login lockout escalation, append-only legal-consent events, post-auth redirect logic.

Problems found
apps/web/src/app/api/auth/password/reset/confirm/route.ts:28-35 — IP-only rate limit; no per-tokenHash limit. Coordinated CGNAT attackers reach the IP ceiling fast.
apps/web/src/middleware.ts:353-385 — hasValidSession only checks JWT signature; routes that don't go through requireDbUserId rely entirely on JWT being unrevoked.
apps/web/src/middleware.ts:486 — uses only x-forwarded-for, not the layered cf-connecting-ip / x-vercel-forwarded-for precedence used in apps/web/src/lib/rate-limit.ts:197-216.
apps/web/src/app/api/auth/me/route.ts — limiter is failClosed:false (intentional but at scale lets attackers probe session validity at 200 rps/IP if Redis is down).
Recommendations
Add per-tokenHash rate limiter to reset confirm. Standardize IP precedence into a single helper used by middleware AND rate-limit AND route handlers. Document the failClosed:false carve-out.

Priority
High for token-rate-limit; Medium for IP precedence cleanup.

Module: Users (admin)
What exists
RBAC (requirePermission("users", "canRead", { minimumRole: "VIEWER" })), pagination (parsePaginationParams), filters, soft-delete on bulk delete with self-delete protection, step-up password confirm for destructive ops, full audit log, CSV export, comparable-providers join.

Problems found
apps/admin/src/app/api/users/route.ts:38 — search uses Prisma contains over multiple columns with no length cap.
:95-112 — N+1-ish: each user fetches services to count reviews client-side instead of \_count with filter.
loadComparableProviders runs a full provider-table scan on every list call (no caching).
apps/admin/src/app/(admin)/users/page.tsx:195 — CSV export uses string interpolation; emails/names with commas or quotes break the CSV (no RFC 4180 escaping).
:97 — Hardcoded perPage = 20; no per-page selector.
useState<any> and (user: any) leak through the page.
Recommendations
RFC-4180 CSV escape; reuse a util. Replace per-row services map with \_count: { where: { personalReview: { not: null }}}. Clamp search length and use full-text index in MySQL.

Priority
Medium.

Module: Subscriptions / Billing / Acquisition Campaigns
What exists
Read-only subscriptions list with filters, separate /api/billing aggregator, acquisition-campaigns CRUD with active-window overlap detection in transaction, Stripe price validation via shared util, audit logs. AcquisitionRedemption stores both campaign snapshot AND signup snapshot for legal hold.

Problems found
apps/admin/src/app/(admin)/page.tsx:99 — MRR computation is wrong. groupBy plan ignores billingInterval; yearly subscribers contribute the full monthly equivalent instead of /12 amortization. apps/admin/src/app/api/billing/route.ts:14-24 does it correctly — duplicated logic, drifted.
apps/admin/src/app/api/billing/route.ts:48-50 — pulls every Subscription with user join into memory. No pagination, no time bound. Memory bomb at scale.
apps/admin/src/app/api/acquisition-campaigns/route.ts:99 — (prisma as any).acquisitionCampaign cast indicates stale client.
:81-93 — findActiveCampaignConflict reads ALL active campaigns then filters in JS.
apps/web/src/app/api/webhooks/stripe/route.ts:577-580 — invoice.payment_succeeded updateMany keyed only by stripeCustomerId; multi-sub customers get all rows ACTIVE'd.
apps/web/src/app/api/webhooks/stripe/route.ts:677-689 — mapStripeStatus falls through to "UNKNOWN"; future Stripe enum value silently writes UNKNOWN (consider fail-closed for retry).
Refund (charge.refunded) and customer.subscription.deleted paths update DB but don't write a local audit log row. Billing forensic trail incomplete.
Security concerns
Stripe webhook secret is read at request-time from runtime config (DB) on every call. Compromise of the runtime-config write path would let an attacker swap the secret to their own.
Priority
High for invoice scope, MRR amortization, refund audit logging; Medium for billing aggregator scaling.

Module: Providers / Provider Governance / State Rules
What exists
Provider CRUD with conflict detection (findProviderConflicts for slug + website-category) before insert, transactional coverage rebuild via rebuildProviderCoverage, cache invalidation revalidateTag("providers"), governance issue tracker with multi-action PATCH, state-rules with audit log.

Problems found
apps/admin/src/app/api/providers/route.ts:16 — parseIncomingProvider accepts unfiltered Record<string, unknown> (CSV bulk imports bypass schema validation; only file metadata is validated).
take: 2000 hardcoded in providers and provider-governance routes — silent truncation past 2000 rows.
apps/admin/src/app/api/provider-governance/route.ts:159 — data: any = {} plus string-cascade dispatch instead of typed enum + zod discriminated union.
apps/admin/src/app/api/state-rules/route.ts — no Zod, no length caps on free-text fields. Admins could insert MB-sized payloads. PATCH/DELETE only in [id]/route.ts.
packages/shared/src/migration-engine.ts:151-165 — evaluateCondition defaults unknown conditions to true (fail-open).
packages/shared/src/migration-engine.ts:167-189 — findBestProvider ORs popularityScore with 0; federal providers always beat state at equal popularity.
Priority
Medium.

Module: Moving Plans / Move Tasks
What exists
Web side: POST /api/moving Zod-validated, plan-limit + per-address-limit gates, validates origin/dest belong to user, prevents same-address moves, transactional address+plan create. PATCH uses explicit state-machine VALID_STATUS_TRANSITIONS. Move tasks endpoint validates ownership; PATCH only allows event verbs ACCEPT/START/COMPLETE/DISMISS/REOPEN.

Problems found
apps/admin/src/app/api/moving/route.ts:87 — take: 8 on moveTasks; admins viewing a 30-task plan see only 8.
Admin moving page is read-only — no admin actions (cancel/reassign/complete) on moving plans.
apps/web/src/app/api/move-tasks/route.ts:150-165 — PATCH input does not use Zod; manual typeof checks.
apps/web/src/app/api/moving/[id]/route.ts:81-89 — moveDate change does not re-validate that origin/dest haven't been soft-deleted.
apps/web/src/app/api/move-tasks/route.ts:92 — POST accepts movingPlanId from body without explicit ownership check before calling syncSuggestedMoveTasks. Verify the helper does it (src/lib/move-task-generation.ts).
Schema concerns
MovingPlan.fromAddress/toAddress (schema 501, 504) declare relations but no onDelete action specified — deleting an Address that is from/to will fail at the DB level. Soft-delete-on-Address doesn't help the planned hard-delete after retention.
Priority
High (admin missing action surface, address cascade hazard).

Module: Tickets / Support
What exists
Web /api/tickets POST with Zod, 5/h IP+user rate limit, ownership-scoped fetches, SLA disclaimer ("derived operational target, not contractual"). Admin filters by assignee/status; "me" alias on assignedTo.

Problems found
apps/admin/src/app/api/tickets/route.ts:60 — assignedTo === "me" collides with admin id "me" (cosmetic).
:54 — reimplements pagination inline; parsePaginationParams exists but isn't used here.
No Zod on ticket list filters.
TicketMessage.senderId (schema 1415) is polymorphic (User id or AdminUser id) with no FK — orphan rows possible if the AdminUser is deleted.
Priority
Medium.

Module: Notifications
What exists
Admin honest channel gating (SUPPORTED_ADMIN_SEND_CHANNELS = ["IN_APP"]), capability flag exposed in GET, audit log on send. Web /api/notifications/feed for user-side reads.

Problems found
apps/admin/src/app/api/notifications/route.ts:109, 122 — broadcast loads ALL user IDs into memory and writes one createMany. On a 1M-user table this is a lock killer. No batching.
:97 — sendAt only validated > now+5s; sendAt: "yesterday" silently becomes immediate.
apps/web/src/app/api/notifications/route.ts:54-114 — accepts arbitrary digestDay/reminderDays strings; no value allowlist (M-6 from security audit).
Cron trial-check dedupes via Notification.metadata.contains substring search (apps/web/src/app/api/cron/trial-check/route.ts:76-82) — non-indexed full-table scan.
Schema: Notification lacks expiresAt index; NotificationPreference.channel has no default.
Priority
High (broadcast scaling, sendAt validation); Medium for indices.

Module: Email Templates
What exists
Required-template guard (isRequiredEmailTemplate) blocks hard-deletes; safe-email-error redaction strips API keys and 32+ char tokens; per-template send counts joined; audit log on every mutation.

Problems found
apps/admin/src/app/api/email-templates/route.ts:162 — PUT spreads body into prisma.update({ data }) without filtering. Mass-assignment: admin could submit id, createdAt, slug and silently overwrite. (Prisma rejects unknown columns at runtime, but known-but-immutable fields go through.)
Priority
High.

Module: Help Center
What exists
FAQ + Article in one route, audit log on every mutation, slug auto-derive on the page.

Problems found
apps/admin/src/app/api/help-center/route.ts:93 — Article PUT does data: { ...body, updatedBy: session.adminId }. Mass-assignment risk (id, createdBy, slug overridable).
No length caps on FAQ/Article fields.
apps/admin/src/app/(admin)/help-center/page.tsx:40 — bare confirm("Delete?") for high-value content.
apps/web/src/app/(app)/help/page.tsx:52-53 — ThumbsUp/ThumbsDown buttons render without onClick/API call. Placeholder dead UI.
Priority
High (mass-assignment); Medium (placeholder).

Module: Waitlist
What exists
Targets enforced via TS const-assertion + typeguard (best-typed module), filtering, IP-keyed 10/h rate limit, idempotent.

Problems found
apps/admin/src/app/api/waitlist/route.ts:49 — take: 500 hardcoded; no pagination.
PATCH only updates notifiedAt/convertedAt; no reason or history captured.
No DELETE — admins cannot remove a signup.
Priority
Low.

Module: Analytics / Reports
What exists
Aggregated session + audit + user-event stats with PII-minimization (initials masking, 20 recent sessions cap). Reports has overview type with metrics, daily registration, top states/providers.

Problems found
apps/admin/src/app/api/analytics/route.ts:44, 51 — take: 5000 on both sessions and audit logs. Truncates at scale.
:114-120 — userEvent.groupBy without time bound.
apps/admin/src/app/api/reports/route.ts:91 — detail: e.message leaked in 500 response. Internal error leak.
:24 — only type=overview implemented; conditional accepts "all" but else branch returns 400.
:41 — uses findMany then JS-aggregates daily registrations instead of SQL DATE_TRUNC.
:77 — providers previous: providersTotal, change: 0 (no period-diff despite createdAt available).
Priority
Medium.

Module: Feature Flags
What exists
ADMIN-role CRUD with audit logs.

Problems found
No evaluation API. Only management; nothing serves flag state to web/mobile clients. Either evaluation lives elsewhere or is missing entirely. As shipped, this is a toggle list with no consumers.
targetType accepts free-form string; UI lists ALL|PERCENTAGE|USER_LIST|PLAN but API stores anything.
targetValue JSON shape isn't validated.
Toggle does not require step-up confirmation — anyone with ADMIN flips prod features instantly.
apps/admin/src/app/(admin)/feature-flags/page.tsx:39 — bare confirm() for delete.
Priority
High.

Module: Security (admin)
What exists
IP rules + rate-limit logs + GDPR + readiness in one response; multi-action POST with per-action RBAC; key-rotation endpoint SUPER_ADMIN-only with step-up; recommendation engine.

Problems found
apps/admin/src/app/api/security/dashboard/route.ts:250 — user-visible typo: "...Consider creating a fresh backuprisma." (concatenation bug merging "backup" and "prisma").
apps/admin/src/app/api/security/route.ts:47 — add_ip_rule accepts ipAddress as a string with no IP/CIDR validation. Admin could insert "abc" and break the IP-rule cache.
:65 — IP rule delete is hard delete; no soft-delete, no undo.
:140 — encryption health check checks env-var length only; doesn't actually attempt to decrypt anything.
apps/admin/src/app/api/security/key-rotation/route.ts:61-72 — no transaction wrapping the 100-row batch rotation. A crash mid-rotation leaves DB with mixed-key rows.
Priority
Critical (typo, user-visible); High (IP validation, rotation atomicity).

Module: Runtime Config
What exists
Strongest module. SUPER_ADMIN-only read AND write, step-up password for PUT/DELETE, encrypted at rest for isSecret keys, masked-only response (full secret never returned), audit log per change, env-fallback resolution.

Problems found
apps/admin/src/app/api/runtime-config/route.ts:30 — PUT accepts any value string; no length cap.
RuntimeConfigEntry has both valuePlain and valueEncrypted columns; SUPER_ADMIN can opt out of encryption per key (intentional).
Stripe webhook reads STRIPE_WEBHOOK_SECRET from runtime config every call (DB roundtrip + risk surface).
Priority
Low (this module is mature).

Module: Backups
What exists
Encrypted + signed + offsite enforced. Step-up password required. Per-table import with getReplaceSafetyIssues. Browser-download fallback when offsite upload fails.

Problems found
apps/admin/src/app/api/backup/route.ts:31-115 — every table hardcoded take: 50000. Tables larger than 50k ship a partial backup silently. Backup correctness depends on hidden assumption.
:279 — JSON.stringify of 22 tables × 50K rows in heap. OOM risk.
:400 — browser-download fallback sends multi-MB JSON in the response body (heavy React state).
errorMessage field reused for success metadata — works, slightly hacky.
Priority
Critical (silent backup truncation).

Module: Audit Logs
What exists
Tab split (admin audit + user audit), filter facets via groupBy with counts, pagination, per-action filtering.

Problems found
apps/admin/src/app/api/logs/route.ts:24-28, 64-68 — where.OR over contains columns; unindexed.
No export, no download.
No retention enforcement on the logs API (a backup-retention sub-route exists but nothing prunes audit logs).
apps/admin/src/app/(admin)/logs/page.tsx:31-36 — actionColor heuristic; custom actions without keyword match get default color.
Priority
Medium.

Module: Settings
What exists
Integration matrix (OAuth, Stripe, Resend, Apple/Play, R2, Upstash) with configured/missing report; runtime missing-required-keys exposed; SUPER_ADMIN-only write; step-up for grant_premium.

Problems found
apps/admin/src/app/api/settings/route.ts:232 — test_stripe action does not require step-up despite running with SUPER_ADMIN privilege.
:252 — grant_premium has no max durationDays cap — admin can grant 99999 days of premium.
:240 — Stripe.apiVersion = "2024-06-20" hardcoded.
Priority
High (grant_premium cap).

Module: Blog
What exists
Most defensively-coded admin module: only one to use Zod consistently, transactional create + audit log, slug uniqueness retry, reserved-slug guard, sanitize-html with comprehensive XSS test battery (apps/web/src/lib/blog/sanitize.test.ts).

Problems found
apps/admin/src/app/api/blog/posts/route.ts:61 — take: 200 hardcoded; no pagination.
:110 — slug uniqueness retry caps at 4 attempts with Math.random suffix; probabilistic under high contention.
Priority
Low.

Module: Team (admin users)
What exists
Permission matrix (buildDefaultPermissionMatrix), step-up password, 12-char password policy, audit log, SUPER_ADMIN-only.

Problems found
apps/admin/src/app/api/team/route.ts — no Zod.
:117 — bcrypt.hash(body.password, 12) — password held in memory throughout request lifecycle (unavoidable; flagged for awareness).
Priority
Low.

Module: Onboarding (web)
What exists
4-step wizard collecting profile (with sensitive Art.9 opt-in gate), address (encrypted at write), services, moving plan. Resumable via getOnboardingProgress.

Problems found
apps/web/src/app/api/profile/route.ts:135-151 — accepts client-supplied legal consents (audit-tagged profile_fallback). Acceptable but worth documenting.
apps/web/src/lib/api-gates.ts:106 — fetches the 10 most recent LEGAL_CONSENT_EVENT rows; user with 11+ stale consents could be locked out (edge case).
Email verification not required to write profile; gates kick in at services POST.
Priority
Low.

Module: Custom Providers
What exists
User-scoped CRUD with case-insensitive duplicate-name guard, listed-provider conflict detection, plan-limit gate.

Problems found
Sensitive fields plaintext. apps/web/src/app/api/custom-providers/route.ts — notes/email/phone stored as plain text. Service.\* equivalents are encrypted via service-sensitive-fields.ts. Inconsistent privacy posture.
cleanText strips only <> (sufficient — React escapes).
Priority
High (encryption inconsistency).

Module: Mobile auth
What exists
SecureStore-backed JWT, 30-day non-refreshing token, clearSession on 401, dedicated OAuthCallbackScreen, deep-link parsing in \_layout.tsx with replay protection (AsyncStorage + in-memory ref).

Problems found
apps/mobile/app/outh.tsx is byte-identical duplicate of oauth.tsx (typo file). Router accepts both as auth-callback routes. Pre-existing modification — kept as a defensive fallback.
OAuth uses Linking.openURL, not expo-web-browser's openAuthSessionAsync. No PKCE, no client-side state. Custom scheme locateflow:// is hijack-prone on Android (any app can register the scheme).
apps/mobile/src/lib/auth-store.ts:69-71 — refreshUser() calls clearSession() on any !res.ok, including transient 5xx. Should only sign out on 401/403.
apps/mobile/src/lib/auth.ts — token storage uses expo-secure-store (good), but HANDLED_OAUTH_CODES_STORAGE_KEY uses AsyncStorage (plaintext on Android). Codes are short-lived, so impact is limited.
app.json:25-27 declares NSFaceIDUsageDescription but no code path uses Face ID (expo-local-authentication not imported). Apple Review may flag.
Priority
Critical (no PKCE/state on OAuth); High (transient-5xx logout); Medium (Face ID claim).

Module: Mobile API client
What exists
Shared ApiClient (packages/shared/src/api-client.ts) with auth header, x-client-type:mobile, 401 unauthorized callback, 429 retry-after.

Problems found
No request timeout. fetch() has no AbortController; flaky cellular hangs indefinitely.
No retries / backoff at the client level.
README claims "React Hook Form + Zod" but none of the auth/onboarding screens use them. Hand-rolled validation everywhere; mixes localized strings with hardcoded English.
Mobile dashboard re-fetches profile + addresses + moving + services + state-rules sequentially per render; web uses cached server-render.
Priority
High.

Module: Mobile screens — error handling
What exists
ErrorBoundary at root, LoadingScreen pattern, EmptyState component used widely.

Problems found
Most (tabs) screens silently swallow API errors — failed fetch leaves stale or empty data with no "Try again" affordance. Only custom-providers and auth screens surface errors. ErrorBoundary catches render errors, not network failures, so a 500 from /api/profile is invisible.
app-store.ts (Zustand) appears unused — onboarding state read from server.
Priority
High.

Module: Mobile IAP
What exists
Lazy native module load (Expo Go safe), connection pooling, verify-before-finish with server-side /api/mobile/iap/verify consulted first, finishTransaction only after server confirms (correct for entitlement preservation), iOS jwsRepresentation preferred, restore via getAvailablePurchases. Subscription screen has Stripe browser fallback with acceptedSubscriptionTerms confirmation.

Problems found
None significant. Best-architected mobile module.
Priority
Low.

Module: Cron Jobs
What exists
12 cron endpoints; most use verifyInternalAuth(authHeader, "cron") with constant-time compare. Categories include digest, billing reminders, blog publish/cleanup, checkout cleanup, contract reminders, data retention, move reminders, provider stats, stripe reconcile, trial check, weekly digest, admin daily digest.

Problems found
apps/web/src/app/api/cron/blog-publish/route.ts:21-29 and apps/web/src/app/api/cron/blog-cleanup/route.ts:22-28 — use plain === / !== against secret instead of verifyInternalAuth. Timing-oracle inconsistency.
apps/web/src/app/api/cron/data-retention/route.ts:19-24 — accepts legacy x-cron-secret header (documented).
Priority
High (constant-time fix for blog routes).

Module: Webhooks
What exists
Four providers, each properly defended:

Stripe — signature verify, 72h replay, DB idempotency via ProcessedWebhookEvent, live-mode mismatch protection, fire-and-forget email.
App Store — JWS chain verify (outer + inner transaction), notificationUUID idempotency.
Play Store — Pub/Sub OIDC audience pin (GOOGLE_PLAY_RTDN_AUDIENCE), packageName defense in depth, playstore:${messageId} idempotency.
Resend — Svix HMAC.
Problems found
apps/web/src/middleware.ts:115 — applyBodySizeLimit exempts /api/webhooks/. No explicit per-route content-length cap inside webhook handlers. Memory-pressure DoS surface.
Stripe invoice.payment_succeeded scope bug already covered in Billing module.
Resend webhook has no rate limit (relies on signature being unforgeable).
Priority
Medium (body-size cap inside handlers).

Module: Service Worker
What exists
Deliberately disabled (DISABLE_SERVICE_WORKER = true); install/activate self-unregister; cache-cleanup via LOGOUT_CLEAR_CACHES postMessage. Test-enforced.

Problems found
None. Intended state.

Module: Health endpoint
What exists
Public /api/health returns checks (DB, Redis, encryption, Stripe, Apple/Play, R2, Sentry), uptime, memory.

Problems found
Information disclosure: memory: { rssMb, heapUsedMb, heapTotalMb } leaked publicly (apps/web/src/app/api/health/route.ts:209-214).
checks.\*.detail strings reveal env var names like "FIELD_ENCRYPTION_KEY missing or wrong length".
Priority
Medium.

5. Web App Findings
   Routing/navigation
   Public allow-list in apps/web/src/middleware.ts:31-55 is explicit and tight. PUBLIC_API_GET = ['/api/providers'] makes both /api/providers and /api/providers/recommendations middleware-public, but the recommendations route enforces auth itself via requireDbUserId — safe but inconsistency-prone.
   Concern: /api/mobile/auth/exchange and /api/acquisition/public-trial-campaign are designed for unauthenticated callers but don't appear in PUBLIC_API_PREFIXES or PUBLIC_API_EXACT. Either the mobile bootstrap has a session, or this is a real reachability gap. Verify.
   /api/state-rules requires auth — inconsistent if marketing pages need to show "what's required for moving to TX" pre-auth.
   UI/UX
   (app)/help/page.tsx:52-53 — placeholder ThumbsUp/ThumbsDown without handlers.
   forgot-password, reset-password/[token], verify-email pages are minimal. /reset-password (no token) likely 404s — UX gap.
   Most pages have loading flags rather than Suspense boundaries; acceptable.
   Blog content rendered with dangerouslySetInnerHTML is sanitized via sanitizeBlogHtml (sanitize-html with strict config + extensive XSS test battery). Safe.
   State management
   React Query is used in apps/web but not consumed by (tabs) mobile screens — divergence.
   API integration
   Most mutating routes use requireAppMutationUser (verified email + legal acceptance + active account). Reads use requireDbUserId. Consistent pattern.
   Validation
   Zod widely used on web mutations. Some gaps: move-tasks PATCH (manual typeof), subscription/actions POST (string match), tracking endpoints (manual truncation), notifications POST (no allowlist).
   Security
   CSP includes 'unsafe-inline' on script-src in production (apps/web/next.config.js:48-50). Comment acknowledges pending nonce migration. Critical XSS amplifier.
   bcryptjs (pure JS) is 3-5× slower than native bcrypt; doubles login-DoS surface.
   Apple OAuth callback exempt from CSRF (line 117) — required because Apple form-posts cross-site.
   Performance
   Stripe webhook reads webhook secret from runtime config every call (DB roundtrip).
   Several admin routes do findMany + JS aggregation rather than SQL groupBy.
   Accessibility / responsive
   Out of scope for static audit (would need browser testing).
6. Mobile App Findings
   Navigation
   File-based Expo Router; tabs = 5 (index/addresses/moving/services/more); root stack registers (auth), (tabs), onboarding. oauth/outh rely on auto-discovery.
   AuthGuard logic in \_layout.tsx:157-180 is correct: no token → /(auth)/sign-in; token + needsOnboarding → /onboarding; token + completed in (auth) → /(tabs).
   Screens
   27 user-facing screens. All major ones have loading + empty states; most silently swallow API errors.
   API usage
   Shared ApiClient, mobile binds with auth header + x-client-type:mobile. No timeout, no retries.
   State
   Zustand for auth (persisted via SecureStore). React Query for server state. app-store.ts appears unused.
   Validation
   Hand-rolled despite RHF+Zod in deps. Inconsistent localization of error strings.
   Permissions / security
   SecureStore for tokens (good). AsyncStorage for OAuth-handled-codes ledger (acceptable, short-lived). NSFaceIDUsageDescription declared but unused.
   OAuth without PKCE/state.
   Offline
   React Query networkMode: "offlineFirst" for queries; in-memory cache (no AsyncStoragePersister, by design — no PII at rest).
   No NetInfo / offline banner.
   Sentry
   Custom GlitchTip JS reporter; no native crash reporting — would benefit from @sentry/react-native.
   Platform-specific
   iOS associated domains for applinks:locateflow.com etc. set, but OAuth deep-link uses custom scheme.
   Android intent-filters scoped to /blog paths only — good.
   metro.config.js correctly forces single React instance + remaps @locateflow/shared to mobile-safe entry (excludes Node crypto).
   UX consistency with web
   Subscription screen, legal consent, billing constants share @locateflow/shared. ✅
   Web has Zod-validated forms; mobile doesn't. ❌
7. Backend / API Findings
   API design
   Consistent route layout (Next.js App Router). Auth/role/rate-limit/Zod pattern is mostly uniform across web; admin is more variable (~4 of ~70 routes use Zod).
   Filter facets via groupBy + \_count (admin logs, providers) is a nice pattern.
   parsePaginationParams exists in apps/admin/src/lib/pagination.ts; not used in tickets or several others.
   Authentication / authorization
   requirePermission(resource, action, { minimumRole }) is the consistent admin gate.
   settings resource is overloaded — covers feature flags, runtime config, IP rules, GDPR, backups, notifications, help-center, email-templates, waitlist. Granting settings:canUpdate to a moderator unintentionally grants edit across all of these.
   requireAdmin() returns JWT-claim role; requireRole() re-reads from DB. Mixed usage is footgun-prone.
   Validation
   ~30 admin routes use raw await request.json() then body.foo access. SQL injection mitigated by Prisma but mass-assignment risk in update flows.
   Database
   Prisma is parameterized; only two $queryRaw SELECT 1 invocations exist (health endpoints). Safe.
   Indices: see schema findings. Several missing composites for admin filter patterns.
   Cascades: see schema findings. Notable hazards: MovingPlan.fromAddress/toAddress no onDelete; AdminAuditLog.adminUser cascades (compliance issue); Reminder.service cascade on optional FK.
   Error handling
   apps/admin/src/app/api/reports/route.ts:91 — internal e.message leaked to client.
   Webhook routes correctly retry-loop via 503/5xx for retryable errors.
   Logging / audit
   Append-only audit log helper in apps/web/src/lib/audit.ts.
   Admin actions write AdminAuditLog; user actions write AuditLog (mostly unused in apps).
   Refunds and customer.subscription.deleted in Stripe webhook do NOT write a local audit log row. Billing forensic trail incomplete.
   ipAddress collection inconsistent across ~30 routes (varies between x-forwarded-for, x-vercel-forwarded-for, cf-connecting-ip, x-real-ip).
   Background jobs
   12 cron endpoints. Most use verifyInternalAuth. Two use bare === comparisons (timing-oracle inconsistency).
   bill-reminders walks the entire user-base.
   Webhooks
   Four providers, all properly signed. Body-size cap exempts webhooks (DoS surface).
   Email / notifications
   Resend + custom email service. safeEmailError redaction strips API keys. email-service.ts and email.ts have multiple console.error calls — verify they don't log full email body with PII.
   Billing
   See Billing module. MRR amortization bug, multi-sub scope bug, missing refund audit log.
   Data consistency
   Optimistic locking on Subscription, MovingPlan, ServiceProvider. Most other models lack version field — concurrent admin edits silently overwrite.
   Soft-delete extension is opt-in (admin queries see soft-deleted rows).
   Secrets / config
   Runtime config is the strongest module. Stripe webhook secret pulled fresh from runtime config every call (perf + risk surface).
   .env.example, .env.production.example, .env.docker all use REPLACE_ME placeholders — no leaked secrets.
8. Security Review
   CRITICAL

# Issue Evidence Risk Fix

C-1 \_migration-data.json (652 KB) committed packages/db/prisma/\_migration-data.json Possible PII / credential leak in git history Inspect, scrub, rotate any keys, remove from history
C-2 Web CSP 'unsafe-inline' on script-src in production apps/web/next.config.js:48-50 XSS amplification — any HTML injection becomes JS execution Migrate to nonce + strict-dynamic (admin already done)
C-3 Admin login no Zod validation apps/admin/src/app/api/auth/login/route.ts:214 DoS via long bcrypt input; type-confusion exceptions Add Zod schema mirroring web
C-4 Mobile OAuth without PKCE/state apps/mobile/app/(auth)/sign-in.tsx:81-88, sign-up.tsx:84-93 Token theft via custom-scheme hijack on Android Migrate to expo-web-browser openAuthSessionAsync with PKCE + state
C-5 AdminAuditLog.adminUser onDelete: Cascade packages/db/prisma/schema.prisma:1049 Audit trail erased when admin row deleted (compliance) Change to Restrict or SetNull
C-6 MFA backup codes JSON.parse lacks try/catch apps/admin/src/app/api/auth/login/route.ts:296 Corrupted DB row crashes admin login Wrap in try/catch + fallback empty array
C-7 Backup tables hardcoded take: 50000 apps/admin/src/app/api/backup/route.ts:31-115 Silent backup truncation past 50k rows Iterate with cursor pagination
C-8 User-visible typo in security recommendations apps/admin/src/app/api/security/dashboard/route.ts:250 "backuprisma." UX/credibility One-line copy fix
HIGH

# Issue Evidence

H-1 Bare === cron-secret check apps/web/src/app/api/cron/blog-publish/route.ts:21-29, blog-cleanup/route.ts:22-28
H-2 Tracking/notifications POST accept body without Zod apps/web/src/app/api/tracking/{event,session}/route.ts, notifications/route.ts
H-3 OAuth handled-codes stored in AsyncStorage apps/mobile/app/\_layout.tsx:44-58
H-4 Webhook handlers exempt from body-size cap apps/web/src/middleware.ts:115
H-5 bcryptjs (pure-JS) used everywhere apps/web/package.json:29, apps/admin/package.json:25
H-6 Web middleware doesn't enforce session-fingerprint check (only edge JWT verify) apps/web/src/middleware.ts:353-385
H-7 Stripe invoice.payment_succeeded keyed only by customer apps/web/src/app/api/webhooks/stripe/route.ts:577-580
H-8 Mass-assignment in admin help-center PUT apps/admin/src/app/api/help-center/route.ts:93
H-9 Mass-assignment in admin email-templates PUT apps/admin/src/app/api/email-templates/route.ts:162
H-10 Feature flag toggle without step-up apps/admin/src/app/api/feature-flags/route.ts
H-11 grant_premium no max durationDays cap apps/admin/src/app/api/settings/route.ts:252
H-12 Custom-provider sensitive fields plaintext (vs Service.\* encrypted) apps/web/src/app/api/custom-providers/route.ts:140-155
H-13 Encryption uses 16-byte IV, not standard 12; AAD not bound to row context; HMAC and AES share same key packages/shared/src/encryption.ts
H-14 Subscription.purchaseToken plaintext packages/db/prisma/schema.prisma:222
H-15 seed-admin.ts defaults to real-looking email; no NODE_ENV guard packages/db/prisma/seed-admin.ts:10
H-16 Internal endpoints have no IP allowlist apps/admin/src/app/api/internal/{security-event,ip-rules}/route.ts
H-17 CI fallback to known JWT secret strings .github/workflows/ci.yml:152-153
MEDIUM

# Issue Evidence

M-1 Health endpoint leaks memory + env-var names apps/web/src/app/api/health/route.ts:209-214, :192
M-2 seed.ts and seed-state-rules.ts write to dropped Badge model — broken if run packages/db/prisma/seed.ts:9-110, seed-state-rules.ts:86-93
M-3 \_migrate-to-mysql.ts references dropped tables packages/db/prisma/\_migrate-to-mysql.ts:24-38
M-4 PasswordResetToken confirm route is IP-only rate limited apps/web/src/app/api/auth/password/reset/confirm/route.ts:28-35
M-5 IP rule add accepts arbitrary string as IP apps/admin/src/app/api/security/route.ts:47
M-6 Encryption dev fallback to plaintext when NODE_ENV !== production packages/shared/src/encryption.ts:38-43, 64-70
M-7 UserSession.ipAddress / AdminLoginLog.ipAddress raw (vs WaitlistSignup.ipHash) packages/db/prisma/schema.prisma:884-885, 1014, 1444
M-8 requirePasswordConfirm grace window in in-memory Map apps/admin/src/lib/auth.ts:354-398
M-9 Soft-deleted (isActive=false) admins still browse the admin shell until DB-checked route apps/admin/src/middleware.ts:397-403
M-10 Stripe mapStripeStatus falls through to "UNKNOWN" silently apps/web/src/app/api/webhooks/stripe/route.ts:677-689
M-11 Refunds and subscription deletes don't write audit logs apps/web/src/app/api/webhooks/stripe/route.ts
M-12 sentry-redaction.ts regex misses address/PII tokens packages/shared/src/sentry-redaction.ts:22-23
M-13 Mobile transient-5xx logout apps/mobile/src/lib/auth-store.ts:69-71
M-14 Settings test_stripe action lacks step-up apps/admin/src/app/api/settings/route.ts:232
M-15 Notifications sendAt validation is > now+5s only (past dates accepted) apps/admin/src/app/api/notifications/route.ts:97
M-16 applyBodySizeLimit only inspects Content-Length (chunked uploads bypass) apps/admin/src/middleware.ts:218, apps/web/src/middleware.ts
LOW

# Issue Evidence

L-1 AdminLoginLog.ipAddress raw (operator IP exposure) packages/db/prisma/schema.prisma:1014
L-2 MobileOAuthCode.provider plaintext schema 113-114
L-3 ofelia.ini runs cron via wget; verbose stdout might log full URL docker/ofelia.ini
L-4 mysql_native_password plugin pinned (older auth) docker-compose.prod.yml:36
L-5 legacy-sqlite-migrations/ vestige packages/db/prisma/legacy-sqlite-migrations/
L-6 BlogPost.viewCount/shareCount denormalized counters with no trigger sync schema 1523-1524
L-7 intl-helpers.ts cache unbounded packages/shared/src/intl-helpers.ts 9. Dead Code / Unused Code Report
Path Type Why unused Confidence Recommended action
apps/mobile/app/outh.tsx Duplicate Byte-identical to oauth.tsx; typo fallback High Delete once shipped binaries are confirmed safe; replace with router redirect
packages/db/prisma/\_migration-data.json Data dump 652 KB blob, no script imports it High Remove from VCS, scrub history, audit contents
packages/db/prisma/\_migrate-to-mysql.ts Broken script References dropped tables (FamilyMember, Task, MovingBox, Document, Review, Badge, UserBadge, etc.) High Move to archive/ or delete
packages/db/prisma/seed.ts Broken Writes to prisma.badge (dropped) High Delete
packages/db/prisma/seed-state-rules.ts Broken Writes to prisma.badge (dropped) High Delete; logic duplicates seed-master.ts
packages/db/prisma/legacy-sqlite-migrations/ Vestige Single 2026-02 SQLite migration superseded by MySQL baseline High Delete
packages/db/check-admin.mjs Borderline One-line diagnostic; no caller Medium Confirm; delete
packages/shared/src/validators.ts (entire) Dead No imports from apps; web uses its own validators.ts High Delete; merge into web's validators if desired
packages/shared/src/validators.ts taskSchema, reviewSchema, documentUploadSchema Dead+broken Reference dropped models High Delete
packages/shared/src/types.ts Document, Review, Badge, UserBadge interfaces Dead Reference dropped models High Delete
packages/shared/src/constants.ts DOCUMENT_CATEGORIES Dead Refers to dropped Document model High Delete
packages/db/src/soft-delete.ts:18-27 Task, ProviderReview set entries Dead set members Models don't exist High Remove from set
apps/admin/src/app/(admin)/page.tsx:112 void sixtyDaysAgo; Reserved no-op Comment says "for future" High Delete; reintroduce when needed
apps/admin/src/app/api/reports/route.ts:24-86 Stub feature Only type=overview implemented despite type=all accepted Medium Either implement other types or remove the conditional
apps/web/src/app/(app)/help/page.tsx:52-53 Placeholder UI ThumbsUp/ThumbsDown buttons render without handlers High Wire to API or remove
apps/admin/src/app/login/page.tsx:145 Placeholder string Backup-code placeholder "XXXXXXXX" Medium Replace with translation key
Reminder model Likely orphan Only one app reference (apps/web/src/lib/notifications.ts) Medium Confirm, then deprecate
AuditLog model Likely orphan No prisma.auditLog. writes found in apps; admin uses AdminAuditLog Medium Confirm; either populate or drop
app-store.ts (mobile Zustand) Likely unused useAppStore not referenced; onboarding state read from server Medium Confirm via grep; delete
Mobile RHF + Zod packages Declared, unused Not imported by any audited screen Medium Either adopt or remove from package.json
apps/mobile/app.json:25-27 NSFaceIDUsageDescription Unused declaration No expo-local-authentication in code High Remove or implement biometric unlock
TODO/FIXME markers 2 total in apps/ One in apps/admin/src/app/login/page.tsx, one in apps/web/src/lib/blog/preview-token.test.ts High Resolve 10. Testing Gaps
Counts
Web app: ~95 test files (route tests, lib tests, page regression). Plus 2 Playwright e2e specs.
Admin app: 33 test files (route tests, lib tests).
Mobile app: 0 tests.
Shared package: Multiple **tests**/ covering blog/encryption/move-task/provider/recommendation.
Missing tests by module
Critical flows
Admin middleware: only 3 specs (CSP image-src + SW). Missing: JWT verify path, fingerprint mismatch, MFA-setup gate, body-size limit, CSRF check, IP rule blocking.
Web middleware: similar — middleware.test.ts exists but coverage gaps unclear.
Stripe webhook (apps/web/src/app/api/webhooks/stripe/route.test.ts exists) — confirm it covers: invoice.payment_succeeded multi-sub case, charge.refunded with no invoice/sub linkage, retry replay protection.
Backup integrity: no tests for the >50k-row truncation case.
Key rotation: no test for crash-mid-rotation atomicity.
Security tests
Mass-assignment: no negative tests for help-center/email-templates PUT.
IP rule with invalid CIDR string.
Cron secret timing-oracle resistance.
OAuth callback with attacker-controlled state.
Billing tests
MRR amortization with mixed monthly/yearly subs.
acquisitionRedemption PENDING_CHECKOUT → REDEEMED race under concurrent webhooks.
grant_premium boundary (extreme durationDays).
Mobile tests
All categories empty. Recommend at least: API client error handling, auth-store SecureStore round-trip, OAuth deep-link parsing, IAP verify-before-finish.
Web tests
Onboarding wizard: legacy 11+ consent rows lockout case.
Reset-password rate limiting per token hash.
/api/mobile/auth/exchange reachability with no session.
Admin tests
~70 routes, ~16 have route.test.ts — gap is broad: provider-governance, state-rules, moving, notifications, email-templates, help-center, waitlist, analytics, reports, feature-flags, security/dashboard, security/key-rotation, runtime-config, settings, blog/posts/[id]/publish.
CI / e2e
Two Playwright specs (accessibility, public-pages). E2e gates only on push to main. Missing: signed-in flows, billing, subscription cancel/resume, blog preview-token. 11. Architecture and Maintainability Recommendations
Structural improvements
Collapse the parallel type stack. Delete packages/shared/src/types.ts. Either re-export Prisma generated types or define a thin viewmodel/ directory of explicit DTOs that the schema doesn't already cover.
Collapse the parallel validator stack. Delete packages/shared/src/validators.ts. Move web's apps/web/src/lib/validators.ts to packages/shared/src/validators/ so mobile and admin can consume it. This eliminates the mobile RHF gap and the admin "no Zod" gap simultaneously.
Promote string status columns to Prisma enums for Subscription.status/plan/provider/billingInterval/accessType, MovingPlan.status, MoveTask.actionType/status/source/confidence, ServiceProvider.scope, Notification.type/channel, BlogStatus already exists. Land in a follow-up migration.
Centralize a requestMeta() helper that returns { ip, ua, fingerprint } with the same precedence everywhere. Replace ~30 hand-rolled req.headers.get("x-forwarded-for") || "unknown" calls.
Centralize auditLog() writer — a single function that writes both AdminAuditLog and AuditLog consistently, with required fields enforced. Currently each call site re-implements prisma.adminAuditLog.create({...}).
Split the overloaded settings RBAC resource into feature_flags, runtime_config, ip_rules, gdpr, etc.
Shared pagination() helper — parsePaginationParams exists but isn't used by tickets, several admin routes. Apply uniformly.
Better separation of concerns
Move IAP + Stripe webhook handlers to a domain/billing/ layer with pure functions; thin HTTP route + heavy domain logic. The current 700-line route.ts mixes parsing, mapping, DB writes, side effects.
Hoist mobile API client retries/timeouts to the packages/shared/api-client.ts so web and mobile share the resilience policy.
Naming improvements
CANCELED vs CANCELLED inconsistency baked into the schema and constants.ts:50 (CANCELED_MOVING_PLAN_STATUSES = ["CANCELED","CANCELLED"]). Pick one in a one-shot migration, drop normalizeMovingPlanStatus().
User.preferredLocale (10) vs BlogPost.locale (8) vs Profile.preferredLanguage (10) vs WaitlistSignup.locale (10) — pick one width and one column name.
Type safety
(prisma as any).acquisitionCampaign (apps/admin/src/app/api/acquisition-campaigns/route.ts:99) and (admin as any).mfaSecret (apps/admin/src/app/api/auth/login/route.ts:275, 284, 295, 332, 338) suggest stale Prisma client. Re-run prisma generate and remove the casts.
Replace useState<any>, (user: any) in admin pages.
Error handling
Wrap every JSON.parse of DB-stored JSON in try/catch with sensible fallback (MFA backup codes, ServiceProvider.tags, Profile.petTypes).
Don't leak e.message in 500 responses (apps/admin/src/app/api/reports/route.ts:91).
Observability / logging
Adopt @sentry/react-native on mobile so crashes are symbolicated against EAS source maps.
Strip memory._ and env-var hint strings from public /api/health. Provide an authenticated /api/health/internal for ops detail.
Tighten sentry-redaction.ts regex to include address|street|zip|postal|dob|birth|cardNumber|cvv|iban. 12. Prioritized Action Plan
Critical (do this week)
Audit and remove packages/db/prisma/\_migration-data.json from VCS. Scrub history; rotate any keys it might contain.
Web app CSP migration. Replace 'unsafe-inline' on script-src with per-request nonce + strict-dynamic in apps/web/next.config.js:48-50 and middleware (mirror admin).
Migrate mobile OAuth to expo-web-browser openAuthSessionAsync with PKCE + state. Eliminate Linking.openURL for OAuth bootstrap.
Fix AdminAuditLog.adminUser onDelete: Cascade → Restrict or SetNull. New migration.
Add Zod to apps/admin/src/app/api/auth/login/route.ts:214. Length cap on password input.
Fix apps/admin/src/app/api/security/dashboard/route.ts:250 typo "backuprisma.".
Wrap JSON.parse(mfaBackupCodes) in try/catch at apps/admin/src/app/api/auth/login/route.ts:296.
Replace hardcoded take: 50000 in apps/admin/src/app/api/backup/route.ts with cursor pagination; or fail fast and surface the truncation.
Confirm /api/mobile/auth/exchange and /api/acquisition/public-trial-campaign reachability for unauthenticated callers (both should be in PUBLIC_API_PREFIXES if intended).
High (next 2-4 weeks)
Replace bare === cron-secret comparisons in blog-publish and blog-cleanup with verifyInternalAuth(...,"cron").
Tighten Stripe invoice.payment_succeeded scope to (stripeCustomerId, stripeSubscriptionId) (apps/web/src/app/api/webhooks/stripe/route.ts:577-580).
Add audit-log write for Stripe charge.refunded and customer.subscription.deleted.
Fix MRR computation in apps/admin/src/app/(admin)/page.tsx:99 to amortize yearly correctly (or call apps/admin/src/app/api/billing/route.ts:14-24).
Mass-assignment hardening for apps/admin/src/app/api/help-center/route.ts:93 and email-templates/route.ts:162. Use Zod-pick whitelist.
Add Zod to apps/web/src/app/api/tracking/{event,session}/route.ts and notifications/route.ts.
Add explicit content-length cap inside webhook handlers (Stripe/Apple/Play/Resend).
Add durationDays cap to admin grant_premium (apps/admin/src/app/api/settings/route.ts:252).
Step-up requirement for feature-flag toggles.
Encrypt custom-provider sensitive fields (parity with Service._).
Mobile API client: add AbortController timeouts (15-30s) and one retry on network errors. Surface API errors on (tabs) screens.
Migrate bcryptjs → native bcrypt (or argon2id).
Web middleware: standardize IP precedence with rate-limit lib.
Admin middleware-test coverage expansion (JWT, fingerprint, MFA gate, body-size, CSRF, IP block).
CI: remove fallback default JWT secrets in .github/workflows/ci.yml:152-153; fail-fast.
Restore IP allowlist or container-network restriction on /api/internal/_ admin endpoints.
Medium
Strip memory._ and env-var hint strings from public /api/health.
Tighten sentry-redaction.ts PII regex.
requirePasswordConfirm grace window → Redis (multi-instance).
Schema: add MovingPlan.fromAddress/toAddress onDelete: Restrict/SetNull. Add missing composite indices (Notification.expiresAt, AdminAuditLog.action+createdAt, AuditLog.action+createdAt).
Convert string status enums to Prisma enums in a coordinated migration.
Promote moving-admin module to Functional: add cancel/reassign/complete admin actions; raise take: 8 task limit; reject invalid status transitions on admin write paths.
Notifications broadcast: batch createMany in chunks of 5k; gate by max-user-count.
Validate sendAt is in the future, not just > now+5s.
Validate IP/CIDR format on add_ip_rule.
Apply parsePaginationParams uniformly.
Reports: implement remaining types or drop the conditional; don't leak e.message.
Mobile: implement React Hook Form + Zod everywhere (or remove from deps).
Mobile: @sentry/react-native for native crash + symbolicated stacks.
Encryption: bind AAD per row/column; use HKDF for separate signing key; standardize 12-byte IV; add key-id envelope for rotation epochs.
Low
Delete dead code (validators.ts, types.ts dropped types, legacy-sqlite-migrations, \_migrate-to-mysql.ts, seed.ts, seed-state-rules.ts, app-store.ts).
Remove duplicate mobile/app/outh.tsx once shipped binaries no longer hard-code it.
Replace bare confirm() calls with branded modal.
CSV export: use a real escaping util.
RFC-4180 quote handling for users CSV.
Drop NSFaceIDUsageDescription from app.json if not implementing biometric.
Fill eas.json placeholders for iOS submission.
Document the encryption envelope versioning strategy.
Use caching_sha2_password MySQL plugin for new deployments. 13. Open Questions / Needs Verification
These could not be fully verified from code alone — confirm with the team:

/api/mobile/auth/exchange reachability — middleware PUBLIC_API_PREFIXES does not list /api/mobile/. Is there an allow-listing layer not visible in middleware.ts? Or is this a real production gap?
/api/acquisition/public-trial-campaign — same question. Name says "public" but not in allow-list.
audit.ts (apps/web/src/lib/audit.ts) details — confirm append-only shape, hashed IP/UA, and that all admin destructive actions invoke it.
iap-apple.ts — confirm Apple JWS chain is validated against AppleRootCA-G3 with revocation checking.
\_migration-data.json contents — does the file include real PII / Stripe IDs / customer emails?
Subscription.status enum — does Prisma schema's free-string column actually accept all values that mapStripeStatus returns (ACTIVE, TRIALING, EXPIRED, CANCEL_AT_PERIOD_END, TRIAL_CANCELED, INCOMPLETE, PAUSED, UNKNOWN, FREE_ACCESS_EXPIRED)?
Refund audit log expectation — should refunds and subscription deletes write to AdminAuditLog, AuditLog, or a new ops-billing log table?
Feature-flag evaluation API — does evaluation happen in apps/web/src/lib/ somewhere I missed, or is it genuinely missing?
Provider seed scripts (5 of them) — what is the canonical run order? Several skip sanitizeProviderSeedRecords → slug collisions possible.
Reminder and AuditLog models — confirm orphan status. Are these waiting to be wired up, or should they be removed?
Admin password recovery — what's the documented runbook? Add to docs/runbooks/?
OAuth mobileRedirectUri allow-list — is apps/web/src/lib/mobile-oauth.ts:8 the single source of truth, and is it enforced server-side on every callback?
Encryption key rotation — has the documented reEncrypt flow ever been run end-to-end against production? What's the rollback plan?
packages/shared/src/index.mobile.ts divergence from index.ts — is the omission of acquisition.ts and the alias rename of RecommendationUserProfile intentional? Mobile screens reference both indirectly.
Stripe.apiVersion = "2024-06-20" hardcoded — is upgrade tracking owned by anyone?
AcquisitionCampaign.checkoutDisclosureCopy optional — when null, buildCheckoutDisclosureText substitutes a default. The persisted checkoutDisclosureTextHash may not match what the user actually saw — is legal aware?
End of Audit Report. No files were modified. Working tree at end matches pre-audit state (33 entries, all pre-existing in the session's git status snapshot).

# Full System Audit Report

## 1. Executive Summary

- `git pull --ff-only` was attempted first as requested, but Git aborted before updating because existing local mobile changes and untracked files would be overwritten. This audit covers the current checkout on `run/origin-main` at `a3cca27eb483ed5520f197e6d323fbb9d6475a6f`, which is behind `origin/main` by 2 commits.
- Overall system health: the product surface is broad and real: admin, web, mobile, shared packages, Prisma database, billing, webhooks, notifications, support, analytics, backups, and runtime config all exist in code. Core auth, Stripe/App Store/Play webhook structure, and many CRUD flows are more mature than a prototype.
- Biggest risks:
  - Admin RBAC is incomplete and over-broad; many sensitive modules are hidden behind `settings`, while some routes require resources that are not seeded in `ADMIN_RESOURCES`.
  - Admin user detail exposes broad PII/security data to low-privilege admin viewers.
  - Backup coverage is not truthful: “FULL” backups can omit tables and truncate large tables with `take: 50000`.
  - Mobile onboarding appears broken because mobile sends profile fields rejected by the strict web profile validator.
  - Acquisition campaign redemption can race past `maxRedemptions`.
  - Mobile analytics consent semantics are broken because server tracking depends on a web cookie mobile does not send.
- Backend maturity: solid foundations, but inconsistent authorization/resource modeling, incomplete transaction boundaries, and mixed validation quality.
- Web maturity: usable and guarded, but has data consistency gaps, some error-detail leaks, uneven mutation gates, and mobile/web parity issues.
- Mobile maturity: meaningful app surface exists, but current local mobile tree is dirty/unpulled, has no observed tests, contains suspicious OAuth duplicate routes, and has several API contract mismatches.
- Final verification: `git status -sb` still shows the pre-existing dirty mobile/audit files and branch behind 2. No files were intentionally modified, created, formatted, deleted, committed, or installed during this audit.

## 2. Repository Map

- Apps:
  - `apps/admin`: Next.js admin control plane with API routes, RBAC, audit logs, backups, runtime config, security, support, analytics, billing, content, and feature management.
  - `apps/web`: Next.js customer web app and primary backend/API surface for auth, profile, addresses, services, providers, moving plans, budget, tickets, billing, tracking, webhooks, cron, and mobile-facing APIs.
  - `apps/mobile`: Expo/React Native app with Expo Router, auth, onboarding, addresses, services, providers, moving, budget, support, settings, IAP, push, and analytics.
- Packages:
  - `packages/db`: Prisma schema, migrations, seed helpers, database client.
  - `packages/shared`: validators, billing/subscription helpers, acquisition logic, provider utilities, encryption/runtime config helpers, API client, notification/task/domain logic.
- Database:
  - `packages/db/prisma/schema.prisma` contains users, sessions, OAuth, mobile auth codes, subscriptions, acquisition campaigns/redemptions, profiles, addresses, services, moving plans, budgets, providers, governance, audit logs, admin users/sessions/permissions, runtime config, notifications, email, help, feature flags, security, backups, support, waitlist, and blog models.
- Tests:
  - Admin, web, shared, and db test files exist across route handlers and domain helpers.
  - No mobile test files were found in the inspected test inventory.
- Config/deployment:
  - Root workspace config, package scripts, Next/Expo config, Docker assets, GitHub workflows, Sentry/runtime/security config files exist.
- Scripts:
  - Database/seed/build/verification scripts exist through package scripts and package-level tooling.

## 3. Module Map

- Dashboard: `apps/admin/src/app/(admin)/page.tsx`, admin dashboard APIs, Prisma metrics, admin auth; status: implemented but metric reliability depends on underlying modules.
- Users: `apps/admin/src/app/api/users/*`, `apps/web/src/app/api/auth/*`, Prisma `User`, `Profile`, sessions, consents; status: implemented, high PII/RBAC risk.
- Subscriptions/Billing: `apps/admin/src/app/api/subscriptions`, `billing`, `apps/web/src/app/api/stripe/*`, `subscription/*`, `mobile/iap/*`; models `Subscription`, `ProcessedWebhookEvent`; status: implemented, reconciliation/operator workflows incomplete.
- Acquisition Campaigns: `apps/admin/src/app/api/acquisition-campaigns/*`, `apps/web/src/app/api/acquisition/redeem/route.ts`, shared acquisition helpers; models `AcquisitionCampaign`, `AcquisitionRedemption`; status: implemented, concurrency risk.
- Providers: `apps/admin/src/app/api/providers/*`, `apps/web/src/app/api/providers/*`, shared provider helpers; models `ServiceProvider`, `ServiceProviderCoverage`; status: implemented, bulk/admin governance needs hardening.
- Provider Governance: `apps/admin/src/app/api/provider-governance/route.ts`, custom provider matching; models `ProviderGovernanceIssue`, `UserCustomProvider`; status: implemented, weak workflow/audit detail.
- State Rules: `apps/admin/src/app/api/state-rules/*`, shared state logic; model `StateRule`; status: implemented, validation/step-up incomplete.
- Moving Plans: `apps/web/src/app/api/moving/*`, `move-tasks`, admin moving read API; models `MovingPlan`, `MoveTask`; status: implemented, transaction/audit gaps.
- Tickets/Support: `apps/admin/src/app/api/tickets/*`, `apps/web/src/app/api/tickets/*`, admin support pages; models `SupportTicket`, `TicketMessage`; status: implemented, operator workflow incomplete.
- Notifications: `apps/admin/src/app/api/notifications/route.ts`, `apps/web/src/app/api/notifications/*`, push register APIs; models `Notification`, `NotificationPreference`, `PushDevice`; status: implemented, validation and broadcast scalability gaps.
- Email Templates: `apps/admin/src/app/api/email-templates/route.ts`, email sending helpers; models `EmailTemplate`, `EmailLog`; status: implemented, versioning/step-up missing.
- Help Center: `apps/admin/src/app/api/help-center/route.ts`, public help APIs/pages; models `HelpArticle`, `FAQ`; status: implemented, content validation/sanitization needs verification.
- Waitlist: `apps/admin/src/app/api/waitlist/route.ts`, model `WaitlistSignup`; status: implemented, pagination/state modeling weak.
- Analytics/Reports: `apps/admin/src/app/api/analytics/*`, `reports`, web tracking APIs; models `UserSession`, `UserEvent`; status: partially implemented, consent and permission issues.
- Feature Flags: `apps/admin/src/app/api/feature-flags/route.ts`, model `FeatureFlag`; status: implemented, lacks rollout governance.
- Security: `apps/admin/src/app/api/security/*`, middleware/IP rules/GDPR/rate logs; models `IPRule`, `RateLimitLog`, `GDPRRequest`; status: implemented, sensitive mutations under-protected.
- Runtime Config: `apps/admin/src/app/api/runtime-config/route.ts`, `apps/admin/src/lib/runtime-config.ts`, shared runtime config; model `RuntimeConfigEntry`; status: implemented, validation is mostly catalog/non-empty.
- Backups: `apps/admin/src/app/api/backup/*`, `cron/backup`, `backup-tables.ts`; model `BackupRecord`; status: high-risk incomplete.
- Audit Logs: `apps/admin/src/app/api/audit-logs/route.ts`, `writeAdminAudit`, web `AuditLog`; status: implemented, coverage inconsistent.
- Settings: admin profile/team/preferences/security/settings pages; status: implemented, overloaded as a permission bucket.
- Blog/Content: `apps/web/src/app/api/blog/*`, admin blog routes/pages, blog Prisma models; status: implemented, not deeply product-audited beyond map.

## 4. Module-by-Module Findings

### Module: Admin Permissions / RBAC

#### What exists

`apps/admin/src/lib/admin-permissions.ts` defines roles, resource constants, `checkPermission`, `requirePermission`, and helpers. Admin routes call `requirePermission` with resource/action/minimum-role checks.

#### Problems found

- `ADMIN_RESOURCES` omits active modules including `analytics`, `security`, `runtime_config`, `backups`, `notifications`, `email_templates`, `help_center`, `waitlist`, `feature_flags`, `reports`, and `acquisition_campaigns`.
- `apps/admin/src/app/api/analytics/user-spending/route.ts` requires `analytics`, but that resource is not in the resource catalog, so non-super admins cannot be granted it through normal seeding.
- Sensitive routes use broad `settings`: `security/route.ts`, `runtime-config/route.ts`, `backup/route.ts`, `email-templates/route.ts`, `notifications/route.ts`, `help-center/route.ts`, `waitlist/route.ts`, `feature-flags/route.ts`, `reports/route.ts`.
- `apps/admin/src/components/sidebar.tsx` exposes navigation without permission-aware filtering.
- `apps/admin/src/app/(admin)/layout.tsx` only checks `requireAdmin()`, so page access relies mostly on API failures rather than page-level permission UX.

#### Missing or incomplete pieces

Dedicated resources, seed/backfill, route-resource matrix tests, page-level guards, and permission-aware navigation are missing.

#### Dead or suspicious code

No clear dead code, but resource names used by routes are not synchronized with the declared catalog.

#### Security concerns

Over-broad `settings` creates privilege bundling: an admin who can manage general settings may also manage backups, email templates, runtime config, security policy, reports, and flags.

#### Logic/product concerns

The permission model does not match the visible admin product surface.

#### Recommendations

Create a canonical route/module permission matrix, add dedicated resources, backfill permissions, and add tests that fail when a route uses an unknown or over-broad resource.

#### Priority

High

### Module: Users

#### What exists

Admin user listing/detail/update/delete/impersonation/subscription actions exist under `apps/admin/src/app/api/users/*`. Web auth/profile/session APIs exist under `apps/web/src/app/api/auth/*`, `profile`, `account/delete`, and related routes.

#### Problems found

- `apps/admin/src/app/api/users/[id]/route.ts` returns broad PII/security data to any admin with `users canRead` and `VIEWER`: full addresses, profile, services, moving plans, OAuth provider IDs, data consents, token metadata, audit logs, sessions, IPs, user agents, push devices, GDPR requests, and admin notes.
- `apps/admin/src/app/(admin)/users/page.tsx` masks email in UI but CSV export writes raw `user.email`; the browser already receives raw email from the API.
- User PATCH allows subscription/premium/admin-note mutations with limited enum/date validation.
- Session revoke via user detail POST does not require password step-up.
- `apps/web/src/app/api/profile/route.ts` leaks internal error detail in client responses such as auth/update/profile save failure messages.

#### Missing or incomplete pieces

Role-based field views, masking, explicit PII permissions, viewer-safe responses, export permissions, and privacy-focused snapshot tests.

#### Dead or suspicious code

Bulk user self-delete protection compares user id to admin id, which appear to be different identity domains.

#### Security concerns

Sensitive user security and privacy data is exposed too broadly in admin.

#### Logic/product concerns

Viewer/read access is treated as equivalent to incident-response access.

#### Recommendations

Split user detail into `overview`, `security`, `billing`, `support`, and `activity` views; mask sensitive fields by role; require step-up for session revocation and high-risk changes.

#### Priority

Critical

### Module: Subscriptions / Billing

#### What exists

Admin subscription and billing dashboards exist at `apps/admin/src/app/api/subscriptions/route.ts` and `apps/admin/src/app/api/billing/route.ts`. Web Stripe checkout/portal/subscription actions and mobile IAP verification exist.

#### Problems found

- Admin subscription API exposes Stripe/customer/store identifiers to broad subscription readers; UI masks some but API still returns raw data.
- `apps/admin/src/app/api/billing/route.ts` loads broad subscription/user data into memory for metrics.
- Churn calculation uses current active subscription data rather than a true historical starting cohort, so metrics can be misleading.
- Billing is mostly dashboard-level; no failed-payment queue, refund/dispute review, Stripe/IAP reconciliation exception queue, or audit-ready export.

#### Missing or incomplete pieces

Operator workflows for failed payments, refunds, disputes, store reconciliation, campaign exceptions, and billing exports.

#### Dead or suspicious code

No clear dead code found.

#### Security concerns

Raw payment-provider identifiers are overexposed to admin readers.

#### Logic/product concerns

Billing appears operationally incomplete for launch-grade support/finance work.

#### Recommendations

Add billing-specific permissions, identifier masking, reconciliation jobs/queues, and metric definitions backed by tests.

#### Priority

High

### Module: Acquisition Campaigns

#### What exists

Admin campaign CRUD lives in `apps/admin/src/app/api/acquisition-campaigns/*`; web redemption lives in `apps/web/src/app/api/acquisition/redeem/route.ts`; shared logic is in `packages/shared/src/acquisition.ts`.

#### Problems found

- Admin campaign routes use `subscriptions` permission instead of a dedicated acquisition resource.
- Campaign activation/pause/end/delete do not require password step-up.
- `apps/web/src/app/api/acquisition/redeem/route.ts` checks campaign availability before the redemption transaction, then increments count unconditionally; concurrent redemptions can exceed `maxRedemptions`.
- Campaign date validation does not clearly enforce `startsAt < endsAt`.

#### Missing or incomplete pieces

Reservation/conditional update logic, concurrency tests, mobile/IAP campaign policy, and admin step-up for public offer changes.

#### Dead or suspicious code

No clear dead code found.

#### Security concerns

Campaigns can affect billing/trials and should not inherit generic subscription write access.

#### Logic/product concerns

Max-redemption semantics are not reliable under load.

#### Recommendations

Use a transaction with conditional campaign update, add unique/idempotency constraints, introduce `acquisition_campaigns` permission, and require step-up for activation/destructive changes.

#### Priority

High

### Module: Providers

#### What exists

Admin provider CRUD, bulk actions, logo management, and web provider search/detail exist under `apps/admin/src/app/api/providers/*` and `apps/web/src/app/api/providers/*`.

#### Problems found

- Bulk actions such as activate/deactivate/category/score changes mutate many providers with limited validation and no step-up except delete.
- Governance/list APIs use fixed large `take` limits instead of robust pagination.
- Provider logo fetch/import paths are better constrained than arbitrary URL fetches, but remote fetch behavior still needs operational review.

#### Missing or incomplete pieces

Bulk operation preview, stricter validation, rollback/history, and stronger audit details.

#### Dead or suspicious code

No clear dead code found.

#### Security concerns

Bulk provider changes can materially affect customer recommendations without step-up or staged review.

#### Logic/product concerns

Provider quality/governance workflows are only partially operator-ready.

#### Recommendations

Add bulk previews, step-up for high-impact actions, paginated governance review, and provider history.

#### Priority

Medium

### Module: Provider Governance

#### What exists

`apps/admin/src/app/api/provider-governance/route.ts` manages governance issues and custom provider linking/review flows.

#### Problems found

- Admin audit action appears generic/truncated, losing useful action detail.
- Review/dismiss/linking flows do not require step-up.
- Fixed fetch limits reduce reliability for larger datasets.

#### Missing or incomplete pieces

Assignment, reason codes, review states, SLA/aging, and duplicate resolution workflow.

#### Dead or suspicious code

No clear dead code found.

#### Security concerns

Incorrect provider linking can affect user data quality and marketplace recommendations.

#### Logic/product concerns

The module is closer to triage than a mature governance queue.

#### Recommendations

Add explicit workflow states, stronger audit details, pagination, and step-up for linking/merge decisions.

#### Priority

Medium

### Module: State Rules

#### What exists

Admin CRUD exists under `apps/admin/src/app/api/state-rules/*`.

#### Problems found

- State code, category, and effective-date validation is limited.
- Updates do not clearly enforce uniqueness or conflict checks.
- Delete is hard/destructive and does not require step-up.

#### Missing or incomplete pieces

Versioning, effective-date conflict checks, import/export, and rule simulation.

#### Dead or suspicious code

No clear dead code found.

#### Security concerns

Incorrect state rules can mislead users about regulated moving requirements.

#### Logic/product concerns

Rules need stronger lifecycle controls than normal CRUD.

#### Recommendations

Add schema validation, uniqueness tests, versioning, and step-up for destructive changes.

#### Priority

Medium

### Module: Moving Plans / Move Tasks

#### What exists

Web moving plan and task APIs exist under `apps/web/src/app/api/moving/*` and `move-tasks`. Admin has read-oriented moving views/API.

#### Problems found

- Moving plan create performs entitlement/count checks before creation; concurrent creates can bypass limits.
- Some task mutations use `requireDbUserId` rather than the stricter verified/legal app mutation gate.
- Moving plan create/update/delete audit coverage is weaker than task generation/status audit coverage.

#### Missing or incomplete pieces

Transaction-enforced plan limits, fuller audit logs, richer admin intervention tools.

#### Dead or suspicious code

No clear dead code found.

#### Security concerns

Lower than billing/security, but entitlement bypass can affect paid-plan limits.

#### Logic/product concerns

Moving workflows are modeled, but lifecycle observability is incomplete.

#### Recommendations

Move count/entitlement enforcement into transactions, align mutation gates, and add audit logs.

#### Priority

Medium

### Module: Tickets / Support

#### What exists

Web ticket APIs and admin support APIs/pages exist under `apps/web/src/app/api/tickets/*`, `apps/admin/src/app/api/tickets/*`, and admin support pages.

#### Problems found

- Admin assignment accepts arbitrary string/null instead of validating active admin users.
- SLA appears derived/advisory rather than policy-backed.
- User notification on admin reply was not confirmed in inspected route code.
- Web status filtering accepts arbitrary status strings.

#### Missing or incomplete pieces

Assignment validation, escalation policy, SLA configuration, internal reason codes, user notifications, and support analytics.

#### Dead or suspicious code

`apps/admin/src/app/(admin)/tickets/*` redirects to support and appears intentionally retained as a compatibility alias.

#### Security concerns

Support context can contain PII; masking and field-level access should be explicit.

#### Logic/product concerns

Support is usable, but not fully operator-ready.

#### Recommendations

Validate assignees, define SLA states, notify users on replies, and add support permission granularity.

#### Priority

Medium

### Module: Notifications

#### What exists

Admin notification send/list exists at `apps/admin/src/app/api/notifications/route.ts`; user feed/preferences/push register APIs exist under `apps/web/src/app/api/notifications/*` and `push/register`.

#### Problems found

- Admin notifications use `settings` permission.
- Broadcast creates one notification per user and can load broad user sets into memory.
- Admin capabilities report disabled email/push/scheduling/worker behavior, so the control plane overstates the full notification product.
- `apps/web/src/app/api/notifications/preferences/route.ts` fallback path accepts arbitrary preference fields without strong enum validation.

#### Missing or incomplete pieces

Worker-backed delivery, batching, schedule processing, channel-specific permissions, and stronger preference validation.

#### Dead or suspicious code

No clear dead code found.

#### Security concerns

Broadcast is high-impact and should require dedicated permission and step-up.

#### Logic/product concerns

Admin UI suggests richer delivery than currently implemented.

#### Recommendations

Add queued worker delivery, batching, zod preference schemas, and dedicated notification permissions.

#### Priority

High

### Module: Email Templates

#### What exists

Admin email template CRUD exists at `apps/admin/src/app/api/email-templates/route.ts`; email logs/templates exist in Prisma.

#### Problems found

- Routes use `settings` permission.
- PUT can modify/deactivate required transactional templates.
- No version history, rollback, preview approval, or variable compatibility validation.
- Destructive/template-changing actions do not require step-up.

#### Missing or incomplete pieces

Template versioning, staged publish, required-template protections on update, and rendering tests.

#### Dead or suspicious code

No clear dead code found.

#### Security concerns

Transactional templates affect auth, billing, deletion, and support communications.

#### Logic/product concerns

Email template editing is too close to raw CRUD for production operations.

#### Recommendations

Add `email_templates` permission, step-up, variable schema validation, version history, preview, and rollback.

#### Priority

High

### Module: Help Center

#### What exists

Admin help/FAQ route exists at `apps/admin/src/app/api/help-center/route.ts`; public help pages/APIs exist in web.

#### Problems found

- Admin route uses `settings`.
- FAQ creation allows weak/missing question/answer validation.
- Sanitization of rich help content was not fully verified from render path.

#### Missing or incomplete pieces

Content preview, publish workflow, search quality tests, and sanitization tests.

#### Dead or suspicious code

No clear dead code found.

#### Security concerns

Potential stored-content risk if render sanitization is incomplete.

#### Logic/product concerns

Content lifecycle is simple CRUD rather than editorial workflow.

#### Recommendations

Add strict validation, sanitize on render and/or save, add draft/publish review, and test public rendering.

#### Priority

Medium

### Module: Waitlist

#### What exists

Admin waitlist API exists at `apps/admin/src/app/api/waitlist/route.ts`.

#### Problems found

- Uses `settings` permission.
- GET uses fixed `take: 500` style retrieval rather than robust pagination.
- PATCH updates status-like fields without a strongly modeled state machine.
- Audit details can include raw email.

#### Missing or incomplete pieces

Pagination, state transitions, dedupe/merge workflow, export permission, and PII masking.

#### Dead or suspicious code

No clear dead code found.

#### Security concerns

Raw waitlist emails should not be bundled into generic settings access.

#### Logic/product concerns

Waitlist is functional but not mature for high-volume acquisition operations.

#### Recommendations

Add dedicated permission, pagination, state model, masking, and export controls.

#### Priority

Medium

### Module: Analytics / Reports / Tracking

#### What exists

Admin analytics/report APIs exist under `apps/admin/src/app/api/analytics/*` and `reports`; web tracking APIs exist under `apps/web/src/app/api/tracking/*`.

#### Problems found

- `analytics` permission is used but missing from `ADMIN_RESOURCES`.
- Reports use `settings`/`audit_logs` style permissions inconsistently.
- `apps/admin/src/app/api/reports/route.ts` can expose caught error message detail.
- Web tracking requires `cookie_consent=accepted`; mobile bearer-token requests do not send that cookie, disabling mobile analytics.

#### Missing or incomplete pieces

Server-side/mobile consent model, report definitions, export controls, and analytics data quality tests.

#### Dead or suspicious code

No clear dead code found.

#### Security concerns

Analytics may contain behavioral data and needs explicit access and retention controls.

#### Logic/product concerns

Mobile analytics behavior is inconsistent with web and likely silently wrong.

#### Recommendations

Add analytics permission, use server-side consent/device consent, define reports formally, and test mobile tracking consent.

#### Priority

High

### Module: Feature Flags

#### What exists

Admin feature flag CRUD exists at `apps/admin/src/app/api/feature-flags/route.ts`.

#### Problems found

- Uses `settings` permission.
- No strong zod validation for target type/value.
- Toggle/delete do not require step-up.
- No owner, expiry, rollout notes, kill-switch runbook, or history.

#### Missing or incomplete pieces

Rollout governance, audit-rich changes, expiry enforcement, and typed targeting.

#### Dead or suspicious code

No clear dead code found.

#### Security concerns

Feature flags can expose incomplete or privileged behavior if misused.

#### Logic/product concerns

Flags are CRUD records, not a governed rollout system.

#### Recommendations

Add dedicated permission, step-up, targeting validation, owner/expiry/history, and stale flag reports.

#### Priority

High

### Module: Security

#### What exists

Admin security APIs exist under `apps/admin/src/app/api/security/*`; middleware applies CSP/security headers, mutation origin checks, IP rule blocking, session fingerprinting, and SUPER_ADMIN MFA setup gating.

#### Problems found

- `apps/admin/src/app/api/security/route.ts` uses `settings` permission.
- IP rule add/toggle/delete and GDPR status/result mutations do not require step-up.
- IP/CIDR validation is weak; `apps/admin/src/lib/ip-rules.ts` appears to support exact IP matching, while UI/product expectations imply IP/CIDR.
- GDPR result URL/status validation is weak.
- Password confirmation state in `apps/admin/src/lib/auth.ts` is in-memory by admin id, not session/device scoped and not durable across instances.

#### Missing or incomplete pieces

Step-up for all sensitive mutations, strong IP/CIDR parser, GDPR enum/domain validation, incident timeline, and two-person approval for extreme actions.

#### Dead or suspicious code

Typo in dashboard recommendation text was observed but is low-risk.

#### Security concerns

Security controls themselves are administered through an over-broad permission with weak mutation hardening.

#### Logic/product concerns

The security module is useful but not yet a mature incident response console.

#### Recommendations

Create `security` permission, require session-scoped step-up, validate IP/CIDR and GDPR fields, and add tests.

#### Priority

Critical

### Module: Runtime Config

#### What exists

Runtime config APIs and helpers exist at `apps/admin/src/app/api/runtime-config/route.ts`, `apps/admin/src/lib/runtime-config.ts`, and `packages/shared/src/runtime-config.ts`.

#### Problems found

- Uses `settings` permission, though mutation also requires SUPER_ADMIN and step-up.
- Validation mostly confirms catalog membership and non-empty values.
- `lastValidationStatus` can represent configured values rather than live provider connectivity.
- No version history/rollback.

#### Missing or incomplete pieces

Provider-specific validators, connectivity checks, staged rollout, version history, rollback, and stale/failing status.

#### Dead or suspicious code

No clear dead code found.

#### Security concerns

Runtime secrets/config are high-impact; permission model should reflect that separately from settings.

#### Logic/product concerns

The UI may imply stronger validation than actually performed.

#### Recommendations

Add `runtime_config` permission, live validators, version history, and rollback.

#### Priority

High

### Module: Backups

#### What exists

Manual backup, cron backup, import, download, verify, and retention routes exist under `apps/admin/src/app/api/backup/*` and `cron/backup`; table catalog lives in `apps/admin/src/lib/backup-tables.ts`.

#### Problems found

- Manual and cron backups use `findMany({ take: 50000 })` per table; large tables can silently truncate.
- Backup table catalog omits many Prisma models, including mobile OAuth/session/token/security/log/support/waitlist/blog-related tables unless intentionally excluded by undocumented policy.
- Cron backup fetchers drift from the declared catalog; `providerLogoCandidates` is declared but not fetched by cron.
- Manual, cron, import, and verify logic duplicate table registries, creating drift.
- “FULL” can overstate recovery coverage.
- Retention appears focused on metadata; offsite object lifecycle was not confirmed.

#### Missing or incomplete pieces

Schema coverage diff test, cursor pagination, explicit exclusion policy, shared operation registry, restore drills, and truncation failure handling.

#### Dead or suspicious code

Duplicated backup registries are suspicious and already inconsistent.

#### Security concerns

Backups may create false recovery confidence and may mishandle sensitive/excluded data policy.

#### Logic/product concerns

Backup labels do not reliably match restore capability.

#### Recommendations

Centralize backup registry, paginate all tables, test schema coverage, mark exclusions explicitly, and refuse “FULL” when incomplete.

#### Priority

Critical

### Module: Audit Logs

#### What exists

Admin audit and web audit models/routes/helpers exist, including `AdminAuditLog`, `AuditLog`, and `writeAdminAudit`.

#### Problems found

- Audit coverage is inconsistent: strong for some admin/user/billing/security actions, weaker for web budget/moving/profile and some admin content/flag actions.
- Some audit actions are generic/truncated, reducing investigation value.
- Audit log retention and export controls need clearer policy.

#### Missing or incomplete pieces

Route-level audit coverage tests, standardized action taxonomy, retention policy, and sensitive-field redaction tests.

#### Dead or suspicious code

No clear dead code found.

#### Security concerns

Missing audit logs reduce incident response quality.

#### Logic/product concerns

Audit logs should be treated as a cross-cutting contract, not per-route best effort.

#### Recommendations

Define mandatory audit actions per module and add tests for sensitive mutations.

#### Priority

High

## 5. Web App Findings

- Routing/navigation:
  - `apps/web/src/app/(app)/layout.tsx` enforces auth, onboarding, and legal gates.
  - Desktop sidebar exposes more destinations than mobile navigation; mobile omits several sections, making reachability less consistent.
- API integration:
  - Addresses, services, custom providers, moving, budget, tickets, notifications, auth, billing, webhooks, and cron routes exist and generally enforce ownership.
  - `apps/web/src/app/api/budget/route.ts` ignores an `id` query, while mobile calls `/api/budget?id=...`, breaking mobile budget detail behavior.
- Validation:
  - Strong zod usage exists in many routes.
  - Weak spots include notification preference fallback, ticket status filters, profile error responses, report dates, and custom provider plaintext notes.
- Security:
  - Middleware has CSP, security headers, CSRF-style origin/content checks, body-size checks, JWT gating, and rate limiting.
  - `resolveClientIP` trust boundary depends on deployment headers and needs production verification.
  - Rate limiting falls back to in-memory in some paths, weak for multi-instance production.
  - Profile route returns internal error strings to clients.
- Data consistency:
  - Primary address updates are not transactionally enforced and can race.
  - Moving plan count/entitlement checks can race.
  - Acquisition redemption can race.
  - IAP ownership conflict check and upsert should be atomic or explicitly handle unique conflicts.
- Billing/webhooks:
  - Stripe webhook has signature verification, replay window, idempotency, and live/test checks.
  - Play Store webhook verifies OIDC when configured but should also enforce expected service account identity.
  - Stripe reconcile cron should use the same live/test secret guard as checkout/webhook logic.
- UX/state:
  - Many app flows have loading/error handling through React Query/components, but parity is inconsistent across sections.
- Accessibility/responsive:
  - No automated accessibility audit was run. Needs verification through UI tests.

## 6. Mobile App Findings

- Scope caveat:
  - Mobile code is dirty in the working tree, and pull was blocked by those files. Findings reflect the current local mobile code, not upstream `origin/main`.
- Navigation:
  - Expo Router structure exists for tabs, auth, onboarding, addresses, services, providers, moving, budget, help, and settings.
  - `apps/mobile/app/oauth.tsx` and `apps/mobile/app/outh.tsx` both exist untracked; `outh` appears to be a typo/legacy duplicate.
- Authentication:
  - `apps/mobile/src/lib/api.ts` sends bearer token and `x-client-type: mobile`.
  - `apps/mobile/src/lib/auth-store.ts` stores the JWT in SecureStore.
  - `packages/shared/src/api-client.ts` does not await async `onUnauthorized`, so mobile session clearing can race with caller behavior.
- Critical API contract mismatch:
  - `apps/mobile/app/onboarding.tsx` sends fields such as `moveType`, `isBusinessOwner`, `isImmigrant`, and `immigrationStatus`.
  - `apps/web/src/lib/validators.ts` strict `profileSchema` does not accept those fields.
  - `apps/web/src/app/api/profile/route.ts` strips only `legalConsents`.
  - Result: mobile onboarding profile save likely fails validation.
- Settings/profile mismatch:
  - `apps/mobile/app/settings/profile.tsx` includes `ROOMMATES`, but backend family status accepts `SINGLE`, `COUPLE`, `FAMILY`, `OTHER`.
  - Mobile permits empty last name in places where backend requires a non-empty value.
- Analytics:
  - `apps/mobile/src/components/SessionTracker.tsx` and `apps/mobile/src/lib/analytics.ts` call web tracking APIs, but server tracking requires a web `cookie_consent` cookie. Mobile analytics are likely disabled.
- IAP:
  - Mobile IAP paths exist and integrate with web verification. Store/web subscription parity and campaign policy need explicit product decisions.
- Push:
  - Push registration exists, but mobile notification consent/preferences need full end-to-end testing.
- Offline:
  - React Query/offline-first hints exist, but no durable offline queue or persisted cache was confirmed.
- Tests:
  - No mobile tests were found.

## 7. Backend/API Findings

- API design:
  - The backend is split across Next route handlers in admin and web. Shared domain helpers exist, but route-level policy is duplicated in many places.
- Authentication:
  - Admin DB sessions and web JWT/session handling are generally strong.
  - Mobile bearer auth is supported.
- Authorization:
  - Admin authorization is the biggest backend weakness because route resources do not match the actual module surface.
- Validation:
  - Strong in many customer-facing routes; uneven in admin modules, reports, feature flags, security, waitlist, and content.
- Database:
  - Prisma schema is broad and well-modeled, but backup coverage and retention policy do not match schema breadth.
- Transactions:
  - Several limit/availability checks happen before transactions: acquisition redemption, moving plan count, primary address, and some IAP ownership paths.
- Error handling:
  - Some routes leak internal error details, especially web profile and admin reports.
- Logging/audit:
  - Audit logs exist but coverage is inconsistent and action taxonomy is not enforced.
- Background jobs:
  - Cron routes exist, but job model is route-driven rather than centralized with locks, retries, idempotency, and history.
- Webhooks:
  - Stripe and app-store webhook structure is strong; Play Store identity verification should be tightened.
- Secrets/config:
  - Runtime config exists and encrypts secrets, but validation is not true provider readiness.

## 8. Security Review

### Critical

- Issue: Admin user detail exposes excessive PII/security data.
  - Evidence: `apps/admin/src/app/api/users/[id]/route.ts`.
  - Risk: Low-privilege admin viewers can access IPs, user agents, OAuth hints, sessions, addresses, token metadata, GDPR data, and operational history.
  - Recommended fix: Add field-level permissions, masking, role-based views, and tests.

- Issue: Backup system can produce incomplete/truncated “FULL” backups.
  - Evidence: `apps/admin/src/app/api/backup/route.ts`, `apps/admin/src/app/api/cron/backup/route.ts`, `apps/admin/src/lib/backup-tables.ts`, `packages/db/prisma/schema.prisma`.
  - Risk: Restore failure and false recovery confidence.
  - Recommended fix: Cursor pagination, schema coverage tests, explicit exclusions, shared registry.

- Issue: Security module mutations lack sufficient hardening.
  - Evidence: `apps/admin/src/app/api/security/route.ts`, `apps/admin/src/lib/ip-rules.ts`.
  - Risk: Misconfigured IP/GDPR controls can lock out users/admins or expose sensitive workflows.
  - Recommended fix: Dedicated permission, step-up, CIDR/IP validation, GDPR enum/domain validation.

### High

- Issue: Admin permissions are incomplete and over-broad.
  - Evidence: `apps/admin/src/lib/admin-permissions.ts` and multiple routes using `settings`.
  - Risk: Privilege bundling and ungrantable resources.
  - Recommended fix: Dedicated module resources and matrix tests.

- Issue: Mobile onboarding likely fails due API schema mismatch.
  - Evidence: `apps/mobile/app/onboarding.tsx`, `apps/web/src/lib/validators.ts`, `apps/web/src/app/api/profile/route.ts`.
  - Risk: Mobile onboarding blocker.
  - Recommended fix: Align mobile payload and backend schema.

- Issue: Acquisition redemption race.
  - Evidence: `apps/web/src/app/api/acquisition/redeem/route.ts`, `packages/shared/src/acquisition.ts`.
  - Risk: Campaign over-redemption and billing inconsistencies.
  - Recommended fix: Conditional update inside transaction.

- Issue: High-impact admin modules lack step-up/versioning.
  - Evidence: `email-templates/route.ts`, `feature-flags/route.ts`, `notifications/route.ts`, `acquisition-campaigns/*`.
  - Risk: Accidental or malicious production changes.
  - Recommended fix: Step-up, history, rollback, approval where needed.

- Issue: Mobile analytics consent broken.
  - Evidence: `apps/web/src/app/api/tracking/*`, `apps/mobile/src/components/SessionTracker.tsx`.
  - Risk: Analytics either silently absent or consent semantics unclear.
  - Recommended fix: Server/device consent model and mobile consent UI.

### Medium

- Issue: Web profile and reports can leak internal errors.
  - Evidence: `apps/web/src/app/api/profile/route.ts`, `apps/admin/src/app/api/reports/route.ts`.
  - Risk: Information disclosure.
  - Recommended fix: Return generic errors, log detail server-side.

- Issue: Play Store webhook should verify expected service account identity.
  - Evidence: `apps/web/src/app/api/webhooks/playstore/route.ts`.
  - Risk: Misconfigured OIDC audience alone may be insufficient.
  - Recommended fix: Enforce configured issuer/email/emailVerified.

- Issue: Several ownership/limit checks are race-prone.
  - Evidence: addresses, moving, IAP, acquisition routes.
  - Risk: Duplicate primaries, entitlement bypass, ownership conflict edge cases.
  - Recommended fix: Transactions and database constraints.

### Low

- Issue: Duplicate/typo mobile OAuth route.
  - Evidence: `apps/mobile/app/oauth.tsx`, `apps/mobile/app/outh.tsx`.
  - Risk: Confusing route surface.
  - Recommended fix: Remove typo route after confirming no legacy deep link depends on it.

## 9. Dead Code / Unused Code Report

- `apps/mobile/app/outh.tsx`
  - Type: suspicious duplicate route.
  - Why: Appears to duplicate OAuth callback route with typo name; backend default redirect is `locateflow://oauth`.
  - Confidence: Medium.
  - Recommended action: Verify deployed deep-link history, then remove or redirect intentionally.

- `apps/mobile/app/oauth.tsx` and `apps/mobile/app/outh.tsx`
  - Type: duplicated implementation.
  - Why: Both route files reference OAuth callback behavior; duplication increases maintenance risk.
  - Confidence: Medium.
  - Recommended action: Keep one canonical callback route.

- `apps/admin/src/app/(admin)/tickets/*`
  - Type: legacy alias, not dead.
  - Why: Redirects to support routes.
  - Confidence: High.
  - Recommended action: Keep if preserving old links; otherwise document deprecation.

- Backup table registries/fetchers
  - Type: duplicated logic/suspicious drift.
  - Why: Manual and cron backup paths disagree on declared/fetched tables.
  - Confidence: High.
  - Recommended action: Replace with one shared registry.

- Legacy auth/password routes
  - Type: needs verification.
  - Why: Multiple password reset route families appear to coexist.
  - Confidence: Low.
  - Recommended action: Trace clients/emails before deletion.

## 10. Testing Gaps

- Admin:
  - Permission matrix tests for every route/resource/action/minimum role.
  - Field-level PII masking tests for user detail, subscriptions, waitlist, security, support.
  - Backup schema coverage, pagination, cron/manual parity, and restore/import tests.
  - Step-up tests for security, email templates, feature flags, acquisition, notifications.
- Web:
  - Acquisition concurrency test.
  - Primary address race/constraint test.
  - Moving plan entitlement race test.
  - Profile error response test.
  - Notification preference validation test.
  - Tracking consent tests for web and mobile bearer calls.
- Mobile:
  - Onboarding contract test against backend `profileSchema`.
  - Budget detail API contract test.
  - Auth unauthorized/session clearing test.
  - OAuth deep-link test.
  - IAP verification UI/error tests.
  - Push registration/preferences tests.
- Billing/webhooks:
  - Stripe reconcile live/test key guard test.
  - Play Store expected service account verification test.
  - Duplicate receipt/user conflict tests.
- Security:
  - IP/CIDR validation tests.
  - GDPR mutation validation tests.
  - Admin step-up session scoping tests.
- Note: Test commands were not run because many JS test runners can create cache/output files; this audit remained read-only.

## 11. Architecture and Maintainability Recommendations

- Create a central authorization manifest mapping route, module, resource, action, minimum role, step-up requirement, audit requirement, and PII level.
- Replace broad `settings` permissions with dedicated resources for security, runtime config, backups, notifications, email templates, help center, waitlist, reports, feature flags, analytics, billing, and acquisition.
- Centralize backup table operations into one typed registry derived from or checked against Prisma schema.
- Introduce a job abstraction for cron tasks with idempotency, locks, retries, history, and operator-visible status.
- Standardize API validation with zod schemas for admin routes, not just customer routes.
- Define field-level data classification: public, user-owned, admin-operational, PII, security-sensitive, billing-sensitive.
- Add version history and rollback for runtime config, email templates, feature flags, state rules, and provider records.
- Align mobile/web API contracts through shared request/response schemas in `packages/shared`.
- Normalize error handling: generic client errors, structured server logs, audit-safe details.
- Add retention governance for sessions, audit logs, backups, GDPR exports, email logs, push devices, rate-limit logs, and webhooks.

## 12. Prioritized Action Plan

### Critical

- Fix backup truthfulness: shared registry, schema coverage test, cursor pagination, explicit exclusions, and no misleading “FULL” labels.
- Lock down admin user detail with field-level permissions and masking.
- Harden security module mutations with dedicated permissions, step-up, and strict validation.
- Fix mobile onboarding/backend profile schema mismatch.

### High

- Expand admin permission resources and add route authorization matrix tests.
- Fix acquisition campaign redemption concurrency.
- Add mobile-native analytics consent and server-side consent enforcement.
- Add step-up/versioning for email templates, feature flags, notifications, and acquisition campaign lifecycle actions.
- Remove internal error-detail leaks from profile/reports.
- Add billing/reconciliation exception queues and identifier masking.

### Medium

- Add transaction/constraint protection for primary addresses, moving plan limits, and IAP ownership conflicts.
- Improve support assignment/SLA/escalation workflows.
- Add validation for notification preferences, waitlist states, state rules, feature flag targeting, and reports.
- Add provider governance pagination, reason codes, and stronger audit taxonomy.
- Fix mobile budget detail contract.

### Low

- Clean up duplicate/typo mobile OAuth route after verification.
- Improve mobile i18n consistency and hardcoded strings.
- Document legacy redirects and deprecated route aliases.
- Add accessibility and responsive regression checks.

## 13. Open Questions / Needs Verification

- The two upstream commits on `origin/main` were not audited because pull was blocked by existing local changes.
- Which admin roles are intended to see raw PII, IP addresses, OAuth provider hints, full addresses, GDPR payloads, and billing provider IDs?
- Are omitted backup tables intentionally excluded, or accidental gaps?
- Should backups include runtime config, sessions, tokens, webhook events, GDPR requests, support messages, waitlist, and blog content?
- What is the intended mobile analytics consent policy?
- Are acquisition campaigns web/Stripe-only, or should they apply to mobile IAP?
- Should support replies trigger email/push notifications?
- What is the expected source of truth for finance operations: Stripe, app stores, or internal subscription state?
- Are `apps/mobile/app/outh.tsx` and related untracked OAuth files intentional local work or accidental duplicates?
- Should OAuth-only mobile users be able to delete accounts without password confirmation through MFA/backup-code step-up?
- What production proxy/CDN headers are trusted for client IP resolution?
- What retention requirements apply to audit logs, sessions, rate logs, GDPR exports, and backup archives?
