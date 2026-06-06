# Katman 4 — "True API Address-Propagation Network" İnşa Planı (en üst seviye)

> Hedef: kullanıcı doğrulanmış adresini bir kere girer → bağlı **tüm** partner'lara (USPS, sigorta, utility, banka, …) izinli, güvenli, doğrulanmış şekilde yayılır.
> Bu doküman koda dayanır. Engine ~%85 hazır; bu plan kalan %15 platform işi + partner stratejisi + hukuk/compliance + faz planıdır.

Tarih: 2026-06-04 · Kaynak: `packages/connectors/**`, `apps/web/src/lib/connector-runtime.ts`, Prisma şema, dispatch/webhook route'ları.

---

## PART I — Elindeki gerçek (sıfırdan başlamıyorsun)

### ✅ ZATEN BUILT (production-grade)
| Alan | Kanıt |
|---|---|
| Adapter kontratı (`AddressConnector`: buildRequest/push/verify/parseWebhook/healthCheck) | `core/connector.ts` |
| Executor, registry, manifest doğrulama, **mode resolution** (API_SYNC/GUIDED_UPDATE/COMING_SOON/DISABLED) | `core/{executor,registry,manifest,mode}.ts` |
| HTTP client: egress allowlist + redirect re-check + timeout + circuit breaker | `core/http-client.ts`, `core/circuit-breaker.ts` |
| Retry + backoff + jitter (sadece RATE_LIMITED/PARTNER_DOWN retryable) | `core/retry.ts` |
| Redacting logger, field schema, OAuth **PKCE** helpers | `core/{logger,fields,oauth}.ts` |
| **USPS = GERÇEK API** (apis.usps.com): push/verify/health, idempotent 409→CONFIRMED | `usps/index.ts` |
| Dispatch state machine + atomik claim + retry budget + **stale-DISPATCHING sweep (>15dk→NEEDS_USER)** + rate-limit enforce | `connector-runtime.ts` |
| **Async webhook ingress**: HMAC-SHA256 imza + replay koruması + parseWebhook→dispatch mutation | `api/connectors/[key]/webhook/route.ts` |
| Consent & token vault: PartnerConsent, şifreli token, refresh+rotation, revocation reasons, in-band reconsent | `connector-oauth.ts`, şema 1714+ |
| Control plane: ConnectorConfig (enabled/rollout%/stage/circuit), rollout bucket enqueue+dispatch'te uygulanıyor | şema 1750+, `connector-runtime.ts` |
| Kapsamlı testler (core + USPS + webhook imza/dedup) | `**/*.test.ts` |

### 🚧 GERÇEK BOŞLUKLAR (Katman 4'ü bloklayan = bunları yap)
| # | Boşluk | Şiddet | Kanıt |
|---|---|---|---|
| G1 | **AddressChangeEvent modeli YOK** (MEMORY'deki "blocker") — dispatch `eventId`'yi gevşek string tutuyor, FK yok | Yüksek | şema ~1708: *"those models don't exist"* |
| G2 | **SHADOW/dry-run gerçek değil** — stage=SHADOW dispatch'i blokluyor ama yan-etkisiz çalıştırmıyor | Yüksek | `mode.ts`/config |
| G3 | **Fallback registry hardcoded** (sadece USPS deep-link); PDF/mailto renderer yok | Yüksek (kapsama) | `guided-connector-actions.ts` |
| G4 | **Per-connector metrics/dashboard yok** (audit var, agregasyon yok) | Yüksek (ops) | metrics tablosu yok |
| G5 | Async confirm yolu **canlı async connector ile test edilmemiş** (USPS sync) | Orta | USPS `parseWebhook` yok |
| G6 | Token refresh **eşzamanlılık altında yarış** (aynı consent'e iki dispatch) | Orta | `connector-oauth.ts` lock yok |
| G7 | Reconsent **UI akışı** yok (revoked/expired → 1-tık yeniden bağla) | Orta | — |
| G8 | Admin'den **manuel circuit trip/reset** yok; **stale-SUBMITTED sweeper** yok | Orta | — |

> **Headline:** Bu boşlukların hepsi **lokal, kırıcı-olmayan** eklemeler. Dispatcher/executor/SDK yeniden yazılmıyor.

---

## PART II — Platform sertleştirme (öncelik sırasıyla)

**P0 — G1: AddressChangeEvent modeli.** Kanonik olayı resmileştir: bir `AddressChangeEvent` satırı (userId, fromAddr, toAddr, effectiveDate, fullName, status, createdAt) → ondan N `ConnectorDispatch` türesin (FK). Kazanç: replay, denetlenebilirlik, "neyi nereye gönderdik" zaman çizelgesi, household fan-out, multi-address. Dispatch mantığı değişmiyor; sadece `eventId` string → FK.

**P0 — G2: Gerçek dry-run (SHADOW).** `ConnectorContext`'e `dryRun: boolean` ekle; connector'lar set olduğunda gerçek API çağrısını atlayıp simüle sonuç dönsün. Neden kritik: **yeni partner'ı gerçek prod trafiğinin şekliyle, sıfır yan-etkiyle** GA'dan önce test edersin. Güvenli partner lansmanının temeli.

**P0 — G3: Fallback 2.0.** DB-destekli fallback registry + PDF/mailto/deep-link renderer + partner-bazlı adım adım kılavuz. **Neden en kritiklerden:** provider'ların ÇOĞU asla write-API vermez → "assisted" varsayılan olmalı. Kapsama (coverage) buradan gelir, marquee API'den değil.

**P1 — G4: Observability.** `ConnectorMetric` sink (connectorKey × saat × attempts/outcomes/latency/errorCode dağılımı) + cron agregatör + admin SLO dashboard + alarmlar (confirm-rate düşüşü, circuit OPEN, SCHEMA_DRIFT). Partner sağlığını görmeden ölçekleyemezsin.

**P1 — G5/G6/G8: Async + concurrency + ops.** Mock async connector ile webhook yolunu uçtan uca test et; per-partner webhook secret rotasyonu; token refresh'e **distributed lock**; admin manuel circuit kontrolü; stale-SUBMITTED sweeper.

**P2 — G7 + SDK scaffolding.** Reconsent UI (1-tık yeniden bağla); `create-connector` generator + recorded-fixture contract-test harness → **yeni partner = 1 günlük iş.**

---

## PART III — Güvenlik / Compliance / Hukuk (Group C'nin GERÇEK kapısı)

Bankalar ve büyük utility'ler kodla değil, **güvenle** ikna olur. Bunlar olmadan büyük partner masaya oturmaz:

1. **SOC 2 Type II** — fiili zorunluluk. Banka/büyük utility imzalamadan önce ister. **6-12 ay sürer → ŞİMDİ başlat.**
2. **Hukuki carve-out** — `legal.ts`'teki *"does not update an external provider account unless the product screen expressly says a supported integration performed that action"* cümlesi zaten Katman 4'ün kapısı. Connector başına **DPA** (data processing agreement) + veri-akışı ifşası.
3. **Sektörel uyum** — finansal veri için **GLBA**; **CCPA/CPRA** + eyalet gizlilik yasaları; pen-test; **cyber insurance**.
4. **Consent mimarisi** — partner-bazlı, scope'lu, geri alınabilir, **immutable snapshot**, consent receipt. UI'da "şu entegrasyon şunu yaptı" anı (legal carve-out'u karşılar). PartnerConsent çoğunu zaten yapıyor.
5. **Yetkilendirme modelleri** (her partner'ı birine eşle):
   - (a) **Kullanıcı-delege OAuth** (partner'da kullanıcı login + scope verir) — en temiz, USPS gibi.
   - (b) **B2B trusted-integrator API key** (sen güvenilir entegratörsün) — SOC2 + sözleşme ister.
   - (c) **Assisted / no-auth** (deep-link/PDF) — API yoksa.
6. **Data minimization** — sadece manifest'in `requiredFields`'ı egress'e çıkar (allowlist + redaction zaten var). Immutable per-dispatch audit (dispute için).

---

## PART IV — Partner stratejisi (Group C: ilk birkaç firma)

### ⚠️ Dürüst yeniden çerçeveleme
Adını verdiğin hedefler **ilk partner için gerçekçi değil**:
- **Amazon:** üçüncü tarafa "adresimi değiştir" API'si **yok**. Erken aşamada imkânsız.
- **Büyük bankalar:** SOC2/GLBA'sız, vetting'siz bir startup'a adres-yazma API'si vermez.
- **Büyük utility'ler:** binlerce parçalı; çoğu login ister.

Bunlar **logo hevesi**; seni aylarca oyalar. Doğru hamle iki yönlü:

### Hamle 1 — Aggregator kaldıracı (bir entegrasyon → çok provider)
| Aggregator | Ne verir | Yetenek (dürüst) |
|---|---|---|
| **Lob** | adres doğrulama + **print-and-mail** | mail-forwarding/COA bildirimi gönderebilir; B2B API-key |
| **Melissa / Smarty** | adres standardize/doğrulama | verified-address temeli |
| **Arcadia (Arc)** | binlerce utility bağlantısı | çoğunlukla **read**/availability — "bu adrese hangi utility" + account-link kaması |
| **Plaid / MX** | finansal hesap bağlantısı | çoğunlukla **read**/identity — banka için "kama", adres-yazma değil |

### Hamle 2 — Motive partner'lar (SENİ ödedikleri için entegre olmak İSTERLER)
Bunlar mover müşterisi istiyor → hem Katman 4 connector, hem affiliate geliri:
- **Sigorta (insurtech / renters)** — quote/lead API, poliçe başına öder; adres-update bazılarında var.
- **Internet/telekom** (affiliate/lead network) — yeni adreste yüksek niyet.
- **Utility-concierge** startup'ları, **home security** (ADT/Vivint dealer), **moving/storage**.

### 🎯 Gerçekçi İLK 3-5 partner
1. **Lob** (veya Smarty/Melissa) — adres altyapısı + mail forwarding. API-ready, BD'siz, hızlı. Model: **B2B API-key**. → "verified address + gerçek mail-forward aksiyonu".
2. **Bir insurtech / renters-insurance partner programı** — mover ister, lead/poliçe başına öder. Model: **lead/quote API** (+ mümkünse account address update). Hem connector hem affiliate.
3. **Arcadia** — bir anlaşma, çok utility (önce read/availability kaması, sonra account-link).
4. **Bir internet/telekom affiliate partner'ı** — yüksek-niyet lead.
5. **USPS derinleştirme** (zaten var) — **flagship kanıt** olarak öne çıkar.

### Her partner'a pitch
> "Taşınma anında, **açık consent**'le, yüksek-niyetli mover'ı temiz bir API ile size getiriyoruz. **SHADOW pilot** ile başlayalım; entegrasyon riski sıfır." — İstenecekler: sandbox API, webhook, DPA.

### Sıralama
USPS + 1 altyapı (Lob) + 1 motive (sigorta) ile ağı kanıtla → **metrikleri yayınla** → orta-ölçek bölgesel utility/banka → en son marquee'leri **hacim + SOC2 kaldıracıyla** kovala.

---

## PART V — İş modeli & moat (Katman 4 en üst seviyede nasıl para eder)

- **Consumer:** Pro (yıllık) API connector'ları gate'liyor — anti-churn zaten tasarlanmış (`connector-oauth`).
- **Partner-side:** consent + ifşa olan yerde **hem yayıyorsun hem lead/komisyon** alıyorsun (çift taraflı). Per-confirmed-action veya rev-share.
- **Dağıtım:** PM/realtor kanalı (Doc 02) ağa hacim besler.
- **Moat & exit:** *"N consent'li connector × aylık X doğrulanmış mover × confirm-rate"* = acquisition hikâyesi (Updater, property-tech, address/identity şirketleri). Değer **veri + consent + kapsama**'da; tek bir logoda değil.
- **Unit economics:** per-dispatch maliyet (bazı partner ücret alır), confirm-rate, fallback-rate izle; Pro fiyatını buna göre kur.

---

## PART VI — Fazlı yol haritası

**Faz A — Platform (haftalar):** G1 (AddressChangeEvent) + G2 (dry-run) + G3 (Fallback 2.0) + G4 (metrics) + SDK scaffolding. **Paralel: SOC2 başlat + ToS carve-out + ilk DPA şablonu.**

**Faz B — İlk partner'lar (1-2 çeyrek):** Lob + 1 insurtech + Arcadia kaması. Her biri **SHADOW → ROLLOUT% → GA**, kill-switch'li. Metrikleri yayınla.

**Faz C — Ölçek (sürekli):** daha çok connector, aggregator derinliği, bölgesel utility/banka, marquee kovalama; **B2B partner portalı** (self-serve sandbox + dispatch logları + connector sertifikasyonu).

Her connector için yaşam döngüsü: **manifest review → contract test → SHADOW (dry-run) → ROLLOUT% → GA → (gerekirse) RETIRED.** ConnectorConfig bunu zaten destekliyor.

---

## PART VII — Sert gerçekler (atlama)
1. **Çoğu provider asla write-API vermez** → "assisted" norm. Kapsamı mover'ın gerçek checklist'ine göre kur, marquee logoya göre değil. (Framework bunu zaten zorluyor: push=true → fallback zorunlu.)
2. **Sorumluluk:** yanlış/sessiz başarısız bir değişiklikte kullanıcı SENİ suçlar. Confirmation + net status + manuel fallback **pazarlık konusu değil**.
3. **Compliance, banka gelirinden ÖNCE gelir** (SOC2/DPA/insurance bütçele).
4. **Vanity tuzağı:** Amazon/Chase peşinde, bir move'u gerçekten kapsayan 20 connector'ı geciktirme.

---

## TEK CÜMLE
Motoru yapmışsın. Katman 4 = **8 lokal platform işi + asgari 3 gerçekçi partner (aggregator + motive) + SOC2/ToS** — marquee logolar değil. Para ve moat, **kapsama + consent + hacim**'den gelir; oraya USPS'i kanıt, affiliate'i yakıt yaparak ölçeklenirsin.
