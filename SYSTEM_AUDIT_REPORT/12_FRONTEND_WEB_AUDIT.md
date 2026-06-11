# Frontend Web Denetimi

## Sayfa/Screen Listesi

- Public: `/`, `/pricing`, `/how-it-works`, `/about`, `/faq`, `/provider-coverage`, `/contact`, `/blog`, legal/security/privacy/refund/billing policy pages.
- Auth: `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/verify-email`.
- App: dashboard, addresses, services, providers, moving, budget, notifications, support, settings.
- Settings: profile, subscription, notifications, export, privacy, connections, address changes, workspace.

## Route Listesi

Web route listesi `apps/web/src/app` altında App Router ile organize. API route grupları `11_API_AND_BACKEND_AUDIT.md` içinde listelendi.

## Component Listesi

- Marketing: header, pricing section, app store CTA, moving moment mock.
- App shell: dashboard, search/nav, cards, forms.
- Settings: plan change, export, notification preferences, connections.
- UI: buttons, cards, dialogs, status badges, empty/error/loading states.

## API Bağlantıları

- Auth/Profile: `/api/auth/*`, `/api/profile`.
- Domain: `/api/addresses`, `/api/services`, `/api/moving`, `/api/budget`.
- Notifications: `/api/notifications/feed`, preferences, push register.
- Billing: `/api/stripe/checkout`, portal, subscription actions.
- Export: `/api/export`, `/api/export/pdf`.
- Connectors: catalog, consents, dispatch, changes.

## Kullanıcı Akışları

1. Public page -> sign-up/login -> onboarding/dashboard.
2. Add address -> add service -> reminder/task surfaces.
3. Create moving plan -> generated move tasks.
4. Subscription checkout/portal.
5. Export account data with step-up.
6. Notification preference management and feed read/unread.
7. Workspace invite/member flows.
8. Connector guided/API sync flows in settings.

## UI Bulguları

- AUD-001: Service detail document card/copy has no real backend feature.
- AUD-002: Landing mobile copy promises bill snap without feature.
- AUD-003: Automatic USPS copy conflicts with manual/guided connector reality.
- AUD-010: Notification channel delivery readiness not fully surfaced.

## UX Bulguları

- Positive: Empty/error/loading strings exist broadly in i18n.
- Positive: Critical deletes use confirmations.
- Positive: Export and billing have step-up/terms/cancellation copy.
- Risk: Product copy may set expectations beyond current feature set.

## Hata/Eksik/Yanlış Bulguları

| ID | Alan | Öncelik | Durum |
|---|---|---|---|
| AUD-001 | Documents | P1 | Hatalı |
| AUD-002 | Bill snap | P1 | Hatalı |
| AUD-003 | Automatic USPS | P1 | Riskli |
| AUD-010 | Notification channel readiness | P2 | Riskli |

## Permission Bulguları

Web app route'larında backend scoping güçlü. UI'da gizlenen kontrollerin backend karşılığı özellikle services, export, workspace ve subscription routes'ta mevcut görünüyor. Eksik route testleri regression riskidir.

## Data Tutarlılığı

Address/service/move/budget data Prisma modelleri ve API route'larıyla uyumlu. Documents data tutarsız: UI/copy var, model/API yok.

## Öneriler

1. Web copy inventory testleri.
2. Authenticated user flow Playwright E2E.
3. Document feature flag veya copy cleanup.
4. Connector mode'a göre conditional copy.
5. Notification channel status UI.
