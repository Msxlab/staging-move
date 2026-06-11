# Bağlantı Haritası

## Özet

Bu harita repo yüzeyinden çıkarılmıştır: `apps/web/src/app/api`, `apps/admin/src/app/api`, `apps/mobile/app`, `apps/mobile/src/lib`, `packages/db/prisma/schema.prisma`, middleware ve shared billing/connector dosyaları incelendi.

## Bağlantı: Web Auth UI -> Auth API -> User/UserSession

### Bağlantı Türü
API / DB / Auth / Notification

### Kaynak
`apps/web/src/app/sign-in`, `sign-up`, auth components ve `apps/web/src/app/api/auth/*`.

### Hedef
`apps/web/src/lib/user-auth.ts`, Prisma `User`, `UserLoginSession`, `EmailVerificationToken`, `PasswordResetToken`.

### Ne Taşıyor?
Email, password, verification token, reset token, JWT/session cookie, device fingerprint.

### Ne Zaman Çalışıyor?
Register, login, logout, password reset, email verification, mobile exchange sonrası.

### Beklenen Davranış
Session DB'de aktif olmalı, email verified gerektiren write route'lar verified olmayan kullanıcıyı durdurmalı.

### Gerçek Kod Davranışı
`requireDbUserId`, `requireVerifiedUser`, diagnostics ve cookie expiry akışları mevcut. Middleware JWT kontrolü yapıyor; route handler DB session doğrulaması yapıyor.

### Riskler
Auth tasarımı güçlü. Risk daha çok route-level test boşlukları ve public exact/prefix listelerinin regression ile genişlemesi.

### Sonuç
✅ Doğru

### Öneri
Public route allowlist değişikliklerini regression testiyle kilitle.

## Bağlantı: Admin UI -> Admin API -> AdminUser/AdminPermission

### Bağlantı Türü
API / Auth / Permission / DB

### Kaynak
`apps/admin/src/app/*` pages ve `apps/admin/src/app/api/*`.

### Hedef
`apps/admin/src/lib/auth.ts`, `AdminUser`, `AdminSession`, `AdminPermission`, `AdminAuditLog`.

### Ne Taşıyor?
Admin JWT, session id, MFA state, permission keys, audit metadata.

### Gerçek Kod Davranışı
`requireAdmin`, `requirePermission`, password confirmation ve MFA setup gate mevcut. Admin API guard taramasında sadece health route public çıktı.

### Riskler
`apps/admin/src/middleware.ts` rate limit store'u process-local `Map`; multi-instance production'da dağıtık koruma sağlamaz. Bak: AUD-007.

### Sonuç
⚠️ Riskli

### Öneri
Admin route rate limit'i shared Redis/Upstash policy'ye taşı.

## Bağlantı: Web Checkout -> Stripe -> Subscription DB

### Bağlantı Türü
API / Payment / DB / Notification

### Kaynak
`apps/web/src/app/pricing/page.tsx`, `pricing-section.tsx`, `apps/web/src/app/api/stripe/checkout/route.ts`.

### Hedef
Stripe Checkout, `Subscription`, `AcquisitionCampaign`, `AcquisitionRedemption`, billing emails.

### Ne Taşıyor?
Plan, billing interval, campaign, terms acceptance, user ID, Stripe customer/subscription IDs.

### Gerçek Kod Davranışı
Plan server-side allowlist ile doğrulanıyor; price ID `getStripePriceIdForPlanAndInterval` ile server/runtime config'ten çözülüyor. Mobile client web checkout'tan engelleniyor.

### Riskler
Family/Pro price ID yoksa 503 doğru davranış. Webhook idempotency marker işlem sonunda yazılıyor; eşzamanlı duplicate eventlerde kalan race penceresi var. Bak: AUD-004.

### Sonuç
⚠️ Riskli

### Öneri
Webhook eventini işlem başında atomic reserve et, sonra `PROCESSING/PROCESSED/FAILED` status'u ile retry et.

## Bağlantı: Stripe Webhook -> Subscription/Emails/Workspace Seats

### Bağlantı Türü
Webhook / Payment / DB / Notification

### Kaynak
`apps/web/src/app/api/webhooks/stripe/route.ts`.

### Hedef
`Subscription`, `ProcessedWebhookEvent`, acquisition redemption, workspace seat reconciliation, billing emails.

### Ne Taşıyor?
Stripe event id/type, signature, subscription/customer, price, invoice/payment status.

### Gerçek Kod Davranışı
Signature doğrulanıyor, livemode mismatch guard var, stale event sınırı 72 saat, out-of-order event koruması var.

### Riskler
`hasProcessedWebhookEvent(event.id)` işlemden önce read, `markWebhookEventProcessed` işlem sonunda create yapıyor. Kodda acquisition redemption için ayrıca status gate var; yine de email/audit/additive yan etkiler için atomic event reservation daha sağlam olur.

### Sonuç
⚠️ Riskli

### Öneri
`ProcessedWebhookEvent` modelini status ve attempt alanlarıyla işlem başında unique insert eden outbox/idempotency guard'a çevir.

## Bağlantı: Mobile Subscription UI -> IAP -> Backend Verify -> Store Webhooks

### Bağlantı Türü
Mobile / Payment / API / Webhook / DB

### Kaynak
`apps/mobile/app/settings/subscription.tsx`, `apps/mobile/src/lib/iap.ts`.

### Hedef
`/api/mobile/iap/verify`, `/api/mobile/iap/products`, `/api/webhooks/appstore`, `/api/webhooks/playstore`, `Subscription`.

### Gerçek Kod Davranışı
Verify route auth gerektiriyor; Apple/Google webhook route'ları ve testleri mevcut. Mobile copy Family/Pro read-only, mobile purchase Individual olarak konumlanmış.

### Riskler
Store capability/env konfigürasyonu insan doğrulaması gerektiriyor (`STORE_SUBMISSION_CHECKLIST.md` push capability için human verification işaretli). Billing authority store tarafında olduğu için cancellation/refund copy'si doğru korunmalı.

### Sonuç
✅ Doğru

### Öneri
Store webhook/IAP sandbox uçtan uca smoke testlerini release checklist'e bağla.

## Bağlantı: Service UI -> Service API -> Service/Address/Provider DB

### Bağlantı Türü
UI Route / API / DB / Auth / State

### Kaynak
`apps/web/src/app/(app)/services/*`, mobile service screens.

### Hedef
`/api/services`, `/api/services/[id]`, `Service`, `Address`, `ServiceProvider`, `UserCustomProvider`.

### Gerçek Kod Davranışı
Service route user/workspace scoping yapıyor, duplicate guard var, sensitive fields encrypt/decrypt ediliyor, service delete soft-delete.

### Riskler
Service detail page `service.documents` alanını gösterebiliyor; route include içinde Document ilişkisi yok ve Prisma schema'da Document modeli bulunmadı. Bak: AUD-001.

### Sonuç
⚠️ Riskli

### Öneri
Belge UI/copy'sini feature tamamlanana kadar kaldır veya Document modeli/upload/download/access-control akışını tamamla.

## Bağlantı: Notification Trigger -> Notification Service -> Email/In-App/Push

### Bağlantı Türü
Cron / Notification / DB / External Service

### Kaynak
`/api/cron/task-reminders`, `bill-reminders`, `bill-overdue`, `contract-reminders`, `move-reminders`, `weekly-digest`, `monthly-report`, Stripe webhook, connector runtime.

### Hedef
`sendNotification`, `createInAppNotification`, `Notification`, `NotificationPreference`, `PushDevice`, Resend, Expo push.

### Gerçek Kod Davranışı
Email, in-app ve push kanalları preference kontrollü. Push `NOTIFICATION_PUSH_ENABLED` ile aktif; SMS kanalında provider implementasyonu yok.

### Riskler
In-app dedupe JSON substring aramasıyla yapılıyor ve unique constraint yok. Cron route testleri/batch sınırları tutarsız. Bak: AUD-005, AUD-006, AUD-010.

### Sonuç
⚠️ Riskli

### Öneri
Notification dedupeKey alanını normalize et, cron route testleri ve bounded batch standardı ekle.

## Bağlantı: Address Change UI -> Connector Dispatch -> Partner Connector

### Bağlantı Türü
API / External Service / Webhook / DB / Auth / Permission

### Kaynak
`apps/web/src/app/(app)/settings/connections/page.tsx`, `settings/address-changes/page.tsx`, `/api/connector-dispatch`, `/api/workspaces/[id]/sync`.

### Hedef
`connector-runtime.ts`, `PartnerConsent`, `ConnectorConfig`, `AddressChangeEvent`, `ConnectorDispatch`, `packages/connectors`.

### Gerçek Kod Davranışı
Feature flag, entitlement, consent, connector config, rollout/circuit state ve guided fallback kontrolleri var. Inbound connector webhook HMAC doğruluyor.

### Riskler
Landing copy bazı yerlerde automatic USPS/provider update algısı yaratıyor. Kod gerçekliği supported partner/API_SYNC/guided update. Bak: AUD-003.

### Sonuç
⚠️ Riskli

### Öneri
Marketing copy'yi "guided open-and-update" diline sabitle; automatic iddiaları yalnız API_SYNC partner canlıysa göster.

## Bağlantı: Export Settings -> Export API -> PDF/CSV/JSON

### Bağlantı Türü
UI / API / DB / Auth / Privacy

### Kaynak
`apps/web/src/app/(app)/settings/export/page.tsx`, mobile export settings.

### Hedef
`/api/export`, `/api/export/pdf`, PDF generators, user data models.

### Gerçek Kod Davranışı
CSV/JSON/PDF export mevcut. PDF route POST + step-up verification + rate limit kullanıyor; tax export Pro-gated.

### Riskler
Pozitif kontrol. Büyük dataset exportlarında rate limit var; pagination/streaming ihtiyacı ölçekle büyüyebilir.

### Sonuç
✅ Doğru

### Öneri
Büyük account export için async job/notification seçeneği roadmap'e alınabilir.
