# Canlı (Production) Test Planı — neleri elle test etmelisin

> Otomatik test sayıları değişebilir; canlıya çıkmadan hemen önce `verify:tests`,
> `verify:typecheck`, `lint`, `web build` ve `admin build` yeşil olmalı. Bu liste
> **canlıda insan eliyle** doğrulanacak şeyler.
> Sıra önemli: önce foundation, sonra consumer go-live (asıl launch), sonra connector (flag-gated, staged), sonra güvenlik/cron.

---

## 0) ÖN KOŞUL — Foundation (bunsuz hiçbiri çalışmaz)
- [ ] `pnpm --filter @locateflow/db migrate:deploy` → hedef `DATABASE_URL` üzerinde 3 migration uygulandı (`address_change_event`, `connector_fallback_action`, `connector_dispatch_shadow_mode`). Production için bu gerçek şema değişikliğidir; önce hedef/backup/deploy penceresi doğrulanır.
- [ ] `pnpm --filter @locateflow/db generate` → client üretildi
- [ ] `pnpm --filter @locateflow/web build` + `pnpm --filter @locateflow/admin build` hatasız (prisma.addressChangeEvent / connectorFallbackAction çözülüyor)
- [ ] App boot oluyor, mevcut sayfalar açılıyor (schema değişikliği regresyon yapmadı)

---

## 1) CONSUMER GO-LIVE (asıl launch yolu — en kritik)

### Auth
- [ ] Email signup + doğrulama maili gelir
- [ ] Google ile giriş · Apple ile giriş (Apple sonrası **zorla şifre kurma YOK**)
- [ ] OAuth-only kullanıcı: Settings → Privacy'den "set password" / "change password" maili gelir
- [ ] Web'de **IP değişince oturum düşmüyor** (wifi↔hücresel/VPN aç-kapa) — `cba9396` fix
- [ ] Logout · tekrar login
- [ ] Hesap silme: yazılan onay metni **case-insensitive** ("delete"/"DELETE"/"eliminar"), OAuth-only kullanıcı şifre olmadan silebiliyor

### Billing (Stripe — staging/test-mode; production'da gerçek ödeme yok)
- [ ] 6 plan checkout: Individual/Family/Pro × Monthly/Annual → staging/test-mode veya no-charge test akışıyla başarı, abonelik aktif
- [ ] Upgrade (anında geçer) · Downgrade (dönem sonuna **scheduled**)
- [ ] Cancel (dönem sonu) · iptal nedeni anketi kaydoluyor
- [ ] İlk ödeme **başarısız** → hesap `UNPAID` (grace YOK); yenileme başarısız → `PAST_DUE` (7 gün grace)
- [ ] Webhook'lar geliyor, abonelik durumu güncelleniyor
- [ ] Subscription sayfası: **hydration mismatch yok** (tarih server/client tutarlı), firstChargeDate doğru

### IAP (mobil)
- [ ] iOS sandbox/TestFlight satın alma · Android Play License testing satın alma · restore
- [ ] Test satın alma **sadece** `QA_RESETTABLE_ACCOUNT_EMAIL` için kabul; başkasına 424/red
- [ ] Store-disabled QA build'de plan kartları görünür ama satın alma read-only

### Legal / public
- [ ] terms / privacy / contact → **"AXTRA SOLUTIONS LLC" + Woodland Park adresi** (placeholder YOK)
- [ ] refund / DPA / about sayfaları doğru

### Mobil
- [ ] 3 ekran açılıyor (providers/[id], budget/new) — crash yok
- [ ] Services ekranı checklist'i render oluyor (B1 sonrası crash/console-error yok)

---

## 2) CONNECTOR LAYER-4 (flag-gated → STAGED test)

> Connector'lar `FEATURE_API_CONNECTORS` + bir `ConnectorConfig` satırı olmadan **inert**. Not: `FEATURE_API_CONNECTORS`
> mevcut kodda global runtime/env switch'tir, per-user FeatureFlag değildir. Production SHADOW pilotu kısa izlenen pencere,
> staging ortamı veya önceden kodlanmış user-targeted gate ile yapılmalı.

### 2a) SHADOW dry-run (G2) — SIFIR YAN-ETKİ, önce bunu test et
- [ ] `FEATURE_API_CONNECTORS` bilinçli aç + USPS için `ConnectorConfig`: `enabled=true, stage=SHADOW`
- [ ] QA kullanıcısı için USPS `PartnerConsent` hazırla (sandbox OAuth veya kontrollü admin/script seed)
- [ ] Primary adresini değiştir (from + to dolu)
- [ ] **Beklenen:** `ConnectorDispatch` satırı `isShadow=true`, status `CONFIRMED`; executor `dryRun=true` olduğu için **USPS'e gerçek COA GİTMEDİ**; kullanıcıya bildirim **gitmedi**; `resultMetadataJson.shadow=true`
- [ ] AddressChangeEvent satırı oluştu, `dispatchCount` real push'ları sayıyor (shadow hariç)

### 2b) Fallback / GUIDED_UPDATE (G3)
- [ ] Agreement olmayan USPS (veya push edemeyen connector) → connections ekranında **guided buton** görünür, `moversguide.usps.com`'a gider
- [ ] Admin'den `ConnectorFallbackAction` ekle (örn. acme:MAILTO) → connections'da **DB override** in-code default'u eziyor
- [ ] Admin'de **unsafe URL** (`javascript:...`) reddediliyor (400), DB'ye yazılmıyor; blocked attempt audit log'a düşüyor
- [ ] mailto/tel/https template doğru render (taşınma adresi `{{to.city}}` dolu)

### 2c) ★ Adres-değişim timeline (API)
- [ ] `GET /api/connectors/changes` → kullanıcının event'leri + connector-bazlı durum
- [ ] **shadow dispatch'ler listede YOK** (`isShadow:false` filtresi)
- [ ] Şifreli alanlar (payload/confirmation) response'ta YOK

### 2d) Kontrol düzlemi
- [ ] Kill switch: `ConnectorConfig.enabled=false` → dispatch fallback'e drenaj
- [ ] Circuit `OPEN` → dispatch deferred (QUEUED'a geri)
- [ ] Rate limit: aynı gün >2 USPS → 3.'sü skip (perUserPerDay=2)
- [ ] ROLLOUT %: stage=ROLLOUT, rolloutPercent=50 → kullanıcıların ~yarısı dispatch
- [ ] Consent revoke → bekleyen dispatch `NEEDS_USER`

### 2e) GERÇEK push (⚠️ sadece gerçek USPS agreement varsa)
- [ ] PRODUCTION agreement + credentials + stage=GA → gerçek adres değişimi → **gerçek COA dosyalanır**, status SUBMITTED→CONFIRMED, confirmation şifreli saklanır
- [ ] ⚠️ Bu GERÇEK bir change-of-address dosyalar — sadece test hesabı/gerçek taşınma ile

---

## 3) GÜVENLİK (sertleştirmeler normal kullanımı kırmıyor mu)
- [ ] Web oturumu IP değişince düşmüyor (yukarıda) · mobil zaten muaf
- [ ] Login rate limit: 12 yanlış deneme → lockout; normal giriş sorunsuz
- [ ] Admin login brute-force koruması
- [ ] Cron endpoint'leri `CRON_SECRET` olmadan **çağrılamıyor** (401)
- [ ] IAP test purchase sadece allowlisted QA email

---

## 4) CRON / arka plan (canlı schedule)
- [ ] Connector dispatch cron QUEUED satırları işliyor
- [ ] Stale sweeper: DISPATCHING>15dk → NEEDS_USER; SUBMITTED>7gün → NEEDS_USER (zaman gerektirir, gözlem)
- [ ] Bill reminders / contract reminders / weekly digest → opt-out'a saygı (CAN-SPAM)
- [ ] Stripe reconcile cron

---

## 5) Test edilemeyenler (bağımlılık)
- Gerçek USPS push → gerçek authorized-agent agreement gerekir (yoksa sadece SHADOW + GUIDED test edilir)
- Diğer partner connector'ları → henüz yok (Lob/insurtech/Arcasia pilotları sonrası)

---

## Öncelik sırası
1. **Foundation (0)** → 2. **Consumer go-live (1)** [asıl launch] → 3. **Güvenlik (3)** → 4. **Connector SHADOW+fallback (2a-2d)** → 5. Cron (4) → 6. Gerçek push (2e, agreement gelince).
