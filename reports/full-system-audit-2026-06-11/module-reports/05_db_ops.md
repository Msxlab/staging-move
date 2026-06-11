# 05 - DB ve Operasyon Denetimi

Durum: tamamlandi.

Kapsam: `packages/db/prisma/schema.prisma`, migration klasorleri, soft-delete
extension, optimistic locking, provider coverage rebuild, workspace backfill,
seed scriptleri, root/package komutlari, CI workflow, cron workflow, Vercel
cron config, Dockerfile ve docker-compose koddan okundu. Mevcut eski rapor veya
dokuman dosyalari kaynak alinmadi.

## Onemli Pozitif Kontroller

- Web ve admin varsayilan DB client'i soft-delete extension ile geliyor;
  `rawPrisma`/`dbUnsafe` kullanimi ayrica adlandirilmis ve yorumlarla
  sinirlandirilmis.
- Soft-delete extension `findMany/findFirst/count/groupBy/aggregate` icin
  `deletedAt: null` ekliyor, `findUnique` icin deleted row'u `null` gibi
  donduruyor, `delete/deleteMany` islemlerini soft-delete'e ceviriyor.
- Self-service account erasure ve admin hard-delete akislari FK disi artıkları
  da temizliyor: waitlist, notification queue, email log ve GDPR request
  taraflari ayrica ele alinmis.
- Workspace purge, `MovingPlan` FK restrict davranisini dikkate alip workspace
  hard-delete oncesi ilgili planlari siliyor.
- Workspace invitation create ve accept akislari seat sayimini transaction
  icinde yapiyor ve `Serializable` isolation/P2034 retry davranisini ele aliyor.
- Scheduled delivery worker queue row'unu yan etkiden once atomic claim ediyor;
  bu double-send riskini dogru yonde kapatiyor.
- Cron endpointleri ortak `guardCronRequest` uzerinden `Authorization` veya
  `x-cron-secret` ile korunuyor ve route bazli rate limit uyguluyor.
- Docker runtime non-root user ile calisiyor, healthcheck `/api/health`
  uzerinden yapiliyor, start sirasinda `prisma migrate deploy` kosuyor.
- `seed-master` provider kayitlarini normalize/sanitize edip coverage rebuild
  ile ayni transaction icinde olusturuyor.
- Admin seed zayif veya unset admin parolasi ile ilerlemiyor; minimum uzunluk
  ve karakter siniflari kontrol ediliyor.
- Workspace backfill scripti idempotent tasarlanmis ve smoke scripti tekrar
  calistirmada duplicate workspace yaratmadigini dogruluyor.

## Bulgular

### D-01 - Orta - Primary address tekilligi veritabani seviyesinde korunmuyor

Kanıt:
- `packages/db/prisma/schema.prisma:456` `Address.isPrimary` alanini tutuyor,
  ancak `Address` modelinde yalnizca `userId`, `workspaceId`, `zip`, `state`,
  `deletedAt` indexleri var; tek primary kuralini zorlayan unique yok.
- `apps/web/src/app/api/addresses/route.ts:107-120` POST akisi once mevcut
  primary adresleri `updateMany` ile dusurup sonra yeni adresi olusturuyor.
- `apps/web/src/app/api/addresses/[id]/route.ts:143-156` PATCH ayni mantikla
  diger primary adresleri dusurup hedef adresi guncelliyor.
- `apps/web/src/app/api/addresses/[id]/route.ts:231-261` DELETE akisi primary
  silinirse bir sonraki adresi primary yapmaya calisiyor.

Etki:
Normal tek istek akisi dogru; fakat iki POST/PATCH istegi ayni kullanici ve
workspace icin ayni anda `isPrimary=true` gelirse DB constraint olmadigi icin
iki primary adres kalabilir. Provider compare, connector dispatch, tax/export ve
adres bazli oneriler primary adresi dogru tek kaynak varsayarsa yanlis adresle
islem yapabilir.

Oneri:
MySQL partial unique desteklemedigi icin ya ayrik `PrimaryAddress`/`UserScope`
tablosu tutun, ya nullable/generated bir `primaryScopeKey` ile sadece primary
satirlarda unique zorlayin, ya da en azindan POST/PATCH/DELETE akisini
`Serializable` transaction + retry + repair job ile guclendirin.

### D-02 - Orta - Eski provider seed scriptleri coverage tablosunu doldurmuyor

Kanıt:
- `packages/db/package.json:17-20` `seed:providers`, `seed:all-states`,
  `seed:expanded`, `seed:government` scriptlerini ayri ayri calistirilabilir
  sekilde expose ediyor.
- `packages/db/prisma/seed-master.ts:4` `rebuildProviderCoverage` import ediyor
  ve `packages/db/prisma/seed-master.ts:18-36` provider create ile coverage
  rebuild'i ayni transaction icinde yapiyor.
- `packages/db/prisma/seed-providers-expanded.ts:273-276`,
  `packages/db/prisma/seed-providers-government.ts:161-164` ve
  `packages/db/prisma/seed-providers-all-states.ts:245-251` provider kaydi
  olusturuyor, fakat coverage rebuild cagirmiyor.
- Web provider listeleri ve onerileri coverage satirlarini kullaniyor:
  `apps/web/src/app/api/providers/route.ts:21-29`,
  `apps/web/src/app/api/providers/recommendations/route.ts:131-136`,
  `apps/web/src/app/api/moving/migration/route.ts:109-120`.

Etki:
Bu eski seed scriptlerinden biri tek basina calistirilirse yeni provider'lar
`ServiceProviderCoverage` satirsiz kalir. Sonuc olarak provider arama, state
coverage filtresi, recommendation ve migration onerileri provider'i eksik veya
yanlis kapsama sahip gibi gorebilir.

Oneri:
Provider create eden tum seed scriptlerini `seed-master` icindeki normalize +
sanitize + `rebuildProviderCoverage` helper'ina tasiyin. Ayrica provider guard
testlerine "provider var ama coverage row yok" kontrolunu zorunlu hale getirin.

### D-03 - Orta - Direct scheduled notification soft-deleted kullaniciya in-app/push yazabilir

Kanıt:
- `apps/web/src/app/api/cron/scheduled-delivery/route.ts:85` broadcast
  kullanici listesi default soft-delete client uzerinden geldigi icin canli
  kullanicilara iner; bu kisim iyi.
- Ancak direct queue row'lari `apps/web/src/app/api/cron/scheduled-delivery/route.ts:114`
  ile once `createInAppNotification` cagiriyor.
- `apps/web/src/lib/in-app-notifications.ts:27-43` notification create ederken
  hedef user'in `deletedAt` durumunu kontrol etmiyor.
- `apps/web/src/lib/notifications.ts:86-96` push cihazlarini user canli mi diye
  join/filter etmeden `PushDevice` uzerinden topluyor.
- `packages/db/prisma/schema.prisma:81-82` soft-deleted user satiri hard-delete
  grace suresinde DB'de kalmaya devam ediyor.

Etki:
Soft-delete edilmis ama henüz hard-delete edilmemis bir kullanici icin bekleyen
direct `NotificationQueue` satiri varsa scheduled worker bu kullaniciya in-app
notification yazabilir ve PUSH kanalinda cihaz tokeni duruyorsa bildirim
gonderebilir. Email yolu default soft-delete client nedeniyle daha iyi davranir;
risk in-app ve push tarafinda kaliyor.

Oneri:
`deliverToUser` basinda `prisma.user.findUnique({ id })` ile canli user guard'i
koyun ve yoksa row'u "skipped deleted user" olarak isaretleyin. Push sorgusuna
da `user: { deletedAt: null }` relation filter'i ekleyin. User soft-delete
edildiginde pending direct queue satirlarini iptal etmek de daha temiz olur.

### D-04 - Orta - Cron schedule kaynaklari birbirinden kopmus

Kanıt:
- GitHub cron workflow yeni ve genis schedule setini calistiriyor:
  `.github/workflows/cron.yml:79-88`, `.github/workflows/cron.yml:96-102`,
  `.github/workflows/cron.yml:112-137`, `.github/workflows/cron.yml:170-192`.
- `apps/web/vercel.json:2-41` yalnizca eski 10 cron endpointini listeliyor.
  Burada `checkout-cleanup`, `scheduled-delivery`, `blog-publish`,
  `stripe-reconcile`, `provider-stats`, `blog-cleanup`,
  `admin-daily-digest`, `data-retention`, `lifecycle-nudges`,
  `move-week-alerts`, `daily-digest`, `admin-monthly-report` ve
  `uptime-check` yok.
- `apps/web/src/app/api/cron/synthetic-monitor/route.ts:13-15` route'un harici
  scheduler tarafindan cagirilmak uzere tasarlandigini soyluyor; repo icindeki
  GitHub/Vercel schedule listelerinde bu endpoint yok.

Etki:
Aktif production scheduler GitHub ise Vercel config stale kopya olarak kaliyor.
Ancak Vercel deployment hala bagliysa veya bir operator bu dosyayi canonical
sanarsa yeni worker'lar calismaz; iki scheduler ayni anda aktifse eski 10 job
duplicate calisabilir. Bu ozellikle scheduled delivery, checkout cleanup,
digest rollup ve yeni uptime monitor tarafinda sessiz operasyon boslugu yaratir.

Oneri:
Tek canonical schedule kaynagi belirleyin. Vercel kullanilmiyorsa
`vercel.json` cronlarini kaldirin veya dosyaya bilincli "inactive" guard'i
koyun. Kullanim devam edecekse GitHub workflow'dan uretilen tek listeye
baglayin ve CI'da endpoint/schedule drift testi ekleyin.

### D-05 - Orta - CI ve lokal verify sozlesmeleri ayni kalite yuzeyini test etmiyor

Kanıt:
- Root `package.json:24-27` icinde `verify:ci`, `verify:typecheck`,
  `verify:tests` ayrik tanimli. `verify:ci`, `verify:tests` calistirmiyor;
  provider guards uzerinden sadece web testlerini calistiriyor.
- GitHub CI typecheck isinde web/admin tsc kosuyor, mobile icin ise lint kosuyor:
  `.github/workflows/ci.yml:40-46`.
- GitHub CI test isinde web/admin/mobile testleri var:
  `.github/workflows/ci.yml:114-121`.
- GitHub CI connector package icin test veya typecheck kosmuyor; root
  `verify:typecheck` ve `verify:tests` ise connectors'i iceriyor.

Etki:
Gelistirici `pnpm verify:ci` calistirdiginda admin/mobile/connectors testlerini
gectigini sanabilir. GitHub tarafinda da connectors package degisikligi tsc/test
ile bloklanmayabilir. Connector runtime web tarafinda kritik oldugu icin bu
regression kacirma riski operasyonel olarak anlamli.

Oneri:
Root `verify:ci` ile GitHub CI'yi ayni hale getirin. En basit yol:
`pnpm verify:typecheck && pnpm verify:tests && pnpm verify:provider-guards`.
GitHub workflow'a connector tsc/test ve mobile tsc adimlarini da ekleyin.

### D-06 - Dusuk - Workspace invitation tek-pending kuralinin DB constraint'i zayif

Kanıt:
- `packages/db/prisma/schema.prisma:2215` unique constraint
  `[workspaceId, invitedEmail, expiresAt]` uzerinde.
- Route tarafinda live duplicate kontrolu uygulama kodunda:
  `apps/web/src/app/api/workspaces/[id]/invitations/route.ts:123-138`.
- Ayni route `Serializable` isolation ve P2034/P2002 mapping ile guclendirilmis:
  `apps/web/src/app/api/workspaces/[id]/invitations/route.ts:149-154`.

Etki:
Kullanici-facing route iyi savunulmus; ancak DB constraint gercek invariant'i
("workspace + email icin tek live pending invite") ifade etmiyor. Baska bir
script/admin import/raw DB path'i farkli `expiresAt` ile ayni email'e birden
fazla pending invite yaratabilir. Seat count pending invite'lari da saydigi icin
bu hem duplicate e-posta hem de seat kapasitesi sapmasi yaratir.

Oneri:
Route seviyesindeki korumayi koruyun, ama schema'da invariant'i temsil eden
ayri bir normalized key dusunun: ornegin pending durumunda dolu, diger
durumlarda null olan `pendingInviteKey`; veya create oncesi ayni workspace/email
icin tum live pending invite'lari transaction icinde revoke/expire eden tek
merkezi helper.

### D-07 - Dusuk - Ayni timestamp ile iki migration klasoru var

Kanıt:
- Migration klasorlerinde iki farkli `20260510000000_*` klasoru var:
  `20260510000000_add_mobile_oauth_codes` ve
  `20260510000000_add_provider_logo_candidates`.

Etki:
Prisma klasor adina gore deterministik ilerler, bu dogrudan runtime hatasi
degil. Ancak operasyon ve review tarafinda "hangi migration once?" sorusunu
gereksiz belirsizlestirir; manuel hotfix veya cherry-pick sureclerinde hata
payini artirir.

Oneri:
Yeni migration isimlendirmelerinde timestamp benzersizligini enforce eden kucuk
bir CI kontrolu ekleyin. Uygulanmis migration klasorlerini production gecmisi
net degilse yeniden adlandirmayin; bundan sonrasi icin guard yeterli.

## Izlenen Ama Bulguya Cevrilmeyen Noktalar

- `migrate-to-workspaces.ts` raw Prisma kullaniyor ve soft-deleted kullanicilari
  da backfill ediyor. Dosya bunu bilerek yapiyor; idempotent smoke testi var.
- Data retention queue satirlarini yalnizca `sent=true` ve eskiyse siliyor.
  Bu, stuck pending row'u sessizce kaybetmemek icin dogru tercih.
- Cron guard Upstash tamamen yoksa rate limit'i fail-open birakiyor. Secret
  kontrolu devam ettigi ve yorumda gerekce acik oldugu icin bunu bulgu saymadim.
- Root Dockerfile sadece web standalone image'i uretiyor. Admin icin ayri
  deployment modeli repo icinde net olmadigindan bunu hata olarak isaretlemedim.
