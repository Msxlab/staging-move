# Testing ve QA Denetimi

## Test Envanteri

Node_modules hariç `rg --files` ile bulunan test/spec dosyaları:

- Toplam: 323
- Web: 179
- Admin: 91
- Mobile: 15
- Packages: 38

## Test Alanı: Web API

- Mevcut test dosyaları: Auth, Stripe checkout/webhook, App Store/Play Store webhooks, export/PDF, addresses/services/moving/budget, notifications feed, push register, workspace bazı route'lar, connectors bazı route'lar.
- Kapsadığı akışlar: Auth/session, billing, export, common domain CRUD, selected connectors.
- Eksik akışlar: 52 web API route için adjacent route test bulunamadı. Özellikle bazı workspace, cron reminder, blog/content, tracking, help/public provider route'ları.
- Risk: Permission/public route regression.
- Önerilen testler: Auth required, ownership, validation, rate limit, duplicate/idempotency.
- Öncelik: P2

## Test Alanı: Admin API

- Mevcut test dosyaları: Auth login/logout/sessions/password, users, backups, logs, connectors, subscriptions, security, runtime config.
- Eksik akışlar: 31 admin API route için adjacent route test bulunamadı. Analytics, content/blog, tickets, help-center, provider governance gibi yüzeyler öncelikli.
- Risk: Admin permission regression.
- Önerilen testler: requireAdmin/requirePermission, password confirmation, audit log, validation.
- Öncelik: P2

## Test Alanı: Mobile

- Mevcut test dosyaları: `apps/mobile/src/lib/*.test.ts` toplam 15; auth, IAP, password, app lock, API, route helpers.
- Eksik akışlar: Emulator/screen-level E2E bulunmadı.
- Risk: Native auth/IAP/push/subscription UI regressions.
- Önerilen testler: Android/iOS emulator login, IAP sandbox, push permission/register, offline/expired session.
- Öncelik: P2

## Test Alanı: E2E / Accessibility

- Mevcut test dosyaları: `apps/web/tests/e2e/public-pages.spec.ts`, `apps/web/tests/e2e/accessibility.spec.ts`.
- Eksik akışlar: Authenticated app, checkout happy path mock, export, workspace, admin login.
- Risk: Full user journey regressions.
- Önerilen testler: Login -> address -> service -> move -> export; pricing -> checkout mocked; admin login -> user inspect.
- Öncelik: P2

## Test Alanı: Payment Webhooks

- Mevcut test dosyaları: Stripe, appstore, playstore route tests.
- Eksik akışlar: Concurrent duplicate event idempotency.
- Risk: Duplicate side effects.
- Önerilen testler: Parallel webhook same event id, out-of-order events, livemode mismatch, missing price.
- Öncelik: P2

## Test Alanı: Notifications

- Mevcut test dosyaları: Feed/preference/push selected tests.
- Eksik akışlar: Cron reminder duplicate/preference combinations, push disabled env, in-app dedupe race.
- Risk: Duplicate/missing notifications.
- Öncelik: P2

## QA Önerileri

1. Route test gap report'u CI artifact yap.
2. Risk-first E2E suite ekle.
3. Product promise copy tests.
4. Webhook/concurrent idempotency tests.
5. Mobile emulator smoke tests.
