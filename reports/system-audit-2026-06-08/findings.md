# Findings

Durum: 2026-06-08 ilk full-pass dogrulanmis bulgular.

## F-001 Partner Consent Refresh Route Middleware'de Takilabilir

Severity: High

Kanit:

- `apps/web/src/app/api/partner-consents/[id]/refresh/route.ts:10-27` endpointi cron/system token refresh isi olarak tanimliyor ve `CRON_SECRET` bearer kontrolu yapiyor.
- `apps/web/src/middleware.ts:62-100` public API listesinde `/api/partner-consents/[id]/refresh` yok; `/api/cron/*` var ama bu route cron klasorunde degil.
- `docker/ofelia.ini:100-103` connector dispatch cronunu `/api/cron/connector-dispatch` olarak calistiriyor; partner-consent refresh icin schedule gorulmedi.
- Ayni kod ailesinde normal cron route'lari `guardCronRequest()` kullaniyor; bu route bespoke `bearer === secret` kontrolu kullaniyor.

Etki:

- Partner access token refresh job'u `CRON_SECRET` ile cagrilsa bile middleware user JWT bekledigi icin route handler'a ulasmadan 401 alabilir.
- Refresh token'lari yenilenmezse `PartnerConsent` kayitlari stale/expired hale gelir; connector dispatch akislarinda kullanici tekrar baglanmak zorunda kalir veya connector islemleri sessizce bozulur.

Oneri:

- Route'u `/api/cron/partner-consents/refresh` altina tasiyip `guardCronRequest()` kullan.
- Alternatif olarak middleware exact allowlist + route icinde `verifyInternalAuth(..., "cron")` + rate limit kullan.
- Route icin test ekle: `CRON_SECRET` bearer kabul ediliyor, user JWT olmadan calisiyor, yanlis secret 401.
- Scheduler wiring'i netlestir: hangi cron bu endpointi hangi consent seti icin cagiriyor?

## F-002 Public Provider Popularity Endpoint Kucuk Orneklem Mahremiyet Riski Tasiyor

Severity: Medium

Kanit:

- `apps/web/src/middleware.ts:97-100` `/api/providers` GET'i public yapar; child path olarak `/api/providers/popular` da bu kapsama girer.
- `apps/web/src/app/api/providers/popular/route.ts:30-39` eyalet adreslerinden user id listesi cikarir ve servisleri bu user seti uzerinden sorgular.
- `apps/web/src/app/api/providers/popular/route.ts:95-101` `usageCount`, `percentOfUsers`, `userCount` dondurur.
- Esik/k-anonimlik kontrolu yok.

Etki:

- Kullanici sayisi az olan eyaletlerde public caller, tekil veya cok kucuk gruplarin hangi provider'lari kullandigini tahmin edebilir.
- Bu veri anonimlestirilmis olsa da adres eyaleti + provider hizmeti hassas profil sinyali olabilir.

Oneri:

- Minimum cohort esigi ekle: ornek `userIds.length >= 20` ve provider count >= 5 olmadan `topProviders`/percent dondurme.
- Public endpoint'te sadece katalog bazli onceden agregasyonlu alanlari kullan; canli user service join'ini auth/admin-only yap.
- Response'tan raw `usageCount`/`percentOfUsers` kaldir veya bucket'la.
- Route testi ekle: kucuk orneklem bos/bucketed response dondurur.

## F-003 API Route Sibling Test Kapsami Tutarsiz

Severity: Medium

Kanit:

- Web API: 142 `route.ts`; 67 sibling `route.test.ts`; 75 route icin sibling test yok.
- Admin API: 107 `route.ts`; 36 sibling `route.test.ts`; 71 route icin sibling test yok.

Etki:

- Mobile, web ve admin ayni API sozlesmelerine bagli oldugu icin route-level regresyonlar UI testlerinden once kacabilir.
- Eksik sibling test, route tamamen testsiz demek olmayabilir; ancak kritik auth/billing/workspace/cron endpointlerinde dogrudan route contract testi gerekir.

Oneri:

- Sibling test eksiklerini kritiklige gore sirala: auth/session/security, billing/IAP/webhooks, workspace/permission, moving/move-tasks, cron/internal, provider public privacy.
- Contract testlerde mobile bearer + web cookie yollarini birlikte kapsa.

## F-004 Admin Middleware Rate Limit Instance-Local

Severity: Low/Medium

Kanit:

- `apps/admin/src/middleware.ts:388` admin route rate limit state'i in-memory `Map` ile tutuyor.
- `apps/admin/src/middleware.ts:417-429` limit sayaci bu local map uzerinden artiyor.

Etki:

- Multi-instance/serverless/edge ortamda limitler instance basina calisir; global abuse throttling icin yeterli olmayabilir.
- Web app rate limit Upstash destekli helper kullanirken admin middleware yerel store'a dayaniyor.

Oneri:

- Admin route limiter'i web `rateLimit` helper/Upstash altyapisina tasimayi degerlendir.
- En azindan production-readiness/security dashboard bunu "instance-local" olarak raporlasin.

## F-005 Workspace Connector Entitlement ve Sync Akislarinda Legacy Drift

Severity: Medium

Kanit:

- Web Connections UI `apps/web/src/app/(app)/settings/connections/page.tsx:124` legacy `/api/connector-dispatch` endpointini cagiriyor.
- Mobile Connections UI `apps/mobile/app/settings/connections.tsx:52` ayni legacy `/api/connector-dispatch` endpointini cagiriyor.
- Legacy route `apps/web/src/app/api/connector-dispatch/route.ts:24` entitlement'i `session.userId` uzerinden kontrol ediyor.
- Legacy route `apps/web/src/app/api/connector-dispatch/route.ts:34` primary address'i sadece `{ userId: session.userId }` ile buluyor.
- Legacy route `apps/web/src/app/api/connector-dispatch/route.ts:44` `enqueueAddressChange` cagriliginda `workspaceId` gondermiyor.
- Workspace-aware route `apps/web/src/app/api/workspaces/[id]/sync/route.ts:44` owner entitlement'i kontrol ediyor ve `:101` `workspaceId: id` ile enqueue ediyor.
- Address update auto-sync `apps/web/src/app/api/addresses/[id]/route.ts:158-160` workspace varsa owner entitlement'i ve `workspaceId` kullaniyor; yani modern yol workspace-aware.
- Catalog/OAuth tarafinda `apps/web/src/app/api/connectors/catalog/route.ts:127`, `partner-consents/oauth/initiate/route.ts:34`, `partner-consents/oauth/callback/route.ts:54` entitlement'i halen `session.userId` uzerinden kontrol ediyor.

Etki:

- `WORKSPACE_MODEL_ENABLED` acikken, owner'in Pro/annual entitlement'ina bagli bir workspace member'i Connections ekraninda "not entitled" ya da upgrade durumu gorebilir.
- Legacy manual sync, workspace adresi icin `AddressChangeEvent.workspaceId = null` uretme riski tasir; history/scope ve connector fallback kayitlari personal/workspace ayrimini kaybedebilir.
- OAuth connect akisi workspace owner entitlement'i yerine member subscription'ina bakarsa aile/pro workspace deneyimi tutarsizlasir.

Oneri:

- Web/mobile Connections ekranlari aktif workspace context varsa `/api/workspaces/[id]/sync` kullansin.
- Connector catalog ve OAuth initiate/callback, workspace context aktifse entitlement'i workspace owner uzerinden hesaplasin.
- Partner consent modelinde personal vs workspace scope acikca temsil edilmeli veya UI personal/workspace modunu net ayirmali.
- Test ekle: owner Pro, member Free, workspace enabled -> catalog entitled, OAuth initiate allowed, manual sync `workspaceId` ile enqueue.

## F-006 `.env.example` Kaynak Kod ve Runtime Config ile Drift Halinde

Severity: Medium

Kanit:

- Temiz env taramasi: kaynak kodda 85 `process.env.*` anahtari, `.env.example` icinde 111 anahtar, runtime-config katalogunda 103 anahtar.
- Kaynak kodda kullanilip `.env.example` icinde olmayan 35 anahtar bulundu. Ornekler: `ACCOUNT_DELETION_GRACE_DAYS`, `ACCOUNT_RESTORE_SECRET`, `ADMIN_ACTION_OTP_SECRET`, `ADMIN_APP_URL`, `ADMIN_SESSION_HANDLE_SECRET`, `AFFILIATE_POSTBACK_SECRET`, `AUTH_SECRET`, `COPPA_AGE_GATE_ENABLED`, `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_APP_URL`, `EXPO_PUBLIC_SENTRY_DSN`, `GUIDED_PARTNERS`, `MAIL_FROM`, `MYSQL_DATABASE_URL`, `NOTIFICATION_PUSH_ENABLED`, `RESEND_FROM`, `SECURITY_ALERTS_ENABLED`, `SECURITY_ALERT_WEBHOOK_URL`, `SQL_DUMP_READY_TIMEOUT_MS`, `TEST_AUTOMATION_ENABLED`.
- Runtime-config katalogunda olup `.env.example` icinde olmayan 28 anahtar bulundu. Ornekler: `RESEND_WEBHOOK_SECRET`, `STRIPE_PRICE_FAMILY_MONTHLY`, `STRIPE_PRICE_FAMILY_YEARLY`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY`, `FCC_BDC_ENABLED`, `FCC_BDC_API_KEY`, `GOOGLE_PLAY_OAUTH_CLIENT_ID`, `GOOGLE_PLAY_OAUTH_CLIENT_SECRET`, `GOOGLE_PLAY_OAUTH_REFRESH_TOKEN`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `RECOMMENDATION_SCORING_WEIGHTS`, `SUPPORT_EMAIL`.
- Platform-only anahtarlar (`NODE_ENV`, `VERCEL_ENV`, `NEXT_RUNTIME`) manuel `.env.example` zorunlulugu olmayabilir; fakat mevcut liste required/optional/platform ayrimini gostermiyor.

Etki:

- Yeni deploy veya yeni developer setup'i eksik secret/flag ile calisabilir: account restore, admin OTP/session handling, Resend webhook, Family/Pro Stripe fiyatlari, Google Play OAuth fallback, FCC ISP enrichment, push notification ve security alerting gibi alanlar sessizce eksik kalabilir.
- `.env.example` aktif dosya oldugu icin bu drift onboarding ve production readiness riskidir.

Oneri:

- `env-inventory.md` icindeki drift listesinden bir env matrix uret: required, optional, platform-provided, runtime-config editable, deployment-only.
- `.env.example` dosyasini bu matrise gore guncelle.
- CI'da kaynak `process.env.*` + runtime-config katalogu ile `.env.example` drift check ekle; platform-only allowlist kullan.

## F-007 Script Placeholder'lari Uretim Is Akisi Gibi Gorunebilir

Severity: Low

Kanit:

- `scripts/new-connector.mjs:45-91` connector scaffold icinde auth, host, fields, fallback action ve request shape icin TODO placeholder'lari tasiyor.
- `scripts/ingest/fcc-bulk-ingest.ts:49-82` FCC bulk ingest icinde gercek BDC export reader, ZIP/ZCTA crosswalk ve provider matching TODO olarak birakilmis.

Etki:

- Bu scriptler runtime'i bozmaz; fakat operasyon ekibi bunlari production-ready ingest/generator sanarsa eksik veya yanlis connector/FCC data uretebilir.
- FCC bulk data, provider recommendation kalitesini iyilestirecekse placeholder hali yanlis kapsama sinyali verir.

Oneri:

- Script README veya CLI cikisina "template/placeholder" uyari ekle.
- FCC ingest icin acceptance criteria yaz: dosya formati, ZIP/ZCTA map kaynagi, provider matching stratejisi, dry-run raporu, idempotent upsert.
- Connector generator icin manifest validation + generated test scaffold zorunlu olsun.
