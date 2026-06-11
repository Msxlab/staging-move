# 01 - Admin Modul Denetimi

Tarih: 2026-06-11
Kaynak kural: Mevcut rapor/dokuman `.md` dosyalari okunmadi; bulgular admin kodu, route, lib, schema baglantilari ve config akislari okunarak yazildi.

## Kapsam

- `apps/admin/src/middleware.ts`
- Admin app layout, page auth guard, login, MFA, step-up ve session akislari
- Security dashboard, internal security event, IP rule ve audit log akislari
- Backup/export/import/SQL dump, retention ve table count listeleri
- User detail/update, billing override, hard delete, impersonation ve workspace admin akislari
- Provider catalog, coverage, logo, governance, bulk import/export ve revalidate akislari
- Subscription, Stripe admin action, invoices, acquisition, affiliate, sponsored, waitlist ve support yuzeyleri
- Blog/editor/content sanitizer, preview, publish, image upload ve cleanup akislari

## Bulgular

### A-01 - High - Break-glass IP bypass olayi web internal endpoint tarafinda dusuyor

Dosyalar:
- `apps/admin/src/middleware.ts`
- `apps/admin/src/app/api/internal/security-event/route.ts`

Admin middleware `IP_RULE_BYPASSED_FOR_BREAK_GLASS` tipinde security event gonderiyor. Internal endpoint ise yalnizca `BLOCKED_IP_ATTEMPT` ve `SESSION_HIJACK_ATTEMPT` tiplerini kabul ediyor. Sonuc: break-glass bypass telemetry 400 ile dusuyor ve olay kaydi/uyari kanali calismiyor.

Oneri: Internal endpoint event union'ina `IP_RULE_BYPASSED_FOR_BREAK_GLASS` eklenmeli, severity/action mapping yazilmali ve middleware icin test eklenmeli.

### A-02 - Medium - Security dashboard login metrikleri gercek audit action adlariyla uyusmuyor

Dosyalar:
- `apps/admin/src/app/(admin)/security/page.tsx`
- `apps/admin/src/app/api/auth/login/route.ts`

Dashboard `adminAuditLog action: "LOGIN"` uzerinden metrik ariyor. Login route ise `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGIN_BLOCKED`, `MFA_REQUIRED` ve ayrica `adminLoginLog` yaziyor. Bu nedenle dashboard login istatistikleri eksik/yanlis gorunebilir.

Oneri: Dashboard sorgusu gercek action setine gore guncellenmeli veya login route canonical bir `LOGIN` action da yazmali.

### A-03 - Medium - Backup tablo count listesi asil backup tablo listesiyle eksik

Dosyalar:
- `apps/admin/src/app/api/backup/route.ts`
- `apps/admin/src/lib/backup-tables.ts`

`BACKUP_TABLE_COUNTS` 27 tablo sayarken `BACKUP_TABLES` 44 tabloyu dump ediyor. Count raporu eksik kalir ve operator yedek kapsaminda yanlis guven alir.

Eksik gorulen tablo gruplari: workspace, workspace member, notification preference, address change, reminders, email templates, connector fallback, support tickets/messages, affiliate, sponsored placements, help/faqs, state rules, ip rules, waitlist.

Oneri: Count listesi `BACKUP_TABLES` kaynagindan turetilmeli veya tek canonical liste kullanilmali.

### A-04 - High - Billing tarih validator zorunlu tarihleri mevcut null durumda yakalamiyor

Dosya:
- `apps/admin/src/app/api/users/[id]/route.ts`

`trialEndsAt`, `freeAccessEndsAt`, `premiumUntil` alanlari body'de hic gonderilmezse ve mevcut deger null ise validator bazi akislerde bunu gecirebiliyor. `willHaveTrialEnd` benzeri kontroller varsayilan true oluyor; hata yalnizca body alani `null` ise yakalaniyor.

Etki: Admin billing override, aktif/trial/free access/premium durumunu bitis tarihi olmadan kaydedebilir. Sonraki entitlement ve cron akislari belirsiz davranir.

Oneri: "effective final value" hesaplanmali: body'de varsa body, yoksa mevcut DB degeri. Required date kontrolleri bu final deger uzerinden yapilmali.

Duzeltme notu (2026-06-11): `validateBillingCombination` artik
`trialEndsAt`, `freeAccessEndsAt` ve `premiumUntil` icin final effective degeri
hesapliyor. Body'de tarih alani gelmediginde mevcut DB degeri kullaniliyor; bu
final deger null kalacaksa `TRIALING`, non-admin `FREE_ACCESS` ve `ACTIVE` +
`ADMIN` manual premium durumlari reddediliyor. Regresyon testleri
`apps/admin/src/app/api/users/[id]/route.test.ts` icine eklendi.

### A-05 - High - Hard delete DB silme sonrasi Stripe cancel hatasini yutuyor

Dosyalar:
- `apps/admin/src/lib/hard-delete-user.ts`
- `apps/admin/src/app/api/users/[id]/hard-delete/route.ts`
- `apps/admin/src/app/(admin)/users/[id]/page.tsx`

Hard delete kullanici verisini sildikten sonra Stripe subscription cancel denemesini best-effort yapiyor. Hata swallow ediliyor, route `{ success: true, hardDeleted: true }` donebiliyor ve UI kalici silme basarili toast'i gosteriyor.

Etki: Kullanici silinmisken Stripe aboneligi dis sistemde aktif kalabilir; operator basari gordugu icin manuel takip kacabilir.

Oneri: Stripe cancel silmeden once yapilmali veya failure durumunda hard delete "partial failure" olarak donmeli, audit/alert olusturulmali ve UI net aksiyon gostermeli.

### A-06 - Medium - Provider catalog create/import/update/bulk yazmalari step-up tutarliliginda degil

Dosyalar:
- `apps/admin/src/app/api/providers/*`
- `apps/admin/src/app/api/providers/bulk/*`
- `apps/admin/src/app/api/providers/[id]/*`

Delete/merge/coverage gibi bazi provider operasyonlari daha siki guard veya step-up beklerken catalog create/import/update/bulk non-delete akislarinda ayni hassasiyet yok. Bu alan public catalog ve affiliate CTA yuzeyini etkiliyor.

Oneri: Public catalogu, affiliate URL'leri ve coverage modelini degistiren tum mutation'lara ayni step-up/role sinifi uygulanmali.

### A-07 - Medium - Waitlist export maskeli ama admin GET/UI raw email gosteriyor

Dosyalar:
- `apps/admin/src/app/api/waitlist/route.ts`
- `apps/admin/src/app/(admin)/waitlist/page.tsx`

Waitlist export mask/step-up yapiyor, fakat ana GET/UI raw email gosteriyor ve PATCH audit metadata raw email yazabiliyor.

Oneri: Varsayilan listede maskeli email, raw email icin explicit reveal + step-up, audit metadata'da masked email kullanimi.

### A-08 - Medium - Moving-plan admin endpointleri dusuk rolde email/adres detaylarini aciyor

Dosyalar:
- `apps/admin/src/app/api/moving-plans/*`

`VIEWER` seviyesinde bazi moving-plan endpointleri kullanici emaili ve sokak adreslerini donduruyor. Admin PII gorunurluk modeli icin gereksiz genis.

Oneri: Viewer icin email/street/zip gibi PII alanlari maskelenmeli veya `CUSTOMER_SUPPORT` ve ustune alinmali.

### A-09 - Low - Admin audit wrapper yerine dogrudan `prisma.adminAuditLog.create` daginik

Dosyalar:
- `apps/admin/src/app/api/**`
- `apps/admin/src/lib/**`

Kodda merkezi wrapper beklentisi varken bircok route dogrudan `prisma.adminAuditLog.create` kullaniyor. Bu durum redaction, metadata standardi ve failure handling'i dagitiyor.

Oneri: Yeni mutation'lar wrapper'a alinmali; kritik var olanlar kademeli migrate edilmeli.

### A-10 - Low - Runtime config URL validator yorumu ile davranisi uyusmuyor

Dosya:
- `apps/admin/src/lib/runtime-config.ts`

Yorum `DATABASE_URL`/`REDIS_URL` gibi non-http degerlerin ozel ele alinabildigini soyluyor, fakat validator non-http protokolu ozel-case'e gelmeden reddedebiliyor.

Oneri: Yorum/validator sirasini ayni sozlesmeye getirin; deployment-only hatalar dogru mesajla ayrilsin.

## Guclu Kontroller

- Admin layout/page guard katmani `requirePageAdmin` ile merkezi korunuyor.
- Runtime config hassas deger maskesi ve guardlari mevcut.
- Subscription lifecycle islemlerinde plan/status/provider ayrimi genelde iyi kurulmus.
- Workspace admin akislarinda owner/role sinirlari ve audit izleri var.
- Blog content sanitizer merkezi ve publish/preview ayrimi net.
- SQL dump `spawn("mysqldump", args)` ile shell interpolation kullanmadan yapiliyor.
- Hard delete step-up ve email OTP istiyor; asil sorun dis sistem sonucu handling'i.

## Durum

Admin modul todo kalemleri bu raporla tamamlandi. Bulgular sonraki final rapora tasinacak ve web/mobile/shared/db bulgulariyla iliskilendirilecek.
