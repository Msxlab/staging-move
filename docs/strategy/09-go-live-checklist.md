# Track 1 — Go-Live Checklist (consumer app'i çıkar)

> Kim / ne / nerede / doğrulama. Yeni özellik YOK; mevcut çıkışı bitir. Sırayla işaretle.

Tarih: 2026-06-04 · Branch: `codex/release-readiness-mobile-billing-guards`

---

## T1.1 — AddressChangeEvent uygula & doğrula  · sahip: eng
- [ ] Migration'ı incele: `packages/db/prisma/migrations/20260604000000_add_address_change_event/migration.sql`
- [ ] Docker DB ayakta + `DATABASE_URL` set
- [ ] `pnpm --filter @locateflow/db migrate:deploy`
- [ ] Production/staging gibi paylaşılan DB'lerde migration klasörü silme veya uygulanmış migration'ı yeniden yazdırma yok. Hata olursa dur, backup/hedef DB/migration geçmişini incele.
- [ ] `pnpm --filter @locateflow/db generate`  *(Windows file-lock olursa dev server'ı kapat, tekrar dene)*
- [ ] `apps/web` derleniyor (`prisma.addressChangeEvent` çözülüyor)
- [ ] Doğrula: `apps/web/scripts/smoke-connector-dispatch.ts` → bir `AddressChangeEvent` satırı + ona bağlı `ConnectorDispatch` (addressChangeEventId dolu)

## T1.2 — B1 fix (`t.completed` hayalet alan)  · sahip: eng
- [ ] `apps/web/src/app/(app)/services/services-client.tsx:137` → `t.completed` yerine `t.status === "COMPLETED"`
- [ ] `apps/mobile/app/(tabs)/services.tsx:192` → aynı  *(NOT: bu dosya paralelde düzenleniyor — çakışmayı kontrol et)*
- [ ] `templateId` kaynağını doğrula: top-level mi yoksa `metadata` JSON içinde mi? (filtrenin `t.templateId` yarısı da çalışmalı)
- [ ] `dashboard-client.tsx:258` → `completedTemplates` bilerek boş mu kalsın, yoksa doldurulsun mu? (karar)
- [ ] Test ekle (tamamlanan task → şablon "done" işaretleniyor)

## T1.3 — Operasyonel / uyumluluk kapıları  · sahip: you / ops / legal
- [ ] `NEXT_PUBLIC_LEGAL_ENTITY_NAME` → gerçek tüzel kişi adı (DigitalOcean prod env) · yüzey: web + mobil legal sayfaları
- [ ] `NEXT_PUBLIC_COMPANY_ADDRESS` → gerçek posta adresi (DigitalOcean prod env)
- [ ] Stripe **test-mode/staging** kataloğunu tekrar doğrula: Individual/Family/Pro monthly/yearly altı price mevcut ve full plan-matris E2E koşulabiliyor
- [ ] `QA_RESETTABLE_ACCOUNT_EMAIL` → DigitalOcean'da set (Play test satın alma allowlist'i)
- [ ] App Store: demo credential (out-of-band, commit ETME) + App Privacy formu (App Store Connect)
- [ ] Play: RTDN push doğrula + internal build upload blocker'ı çöz

## T1.4 — Final QA + submit  · sahip: eng / you
- [ ] Stripe katalog tamamlanınca: plan-değişim matrisi (36 geçiş) staging'de yeşil
- [ ] Mobil auth: Apple/Google sign-in, password set/reset, hesap silme (case-insensitive) akışları
- [ ] Stripe webhook idempotency + başarısız ilk ödeme (`UNPAID`) davranışı
- [ ] Hydration: abonelik sayfası dışında `new Date()` SSR kullanımı kalmış mı (hızlı tara)
- [ ] App Store review submission ve Play internal/staged submission durumunu doğrula. Production release/rollout ayrı açık owner onayı gerektirir.

---

## Çıkış kriteri (hepsi yeşil olunca "çıktı")
- Migration uygulanmış + smoke yeşil · B1 kapalı · legal/adres gerçek · Stripe matris yeşil · mobil auth akışları geçti · store submission gönderildi.

## NOT
- Bu liste **yeni panel/özellik içermez**. Connector ağı (Katman 4) Track 3'tür; go-live'ı geciktirmesin.
- Review temizliği (worktree'de paralel yapılıyor) Track 1'in parçası değil — ayrı commit'le.
