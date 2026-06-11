# Mobile Denetimi

## Sayfa/Screen Listesi

- Auth: sign-in, sign-up, forgot/reset password, OAuth.
- Tabs: dashboard/index, addresses, services, moving, more.
- Settings: profile, subscription, notifications, privacy, export, workspace, two-factor, connections, address changes, delete account.
- Domain screens: addresses, services, providers/custom providers, moving, budget, notifications, help/tickets, blog.

## Route Listesi

Expo Router dosyaları `apps/mobile/app` altında yer alıyor. Mobile backend web API ile konuşuyor: auth exchange/login, IAP verify/products, domain APIs, notifications, push register, export.

## Component Listesi

- UI: `Button`, `Card`, `EmptyState`, `ErrorState`, `LoadingScreen`, `Badge`, `Avatar`.
- Auth/session: `AppLockGate`, `SessionTracker`, `EmailVerificationBanner`.
- Provider components, legal consent panel, address autocomplete field.

## API Bağlantıları

- `apps/mobile/src/lib/api.ts`
- `apps/mobile/src/lib/auth.ts`, `auth-store.ts`
- `apps/mobile/src/lib/iap.ts`
- `apps/mobile/src/lib/push.ts`
- `apps/mobile/src/lib/password-management.ts`
- `apps/mobile/src/lib/mobile-oauth.ts`

## Kullanıcı Akışları

1. Native login/signup/OAuth handoff.
2. Address/service/moving/budget CRUD.
3. Subscription view, Individual IAP purchase/restore.
4. Push notification permission/registration.
5. Notification preference updates.
6. Export/download.
7. Help/support ticket flows.

## UI Bulguları

- Mobile app kamera/fotoğraf/belge yakalama API'leri kullanmıyor; web landing "Snap a bill" dediği için UX mismatch var.
- Store submission checklist push notifications capability için human verification gerektirdiğini belirtiyor.
- Family/Pro mobile purchase read-only copy doğru ve platform policy uyumlu görünüyor.

## UX Bulguları

- Positive: Subscription copy store billing authority ve auto-renewal hakkında açık.
- Positive: Push registration soft prompt pattern'i var.
- Risk: Push toggle açıkken backend/env delivery kapalıysa kullanıcı bunu net görmeyebilir.
- Risk: Mobile screen-level E2E/emulator regression testleri bulunmadı; testler lib ağırlıklı.

## Hata/Eksik/Yanlış Bulguları

| ID | Alan | Öncelik | Durum |
|---|---|---|---|
| AUD-002 | Bill snap/capture yok | P1 | Hatalı |
| AUD-010 | Push capability/readiness belirsiz | P2 | Riskli |
| AUD-014 | Mobile E2E coverage sınırlı | P2 | Riskli |

## Permission Bulguları

Mobile backend auth token/session modeline bağlı. Backend route'lar user scoping uyguluyor. Mobile'da local UI kontrolü tek başına yetki kaynağı değil.

## Data Tutarlılığı

Mobile data inventory; IAP receipt, push token ve auth data'yı tanımlar. Camera/photo/location/contact data toplanmadığını açıkça belirtir. Bu, "Snap a bill" copy'siyle çelişir.

## Öneriler

1. Mobile marketing copy'sini current app capabilities'e göre düzelt.
2. Auth/IAP/push/export için emulator E2E suite.
3. Push capability unavailable state.
4. Store sandbox purchase/restore smoke testini release gate yap.
