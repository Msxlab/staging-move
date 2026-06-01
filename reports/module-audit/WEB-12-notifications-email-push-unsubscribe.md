# WEB-12 Notifications/Email/Push/Unsubscribe

## Kapsam

Email/push/in-app notifications, preferences, unsubscribe, one-click unsubscribe, digests/reminders.

## Olumlu Gozlemler

- Middleware anonymous unsubscribe GET ve RFC8058 form POST yollarini token validation'a gecirecek sekilde ayirmis.
- Reminder/digest cron modulleri notification tercihleriyle baglanacak sekilde tasarlanmis.
- Push ve email yuzeyleri mobile/web ayrimini destekliyor.

## Riskler ve Sorular

- Preference degisikligi tum kanallara ayni anda yansiyor mu E2E test edilmeli.
- Deleted/soft-deleted user veya grace-deleted user notification almamali.
- Email template/CMS/user content XSS ve PII leak acisindan kontrol edilmeli.
- Unsubscribe token replay/expiry/scope davranislari net kalmali.

## Test/Task Listesi

- Email preference off -> cron email gondermez.
- Push token register/unregister.
- One-click unsubscribe.
- Deleted user skip.
- Digest/reminder timezone.
- Template sanitizer.

## Oncelik

P2/P3: Preference-to-delivery E2E ve deleted user skip.
