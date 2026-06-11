# Hata, Eksik, Yanlış Denetimi

## Bulgu: AUD-001 Belgeler özelliği vaat ediliyor ama DB/API yok

### Kategori
Eksik / Yanlış / UX / API / DB

### Öncelik
P1

### Etkilenen Alan
Web / Mobile / API / DB / Product

### Dosyalar
- `apps/web/src/app/how-it-works/page.tsx`
- `apps/web/src/app/about/page.tsx`
- `apps/web/src/app/(app)/services/[id]/page.tsx`
- `apps/web/src/lib/validators.ts`
- `packages/db/prisma/schema.prisma`

### Kanıt
- How-it-works documents copy kullanıcıya contracts/receipts/proof-of-address storage vaat ediyor.
- Service detail page `service.documents` alanını render edebiliyor.
- `documentUploadSchema` var.
- Prisma schema'da `Document` modeli ve `Service.documents` relation bulunmadı.
- `/api/services/[id]` route include içinde documents yok.

### Mevcut Davranış
Kopya ve pasif UI sinyali var; gerçek upload/list/download/delete flow yok.

### Beklenen Davranış
Document model, storage, upload route, list route, download signed URL, delete, retention ve access-control olmalı.

### Neden Sorun?
Bu doğrudan ürün vaadi uyumsuzluğu ve destek/itibar riski yaratır.

### Bağlı Olduğu Diğer Modüller
Services, Export, Privacy, Mobile, Support, Storage.

### Önerilen Çözüm
Feature tamamlanana kadar copy ve UI kırıntısını kaldır. Feature yapılacaksa güvenli storage ve authorization tasarımıyla tamamla.

### Test Senaryosu
Bir kullanıcı service detail üzerinden belge yükleyebilmeli, başka kullanıcı dosyaya erişememeli, belge silinince export/account delete politikası doğru çalışmalı.

## Bulgu: AUD-002 "Snap a bill" vaadi mobile app'te yok

### Kategori
Yanlış / UX / Mobile

### Öncelik
P1

### Etkilenen Alan
Homepage / Mobile / Product

### Dosyalar
- `apps/web/src/i18n/messages/en.json`
- `apps/mobile/MOBILE_DATA_INVENTORY.md`
- `apps/mobile/STORE_SUBMISSION_CHECKLIST.md`

### Kanıt
Mobile inventory camera/photo/document APIs yok diyor. Store checklist `expo-image-picker` ve `expo-document-picker` bağımlılıklarının kaldırıldığını belirtiyor.

### Mevcut Davranış
Landing "Snap a bill" diyor; app'te fatura fotoğrafı yakalama yok.

### Beklenen Davranış
Copy manuel kayıtla uyumlu olmalı veya capture/OCR feature bulunmalı.

### Neden Sorun?
Kullanıcı mobile app'te promised action'ı bulamaz.

### Önerilen Çözüm
Copy değişikliği: "Add a bill, get a renewal nudge" gibi.

### Test Senaryosu
Marketing copy regression test: camera/document picker olmayan buildde "snap a bill" metni render edilmemeli.

## Bulgu: AUD-003 Automatic USPS/provider update copy riski

### Kategori
Yanlış / Logic / Integration / UX

### Öncelik
P1

### Etkilenen Alan
Homepage / Connectors / Pricing

### Dosyalar
- `apps/web/src/i18n/messages/en.json`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/about/page.tsx`
- `apps/web/src/lib/connector-runtime.ts`
- `apps/web/src/app/api/connectors/catalog/route.ts`

### Kanıt
`mm_bullet_1` "USPS forwarding setup, automatically." diyor. About page otomatik provider update olmadığını söylüyor. Connector catalog feature flag ve guided fallback kullanıyor.

### Mevcut Davranış
Manual coordination disclaimers ve automatic copy birlikte var.

### Beklenen Davranış
Connector automation sadece supported API_SYNC partner ve user consent varsa vaat edilmeli.

### Neden Sorun?
Legal/trust ve subscription conversion sonrası churn riski.

### Önerilen Çözüm
Copy guardrail: "automatic", "one-click update", "we update providers for you" gibi ifadeler feature flag ve capability check olmadan yasaklanmalı.

### Test Senaryosu
`FEATURE_API_CONNECTORS=false` veya connector mode `GUIDED_UPDATE` iken public page automatic copy göstermemeli.

## Bulgu: AUD-004 Webhook idempotency race penceresi

### Kategori
Payment / Logic / DB

### Öncelik
P2

### Etkilenen Alan
Backend / Payment / Notification / Workspace

### Dosyalar
- `apps/web/src/app/api/webhooks/stripe/route.ts`
- `apps/web/src/lib/webhook-idempotency.ts`
- `packages/db/prisma/schema.prisma`

### Kanıt
Webhook `hasProcessedWebhookEvent(event.id)` ile önce kontrol ediyor, switch işlemlerinden sonra `markWebhookEventProcessed(event.id, "stripe")` çağırıyor.

### Mevcut Davranış
Duplicate eventlerden bazıları internal dedupe/gate ile korunuyor; global event reservation işlem başında değil.

### Beklenen Davranış
Event processing başlamadan unique insert yapılmalı ve state takip edilmeli.

### Neden Sorun?
Stripe duplicate/retry concurrency durumunda email, audit veya additive side effect iki kez tetiklenebilir.

### Önerilen Çözüm
`ProcessedWebhookEvent` status: `PROCESSING`, `PROCESSED`, `FAILED`; unique insert işlem başında. Side effectler idempotency key ile ayrı korunmalı.

### Test Senaryosu
Aynı Stripe event id ile iki concurrent POST gönder; sadece bir processing branch yan etki üretmeli.

## Bulgu: AUD-005 In-app notification dedupe güvenilir değil

### Kategori
Notification / DB / Performance

### Öncelik
P2

### Etkilenen Alan
Notifications / Cron / Webhook

### Dosyalar
- `apps/web/src/lib/in-app-notifications.ts`
- `packages/db/prisma/schema.prisma`

### Kanıt
`createInAppNotification` mevcut notification'ı `metadata contains dedupeKey` ile arıyor. `Notification` modelinde unique dedupeKey yok; `NotificationQueue` modelinde ayrı `dedupeKey @unique` var.

### Mevcut Davranış
Concurrent cron/webhook çalışmasında duplicate yaratılabilir; büyüyen tabloda contains araması maliyetli olur.

### Beklenen Davranış
Dedicated normalized dedupe key.

### Önerilen Çözüm
`Notification.dedupeKey` nullable alanı ve `(userId, channel, dedupeKey)` unique index.

### Test Senaryosu
Aynı dedupeKey ile iki concurrent notification create denemesi tek row bırakmalı.

## Bulgu: AUD-006 Cron reminder test/batch açıkları

### Kategori
Testing / Performance / Notification

### Öncelik
P2

### Etkilenen Alan
Cron / Notifications / Backend

### Dosyalar
- `apps/web/src/app/api/cron/bill-reminders/route.ts`
- `apps/web/src/app/api/cron/contract-reminders/route.ts`
- `apps/web/src/app/api/cron/move-reminders/route.ts`
- `apps/web/src/app/api/cron/task-reminders/route.ts`

### Kanıt
`task-reminders` `take: 500` kullanıyor; diğer reminder route'larda açık batch standardı aynı değil. Route inventory'de birçok cron route için adjacent route test bulunmadı.

### Mevcut Davranış
Cron guard var; ancak batch/test standardı eşit değil.

### Beklenen Davranış
Her cron route bounded batch, idempotency, retry/failure behavior ve tests içermeli.

### Önerilen Çözüm
Queue veya cursor-based batch runner.

### Test Senaryosu
1000+ candidate service/task ile cron route tek requestte time out etmemeli; ikinci run duplicate göndermemeli.

## Bulgu: AUD-007 Admin rate limit process-local

### Kategori
Security / Scalability

### Öncelik
P2

### Etkilenen Alan
Admin / Middleware / Security

### Dosyalar
- `apps/admin/src/middleware.ts`

### Kanıt
`const adminRateLimitStore = new Map<string, { count: number; resetAt: number }>();`

### Mevcut Davranış
Tek process içinde limitler çalışır; multi-instance ortamda paylaşılmaz.

### Beklenen Davranış
Shared distributed rate limit.

### Önerilen Çözüm
Web tarafındaki shared limiter yaklaşımı admin'e de taşınmalı.

### Test Senaryosu
İki instance üzerinden aynı IP/admin route denemeleri ortak limitte sayılmalı.

## Bulgu: AUD-008 Test kapsamı risk bazlı tamamlanmalı

### Kategori
Testing / QA

### Öncelik
P2

### Etkilenen Alan
Web / Admin / Mobile / API

### Kanıt
Node_modules hariç 323 test/spec dosyası var: web 179, admin 91, mobile 15, packages 38. Adjacent route test taramasında web API'de 52, admin API'de 31 route için route test bulunamadı. E2E public pages ve accessibility ile sınırlı görünüyor.

### Mevcut Davranış
Birim/route test yüzeyi güçlü; ancak authenticated E2E ve mobile screen testleri sınırlı.

### Beklenen Davranış
Auth, payment, export, connector, workspace, notification ve admin operations için uçtan uca regression suite.

### Önerilen Çözüm
Risk-first test backlog.

### Test Senaryosu
Login -> address -> service -> reminder -> export -> subscription flow web E2E; mobile login/IAP/push/register flow emulator testi.
