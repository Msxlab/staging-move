# Database ve Data Flow Denetimi

## Database Özeti

Database Prisma + MySQL olarak yapılandırılmıştır. Ana schema: `packages/db/prisma/schema.prisma`.

## Ana Model Grupları

- User/Auth: `User`, `PushDevice`, `OAuthAccount`, `MobileOAuthCode`, `UserLoginSession`, `OAuthState`, `PasswordResetToken`, `EmailVerificationToken`, `DataConsent`
- Billing: `Subscription`, `AcquisitionCampaign`, `AcquisitionRedemption`, `ProcessedWebhookEvent`
- Product data: `Profile`, `Address`, `Service`, `MovingPlan`, `Budget`, `Reminder`, `MoveTask`, `StateRule`, `ServiceProvider`, `UserCustomProvider`
- Admin: `AdminUser`, `AdminSession`, `AdminLoginLog`, `AdminPermission`, `AdminAuditLog`, `RuntimeConfigEntry`, `IPRule`, `RateLimitLog`
- Notifications: `NotificationPreference`, `Notification`, `NotificationQueue`, `EmailTemplate`, `EmailLog`
- Support/content: `SupportTicket`, `TicketMessage`, `HelpArticle`, `FAQ`, `BlogPost`, `BlogCategory`, `BlogTag`, `BlogRevision`, `BlogView`
- Connectors/workspaces: `PartnerConsent`, `ConnectorConfig`, `ConnectorDispatch`, `AddressChangeEvent`, `ConnectorFallbackAction`, `Workspace`, `WorkspaceMember`, `WorkspaceInvitation`, `WorkspaceAuthChallenge`

## Data Flow: User Session

### Oluştuğu Yer
Login/register/mobile auth route'ları.

### İşlendiği Yer
`apps/web/src/lib/user-auth.ts`, middleware, mobile auth exchange.

### Kaydedildiği Yer
`UserLoginSession`, cookies/JWT.

### Okunduğu Yer
`requireDbUserId`, `getUserSession`, mobile API requests.

### Gösterildiği Yer
Profile/settings/dashboard.

### Riskler
Public allowlist regression. Session DB validation route seviyesinde olduğu için yeni route'ların helper kullanması şart.

### Öneriler
Route generator veya lint rule ile protected routes helper kullanımını zorunlu kıl.

## Data Flow: Subscription

### Oluştuğu Yer
Stripe checkout, mobile IAP verify, store webhooks.

### İşlendiği Yer
Stripe webhook route, IAP common helpers, subscription action routes.

### Kaydedildiği Yer
`Subscription`.

### Okunduğu Yer
Profile, plan limits, entitlement, mobile subscription UI, admin billing.

### Riskler
Webhook idempotency global marker sonda; store/web plan authority ayrımı dikkat ister.

### Öneriler
Atomic event reservation ve reconciliation smoke tests.

## Data Flow: Service

### Oluştuğu Yer
Web/mobile service create/update screens.

### İşlendiği Yer
`/api/services`, `/api/services/[id]`, duplicate guard, sensitive field encryption.

### Kaydedildiği Yer
`Service`.

### Okunduğu Yer
Dashboard, services list/detail, budget, provider recommendations, moving task sync.

### Silindiği/Arşivlendiği Yer
Soft delete: `deletedAt`, `isActive=false`, `deactivatedAt`.

### Riskler
Documents relation promised ama DB modeli yok.

### Öneriler
Document feature contract netleştir.

## Data Flow: Notification

### Oluştuğu Yer
Cron reminder routes, Stripe webhook, connector runtime, app actions.

### İşlendiği Yer
`sendNotification`, `createInAppNotification`, notification preferences.

### Kaydedildiği Yer
`Notification`, `NotificationQueue`, `EmailLog`, `PushDevice`.

### Okunduğu Yer
`/api/notifications/feed`, web/mobile notification screens.

### Riskler
In-app dedupe JSON contains; no unique dedupeKey.

### Öneriler
Normalize dedupe key and indexes.

## Data Flow: Connector Address Change

### Oluştuğu Yer
Settings connections/address change actions, workspace sync.

### İşlendiği Yer
`connector-runtime.ts`, connector registry, connector dispatch cron/webhook.

### Kaydedildiği Yer
`PartnerConsent`, `AddressChangeEvent`, `ConnectorDispatch`, `ConnectorConfig`.

### Okunduğu Yer
Settings address changes, admin connectors, connector health.

### Riskler
Product copy automatic update overstates current runtime conditions.

### Öneriler
Tie copy to connector mode/capability.

## Data Flow: Export/PDF

### Oluştuğu Yer
Settings export web/mobile.

### İşlendiği Yer
`/api/export`, `/api/export/pdf`, PDF generators.

### Kaydedildiği Yer
Export result not persisted as file in current route; generated response.

### Riskler
Large account export could become long-running.

### Öneriler
Async export job for large accounts if needed.

## Database Bulguları

| ID | Bulgu | Öncelik | Kanıt |
|---|---|---|---|
| AUD-001 | Document modeli yok ama documents copy/UI var | P1 | Schema + service detail |
| AUD-004 | ProcessedWebhookEvent marker status yok | P2 | `ProcessedWebhookEvent` simple id/source/time |
| AUD-005 | Notification dedupeKey normalized değil | P2 | `Notification` model |
| AUD-012 | Cron batch/queue ihtiyacı | P2 | Reminder route patterns |

## Önerilen Index/Constraint İyileştirmeleri

1. `Notification`: nullable `dedupeKey` + unique `(userId, channel, dedupeKey)`.
2. `ProcessedWebhookEvent`: `status`, `startedAt`, `processedAt`, `attempts`, `lastError`.
3. Cron-heavy date scans için `Service.billingDay`, `Service.contractEndDate`, `MoveTask.dueDate`, `MovingPlan.moveDate` indexlerinin production query plans ile doğrulanması.
4. Document feature gelirse `Document(userId, serviceId, deletedAt, createdAt)` indexes ve storage key uniqueness.
