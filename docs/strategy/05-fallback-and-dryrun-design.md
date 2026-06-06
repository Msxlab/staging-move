# G2 (Dry-run / SHADOW) + G3 (Fallback 2.0) — Tasarım

> İkisi de yeni partner'ı **güvenle** başlatmanın temeli. G2 = yan-etkisiz prova; G3 = API'siz provider'lar için kapsama.

---

## G2 — Gerçek dry-run (SHADOW modu)

### Şu an
`connector-runtime.ts:isConnectorDispatchable()` → `stage === "SHADOW"` ise **dispatch'i tamamen blokluyor** (satır 107). Yani SHADOW connector hiç çalışmıyor; gerçek trafiğe karşı prova yapamıyorsun.

### Hedef
SHADOW connector tüm pipeline'ı (consent, mode gate, buildRequest, rate-limit) çalıştırsın **ama side-effecting HTTP push'u yapmasın** → gerçek prod trafiğinin şekliyle, sıfır yan-etkiyle doğrulama.

### Dokunulacak yerler
1. `core/types.ts` → `ConnectorContext`'e `dryRun?: boolean` ekle.
2. `core/executor.ts` → `runConnectorAttempt` ctx'i connector'a geçiriyor; `dryRun` true ise `push()` çağrılmadan önce simüle sonuç (`outcome: "SUBMITTED"` + `metadata.shadow=true`) dön, ya da connector'ın `push()`'u ctx.dryRun'ı onurlandırsın (tercih: executor seviyesinde kes — connector'lar değişmeden korunur).
3. `connector-runtime.ts`:
   - `isConnectorDispatchable()` → `SHADOW` için artık `false` değil; **dispatch'e izin ver ama** `runDispatchRow`'a `dryRun=true` taşı.
   - `buildContext()` → `dryRun` parametresi ekle.
   - Sonuç statüsü: gerçek `CONFIRMED/SUBMITTED` yerine **`SHADOW_OK`/`SHADOW_FAIL`** (ya da `resultMetadataJson.shadow=true`) yaz ki **gerçek metrikleri kirletmesin**.
4. Metrics (G4) shadow dispatch'leri ayrı sayar.

### Kazanç
Yeni connector: `SHADOW` → prod trafiğinde buildRequest/mode/rate-limit doğrula → `ROLLOUT %5` → `GA`. Hiç gerçek partner çağrısı yapmadan entegrasyon hatalarını yakala.

### Test
Mock connector + `dryRun=true` → `push()`'un **çağrılmadığını** assert et; pipeline'ın geri kalanının çalıştığını doğrula.

---

## G3 — Fallback 2.0 (assisted akış)

### Şu an
`apps/web/src/lib/guided-connector-actions.ts` → **tek hardcoded kayıt** (`usps:MAIL_FORWARDING:DEEP_LINK`). Yeni partner fallback'i = kod değişikliği. PDF/mailto yok.

### Neden kritik
Provider'ların ÇOĞU asla write-API vermez → `GUIDED_UPDATE` (assisted) **norm**. Fallback kapsaması = ürün kapsaması. Bunu **veri** haline getir, kod değil.

### Hedef tasarım
1. **DB tablosu `ConnectorFallbackAction`:**
   - `connectorKey`, `actionKey`, `type` (DEEP_LINK | MAILTO | PDF | PHONE), `locale`, `label`, `urlTemplate`/`bodyTemplate`, `enabled`.
2. **Renderer** (`renderFallbackAction`): template'i `CanonicalAddressChange`'den doldur (örn. `{{to.street1}}`, `{{fullName}}`) — **redaction'a saygılı**, PII log'lanmaz.
   - DEEP_LINK → prefilled URL.
   - MAILTO → `mailto:?subject=...&body=...` provider'a adres değişikliği bildirimi.
   - PDF → doldurulmuş form (örn. matbu COA benzeri) — `@react-pdf` veya server template.
3. **Çözümleme:** `manifest.fallbackActionKey` → DB row → render → `NEEDS_USER` bildirimi + `settings/connections` UI'da buton.
4. **Admin:** fallback action'ları admin'den ekle/düzenle (yeni partner guided akışı = data entry).

### Sequencing
- Faz A: tabloyu + renderer'ı kur, USPS'i hardcoded'dan DB'ye taşı (parite).
- Faz B: ilk assisted partner'lar için DEEP_LINK + MAILTO.
- Faz C: PDF renderer (matbu gereken provider'lar).

### Test
Template render (PII redaction dahil) + her `type` için golden-output fixture; eksik field → güvenli boş/uyarı.

---

## İksinin birlikte değeri
SHADOW (G2) + zengin fallback (G3) = **her yeni partner'ı önce yan-etkisiz dene, API yoksa assisted'a düş.** Connector eklemek artık "1 günlük + sıfır-riskli lansman" olur.
