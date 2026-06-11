# Global Todo Listesi

## Kritik Öncelik

Bu audit sırasında kanıtlı P0 bulunmadı. Auth/payment yüzeylerinde kritik kontrollerin büyük kısmı mevcut: route-level auth, DB session validation, Stripe signature validation, server-side price resolution, mobile IAP verify ve admin permission checks.

## Yüksek Öncelik

### TODO-AUD-001: Belge ürün vaadini ya kaldır ya gerçek feature yap
- Modül: Documents / Services / Product Copy
- Dosyalar: `apps/web/src/app/how-it-works/page.tsx`, `apps/web/src/app/about/page.tsx`, `apps/web/src/app/(app)/services/[id]/page.tsx`, `apps/web/src/lib/validators.ts`, `packages/db/prisma/schema.prisma`
- Sorun tipi: Eksik / Yanlış ürün vaadi / API / DB
- Etki: Kullanıcı belgeleri saklayabileceğini sanır; sistemde kalıcı belge modeli ve upload akışı yok.
- Kanıt: `documentUploadSchema` var; `Document` Prisma modeli ve service documents include yok.
- Kontrol yöntemi: Schema/API route search, service detail page inspection.
- Beklenen doğru davranış: Belge upload/download/list/delete akışı ve access-control olmalı veya copy kaldırılmalı.
- Mevcut davranış: Copy var, UI pasif kart var, backend/DB yok.
- Önerilen aksiyon: İlk release için copy kaldır; roadmap feature ise feature flag arkasına al.
- Durum: Hatalı

### TODO-AUD-002: "Snap a bill" mobile vaadini düzelt
- Modül: Homepage / Mobile / Documents
- Dosyalar: `apps/web/src/i18n/messages/en.json`, `apps/mobile/MOBILE_DATA_INVENTORY.md`, `apps/mobile/STORE_SUBMISSION_CHECKLIST.md`
- Sorun tipi: Yanlış ürün vaadi / UX
- Etki: Mobile kullanıcı kamera/bill capture bekler.
- Kanıt: Mobile inventory camera/photo/document API kullanılmadığını belirtiyor.
- Kontrol yöntemi: Dependency/code search.
- Beklenen doğru davranış: Capture/OCR varsa mobile feature; yoksa manuel kayıt copy'si.
- Mevcut davranış: Capture copy var, capture feature yok.
- Önerilen aksiyon: Copy'yi kaldır/değiştir veya feature scope aç.
- Durum: Hatalı

### TODO-AUD-003: Automatic USPS/provider update copy'sini connector gerçekliğiyle hizala
- Modül: Homepage / Connectors / Pricing
- Dosyalar: `apps/web/src/i18n/messages/en.json`, `apps/web/src/app/page.tsx`, `apps/web/src/lib/connector-runtime.ts`, `apps/web/src/app/api/connectors/catalog/route.ts`
- Sorun tipi: Yanlış ürün vaadi / Logic / Integration
- Etki: Kullanıcı gerçek provider account update otomasyonu bekleyebilir.
- Kanıt: Connector section feature-flag ve supported partner koşullu; catalog guided fallback kullanıyor.
- Kontrol yöntemi: Copy + route/runtime inspection.
- Beklenen doğru davranış: "Guided update" ve "supported partners only" dili.
- Mevcut davranış: Bazı copy satırları "automatically" diyor.
- Önerilen aksiyon: Conditional copy veya copy guardrail ekle.
- Durum: Riskli

## Orta Öncelik

### TODO-AUD-004: Webhook idempotency reservation modelini güçlendir
- Modül: Payments / Webhooks / Connectors
- Dosyalar: `apps/web/src/app/api/webhooks/stripe/route.ts`, `apps/web/src/lib/webhook-idempotency.ts`, `packages/db/prisma/schema.prisma`
- Sorun tipi: Payment / Logic / DB
- Etki: Duplicate event yarışında yan etkilerin çift çalışması riski.
- Kanıt: `hasProcessedWebhookEvent` önce read, `markWebhookEventProcessed` işlem sonunda create.
- Kontrol yöntemi: Webhook flow tracing.
- Beklenen doğru davranış: Event id işlem başında atomic reserve edilmeli.
- Mevcut davranış: Bazı yan etkiler kendi dedupe/gate'ine sahip; global marker sonda.
- Önerilen aksiyon: `ProcessedWebhookEvent` için `PROCESSING/PROCESSED/FAILED` state ekle.
- Durum: Riskli

### TODO-AUD-005: In-app notification dedupeKey için unique constraint ekle
- Modül: Notifications
- Dosyalar: `apps/web/src/lib/in-app-notifications.ts`, `packages/db/prisma/schema.prisma`
- Sorun tipi: Notification / DB / Performance
- Etki: Cron veya webhook tekrarında duplicate notification; büyüyen tabloda contains scan.
- Kanıt: `metadata: { contains: input.dedupeKey }`; `Notification` modelinde dedupeKey unique alan yok.
- Kontrol yöntemi: Code/schema inspection.
- Beklenen doğru davranış: `(userId, channel, dedupeKey)` unique.
- Mevcut davranış: JSON string contains.
- Önerilen aksiyon: Dedicated nullable `dedupeKey` kolonu + unique index + backfill/migration.
- Durum: Riskli

### TODO-AUD-006: Reminder cron route'larını batch ve test standardına al
- Modül: Notifications / Cron
- Dosyalar: `apps/web/src/app/api/cron/*`
- Sorun tipi: Testing / Performance / Notification
- Etki: Büyük data setlerinde uzun request ve duplicate/failure regression riski.
- Kanıt: `task-reminders` `take: 500` kullanıyor; bazı reminder route'larında açık batch sınırı yok. Cron route testleri birçok route için eksik.
- Kontrol yöntemi: Route/test inventory.
- Beklenen doğru davranış: Her cron route için auth/rate-limit/dedupe/batch tests.
- Mevcut davranış: Guard var ama test/batch standardı tutarsız.
- Önerilen aksiyon: Queue veya paginated batch runner.
- Durum: Riskli

### TODO-AUD-007: Admin rate limit'i dağıtık hale getir
- Modül: Admin / Security
- Dosyalar: `apps/admin/src/middleware.ts`
- Sorun tipi: Security / Scalability
- Etki: Multi-instance production'da brute-force/abuse rate limit zayıflar.
- Kanıt: `const adminRateLimitStore = new Map...`
- Kontrol yöntemi: Middleware inspection.
- Beklenen doğru davranış: Shared store based limiter.
- Mevcut davranış: Process-local limiter.
- Önerilen aksiyon: Upstash/Redis rate limiter.
- Durum: Riskli

### TODO-AUD-008: API route test boşluklarını kapat
- Modül: Testing / QA
- Dosyalar: `apps/web/src/app/api/*`, `apps/admin/src/app/api/*`, `apps/web/tests/e2e/*`, `apps/mobile/src/lib/*.test.ts`
- Sorun tipi: Testing
- Etki: Permission, public route, cron ve admin regression'ları kaçabilir.
- Kanıt: Node_modules hariç 323 test/spec var; web API'de 52, admin API'de 31 route için adjacent route test bulunamadı; E2E sadece public/accessibility.
- Kontrol yöntemi: `rg --files` test inventory.
- Beklenen doğru davranış: Riskli route grupları için adjacent tests ve authenticated E2E.
- Mevcut davranış: Test var ama bazı kritik route grupları eksik.
- Önerilen aksiyon: Workspaces, cron reminders, blog/content, admin analytics ve mobile screen E2E öncelikli.
- Durum: Riskli

## Düşük Öncelik

### TODO-AUD-009: Eski spec ve roadmap dokümanlarını current truth'tan ayır
- Modül: Documentation / Product
- Dosyalar: `RELOCATION_MANAGER_SPEC.md`, `SYSTEM_STATUS.md`, `docs/roadmap/*`
- Sorun tipi: Maintainability / Product
- Etki: Geliştirici ve auditor yanlış sistem varsayımı yapabilir.
- Kanıt: Spec eski DB/auth/document/AI/OCR öğeleri içeriyor; current schema MySQL/custom auth.
- Kontrol yöntemi: Docs/code comparison.
- Beklenen doğru davranış: Current architecture doc ve roadmap açık ayrılmalı.
- Mevcut davranış: Roadmap/current karışık.
- Önerilen aksiyon: Deprecated banner + current architecture snapshot.
- Durum: Riskli

### TODO-AUD-010: Push/SMS capability readiness'i görünür yap
- Modül: Notifications / Mobile
- Dosyalar: `apps/web/src/lib/notifications.ts`, `apps/mobile/STORE_SUBMISSION_CHECKLIST.md`, `apps/mobile/src/lib/push.ts`
- Sorun tipi: Notification / UX / Ops
- Etki: Kullanıcı push/SMS beklerken delivery env/capability kapalı olabilir.
- Kanıt: Push env flag ile; SMS provider implementasyonu yok.
- Kontrol yöntemi: Notification service inspection.
- Beklenen doğru davranış: Kanal availability UI/readiness check.
- Mevcut davranış: Preferences ve register var; provider availability net yüzey değil.
- Önerilen aksiyon: Admin health + user-facing unavailable state.
- Durum: Belirsiz/Riskli
