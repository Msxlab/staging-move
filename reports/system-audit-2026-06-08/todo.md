# Audit Todo

## Kurallar

- [x] Eski `.md` rapor/memory dosyalarini analiz kaynagi olarak kullanma.
- [x] Yeni audit klasoru olustur.
- [x] Yapilan islemleri kaydetmeye basla.
- [x] Bulgulari kaynak dosya/komut kanitiyla iliskilendir.
- [x] Analiz sonunda devam edilebilir net backlog birak.

## Envanter

- [x] Root workspace ve package manager yapisini cikar.
- [x] `apps/web` teknoloji, route, API ve UI envanterini cikar.
- [x] `apps/admin` teknoloji, route, API ve operasyon yuzeyi envanterini cikar.
- [x] `apps/mobile` Expo/React Native route, servis ve native hedef envanterini cikar.
- [x] `packages/shared` domain fonksiyonlarini ve kullanan uygulamalari cikar.
- [x] `packages/db` Prisma model, migration ve seed sorumluluklarini cikar.
- [x] `packages/connectors` connector mimarisi ve dis servis baglantilarini cikar.
- [x] Docker, deployment, cron ve script yuzeylerini cikar.

## Modul Analizi

- [x] Anasayfa/public yuzey: sayfalar, formlar, SEO, auth girisleri.
- [x] Web app: dashboard, moving, addresses, providers, services, budget, notifications, settings.
- [x] Web API: auth, workspace, moving, address, provider, billing, webhooks, cron, mobile bridge.
- [x] Admin app: dashboard, users/workspaces, providers, connectors, backups, billing, analytics, logs, blog.
- [x] Admin API: admin auth, permissions, backups, analytics, connectors, provider ops.
- [x] Mobile app: onboarding/auth, dashboard, moving, addresses, providers, settings, widgets.
- [x] Shared domain: move lifecycle, recommendations, provider coverage, billing, permissions, encryption.
- [x] Data layer: Prisma schema, soft delete, optimistic locking, workspace boundaries.

## Hata/Eksik/Risk Arama

- [x] Test olmayan kritik route ve modulleri bul.
- [x] TODO/FIXME/HACK isaretlerini tara.
- [x] Client tarafindan cagrilan ama API karsiligi olmayan endpointleri ara.
- [x] API route var ama UI/mobile tarafindan kullanilmayan yuzeyleri ilk-pass isaretle.
- [x] Auth/session/permission guard tutarliligini orneklemle.
- [x] Environment degiskenleri ve runtime config eksiklerini kontrol et.
- [x] DB model ile uygulama kodu arasinda supheli uyumsuzluklari ara.
- [x] Cron/webhook idempotency ve secret kontrol risklerini incele.
- [x] Mobile ile web API sozlesme uyumunu kontrol et.

## Cikti

- [x] Modul haritasini yaz.
- [x] Baglanti haritasini yaz.
- [x] Fonksiyon/sorumluluk ozetlerini yaz.
- [x] Bulgulari onem derecesine gore yaz.
- [x] Onerileri kisa, orta ve uzun vadeye ayir.
- [x] Son kontrol: her dosya guncel ve devam edilebilir mi?

## Devam Backlog'u

- [ ] F-001 icin route'u `/api/cron/partner-consents/refresh` altina tasima veya middleware allowlist + shared cron guard duzeltmesi.
- [ ] F-002 icin provider popularity k-anonimlik esigi ve bucketed response.
- [ ] F-005 icin web/mobile Connections UI'ini workspace-aware sync endpointine tasima.
- [ ] F-006 icin `.env.example` / runtime-config drift matrix ve CI drift testi.
- [ ] F-007 icin FCC bulk ingest scriptini gercek BDC export parser + ZIP/ZCTA crosswalk + provider matching ile tamamlamak.
- [ ] Kritik sibling route test eksiklerini auth/billing/workspace/cron/provider privacy sirasiyla kapatmak.
- [ ] Admin middleware rate limitini shared/Upstash-backed global limiter'a almak.
