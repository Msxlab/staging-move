# Connector SDK & Partner Onboarding — "framework"ü "platform"a çevirmek

> Hedef: yeni bir partner (USPS, banka, Plaid) eklemeyi **bespoke aylık entegrasyon**dan
> **1 günlük, güvenli, tekrarlanabilir** bir işe indirmek — ki ileride partnerler **sana**
> geldiğinde 1 günde bağlayabilesin (inbound-ready).

---

## Ne inşa edildi (KUR — kod, test'li)

### 1. Contract Test Kit — güvenlik ağı
`packages/connectors/src/core/contract-test-kit.ts` → `assertConnectorContract(connector, { sampleInput })`.
Herhangi bir connector'ın framework sözleşmesine uyduğunu **gerçek partnere dokunmadan** kanıtlar:
- Manifest geçerli (allowlist, fallback, scope, semver…)
- `buildRequest` **deterministik + egress allowlist üstünde + geçerli method** (yanlış host = bloklanır → testte yakalanır)
- Capability ↔ method tutarlı (`readBackVerify`→verify, `asyncConfirm`→parseWebhook)
- `parseWebhook` tanımsız payload'a **null** döner
**Pure, I/O yok** (push/verify'ı çağırmaz). USPS bu kit'i **geçiyor** (dogfood). 10 test.

### 2. Scaffolding generator — hız
`node scripts/new-connector.mjs <key>` *(veya `pnpm connector:new <key>`)* → `packages/connectors/src/<key>/` altında **sözleşmeyi-zaten-geçen** iskelet üretir: `index.ts` (manifest + push stub), `request.ts` (pure buildRequest), `<key>.test.ts` (`assertConnectorContract`). Doğrulandı: üret → tsc temiz → contract testi geçer.

### 3. USPS = referans şablon
Her connector USPS'i kopyalar (manifest + pure request + push + verify + healthCheck). Generator bunu otomatikleştirir; kit doğrular.

---

## Bir connector'ı 1 GÜNDE eklemek (akış)
1. **Scaffold:** `pnpm connector:new acme-bank` → iskelet + geçen test hazır.
2. **Manifest'i doldur:** `allowedHosts` (partner host'u), `auth` (OAUTH + en-az-yetki scope), `requiredFields`, `capabilities` (`addressUpdatePush` yazma var mı?), `fallbackActionKey`.
3. **`buildRequest` + `push`'u yaz:** partner API spec'ine göre (pure mapping + ctx.http ile gönder + sonucu taksonomiye eşle).
4. **Contract testi koş:** `pnpm --filter @locateflow/connectors exec vitest run src/acme-bank` → yeşilse sözleşme tamam.
5. **Kaydet:** `connector-registry`'e ekle + Admin'den `ConnectorConfig` (stage=SHADOW) + Runtime Config secret'ları.
6. **SHADOW pilot** (runbook 13) → gerçek push olmadan doğrula → `stage=GA`.

→ Adım 1-4 (kod) artık **saatler**, günler değil. Asıl gecikme **partner API spec'i + anlaşma** (BD), kod değil.

---

## Self-serve onboarding mimarisi (3 yüzey)

### A) Developer yüzeyi — SDK (✅ kuruldu)
generator + contract kit + USPS şablon + manifest validation. "Yeni connector ekle" tek komut + tek test.

### B) Ops yüzeyi — Admin (✅ kuruldu)
- `ConnectorConfig` (enable/stage/rollout/kill-switch) — Admin → Connectors
- Runtime Config secret'ları (OAuth creds, agreement status, webhook secret)
- **Fallback editor** (`/connector-fallbacks`) — guided action'lar, audit'li
- **Metrics dashboard** (`/connector-metrics`) — confirm-rate / sağlık

### C) Partner yüzeyi — Self-serve portal (📋 TASARLANDI, henüz kurulmadı)
Inbound ölçeğe geçince: harici partner login + multi-tenant sandbox + döküman + sertifikasyon akışı. Partner kendi connector'ını **kendisi** kaydeder, sandbox key alır, sağlığını görür.
- **Neden henüz değil:** harici partner auth + multi-tenancy ayrı, büyük bir UI işi; **talep gelince** (ilk birkaç partner manuel onboard edildikten sonra) kurulur. Önce A+B ile manuel onboard et, deseni öğren, sonra portal'ı otomatikleştir.

---

## "Banka mıknatısı" bağlantısı
Bankaların sana gelmesini sağlayan 3 şeyden biri **"1 günde entegrasyon."** Bu SDK tam olarak onu verir: bir partner "evet" dediğinde, kod tarafı saatler sürer. Diğer ikisi (hacim + güven) iş/compliance tarafı.

→ Sıra: **SDK (✅)** → manuel ile ilk partnerleri onboard et → deseni öğren → **self-serve portal (C)** → inbound patlar.

---

## Tek cümle
Framework artık **platform çekirdeği:** yeni connector = 1 komut iskelet + 1 test ile sözleşme garantisi + admin config. Kalan tek "self-serve" parçası **harici partner portal**'ı (C) — o da talep gelince. Kod tarafı, "banka 1 günde bağlansın" için **hazır.**
