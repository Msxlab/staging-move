# UI/UX Denetimi

## Genel UI/UX Durumu

Web, admin ve mobile yüzeyleri kapsamlı ve modüler. App copy içinde empty state, error state, loading state ve accessibility stringleri geniş biçimde tanımlanmış. Buna rağmen bazı pazarlama/feature copy'leri gerçek UI/API yüzeyinden önde gidiyor. UX açısından en önemli risk, kullanıcının "belge saklama", "bill snap" veya "automatic USPS/provider update" beklentisiyle uygulamaya girmesi ve bu işlevi bulamamasıdır.

## UI Bulgusu: Documents kartı pasif/erişilemez feature sinyali veriyor

- Sayfa/Component: Service detail
- Dosya: `apps/web/src/app/(app)/services/[id]/page.tsx`
- Sorun: `service.documents` varsa kart render ediliyor; ancak belge upload/list API ve Prisma Document modeli bulunmadı.
- Etki: Kullanıcı belgeleri servisle ilişkilendirebileceğini düşünür, ancak akış yok.
- Kanıt: Service detail `Documents` kartı; `/api/services/[id]` include içinde documents yok; schema'da `Document` model yok.
- Beklenen: Ya belge feature tamamlanmalı ya UI/copy feature flag arkasında saklanmalı.
- Mevcut: Görünmeyen/pasif feature kırıntısı.
- Öneri: Belge feature complete değilse service detail type alanından ve copy'den çıkar.
- Öncelik: P1

## UI Bulgusu: Landing mobile copy "Snap a bill" feature'ı olmayan interaction vaat ediyor

- Sayfa/Component: Homepage mobile marketing section
- Dosya: `apps/web/src/i18n/messages/en.json`
- Sorun: "Snap a bill" ifadesi kamera/fotoğraf yakalama beklentisi yaratıyor.
- Etki: Mobile install sonrası kullanıcı promised action'ı bulamaz.
- Kanıt: `apps/mobile/MOBILE_DATA_INVENTORY.md` camera/photo/document picker yok diyor; mobile dependencies arasında capture packages yok.
- Beklenen: "Add bill details" gibi manuel kayıt dili veya gerçek capture flow.
- Mevcut: Capture vaadi var, feature yok.
- Öneri: Launch copy guardrail ekle.
- Öncelik: P1

## UI Bulgusu: "USPS forwarding setup, automatically" otomasyon seviyesini fazla iddialı anlatıyor

- Sayfa/Component: Landing moving moment mock
- Dosya: `apps/web/src/i18n/messages/en.json`
- Sorun: Automatic USPS setup algısı oluşuyor.
- Etki: Kullanıcı provider/USPS hesabının LocateFlow tarafından doğrudan güncelleneceğini düşünebilir.
- Kanıt: Connector section feature-flag ile gated; settings page guided open-and-update dili kullanıyor; about page otomatik provider update olmadığını söylüyor.
- Beklenen: "Guided USPS forwarding setup" veya "we prepare; you submit".
- Mevcut: Aynı ürün yüzeyinde manual coordination ve automatic copy birlikte var.
- Öneri: Copy uyumluluk testi ve conditional render.
- Öncelik: P1

## UI Bulgusu: Push/SMS kanal availability kullanıcıya net görünmeyebilir

- Sayfa/Component: Notification settings web/mobile
- Dosya: `apps/web/src/app/(app)/settings/notifications/page.tsx`, `apps/mobile/app/settings/notifications.tsx`, `apps/web/src/lib/notifications.ts`
- Sorun: Push delivery env/capability bağımlı; SMS provider yok.
- Etki: Kullanıcı kanal toggle'ını açık sanıp delivery alamayabilir.
- Kanıt: Push `NOTIFICATION_PUSH_ENABLED`, SMS branch provider yoksa fail-closed.
- Beklenen: Kanal unavailable state veya admin health gate.
- Mevcut: Preference toggle ve registration var, delivery readiness ayrı yüzeyde net değil.
- Öneri: Push capability/readiness endpoint ve UI disable reason ekle.
- Öncelik: P2

## UI Bulgusu: Public/docs copy current feature setten ayrışıyor

- Sayfa/Component: About, How it works, FAQ, AI discovery text.
- Dosya: `apps/web/src/app/about/page.tsx`, `how-it-works/page.tsx`, `faq/faq-data.ts`, `public-ai-discovery.ts`
- Sorun: Documents ve provider automation dilinin bazı parçaları current feature setin önüne geçiyor.
- Etki: SEO/AI discovery yanlış beklenti yayabilir.
- Kanıt: Document copy mevcut; document model/API yok.
- Beklenen: Current-product ve roadmap/future feature copy ayrımı.
- Mevcut: Mixed.
- Öneri: Copy inventory testleri.
- Öncelik: P2

## UX Bulguları

### İlk kullanım ve boş state

- `apps/web/src/i18n/messages/en.json` içinde addresses, services, tasks, moving, budget, notifications boş state metinleri mevcut.
- Mobile UI components içinde `EmptyState`, `ErrorState`, `LoadingScreen` bulunuyor.
- Risk: Documents feature boş state yok; çünkü gerçek feature yok.

### Hata durumları

- Auth ve service routes kullanıcıya 401/403/404/409 gibi anlamlı status döndürüyor.
- Export PDF route step-up failure ve rate limit mesajları içeriyor.
- Payment checkout mobile external billing guard içeriyor.
- Risk: Notification provider unavailable durumları user-facing kanallarda net olmayabilir.

### Kritik aksiyonlar

- Service delete `ConfirmDialog` ile yapılıyor.
- Account delete web copy store-managed subscriptions konusunda uyarıyor.
- Admin sensitive işlemler password confirmation/MFA gerektiriyor.

### Responsive / Mobile

- Mobile ayrı Expo app olarak mevcut.
- Web için doğrudan browser viewport test çalıştırılmadı; bu rapor statik kod auditidir.
- E2E Playwright testleri `apps/web/tests/e2e/public-pages.spec.ts` ve `accessibility.spec.ts` ile public/accessibility düzeyinde.

## Öneriler

1. Public copy ve feature flags arasında "promise audit test" oluştur.
2. Documents, snap bill ve automatic connector copy'lerini launch blocker olarak ele al.
3. Notification settings ekranında kanal availability/status göster.
4. Authenticated app ve mobile critical flow E2E testlerini ekle.
5. Admin heavy tables için empty/loading/error/pagination durumlarını route testleriyle birlikte doğrula.
