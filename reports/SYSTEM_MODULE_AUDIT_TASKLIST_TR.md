# Sistem Modül Değerlendirme Task Listesi

Bu liste, mevcut repodaki son durum üzerinden `web`, `client/mobile`, `admin` ve ortak altyapı modüllerini tek tek, uçtan uca mantık ve güvenlik açısından sorgulamak için hazırlanmıştır.

## Baz Alınan Durum

- Branch: `main`
- HEAD: `95c8a4d fix(auth): password min-length + supersede prior verify/reset tokens (#39 review c+d)`
- Çalışma ağacı notu: kod dışında audit/generated doküman çıktılarında uncommitted değişiklikler var.
- Ana uygulamalar:
  - `apps/web`: Next.js kullanıcı web uygulaması ve public/API yüzeyi.
  - `apps/mobile`: Expo/React Native client uygulaması.
  - `apps/admin`: Next.js admin paneli.
  - `packages/shared`: ortak domain mantığı, billing, entitlement, provider, moving, validation.
  - `packages/db`: Prisma schema, migration, seed, soft-delete helpers.
  - `packages/connectors`: partner connector runtime, manifest, dispatcher, OAuth, HTTP client.

## Son Commit Bağlamı

Son commitler özellikle auth, billing, workspace, connector, a11y, config, cron, PII redaction ve soft-delete alanlarında yoğunlaşmış:

- `95c8a4d` auth: password minimum length + prior verify/reset token supersede
- `ec6054e` merge: connector network + Family/Pro workspace foundation + audit hardening
- `28bf10c` billing: scheduled downgrade target plan persistence
- `06eabbb` connector/workspace: USPS null-origin guard + invite accept seat serialization
- `0eec9cd` connector: per-user-per-day dispatch cap enforcement
- `2bae75f` connector: stranded dispatch recovery + batch failure surfacing
- `b9485a7` connector/workspace: drop auth on cross-host redirect + hide admin invite for non-owners
- `7a7281d` workspace/connector: entitlement, seat reconcile, workspace cap launch blockers
- `da7a3d0` workspace tests: invitation accept + ownership transfer
- `85691b6` a11y: address autocomplete keyboard/combobox semantics
- `d82fa5c` a11y: admin modal dialog semantics + Escape
- `4324aba` admin: wide-scope provider bulk confirmation
- `6b601b8` config: Family/Pro Stripe price keys in runtime config
- `cb1a810` observability: free-text PII scrubbing
- `e37617d` cron: unified cron auth + orphaned Ofelia jobs
- `7310045` db: soft-delete completeness
- `0b1229d` auth: session fingerprint IP alignment

## Her Modül İçin Ortak İnceleme Lensleri

Her modülü aşağıdaki başlıklarla değerlendireceğiz:

1. Aktörler ve yetkiler: kullanıcı, workspace owner, member, admin role, cron, webhook, mobile client, dış servis.
2. Giriş ve çıkış durumları: hangi state ile başlar, başarılı olunca hangi state oluşur, iptal/hata olunca hangi state kalır.
3. Mutlu yol: beklenen normal akış çalışıyor mu, UI/API/DB/webhook aynı sonucu mu söylüyor.
4. Negatif yol: ödeme başarısız, validation hatası, ağ kopması, webhook gecikmesi, duplicate request, aynı anda iki işlem.
5. Güvenlik: auth, RBAC, CSRF/CORS, rate limit, SSRF, token saklama, PII redaction, audit log, step-up auth.
6. Veri bütünlüğü: transaction, idempotency, unique constraint, race condition, soft-delete, orphan record.
7. Entitlement ve plan limiti: FREE_TRIAL, INDIVIDUAL, FAMILY, PRO; seat, address, service, connector, export limitleri.
8. UX ve recovery: kullanıcıya ne gösteriliyor, tekrar deneyebiliyor mu, yarım kalan işlem nasıl toparlanıyor.
9. Admin görünürlüğü: admin bu durumu görebiliyor, düzeltebiliyor, ama gereğinden fazla PII görmüyor mu.
10. Mobile/web parity: aynı hesap web ve mobile'da aynı yetki ve state'i görüyor mu.
11. Observability: log, metric, Sentry, audit event, webhook event, cron sonucu izleniyor mu.
12. Test kanıtı: unit, integration, route test, e2e, concurrency test, webhook replay test var mı.

## Kritik Senaryo Matrisleri

### Ödeme ve Abonelik

- Kullanıcı paket seçti ama ödeme yapmadı:
  - Subscription `PENDING_CHECKOUT` / `INCOMPLETE` gibi geçici state'te kalıyor mu?
  - Eski entitlement korunuyor mu, premium özellikler açılmıyor mu?
  - Checkout cleanup cron eski pending checkout kayıtlarını kapatıyor mu?
  - Aynı kullanıcı tekrar checkout başlatınca duplicate/çakışma oluyor mu?
  - Admin panelde pending durum okunabilir ve aksiyon alınabilir mi?

- Ödeme başarılı oldu:
  - Stripe/App Store/Play Store webhook idempotent işleniyor mu?
  - Plan, provider, platform, accessType, period end ve autoRenew doğru yazılıyor mu?
  - Workspace provision/reconcile doğru çalışıyor mu?
  - Mobile ve web entitlement aynı anda güncelleniyor mu?
  - Kullanıcıya başarı/receipt/e-posta/notification gidiyor mu?

- Ödeme başarısız, past due, unpaid, grace period:
  - Premium erişim ne zaman kapanıyor, grace period varsa ne kadar sürüyor?
  - Connector, export, workspace seat, address/service limitleri hangi anda kısıtlanıyor?
  - Kullanıcı tekrar ödeme deneyebiliyor mu, eski checkout engel oluyor mu?
  - Admin riskli manuel düzeltme yapabiliyor mu ve auditleniyor mu?

- Upgrade:
  - INDIVIDUAL -> FAMILY/PRO limitleri anında açılıyor mu?
  - Seat/invite/workspace feature kapıları aynı kaynak fonksiyonu kullanıyor mu?
  - Proration ve period end UI'da doğru anlatılıyor mu?
  - Eski pending downgrade/checkout state temizleniyor mu?

- Downgrade:
  - Hemen mi, period sonunda mı uygulanıyor?
  - Hedef plan persist ediliyor mu?
  - Fazla seat, address, service, connector dispatch, export gibi overflow durumlarında ne oluyor?
  - Owner hangi üyeleri/servisleri pasifleştireceğini seçebiliyor mu, yoksa otomatik suspend mantığı var mı?

- Refund/cancel/delete:
  - Refund gelince erişim ve premium özellikler kapanıyor mu?
  - Cancel at period end ile immediate cancel ayrımı doğru mu?
  - Account deletion aboneliği iptal ediyor mu veya dış provider'daki iptal için kullanıcıyı yönlendiriyor mu?

### Account Deletion ve Privacy

- Kullanıcı hesabını silmek istediğinde:
  - Step-up auth isteniyor mu?
  - Aktif abonelik, workspace ownership, open support ticket, pending connector dispatch, scheduled reminder var mı kontrol ediliyor mu?
  - Kişisel veriler siliniyor/anonymize ediliyor, audit ve finansal kayıtlar yasal minimumla tutuluyor mu?
  - Push token, OAuth token, partner consent, sessions, reset tokens, verification tokens revoke ediliyor mu?
  - Silme sonrası webhook/cron gelirse kullanıcı yeniden oluşmuyor veya PII geri yazılmıyor mu?

- Export öncesi/sırası:
  - Kullanıcı silmeden önce export alabiliyor mu?
  - Export PII içerdiği için auth, rate limit ve audit var mı?
  - PDF/CSV içerikleri workspace boundary dışına taşmıyor mu?

### Onboarding

- Kullanıcı onboarding ekranını kapattı:
  - Progress kaydediliyor mu?
  - Bir sonraki login'de kaldığı yerden mi, dashboard'a mı, zorunlu adımlara mı yönleniyor?
  - Legal acceptance/email verification olmadan app içi kritik alanlara girebiliyor mu?
  - Mobile auth guard onboarding state bilinmezken tabları mount ediyor mu?

- Onboarding yarım kaldı veya API hata verdi:
  - Partial profile/address/moving seed kayıtları nasıl temizleniyor?
  - Retry duplicate kayıt yaratıyor mu?
  - Kullanıcıya net recovery veriliyor mu?

### Moving

- Kullanıcı moving plan açarken hata aldı:
  - Address validation, required fields, date validation net mi?
  - Plan oluşturulmadan task generation başladıysa rollback var mı?
  - Aynı request iki kez giderse duplicate moving plan/task oluşuyor mu?
  - Task reminder/notification cronları yarım moving planı işlemiyor mu?

- Moving plan değişti:
  - Move date/address değişince task lifecycle doğru yeniden hesaplanıyor mu?
  - Eski task local effects ve provider recommendations tutarlı mı?
  - Workspace/member boundary korunuyor mu?

## Web Modülleri

### WEB-01 Public, Marketing, Legal, SEO

İlgili yüzeyler: landing, pricing, how-it-works, FAQ, help, terms, privacy, billing-policy, refund, acceptable-use, disclaimer, DPA, cookie/CCPA, blog, sitemap/robots/llms.

Kontrol edilecekler:

- Public sayfalar auth gerektirmeden açılıyor, private veri sızdırmıyor.
- Pricing copy gerçek plan/billing config ile birebir tutarlı.
- Legal acceptance versiyonları uygulama içinde enforce ediliyor.
- Blog preview/public ayrımı, sanitize, image proxy/upload güvenliği kontrol ediliyor.
- SEO/llms endpoints private içerik veya admin-only URL yayımlamıyor.

### WEB-02 Auth, Session, MFA, OAuth

İlgili yüzeyler: register, login, logout, forgot/reset password, verify email, OAuth Google/Apple, mobile auth exchange, MFA setup/confirm/disable, `/api/auth/me`, sessions.

Kontrol edilecekler:

- Email verification ve reset tokenları tek kullanımlık, expiry'li ve yenisi gelince eskisi geçersiz.
- Login lockout/rate limit IP ve hesap bazında tutarlı.
- Session fingerprint, cookie flags, logout, session revoke ve mobile token exchange güvenli.
- MFA setup/disable step-up gerektiriyor.
- OAuth callback safe redirect ve state/nonce kontrolleri yapıyor.
- Email verification yoksa hangi API'ler açık/kapalı net.

### WEB-03 Onboarding, Profile, Preferences

İlgili yüzeyler: `/onboarding`, profile API, user preferences, locale, notification preferences, legal acceptance.

Kontrol edilecekler:

- Onboarding progress server-side doğru ve idempotent.
- Kapatma/yarım bırakma/geri dönme davranışı tanımlı.
- Profile update PII validation, workspace boundary ve email change etkileri açısından güvenli.
- Locale/preferences mobile ve web arasında tutarlı.

### WEB-04 Billing, Subscription, Trial, Campaign, IAP

İlgili yüzeyler: pricing, subscription settings, Stripe checkout/portal/webhook, checkout cancel, subscription actions/change-plan/switch-cycle, trial-check, bill reminders/overdue, mobile IAP products/verify, appstore/playstore webhooks, acquisition campaigns.

Kontrol edilecekler:

- Entitlement tek kaynak fonksiyondan hesaplanıyor.
- Pending checkout, incomplete, unpaid, past_due, grace, canceled, refunded state'leri net.
- Upgrade/downgrade target plan, provider, platform, accessType ve period end doğru persist ediliyor.
- Webhook idempotency ve replay güvenli.
- Mobile store purchase tokenları hash/encrypt ediliyor, raw token leak yok.
- Campaign/free access premium paid plan gibi görünmüyor.

### WEB-05 Workspace, Members, Invitations

İlgili yüzeyler: workspace settings, workspace create/update/delete/restore/rename/sync/managed-sync, invitations, members, ownership transfer.

Kontrol edilecekler:

- Owner/member/admin role matrisi net.
- Seat limitleri plan bazlı ve concurrent invite accept race'ine dayanıklı.
- Workspace delete/restore/transfer step-up ve audit gerektiriyor.
- Removed member verisi workspace içinde kalıyorsa tasarım kararı ve UI uyarısı var.
- Cross-workspace data leak, fromAddressId boundary ve nullable workspace edge case'leri testli.

### WEB-06 Address Management

İlgili yüzeyler: addresses CRUD, autocomplete, details, state rules.

Kontrol edilecekler:

- Address limitleri plan/workspace bazlı.
- Autocomplete maliyet, rate limit, keyboard accessibility ve privacy açısından güvenli.
- Address silinince service, moving, reminders, provider recommendations nasıl etkileniyor.
- Duplicate address ve partial validation durumları yönetiliyor.

### WEB-07 Services

İlgili yüzeyler: services CRUD, duplicate guard, sensitive fields, active/inactive service logic.

Kontrol edilecekler:

- Service limitleri plan bazlı.
- Provider-service ilişkisinde custom provider ve master provider ayrımı net.
- Sensitive fields API response ve logs içinde maskeleniyor.
- Service silme/soft-delete provider recommendations, budget ve moving task etkilerini bozmaz.

### WEB-08 Moving Plans ve Move Tasks

İlgili yüzeyler: moving CRUD, migration, task generation/sync/local effects, reminders.

Kontrol edilecekler:

- Moving plan create/update/delete idempotent ve transactional.
- Task lifecycle transitionları tarih/adres değişimlerinde doğru.
- Migration route eski data formatını kayıpsız taşıyor.
- Reminder cronları canceled/deleted/soft-deleted kayıtları işlemiyor.
- Mobile ve web aynı moving/task durumunu gösteriyor.

### WEB-09 Providers, Recommendations, Custom Providers

İlgili yüzeyler: provider catalog, compare, popular, recommendations, custom providers, coverage, state rules.

Kontrol edilecekler:

- Recommendation engine adres/state/service context ile doğru.
- Coverage empty state doğru ve yanıltıcı değil.
- Custom provider duplicate guard ve workspace ownership güvenli.
- State coverage seed/admin değişiklikleri user-facing sonuçları bozmaz.

### WEB-10 Partner Consents ve Connectors

İlgili yüzeyler: partner consents, OAuth initiate/callback/refresh, connector dispatch, cron dispatch, connector runtime package.

Kontrol edilecekler:

- Consent revoke in-flight dispatch ile yarışınca token kullanılmıyor.
- Connector entitlement gate plan bazlı: manual/API connector ayrımı net.
- SSRF/private host redirect/token exchange korumaları tam.
- Dispatch cap, retry, circuit breaker, stranded recovery ve idempotency çalışıyor.
- OAuth token ve partner credentials encrypted/masked.

### WEB-11 Budget, Expenses, Reports

İlgili yüzeyler: budget pages/API, expenses, monthly reports.

Kontrol edilecekler:

- Budget item CRUD workspace/user boundary içinde.
- Currency/date/month parsing edge case'leri net.
- Reports internal exception veya PII sızdırmıyor.
- Monthly report cron duplicate mail üretmiyor.

### WEB-12 Notifications, Email, Push, Unsubscribe

İlgili yüzeyler: notification feed/preferences, push register, email service, resend webhook, unsubscribe.

Kontrol edilecekler:

- Preference enforcement tüm cron/email/push kaynaklarında ortak.
- Unsubscribe token güvenli ve scope doğru.
- Push device register/revoke account deletion ve logout ile temizleniyor.
- Resend webhook idempotent ve PII loglamıyor.

### WEB-13 Support, Help, Tickets

İlgili yüzeyler: help, support ticket list/detail, ticket API.

Kontrol edilecekler:

- Ticket ownership/workspace boundary korunuyor.
- Message attachments varsa content-type/size/sanitize kontrolü var.
- Admin/user reply state transition ve notification doğru.
- Closed ticket update davranışı tanımlı.

### WEB-14 Privacy, Consent, Export, Account Deletion

İlgili yüzeyler: consent, tracking consent, CCPA, data deletion, account delete, export CSV/PDF, GDPR request.

Kontrol edilecekler:

- Export ve deletion step-up auth gerektiriyor.
- Deletion tüm tokens/sessions/OAuth/push/consent/reminders üzerinde cleanup yapıyor.
- Soft-delete ile yasal retention ayrımı açık.
- Tracking consent analytics event'lerine gerçekten uygulanıyor.

### WEB-15 Cron, Health, Internal Ops

İlgili yüzeyler: health/ready, cron auth, retention, reminders, blog cleanup/publish, provider stats, synthetic monitor, rate-limit log, ip-rules.

Kontrol edilecekler:

- Cron auth tek standartta ve secret leakage yok.
- Cronlar idempotent, retry-safe, partial failure raporlayan yapıda.
- Internal endpoints sadece internal secret/IP rule ile çalışıyor.
- Health/ready endpointleri hassas config sızdırmıyor.

## Client/Mobile Modülleri

### CLIENT-01 App Bootstrap, Auth Guard, Session Storage

Kontrol edilecekler:

- SecureStore/AsyncStorage ayrımı doğru.
- Token expiry/logout/session revoke mobile'da gerçek logout yapıyor.
- Onboarding state unknown iken private tablar mount olmuyor.
- Deep link auth flows redirect/open-url güvenli.

### CLIENT-02 Mobile Auth, OAuth, Native Apple

Kontrol edilecekler:

- Native Apple login server exchange ile doğrulanıyor.
- Mobile OAuth code tek kullanımlık ve expiry'li.
- Reset/verify/setup-password web ile parity sağlıyor.
- MFA gerektiren hesaplarda mobile davranışı net.

### CLIENT-03 Mobile Billing ve IAP

Kontrol edilecekler:

- Product list web billing config ile uyumlu.
- Purchase pending/success/failure/restore/refund senaryoları işleniyor.
- Store webhook gelmeden local UI premium açıyor mu?
- Family/Pro product support ve external billing guard tam.

### CLIENT-04 Mobile Main Tabs: Dashboard, Addresses, Services, Moving

Kontrol edilecekler:

- Offline/loading/error/empty state'ler tüm ana tablarda var.
- API 401/403/429/500 durumları kullanıcıyı doğru yönlendiriyor.
- Address/service/moving create/update/delete web ile aynı validation ve limitleri kullanıyor.
- Duplicate submit ve network retry duplicate kayıt yaratmıyor.

### CLIENT-05 Providers, Custom Providers, Connectors

Kontrol edilecekler:

- Provider detail/recommendation data stale olduğunda retry/refetch davranışı net.
- Custom provider edit/delete workspace boundary içinde.
- Connections/partner consent revoke mobile'da web ile aynı sonucu veriyor.
- Connector entitlement upsell mesajı doğru planı gösteriyor.

### CLIENT-06 Notifications ve Push

Kontrol edilecekler:

- Deferred soft prompt sonrası kullanıcı sonradan push açabiliyor.
- Push registration permission denied/granted/revoked durumlarını ayırıyor.
- Notification deep linkleri güvenli allowlist ile açılıyor.
- Logout/account deletion push token temizliyor.

### CLIENT-07 Privacy, Export, Delete Account

Kontrol edilecekler:

- Export/download mobile platformda çalışıyor veya açık fallback veriyor.
- Delete account step-up ve confirmation web ile aynı.
- Account deleted sonrası local cache/token temizleniyor.

### CLIENT-08 Native Config, Builds, Store Compliance

Kontrol edilecekler:

- Preview/prod API URL doğru ayrılıyor.
- Android manifest Expo config ile güncel.
- iOS privacy manifest gerçek collected data ile uyumlu.
- App Store/Play Store subscription entitlement copy ve restore flow hazır.

## Admin Modülleri

### ADMIN-01 Admin Auth, Session, MFA, Step-Up

Kontrol edilecekler:

- Admin login rate limit, MFA, session fingerprint ve logout güvenli.
- Destructive actions step-up gerektiriyor.
- Break-glass/IP bypass eventleri gerçekten kabul ediliyor ve auditleniyor.
- Session list/revoke admin'in kendi session'ını kilitlemiyor.

### ADMIN-02 RBAC, Page Guard, Permission Matrix

Kontrol edilecekler:

- VIEWER/EDITOR/ADMIN/SUPER_ADMIN gibi rollerin page/API ayrımı net.
- UI gizlemekle yetinilmiyor, API de enforce ediyor.
- Bulk/destructive/export endpoints için ekstra permission ve confirmation var.
- Permission seed parity testleri yeni endpointleri kapsıyor.

### ADMIN-03 Users, User Detail, Impersonation, Export

Kontrol edilecekler:

- User detail PII minimum privilege ile sınırlı.
- Impersonation açık etiketli, süreli, auditli ve scope-lu.
- User export CSV injection ve PII scope açısından güvenli.
- User delete/suspend/restore subscription/workspace etkileriyle tutarlı.

### ADMIN-04 Subscriptions ve Billing Operations

Kontrol edilecekler:

- Manual grant/revoke, plan change, cancel/refund actions auditli.
- Admin billing metrics PII ve business-sensitive data'yı role bazlı gösteriyor.
- Inconsistent subscription warnings admin UI'da görünür.
- Stripe campaign price validation gerçek runtime config ile çalışıyor.

### ADMIN-05 Providers, State Rules, Governance, Logos, Connectors

Kontrol edilecekler:

- Provider CRUD/bulk update wide-scope confirmation ve rollback sunuyor.
- State rule changes user recommendations ve coverage üzerinde kontrollü.
- Logo upload/auto-fetch SSRF, content-type, magic bytes ve storage ACL açısından güvenli.
- Connector config/consent admin görünümleri token/secret sızdırmıyor.

### ADMIN-06 Content: Blog, Help Center, Email Templates

Kontrol edilecekler:

- Tiptap/blog/email template HTML sanitize yeterli.
- Preview token, publish/unpublish, scheduled publish ve revalidate güvenli.
- Uploadlar image type/size/path traversal açısından kontrol ediliyor.
- Email template double-submit, broken variable ve unsafe link senaryoları testli.

### ADMIN-07 Support, Tickets, Waitlist, Acquisition Campaigns

Kontrol edilecekler:

- Ticket assignment/status/reply auditli.
- Waitlist export/spam/rate limit var.
- Acquisition campaign create/redeem/expire/price validation race-safe.
- Campaign abuse ile unlimited free/premium grant alınamıyor.

### ADMIN-08 Team, Notifications, Activity Logs

Kontrol edilecekler:

- Admin team invite/remove/role change step-up ve audit gerektiriyor.
- Kendi rolünü düşürme/kendini kilitleme senaryosu güvenli.
- Admin notifications sensitive data sızdırmıyor.
- Activity log filtreleri role ve PII redaction'a uyuyor.

### ADMIN-09 Security Dashboard, Key Rotation, Runtime Config, Feature Flags

Kontrol edilecekler:

- Security dashboard sensitive business/user data'yı role bazlı gösteriyor.
- Key rotation dry-run/rollback/partial failure davranışı tanımlı.
- Runtime config secret değerlerini maskeleyip validation yapıyor.
- Feature flag değişiklikleri plan/workspace/mobile parity'yi bozmaz.

### ADMIN-10 Backups, Import/Export, Retention

Kontrol edilecekler:

- Backup download step-up ve permission gerektiriyor.
- Import restore guard production için çok sıkı.
- Backup metadata PII/secret sızdırmıyor.
- Retention cron idempotent ve legal retention ile uyumlu.

### ADMIN-11 Analytics, Reports, Health

Kontrol edilecekler:

- Analytics endpointleri role bazlı ve aggregate minimumda.
- Internal exception mesajları response'a dönmüyor.
- Health/backup/email/rate-limit health ekranları secret/config sızdırmıyor.
- CSV/PDF export formüllere karşı güvenli.

## Ortak Altyapı Modülleri

### CORE-01 DB Schema, Migrations, Soft Delete

Kontrol edilecekler:

- User/workspace/subscription/provider/connector modellerinde unique/index/foreign key ihtiyaçları tamam.
- Soft-deleted kayıtlar read path'lerden filtreleniyor.
- Migration ve seed tekrar çalışınca duplicate üretmiyor.
- Orphan records ve legal retention net.

### CORE-02 Shared Billing, Entitlement, Plan Limits

Kontrol edilecekler:

- `getEffectiveEntitlement`, plan limits ve workspace features tek kaynak gibi kullanılıyor.
- Unknown plan/provider/status güvenli default'a düşüyor.
- Family/Pro yeni planları web/admin/mobile/Stripe/IAP copy ile uyumlu.
- Limit aşımı, downgrade overflow ve workspace seat reconcile testli.

### CORE-03 Connectors Package

Kontrol edilecekler:

- Manifest dispatch cap, retry, circuit breaker ve executor semantics tutarlı.
- HTTP client redirect, private IP, DNS rebinding, header forwarding ve auth drop kontrolleri yapıyor.
- USPS ve ilerideki connector'lar aynı registry contract'ına uyuyor.
- Logs token/PII redaction yapıyor.

### CORE-04 Runtime Config, Secrets, Rate Limit, IP Rules

Kontrol edilecekler:

- Secret config response/log içinde maskeleniyor.
- Rate limiter prod ortamında distributed; per-process fallback sadece development.
- IP rules break-glass ve internal endpoint auth ile çakışmıyor.
- Missing config fail-open değil fail-safe davranıyor.

### CORE-05 Email, Notification Queue, Webhook Idempotency

Kontrol edilecekler:

- Queue retry ve dead-letter mantığı var.
- ProcessedWebhookEvent tüm provider webhooklarında kullanılıyor.
- Duplicate email/push/report üretimi engelleniyor.
- User preferences ve unsubscribe tüm gönderim path'lerinde enforce.

## Modül İnceleme Promptu

Her modül için aşağıdaki promptu kullan:

```text
Modül: <MODÜL_ADI>
Kod yüzeyi: <route/lib/component/db model/test dosyaları>

Bu modülü uçtan uca incele.

1. Mevcut iş mantığını dosyalardan çıkar:
   - Aktörler kim?
   - Hangi API/UI/cron/webhook noktaları var?
   - Hangi DB modelleri ve shared helper'lar kullanılıyor?

2. State machine çıkar:
   - Başlangıç state'leri
   - Başarılı state'ler
   - Hata/iptal/pending/expired/deleted state'leri
   - State geçişlerinin kimin tarafından yapıldığı

3. Mutlu yol ve negatif yol senaryolarını tek tek test et:
   - Normal kullanım
   - Ödeme yok / ödeme başarısız / ödeme sonra başarılı
   - Yetkisiz kullanıcı / yanlış workspace / eski token
   - Duplicate submit / concurrent request / webhook replay
   - Network/API failure / partial DB write / cron retry
   - Account deletion / downgrade / role change etkisi

4. Güvenlik ve privacy açısından sorgula:
   - Auth/RBAC/step-up yeterli mi?
   - PII/token/secret response, log, export veya admin UI'da sızıyor mu?
   - Rate limit, idempotency, transaction, SSRF, open redirect, CSRF/CORS ihtiyacı var mı?

5. Web-client-admin parity kontrolü yap:
   - Web ne gösteriyor?
   - Mobile/client ne gösteriyor?
   - Admin ne görüyor ve neyi düzeltebiliyor?
   - Üçü aynı entitlement/state kaynağını mı kullanıyor?

6. Test ve kanıt çıkar:
   - Mevcut testler hangi senaryoları kapsıyor?
   - Eksik testleri P0/P1/P2 olarak sırala.
   - Gerekirse route test, unit test, concurrency test, webhook replay test veya e2e öner.

Çıktı formatı:

- Özet karar: Çalışıyor / Kısmen çalışıyor / Riskli / Bilinmiyor
- Kritik bulgular: P0/P1/P2/P3
- Pozitif kontroller: mevcut iyi korumalar
- Eksik senaryolar: test veya mantık boşlukları
- Önerilen tasklar: uygulanabilir, dosya referanslı ve kabul kriterli
```

## Öncelikli İnceleme Sırası

1. Billing + entitlement + plan limits
2. Workspace + invitations + ownership + seat limits
3. Auth + onboarding + account lifecycle
4. Account deletion + export + privacy consent
5. Moving plans + move tasks + reminders
6. Connectors + partner consent + OAuth + dispatch
7. Mobile parity: auth guard, IAP, push, deep links
8. Admin RBAC + user detail + subscription operations + impersonation
9. Providers + state rules + recommendations + custom providers
10. Notifications/email/support/blog/public surfaces
11. Cron/health/runtime config/backups/security dashboard

## Bulgu Önceliklendirme Kuralı

- P0: Para kaybı, veri sızıntısı, auth bypass, cross-workspace leak, irreversible destructive action.
- P1: Premium erişim yanlış açılır/kapanır, race condition ile limit aşılır, token/PII exposure, webhook idempotency bozuk.
- P2: Edge case kullanıcıyı kilitler, admin yanlış yönlenir, mobile/web parity bozuk, önemli test eksiği.
- P3: Copy/UX tutarsızlığı, düşük riskli observability veya test iyileştirmesi.

