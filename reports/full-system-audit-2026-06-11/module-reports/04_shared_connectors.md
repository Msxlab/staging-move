# 04 - Shared Packages ve Connector Denetimi

Durum: tamamlandi.

Kapsam: `packages/shared/src`, `packages/connectors/src`, connector runtime
baglantilari, web/mobile export sozlesmesi, runtime/env config, provider
coverage/integrity/domain, recommendation engine, migration engine, billing ve
entitlement yardimcilari koddan okundu. Eski rapor veya dokuman dosyalari
kaynak alinmadi; bu rapor okunan kod ve test yuzeyinden yazildi.

## Onemli Pozitif Kontroller

- Shared API client 401 handler, 429 retry-after okuma, JSON parse fallback,
  timeout ve upload ayrimini merkezi tutuyor.
- Field encryption AES-256-GCM kullaniyor; production ortamda eksik veya bozuk
  `FIELD_ENCRYPTION_KEY` ile plaintext yazmaya/devam etmeye izin vermiyor.
- Audit ve Sentry redaction katmanlari email, token, secret, account/card/phone
  benzeri alanlari anahtar ve metin pattern'leriyle temizliyor.
- Billing entitlement cozumleyici tek merkezde; drift durumlarini sessizce
  duzeltmek yerine admin UI icin warning olarak yuzeye tasiyor.
- Workspace entitlement matrisi plan bazli seat, connector, export, dossier ve
  address-validation ozelliklerini tek kaynaktan cozumliyor.
- Provider coverage ZIP/state yardimcilari DB bagimsiz; provider trust,
  coverage confidence ve quality warning kavramlari ayrilmis.
- Recommendation engine provider siralamasini deterministik composite key ile
  yapiyor; skor, coverage rank, geo bucket, display order, popularity ve stable
  id tie-breaker sirasi comparator transitivity riskini azaltmis.
- Migration engine provider scope'unu kategori heuristics'inin ustune koyuyor
  ve provider isminde yanlis state geciyorsa hedef state onerilerinden eliyor.
- Connector core HTTPS-only egress allowlist, manuel redirect takibi, cross-host
  redirect'te Authorization header dusurme, circuit breaker, retry policy,
  state machine, manifest validation ve redacting logger ile ayrik kurulmus.
- Connector runtime web tarafinda shadow/live ayrimi, per-user daily cap,
  connector-per-minute cap, null-origin korumasi, stale dispatch recovery ve
  token refresh CAS yolunu iceren guclu kontroller barindiriyor.

## Bulgular

### S-01 - Orta - Plan/export metinleri ile gercek export yuzeyi uyusmuyor

Kaynaklar:
- `packages/shared/src/billing.ts:93`
- `packages/shared/src/billing.ts:117`
- `packages/shared/src/billing.ts:141`
- `apps/web/src/app/api/export/route.ts:48`
- `apps/web/src/app/api/export/pdf/route.ts:18`
- `apps/web/src/app/api/export/pdf/route.ts:166`
- `apps/mobile/app/settings/export.tsx:75`

Shared billing plan metinleri Individual/Family icin "Export anytime (CSV, PDF)"
ve Pro icin "Tax & property export (CSV + PDF)" vaadediyor. Ortak JSON/CSV export
endpoint'i ise sadece `csv` ve `json` kabul ediyor; PDF endpoint ayri ve yalnizca
`address`, `full`, `tax` tipleriyle calisiyor. Mobile export ekrani da sadece CSV
ve JSON seceneklerini sunuyor.

Etki:
- Ucretli plan ozellik metni kullaniciya genel PDF export varmis gibi gorunuyor,
  ancak mobile ve ana export yuzeyi bunu sunmuyor.
- Support/billing itirazi ve App Store/Play Store inceleme dilinde uyumsuzluk
  yaratabilir.

Oneri:
- Plan metinlerini "CSV/JSON export + selected PDF reports" gibi gercek yuzeye
  uygun hale getirin ya da mobile/common export tarafina PDF raporlarini acikca
  ekleyin.

### S-02 - Orta - Connector webhook, terminal `NEEDS_USER` dispatch'i tekrar `CONFIRMED` yapabilir

Kaynaklar:
- `packages/connectors/src/core/state.ts:33`
- `packages/connectors/src/core/state.ts:34`
- `packages/connectors/src/core/state.ts:35`
- `apps/web/src/app/api/connectors/[key]/webhook/route.ts:35`
- `apps/web/src/app/api/connectors/[key]/webhook/route.ts:136`
- `apps/web/src/app/api/connectors/[key]/webhook/route.ts:138`
- `apps/web/src/app/api/connectors/[key]/webhook/route.ts:148`

Connector state machine `NEEDS_USER` durumunu terminal kabul ediyor. Webhook
route'unda ise terminal set sadece `CONFIRMED` ve `FAILED` iceriyor. Bu nedenle
bir dispatch manuel fallback'e dusup kullaniciya "action needed" gosterildikten
sonra, gec gelen imzali partner webhook'u ayni satiri `CONFIRMED` durumuna
cevirebilir.

Etki:
- Manuel fallback durumunun audit trail'i gec gelen webhook ile degisebilir.
- Kullanici veya support ekibi "manuel tamamla" uyarisi almisken satir sonradan
  otomatik tamamlanmis gorunebilir.

Oneri:
- Webhook terminal set'ine `NEEDS_USER` ekleyin. Eger gec confirmation bilincli
  kabul edilecekse state machine ve UI metnini buna gore acikca degistirin.

### S-03 - Orta - Partner consent cron refresh yolu optimistic token locking'i bypass ediyor

Kaynaklar:
- `packages/db/prisma/schema.prisma:1970`
- `apps/web/src/lib/connector-oauth.ts:193`
- `apps/web/src/lib/connector-oauth.ts:214`
- `apps/web/src/lib/connector-oauth.ts:219`
- `apps/web/src/app/api/partner-consents/[id]/refresh/route.ts:34`
- `apps/web/src/app/api/partner-consents/[id]/refresh/route.ts:59`
- `apps/web/src/app/api/partner-consents/[id]/refresh/route.ts:60`

Ana runtime refresh fonksiyonu `tokenVersion` ile compare-and-swap yapiyor ve
basarili refresh'te version'i artiriyor. Cron/system refresh endpoint'i ise ayni
token vault alanlarini dogrudan `update` ediyor; `tokenVersion` okumuyor, where
kosuluna koymuyor ve increment etmiyor.

Etki:
- Worker ve cron ayni consent'i ayni anda refresh ederse, cron daha eski
  refresh sonucuyla yeni tokenlari ezebilir.
- Refresh token rotation yapan provider'larda son yazan eski sonuc grant'i
  bozabilir ve sonraki dispatch'leri `NEEDS_USER` akimina dusurebilir.

Oneri:
- Cron refresh endpoint'ini `refreshConsentAccessToken` CAS yoluna tasiyin veya
  ayni `tokenVersion` compare/increment mantigini birebir uygulayin.

### S-04 - Orta - Otomatik refresh basarisiz oldugunda encrypted tokenlar temizlenmiyor

Kaynaklar:
- `apps/web/src/app/api/partner-consents/[id]/refresh/route.ts:49`
- `apps/web/src/app/api/partner-consents/[id]/refresh/route.ts:52`
- `apps/web/src/lib/connector-oauth.ts:342`
- `apps/web/src/lib/connector-oauth.ts:346`
- `apps/web/src/lib/connector-oauth.ts:347`
- `packages/db/prisma/schema.prisma:1967`
- `packages/db/prisma/schema.prisma:1968`

Cron refresh endpoint'i provider refresh basarisiz olunca consent status'unu
`EXPIRED` yapiyor, fakat `tokenEncrypted` ve `refreshTokenEncrypted` alanlarini
null'lamiyor. Kullanici revoke ve supersede yollarinda ayni token alanlari
temizleniyor.

Etki:
- Artik kullanilmayan long-lived refresh token DB'de encrypted olarak kalmaya
  devam ediyor.
- Data minimization ve incident blast-radius acisindan revoke akisi ile
  tutarsizlik olusuyor.

Oneri:
- `AUTO_EXPIRED` durumunda da access/refresh token alanlarini null'layin. Token
  forensic ihtiyaci varsa bunu ham token tutmadan, salt audit metadata ile
  cozumleyin.

### S-05 - Dusuk - Runtime `DATABASE_URL` shape validation gercek DB scheme'ini dogrulamiyor

Kaynaklar:
- `packages/shared/src/runtime-config.ts:1586`
- `packages/shared/src/runtime-config.ts:1593`
- `packages/shared/src/runtime-config.ts:1852`
- `packages/shared/src/runtime-config.ts:1853`
- `packages/shared/src/runtime-config.ts:1854`
- `apps/admin/src/app/api/backup/sql-dump/route.ts:59`

`validateRuntimeConfigValueShape("DATABASE_URL", ...)` icinde `allowDatabaseScheme`
verildiginde `new URL()` parse edebilen her scheme kabul ediliyor. Bu nedenle
admin/runtime readiness yuzeyi `https://...` veya `file://...` gibi Prisma DB
URL'i olmayan bir degeri sekil olarak valid sayabilir. Baska yerlerde MySQL
backup route'u ayrica `mysql://` bekliyor ve Prisma runtime zaten hataya duser,
ama config saglik raporu yanlis guven verebilir.

Etki:
- Operator "Valid" gordugu halde uygulama DB baglantisi veya SQL dump akisi
  calismayabilir.

Oneri:
- `DATABASE_URL` icin desteklenen scheme listesini acik dogrulayin
  (`mysql:`, gerekiyorsa `postgres:`/`postgresql:`) ve backup beklentisi MySQL
  ise bunu ayri uyari olarak yuzeye tasiyin.

### S-06 - Dusuk - Env readiness metni encryption davranisiyla celisiyor

Kaynaklar:
- `packages/shared/src/env-catalog.ts:111`
- `packages/shared/src/env-catalog.ts:114`
- `packages/shared/src/encryption.ts:42`
- `packages/shared/src/encryption.ts:43`
- `packages/shared/src/encryption.ts:69`
- `packages/shared/src/encryption.ts:70`

Env catalog `FIELD_ENCRYPTION_KEY` icin "Missing silently writes un-encrypted
PII" diyor. Oysa encryption helper production ortamda eksik key ile encrypt ve
decrypt islemlerinde throw ediyor; plaintext devam etmiyor.

Etki:
- Admin/readiness ekraninda operator yanlis risk modeliyle hareket edebilir.
- Gercek davranis fail-closed iken metin fail-open gibi anlatiliyor.

Oneri:
- Env catalog aciklamasini "Production refuses plaintext writes/reads; local
  development falls back to raw values" seklinde guncelleyin.

### S-07 - Dusuk - Connector manifest allowlist public-host zorlamasi yapmiyor

Kaynaklar:
- `packages/connectors/src/core/manifest.ts:32`
- `packages/connectors/src/core/manifest.ts:37`
- `packages/connectors/src/core/manifest.ts:39`
- `packages/connectors/src/core/http-client.ts:81`
- `packages/connectors/src/core/http-client.ts:97`
- `packages/connectors/src/core/http-client.ts:99`

HTTP client sadece manifestteki host'lara HTTPS ile cikiyor; bu iyi. Ancak
manifest validation host'un lowercase/bare olmasini kontrol ediyor, loopback,
private, metadata veya internal host sinirlamasi yapmiyor. Runtime config URL
validator'da benzer internal host korumasi var; connector manifest sozlesmesinde
ayni koruma yok.

Etki:
- Gelecekte eklenecek hatali bir connector manifesti `localhost`, private IP
  veya internal hostname'i allowlist'e koyarsa core bunu valid sayar.
- Bu su an kullanici girdisiyle tetiklenen SSRF degil; code-controlled
  entegrasyon hygiene eksigi.

Oneri:
- Manifest validation'a public-host kontrolu ekleyin ve testlerde
  `localhost`, `127.0.0.1`, `10.x`, `192.168.x`, `169.254.x`,
  `metadata.google.internal`, `.local`/`.internal` gibi host'lari reddedin.

## Moduller Arasi Bag Notlari

- Mobile `settings/connections` eski `/api/connector-dispatch` endpoint'ini
  cagiriyor. Web raporundaki W-04 ve mobile raporundaki M-02 ile ayni kok neden:
  legacy endpoint workspace context tasimiyor; workspace-aware sync route
  `POST /api/workspaces/[id]/sync` daha guvenli baglanti noktasi.
- Shared `BILLING_PLAN_DEFINITIONS` pricing/marketing, web settings export ve
  mobile export ekranlarinin metin kaynagi oldugu icin S-01 hem web hem mobile
  UX'e yayiliyor.
- Connector token lifecycle uc yoldan isliyor: user OAuth callback,
  runtime in-band refresh ve cron refresh. In-band refresh CAS korumali, cron
  refresh ise ayni standardi takip etmiyor.

## Sonuc

Shared ve connector core genel olarak bekledigimden olgun: saf fonksiyonlar,
testlenebilir state machine, defensive redaction ve fail-closed config
yaklasimi var. Bulunan risklerin agirligi daha cok sozlesme/tutarlilik ve
runtime edge case tarafinda: export vaadi, webhook terminal set'i ve partner
token refresh yollarinin ayni concurrency standardina baglanmasi oncelikli
duzeltmeler.
