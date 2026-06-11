# LocateFlow Tam Sistem Denetimi — Round 2

Kural: .md raporlar ve memory OKUNMAZ — yalnız kod/schema/config/test/route dosyaları.
Rol: Kıdemli full-stack denetçi (QA + güvenlik + ürün + SEO).
Her bulgu: `Katman | Önem (Kritik/Yüksek/Orta/Düşük) | Bulgu | Neden sorun | Önerilen çözüm` + dosya:satır.
Her modülde 5 soru: (1) uçtan uca çalışıyor mu? (2) mantıksızlık var mı? (3) eksik var mı? (4) hata/açık var mı? (5) iyileştirme?

## 0. Envanter
- [x] Modül ağacı çıkarıldı (web 40+ route grubu, admin 36 modül, mobil 20+ ekran, shared 35+ lib, connectors)
- [x] Klasör oluşturuldu: reports/full-audit-round2/

## 1. WEB-PUBLIC (rapor: 01_web_public.md)
- [ ] Anasayfa + marketing bileşenleri (render, linkler, responsive, hata durumları)
- [ ] Pricing + plan kıyas (mantık, hesaplama, yeni matris tutarlılığı)
- [ ] Blog (render, kategori, RSS, view sayacı, revalidation)
- [ ] SEO: meta, sitemap, robots, canonical, schema.org, og-image, kırık link
- [ ] GEO: llms.txt / llms-full.txt, state-SEO sayfaları, AI-görünürlük
- [ ] Legal sayfalar (terms/privacy/disclaimer/refund/dpa/ccpa) + consent akışı

## 2. WEB-APP (rapor: 02_web_app.md)
- [ ] Auth: register/login/MFA/OAuth/reset/verify + mobile bridge
- [ ] Onboarding (4 adım + coach + Pro-showcase + draft persistence)
- [ ] Dashboard + kartlar (briefing, route map, dossier, countdown)
- [ ] Addresses (CRUD, autocomplete, validation, dossier, statik harita)
- [ ] Services + providers + recommendations + custom providers
- [ ] Moving plans + move tasks + migration engine + reminders
- [ ] Budget/expenses + export (CSV/PDF) + vehicles + movers
- [ ] Workspaces (üyeler, davet, owner-cascade, transfer)
- [ ] Notifications + push + unsubscribe + tracking

## 3. WEB-BILLING (rapor: 03_web_billing.md)
- [ ] Stripe checkout/portal/webhook (imza, idempotency, yarış)
- [ ] IAP: App Store + Play webhooks (reserve-before-act doğrula)
- [ ] Abonelik yaşam döngüsü: trial, yenileme, iptal, downgrade overflow
- [ ] Entitlement çözümü (getEffectiveEntitlement ↔ plan-limits ↔ FEATURES)
- [ ] İade/refund akışı + vergi + fatura

## 4. ADMIN (rapor: 04_admin.md)
- [ ] Auth/MFA/step-up/roller/permissions + break-glass
- [ ] Users/subscriptions/billing override'ları
- [ ] Providers/coverage/governance/state-rules/movers
- [ ] Blog/help-center/email-templates/notifications
- [ ] Backups/runtime-config/feature-flags/security/logs
- [ ] Insights/sponsored/affiliate/analytics/reports/acquisition
- [ ] CRUD'larda hata yönetimi + audit yazımı tutarlılığı

## 5. MOBILE (rapor: 05_mobile.md)
- [ ] Auth + secure store + app lock + OAuth/Apple
- [ ] Tabs: dashboard/addresses/services/moving/more + derin ekranlar
- [ ] Onboarding + paket karşılaştırma + IAP akışı
- [ ] Offline davranışı (cache yok — etki analizi), hata durumları, izinler
- [ ] Push + reminders + widget + store uyumluluğu (Apple/Google kuralları)
- [ ] Hermes uyumluluğu + i18n parite + tema

## 6. SHARED + DB + OPS (rapor: 06_shared_db_ops.md)
- [ ] packages/shared: entitlement/billing/migration-engine/recommendation/legal
- [ ] packages/connectors: registry/dispatcher/retry/circuit-breaker/USPS
- [ ] Prisma schema: ilişkiler, index'ler, unique'ler, soft-delete tutarlılığı
- [ ] Migrations + seeds bütünlüğü
- [ ] cron.yml zinciri + CI + Docker/standalone

## 7. CROSS-LAYER (rapor: 07_cross_layer.md)
- [ ] Web↔mobile API sözleşmesi (her mobil çağrının web karşılığı)
- [ ] Admin↔web DB modeli kullanım sınırları + yetki
- [ ] Cron/webhook/idempotency/rate-limit/audit zincirleri
- [ ] Yarış durumları, null/boş durumlar, edge case'ler
- [ ] Veri tutarlılığı (sayaçlar, cascade'ler, orphan riski)

## 8. SENTEZ (rapor: FINDINGS.md + FINAL_REPORT.md)
- [ ] Tüm bulgular tek tabloda (önem sıralı)
- [ ] Kritik/Yüksek düzeltmeleri UYGULA
- [ ] Genel sağlık özeti + öncelikli aksiyon listesi

## 9. BUILD + TEST
- [x] iOS production build başlatıldı (09203976)
- [x] Android production build başlatıldı (3d61b7a9)
- [ ] Build'ler bitince: iOS → TestFlight submit, Android → hazır .aab
- [ ] Yeni build'lerle test (owner cihaz testi + benim canlı doğrulamam)
