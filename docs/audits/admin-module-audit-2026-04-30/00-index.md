# Admin Module Audit - 2026-04-30

Bu klasor, admin panelindeki her sidebar modulunun ayri audit notunu icerir.
Kapsam: admin UI, admin API, web baglantisi, mobile baglantisi, yetki modeli,
veri minimizasyonu, mantik hatalari, eksikler ve gelistirme ihtiyaci.

## Genel Sonuc

Admin panelin temel mimarisi guclu: session cookie `httpOnly`, `sameSite=strict`,
DB-backed admin session, CSP nonce, CSRF/origin kontrolu, IP rule middleware,
password step-up ve audit log altyapisi var. Admin test suite yesil.

Yine de panel uretim icin tam kapali degil. En onemli riskler:

1. Permission matrisi eksik ve cok genis kaynaklara yaslaniyor.
   `ADMIN_RESOURCES` icinde `analytics`, `notifications`, `email_templates`,
   `help_center`, `waitlist`, `feature_flags`, `runtime_config`, `backups` ve
   `security` yok. Bu yuzden bazi endpoint'ler ya fail-closed calisiyor
   (`analytics/user-spending`) ya da hassas moduller `settings` yetkisine
   yigiliyor.

2. Backup modulu "FULL" gibi gorunuyor ama cok sayida tabloyu kapsamiyor:
   support tickets, state rules, help/FAQ, email templates, feature flags,
   acquisition campaigns/redemptions, waitlist, IP rules, GDPR, notification
   preferences/queue, user login sessions, push devices, runtime config ve yeni
   blog tablolari arside yok. 50.000 kayit limiti de sessiz eksik backup riski
   olusturuyor.

3. PII alanlari bircok VIEWER/ADMIN okuma ekraninda gereksiz genis geliyor:
   user detail, subscriptions, moving plans, provider governance, audit logs,
   security/GDPR ve waitlist modullerinde alan seviyesinde maskeleme/kisitlama
   eksik.

4. Web/mobile paritesi karisik. Providers, tickets, help, notifications, state
   rules, moving plans genelde bagli. Fakat mobile analytics consent cookie
   nedeniyle pratikte devre disi kalabilir; acquisition campaigns web/Stripe
   merkezli, mobile IAP ile ayni kampanya motoruna bagli degil; feature flags
   admin ve web library olarak var ama web/mobile icinde aktif kullanimi yok.

5. Bazi kritik yazma operasyonlarinda validasyon veya step-up eksik:
   state rule silme, campaign activation, feature flag delete/toggle, security
   IP/GDPR islemleri ve email template degisiklikleri daha siki politika
   gerektiriyor.

## Dosyalar

- `01-dashboard.md`
- `02-users.md`
- `03-subscriptions.md`
- `04-acquisition-campaigns.md`
- `05-billing.md`
- `06-providers.md`
- `07-provider-governance.md`
- `08-state-rules.md`
- `09-moving-plans.md`
- `10-tickets.md`
- `11-notifications.md`
- `12-email-templates.md`
- `13-help-center.md`
- `14-waitlist.md`
- `15-analytics.md`
- `16-reports.md`
- `17-feature-flags.md`
- `18-security.md`
- `19-runtime-config.md`
- `20-backups.md`
- `21-audit-logs.md`
- `22-admin-team.md`
- `23-settings.md`

## Dogrulama

- `pnpm --filter @locateflow/admin exec tsc --noEmit`: gecti.
- `pnpm --filter @locateflow/admin test`: gecti, 34 dosya / 125 test.
- `pnpm --filter @locateflow/db exec tsc --noEmit`: gecti.
- `pnpm verify:typecheck`: kaldi. Web daha admin'e gelmeden
  `apps/web/src/components/seo/json-ld.tsx` icindeki iki `TS1161` parse hatasi
  yuzunden duruyor.
- `pnpm --filter @locateflow/mobile exec tsc --noEmit`: kaldi.
  `StyleSheet.absoluteFillObject` ve `ColorSchemeName` icindeki `unspecified`
  tipi mevcut hatalar.
- Ortam uyarisi: repo Node `22.x` bekliyor, mevcut runtime `v24.13.0`.

## Risk Onceligi

P0/P1:
- Backup kapsam/truncation riskleri.
- Permission resource matrisi ve `analytics` resource uyumsuzlugu.
- Subscription/user detail gibi PII yogun endpoint'lerde field-level access.
- Mobile analytics consent uyumsuzlugu.

P2:
- State rule server validation.
- Acquisition max redemption race/reservation eksigi.
- Feature flags etkisiz/aktif entegrasyon eksigi.
- Admin sidebar `Admin Team` label hatasi.

P3:
- Mojibake yorum/metinler.
- Daha iyi UI affordance, pagination ve export davranislari.
