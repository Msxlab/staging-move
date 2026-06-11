# Sistem Haritası

## 1. Proje Özeti

- Uygulama: **LocateFlow**
- Amaç: Kullanıcıların adresleri, adreslere bağlı servis/provider kayıtları, taşınma planları, görevler, bütçeler, notification preferences, exportlar ve abonelik durumlarını yönetmesi.
- Hedef kullanıcı: Taşınan bireyler, household/family kullanıcıları, birden fazla adres yöneten Pro kullanıcılar, support/admin operatörleri.
- Ana iş modeli: Free access/free trial + paid subscription. Web tarafında Stripe, mobile tarafında App Store / Google Play IAP.
- Web yapı: `apps/web` Next.js App Router.
- Admin yapı: `apps/admin` Next.js App Router.
- Mobil yapı: `apps/mobile` Expo Router / React Native.
- Backend/API: Web ve admin Next.js route handlers.
- Database: `packages/db/prisma/schema.prisma` içinde Prisma + MySQL.

## 2. Teknoloji Yığını

- Frontend framework: Next.js 16, React 19, Tailwind CSS.
- Backend framework: Next.js Route Handlers, Prisma.
- Mobile framework: Expo SDK 55, React Native 0.83, expo-router.
- Database: MySQL via Prisma 5.
- Auth sistemi: Custom user auth; JWT + DB session; admin için ayrı JWT/DB session/MFA/permission sistemi.
- Payment sistemi: Stripe web checkout/portal/webhook, mobile IAP verify, App Store / Play Store webhookları.
- Notification sistemi: Email via Resend/logging, in-app notifications, Expo push; SMS kanal tipi var ama provider implementasyonu yok.
- Hosting/deployment: Docker, scripts ve deployment dokümanları mevcut; kesin provider bu audit kapsamında koddan netleştirilmedi.
- Third-party servisler: Stripe, Resend, Sentry, Upstash/Redis rate limit, Expo push, Apple/Google IAP, connector partner APIs.
- State management: Web tarafında React Query/Zustand, mobile tarafında React Query + local stores.
- API yaklaşımı: File-based REST-like route handlers.
- Test araçları: Vitest, Playwright, Testing Library, mobile Jest/test utils.

## 3. Klasör ve Dosya Yapısı

- `apps/web`: Public marketing, authenticated app pages, web API routes, middleware, user auth, billing, notification, export ve connector runtime.
- `apps/admin`: Admin panel pages, admin API routes, admin auth/permissions, runtime config, security, billing, content, provider governance.
- `apps/mobile`: Expo mobile app, auth screens, tab navigation, settings, subscription, IAP, push, local auth/session helpers.
- `packages/db`: Prisma schema, migrations, seed scripts, DB client package.
- `packages/shared`: Shared billing, entitlement, validators, provider/category helpers.
- `packages/connectors`: External address connector framework and USPS adapter surface.
- `docs`: Current implementation docs, deployment env inventory, roadmap and design docs.
- `reports`: Previous audit/report outputs.
- `scripts`: Verification, provider audit, migration, billing sync, seed and operational scripts.

## 4. Ana Modüller

| Modül | Amacı | Ana dosyalar | Bağlı modüller | Risk |
|---|---|---|---|---|
| Auth | User login/register/session/MFA/password/email verify | `apps/web/src/lib/user-auth.ts`, `apps/web/src/middleware.ts`, `apps/web/src/app/api/auth/*` | User, DB, email, mobile auth | Medium |
| Admin Auth | Admin session, MFA, permissions, IP rules | `apps/admin/src/lib/auth.ts`, `apps/admin/src/middleware.ts` | Admin DB, audit logs, IP rules | Medium |
| Billing | Stripe checkout, portal, webhook, subscription plan state | `apps/web/src/app/api/stripe/*`, `apps/web/src/app/api/webhooks/stripe/route.ts`, `apps/web/src/lib/billing.ts` | Subscription DB, plans, email, workspaces | High |
| Mobile IAP | Store purchases and receipt verification | `apps/mobile/src/lib/iap.ts`, `apps/web/src/app/api/mobile/iap/*`, appstore/playstore webhooks | Subscription, mobile UI, Apple/Google | High |
| Addresses | User/workspace address CRUD and service relations | `apps/web/src/app/api/addresses/*`, mobile address screens, Prisma `Address` | Services, moving, connectors | Medium |
| Services | Provider/custom provider tracking and reminders | `apps/web/src/app/api/services/*`, `Service` model | Address, provider, reminders, notification | Medium |
| Moving | Moving plans and generated move tasks | `apps/web/src/app/api/moving/*`, `MoveTask`, `MovingPlan` | Address, task sync, state rules | Medium |
| Budget | Budget CRUD and reports | `apps/web/src/app/api/budget/*`, `Budget` model | Address, export, mobile | Low |
| Notifications | Email, in-app, push preferences/feed | `apps/web/src/lib/notifications.ts`, `in-app-notifications.ts`, `/api/notifications/*`, cron routes | User, service, task, move, Resend, Expo | High |
| Connectors | Address change fanout/guided/API sync | `apps/web/src/lib/connector-runtime.ts`, `/api/connectors/*`, `/api/connector-dispatch` | Partner consent, workspace, provider | High |
| Workspaces | Household/team sharing and role scoping | `Workspace`, `WorkspaceMember`, `/api/workspaces/*` | Auth, billing seats, addresses/services | High |
| Admin Panel | Operational user/provider/billing/support/content control | `apps/admin/src/app/*`, `apps/admin/src/app/api/*` | All backend data | High |
| Export/Privacy | CSV/JSON/PDF export, account deletion/restoration, GDPR/CCPA | `/api/export`, `/api/export/pdf`, `/api/account/*`, `GDPRRequest` | User data, subscription, audit | High |

## 5. Kullanıcı Rolleri

- Guest: Public pages, pricing, FAQ, help, provider public endpoints, auth initiation.
- User/Customer: Own addresses, services, moving plans, budgets, notifications, exports, support tickets, subscription settings.
- Workspace owner/admin/member/child/view-only: Workspace-scoped records with role-based action checks in `workspace-data-scope.ts`.
- Admin: Admin panel access; permission-specific API actions through `requirePermission`.
- Super admin / sensitive admin: MFA setup gate and password confirmation required for sensitive operations.
- Vendor/seller/provider: Direct provider portal rolü bulunmadı; provider data admin/user-managed catalog olarak işleniyor.

## 6. Ana Kullanıcı Akışları

- Kayıt olma ve email verification.
- Login/logout/session refresh; mobile auth exchange; OAuth/Apple flows.
- Address CRUD, service CRUD, custom provider CRUD.
- Moving plan creation and task generation/sync.
- Notification preferences, feed read/unread, push device registration.
- Web checkout, portal, plan change/switch cycle.
- Mobile Individual subscription purchase/restore via IAP.
- Export: CSV/JSON/PDF with step-up verification.
- Workspace invite/member/transfer/sync flows.
- Admin user, provider, billing, content, security, runtime config, support operations.

## 7. Sistem Sınırları

- Sistem içinde: address/service/task/budget/subscription/workspace/support/content/admin data, reminders, exports, notification feed.
- Sistem dışında: gerçek provider hesaplarındaki nihai adres güncellemesi, USPS/partner API anlaşmaları, App Store/Google Play billing authority, Resend/Expo/Stripe deliverability.
- Dış servislere bağlı alanlar: Stripe, Apple/Google IAP, Resend, Expo push, Sentry, Upstash/Redis, connector partner APIs.
