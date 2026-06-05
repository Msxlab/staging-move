# Partner / Connector Onboarding Runbook — yeni bir partner'ı sisteme kaydetme

> "Banka ile anlaştık, nasıl kaydederim, hangi bilgiyi veririm?" sorusunun tam cevabı.
> Her partner (USPS, UPS, banka) aynı 3 katmandan geçer. Fark: partner gerçek **adres-yazma API'si** veriyor mu (→ otomatik/API_SYNC) yoksa vermiyor mu (→ yönlendirme/GUIDED).

---

## Bir partner'ı kaydetmenin 3 KATMANI

### Katman 1 — KOD (developer, bir kez)
`packages/connectors/src/{key}/` altında bir **adapter** yazılır: `manifest` (key, allowedHosts, capabilities, requiredFields, fallbackActionKey) + `buildRequest` + `push` + (opsiyonel `verify`/`parseWebhook`/`healthCheck`). Sonra `connector-registry`'e eklenir.
→ Bugün elle kodlanıyor (~1 connector/birkaç gün). **SDK/scaffolding** gelince hızlanır.

### Katman 2 — CONFIG (admin panelden, kod deploy'suz)
**a) Control-plane satırı** — Admin → Connectors → "Register":
- `ConnectorConfig`: `enabled`, `stage` (SHADOW→ROLLOUT→GA), `rolloutPercent`, `circuitState`.

**b) Partner sırları** — Admin → Runtime Config (şifreli saklanır):
| Anahtar | Ne |
|---|---|
| `CONNECTOR_{KEY}_AGREEMENT_STATUS` | `NONE` / `SANDBOX` / `PRODUCTION` (anlaşma durumu — API_SYNC için PRODUCTION şart) |
| `CONNECTOR_{KEY}_OAUTH_CLIENT_ID` | partner'ın sana verdiği client id |
| `CONNECTOR_{KEY}_OAUTH_CLIENT_SECRET` | partner'ın client secret'ı |
| `CONNECTOR_{KEY}_OAUTH_AUTHORIZE_URL` | partner'ın authorize endpoint'i |
| `CONNECTOR_{KEY}_OAUTH_TOKEN_URL` | partner'ın token endpoint'i |
| `CONNECTOR_{KEY}_WEBHOOK_SECRET` | async onay webhook imza secret'ı (varsa) |

*(KEY = manifest key büyük harf, `-`→`_`. Örn. `chase-bank` → `CONNECTOR_CHASE_BANK_OAUTH_CLIENT_ID`.)*

**Sistem ne zaman "otomatik sync" (API_SYNC) der?** Hepsi aynı anda doğruysa: adapter `addressUpdatePush=true` + `AGREEMENT_STATUS=PRODUCTION` + credential'lar dolu + `enabled=true` + `stage=GA`. Biri eksikse → otomatik **GUIDED** (yönlendirme) olur. Mode elle ayarlanmaz, **türetilir** ("sistem yalan söyleyemez").

### Katman 3 — KULLANICI İZNİ (consent)
Pro-yıllık kullanıcı → Settings → Connections → partner'da **"Connect"** → partner'ın login sayfasına gider → "LocateFlow adresimi güncellesin" iznini verir → partner sana **dar bir token** verir → token **şifreli** saklanır (`PartnerConsent`).

---

## Partner'dan ALACAKLARIN (→ Katman 2'ye girersin)
- OAuth **Client ID + Client Secret**
- **authorize URL + token URL**
- adres-update **endpoint** spec'i + **zorunlu alanlar** (örn. account number) + **scopes** (en az yetki: sadece adres)
- ÖNCE **sandbox** credential (SHADOW/test için), sonra **PRODUCTION**
- (varsa) **webhook signing secret** (async onay)
- imzalı **authorized-agent / partner agreement** (legal)

## Partner'a VERECEKLERİN
- **OAuth callback (redirect) URL'in** — partner bunu allowlist'lemeli. (Tam yol `connector-oauth.ts`/connect route'unda; `https://locateflow.com/...` formunda — dev'inle netleştir.)
- **Webhook URL'in:** `https://locateflow.com/api/connectors/{key}/webhook` (örn. `/api/connectors/chase-bank/webhook`)
- **Şirket/legal bilgin:** Axtra Solutions LLC + adres (agreement için)
- **Göndereceğin veri tanımı + DPA:** hangi alan, hangi amaç, saklama süresi

---

## ⚠️ KULLANICI verisi — en kritik nokta (banka örneği)
**Bankaya kullanıcı verisi DÖKMÜYORSUN.** Akış şöyle:
1. Kullanıcı **bankaya kendisi** login olur (bankanın OAuth'u) — sen şifresini **asla görmezsin/tutmazsın.**
2. Kullanıcı "LocateFlow adresimi güncelleyebilir" iznini bankada verir.
3. Banka sana **dar, tek-amaçlı bir token** verir.
4. Sen sadece **yeni adresi** (+ bankanın istediği account id'yi) bankanın endpoint'ine yollarsın. Başka hiçbir şey.

Bunu **egress allowlist** (connector sadece bankanın host'una konuşabilir) + **scoped token** + **data minimization** (sadece `requiredFields`) zorlar. Yani mimari, "az veri, doğru yere, kullanıcı izniyle"yi **mecbur** kılar.

---

## Dürüst gerçek: kim API_SYNC, kim GUIDED?
| Partner | Gerçeklik |
|---|---|
| **USPS** | Gerçek COA API + authorized-agent programı var → **API_SYNC olabilir** (canlı adapter bu) |
| **UPS** | Standart 3. taraf "adresimi değiştir" yazma API'si genelde **yok** → büyük ihtimal **GUIDED** (UPS'in adres sayfasına deep-link) |
| **Bankalar** | Neredeyse hiçbiri 3. tarafa adres-**yazma** API'si vermez → çoğu **GUIDED** (bankanın adres-değiştir sayfasına yönlendirme), ya da aggregator (Plaid/MX) üzerinden sınırlı. Gerçek API_SYNC banka = nadir + derin anlaşma |

**Önemli:** Sistem ikisini de destekler. GUIDED bile değerlidir — kullanıcıya "şu linke tıkla, adresini şu sayfada güncelle" der (fallback action). Çoğu partner pratikte GUIDED başlar, API_SYNC'e ancak gerçek yazma-API + anlaşma varsa geçer.

---

## Pro-yıllık bağlantısı
- **API connector'lar (otomatik push)** sadece **Pro-yıllık**'a açık (tek-ay alıp churn engelleme; `connector-oauth` entitlement).
- **GUIDED connector'lar** daha düşük planlara da gösterilebilir (token kullanmaz).
- Kullanıcı Pro-yıllık aldıktan sonra: 1 tık → partner login → consent → token şifreli saklanır → bundan sonra adres değişimi otomatik (API_SYNC ise) ya da yönlendirme (GUIDED ise).

---

## Her yeni partner için ADIM ADIM checklist
1. **BD/Legal:** anlaşma imzala, sandbox + production credential al, DPA imzala, callback+webhook URL'ini partner'a ver (allowlist'lesin).
2. **Dev:** adapter yaz (manifest + push + fallback) + registry'e ekle + deploy.
3. **Admin:** Runtime Config'e secret'ları gir (önce SANDBOX) + ConnectorConfig satırı (`stage=SHADOW`).
4. **Test:** SHADOW pilot (runbook 13) — gerçek push yapmadan pipeline'ı doğrula.
5. **Aç:** `AGREEMENT_STATUS=PRODUCTION` + credential'lar + `stage=ROLLOUT %5 → %50 → GA`. Kill-switch hazır.
6. **İzle:** `/connector-metrics` (confirm-rate) + `/connector-fallbacks` (guided override).
