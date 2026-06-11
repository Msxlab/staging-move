# 02 - Web Modul Denetimi

Tarih: 2026-06-11
Kaynak kural: Mevcut rapor/dokuman `.md` dosyalari okunmadi; web bulgulari route, middleware, lib, schema ve app kodu okunarak yazildi.

## Kapsam

- `apps/web/src/middleware.ts`: public API listeleri, CSRF, body limit, rate limit, JWT middleware check, security headers
- Auth: register, login, logout, `me`, email verification, resend, password reset/change, MFA setup/confirm/disable, account security
- Mobile auth bridge: mobile login, Apple native auth, OAuth exchange, PKCE code consume
- Account/privacy: consent, CCPA, profile, legal acceptance, export/PDF, account delete/restore
- Workspace: members, invitations, accept/decline, transfer, delete/restore, sync, managed sync, data scope
- Core user data: addresses, services, custom providers, moving plans, move tasks, budget/actuals
- Billing: Stripe checkout/portal/actions/change-plan/switch-cycle, acquisition redeem/public campaign, IAP verify
- Webhooks: Stripe, App Store, Play Store, Resend, connector webhooks
- Connectors: catalog, partner consents, OAuth initiate/callback, connector dispatch/runtime
- Notifications/tracking/support: notifications, preferences, push register, tracking session/event, support tickets, unsubscribe
- Public utility/content: providers, saved providers, movers, state rules, blog posts/view/image/revalidate, help, maps, vehicles

## Bulgular

### W-01 - High - OAuth-only hesapta parola ekleme sadece mevcut session ile yapiliyor

Dosya:
- `apps/web/src/app/api/auth/security/route.ts`

`POST /api/auth/security` icindeki `set_password` dali, hesabinda henuz parola olmayan ve email'i verified olan kullanicinin sadece aktif session'i ile kalici parola atamasina izin veriyor. Mevcut OAuth faktoru, email-token, MFA challenge veya mevcut parola dogrulamasi yok. Ayni kod tabaninda `password/change`, MFA setup/disable, account delete/export gibi hassas islemler step-up veya mevcut parola istiyor.

Etki: OAuth-only hesabin session'i ele gecirilirse saldirgan hesaba kalici email/parola girisi ekleyebilir. OAuth provider erisimi geri alinsa bile yeni parola ile hesapta kalabilir.

Oneri:
- `set_password` icin email linkli `request_set_password` akisini zorunlu yapin veya `verifyUserStepUp` benzeri bir challenge uygulayin.
- Basarili parola ekleme sonrasi diger session'lari invalid edin veya en azindan riskli session refresh yapin.
- Route-local rate limit ekleyin ve audit action'i `SET_PWD_DONE` yaninda step-up method ile zenginlestirin.

Duzeltme notu (2026-06-11): `set_password` action'i
`apps/web/src/app/api/auth/security/route.ts` icinden kaldirildi. Web
`setup-password` ekrani artik `request_set_password` email-link akisini
kullaniyor ve post-auth/onboarding yonlendirmesi OAuth-only kullaniciyi bu
sayfaya zorlamiyor.

### W-02 - High - App Store ve Play Store webhook idempotency check-then-act race yapiyor

Dosyalar:
- `apps/web/src/app/api/webhooks/appstore/route.ts`
- `apps/web/src/app/api/webhooks/playstore/route.ts`
- `apps/web/src/lib/webhook-idempotency.ts`
- Karsilastirma icin: `apps/web/src/app/api/webhooks/stripe/route.ts`

Apple/Google webhook route'lari once `hasProcessedWebhookEvent(...)` ile bakiyor, sonra subscription state update/email/notice gibi side-effect'leri calistiriyor, en sonda `markWebhookEventProcessed(...)` ile isaretliyor. Ayni event paralel teslim edilirse iki request de "islenmemis" gorup side-effect bolumune girebilir. Stripe webhook tarafinda daha saglam desen var: event basinda unique marker ile reserve ediliyor, hata durumunda release ediliyor.

Etki: Concurrent duplicate IAP notification'lari subscription update, cancellation notice, entitlement reconcile ve email/notification gibi islemleri birden fazla calistirabilir. Bazi islemler idempotent tasarlanmis olsa da zincirin tamami bu varsayima baglanmis durumda.

Oneri:
- App Store/Play Store icin de Stripe ile ayni reserve-first desenini kullanin.
- `markWebhookEventProcessed` sonucu `duplicate` ise side-effect'e girmeden cikilsin.
- Isleme sirasinda hata olursa `releaseProcessedWebhookEvent` ile provider retry'ina izin verilsin.

### W-03 - Medium - Explicit workspace secimi gecersizse veri route'lari sessizce en eski workspace'e duser

Dosyalar:
- `apps/web/src/lib/workspace-context.ts`
- `apps/web/src/lib/workspace-data-scope.ts`
- `apps/web/src/app/api/addresses/route.ts`
- `apps/web/src/app/api/services/route.ts`
- `apps/web/src/app/api/moving/route.ts`
- `apps/web/src/app/api/budget/route.ts`

`requireWorkspaceContext` explicit header/cookie ile istenen workspace'te uyelik bulamazsa kullanicinin en eski workspace'ine dusuyor ve `staleWorkspaceCookie` set ediyor. Bu lockout'u azaltan bilincli bir tercih, fakat ayni helper mutating data route'larinda da kullaniliyor. Kotu/stale `X-Workspace-Id` veya cookie ile gelen POST/PATCH istegi, kullanicinin bekledigi workspace yerine baska workspace scope'unda calisabilir.

Etki: Client stale workspace state tutarsa adres/servis/move/budget yazmalari yanlis workspace'e kayabilir. Bu bir yetki bypass'i degil, ama ciddi veri butunlugu ve UX riski.

Oneri:
- GET/read-only isteklerde fallback korunabilir.
- Mutating route'larda explicit requested workspace gecersizse `409 STALE_WORKSPACE_SELECTION` veya `403` dondurun.
- Response body'de `resolvedWorkspaceId` zorunlu yapilip client'in secimi yenilemesi saglanabilir.

### W-04 - Medium - Eski `/api/connector-dispatch` workspace scope/role kontrollerini kullanmiyor

Dosyalar:
- `apps/web/src/app/api/connector-dispatch/route.ts`
- `apps/web/src/lib/connector-runtime.ts`
- `apps/web/src/app/api/workspaces/[id]/sync/route.ts`

Workspace-aware sync route'u `WORKSPACE_MODEL_ENABLED`, caller role/status, target member managed-sync consent, workspace owner entitlement ve address workspace membership kontrolu yapiyor. Buna karsin eski `POST /api/connector-dispatch` endpoint'i yalnizca caller session + caller'in kendi API connector entitlement'ini kontrol ediyor; `enqueueAddressChange` cagrisina `workspaceId` vermiyor. `toAddressId` verilmezse caller'in primary address'i de workspace filtresi olmadan seciliyor.

Etki: Caller'a ait ama workspace'e bagli bir adres icin, workspace role/status politikasi ve stale workspace secimi bypass edilebilir. Bu cross-user token sızıntısı degil; fakat workspace'in "sync yapabilir mi" is kuralini dolasan paralel bir giris noktasi.

Oneri:
- `connector-dispatch` ya legacy/self-only olarak workspaceId null adreslerle sinirlanmali ya da `resolveWorkspaceDataScope` + `assertWorkspaceAction("addressChange.initiate")` kullanmali.
- Workspace adresi gonderildiginde workspace route'una yonlendirme veya 409 ile net hata verilmeli.

### W-05 - Low - Web register legal acceptance source `mobile_register` olarak yaziliyor

Dosya:
- `apps/web/src/app/api/auth/register/route.ts`

Web register route'unda legal acceptance kaydi `source: "mobile_register"` ile yaziliyor. Davranis kullaniciya zarar vermiyor, fakat audit/funnel raporlari web sign-up'i mobile gibi sayabilir.

Oneri: Web route icin `source: "web_register"` kullanin; mobile route ayni helper'i cagiriyorsa client tipine gore source ayirin.

### W-06 - Low - Acquisition redeem yorumlari schema ile artik uyusmuyor

Dosyalar:
- `apps/web/src/app/api/acquisition/redeem/route.ts`
- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/20260606000001_acquisition_redemption_unique/migration.sql`

Redeem route yorumlari `(userId, campaignId)` icin henuz unique index olmadigini soyluyor. Schema ve migration ise `@@unique([userId, campaignId])` eklenmis durumda. Kodun catch blogu da P2002 bekliyor. Bu artik runtime bug degil; fakat gelecekte denetim ve bakim sirasinda yanlis varsayim uretir.

Oneri: Eski yorum bloklarini guncelleyin; concurrency aciklamasini DB-enforced idempotency olarak duzeltin.

## Guclu Kontroller

- Session katmani sadece JWT imzasiyla yetinmiyor; token hash'i `userLoginSession` tablosunda aktif/expire/fingerprint ile dogruluyor.
- Middleware CSRF, body size, public/private API ayrimi, public write/read rate limit ve security header setlerini merkezi uyguluyor.
- Cron route'larinin tamami `guardCronRequest` kullaniyor; internal route'lar `verifyInternalAuth` ile ayrilmis.
- Password login unknown user timing equalization, MFA/backup-code failure counting ve generic errors iceriyor.
- Account delete/export/PDF gibi hassas akislarda rate limit ve step-up var.
- Stripe checkout/portal/change-plan/switch-cycle mobile billing guardlari, terms/snapshot ve managed subscription korumalari iyi kurulmus.
- Stripe webhook reserve-first idempotency deseni dogru; Apple/Google icin de model alinacak iyi ornek mevcut.
- IAP verify tarafinda ownership binding, active managed subscription conflict ve store provider ayrimi var.
- Workspace permission matrix owner/admin/member/child/view-only ayrimini merkezi paylasilan `can(...)` fonksiyonundan aliyor.
- Address/service/moving/budget route'lari workspace scope, child self-only ve sensitive service redaction kontrollerini genelde uyguluyor.
- Blog image proxy key pattern, imgproxy HMAC ve public post query sanitize/caching net.
- Affiliate click open redirect olmuyor; redirect URL DB'den okunuyor ve https zorunlu.
- Tracking event metadata PII key/value filtreleri uyguluyor ve consent durumunu kontrol ediyor.

## Dusurulen Aday Bulgular

- `GET /api/invitations/[token]` ve `GET /api/providers/*` icin ilk bakista middleware public listesi exact gibi gorundu. Kod tekrar okununca `PUBLIC_API_GET` icin `matchesPathOrChild` kullanildigi dogrulandi; bu nedenle davet landing ve provider child GET route'lari public sozlesmesiyle uyumlu.
- Provider popularity endpoint'i anonim public olarak tasarlanmis, route-local rate limit ve k-anonymity esikleri var; rapora bug olarak alinmadi.
- Acquisition redeem concurrency acigi yorumu eski kalmis; schema/migration unique index ekledigi icin runtime bulgu degil.

## Durum

Web modul todo kalemleri bu raporla tamamlandi. Bulgular sonraki mobile/shared/db denetiminde capraz baglarla tekrar karsilastirilacak.
