# Client Endpoint Map

Durum: Direct string/template `/api/*` cagrilari uzerinden ilk-pass map.

## Mobile -> Web API

Mobile DB veya connectors paketini dogrudan import etmiyor. Tum domain islemleri `apps/mobile/src/lib/api.ts` uzerinden web API'ye gider.

Ana endpoint aileleri:

- Auth: `/api/mobile/auth/login`, `/api/mobile/auth/exchange`, `/api/mobile/auth/apple/native`, `/api/auth/me`, `/api/auth/logout`, password reset, MFA setup/confirm/disable.
- Profile/legal/privacy: `/api/profile`, `/api/legal/acceptance`, `/api/consent`, `/api/user/locale`, `/api/account/delete`, `/api/export`.
- Addresses/services/moving: `/api/addresses`, `/api/addresses/[id]`, `/api/addresses/validate`, `/api/services`, `/api/services/[id]`, `/api/moving`, `/api/moving/[id]`, `/api/moving/migration`.
- Move tasks/reminders: `/api/move-tasks`, `/api/notifications/feed`.
- Providers: `/api/providers`, `/api/providers/[id]`, `/api/providers/recommendations`, `/api/providers/compare`, `/api/affiliate/click`.
- Billing/IAP: `/api/mobile/iap/products`, `/api/mobile/iap/verify`, `/api/acquisition/public-trial-campaign`.
- Workspace: `/api/workspaces`, `/api/workspaces/[id]/members`, `/managed-sync`, `/invitations`, `/transfer`, invitation accept/pending accept/decline.
- Connectors: `/api/connectors/catalog`, `/api/connectors/changes`, `/api/partner-consents`, `/api/connector-dispatch`.
- Public content/support: `/api/blog/posts`, `/api/blog/view`, `/api/help`, `/api/tickets`.

Sonuc:

- Direct mobile endpoint sweep'te bariz "client cagiriyor ama web route yok" uyumsuzlugu bulunmadi.
- En onemli sozlesme riski route yoklugu degil, F-005'teki workspace-aware vs legacy connector endpoint secimi.

## Web Client -> Web API

Authenticated web UI su ana domain hook/page ailelerine bagli:

- `use-addresses`, `use-services`, `use-moving-plan`, `use-budget`, `use-providers`.
- Settings: workspace, connections, subscription, privacy/profile/security.
- Public auth: sign-in/sign-up OAuth providers, register/login.
- Tracking/session and consented analytics.

Not:

- Public pages anasayfa/pricing/blog/legal/auth girislerini birlestiriyor.
- Public API allowlist middleware'de merkezi; F-002 public provider popularity bu yuzeyden geliyor.

## Admin Client -> Admin API

Admin UI agirlikli olarak su operasyon ailelerine bagli:

- Users/workspaces/team: `/api/users`, `/api/workspaces`, `/api/team`.
- Providers/governance/coverage/logo: `/api/providers/**`, `/api/provider-governance`.
- Billing/subscriptions: `/api/billing`, `/api/subscriptions/**`.
- Connectors: `/api/connectors`, `/api/connectors/consents`, `/healthcheck`, `/test-connection`, `/api/connector-fallbacks`.
- Backups: `/api/backup`, `/api/backup/sql-dump`, `/api/backup/[id]/download`, `/verify`, `/import`.
- Security/runtime config: `/api/security`, `/api/security/key-rotation`, `/api/security/dashboard`, `/api/runtime-config`, `/api/auth/sessions`, `/api/logs`.
- Content: `/api/blog/**`, `/api/email-templates`, `/api/help-center`.
- Operations: `/api/feature-flags`, `/api/notifications`, `/api/reports`, `/api/analytics/**`, `/api/waitlist`.

Sonuc:

- Admin pages ile API aileleri genel olarak birebir bagli gorunuyor.
- Kritik admin write/download yollarinda step-up ve audit logging ornekleri mevcut.
