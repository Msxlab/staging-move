# 18 · Open Items — Düzeltilecekler & Açık Kararlar

Single consolidated register of everything still to decide or fix before/with implementation. Detail lives in the linked reports; this is the checklist so nothing is lost. `[ ]` = open · `[x]` = already resolved at doc level.

> **Post-audit (2026-06-21):** a full pre-merge audit fixed the P0/P1 blockers and most P2s. Items below now marked `[x]` were closed by that pass — see [exec/AUDIT-FIXES.md](exec/AUDIT-FIXES.md) for the authoritative record (migrations, lead-dispatch cron, send-time approval re-check, override Option-(a), worker hardening, leadsOptIn consent, portal/analytics hardening) and the deferred items with rationale (mover opt-in UI, dossier daily backstop, H7 cache epoch, R5c+/R6 legal-gated).

---

## A. Açık kararlar (owner/product — koddan önce)

- [ ] **Coming-soon tier adları:** "Concierge" + "Business" kesinleştir (+ Türkçe/İspanyolca yerelleştirme). → [03](03-MARKETING-HOMEPAGE.md), [11](11-COPY-I18N.md)
- [ ] **Sonlu suistimal cap sayıları** (UNLIMITED yerine): adres (~1–2k?), servis (~5–10k?), custom provider (~1–2k?) — **web↔mobil ortak**. → [16](16-LOGIC-HOLES-AND-EDGE-CASES.md) H6/H8
- [ ] **Web↔mobil cap politikası:** "her yerde PRO/sonlu cap" mı, "her yerde sınırsız" mı? (öneri: ortak sonlu cap — H6+H8'i birlikte çözer). → [16](16-LOGIC-HOLES-AND-EDGE-CASES.md) H8
- [ ] **Kullanıcı/gün maliyet cap'leri:** AI briefing üretimi, dossier dış-API sorguları, weatherDigest — sayıları belirle. → [15](15-COST-CACHE-LIMITS.md), [16](16-LOGIC-HOLES-AND-EDGE-CASES.md) M4
- [ ] **apiConnectors maliyet kapları:** herkese açık (PRO) ama per-user connector sayısı + senkron sıklığı limiti + global harcama alarmı. → [13](13-RISKS-ROLLBACK.md), [15](15-COST-CACHE-LIMITS.md)
- [ ] **Doküman kasası depolama kotası** (R2 maliyeti) — kullanıcı başına makul tavan. → [15](15-COST-CACHE-LIMITS.md)
- [ ] **Gelecekteki ödeyen-taban politikası:** Concierge/Business kullanıcıları ≥ free-PRO tabanına sabitle. → [16](16-LOGIC-HOLES-AND-EDGE-CASES.md) H5
- [ ] **Setup-grace 3-adres cap'inin kalkması kabul mü?** (yoksa `isActive`'den bağımsız yeniden ifade et). → [16](16-LOGIC-HOLES-AND-EDGE-CASES.md) M3
- [x] **`CONSUMER_FREE` temsili:** Option (a) seçildi — `getEffectiveEntitlement(sub, now, { applyConsumerFree })` + web `resolveConsumerEntitlement` helper, tüm tüketici gate'lerinde tek nokta. → [exec/AUDIT-FIXES.md](exec/AUDIT-FIXES.md)
- [x] **Herkes PRO** (mobil Pro tema dahil) — karar verildi.
- [x] **Her şey ücretsiz; cache + maliyet/limit korunur** — karar verildi. → [15](15-COST-CACHE-LIMITS.md)
- [x] **Mevcut ödeyen müşteri yok** — iptal/iade konusu yok.

## B. Mutlaka düzeltilecek — yüksek (kodla birlikte)

- [x] **H1 · Override PARAM olmalı, env-global DEĞİL** — yapıldı: `applyConsumerFree` param'ı (default false), admin RAW. → [exec/AUDIT-FIXES.md](exec/AUDIT-FIXES.md)
- [x] **H2 · `planFeatures` override'ı DÜŞÜRÜLDÜ** — mekanizma `getEffectiveEntitlement` param'ı; `planFeatures` saf kaldı.
- [x] **H3 · Koltuklar override'a bağlandı** (P1-2) — invitations/invite-accept/create-workspace `resolveConsumerEntitlement` kullanıyor; iptal/iade/expired ödeyen ownership-reconcile'da RAW kalıyor.
- [x] **H4 · Concurrent-plan limiti** — bayrak açıkken sonlu tavan (25) uygulandı.
- [ ] **H5 · Ödeyen-taban** — gelecekteki ödeyen asla free-PRO'dan kötü olmasın. (hâlâ açık — gelecekteki Concierge/Business launch'ında)
- [x] **H6 · Sonlu abuse cap + custom provider sayım kontrolü** — PR1a'da yapıldı (PRO cap'leri, MAX_SAFE_INTEGER değil).
- [ ] **H7 · Cache flip'te bayatlık** — flip-time concern; Step 3 (flag flip) ile koordine yapılacak. → [exec/AUDIT-FIXES.md](exec/AUDIT-FIXES.md)
- [ ] **H8 · Web↔mobil cap hizala** + mobildeki satılmayan "Upgrade" uyarısını nötrle. (Step 5 — mobil pivot)

## C. Düzeltilecek — orta

- [ ] **M1 · Snapshot çelişkisi** — `status=EXPIRED` ama `isActive/plan=PRO` → ayarlar "plan seç" gösterir; fullAccess'te status'u normalize et veya UI yalnız `isActive/plan` okusun.
- [ ] **M2 · UNLIMITED sentinel ekrana sızıyor** — `service-usage-indicator` "3 / 9007…" basıyor; ortak `isUnlimited()` guard'ı.
- [ ] **M3 · Setup-grace cap'i** kararı (yukarı A'da).
- [ ] **M4 · weatherDigest e-posta patlaması** — per-user/gün cap + cron alıcı sayısı testi.
- [ ] **M5 · Maliyet-bypass testi** — override'ın rate-limit/AI-cap'i atlamadığını kanıtla.

## D. Temizlik — düşük (ölü/karışık kalmasın)

- [ ] **L1** Onboarding free-teaser + `writeFreeMovePreviewContext` + dashboard `freeMovePreview` ölü dallarını gizle/temizle. → [16](16-LOGIC-HOLES-AND-EDGE-CASES.md)
- [ ] **L2** `UX_ONBOARDING_TEASER` deneyini launch öncesi "control"a sabitle (yoksa herkese fazladan teaser ara-ekranı).
- [ ] **L3** Trial-check/checkout-cleanup cron'larının "ücret alınacak" bildirimlerini dormant doğrula. → [09](09-PAYMENTS-BILLING-PRESERVED.md)
- [ ] **L4** Sessizleşen analytics event'leri (`planTier:'free'`, `move_teaser_viewed`, `UPGRADE_CLICKED`) için dashboard'ları güncelle. → [10](10-ANALYTICS-FLAGS.md)
- [ ] **L5** Mobil "Limit reached" / essentials ölü kopyasını gizle. → [06](06-MOBILE.md)

## E. Doc düzeyinde zaten düzeltildi

- [x] **L6a** `entitlement.test.ts` doğru yol: `packages/shared/src/__tests__/entitlement.test.ts` ([01](01-ENTITLEMENTS-AND-GATES.md)/[12](12-TESTS.md) güncellendi).
- [x] **L6b** `planFeatures`'ın `fullAccess` param'ı henüz YOK — yeni iş olduğu not edildi; lever 2 düşürüldüğü için gerek de yok.
- [x] Mekanizma "3 lever" → "2 param'lı override" olarak düzeltildi ([00](00-OVERVIEW.md)/[01](01-ENTITLEMENTS-AND-GATES.md)).

## F. Para-kazanma motoru (kategori bazlı marketplace) — açık kararlar → [19](19-MONETIZATION-ENGINE.md)

> Omurga zaten kurulu (affiliate click→conversion→postback, SponsoredPlacement, mover portalı, öneri motoru, Stripe/webhook). İş: genelleştir + bağla + lead-gen ekle. Kararlar:

- [ ] **İlk launch kategorisi** (öneri: zaten kurulu affiliate/sponsored'ı *yüzeye çıkar* + *movers lead-gen* — ikisi de mevcut altyapıya biniyor).
- [ ] **Kategori başına gelir modeli + oranlar** (CPC/CPL/CPA/flat) ve kim belirleyecek.
- [ ] **Self-serve reklam ödemesi mi, ops-yönetimli satış mı** (bugün placement = e-posta-ops).
- [ ] **Lead paylaşım onayı + Privacy/Terms güncellemesi** (hukuk) — kullanıcı verisi partnera gidiyor.
- [ ] **Sigorta/finans regülasyonu:** affiliate-only mu, lisanslı lead-gen mi (büyük hukuki karar) + eyalet-uygunluk gating.
- [ ] **Payout/rev-share mekaniği** (Stripe Connect vs manuel) + partner faturalama.
- [ ] **Generic Partner modeli**'ni mover portalından genelleştir (cleaning/junk önce — FMCSA yok); junk-removal kategorisini taksonomiye ekle.
- [ ] **Mutlaka-önce uyumluluk:** affiliate "komisyon kazanabiliriz" açıklaması CTA yanına (web+mobil) + regülasyonlu kategori açıklamaları — *para akmadan önce*.
- [ ] **Ranking bütünlüğü korunur:** sponsored = ayrı etiketli slot; organik sıralama ASLA satılmaz.

---

**Uygulama sırası ve test ızgarası:** [14-EXECUTION-CHECKLIST](14-EXECUTION-CHECKLIST.md) (fazlar) + [17-TEST-MATRIX](17-TEST-MATRIX.md) (testler). Bu register o ikisinin "açık uçlar" özetidir.
