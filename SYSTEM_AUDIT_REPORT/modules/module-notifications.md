# Modül Denetimi: Notifications

## 1. Modülün Amacı
Email, in-app, push ve placeholder SMS bildirimlerini yönetmek.

## 2. Ana Dosyalar
- `apps/web/src/lib/notifications.ts`
- `apps/web/src/lib/in-app-notifications.ts`
- `apps/web/src/lib/notification-preferences.ts`
- `apps/web/src/app/api/notifications/*`
- `apps/web/src/app/api/push/register/route.ts`
- `apps/web/src/app/api/cron/*reminders*/route.ts`
- `apps/mobile/src/lib/push.ts`

## 3. Bağlantılar
User, service, move task, Stripe, connectors, Resend, Expo push.

## 4. Veri Akışı
Trigger -> preferences -> channel delivery -> Notification/EmailLog/PushDevice -> feed/UI.

## 5. UI/UX Denetimi
Preference screens var. Channel availability push/SMS için daha net olmalı.

## 6. API/Backend Denetimi
Feed/read/preferences/register routes auth-scoped. Cron routes `guardCronRequest` ile korunur.

## 7. Database Denetimi
`NotificationPreference`, `Notification`, `NotificationQueue`, `EmailLog`, `PushDevice`.

## 8. Permission/Auth Denetimi
Feed userId scoped; push register user scoped.

## 9. Edge Case Denetimi
Push disabled env, device unregistered, duplicate cron, preference off senaryoları testlenmeli.

## 10. Hata/Eksik/Yanlış Listesi
- AUD-005: In-app dedupe unique değil.
- AUD-006: Cron batch/test standardı tutarsız.
- AUD-010: SMS provider yok, push readiness belirsiz.

## 11. Mantık Hataları
`NotificationQueue` dedupe ile in-app dedupe ayrı mekanizmalar.

## 12. Öneriler
Normalize dedupeKey, shared notification outbox, channel readiness UI.

## 13. Test Senaryoları
Same dedupe concurrent, cron rerun duplicate, preferences matrix, push disabled.

## 14. Sonuç
⚠️ Riskli
