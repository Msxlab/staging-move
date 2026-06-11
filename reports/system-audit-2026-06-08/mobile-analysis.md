# Mobile Analysis

Durum: 2026-06-08 ilk full-pass inceleme.

## Yapisi

- Expo Router uygulamasi.
- Mobile route dosyasi: 53.
- Route gruplari:
  - `(auth)`: sign-in, sign-up, forgot-password
  - `(tabs)`: dashboard/index, addresses, moving, services, more
  - addresses, services, providers, moving, budget, reminders, notifications
  - settings: profile, privacy, subscription, notifications, workspace, connections, export, delete account, two-factor
  - invitations, reset-password, setup-password, onboarding, oauth, blog
- Native hedefler:
  - Android native project
  - Android widget: `apps/mobile/src/widgets/MoveWidget.tsx`, `apps/mobile/targets/widget/MoveWidget.swift`

## API Baglantisi

- Mobile dogrudan DB/connectors kullanmiyor.
- `apps/mobile/src/lib/api.ts` shared `ApiClient` ile web API'ye konusuyor.
- Auth token `expo-secure-store` uzerinde tutuluyor.
- Her mobile API cagrisi `Authorization: Bearer`, `x-client-type=mobile`, platform/version ve descriptive User-Agent basliklarini tasiyor.
- `apps/mobile/src/lib/auth-store.ts` cold-start `/api/auth/me` fetch'inde ayni identity headerlarini manuel ekliyor.

## Mobile'in Kullandigi Ana Endpoint Aileleri

- Auth: `/api/mobile/auth/login`, `/api/mobile/auth/exchange`, `/api/mobile/auth/apple/native`, `/api/auth/me`, password reset, MFA, OAuth providers.
- Profile/legal/consent: `/api/profile`, `/api/legal/acceptance`, `/api/consent`, `/api/user/locale`.
- Moving/tasks: `/api/moving`, `/api/moving/[id]`, `/api/moving/migration`, `/api/move-tasks`.
- Addresses/services/providers: `/api/addresses`, `/api/services`, `/api/providers`, `/api/providers/recommendations`, `/api/providers/compare`.
- Billing/IAP: `/api/mobile/iap/products`, `/api/mobile/iap/verify`, `/api/acquisition/public-trial-campaign`.
- Workspace: `/api/workspaces/**`, `/api/invitations/**`.
- Notifications/push: `/api/notifications/**`, `/api/push/register`.
- Connectors: `/api/connectors/catalog`, `/api/partner-consents`, `/api/connector-dispatch`, `/api/connectors/changes`.

## Contract Durumu

- Direct mobile endpoint sweep'te bariz route karsiligi olmayan endpoint bulunmadi.
- Mobile'in web API contract'ina bagimliligi yuksek; route-level test eksikleri mobile regresyonlarini da etkiler.
- Mobile IAP verify server-side store API dogrulamasina ve subscription row ownership guard'a gidiyor; client-side purchase sonucuna tek basina guvenilmiyor.

## Bulgular

- F-003: Web API sibling route test eksikleri mobile contract riskidir.
- F-005: Mobile Connections ekranlari legacy `/api/connector-dispatch` kullanir; workspace-aware sync endpointi yerine owner/member entitlement drift'i olusabilir.
- F-006: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_APP_URL`, mobile store purchase flag'leri gibi env anahtarlari root `.env.example` ile tam hizali degil.

## Notlar

- Workspace ekrani feature flag kapaliysa `WORKSPACE_DISABLED` bekliyor; bu dogru fallback davranisi.
- Mobile test sayisi web/admin'e gore daha dusuk; auth, workspace, IAP ve connector contract testleri oncelikli.
