# İş Mantığı Denetimi

## Genel Sonuç

İş mantığı tarafında plan/limit, server-side price resolution, email verification gate, workspace scoping ve admin permission kontrolleri olumlu. En büyük mantık riski, sistemin gerçek capability'leri ile ürün copy'sinin aynı contract altında tutulmaması ve bazı async/idempotent süreçlerde atomiklik pencereleridir.

## Plan ve Ücretli/Ücretsiz Özellik Ayrımı

- `packages/shared/src/billing.ts` planları ve fiyatları tanımlar.
- `apps/web/src/lib/plan-limits.ts` Free/Individual/Family/Pro address/service/member/custom provider limitlerini uygular.
- `apps/web/src/app/api/stripe/checkout/route.ts` client fiyatına güvenmeden plan/billing interval allowlist ve runtime price ID kullanır.
- Mobile copy Family/Pro read-only, Individual store purchase yönündedir.

### Sonuç
✅ Sağlam

### Risk
Family/Pro fiyat ID yoksa checkout 503 döner; pricing copy bu durumu açıklıyor. Runtime config readiness release öncesi kontrol edilmeli.

## Subscription Status ve Store/Web Ayrımı

- Web: Stripe checkout/portal/webhook.
- Mobile: App Store/Google Play IAP verify ve webhooks.
- Account deletion copy store-managed subscriptions için kullanıcıyı ayrıca uyarıyor.

### Sonuç
✅ Sağlam

### Risk
Webhook idempotency reservation modeli güçlendirilmeli. Bak: AUD-004.

## Role ve Permission Mantığı

- User routes `requireDbUserId`, `requireVerifiedUser`, workspace context ve scoped record action helpers kullanıyor.
- Admin routes `requireAdmin` / `requirePermission` patternine sahip; middleware comment DB isActive kontrolünü route'a bırakıyor.
- Workspace role scoping `workspace-context.ts` ve `workspace-data-scope.ts` ile ayrılmış.

### Sonuç
✅ Sağlam

### Risk
Eksik route testleri permission regression yakalamayı zorlaştırır. Bak: AUD-008.

## Status Geçişleri

- Subscription: Stripe webhook out-of-order event tarihlerini dikkate alıyor.
- Connector: `ConnectorDispatch` status ve terminal status mantığı var; failed async webhook guided fallback'e düşüyor.
- Account deletion/GDPR: `GDPRRequest`, soft delete ve retention modelleri mevcut.

### Sonuç
⚠️ Riskli

### Risk
Connector ve notification akışlarında duplicate/idempotency kontrolleri aynı seviyede normalize değil.

## Aynı İşlem İki Kez Yapılırsa

- Service duplicate guard mevcut.
- Stripe webhook global processed event tablosu var; ancak marker işlem sonunda.
- Notification in-app dedupe var; ancak unique değil.
- Connector dispatch idempotencyKey schema seviyesinde unique.

### Sonuç
⚠️ Riskli

### Öneri
Payment, notification ve connector idempotency stratejilerini tek bir pattern altında standardize et.

## Soft Delete / Hard Delete

- `User`, `Address`, `Service`, `MovingPlan`, `Budget`, provider ve benzeri modellerde `deletedAt` patterni yaygın.
- Route'lar deletedAt kontrolleri yapıyor.

### Sonuç
✅ Genel olarak doğru

### Risk
Soft delete filtering uygulama seviyesinde kaldığında yeni route'larda kaçırılabilir. Test ve helper kullanımını zorunlu kıl.

## Timezone / Tarih Mantığı

- Reminder cron'ları günlük pencere ve dueDate hesapları kullanıyor.
- `toLocaleDateString("en-US")` UI/copy'de sıkça var.

### Sonuç
⚠️ Riskli

### Risk
Global kullanıcılar için timezone/preferred locale detayları her reminder route'ta aynı standarda sahip olmayabilir.

### Öneri
Reminder tarih hesaplarını user timezone/preferred locale ile merkezi helper'a taşı.

## İş Mantığı Bulguları

| ID | Başlık | Öncelik | Sonuç |
|---|---|---|---|
| AUD-001 | Document promise ama feature yok | P1 | ❌ |
| AUD-003 | Automatic USPS copy gerçek connector koşullarıyla uyumsuz | P1 | ⚠️ |
| AUD-004 | Webhook idempotency reservation sonda | P2 | ⚠️ |
| AUD-005 | Notification dedupe unique değil | P2 | ⚠️ |
| AUD-006 | Cron batch/test standardı tutarsız | P2 | ⚠️ |

## Test Senaryoları

1. Free/Individual/Family/Pro plan limitleri address/service/custom provider create route'larında uygulanmalı.
2. Same Stripe event id concurrent webhook testinde side effectler tek kez oluşmalı.
3. Same cron reminder iki kez çalıştırıldığında duplicate notification/email oluşmamalı.
4. Workspace MEMBER/VIEW_ONLY/CHILD rolleri servis/address/move action matrix'e göre backend'de engellenmeli.
5. Connector disabled/guided/API_SYNC mode'ları user-facing copy ve route response ile uyumlu olmalı.
