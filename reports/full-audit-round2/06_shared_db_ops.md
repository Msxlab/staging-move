# SCOPE 6 — SHARED + DB + OPS Denetimi (Round 2)

Tarih: 2026-06-11 · Denetçi: otomatik tam-yığın denetim ajanı
Kural gereği hiçbir önceki rapor/`.md` girdi olarak OKUNMADI; tüm bulgular kod/şema/config/migration/workflow dosyalarının doğrudan okunmasına ve bir adet ampirik Node testine dayanır.

## Gezilen Modül Haritası

- **packages/shared/src**: entitlement.ts, billing.ts, workspace-entitlements.ts, billing-metrics.ts, acquisition.ts, migration-engine.ts, move-task-lifecycle.ts, move-task-local-effect.ts, move-transition-classifier.ts, recommendation-engine.ts (tam), provider-coverage.ts, provider-integrity.ts (API yüzeyi), legal.ts, permissions.ts, api-client.ts, encryption.ts, audit-redaction.ts, email-html-sanitizer.ts, sentry-redaction.ts, timezone.ts, validators.ts, env-catalog.ts, runtime-config.ts (anahtar envanteri diff'i), index.ts / index.mobile.ts
- **packages/connectors/src**: core/{circuit-breaker, retry, executor, dispatcher, state, types, http-client, oauth, registry, manifest, mode, fields, logger}.ts + usps/{index, request}.ts (contract-test-kit yüzeysel)
- **packages/db**: prisma/schema.prisma (2330 satır, tüm modeller), migrations/ (65 klasör; baseline + phase0_cleanup + son 2 migration içerik düzeyinde; CREATE/DROP çapraz envanteri otomatik diff ile), seed-master.ts, seed-admin.ts, seed.ts, seed-blog.ts (baş+kuyruk), seed-data/ envanteri, migrate-to-workspaces.ts, _migrate-to-mysql.ts, src/{index, soft-delete, optimistic-locking, provider-coverage}.ts
- **Ops**: .github/workflows/ci.yml + cron.yml (rota varlığı apps/web + apps/admin api/cron klasörlerine karşı doğrulandı), kök Dockerfile, docker/web.prod.Dockerfile, docker/admin.prod.Dockerfile, docker/ofelia.ini, kök package.json, scripts/prepare-web-standalone.mjs, pnpm-workspace.yaml, pnpm-lock.yaml (importer kontrolü)

Varsayımlar: (1) Prod DigitalOcean'da koşuyor ve zamanlayıcı GH Actions `cron.yml` (cron.yml içindeki açıklama bunu söylüyor; ofelia yalnız self-host). (2) `@prisma/client` 5.22 (kök node_modules'taki üretilmiş client ile ampirik test yapıldı). (3) DB'ye canlı bağlantı yok; migration replay'i statik diff ile değerlendirildi.

---

## Bulgular Tablosu (Kritik + Yüksek önce)

| Katman | Önem | Bulgu | Neden sorun | Önerilen çözüm | dosya:satır |
|---|---|---|---|---|---|
| Ops/Docker | **Kritik** | Üç Dockerfile'ın da `deps` aşaması `packages/connectors/package.json`'ı KOPYALAMIYOR; oysa web+admin `@locateflow/connectors: workspace:*` bağımlı ve pnpm-lock.yaml'da `packages/connectors` importer'ı var | `pnpm install --frozen-lockfile` workspace paketini çözemez / lockfile-importer uyuşmazlığıyla düşer → Docker imaj build yolu (kök Dockerfile kendini "DigitalOcean App Platform imajı" ilan ediyor) connectors bağımlılığı eklendiğinden beri kırık. Deploy'lar buildpack ile yeşilse bile Docker yolu ilk kullanımda patlar | Üç deps aşamasına `COPY packages/connectors/package.json packages/connectors/package.json` ekle; builder'da node_modules kopyasına `packages/connectors/node_modules`'ı da al | Dockerfile:38-45; docker/web.prod.Dockerfile:20-29,70-73; docker/admin.prod.Dockerfile:18-27,56-59; apps/web/package.json:21; pnpm-lock.yaml:564 |
| DB/soft-delete | **Yüksek** | Soft-delete extension'ın `delete`/`deleteMany` yeniden-yazımı `(this as any)[model].update(...)` çağırıyor; Prisma 5.22 query-extension callback'inde `this` client DEĞİL (ampirik test: `this` = `{0:...}` benzeri dizi, `this["User"] === undefined`) | Genişletilmiş `db` üzerinden herhangi bir soft-delete modelde `.delete()`/`.deleteMany()` çağrısı `TypeError: Cannot read properties of undefined` fırlatır. Bugün tüm hard-delete yolları `rawPrisma` kullandığı için latent; ama "delete'i unutursan soft-delete'e çevrilir" güvenlik ağı aslında bir crash. İlk gelecekteki kullanım prod'da 500 üretir | Callback dışında client referansı yakala (`Prisma.defineExtension((client) => client.$extends({...}))` deseni) ya da `query(args)` yerine extension'ı client-factory ile kur; birim testle delete yolunu kapsa | packages/db/src/soft-delete.ts:125-143 |
| Ops/cron | **Yüksek** | `*/5` slotunda connector-dispatch + scheduled-delivery `dakika % 10 == 0`, blog-publish `dakika == 00` koşuluyla çalışıyor; karşılaştırma çalıştırma anının duvar saatine yapılıyor | GH Actions cron'u rutin 2-15 dk gecikir; 1 dakikalık pencereye denk gelme şansı düşük → connector outbox işleyişi ve zamanlanmış blog yayını fiilen AÇLIK çekebilir (saatlerce/günlerce hiç tetiklenmeme). Uptime job'ı 5 dk pencere kullanıyor, bu ikisi 1 dk | Pencereyi genişlet (`% 10 < 5`, blog-publish için `dakika < 10`); rotalar zaten idempotent/dedupe'lu olduğundan çift tetik zararsız | .github/workflows/cron.yml:80-82 |
| Ops/CI | **Yüksek** | `prisma migrate deploy` main push'ta `lint-and-typecheck` job'ının İÇİNDE koşuyor; `test`, `security`, `e2e` job'larına bağımlılığı yok (paralel) | Testler kırmızıyken bile prod şemasına migration uygulanır; ayrıca migration, DO'daki yeni kod canlıya çıkmadan dakikalar önce yürür (kök Dockerfile CMD'si de start'ta tekrar migrate ediyor → iki ayrı migrate yolu). Geri alınamaz bir migration + başarısız test kombinasyonunda prod şema/kod uyumsuz kalır | Migrate adımını ayrı job yap, `needs: [lint-and-typecheck, test, security]` ver; ya da migrate'i yalnız DO start'ına bırak | .github/workflows/ci.yml:57-61; Dockerfile:126 (CMD migrate deploy) |
| Shared/legal | **Yüksek** | Sürüm sabiti çatallanması: `acquisition.ts TERMS_VERSION="2026-05-01"` ↔ `legal.ts LEGAL_CONSENT_VERSION="2026-06-10"`; ayrıca `hasRequiredLegalConsents` sürüm KARŞILAŞTIRMASI yapmıyor | Checkout/redemption consent snapshot'ları (Subscription.termsVersion, AcquisitionRedemption.termsVersion) Haziran'da yayınlanan yeni Terms'ten sonra hâlâ "2026-05-01" damgalıyor → uyuşmazlık halinde kanıt değeri zayıflar; eski sürümü kabul etmiş kullanıcı "consent tam" sayılıyor, re-consent tetiklenemiyor | Tek kanonik sürüm sabiti (legal.ts) kullan, acquisition.ts onu import etsin; `hasRequiredLegalConsents`'e `termsVersion === LEGAL_CONSENT_VERSION` kontrolü ekle (veya ayrı `isStale` yardımcı) | packages/shared/src/acquisition.ts:5-7,276-279; packages/shared/src/legal.ts:1,276-278 |
| DB/migrations | **Yüksek** | Migration'lar şemaya birebir replay OLMUYOR: `Task`, `MovingBox` (baseline 20260314100500) ve `ProviderReview` (20260417210000) tabloları CREATE ediliyor, üstelik 20260501000000 bunlara `deletedAt` ekliyor; ama modeller şemada yok ve hiçbir migration DROP etmiyor | Taze DB'de migrate ile 3 hayalet tablo oluşur; `prisma migrate dev` drift raporlar ve ileride otomatik üretilecek bir migration bu tabloları (içlerindeki muhtemel ProviderReview verisiyle) habersiz DROP edebilir; ProviderReview verisi bugün Prisma'dan erişilemez (GDPR ihracında da görünmez — FK'ları CASCADE olduğu için delete bloklamıyor ama veri kopyası kalıyor) | Bilinçli karar ver: ya modelleri şemaya geri ekle, ya açık bir `DROP TABLE` migration'ı yaz (ProviderReview için önce veri var mı bak / arşivle) | prisma/migrations/20260314100500_mysql_baseline/migration.sql:426,839; 20260417210000_provider_reviews/migration.sql:5; 20260501000000_soft_delete_locking_consent/migration.sql:9,18; schema.prisma (model yok) |
| Ops/CI | Orta | CI hiçbir yerde `@locateflow/connectors` testlerini ve mobile/db typecheck'i çalıştırmıyor: test job'ı yalnız web/admin/mobile; "TypeScript (mobile)" adımı aslında `lint` | manifest.ts'in "bu kontroller CI'da çalışır" iddiası boş; breaker/retry/dispatcher/contract testleri sadece lokal `verify:tests`'te. Connectors'ta regresyon CI'dan sessiz geçer | test job'ına `pnpm --filter @locateflow/connectors test`; mobile için gerçek `tsc --noEmit` adımı ekle (kök `verify:typecheck` zaten içeriyor) | .github/workflows/ci.yml:45-46,99-121; packages/connectors/src/core/manifest.ts:5-8 |
| Shared/env | Orta | env-catalog ↔ runtime-config drift: runtime-config'te 67 anahtar env-catalog'da yok — aralarında `STRIPE_PRICE_FAMILY_MONTHLY/YEARLY`, `STRIPE_PRICE_PRO_*`, `STRIPE_PRICE_INDIVIDUAL_*`, Apple/Google IAP, backup-storage anahtarları var | "Operatör tek bakışta neyin eksik olduğunu görsün" hedefi tam karşılanmıyor: Family/Pro self-serve checkout'u 503'leten fiyat ID'leri readiness görünümünde hiç listelenmiyor | env-catalog'a en azından gelir-kritik runtime-config anahtarlarını `optional` sınıfıyla ekle; CI'da iki katalog arasındaki diff'i raporlayan birim test yaz | packages/shared/src/env-catalog.ts:84+ vs packages/shared/src/runtime-config.ts (anahtar diff'i); billing.ts:141-150 |
| DB/seed | Orta | `seed-admin.ts` upsert'i her çalıştırmada `password`, `role: SUPER_ADMIN`, `isActive: true` yazıyor | Prod'da yanlışlıkla yeniden koşan seed (örn. `seed:all`), sahibinin değiştirdiği parolayı env'deki seed parolasına geri alır; demote edilmiş/deaktif edilmiş seed hesabını yeniden tam yetkili yapar | update bloğunu boş bırak (`update: {}`) veya yalnız `isActive` değil hiçbir şeyi ezme; parola sıfırlamayı ayrı, açıkça istenen bir flag'e bağla | packages/db/prisma/seed-admin.ts:30-45 |
| DB/seed | Orta | `seed.ts` `prisma.badge` kullanıyor; şemada `Badge` modeli YOK → dosya çalıştırıldığı anda TypeError; `_migrate-to-mysql.ts` adım 5 bu dosyayı öneriyor ve TABLES listesi şemada olmayan 15+ tablo içeriyor | Ölü/yanıltıcı tohum kodu; birinin "Step 5: Re-seed" talimatına uyması anında hata, kafa karışıklığı | seed.ts'i sil ya da Badge'siz hale getir (state-rules kısmı `seed-state-rules.ts`'te zaten var); _migrate-to-mysql'i arşiv klasörüne taşı | packages/db/prisma/seed.ts:95; packages/db/prisma/_migrate-to-mysql.ts:26-39 |
| DB/soft-delete | Orta | Extension yalnız ÜST-SEVİYE operasyonları filtreliyor; `include`/`select` ile gelen iç ilişkiler (`user.findUnique({include:{services:true}})`) soft-deleted satırları DÖNDÜRÜR (Prisma query extension'ları nested read'leri yakalamaz) | "Unutulan filtre silinmiş kaydı sızdırmaz" garantisi nested okumalarda geçersiz; UI'da silinmiş servis/adres hayaletleri görünebilir | Nested kullanım yerlerinde `where: { deletedAt: null }` zorunluluğunu lint/testle koru ya da kritik include noktalarını gözden geçir; sınırı soft-delete.ts doc'una yaz | packages/db/src/soft-delete.ts:75-160 (yalnız top-level op'lar) |
| Shared/migration-engine | Orta | `detectStateMismatchInName`: tam-ad alt dizgi eşleşmesi "West Virginia"yı VA ("Virginia") token'ı sanıyor → WV hedefli taşınmada adında "West Virginia" geçen DOĞRU sağlayıcılar önerilerden elenir | Tek gerçek çakışma çifti bu (diğer eyalet adları birbirini içermiyor); WV kullanıcıları için kataloğdaki en doğru adaylar sessizce kaybolur | Eşleşmeden önce "west virginia" geçişlerini maskele veya kelime-sınırlı tam-ad regex'inde daha uzun adı önce dene | packages/shared/src/migration-engine.ts:191-209,224 |
| Shared/classifier | Orta | `sameProviderConfidence`'ın `currentProvider && providerCoversDestinationState(...)` dalı ölü kod: değer yalnız `if (sameProviderCandidate)` bloğunda okunuyor. Mevcut sağlayıcı hedef eyaleti kapsasa bile aday listesinde yoksa plan "old provider does not appear to cover the destination" deyip STOP/START üretir | Çağıran aday listesine mevcut sağlayıcıyı koymayı unutursa kullanıcıya yanlış "iptal et + yeni başlat" rehberliği çıkar | sameProviderCandidate yokken `providerCoversDestinationState(currentProvider)` doğruysa VERIFY_AVAILABILITY/TRANSFER dalına yönlendir | packages/shared/src/move-transition-classifier.ts:373-377,526-564 |
| Shared/sanitizer | Orta | `DROP_WITH_CONTENT` kümesindeki void etiketler (`<input>`, `<meta>`, `<link>`, `<base>`) self-closing yazılmadıysa `dropContent` sayaç artar ve hiç azalmaz → etiketten sonraki TÜM şablon içeriği yutulur | Admin'in yapıştırdığı tipik e-posta HTML'i (`<meta charset>` çok yaygın) sessizce yarıda kesilir; güvenlik değil bütünlük hatası | Bu dört void etiketi sayaç artırmadan at (içerikleri zaten yok) | packages/shared/src/email-html-sanitizer.ts:293-321 |
| Ops/cron | Orta | `blog-image-cleanup` (admin) hiçbir GH cron slotunda yok — yalnız ofelia.ini'de; prod zamanlayıcı GH olduğu için prod'da hiç çalışmıyor. `synthetic-monitor` rotası hiçbir zamanlayıcıda yok | R2 yetim blog görselleri prod'da sınırsız birikir; synthetic-monitor ölü rota (uptime-check ile süperpoze) | `15 3 * * *` slotuna `hit "$ADMIN/api/cron/blog-image-cleanup"` ekle; synthetic-monitor'u sil veya işaretle | .github/workflows/cron.yml:84-89; docker/ofelia.ini:94-97; apps/web/src/app/api/cron/synthetic-monitor |
| Ops/cron | Orta | `hit()` curl `-m 60`: 60 sn'yi aşan cron rotası (stripe-reconcile, data-retention büyüyünce) "000/timeout" sayılıp job fail olur; rota arka planda çalışmaya devam eder | Yanlış alarm + "bir endpoint non-2xx" maskelemesi; gerçek hatayla uzun süren işi ayırt edemezsiniz | Uzun işler için `-m` değerini rota bazında artır veya rotaları işi kuyruğa atıp hemen 202 dönecek şekilde tasarla | .github/workflows/cron.yml:70-74 |
| Connectors | Orta | CircuitBreaker süreç-içi bellek; `ConnectorConfig.circuitState` "mirror" kolonu ile senkron mekanizması bu pakette yok; HALF_OPEN'da eşzamanlı probe sınırsız (ilk başarı/başarısızlık gelene kadar `canRequest()` herkese true) | Çok-instance dağıtımda her instance kendi breaker'ını taşır → partner çöktüğünde instance sayısı kadar "ilk 5 hata" dalgası; HALF_OPEN'da prob fırtınası olabilir | Breaker durumunu ConnectorConfig'e yazan/okuyan worker sözleşmesini netleştir; HALF_OPEN'da tek-uçuş (single-flight) bayrağı ekle | packages/connectors/src/core/circuit-breaker.ts:42-73; schema.prisma:2002 |
| Connectors | Orta | 429 (RATE_LIMITED) breaker'a "success" yazıyor (yalnız 5xx failure) → sürekli throttle eden partnere karşı devre hiç açılmaz; retry bütçesi (4 deneme, 60 sn tavan) tek dispatch'i sınırlar ama filo genelinde baskı sürer | Partner tarafında ban riskini büyütür; `perConnectorPerMinute` manifest alanının enforcement'ı bu pakette yok (dispatcher'a "hint") | 429'u breaker'da ayrı say (örn. ardışık N 429 → OPEN) veya dispatcher'da connector-bazlı dakika kotasını gerçekten uygula | packages/connectors/src/core/http-client.ts:179-182; types.ts:78-84 |
| DB/schema | Orta | `WorkspaceInvitation @@unique([workspaceId, invitedEmail, expiresAt])`: expiresAt anahtarın parçası → aynı e-postaya farklı expiry ile sınırsız PENDING davet yaratılabilir; gerçek "tek aktif davet" kuralı DB'de yok | Davet spam'i/karışık kabul durumları; uygulama katmanı disiplinine kalmış | Kısmi-unique yerine: kabul/iptalde satırı tüketip `(workspaceId, invitedEmail)` unique'ine geç veya `status` ayrıştırmalı tasarımı migration'la kur (bilinen düşük-öncelik borç) | prisma/schema.prisma:2225 |
| DB/schema | Orta | `Reminder` modelinde `userId` yok; `serviceId` nullable + Cascade → servissiz reminder sahipsiz kalır, kullanıcı bazlı sorgulanamaz/temizlenemez | Sahipsiz satırlar GDPR ihracı ve kullanıcı silme akışlarının dışında kalabilir | `userId` kolonu ekle (FK + index) ya da `serviceId`'yi zorunlu yap | prisma/schema.prisma:690-712 |
| Shared/entitlement | Orta | Provider-paid dalında `INCOMPLETE` (ve beklenmedik `FREE_ACCESS` raw status) açıkça ele alınmıyor → en alttaki `UNKNOWN`/`hasAccess:false`'a düşer | Fail-closed (güvenli) ama admin UI'da "Unknown" görünür ve `SUBSCRIPTION_STATUS_VALUES`'ta tanımlı bir durumun state machine karşılığı yok — tamlık eksiği | `INCOMPLETE` için açık dal (ödeme tamamlanmamış → erişim yok, reason "checkout incomplete") ekle | packages/shared/src/entitlement.ts:254-444; billing.ts:30 |
| DB/seed | Düşük | seed-blog "refresh" mantığı kendi update'iyle `updatedAt`'i ileri attığı için ikinci koşudan itibaren `wasEdited=true` olur → fixture metin güncellemeleri bir daha asla uygulanmaz | Niyet edilen "copy edit'leri reseed'le al" davranışı yalnız ilk reseed'de çalışır | Seed-yazımı bir işaretle ayırt et (örn. revision yazmadan update + içerik hash karşılaştırması) | packages/db/prisma/seed-blog.ts:1716-1745 |
| DB/schema | Düşük | `AdminSession.tokenHash` UNIQUE değil (UserLoginSession'da unique); `AdminAuditLog.entityId` VarChar(30) ama bazı entity'ler 30+ kimlik taşıyabilir (örn. Stripe evt id'leri ProcessedWebhookEvent'te 255) | Çift satır olasılığı revocation lookup'ını bulanıklaştırır; uzun entityId yazımı MySQL strict modda insert hatası üretir | tokenHash'e `@unique`; entityId genişliğini yazan kodla karşılaştırıp gerekirse VarChar(64+) yap | prisma/schema.prisma:1243,1319 |
| Shared/audit | Düşük | `shouldRedactAuditKey` `endsWith("key")` kuralı `dedupeKey`, `scopeKey`, `idempotencyKey`, `templateId→hayır` gibi zararsız anahtarları da [REDACTED] yapar | Bilinçli muhafazakârlık; ama audit kayıtlarında forensik bağlam (hangi dedupe key'i çakıştı) kaybolur | Allowlist'e (`preservePaths`) sık kullanılan zararsız anahtarları ekle | packages/shared/src/audit-redaction.ts:103-108 |
| Shared/acquisition | Düşük | `isCampaignRedeemable` maxRedemptions kontrolü okuma-anlık; eşzamanlı iki farklı kullanıcı redemption'ı sınırı 1 aşabilir (kullanıcı-başına unique var, kampanya-başına atomik sayaç koşulu yok) | Sınırlı kampanyada birkaç fazladan redemption | Redeem yazımını `UPDATE ... SET redemptionCount=redemptionCount+1 WHERE redemptionCount < maxRedemptions` CAS'ı ile yap | packages/shared/src/acquisition.ts:151-188; schema.prisma:336-337 |
| DB/soft-delete | Düşük | soft-delete.ts başlık yorumu "Not applied globally by default… singleton `db` stays raw" diyor; index.ts `db`'yi extension'la İHRAÇ EDİYOR (global uygulanmış) | Yanıltıcı doküman; yeni geliştirici yanlış varsayımla rawPrisma gibi kullanabilir | Yorumu güncelle | packages/db/src/soft-delete.ts:5-14 vs packages/db/src/index.ts:58 |
| Shared/api-client | Düşük | `post/put/patch/delete` gövdesi `body ? JSON.stringify(body) : undefined` — `0`/`false` gibi falsy gövdeler hiç gönderilmez | Uç durum; bugün çağıranlar nesne yolluyor | `body !== undefined` kontrolü | packages/shared/src/api-client.ts:225,242,259,276 |
| Ops/Docker | Düşük | Runner aşaması `packages/shared`'ı `node_modules/@locateflow/shared`'a kopyalıyor ama connectors'ı kopyalamıyor; bugün çalışmasının tek nedeni `transpilePackages`'ın connectors'ı bundle'a gömmesi | Gelecekte runtime'da shared gibi dinamik import edilecek bir connectors dosyası sessizce kırılır | Connectors'ı da aynı kalıpla kopyala ya da shared kopyasının neden gerektiğini netleştir | Dockerfile:107-115; docker/web.prod.Dockerfile:108-114 |

---

## Alt-Alan Bazında 5-Soru Değerlendirmesi

### 1) packages/shared — entitlement + billing + workspace-entitlements
1. **Uçtan uca çalışıyor mu?** Evet. `getEffectiveEntitlement` deterministik, fail-closed; testleri var (`__tests__/entitlement.test.ts`). Plan tanımları (billing.ts) ve seat/feature matrisi (workspace-entitlements.ts) tutarlı; `BILLING_PRODUCT_CONFIG_KEYS.web` 6 Stripe fiyat anahtarını doğru adlandırıyor.
2. **Mantıksızlık?** `INCOMPLETE` raw statüsü tanımlı ama state machine'de dalı yok (UNKNOWN'a düşüyor — güvenli ama eksik). `PENDING_CHECKOUT` altında Free-Access fallback'i akıllıca çözülmüş.
3. **Eksik?** Mobil mağaza ürün anahtarları (runtime-config'te var) billing.ts'in config-keys haritasında yok — web/mobile fiyat eşlemesi iki ayrı yerde yaşıyor.
4. **Bug/güvenlik?** Yok (fail-closed). Cross-field drift'ler warning olarak yüzüyor — iyi tasarım.
5. **İyileştirme:** INCOMPLETE dalı; mobil product-id'leri `BILLING_PRODUCT_CONFIG_KEYS`'e taşı.

### 2) migration-engine + move-task lifecycle/effects/classifier
1. **Çalışıyor mu?** Evet; lifecycle geçiş tablosu tam (REOPEN terminal timestamp'leri temizliyor — rapor tutarlılığı düşünülmüş), classifier kapsamlı kategori kapsayışına sahip, testler mevcut.
2. **Mantıksızlık?** Classifier'da `sameProviderConfidence` fallback'i ölü kod (yuk. tablo); migration-engine'de KEEP görevleri taşınmadan 3 gün SONRA due (`dueFrom(3)`, `daysBeforeMove:-3`) — işaret kuralı tutarlı ama okunaksız.
3. **Eksik?** `UserChecklistProfile.moveType` undefined ise `item.moveTypes.includes(undefined)` false → tüm NEW önerileri susar; default "PERSONAL" üst katmanda garanti edilmeli.
4. **Bug?** "West Virginia"/VA tam-ad çakışması (tablo, Orta) — WV önerilerinde yanlış eleme.
5. **İyileştirme:** templateId üretiminde `buildMigrationTemplateId` 30 karakter sınırına sıkışıyor; idempotencyKey kolonu 191 — limit gereksiz sıkı.

### 3) recommendation-engine (signalBoosts dahil)
1. **Çalışıyor mu?** Evet. 4d sinyal blokları (familyStatus/ageRange/petTypes/businessType/immigrationStatus) yalnız mevcut tag/kategori yollarını ≤15 puanla pekiştiriyor; boş sinyal = eski skor (geri uyum korunmuş). Ağırlık override mekanizması (RuntimeConfig) temiz.
2. **Mantıksızlık?** Yok denecek kadar az; komparatör tek-eleman anahtarlarıyla kanıtlanabilir geçişli (önceki transitivity bulgusu giderilmiş), `lookupCommunityPopularity` slug-fallback çakışması kaldırılmış.
3. **Eksik?** `TIER_RELEVANCE_GATE`'te `FINANCIAL_INSURANCE_RENTERS` için `ownership !== "OWN"` var ama validators'taki ownership enum'u `OWNER/RENTER/...` — üst katman map'lemezse gate hiç düşmez (değer uyumu çağırana emanet).
4. **Bug?** Yok.
5. **İyileştirme:** `geoDistanceBucket` sentinel'i skor eşitliğinde geo'suz sağlayıcıları hep sona atar — federal sağlayıcılar arasında istenmeyen sistematik sıralama etkisi olup olmadığı ürünle doğrulanmalı.

### 4) provider-coverage / provider-integrity
1. **Çalışıyor mu?** Evet; ZIP-prefix → eyalet tablosu 3-haneli, sınırları belgelenmiş; `expandCoverageRows` FEDERAL/STATE ayrımını doğru yapıyor; rebuild tx içinde delete+createMany.
2. **Mantıksızlık?** STATE kapsamında states listesi boşken zip'lerden eyalet türetiliyor ama `statesSet.size>0` filtresi zip'in eyaletini listede zorunlu kılıyor — doğru.
3. **Eksik?** ZIP tablosunda bazı gerçek prefix'ler yok (örn. 962-966 askeri/AP, 006-009 PR) — PR/VI adresleri `zipToState` undefined döner; territory kullanıcıları kapsama eşleşmesinden düşer.
4. **Bug?** Yok.
5. **İyileştirme:** `getZipReferenceFacts` zaten sınırı itiraf ediyor; PR/AE/AP prefix'lerini ekleyin ya da territory'leri açıkça kapsam dışı ilan edin.

### 5) legal / consent versiyonlama
Tabloda Yüksek bulgu: TERMS_VERSION çatallı ve sürüm tazeliği kontrol edilmiyor. Metin içerikleri (arbitration, Delaware, FMCSA/sponsored ifşaları) kapsamlı ve "completing a task does not update provider accounts" cümlesi connector yasal duruşuyla tutarlı.

### 6) api-client (mobil)
1. Çalışıyor; timeout/AbortError → kullanıcı dostu mesaj, 401'de opt-out'lu global sign-out, 429'da Retry-After.
2/3. Retry yok (bilinçli olabilir), `params` yalnız string kabul ediyor.
4. Bug yok; `upload` Content-Type'ı doğru şekilde fetch'e bırakıyor.
5. İyileştirme: falsy body uç durumu (tablo).

### 7) encryption + audit-redaction + email-html-sanitizer + sentry-redaction
- **encryption.ts:** Doğru AES-256-GCM; prod'da anahtar yoksa yazma/okuma THROW (plaintext sızdırmaz); hex anahtar format doğrulaması var; HMAC imza karşılaştırması sabit-zaman. Sorun bulunamadı.
- **audit-redaction:** Derinlik/anahtar/uzunluk tavanları + circular koruması; `endsWith("key")` aşırı-redaksiyonu (Düşük).
- **email-html-sanitizer:** Güvenlik tarafı sıkı (event handler/`javascript:`/SVG-data engelli, redirect meta/base düşürülüyor, `target=_blank`'e rel zorlanıyor); fonksiyonel void-tag yutma hatası (Orta, tablo). `sanitizeEmailSubject` regex'i görünenin aksine kontrol-karakter sınıfı (hex dump ile doğrulandı `[\0-\x1f\x7f]`) — sahte alarm değil.
- **sentry-redaction:** Anahtar + serbest-metin scrubber'ları makul; `scrubText` 32+ karakter token'ları agresif siler (bilinçli).

### 8) permissions (workspace matrisi)
Tam ve tutarlı: SUSPENDED/OVERFLOW salt-okur tabanı, CHILD'ın finansal görünmezliği, member.* hedef-rol kontrolleri, self-scope mutasyonları. `addressChange.manageForMembers` + `resolveManagedSyncEnabled` (CHILD default true) ikilisi dokümante. Eksik: `member.changeRole`'da ADMIN'in birini ADMIN'e YÜKSELTMESİNİ engelleyen kontrol yok (targetRole mevcut rol; yeni rol parametresi matriste değil — API katmanına emanet). İyileştirme önerisi olarak not edildi.

### 9) env-catalog ↔ runtime-config
Tabloda Orta bulgu (67 anahtar drift'i). Ters yönde 16 anahtar (catalog'da olup runtime-config'te olmayan platform/feature bayrakları) tasarım gereği makul.

### 10) packages/connectors
1. **Uçtan uca:** Evet — registry manifest doğrulamalı, executor saf, dispatcher retry bütçesini state machine'le doğru bağlıyor (FAILED→QUEUED yalnız retryable+bütçe varken, aksi NEEDS_USER; terminal CONFIRMED/NEEDS_USER). USPS referans connector'ı durum eşlemesi (409→idempotent CONFIRMED) düşünceli.
2. **Mantıksızlık:** `readBackVerify`'lı connector'da push SUBMITTED → verify çağrılıyor; verify exception'ı da taxonomy'ye düşüyor (try kapsamında) — doğru.
3. **Eksik:** `perConnectorPerMinute`/`perUserPerDay` enforcement bu pakette yok (dispatcher hint); HALF_OPEN tek-uçuş yok; breaker durumu dağıtık değil (Orta, tablo).
4. **Bug/güvenlik:** Egress allowlist + manuel redirect takibi + cross-host Authorization düşürme örnek nitelikte. Retry fırtınası YOK (yalnız RATE_LIMITED/PARTNER_DOWN, 4 deneme, 60 sn tavan, jitter). 429-breaker etkileşimi (Orta, tablo).
5. **İyileştirme:** CI'da connectors testlerinin koşmaması (Orta, tablo) bu güvenceleri kağıt üstünde bırakıyor.

### 11) packages/db — şema
- **İlişkiler/onDelete:** Genel olarak titiz: kullanıcı altı Cascade, katalog refleri SetNull, MovingPlan→Address Restrict (yorumla gerekçeli), AdminAuditLog SetNull + denormalize aktör. `BlogPost.author`/`BlogRevision.author` onDelete belirtilmemiş (=Restrict): blog yazısı olan admin silinemez — bilinçli mi belgelenmeli.
- **Unique/index:** Hot-path indexleri (Service isActive+billingDay/contractEndDate, AuditLog createdAt, Subscription kombinasyonları) yerinde. Eksikler tabloda (AdminSession.tokenHash, WorkspaceInvitation tasarımı).
- **VarChar genişlikleri:** id'ler 30 (cuid 25 — uygun), tokenHash 64, e-posta 191 (utf8mb4 index sınırına uyumlu). `AdminAuditLog.entityId 30` tek riskli nokta (Düşük).
- **Soft-delete tutarlılığı:** `SOFT_DELETE_MODELS` ↔ şema parity'si testle korunuyor (apps/web/src/lib/soft-delete-models.test.ts) — iyi. Extension'ın delete yolu kırık (Yüksek) ve nested-include sızıntısı (Orta).
- **JSON kolonları:** dashboardWidgetPrefs, caveats, localEffect, metadata, statusCounts — hepsi okuyucularda parse-guard'lı (`parseMoveTaskLocalEffect` örneği savunmacı).

### 12) migrations + seeds
- **Replay:** 3 hayalet tablo dışında (Yüksek, tablo) CREATE/DROP envanteri şemayla bire bir; `prisma validate` yeşil; migration_lock=mysql; legacy sqlite migration'ları ayrı klasörde izole — doğru kurulum.
- **Seed idempotensi:** seed-master create-only provider + updatedBy-null şablon tazeleme (admin düzenlemelerine saygılı) — iyi. seed-admin parola ezme (Orta), seed.ts ölü (Orta), seed-blog tek-seferlik refresh (Düşük). seed-blog aktif admin yoksa nazikçe exit 0 — prod-güvenli.
- **migrate-to-workspaces:** Cursor'lı batch + kullanıcı başına tx + yalnız NULL doldurma → idempotent/yeniden-başlatılabilir; temiz.

### 13) ops — workflows + Docker + kök scriptler
- **ci.yml:** Cron rotalarının tamamı mevcut (apps/web 24 rota + admin backup doğrulandı). Sorunlar: migrate-deploy sıralaması (Yüksek), connectors/mobile-typecheck boşlukları (Orta). gitleaks + prod-graph audit + provider guard'ları iyi pratik.
- **cron.yml:** Saat dilimi-bilinçli 12-18 UTC reminder fan-out'u ve idempotent dedupe varsayımı sağlam tasarım; dakika-eşitlik kapıları (Yüksek) ve 60 sn curl tavanı (Orta) operasyonel risk. `uptime` job'ının "GH failure e-postası = total-outage backstop" yaklaşımı pragmatik.
- **Docker:** connectors paketi üç imajda da kopalanmıyor (Kritik, tablo). BUILD_PHASE=true / runtime-strict secret ayrımı ve "secrets asla ENV'e gömülmez" disiplinli. Root Dockerfile start'ta migrate deploy — CI'daki migrate ile çift yol (Yüksek bulguda birleşik).
- **Kök scriptler:** package.json script seti tutarlı; `verify:*` zinciri CI'dan daha kapsamlı (CI'ya taşınmalı); prepare-standalone script'leri Dockerfile runner kopyalarıyla birebir aynı listeyi taşıyor (connectors hariç — Düşük not).

---

## Modül Sağlık Özeti

| Modül | Sağlık | Not |
|---|---|---|
| shared/entitlement+billing | 🟢 Sağlam | INCOMPLETE dalı + TERMS_VERSION drift'i (legal ile ortak) dışında temiz |
| shared/recommendation | 🟢 Sağlam | Komparatör/sinyal mimarisi olgun; testli |
| shared/migration+classifier | 🟡 İyi | WV/VA eleme hatası + ölü fallback düzeltilmeli |
| shared/güvenlik yardımcıları (encryption/redaction/sanitizer) | 🟡 İyi | Kripto ve redaksiyon sağlam; sanitizer void-tag yutması fonksiyonel hata |
| shared/legal+acquisition | 🟠 Dikkat | Sürüm çatallanması consent kayıtlarının kanıt değerini zayıflatıyor |
| connectors | 🟢 Sağlam (tek süreçte) | Tasarım örnek düzeyde; dağıtık breaker + CI testi boşluğu |
| db/schema | 🟢 Sağlam | Disiplinli; birkaç orta/düşük kenar |
| db/soft-delete extension | 🔴 Kırık güvenlik ağı | delete/deleteMany yolu çalışmıyor (latent crash) |
| db/migrations | 🟠 Dikkat | 3 hayalet tablo drift'i çözülmeli |
| db/seeds | 🟡 İyi | master/blog güvenli; admin-seed parola ezmesi ve ölü seed.ts |
| ops/CI | 🟠 Dikkat | Migrate sıralaması + test kapsam boşlukları |
| ops/cron | 🟠 Dikkat | Dakika-kapısı açlığı connector/blog işleyişini fiilen durdurabilir |
| ops/Docker | 🔴 Kırık build yolu | connectors package.json eksiği üç imajı da düşürür |

**Genel:** Foundation katmanı (shared+db) bilinçli, savunmacı ve büyük oranda test korumalı yazılmış. En acil işler operasyon tarafında: Docker deps kopyaları (Kritik), cron dakika-kapıları, CI migrate sıralaması; kod tarafında soft-delete delete-yolu ve terms sürüm çatallanması.
