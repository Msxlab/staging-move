# Tam QA Checklist — kod + commit/deploy + UI (eksiksiz)

> Sıra: önce kod (local) → commit/deploy → yeni UI → consumer regresyon → güvenlik → cron → connector SHADOW → gerçek push.
> Connector şu an **inert** (kapalı), o yüzden connector ekranları SHADOW açılana kadar **boş** görünür — bu normaldir.

---

## 0) KOD — deploy'dan ÖNCE (local, tek komutla doğrula)
- [ ] `pnpm verify:typecheck` → **PASS**
- [ ] `pnpm verify:tests` → **hepsi yeşil** (web 1472 · admin 501 · mobile 42 · connectors 92)
- [ ] `pnpm lint` → PASS
- [ ] `pnpm build` → PASS (yalnız bilinen Next/edge/prisma uyarıları kabul)
- [ ] `git diff --check` → temiz (whitespace/conflict yok)

## 1) COMMIT & DEPLOY
- [ ] `git push` → branch **ahead 0** (3 UI commit'i gitti: `392e430`, `70082d3`, `0cba738`)
- [ ] DigitalOcean: yeni deploy **ACTIVE**, build adımları yeşil
- [ ] `migrate:status` → **No pending** (3 migration zaten uygulanmış)
- [ ] `GET /api/ready` → 200, `ready=true` · `GET /api/health` → healthy

## 2) YENİ UI — bu turda eklediklerim (push+deploy SONRASI)

### 2a) Admin → **Connector Metrics** (`/connector-metrics`)
- [ ] Admin sidebar / ⌘K'da **"Connector Metrics"** görünüyor (connectors:canRead yetkisiyle)
- [ ] Sayfa açılıyor, başlık + (inert olduğu için) **"No dispatches yet"** boş durumu
- [ ] Console error yok
- [ ] (SHADOW/GA'da veri olunca) tablo: connector başına confirm-rate %, confirmed/needs-user/failed/in-flight/total — **shadow satırları hariç**

### 2b) Admin → **Connector Fallbacks** (`/connector-fallbacks`)
- [ ] Sidebar / ⌘K'da **"Connector Fallbacks"**
- [ ] Sayfa açılıyor, **"No fallback actions yet"** boş durumu
- [ ] **"Add fallback"** → form açılıyor
- [ ] Geçerli kayıt ekle (örn. `actionKey=acme:MAILTO`, `connectorKey=acme`, `type=MAILTO`, `urlTemplate=mailto:support@acme.com`) → **kaydoluyor**, listede görünüyor
- [ ] **Inline validation:** `type=MAILTO` iken `https://...` gir → **kırmızı uyarı + Save pasif**
- [ ] **Unsafe URL:** `javascript:alert(1)` → uyarı + (kaydetmeye çalışırsan sunucu **400** ile reddeder, DB'ye yazmaz)
- [ ] **Preview:** label/url yazınca canlı önizleme görünüyor
- [ ] **Edit:** bir kaydı düzenle → kaydoluyor (actionKey değişmez)
- [ ] **Delete:** sil → listeden kalkıyor
- [ ] **Audit:** admin audit log'da `UPSERT` / `DELETE` / (reddedilen) `REJECT` kayıtları görünüyor
- [ ] **Override etkisi:** eklediğin fallback, connections ekranında in-code default'u eziyor (SHADOW/guided'de)

### 2c) Web → **Address change history** (`/settings/address-changes`)
- [ ] Settings sayfasında **"Address change history"** linki var (Connections'ın altında)
- [ ] Açılıyor, (inert → event yok) **"No address changes yet"** boş durumu
- [ ] Console / hydration error yok
- [ ] Üstteki **"Connections"** geri linki çalışıyor
- [ ] (SHADOW/GA'da) adres değişince: değişiklik + connector-bazlı durum görünür, **shadow dispatch'ler listede YOK**, şifreli alan sızmıyor

## 3) CONSUMER GO-LIVE — tam regresyon (mevcut akış)
**Auth:** [ ] email/Google/Apple giriş · [ ] Apple sonrası zorla şifre YOK · [ ] OAuth kullanıcıya set/reset-password maili · [ ] web'de IP değişince oturum düşmüyor · [ ] logout · [ ] hesap silme (case-insensitive "delete", OAuth şifresiz)
**Billing (Stripe test/no-charge):** [ ] 6 plan checkout · [ ] upgrade anında / downgrade scheduled / cancel · [ ] ilk ödeme başarısız→UNPAID, yenileme→PAST_DUE · [ ] webhook'lar · [ ] subscription sayfası hydration sorunsuz
**IAP:** [ ] iOS sandbox/TestFlight + Android License-testing satın alma + restore · [ ] test purchase sadece QA email
**Legal:** [ ] terms/privacy/contact'ta "AXTRA SOLUTIONS LLC" + adres · [ ] refund/DPA/about
**Mobil:** [ ] 3 ekran crash yok (providers/[id], budget/new) · [ ] Services checklist render (console error yok)
**Public:** [ ] pricing Individual/Family/Pro görünüyor, console error yok

## 4) GÜVENLİK (canlıda, çoğu fail-closed = kasıtlı 401)
- [ ] `/api/cron/connector-dispatch` secretsiz → **401**
- [ ] `/api/connectors/changes` auth'suz → **401**, auth'lu → 200 ama **şifreli/token alanı YOK**
- [ ] `/api/connector-fallbacks` auth'suz → **401**
- [ ] `POST /api/connectors/usps/webhook` imzasız → **401**
- [ ] Login rate limit: 12 yanlış → lockout; normal giriş sorunsuz
- [ ] Admin login brute-force koruması
- [ ] IAP test purchase sadece allowlisted QA email

## 5) CRON / arka plan
- [ ] Connector dispatch cron QUEUED satırları işliyor (CRON_SECRET ile)
- [ ] Stale sweeper: DISPATCHING>15dk → NEEDS_USER; SUBMITTED>7gün → NEEDS_USER (gözlem)
- [ ] Bill/contract reminders + weekly digest → opt-out'a saygı
- [ ] Stripe reconcile cron

## 6) CONNECTOR SHADOW PİLOTU (flag açınca — runbook 13)
- [ ] `FEATURE_API_CONNECTORS` bilinçli aç + USPS `ConnectorConfig`: enabled=true, stage=SHADOW
- [ ] QA kullanıcısına USPS GRANTED consent (sandbox veya kontrollü seed)
- [ ] Primary adresi değiştir (from+to)
- [ ] **Beklenen:** `ConnectorDispatch` `isShadow=true`, status `CONFIRMED`; **USPS'e gerçek COA GİTMEDİ**; kullanıcıya bildirim YOK
- [ ] `AddressChangeEvent` satırı oluştu
- [ ] Şimdi **yeni UI'lar dolar:** `/settings/address-changes` event'i gösterir (shadow dispatch hariç) · `/connector-metrics` (shadow hariç sayar)
- [ ] **Kontrol düzlemi:** kill-switch (enabled=false)→fallback · circuit OPEN→defer · rate limit (>2/gün skip) · consent revoke→NEEDS_USER
- [ ] Bitince: flag + config + consent temizle

## 7) GERÇEK PUSH (⚠️ sadece gerçek USPS agreement varsa — runbook 13/§8)
- [ ] PRODUCTION agreement + credentials + stage=GA → gerçek adres değişimi → **gerçek COA dosyalanır**, SUBMITTED→CONFIRMED
- [ ] ⚠️ Gerçek change-of-address — sadece gerçek taşınan test hesabıyla

---

## Test edilemeyenler (bağımlılık)
- Gerçek USPS push → authorized-agent agreement gerekir (yoksa SHADOW + guided test edilir)
- 2. partner connector → henüz yok (anlaşma sonrası)
- Resmi pentest / SOC 2 → ayrı iş (büyük partner için, ertelendi)
