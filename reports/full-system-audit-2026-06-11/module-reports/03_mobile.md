# 03 - Mobile Denetimi

Durum: tamamlandi.

Kapsam: `apps/mobile/app`, `apps/mobile/src`, Expo config, mobil auth, yerel guvenlik,
IAP, push, workspace/davet, baglanti, dashboard, adres, servis, moving, budget,
provider, blog, support, widget ve yardimci kutuphaneler koddan okundu. Bu rapor
onceki dokumanlari kaynak almadan, okunan kod uzerinden yazildi.

## Onemli Pozitif Kontroller

- Mobil API istemcisi release build'de HTTP/localhost API origin'ini reddediyor
  ve varsayilan olarak HTTPS production API'ye dusuyor. `x-client-type`,
  platform, version ve User-Agent sinyalleri sunucuya tasiniyor.
- Tokenlar Expo SecureStore'da `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` ile tutuluyor;
  invalid/401 tokenlarda auth store temizleniyor.
- OAuth PKCE verifier/state akisi AsyncStorage ile tek kullanimli tutuluyor;
  callback code tekrar islenmesini engelleyen handled-code cache var.
- Sign-up legal acceptance zorunlu; OAuth sonrasi pending legal consents backend'e
  persist ediliyor ve pending workspace invite consume ediliyor.
- IAP satin alma akisi native store transaction'ini backend verify etmeden
  `finishTransaction` cagirmiyor. Restore da server verify yolundan geciyor.
- Mobile subscription ekrani iOS/Android'de store SKU yoksa web checkout CTA
  gostermiyor; Family/Pro web upgrade CTA'si native store platformu disina
  sinirlanmis.
- Workspace invite linkleri hem universal link hem manuel paste akisiyle ayni
  `/api/invitations/<token>/accept` endpoint'ine gidiyor; basari sonrasi plan
  tier/profile yenileniyor.
- Delete account ve export ekranlari server step-up durumunu okuyup password/MFA
  durumuna gore kullaniciyi yonlendiriyor.
- Address validation fail-open; save islemini dogrulama servisi hatasina baglamiyor.
- Blog native render HTML'i sade metne indiriyor; script/HTML tag render etmiyor.

## Bulgular

### M-01 - Yuksek - `setup-password` ekrani session-only kalici sifre set endpoint'ine bagli

Kaynaklar:
- `apps/mobile/app/setup-password.tsx:57`
- `apps/mobile/app/setup-password.tsx:58`
- `apps/web/src/app/api/auth/security/route.ts:207`
- `apps/web/src/app/api/auth/security/route.ts:222`
- `apps/web/src/app/api/auth/security/route.ts:227`
- `apps/web/src/app/api/auth/security/route.ts:263`

Mobil `setup-password` ekrani `/api/auth/security` uzerinden `action:
"set_password"` gonderiyor. Sunucu bu action'i aktif session ile kabul edip
kalici password hash'i yaziyor. Ayni route'ta daha guvenli `request_set_password`
email-link akisi de var; mobile settings/privacy zaten bu daha guvenli yolu
kullaniyor.

Etki: OAuth-only hesaba ait bearer session ele gecerse, ek bir email tokeni,
mevcut factor, current password, MFA step-up veya rate-limit ayrimi olmadan
hesaba password eklenebilir. Bu web raporundaki W-01 ile ayni kok nedene sahip,
mobile tarafinda stale ekran olarak hala ulasilabilir.

Oneri: `set_password` action'ini kaldirin veya yalnizca tek kullanimli email
tokeni / MFA step-up ile kabul edin. Mobil `setup-password` ekranini
`request_set_password` akisiyle degistirin ya da route'u tamamen kaldirin.

Duzeltme notu (2026-06-11): Mobil `setup-password` ekrani parola formu yerine
`request_set_password` email-link akisini kullanacak sekilde guncellendi. Lokal
`hasPasswordLogin` patch'i kaldirildi; hesap durumu artik email linki kullanilip
server password hash'i gercekten yazildiktan sonra `/api/auth/me` uzerinden
yansir.

### M-02 - Orta - Mobil Connections "Sync now" legacy, workspace-aware olmayan dispatch endpoint'ini kullaniyor

Kaynaklar:
- `apps/mobile/app/settings/connections.tsx:50`
- `apps/mobile/app/settings/connections.tsx:52`
- `apps/mobile/app/settings/connections.tsx:158`
- `apps/mobile/app/settings/connections.tsx:162`

Mobil Connections ekrani "Sync now" icin dogrudan `POST
/api/connector-dispatch` cagiriyor. Web denetiminde bu endpoint'in workspace
scope/role/status kontrollerini yeni workspace sync route'u kadar siki
uygulamadigi ve `enqueueAddressChange` icin workspace baglamini tasimadigi
tespit edildi.

Etki: Mobil UI bu legacy yolu aktif kullandigi icin, workspace kapsamindaki adres
degisikligi islemleri personal/legacy dispatch yoluna dusup adres-change
history, workspace scoping ve managed-sync politikalarindan sapabilir.

Oneri: Mobil "Sync now" butonunu workspace-aware sync endpoint'ine tasiyin veya
legacy route'u ayni workspace context, membership role, entitlement ve audit
kontrolleriyle sarmalayin.

### M-03 - Orta - Logout push token temizligi sadece client best-effort

Kaynaklar:
- `apps/mobile/src/lib/push.ts:150`
- `apps/mobile/app/(tabs)/more.tsx:98`
- `apps/mobile/app/(tabs)/more.tsx:99`
- `apps/mobile/src/components/AppLockGate.tsx:122`
- `apps/mobile/src/components/AppLockGate.tsx:123`
- `apps/web/src/app/api/auth/logout/route.ts:11`
- `apps/web/src/lib/notifications.ts:86`
- `apps/web/src/lib/notifications.ts:96`

Normal logout ve app-lock signout akislari once `unregisterPushNotifications`,
sonra `/api/auth/logout` cagiriyor. Sira dogru; ancak unregister Expo token alma,
network, API hata veya rate-limit durumunda sessizce basarisiz oluyor. Sunucu
logout route'u yalnizca session'i destroy ediyor; `PushDevice` kaydini server
tarafindan temizlemiyor. Push sender ise `pushDevice.findMany({ userId })` ile
kalan tokenlara bildirim gonderiyor ve push body kullaniciya ait baglam
tasiyabiliyor.

Etki: Kullanici logout olduktan sonra stale push token kalirsa, bu cihaz yeni
login/yeniden kayit olana veya Expo token invalid olana kadar eski kullaniciya
ait bildirimleri alabilir. Immediate hard-delete user cascade ile temizler; fakat
normal logout ve scheduled/grace deletion icin ayni garanti yok.

Oneri: Logout endpoint'ine mobil client icin token parametresi veya session-device
baglantisi ekleyip server-side push kaydini revoke edin. Alternatif olarak
`destroyUserSession` oncesi current device id/token auditli delete yapin ve
bildirim sender'da son aktif session/device durumunu da kontrol edin.

### M-04 - Orta - App lock recovery, yerel auth basarisizken session'i koruyarak kilidi kapatabiliyor

Kaynaklar:
- `apps/mobile/src/components/AppLockGate.tsx:57`
- `apps/mobile/src/components/AppLockGate.tsx:129`
- `apps/mobile/src/components/AppLockGate.tsx:133`
- `apps/mobile/src/components/AppLockGate.tsx:140`
- `apps/mobile/src/components/AppLockGate.tsx:171`
- `apps/mobile/src/components/AppLockGate.tsx:174`
- `apps/mobile/src/components/AppLockGate.tsx:179`

App lock overlay, local authentication capability kullanilamaz oldugunda
`Disable app lock & continue` aksiyonunu gosteriyor ve `disableLock()` sonrasi
mevcut authenticated session ile uygulamaya devam ettiriyor.

Etki: Cihaz unlock edilmis ama app lock device auth artik kullanilamaz durumdaysa
ikinci katman tamamen kaldirilabiliyor. Bu recovery amacli olabilir, fakat app
lock'un beklenen guvenlik sinirini zayiflatiyor; ozellikle bearer token hala
SecureStore'da oldugu icin server re-auth gerekmiyor.

Oneri: Recovery seceneginde "continue" yerine sign-out yapin ya da backend
password/MFA/email-link step-up ile kilidi resetleyin. En azindan bu olayi
security audit event olarak kaydedin.

### M-05 - Dusuk - Budget detail route'u var ama kullanici akisi tarafindan kullanilmiyor

Kaynaklar:
- `apps/mobile/app/budget/[id].tsx:25`
- `apps/mobile/app/budget/index.tsx:1142`
- `apps/mobile/app/budget/index.tsx:1167`
- `apps/mobile/app/budget/index.tsx:1178`
- `apps/mobile/app/search.tsx:189`
- `apps/mobile/app/search.tsx:206`

`/budget/[id]` detail screen mevcut; fakat Budget History satirlari
`Touchable` degil, sadece `View` render ediyor. Global search budget sonucunu da
spesifik detail yerine `/budget` hub'ina gonderiyor. Search icindeki yorum "per-row
detail yok" diyor, ama route gercekte mevcut.

Etki: Kullanici bir budget row'unun detayina dogal yoldan ulasamiyor. Detay
ekrani stale kalma ve test edilmeden bozulma riski tasiyor.

Oneri: Budget History satirlarini `/budget/[id]` route'una baglayin ve search
sonucunu `{ pathname: "/budget/[id]", params: { id: budget.id } }` yapin. Eger
detail artik istenmiyorsa route'u kaldirin.

### M-06 - Dusuk - Mobil analytics session dili her zaman `en`

Kaynaklar:
- `apps/mobile/src/components/SessionTracker.tsx:38`

Session tracker device info payload'inda `language: "en"` hard-coded. Uygulama
i18n config ve ekranlarda `i18n.language` kullaniyor; analytics session ise
Ispanyolca veya cihaz dili degisimlerini yansitmiyor.

Etki: Analytics, lokasyon/cihaz segmentasyonu ve consent sonrasi kullanici dili
raporlamasi hatali olur. Guvenlik etkisi yok; urun/operasyon raporlari yanlis
okunabilir.

Oneri: `i18n.language`, `expo-localization` veya mevcut i18n config'ten resolved
locale gonderin.

### M-07 - Dusuk - Reset-password ekrani client password policy feedback'i vermiyor

Kaynaklar:
- `apps/mobile/app/reset-password/[token].tsx:24`
- `apps/mobile/app/reset-password/[token].tsx:35`
- `apps/mobile/app/reset-password/[token].tsx:41`
- `apps/mobile/app/reset-password/[token].tsx:48`

Sign-up ve setup-password ekranlari password policy helper kullanirken reset
password confirm ekrani yalnizca bos/mismatch kontrolu yapiyor ve server hata
durumunda genel `resetPasswordFailed` mesaji gosteriyor.

Etki: Server policy yine otorite oldugu icin security bypass yok. Ancak kullanici
12+ karakter, uppercase/lowercase/digit/special kurallarini neden gecemedigini
gormeden generic hata aliyor.

Oneri: `isPasswordPolicyMet` ve rule feedback component'ini reset-password
ekranina da ekleyin; server error code varsa spesifik policy mesajina cevirin.

## Modul Baglantilari

- Mobile auth -> Web auth/security: bearer token, OAuth handoff, native Apple,
  password setup ve MFA endpoint'leri web API kontratina bagli.
- Mobile billing -> Web mobile IAP: `/api/mobile/iap/products`, `/api/mobile/iap/verify`
  ve App Store/Play webhook idempotency web tarafinda cozulmeli.
- Mobile workspace -> Web workspace/invite: invite kabul, membership ve plan
  inheritance web workspace endpoint'lerine bagli.
- Mobile connectors -> Web connector-dispatch: `connections.tsx` legacy dispatch
  route'unu aktif UI'dan kullaniyor.
- Mobile notifications -> Web push sender: client token register/unregister
  web `PushDevice` tablosuna ve cron notification sender'a bagli.
- Mobile budget/services/moving/providers -> Web shared API: list/detail ekranlari
  server-side workspace resolver ve plan gate'lerine guveniyor.

## Sonuc

Mobile tarafinda temel guvenlik ve store policy kontrollerinin buyuk kismi dogru
kurulmus. Kritik riskler, mobile'in web API'deki iki eski/gevsek sozmelesmeye
hala bagli olmasindan geliyor: session-only `set_password` ve legacy
`connector-dispatch`. Bunun disinda push revocation, app-lock recovery ve budget
detail navigasyonu gibi daha sinirli ama gercek davranis sorunlari var.
