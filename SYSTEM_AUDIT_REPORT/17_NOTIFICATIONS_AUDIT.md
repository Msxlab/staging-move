# Notifications Denetimi

## Notification Sistem Özeti

Notification sistemi email, in-app ve push kanallarını destekliyor. SMS kanal tipi kodda geçiyor ancak provider implementasyonu yok. Preferences web/mobile yüzeylerde yönetiliyor.

## Notification: Task Reminder

- Trigger: `/api/cron/task-reminders`
- Kime gider: Task sahibi.
- Ne zaman gider: Due date pencereleri.
- Kanal: Email, in-app, push.
- Template/Data: Task title, due date, moving plan.
- Backend logic: `sendNotification`, `createInAppNotification`.
- UI gösterimi: Notification feed.
- User preference dikkate alınıyor mu: Evet.
- Risk: Batch/test standardı ve in-app dedupe.
- Öneri: Concurrent dedupe test.

## Notification: Bill Reminder

- Trigger: `/api/cron/bill-reminders`
- Kime gider: Service sahibi.
- Kanal: Email, in-app, push.
- Risk: Büyük service setlerinde batch sınırı ve duplicate dedupe.
- Öneri: Cursor/batch runner.

## Notification: Bill Overdue

- Trigger: `/api/cron/bill-overdue`
- Kanal: Email, in-app, push.
- Risk: Duplicate notification if dedupe race.
- Öneri: DB unique dedupe.

## Notification: Contract Reminder

- Trigger: `/api/cron/contract-reminders`
- Kanal: Email, in-app, push.
- Risk: Adjacent route test eksikliği.

## Notification: Move Reminder

- Trigger: `/api/cron/move-reminders`
- Kanal: Email, in-app, push.
- Risk: Locale/timezone standardization.

## Notification: Billing Events

- Trigger: Stripe webhook.
- Kanal: Email, in-app/billing notification depending event.
- Risk: Webhook idempotency marker sonda.

## Notification: Connector Action Needed

- Trigger: Connector dispatch needs user/manual fallback.
- Kanal: In-app/email depending prefs.
- Risk: Product copy automation expectation yüksekse fallback user surprise yaratır.

## Notification Preferences

- Web: `apps/web/src/lib/notification-preferences.ts`
- Mobile endpoint: `/api/notifications/preferences`
- Push device registration: `/api/push/register`, `apps/mobile/src/lib/push.ts`

## Read/Unread

- `Notification` model `read`, `readAt`.
- Feed route kullanıcıya scoped read/list yapıyor.

## Bulgular

| ID | Bulgu | Öncelik | Kanıt |
|---|---|---|---|
| AUD-005 | In-app dedupe JSON contains, unique yok | P2 | `in-app-notifications.ts` |
| AUD-006 | Cron tests/batch standardı eksik | P2 | Cron route inventory |
| AUD-010 | Push/SMS delivery availability belirsiz | P2 | `notifications.ts`, mobile checklist |

## Öneriler

1. `Notification.dedupeKey` normalize et.
2. Push/SMS availability admin health + user UI disable state.
3. Cron notification route'ları için duplicate, preference, push disabled, email disabled tests.
4. Delivery failure retry/outbox stratejisini `NotificationQueue` ile hizala.
