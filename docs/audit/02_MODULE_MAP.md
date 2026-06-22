# 02 — Module Map (LocateFlow monorepo)

> READ-ONLY audit artifact. Evidence is source code grounded in the `_inventory/*.txt`
> files, Glob, and targeted Reads. Audit Status for every module is **in_progress**
> (this map is the seed for deeper per-module passes).

Monorepo shape (from inventory + glob):
- `apps/web` — Next.js 16 App Router consumer web + marketing + public API (172 API routes, 74 pages).
- `apps/admin` — Next.js 16 App Router admin console (126 API routes, 62 pages).
- `apps/mobile` — Expo / React Native (expo-router) app (54 screens).
- `packages/shared` — cross-app domain logic (46 modules), consumed by web/admin at build time and by mobile at runtime.
- `prisma/schema.prisma` — 89 models/enums (single MySQL datastore).

Auth model: custom JWT via `jose` (HS256), httpOnly `user_session` cookie on web, `Authorization: Bearer` on mobile, separate admin session cookie. No next-auth. Edge `middleware.ts` does JWT-signature-only gating; DB-row validation happens in route handlers (`apps/web/src/middleware.ts:575-607`, `apps/web/src/lib/auth.ts:7-23`).

---

## Module: Auth (web/mobile user identity)
- **Purpose**: Sign-in/up, sessions, OAuth (Google/Apple), MFA/TOTP, password reset, email verification, impersonation handoff, mobile token exchange.
- **Related Files**: `apps/web/src/lib/user-auth.ts`, `apps/web/src/lib/auth.ts`, `apps/web/src/lib/user-jwt-secret.ts`, `apps/web/src/lib/totp.ts`, `apps/web/src/lib/login-lockout.ts`, `apps/web/src/lib/password-login.ts`, `apps/web/src/lib/oauth.ts`, `apps/web/src/lib/mobile-oauth.ts`, `apps/web/src/lib/user-step-up.ts`, `apps/web/src/lib/safe-redirect.ts`, `apps/web/src/lib/post-auth-redirect.ts`, `apps/web/src/middleware.ts`; mobile: `apps/mobile/src/lib/auth.ts`, `auth-store.ts`, `apple-auth.ts`, `mobile-oauth.ts`, `mobile-oauth-handoff.ts`, `pkce.ts`, `app-lock-store.ts`, `session-cleanup-hook.ts`.
- **Related Routes**: `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password/[token]`, `/verify-email`, `/verify-email/[token]`, `/account/setup-password`; mobile `(auth)/sign-in|sign-up|forgot-password`, `oauth.tsx`, `reset-password/[token]`, `setup-password.tsx`.
- **Related APIs**: `api/auth/login|logout|register|me|security`, `api/auth/forgot-password|reset-password|resend-verification|verify-email`, `api/auth/password/change|reset/request|reset/confirm`, `api/auth/mfa/setup|confirm|disable`, `api/auth/oauth/{google,apple}/{route,callback}`, `api/auth/oauth/providers`, `api/auth/impersonate-handoff`, `api/mobile/auth/login|exchange|apple/native`.
- **Related Components**: `apps/web/src/components/layout/impersonation-banner.tsx`; mobile `OAuthCallbackScreen.tsx`, `AppLockGate.tsx`, `SessionTracker.tsx`, `EmailVerificationBanner.tsx`.
- **Related State/Store**: mobile `auth-store.ts`, `app-lock-store.ts`; web `hooks/use-current-user.ts`.
- **Related DB Tables/Models**: `User`, `UserSession`, `UserLoginSession`, `OAuthAccount`, `OAuthState`, `MobileOAuthCode`, `PasswordResetToken`, `EmailVerificationToken`, `PushDevice`.
- **Permissions/Roles**: user identity precedes workspace role; `requireDbUserId`/`requireVerifiedUser` gates. MFA optional for users.
- **Dependencies**: `jose`, Prisma, rate-limit, IP rules, email service.
- **Impacted Areas**: every authenticated API/page, mobile, admin impersonation, workspaces.
- **Audit Status**: in_progress

## Module: Admin Auth & RBAC
- **Purpose**: Separate admin login, admin sessions, mandatory MFA for high roles, step-up OTP for destructive actions, trusted devices, login history, set/force-password.
- **Related Files**: `apps/admin/src/lib/auth.ts`, `admin-roles.ts`, `admin-permissions.ts`, `admin-action-otp.ts`, `admin-mfa-trusted-device.ts`, `admin-known-ip.ts`, `admin-invite.ts`, `auth-step-up.ts`, `auth-step-up-store.ts`, `auth-cookie.test.ts`, `page-guard.ts`, `session-fingerprint.test.ts`.
- **Related Routes**: `/login`, `/set-password`, `/set-password/change`, `(admin)/settings/two-factor`, `(admin)/security`, `(admin)/team`.
- **Related APIs**: `api/auth/login|logout|me|password|sessions|set-password|force-password-change|login-history`, `api/auth/mfa/setup|verify|disable|trusted-devices`.
- **Related DB Tables/Models**: `AdminUser`, `AdminSession`, `AdminMfaTrustedDevice`, `AdminLoginLog`, `AdminPermission`, `AdminAuditLog`, `AdminActionOtp`, `AdminSetPasswordToken`.
- **Permissions/Roles**: `SUPER_ADMIN`, `ADMIN`, `MODERATOR`, `VIEWER` (`admin-roles.ts:8`); MFA mandatory for SUPER_ADMIN/ADMIN.
- **Dependencies**: Prisma, TOTP, IP rules, distributed lock.
- **Impacted Areas**: all admin pages/APIs, impersonation, backups, billing ops.
- **Audit Status**: in_progress

## Module: Onboarding
- **Purpose**: First-run guided setup, AI briefing, progress tracking, profile payload assembly.
- **Related Files**: `apps/web/src/lib/onboarding-briefing.ts`, `onboarding-profile-payload.ts`, `onboarding-progress.ts`; mobile `ai-briefing-experience.ts`, `onboarding-data-quality.ts`, `components/onboarding/*`.
- **Related Routes**: web `/onboarding`; mobile `onboarding.tsx`.
- **Related APIs**: `api/onboarding/briefing`, `api/onboarding/progress`.
- **Related Components**: web `components/onboarding/ob-coach.tsx`, `ob-cta.tsx`, `ob-pro-showcase.tsx`; mobile `NotificationPrimingCard.tsx`, `ProShowcaseCard.tsx`, `ObCoach.tsx`.
- **Related DB Tables/Models**: `Profile`, `User` (onboarding flags), `Address`.
- **Permissions/Roles**: authenticated user.
- **Dependencies**: recommendation engine, profile, address validation.
- **Audit Status**: in_progress

## Module: Homepage / Marketing / Public Site
- **Purpose**: Public marketing pages, SEO landing (state/city moving guides), blog, legal pages, pricing, waitlist, lead capture.
- **Related Files**: `apps/web/src/components/marketing/*`, `components/seo/*`, `apps/web/src/lib/seo.ts`, `marketing-cta.ts`, `lib/states/data.ts`, `lib/states/metros.ts`.
- **Related Routes**: `/`, `/about`, `/features`, `/how-it-works`, `/why-free`, `/pricing`, `/faq`, `/help`, `/contact`, `/security`, `/refund`, `/blog`, `/blog/[slug]`, `/blog/category/[slug]`, `/moving/[state]`, `/moving/[state]/[city]`, `/provider-coverage`, plus all legal pages.
- **Related APIs**: `api/waitlist`, `api/leads`, `api/blog/*`, `api/tracking/*`, `api/maps/static`.
- **Related Components**: `marketing-header`, `marketing-footer`, `pricing-section`, `plan-compare-table`, `hero-*`, `waitlist-form`, `social-proof`.
- **Related DB Tables/Models**: `WaitlistSignup`, `Lead`, `BlogPost`, `BlogView`, `UserEvent`.
- **Permissions/Roles**: public (allow-listed in `middleware.ts:26-126`).
- **Dependencies**: SEO lib, blog, analytics, Stripe embedded checkout.
- **Audit Status**: in_progress

## Module: Dashboard
- **Purpose**: Authenticated home — dossier, budget widget, milestone timeline, upcoming bills, route map.
- **Related Files**: `apps/web/src/components/dashboard/*` (home-dossier, dossier-ambient, budget-donut/widget, milestone-timeline, upcoming-bills, route-map-card, stats-card); mobile `HomeDossierCard.tsx`, `MoveCommandCenter.tsx`, `MoveBriefingCard.tsx`, `dashboard-snapshot.ts`, `home-dossier.ts`/`-cache.ts`.
- **Related Routes**: web `/dashboard`; mobile `(tabs)/index.tsx`.
- **Related APIs**: aggregates addresses/budget/moving/notifications APIs; `api/onboarding/briefing`.
- **Related State/Store**: web `store/ui-store.ts`, `hooks/use-*`; mobile dashboard caches.
- **Related DB Tables/Models**: `Address`, `Service`, `Budget`, `MovingPlan`, `MoveTask`, `Reminder`.
- **Permissions/Roles**: authenticated + workspace-scoped.
- **Audit Status**: in_progress

## Module: Profile & User Preferences
- **Purpose**: User profile, locale, UI preferences, appearance.
- **Related Files**: `apps/web/src/lib/user-preferences.ts`, `onboarding-profile-payload.ts`; `components/settings/appearance-card.tsx`, `ui-preferences-card.tsx`; mobile `settings/profile.tsx`.
- **Related Routes**: `/settings/profile`; mobile `settings/profile.tsx`.
- **Related APIs**: `api/profile`, `api/user/locale`, `api/user/preferences`.
- **Related DB Tables/Models**: `Profile`, `User`.
- **Permissions/Roles**: self.
- **Audit Status**: in_progress

## Module: Settings (web/mobile)
- **Purpose**: Settings hub — profile, notifications, privacy, connections, subscription, workspace, address-changes, export.
- **Related Routes**: web `/settings`, `/settings/{profile,notifications,privacy,connections,subscription,workspace,address-changes,export}`; mobile `settings/*` (incl. `two-factor.tsx`, `delete-account.tsx`).
- **Related APIs**: `api/user/preferences`, `api/notifications/preferences`, `api/consent`, `api/connectors/*`, `api/export*`, `api/workspaces/*`.
- **Related Components**: `components/settings/*`, `components/shared/ccpa-opt-out-controls.tsx`, `cookie-consent.tsx`.
- **Related DB Tables/Models**: `NotificationPreference`, `DataConsent`, `Profile`, `Workspace`.
- **Permissions/Roles**: self + workspace role for workspace settings.
- **Audit Status**: in_progress

## Module: Admin Users
- **Purpose**: User list/detail, hard-delete (OTP-gated), impersonate, subscription actions, export.
- **Related Files**: `apps/admin/src/lib/hard-delete-user.ts`, `privacy.ts`; web `lib/impersonation-audit.ts`.
- **Related Routes**: `(admin)/users`, `(admin)/users/[id]`, `(admin)/waitlist`, `(admin)/leads`.
- **Related APIs**: `api/users`, `api/users/[id]`, `api/users/[id]/hard-delete{,/otp}`, `api/users/[id]/impersonate`, `api/users/[id]/subscription-actions`, `api/users/export`, `api/waitlist{,/export}`.
- **Related DB Tables/Models**: `User`, `UserSession`, `Subscription`, `GDPRRequest`, `WaitlistSignup`, `AdminActionOtp`.
- **Permissions/Roles**: admin RBAC; hard-delete/impersonate gated by step-up OTP.
- **Audit Status**: in_progress

## Module: Admin Dashboard / Analytics / Insights
- **Purpose**: Aurora analytics dashboard, intelligence, reports, activity logs, insights.
- **Related Files**: `apps/admin/src/components/aurora/*`, `billing-metrics.ts`, `security-monitor.ts`; web `lib/analytics.ts`, shared `billing-metrics.ts`, `phase1-experiment-analytics.ts`.
- **Related Routes**: `(admin)/` (index), `/analytics`, `/analytics/intelligence`, `/insights`, `/reports`, `/logs`, `/logs/activity`.
- **Related APIs**: `api/analytics/*` (overview, activity-intelligence, admin-activity, user-spending), `api/reports`, `api/logs{,/export}`, `api/insights`.
- **Related DB Tables/Models**: `UserEvent`, `AuditLog`, `AdminAuditLog`, `AdminLoginLog`, `IntegrationDailyStat`, `Subscription`.
- **Permissions/Roles**: admin RBAC.
- **Audit Status**: in_progress

## Module: Payments / Subscriptions (web Stripe)
- **Purpose**: Stripe checkout, billing portal, plan change, cycle switch, webhooks, reconciliation, refunds (admin).
- **Related Files**: `apps/web/src/lib/billing.ts`, `billing-config.ts`, `billing-email-utils.ts`, `shared-billing.ts`, `stripe-api-version.ts`, `stripe-subscription-mapping.ts`, `stripe-subscription-period.ts`, `plan-limits.ts`, `consumer-entitlement.ts`, `request-entitlements.ts`, `global-spend-guard.ts`, `webhook-idempotency.ts`; admin `admin-stripe.ts`, `billing-metrics.ts`; shared `billing.ts`, `entitlement.ts`, `workspace-entitlements.ts`, `monetization-flags.ts`.
- **Related Routes**: `/settings/subscription`, `/pricing`, marketing `embedded-checkout-card`; admin `/billing`, `/subscriptions`, `/plans`.
- **Related APIs**: `api/stripe/checkout{,/cancel}`, `api/stripe/portal`, `api/subscription/actions|change-plan|switch-cycle`, `api/webhooks/stripe`, `api/cron/{stripe-reconcile,checkout-cleanup,trial-check}`; admin `api/subscriptions/*`, `api/billing`.
- **Related DB Tables/Models**: `Subscription`, `ProcessedWebhookEvent`, `AcquisitionCampaign`, `AcquisitionRedemption`.
- **Permissions/Roles**: `billing.manage` = OWNER only (`permissions.ts:82`); admin refund/cancel via RBAC + step-up.
- **Dependencies**: Stripe SDK, entitlement, plan-limits, email.
- **Impacted Areas**: entitlement gates across web/mobile, workspace seats.
- **Audit Status**: in_progress

## Module: Mobile IAP (Apple / Google billing)
- **Purpose**: In-app purchase product catalog, receipt verification, store webhooks, external-billing guard, app-store review flows.
- **Related Files**: `apps/web/src/lib/iap-apple.ts`, `iap-google.ts`, `iap-common.ts`, `mobile-external-billing-guard.ts`, `store-review-account.ts`, `store-links.ts`; mobile `lib/iap.ts`, `iap-offers.ts`, `billing-flags.ts`, `subscription-gate.ts`, `subscription-app-review.ts`, `subscription-visible-plans.ts`.
- **Related Routes**: mobile `settings/subscription.tsx`, `PlanHero.tsx`, `FreeMoveUpsellCard.tsx`.
- **Related APIs**: `api/mobile/iap/products|verify`, `api/webhooks/appstore`, `api/webhooks/playstore`, `api/cron/store-review-accounts`.
- **Related DB Tables/Models**: `Subscription`, `ProcessedWebhookEvent`.
- **Permissions/Roles**: self; external-billing-guard enforces store-compliance.
- **Dependencies**: Apple/Google verification APIs, shared entitlement.
- **Audit Status**: in_progress

## Module: Notifications (in-app feed + queue)
- **Purpose**: In-app notification feed, preferences, queue/dispatch, admin broadcast.
- **Related Files**: `apps/web/src/lib/notifications.ts`, `in-app-notifications.ts`, `notification-feed-client.ts`, `notification-preferences.ts`; admin `notify-dispatch.ts`, `notification-href.ts`.
- **Related Routes**: web `/notifications`, `/settings/notifications`; admin `(admin)/notifications`; mobile `notifications/index.tsx`, `settings/notifications.tsx`.
- **Related APIs**: `api/notifications`, `api/notifications/feed{,/[id]}`, `api/notifications/preferences`; admin `api/notifications`.
- **Related Components**: `components/layout/notification-center.tsx`.
- **Related DB Tables/Models**: `Notification`, `NotificationQueue`, `NotificationPreference`.
- **Permissions/Roles**: self for feed; admin RBAC for broadcast.
- **Audit Status**: in_progress

## Module: Push Notifications (mobile)
- **Purpose**: Device registration, push token storage, mobile push delivery.
- **Related Files**: mobile `lib/push.ts`; web `api/push/register`.
- **Related APIs**: `api/push/register`.
- **Related DB Tables/Models**: `PushDevice`.
- **Permissions/Roles**: authenticated user.
- **Dependencies**: Expo push, notification queue.
- **Audit Status**: in_progress

## Module: Email (transactional + templates)
- **Purpose**: Transactional email, templates, logs, health, Resend webhook, unsubscribe, digests.
- **Related Files**: `apps/web/src/lib/email.ts`, `email-service.ts`, `resend-webhook.ts`, `unsubscribe.ts`, `unsubscribe-actions.ts`, `daily-digest.ts`, `daily-digest-config.ts`, `admin-digest-config.ts`, `billing-email-utils.ts`; admin `email.ts`, `email-template-sanitizer.ts`; shared `email-html-sanitizer.ts`.
- **Related Routes**: web `/unsubscribe`; admin `(admin)/email-templates`.
- **Related APIs**: `api/webhooks/resend`, `api/unsubscribe`; admin `api/email-templates`, `api/email-health`; cron `api/cron/{daily-digest,weekly-digest,admin-daily-digest,monthly-report,admin-monthly-report}`.
- **Related DB Tables/Models**: `EmailTemplate`, `EmailLog`, `NotificationPreference`.
- **Permissions/Roles**: system/cron; admin RBAC for templates.
- **Audit Status**: in_progress

## Module: Providers / Connectors (partner integrations)
- **Purpose**: Connector registry/runtime, OAuth partner consents, dispatch, fallbacks, webhooks, address-change propagation.
- **Related Files**: `apps/web/src/lib/connector-registry.ts`, `connector-runtime.ts`, `connector-oauth.ts`, `guided-connector-actions.ts`, `fallback-actions.ts`, `partner-consent-refresh.ts`, `integration-telemetry.ts`; admin `integration-status.ts`, `connector-metrics.ts`.
- **Related Routes**: web `/settings/connections`; admin `(admin)/connectors`, `/connectors/[connectorKey]`, `/connector-fallbacks`, `/connector-metrics`; mobile `settings/connections.tsx`.
- **Related APIs**: `api/connectors/catalog|changes`, `api/connectors/[key]/webhook`, `api/connector-dispatch`, `api/partner-consents{,/[id]}`, `api/partner-consents/oauth/{initiate,callback}`, `api/cron/{connector-dispatch,partner-consents/[id]/refresh}`; admin `api/connectors/*`, `api/connector-fallbacks`.
- **Related DB Tables/Models**: `ConnectorConfig`, `ConnectorDispatch`, `ConnectorFallbackAction`, `PartnerConsent`, `AddressChangeEvent`.
- **Permissions/Roles**: `connector.connect`/`connector.revokeOwn` (OWNER/ADMIN/MEMBER) — personal consents (`permissions.ts:163-165`).
- **Audit Status**: in_progress

## Module: Addresses & Validation
- **Purpose**: Address CRUD, autocomplete, USPS/geocode validation, dossier/PDF, coordinate backfill.
- **Related Files**: `apps/web/src/lib/address-autocomplete.ts`, `address-autocomplete-selection.ts`, `shared-address-autocomplete.ts`, `address-data-cache.ts`, `usps-address-validation.ts`, `moving-address-validation.ts`, `census-geocoder.ts`; shared `address-autocomplete.ts`, `address-validation.ts`; mobile `address-autocomplete.ts`.
- **Related Routes**: web `/addresses`, `/addresses/new`, `/addresses/[id]{,/edit}`; mobile `addresses/*`, `(tabs)/addresses.tsx`.
- **Related APIs**: `api/addresses{,/[id]}`, `api/addresses/validate`, `api/addresses/[id]/dossier{,/pdf}`, `api/address-autocomplete{,/details}`, `api/cron/backfill-address-coords`.
- **Related Components**: `components/address/address-autocomplete-input.tsx`; mobile `AddressesMap.tsx`, `TransitRouteMap.tsx`, `address-autocomplete-field.tsx`.
- **Related DB Tables/Models**: `Address`, `AddressDataCacheEntry`, `AddressChangeEvent`.
- **Permissions/Roles**: workspace `address.*` matrix (`permissions.ts:107-145`).
- **Audit Status**: in_progress

## Module: Moving / Tasks
- **Purpose**: Moving plan, move tasks/checklist, migration, reminders, at-risk tracking.
- **Related Files**: `apps/web/src/lib/move-task-generation.ts`, `move-task-sync.ts`, `move-task-local-effects.ts`, `checklist-template-map.ts`, `reminder-timezone.ts`; shared `move-task-lifecycle.ts`, `move-task-local-effect.ts`, `move-transition-classifier.ts`, `relocation-checklist.ts`, `shared-relocation.ts`, `migration-engine.ts`.
- **Related Routes**: web `/moving`, `/moving/new`, `/moving/plan/[id]`; admin `(admin)/moving`, `/moving/[id]`, `/moving/at-risk`; mobile `moving/[id]`, `moving/new`, `(tabs)/moving.tsx`, `reminders/index.tsx`.
- **Related APIs**: `api/moving{,/[id]}`, `api/moving/migration`, `api/move-tasks`, `api/cron/{move-reminders,move-week-alerts,task-reminders,contract-reminders}`; admin `api/moving{,/[id]}`, `api/moving/at-risk`.
- **Related DB Tables/Models**: `MovingPlan`, `MoveTask`, `Reminder`, `StateRule`.
- **Permissions/Roles**: workspace mutation matrix; `syncAttempt.complete`.
- **Audit Status**: in_progress

## Module: Budget / Expenses
- **Purpose**: Monthly budget planning, actuals snapshot, expenses view, tax export.
- **Related Files**: `apps/web/src/lib/budget-planning.ts`, `budget-actuals-snapshot.ts`, `tax-report-data.ts`; shared `budget-planning.ts`.
- **Related Routes**: web `/budget`, `/budget/[month]`, `/expenses`; mobile `budget/index`, `budget/[id]`, `budget/new`.
- **Related APIs**: `api/budget`, `api/budget/actuals`, `api/export{,/pdf}`.
- **Related Components**: `components/dashboard/budget-donut.tsx`, `budget-widget.tsx`, `upcoming-bills.tsx`.
- **Related DB Tables/Models**: `Budget`, `Service`, `ServiceCostLog`.
- **Permissions/Roles**: `budget.view` (not CHILD), `budget.manage` (OWNER/ADMIN/MEMBER) (`permissions.ts:117-134`).
- **Audit Status**: in_progress

## Module: Services
- **Purpose**: User service CRUD (utilities/subscriptions), cost logs, sensitive-field visibility, duplicate guard.
- **Related Files**: `apps/web/src/lib/service-active.ts`, `service-duplicate-guard.ts`, `service-sensitive-fields.ts`, `service-visibility.ts`, `service-provider-logo-enrichment.ts`; mobile `service-insights.ts`, `service-logo.ts`, `semantic-status.ts`.
- **Related Routes**: web `/services`, `/services/new`, `/services/[id]{,/edit}`; mobile `services/*`, `(tabs)/services.tsx`.
- **Related APIs**: `api/services{,/[id]}`, `api/vehicles/decode`.
- **Related Components**: `components/services/service-logo-mark.tsx`; mobile `ServicesMoodBoard.tsx`, `ServiceLogoMark.tsx`.
- **Related DB Tables/Models**: `Service`, `ServiceCostLog`.
- **Permissions/Roles**: `service.*` matrix incl. sensitive-field gating (`permissions.ts:112-145`).
- **Audit Status**: in_progress

## Module: External Data Integrations (gov/utility data)
- **Purpose**: Enrichment from public datasets (EPA, FEMA, FCC, Census, NCES, NHTSA, NWS, HUD, AirNow, electric utility, alt-fuel).
- **Related Files**: `apps/web/src/lib/{airnow,census-acs,census-geocoder,epa-radon,epa-walkability,epa-water,fcc-isp,fema-flood,fema-nri,hud-housing,nces-district,nces-schools,nhtsa,nlr-alt-fuel-stations,nws-weather,electric-utility}.ts`, `http-download.ts`; shared `isp.ts`.
- **Related Routes**: surfaced in address dossier, provider pages, vehicle check.
- **Related APIs**: `api/addresses/[id]/dossier`, `api/vehicles/decode`, `api/maps/static`.
- **Related DB Tables/Models**: `AddressDataCacheEntry`.
- **Permissions/Roles**: authenticated; cached/rate-limited.
- **Audit Status**: in_progress

## Module: Partners / Affiliate / Movers
- **Purpose**: Affiliate clicks/conversions/postbacks, sponsored placements, mover applications + portal, partner portal + ledger/invoices, lead dispatch.
- **Related Files**: `apps/web/src/lib/movers.ts`, `mover-portal-auth.ts`, `partner-portal-auth.ts`, `sponsored-provider.ts`, `community-popularity.ts`; admin `fmcsa.ts`; shared `mover-portal.ts`.
- **Related Routes**: web `/movers/apply`, `/movers/portal{,/dashboard,/placements}`, `/partners/apply`, `/partners/portal`; admin `(admin)/movers{,/applications}`, `/partners`, `/affiliate`, `/sponsored`, `/acquisition-campaigns`.
- **Related APIs**: `api/affiliate/click`, `api/affiliate/postback/[network]`, `api/sponsored/click`, `api/movers/*`, `api/partners/*`, `api/leads`, `api/acquisition/*`, `api/cron/lead-dispatch`; admin `api/affiliate/*`, `api/movers/*`, `api/partners/*`, `api/sponsored/*`, `api/acquisition-campaigns/*`.
- **Related DB Tables/Models**: `AffiliateClick`, `AffiliateConversion`, `SponsoredPlacement`, `MovingCompany`, `Lead`, `LeadDispatch`, `Partner`, `PartnerDocument`, `PartnerPortalToken`, `PartnerLedgerEntry`, `PartnerInvoice`, `MoverApplication`, `MoverDocument`, `MoverPortalToken`, `AcquisitionCampaign`, `AcquisitionRedemption`.
- **Permissions/Roles**: passwordless portal tokens (mover/partner); admin RBAC.
- **Audit Status**: in_progress

## Module: Service Providers Catalog (admin-managed)
- **Purpose**: Provider catalog, coverage, governance/quality, logos, recommendations, custom providers.
- **Related Files**: `apps/web/src/lib/provider-matching.ts`, `provider-serviceability.ts`, `provider-empty-state.ts`, `sponsored-provider.ts`, `custom-provider-duplicate-guard.ts`, `logo-url.ts`; admin `logo-fetcher.ts`, `logo-ingest.ts`, `provider-logo-auto-fetch.ts`, `recommendation-engine.ts`; shared `provider-brand.ts`, `provider-coverage.ts`, `provider-integrity.ts`, `provider-move-domain.ts`, `provider-quality-report.ts`, `recommendation-engine.ts`.
- **Related Routes**: web `/providers{,/[id]}`; admin `(admin)/providers/*`, `/provider-governance`, `/provider-quality`; mobile `providers/*`, `custom-providers/*`.
- **Related APIs**: `api/providers{,/[id]}`, `api/providers/{compare,popular,saved,revalidate}`, `api/providers/recommendations{,/feedback}`, `api/custom-providers{,/[id]}`, `api/state-rules`; admin `api/providers/*`, `api/provider-governance/*`, `api/provider-quality`, `api/state-rules/*`.
- **Related DB Tables/Models**: `ServiceProvider`, `ServiceProviderCoverage`, `ProviderGovernanceIssue`, `ProviderLogoCandidate`, `SavedProvider`, `RecommendationFeedback`, `UserCustomProvider`, `StateRule`.
- **Permissions/Roles**: public read; admin RBAC for management.
- **Audit Status**: in_progress

## Module: Workspaces / Permissions (multi-tenancy)
- **Purpose**: Workspace CRUD, members, invitations, roles, ownership transfer, seat/entitlement, data scoping, managed sync, step-up.
- **Related Files**: `apps/web/src/lib/workspace-context.ts`, `workspace-data-scope.ts`, `workspace-invitations.ts`, `workspace-invite-accept.ts`, `workspace-ownership.ts`, `workspace-provisioning.ts`, `workspace-routes.ts`, `workspace-step-up.ts`, `workspace-audit.ts`; shared `permissions.ts`, `workspace-entitlements.ts`; mobile `workspace-invite.ts`, `workspace-selection.ts`.
- **Related Routes**: web `/settings/workspace`, `/invitations/[token]`; admin `(admin)/workspaces{,/[id]}`; mobile `settings/workspace.tsx`, `workspace/accept-invite.tsx`, `invitations/[token].tsx`.
- **Related APIs**: `api/workspaces{,/[id]}`, `api/workspaces/[id]/{rename,delete,restore,sync,transfer,managed-sync,members,invitations}`, `api/invitations/*`; admin `api/workspaces/*`.
- **Related DB Tables/Models**: `Workspace`, `WorkspaceMember`, `WorkspaceInvitation`, `WorkspaceAuthChallenge`.
- **Permissions/Roles**: `can()` matrix — OWNER/ADMIN/MEMBER/CHILD/VIEW_ONLY (`permissions.ts:73-170`).
- **Impacted Areas**: every data-bearing module (data scoping).
- **Audit Status**: in_progress

## Module: Database / Data Layer
- **Purpose**: Prisma client, schema compat, encryption-at-rest, pagination, retention, key rotation.
- **Related Files**: `apps/web/src/lib/db.ts`, `db-schema-compat.ts`, `pagination.ts`, `shared-encryption.ts`, `user-event-retention.ts`; admin `db.ts`, `key-rotation-fields.ts`, `backup-tables.ts`; shared `encryption.ts`.
- **Related Routes**: n/a (infra).
- **Related APIs**: all data routes; `api/cron/data-retention`.
- **Related DB Tables/Models**: all 89 models.
- **Permissions/Roles**: enforced at route/lib layer (not DB).
- **Audit Status**: in_progress

## Module: Theme / Design System
- **Purpose**: Canonical design tokens (colors/typography/spacing/radii/shadows), theming, dark mode.
- **Related Files**: `packages/shared/src/design-tokens.ts`; mobile `lib/theme.ts`, `tailwind.config.ts`, `ThemeSelector.tsx`; web `styles/globals.css`, `next-themes`; admin `app/aurora.css`, `components/theme-provider.tsx`, `theme-toggle.tsx`.
- **Related Components**: `components/marketing/landing-theme-toggle.tsx`, `components/settings/appearance-card.tsx`; mobile `ThemeSelector.tsx`.
- **Permissions/Roles**: n/a.
- **Note**: tokens are manually mirrored into web `globals.css` and admin `aurora.css` (only mobile consumes the TS file at runtime) — `design-tokens.ts:14-24`. See finding module-map-01.
- **Audit Status**: in_progress

## Module: Shared UI Components
- **Purpose**: Reusable primitives per app.
- **Related Files**: web `components/shared/*`, `components/illustrations/*`, `components/premium/*`; admin `components/*` (data-table-page, command-palette, quick-drawer, confirm-dialog, empty-state); mobile `components/ui/*` (Button, Card, Input, Badge, Skeleton, EmptyState, etc.).
- **Note**: confirm-dialog, empty-state, language-selector, service-logo-mark exist independently in web + admin + mobile (parallel implementations). See finding module-map-02.
- **Audit Status**: in_progress

## Module: Navigation & Layout
- **Purpose**: App shell, sidebar, header, mobile nav, admin topbar/sidebar/sub-nav, global search, command palette, tab/stack routing.
- **Related Files**: web `components/layout/*` (app-shell, sidebar, header, mobile-nav, global-search, notification-center, impersonation-banner, pending-invitations-banner); admin `components/{sidebar,topbar,sub-nav,command-palette,admin-page-header,admin-navigation-fallback}.tsx`, `lib/admin-nav.ts`; mobile `app/(tabs)/_layout.tsx`, `app/_layout.tsx`, `(auth)/_layout.tsx`, `blog/_layout.tsx`.
- **Related Routes**: route-group layouts `(app)`, `(admin)`, `(auth)`, `(tabs)`.
- **Audit Status**: in_progress

## Module: Analytics / Feature Flags / Experiments
- **Purpose**: Event tracking, sampling/retention, feature flags, kill switches, runtime config, experiments.
- **Related Files**: `apps/web/src/lib/analytics.ts`, `feature-flags.ts`, `kill-switches.ts`, `runtime-config.ts`, `shared-runtime-config.ts`, `user-event-sampling.ts`, `user-event-retention.ts`, `production-readiness.ts`; admin `runtime-config.ts`, `security-readiness.ts`; shared `runtime-config.ts`, `ux-experiments.ts`, `phase1-experiment-analytics.ts`, `monetization-flags.ts`; mobile `analytics.ts`, `release-config.ts`.
- **Related Routes**: admin `(admin)/feature-flags`, `/runtime-config`.
- **Related APIs**: `api/tracking/event|session`; admin `api/feature-flags`, `api/runtime-config`.
- **Related DB Tables/Models**: `UserEvent`, `FeatureFlag`, `RuntimeConfigEntry`.
- **Audit Status**: in_progress

## Module: SEO
- **Purpose**: Metadata, canonical, noindex on staging/app routes, JSON-LD, IndexNow, sitemaps.
- **Related Files**: `apps/web/src/lib/seo.ts`, `public-ai-discovery.ts`; `components/seo/{json-ld,site-schemas}.tsx`; `middleware.ts` (`pathShouldNoIndex`, `applyStagingNoIndex`).
- **Related APIs**: `api/blog/indexnow-key/[key]`, `api/blog/revalidate`, `api/providers/revalidate`.
- **Audit Status**: in_progress

## Module: i18n / Localization
- **Purpose**: en/es locales, locale auto-detect, zod error i18n, intl helpers.
- **Related Files**: web `i18n/{config,request}.ts`, `i18n/messages/{en,es}.json`, `lib/zod-i18n.ts`; admin `i18n/config.ts`, `lib/admin-nav-i18n.test.ts`; shared `intl-helpers.ts`; mobile `i18n/config.ts`, `components/ui/LanguageSelector.tsx`.
- **Related APIs**: `api/user/locale`.
- **Audit Status**: in_progress

## Module: Forms / Validation
- **Purpose**: Form schemas/validators across auth, services, addresses, applications, leads.
- **Related Files**: `apps/web/src/lib/validators.ts`, `zod-i18n.ts`; shared `validators.ts`; component forms (`moving-quote-form`, `service-quote-form`, `mover-apply-form`, `partner-apply-form`, `waitlist-form`).
- **Audit Status**: in_progress

## Module: Tables / Data Grids (admin)
- **Purpose**: Admin data tables — query, pagination, column visibility, saved views, bulk selection, CSV export safety.
- **Related Files**: admin `components/{data-table-page,column-settings-menu,saved-views-menu,ministat-strip}.tsx`, `hooks/{use-table-query,use-bulk-selection,use-column-visibility,use-saved-views}.ts`, `lib/{pagination,csv-safety}.ts`; web `lib/pagination.ts`; shared `audit-redaction.ts`.
- **Audit Status**: in_progress

## Module: Modals / Dialogs / Drawers
- **Purpose**: Confirm dialogs, cancel-survey, delete-account, reveal, quick-drawer, password-confirm.
- **Related Files**: web `components/shared/confirm-dialog.tsx`, `components/settings/{cancel-survey-modal,delete-account-dialog}.tsx`, `components/premium/reveal-modal.tsx`; admin `confirm-dialog.tsx`, `quick-drawer.tsx`, `password-confirm-modal.tsx`.
- **Audit Status**: in_progress

## Module: Error Handling / Reliability
- **Purpose**: Error boundaries, logging, Sentry, health/readiness, synthetic/uptime monitoring, offline.
- **Related Files**: `apps/web/src/lib/logger.ts`, `sentry.ts`, `sentry-options.ts`, `production-readiness.ts`; shared `sentry-redaction.ts`; mobile `ErrorBoundary.tsx`, `sentry.ts`, `OfflineChip.tsx`, `offline-cache.ts`; admin `sentry-options.ts`, `rate-limit-health.ts`.
- **Related Routes**: web `/offline`; mobile `+not-found.tsx`.
- **Related APIs**: `api/health`, `api/ready`, `api/build-info`, `api/cron/{synthetic-monitor,uptime-check}`; admin `api/health`, `api/healthz`, `api/ready`.
- **Audit Status**: in_progress

## Module: Security & Abuse Controls
- **Purpose**: Rate limiting, IP rules, CSRF, CSP/security headers, login lockout, security events/alerts, step-up.
- **Related Files**: `apps/web/src/lib/rate-limit.ts`, `rate-limit-policy.ts`, `ip-rules.ts`, `client-ip.ts`, `login-lockout.ts`, `security-events.ts`, `security-alerts.ts`, `security-alert-sink.ts`, `user-security-audit.ts`, `internal-secrets.ts`, `cron-guard.ts`; admin `security-monitor.ts`, `ip-rules.ts`, `internal-secrets.ts`; shared `trusted-client-ip.ts`; `middleware.ts` (web + admin).
- **Related Routes**: admin `(admin)/security{,/dashboard}`, `/settings/two-factor`.
- **Related APIs**: `api/internal/{impersonate,ip-rules,rate-limit-log}`; admin `api/security/*`, `api/internal/{ip-rules,security-event}`.
- **Related DB Tables/Models**: `IPRule`, `RateLimitLog`, `AuditLog`, `AdminAuditLog`.
- **Audit Status**: in_progress

## Module: Background Jobs / Cron
- **Purpose**: Scheduled jobs — digests, reminders, reconciliation, dispatch, retention, backups, monitoring, QA reset.
- **Related Files**: `apps/web/src/lib/cron-guard.ts`, `qa-account.ts`, `store-review-account.ts`; admin `backup-job.ts`, `distributed-lock.ts`, `backup-lock.ts`.
- **Related APIs**: web `api/cron/*` (~29 routes incl. admin-daily-digest, bill-reminders, blog-publish, connector-dispatch, data-retention, lead-dispatch, lifecycle-nudges, move-reminders, provider-stats, stripe-reconcile, synthetic-monitor, trial-check, workspace-purge, qa-account-reset, scheduled-delivery); admin `api/cron/{backup,blog-image-cleanup}`.
- **Permissions/Roles**: `CRON_SECRET`/`INTERNAL_WEBHOOK_SECRET` via `cron-guard.ts`; middleware pre-limit keyed by credential hash.
- **Audit Status**: in_progress

## Module: Legal / Consent / Privacy / GDPR / CCPA
- **Purpose**: Legal acceptance, consent, CCPA opt-out, data export/deletion, GDPR requests, data retention.
- **Related Files**: `apps/web/src/lib/legal.ts`, `legal-acceptance.ts`, `legal-info.ts`, `consent.ts`, `ccpa.ts`, `tracking-consent.ts`, `account-deletion.ts`; shared `legal.ts`; admin `privacy.ts`; mobile `legal.ts`, `account-deletion-confirmation.ts`, `LegalConsentPanel.tsx`.
- **Related Routes**: web `/account/delete`, `/data-deletion`, `/ccpa-privacy-notice`, `/settings/privacy`, `/settings/export`, legal pages; mobile `settings/{privacy,delete-account,export}.tsx`.
- **Related APIs**: `api/account/{delete,restore}`, `api/consent{,/ccpa}`, `api/legal/acceptance`, `api/export{,/pdf}`, `api/cron/data-retention`.
- **Related DB Tables/Models**: `DataConsent`, `GDPRRequest`, `LegalAcceptance` (via legal lib).
- **Audit Status**: in_progress

## Module: Blog / CMS (admin-authored)
- **Purpose**: Blog authoring (admin), publishing, revisions, categories/tags, preview tokens, public rendering, view tracking, IndexNow.
- **Related Files**: admin `blog-content.ts`, `blog-uploads.ts`, `blog-revalidate.ts`, `components/blog/*`; web `components/blog/*`, `components/seo/*`.
- **Related Routes**: web `/blog`, `/blog/[slug]`, `/blog/category/[slug]`, `/blog/preview/[token]`; admin `(admin)/blog/*`.
- **Related APIs**: web `api/blog/{posts,posts/[slug],image,view,revalidate,indexnow-key/[key]}`; admin `api/blog/*`; cron `api/cron/{blog-publish,blog-cleanup}`, admin `api/cron/blog-image-cleanup`.
- **Related DB Tables/Models**: `BlogPost`, `BlogCategory`, `BlogTag`, `BlogPostTag`, `BlogRevision`, `BlogView`.
- **Permissions/Roles**: admin RBAC.
- **Audit Status**: in_progress

## Module: Support / Help / Tickets
- **Purpose**: Support tickets, help center/articles/FAQ, feedback.
- **Related Files**: `apps/web/src/lib/help-content.ts`, `help-fallback.ts`; admin `help-center` page/api.
- **Related Routes**: web `/support`, `/support/[id]`, `/help`; admin `(admin)/support{,/[id]}`, `/tickets{,/[id]}`, `/help-center`; mobile `help/index.tsx`, `help/tickets{,/[id]}.tsx`.
- **Related APIs**: web `api/tickets{,/[id]}`, `api/help{,/feedback}`; admin `api/tickets{,/[id]}`, `api/help-center`.
- **Related DB Tables/Models**: `SupportTicket`, `TicketMessage`, `HelpArticle`, `FAQ`.
- **Audit Status**: in_progress

## Module: Backups & Data Ops (admin)
- **Purpose**: Backups, SQL dump, import/restore, verification, retention, GDrive.
- **Related Files**: admin `backup-job.ts`, `backup-archive.ts`, `backup-gdrive.ts`, `backup-storage.ts`, `backup-metadata.ts`, `backup-policy.ts`, `backup-restore-guard.ts`, `backup-tables.ts`, `backup-lock.ts`, `backup-audit.ts`, `r2-asset-storage.ts`.
- **Related Routes**: admin `(admin)/backups`.
- **Related APIs**: admin `api/backup{,/[id]/download,/import,/retention,/sql-dump,/verify}`, `api/cron/backup`.
- **Related DB Tables/Models**: `BackupRecord`.
- **Permissions/Roles**: SUPER_ADMIN + step-up.
- **Audit Status**: in_progress

---

## Cross-cutting structural findings

### module-map-01 — Design tokens duplicated by manual sync across three surfaces (Architecture, Medium)
`packages/shared/src/design-tokens.ts:14-24` documents that web (`globals.css`) and admin (`aurora.css`) keep **their own hand-maintained copies** of the same numeric values; only mobile consumes the TS file at runtime. Any token change requires three manual edits with no compile-time link, risking visual drift between web/admin/mobile.

### module-map-02 — Recommendation engine implemented three times (Architecture/Dead Code, Medium)
A `recommendation-engine.ts` exists in `packages/shared/src`, `apps/web/src/lib`, and `apps/mobile/src/lib` (plus admin `recommendation-engine.ts`). Parallel implementations of the same capability risk divergent ranking logic between web, mobile, and the shared package. Needs verification whether web/mobile delegate to shared or fork it.

### module-map-03 — Same-named UI primitives forked per app (Architecture, Low)
`confirm-dialog`, `empty-state`, `language-selector`, `service-logo-mark` exist independently in web, admin, and mobile component trees with no shared package. Acceptable across the web/native boundary, but web↔admin duplication is a maintenance cost.

### module-map-04 — Auth gating split between edge middleware (signature-only) and route handlers (DB validation) (Architecture/Security, Low/needs-verification)
`apps/web/src/middleware.ts:575-607` verifies only the JWT signature at the edge; DB-row checks (session active, expiry, fingerprint) run inside handlers via `requireDbUserId`/`getUserSession`. Any route that forgets the handler-level check would be protected only by signature validity (revoked/expired sessions could pass). Per-route verification needed in later passes.

### module-map-05 — Public route allow-list is large and manually maintained (Security, Low/needs-verification)
`middleware.ts:26-126` hand-lists ~40 public page paths plus API exact/prefix/GET allow-lists. `matchesPathOrChild` makes a listed prefix expose all children (e.g. `/api/help`, `/api/movers/portal/`). Each entry warrants per-route confirmation that no sensitive child path is unintentionally public.
