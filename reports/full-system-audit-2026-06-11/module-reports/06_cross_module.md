# 06 - Moduller Arasi Baglar ve Zincir Denetimi

Durum: tamamlandi.

Kapsam: Admin, web, mobile, shared/connectors ve DB/ops raporlarinda koddan
kanitlanan bulgular birlestirildi. Bu dosya tekil bulgulari tekrar etmekten
cok, hangi risklerin ayni kok nedenden dogdugunu ve hangi sirayla ele alinmasi
gerektigini gosterir.

## 1. Auth ve Step-up Zinciri

Ilgili bulgular: W-01, M-01, M-04, M-07, A-01, A-02.

Ortak resim:
- [DUZELTILDI 2026-06-11] Web `POST /api/auth/security` icindeki
  `set_password` action'i hassas bir kalici credential yazimi olmasina ragmen
  sadece aktif session'a dayaniyordu.
- [DUZELTILDI 2026-06-11] Mobile `setup-password` bu legacy/security
  endpoint'ine dogrudan bagliydi; artik email-link setup akisini kullaniyor.
- Mobile app-lock recovery yerel auth kullanilamadiginda kilidi kapatip mevcut
  session'i koruyabiliyor; bu server-side bypass degil ama cihaz kaybi/biometric
  ariza senaryosunda risk zincirini buyutuyor.
- Admin tarafinda security telemetry icin break-glass bypass olayi internal
  endpoint'te dusuyor ve dashboard login action isimleri gercek log isimleriyle
  uyusmuyor. Bu, guvenlik olaylari oldugunda operatorun dogru tabloyu gormesini
  zorlastiriyor.

Kok neden:
Yeni hassas islemler icin step-up modeli var, fakat eski veya paralel action'lar
tamamen bu modele tasinmamis. Telemetry tarafinda da event isimleri tek kaynak
haline getirilmemis.

Oncelikli aksiyon:
1. [x] `set_password` action'ini kaldirin veya tek kullanimlik email
   token/step-up zorunlu yapin; mobile setup-password'i ayni akisa tasiyin.
2. Admin security event tiplerini shared enum/helper'a alin; middleware,
   internal endpoint ve dashboard ayni action isimlerini kullansin.
3. Mobile app-lock recovery icin server session revoke veya en azindan security
   audit event ekleyin.

## 2. Workspace ve Connector Zinciri

Ilgili bulgular: W-03, W-04, M-02, S-02, S-03, S-04, D-01, D-06.

Ortak resim:
- Workspace modeli genislemis, ama legacy `/api/connector-dispatch` hala mobil
  "Sync now" tarafindan kullaniliyor.
- Workspace-aware sync route'u role/status/managed-sync/owner entitlement ve
  address workspace kontrollerini uyguluyor; legacy route ise workspace context
  tasimiyor.
- Explicit workspace secimi gecersiz oldugunda web helper'i bazi mutating
  route'larda sessizce en eski workspace'e dusebiliyor.
- Connector state tarafinda terminal `NEEDS_USER` webhook ile tekrar
  `CONFIRMED` olabilir; partner consent refresh'in cron yolu token version CAS
  korumasini bypass ediyor ve refresh failure tokenlari temizlemiyor.
- DB tarafinda primary address tekilligi ve pending invite tekilligi DB
  seviyesinde tam ifade edilmiyor; connector dispatch ve workspace davetleri bu
  invariant'lara is kuralinda guveniyor.

Kok neden:
Yeni workspace/connector yetki modeli iyi kurulmus, fakat eski self-service
endpointler ve DB invariant'lari ayni guvenlik sozcugune getirilmemis.

Oncelikli aksiyon:
1. Mobile connections ekranini `POST /api/workspaces/[id]/sync` akisine tasiyin.
2. Legacy `/api/connector-dispatch` icin ya workspace disi self-only kisit koyun
   ya da workspace resolver + role/status policy ekleyin.
3. Mutating route'larda stale/invalid explicit workspace icin fallback yerine
   409/403 dondurun.
4. Connector state machine'de `NEEDS_USER` terminal davranisini webhook update
   guard'ina ekleyin; partner consent refresh'i tek CAS helper'ina indirin.
5. Primary address ve live pending invite invariant'larini DB veya merkezi
   transaction helper ile guclendirin.

## 3. Billing, Entitlement ve Store Webhook Zinciri

Ilgili bulgular: A-04, A-05, W-02, S-01.

Ortak resim:
- [DUZELTILDI 2026-06-11] Admin billing override validator, bazi required
  tarih alanlarini mevcut deger null iken zorunlu kilmiyordu.
- Admin hard-delete DB silmeyi tamamladiktan sonra Stripe cancel'i best-effort
  yapiyor ve failure'i kullaniciya net hata olarak dondurmuyor.
- Web tarafinda Stripe webhook reserve-first yapisi iyi; App Store ve Play Store
  webhook'lari ise check-then-act idempotency yarisi tasiyor.
- Shared billing metni CSV/PDF export vaadi veriyor; gercek export yuzeyi web ve
  mobile'da farkli.

Kok neden:
Billing/entitlement sozlesmesi coklu kanal: admin override, Stripe, mobile IAP,
shared plan metni, cron reconciliation. Bu kanallardan bazilari ayni state
machine disiplinine henuz tam baglanmamis.

Oncelikli aksiyon:
1. [x] Admin billing validator'i "hedef state + mevcut state" uzerinden strict hale
   getirin.
2. App Store/Play Store webhook idempotency'sini Stripe gibi reserve-first
   yapin.
3. Hard-delete icin Stripe cancel'i silme oncesi veya explicit partial-failure
   durumuna alin.
4. Shared plan copy ile gercek export endpointlerini tek sozlesmeye indirin.

## 4. Veri Silme, PII ve Bildirim Zinciri

Ilgili bulgular: A-03, A-07, A-08, M-03, D-03.

Ortak resim:
- Account deletion ve hard-delete akislari PII artigi temizleme konusunda iyi
  yerlere gelmis; waitlist, queue ve email log gibi FK disi tablolar
  dusunulmus.
- Ancak admin backup count listesi asil backup tablo listesiyle eksik; restore
  veya backup dogrulama operatoru yaniltabilir.
- Waitlist export maskeli/step-up'li, fakat normal admin GET/UI raw email
  gosteriyor.
- Moving-plan admin endpointleri dusuk role seviyesinde email ve adres detaylari
  donduruyor.
- Mobile logout push token cleanup'i client best-effort; scheduled direct queue
  soft-deleted kullanici icin in-app/push yazabilir.

Kok neden:
PII policy bazi export/delete yuzeylerinde guclu, fakat normal okuma/list ve
notification yan etkilerinde ayni "default masked/default live user" ilkesi her
zaman uygulanmiyor.

Oncelikli aksiyon:
1. Admin list/detail endpointlerinde raw PII icin explicit reveal + step-up
   modeli uygulayin.
2. Backup table listesi ve count listesini tek kaynaktan uretin.
3. Logout endpointine device token revoke opsiyonu ekleyin; scheduled delivery
   direct user guard'i koyun.
4. Moving-plan admin response'lari role bazli redact edin.

## 5. Provider, Coverage ve Public Catalog Zinciri

Ilgili bulgular: A-06, D-02, D-01.

Ortak resim:
- Provider catalog public web ve mobile discovery/recommendation akisini
  besliyor; admin mutation'lari bu yuzden operasyonel olarak hassas.
- Admin delete/merge/coverage gibi bazi islemler daha siki korunurken create,
  import, update, bulk gibi public catalogu etkileyen yollar step-up
  tutarliliginda degil.
- `seed-master` coverage rebuild yapiyor, ama eski standalone seed scriptleri
  provider yaratip coverage satiri olusturmuyor.
- Provider compare/recommendation gibi yuzeyler primary address ve coverage row
  varsayimlarina bagli; primary address tekilligi DB seviyesinde zayifsa
  oneriler yanlis lokasyona gore sekillenebilir.

Kok neden:
Provider catalog artik sadece statik seed verisi degil; admin UI, seed scripti,
coverage editor ve recommendation engine arasinda coklu write/read zinciri var.
Bu zincirin her write noktasi ayni guard ve rebuild kuralina baglanmali.

Oncelikli aksiyon:
1. Public catalogu etkileyen tum admin mutations icin step-up policy'yi
   standartlastirin.
2. Tum provider seed/import yollarini coverage rebuild helper'ina baglayin.
3. Provider guard testlerine coverage row tutarliligi ve primary address
   integrity repair kontrolu ekleyin.

## 6. Cron, CI ve Operasyon Zinciri

Ilgili bulgular: D-04, D-05, W-02, A-01.

Ortak resim:
- Cron endpointleri ortak guard ile iyi korunuyor, fakat GitHub schedule ve
  Vercel schedule birbirinden kopmus.
- Web tarafinda yeni cron endpointleri var; Vercel config eski 10 endpointte
  kalmis.
- Root `verify:ci`, GitHub CI ve `verify:tests` ayni kalite sozlesmesini temsil
  etmiyor; connectors package CI'da tam bloklayici degil.
- Security telemetry event drift'i operasyonel gozlenebilirligi azaltabilir.

Kok neden:
Runtime kodu hizli genislemis; operasyonel manifestler ve lokal/CI komutlari
ayni hizda tek kaynaga baglanmamis.

Oncelikli aksiyon:
1. Cron schedule icin tek canonical manifest olusturun ve GitHub/Vercel/Ofelia
   hedeflerini buradan uretin.
2. CI'yi root verify komutuyla ayni hale getirin; connectors tsc/test'i
   bloklayici yapin.
3. Webhook idempotency ve cron worker testlerini ayni "reserve/claim before side
   effect" pattern'iyle guard edin.

## Genel Fix Sirasi

1. Yuksek auth/billing riskleri: W-01/M-01, A-04, A-05, W-02.
2. Workspace/connector integrity: W-03/W-04/M-02, S-02/S-03/S-04.
3. Data lifecycle ve PII: A-03/A-07/A-08, M-03, D-03.
4. Provider catalog/coverage: A-06, D-02, D-01.
5. Operasyon kalite kapilari: D-04, D-05, D-07 ve comment/config driftleri.
