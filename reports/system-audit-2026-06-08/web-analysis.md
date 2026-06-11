# Web Analysis

Durum: 2026-06-08 ilk full-pass inceleme.

## Yapisi

- Next.js App Router uygulamasi.
- Public yuzey: `/`, about, pricing, how-it-works, blog, legal pages, provider coverage/state pages, auth pages, invite/reset/verify pages.
- Authenticated app group: `(app)` altinda dashboard, moving, addresses, providers, services, budget, notifications, support, settings.
- API yuzeyi: 142 `apps/web/src/app/api/**/route.ts`.
- Toplam web route handler: 146.
- Web page/layout: 69.

## Guard Modeli

- `apps/web/src/middleware.ts` once IP rule, body size, CSRF, rate limit uygular.
- Public page/API listesi middleware icinde tutulur.
- Protected API icin middleware JWT imzasini edge-safe dogrular.
- DB session, soft-delete user, email verification, legal acceptance ve subscription kapilari route/layout helperlarinda calisir:
  - `apps/web/src/lib/user-auth.ts`
  - `apps/web/src/lib/api-gates.ts`
  - `apps/web/src/app/(app)/layout.tsx`

## Ana Web API Modulleri

- Auth/mobile bridge: cookie auth, bearer auth, OAuth, MFA, mobile login/exchange/native Apple.
- Profile/legal/consent: user profile, legal acceptance, data consent, locale, export/delete/restore.
- Address/service/moving/budget: CRUD, encryption/redaction, workspace scope, plan gates, move-task sync.
- Provider/recommendation: provider catalog, compare, recommendations, state rules, public popularity.
- Billing/IAP: Stripe checkout/portal/subscription actions, mobile IAP products/verify, Stripe/App Store/Play Store/Resend webhooks.
- Workspace: workspace CRUD, members, invitations, transfer, managed sync, restore/delete.
- Connectors: catalog, partner consents, OAuth, connector webhooks, queue dispatch, cron dispatch.
- Public/content: blog posts, image, revalidate, waitlist, tracking, address autocomplete.

## Billing/Webhook Degerlendirmesi

Gorulen guclu kontroller:

- Stripe webhook body cap + signature + idempotency + out-of-order event protection.
- Stripe subscription sync plan/status validation and workspace seat reconciliation.
- App Store webhook Apple JWS verification, bundle checks, stale notification handling and idempotency.
- Play Store RTDN OIDC audience/identity/package validation and idempotency.
- `/api/mobile/iap/verify` receipt ownership guard: same transaction/purchase token baska user'a baglanamiyor.

## Public API Notlari

- `PUBLIC_API_GET` icinde `/api/providers` var; bu `/api/providers/popular` ve `/api/providers/[id]` gibi child GET rotalarini da public yapar.
- `PUBLIC_API_PREFIXES` icinde `/api/cron` ve `/api/internal` var; bunlar route handler icinde shared-secret guard bekler.
- Cron route'lari genel olarak `guardCronRequest()` ile korunuyor.

## Bulgular

- F-001: `/api/partner-consents/[id]/refresh` cron/system endpoint gibi yazilmis ama middleware public/cron listesinde degil.
- F-002: `/api/providers/popular` public endpointi eyalet bazli gercek user address/service agregasyonunu k-anonimlik esigi olmadan donduruyor.
- F-003: Route testleri genis ama uniform degil: 142 web API route'undan 75'inde sibling route test yok.
- F-005: Connections UI legacy connector dispatch endpointini kullanmaya devam ediyor; workspace-aware sync ile drift var.
- F-006: `.env.example` web runtime-config ve kaynak env anahtarlariyla drift halinde.
