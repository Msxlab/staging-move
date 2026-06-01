# Sistem Modul Audit Raporlari

Bu klasor, `SYSTEM_MODULE_AUDIT_TASKLIST_TR.md` sirasiyla yapilan modul incelemelerinin dosyalanmis halidir.

## Web

- [WEB-01 Public/Marketing/Legal/SEO](WEB-01-public-marketing-legal-seo.md)
- [WEB-02 Auth/Session/MFA/OAuth](WEB-02-auth-session-mfa-oauth.md)
- [WEB-03 Onboarding/Profile/Preferences](WEB-03-onboarding-profile-preferences.md)
- [WEB-04 Billing/Subscription/Trial/Campaign/IAP](WEB-04-billing-subscription-trial-campaign-iap.md)
- [WEB-05 Workspace/Members/Invitations](WEB-05-workspace-members-invitations.md)
- [WEB-06 Address Management](WEB-06-address-management.md)
- [WEB-07 Services](WEB-07-services.md)
- [WEB-08 Moving Plans/Move Tasks](WEB-08-moving-plans-move-tasks.md)
- [WEB-09 Providers/Recommendations/Custom Providers](WEB-09-providers-recommendations-custom-providers.md)
- [WEB-10 Partner Consents/Connectors](WEB-10-partner-consents-connectors.md)
- [WEB-11 Budget/Expenses/Reports](WEB-11-budget-expenses-reports.md)
- [WEB-12 Notifications/Email/Push/Unsubscribe](WEB-12-notifications-email-push-unsubscribe.md)
- [WEB-13 Support/Help/Tickets](WEB-13-support-help-tickets.md)
- [WEB-14 Privacy/Consent/Export/Account Deletion](WEB-14-privacy-consent-export-account-deletion.md)
- [WEB-15 Cron/Health/Internal Ops](WEB-15-cron-health-internal-ops.md)

## Client

- [CLIENT-01 App Shell/Auth/Session](CLIENT-01-app-shell-auth-session.md)
- [CLIENT-02 Mobile Onboarding/Profile](CLIENT-02-mobile-onboarding-profile.md)
- [CLIENT-03 Mobile Billing/IAP](CLIENT-03-mobile-billing-iap.md)
- [CLIENT-04 Mobile Moving/Tasks](CLIENT-04-mobile-moving-tasks.md)
- [CLIENT-05 Mobile Services/Providers](CLIENT-05-mobile-services-providers.md)
- [CLIENT-06 Mobile Notifications/Push](CLIENT-06-mobile-notifications-push.md)
- [CLIENT-07 Mobile Offline/Error UX](CLIENT-07-mobile-offline-error-ux.md)
- [CLIENT-08 Mobile Privacy/Deletion](CLIENT-08-mobile-privacy-deletion.md)

## Admin

- [ADMIN-01 Admin Auth/RBAC/Audit](ADMIN-01-admin-auth-rbac-audit.md)
- [ADMIN-02 Admin Dashboard/Health](ADMIN-02-admin-dashboard-health.md)
- [ADMIN-03 Admin Users/Accounts](ADMIN-03-admin-users-accounts.md)
- [ADMIN-04 Admin Billing/Entitlements](ADMIN-04-admin-billing-entitlements.md)
- [ADMIN-05 Admin Workspaces](ADMIN-05-admin-workspaces.md)
- [ADMIN-06 Admin Content/Blog/SEO](ADMIN-06-admin-content-blog-seo.md)
- [ADMIN-07 Admin Providers/Connectors](ADMIN-07-admin-providers-connectors.md)
- [ADMIN-08 Admin Support/Tickets](ADMIN-08-admin-support-tickets.md)
- [ADMIN-09 Admin Notifications/Email](ADMIN-09-admin-notifications-email.md)
- [ADMIN-10 Admin Privacy/Data Ops](ADMIN-10-admin-privacy-data-ops.md)
- [ADMIN-11 Admin Config/Feature Flags](ADMIN-11-admin-config-feature-flags.md)

## Core

- [CORE-01 Shared Package](CORE-01-shared-package.md)
- [CORE-02 DB/Prisma/Migrations](CORE-02-db-prisma-migrations.md)
- [CORE-03 Connectors Package](CORE-03-connectors-package.md)
- [CORE-04 Tooling/CI/Env](CORE-04-tooling-ci-env.md)
- [CORE-05 Cross-Module E2E/Threat Model](CORE-05-cross-module-e2e-threat-model.md)

## En Kritik Takip Basliklari

1. Authenticated browser E2E kapsami public smoke test seviyesinden cikmali.
2. Billing lifecycle icin `PENDING_CHECKOUT -> paid/webhook -> entitlement -> cleanup/reconcile` uctan uca kanitlanmali.
3. Scheduler parity saglanmali: Vercel cron ve Ofelia job listeleri ayni operasyonel guvenceleri vermeli.
4. Tenant izolasyonu user/workspace/adres/service/budget/move/task seviyesinde DB-backed test edilmeli.
5. Account deletion/export/backup/restore icin gercek veri grafigiyle drill yapilmali.
6. Connector consent/dispatch/submitted/verify/revoke akisi tek senaryoda test edilmeli.
