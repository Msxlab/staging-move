# Payments Denetimi

## Payment Provider

- Web: Stripe Checkout, Stripe Billing, Stripe Portal, Stripe webhooks.
- Mobile: App Store / Google Play IAP, backend receipt verification, App Store/Play Store webhooks.

## Payment Flow: Web Checkout

### Başlangıç
Pricing/subscription UI.

### Frontend
Plan ve billing interval query/body ile checkout route'a gönderilir.

### Backend
`apps/web/src/app/api/stripe/checkout/route.ts` auth, rate limit, terms, active subscription, mobile client guard, plan allowlist ve server-side price ID resolution yapar.

### Provider
Stripe Checkout session.

### Webhook
`apps/web/src/app/api/webhooks/stripe/route.ts`.

### Database Update
`Subscription`, `AcquisitionRedemption`, `ProcessedWebhookEvent`.

### Notification
Billing emails with dedupe keys.

### Admin Görünümü
Admin billing/subscriptions/users routes.

### Kullanıcı Görünümü
Profile/subscription settings, plan limits.

### Riskler
AUD-004 webhook idempotency reservation.

### Hatalar
P0 ödeme manipülasyonu kanıtı bulunmadı; fiyat client'tan belirlenmiyor.

### Öneriler
Webhook reservation ve concurrent duplicate tests.

## Payment Flow: Mobile IAP Purchase

### Başlangıç
`apps/mobile/app/settings/subscription.tsx`.

### Frontend
`apps/mobile/src/lib/iap.ts` store ürünlerini alır, purchase başlatır, verify body oluşturur.

### Backend
`/api/mobile/iap/verify` auth gerektirir ve store receipt validation yapar.

### Provider
Apple/Google.

### Webhook
`/api/webhooks/appstore`, `/api/webhooks/playstore`.

### Database Update
Unified `Subscription` entitlement snapshot.

### Riskler
Store env/capability readiness ve sandbox/prod configuration.

### Öneriler
Release öncesi sandbox purchase/restore/revoke tests.

## Payment Flow: Stripe Webhook

### Başlangıç
Stripe event.

### Backend
Raw body + signature validation, event age, livemode mismatch, idempotency check, switch by event type.

### Riskler
Processed marker processing sonunda yazılıyor. Kod bazı side effectleri kendi gate/dedupe keyleri ile koruyor; ancak global pattern atomik değil.

### Öneriler
Processing status + unique reserve.

## Pricing Tutarlılığı

- `packages/shared/src/billing.ts`: Individual, Family, Pro prices/features.
- `apps/web/src/lib/plan-limits.ts`: Free/Individual/Family/Pro caps.
- `pricing-section.tsx`: UI limitleri current plan-limits ile uyumlu görünüyor.
- Family/Pro API sync claims "supported partners/approved partners" şeklinde sınırlandırılmış; automatic USPS copy ayrıca düzeltilmeli.

## Security Kontrolleri

| Kontrol | Durum |
|---|---|
| Client fiyatına güveniliyor mu? | Hayır |
| Webhook signature doğrulanıyor mu? | Evet |
| Webhook duplicate guard var mı? | Var, ama reservation sonda |
| Mobile web checkout engeli var mı? | Evet |
| Store-managed cancellation copy var mı? | Evet |
| Trial/terms copy var mı? | Evet |

## Öneriler

1. Stripe webhook concurrency/idempotency tests.
2. App Store/Play Store webhook sandbox tests.
3. Runtime price config readiness health check.
4. Billing emails duplicate tests.
5. Admin subscription action audit tests.
