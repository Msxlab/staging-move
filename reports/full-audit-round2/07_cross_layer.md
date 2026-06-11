# SCOPE 7 — KATMANLAR ARASI (CROSS-LAYER) DENETİM RAPORU
*Tarih: 2026-06-11 · Denetçi: bağımsız tam-yığın denetim ajanı (Round 2)*
*Girdi olarak yalnızca kod/şema/config/route/test dosyaları okunmuştur; hiçbir önceki rapor/MD girdi alınmamıştır.*

---

## 1. Gezilen Modül Haritası

| Dikiş (seam) | İncelenen dosyalar |
|---|---|
| **Web↔Mobil API kontratı** | `apps/mobile/src/lib/api.ts`, `packages/shared/src/api-client.ts`, mobil ağaçtaki tüm `api.get/post/put/patch/delete/upload` çağrıları (90+ çağrı sayıldı), `apps/web/src/app/api/**/route.ts` (158 route, export edilen HTTP metodları tek tek çıkarıldı), `apps/mobile/src/lib/subscription-gate.ts`, `home-dossier.ts`, `VehicleCheckCard.helpers.ts/.tsx`, `auth-store.ts`, sign-in/sign-up ekranları |
| **Admin↔Web ortak modeller** | `packages/db/prisma/schema.prisma` (Subscription, ServiceProvider, RuntimeConfigEntry, Blog*, SponsoredPlacement, IntegrationDailyStat, Workspace*), `apps/web/src/lib/runtime-config.ts`, `feature-flags.ts`, `apps/web/src/app/api/providers/route.ts` + `providers/revalidate/route.ts`, `apps/admin/src/lib/providers-revalidate.ts`, `blog-revalidate.ts`, admin provider/logo/blog route'ları, `packages/db/src/optimistic-locking.ts`, admin `subscriptions/[id]/change-plan/route.ts` |
| **Cron/Webhook/İdempotency zinciri** | `.github/workflows/cron.yml`, `docker/ofelia.ini`, `apps/web/src/lib/cron-guard.ts`, `internal-secrets.ts`, 23 web cron route'u + admin `cron/backup`, `cron/blog-image-cleanup`, `webhook-idempotency.ts`, stripe/appstore/playstore/resend/connector webhook'ları, `email-service.ts` (EmailLog dedupe), `scheduled-delivery`, `connector-runtime.ts` (atomik claim) |
| **Entitlement gerçeklik yolu** | `packages/shared/src/entitlement.ts`, `billing.ts`, `workspace-entitlements.ts` (FEATURES), `apps/web/src/lib/plan-limits.ts`, `apps/web/src/components/marketing/plan-compare-table.tsx`, `pricing-section.tsx`, `workspace-plans-section.tsx`, `apps/mobile/src/lib/plan-comparison.ts(+test)`, admin `workspaces` route'ları + `user-detail-client.tsx` |
| **Sayaç/veri tutarlılığı** | `SponsoredPlacement` (movers.ts increment), `providers/popular/route.ts`, `community-popularity.ts`, `cron/provider-stats/route.ts`, `integration-telemetry.ts`, koltuk sayımı (`workspaces/[id]/invitations/route.ts`, `workspace-invite-accept.ts`, `trial-check` reconcile), `blog/view/route.ts` + BlogView modeli |
| **Yarış/yetim riskleri** | `account-deletion.ts`, PushDevice cascade + `notifications.ts` token budama, R2 (`storage/r2-client`, admin `blog-uploads.ts`, `logo-ingest.ts`), `cron/data-retention/route.ts`, `cron/blog-image-cleanup` (admin), token tabloları (PasswordResetToken vb.) |
| **Rate-limit anahtarlama** | `apps/web/src/lib/rate-limit.ts`, `rate-limit-policy.ts`, `client-ip.ts`, `cron-guard.ts`, admin `auth/login/route.ts` (bespoke limiter), admin `audit.ts` |

---

## 2. Bulgular Tablosu (Kritik/Yüksek önce)

| Katman | Önem | Bulgu | Neden sorun | Önerilen çözüm | dosya:satır |
|---|---|---|---|---|---|
| Entitlement yüzeyleri | **Yüksek** | Mobil plan karşılaştırması Family için **"Up to 5 members"** gösteriyor; gerçek koltuk tavanı **6** (owner dahil). Web pazarlama "Up to 6 members (you + 5)", FEATURES.seatLimit=6, BILLING_PLAN_DEFINITIONS "up to 6 members". Pro'da 10=10 tutarlı, yani mobil aynası tek tier'da yanlış; kolokasyon testi de yanlış değeri (5) pinlediği için CI drift'i yakalamıyor | Satın alma ekranında (IAP) kullanıcıya eksik vaat — web'in "6 üye" vaadiyle çelişir; App Store yorum/iade riski; "mirror asla sapmaz" iddiası boşa düşmüş | `MEMBER_SEATS.FAMILY = 6` yap; testteki pin'i 6'ya çek; uzun vadede `index.mobile.ts`'e `seatLimitForPlan`'ı dahil edip literal aynayı kaldır | `apps/mobile/src/lib/plan-comparison.ts:73` (+`:240`), `apps/mobile/src/lib/plan-comparison.test.ts:124`; doğru kaynaklar: `packages/shared/src/workspace-entitlements.ts:52`, `apps/web/src/components/marketing/plan-compare-table.tsx:146-147`, `packages/shared/src/billing.ts:99,107`, `pricing-section.tsx:75` |
| Cron zinciri | **Yüksek** | GHA `*/5` slotundaki alt-işler **çalışma anındaki dakikaya tam eşitlik** ile kapılanıyor: `connector-dispatch`/`scheduled-delivery` için `$(date -u +%M) % 10 == 0`, `blog-publish` için `== "00"`. GitHub cron'u rutin 1-10 dk gecikmeli başlattığından koşullar çoğunlukla tutmaz: 10 dakikalık işler ~6/saat yerine olasılıksal ~1/saat'e, blog-publish saatlikten ~5 saatte 1'e düşer | Zamanlanmış blog yazıları saatlerce yayınlanmaz; NotificationQueue'daki zamanlanmış bildirimler ve connector outbox'ı (Pro özelliği) keyfî gecikir. (Kendi kendine gate'lenen 12-18 UTC hatırlatıcı slotları local-hour==8 kontrolü yaptığından bu sorundan ETKİLENMEZ — sadece dakika-eşitlikli üçlü etkilenir) | Eşitlik yerine pencere kullan: `% 10 -lt 5` ve blog-publish için `-lt 5`; ya da uptime job'daki gibi çeyrek-saat toleransı uygula | `.github/workflows/cron.yml:80-82` (karşılaştır: kendininkini toleranslı yapan `cron.yml:180`) |
| Cron/yetim | **Yüksek** | Admin'in `cron/blog-image-cleanup` route'u **hiçbir prod scheduler'da yok**: GHA cron.yml yalnızca `$ADMIN/api/cron/backup` çağırıyor; ofelia.ini'de var ama prod DO'da ofelia çalışmıyor. R2 blog görseli yetimleri sınırsız birikir. Daha kötüsü: temizlik, R2 anahtarlarını **AdminAuditLog** upload kayıtlarından keşfediyor ve `data-retention` AdminAuditLog'u 365 günde purge ediyor → kayıt silinince yetim **kalıcı** olarak keşfedilemez olur | Sürekli artan R2 maliyeti + temizlenemez hale gelen nesneler (kendi temizlik mekanizmasının girdisi başka cron tarafından siliniyor — katmanlar arası tutarsızlık) | GHA `15 3 * * *` bloğuna `hit "$ADMIN/api/cron/blog-image-cleanup" POST` ekle; AdminAuditLog purge'üne `action=BLOG_UPLOAD_IMAGE` istisnası koy veya anahtarları ayrı tabloya taşı | `.github/workflows/cron.yml:84-103` (eksik), `apps/admin/src/app/api/cron/blog-image-cleanup/route.ts:1-70`, `apps/web/src/app/api/cron/data-retention/route.ts:95-100`, `docker/ofelia.ini` |
| Web↔Mobil kontrat | **Yüksek** | Araç/VIN kontrolü teaser kontratı mobilde işlenmiyor: web FREE/lapsed kullanıcıya `200 {configured:true, entitled:false, upgradeRequired:"VEHICLE_CHECK_UPGRADE_REQUIRED"}` döner ve `vehicle`/`recalls` bloklarını tamamen atlar; mobil `VehicleDecodeResponse` tipinde `entitled`/`upgradeRequired` alanı bile yok ve `deriveVehicleCheckView` eksik `vehicle` bloğunu `kind:"error"` → "vehicleCheckError" (teknik hata metni) olarak gösterir | Hakkı düşmüş (lapsed) bir kullanıcı — görevleri okunur kaldığından karta erişebilir — yükseltme CTA'sı yerine yanıltıcı "hata oluştu" görür; dossier/movers/briefing yüzeylerinin hepsinde düzgün işlenen teaser sözleşmesi tek bu yüzeyde kopuk | Tipe `configured/entitled/upgradeRequired` ekle; `entitled === false` için ayrı `kind:"upgrade"` görünümü + Upgrade CTA çiz | `apps/web/src/app/api/vehicles/decode/route.ts:81-88`; `apps/mobile/src/components/ui/VehicleCheckCard.helpers.ts:49-62,86-90`, `VehicleCheckCard.tsx:163-166` |
| Sayaç tutarlılığı | Orta | `IntegrationDailyStat` flush'ı oku-birleştir-yaz (`findUnique`→`update`); yalnızca create yarışı ele alınmış, update yarışı değil. Çok instance'lı web'de eşzamanlı flush sayaç kaybeder | Telemetri eğilim verisi sessizce eksilir (admin Insights paneli yanlış oran gösterir) | JSON yerine `statusCounts`'ı satır başına status kolonlu tabloya veya raw `UPDATE ... JSON_SET`-artırımına çevir; ya da kabul edilen kayıp olarak belgele | `apps/web/src/lib/integration-telemetry.ts:146-166` |
| Sayaç/gizlilik tabanı | Orta | `providers/popular` ve `community-popularity` adres kohortunu `where:{state}` ile kuruyor — `deletedAt:null` filtresi YOK. Soft-delete edilmiş adreslerin sahipleri k-anonimite kohortunu ve popülerlik sayımını şişiriyor | k=20/5 tabanları hayalet kullanıcılarla aşılabilir (gizlilik tabanının amacı zayıflar); eyaletten taşınan kullanıcı popülerliğe katkı vermeye devam eder (veri doğruluğu) | Her iki sorguya `deletedAt: null` ekle; servis sorgusuna da `ACTIVE_TRACKED_SERVICE_WHERE` uygula | `apps/web/src/app/api/providers/popular/route.ts:43-47,54-61`; `apps/web/src/lib/community-popularity.ts:44-56` |
| Admin↔Web cache | Orta | Admin logo `upload` ve `auto-fetch` route'ları `revalidateProvidersCatalog()` çağırmıyor (CRUD/bulk/merge/coverage/governance/candidate route'ları çağırıyor) → yeni logo web'de 1 saate kadar görünmez | Aynı mutasyon sınıfının diğer üyeleri cache'i patlatırken bu ikisi unutulmuş — tutarsız editör deneyimi | İki route'a da mutasyon sonrası `revalidateProvidersCatalog()` ekle | `apps/admin/src/app/api/providers/[id]/logo/upload/route.ts`, `.../logo/auto-fetch/route.ts` (yok); karşılaştır `.../logo/candidates/[candidateId]/route.ts` (var), `apps/admin/src/lib/providers-revalidate.ts:22-24` |
| Yetim/retention | Orta | Süresi dolmuş tek-kullanımlık güvenlik tabloları hiçbir retention işinde değil: `PasswordResetToken`, `EmailVerificationToken`, `OAuthState`, `MobileOAuthCode`, `WorkspaceAuthChallenge` için hiçbir `deleteMany` yok (data-retention 10+ tabloyu kapsıyor ama bunları değil) | Sınırsız tablo büyümesi + süresi dolmuş token hash'lerinin süresiz tutulması (gereksiz PII/saldırı yüzeyi) | data-retention'a `expiresAt < now - 7g` süpürmesi ekle | `apps/web/src/app/api/cron/data-retention/route.ts` (kapsam listesi 28-132), şema: `schema.prisma:117,165,179,220,2233` |
| Webhook idempotency | Orta | Connector webhook'u check-then-act dedupe kullanıyor (`hasProcessedWebhookEvent` satır 111 → yan etkiler → `markWebhookEventProcessed` satır 159); kendi yardımcı kütüphanesinin docstring'i bu pencereye karşı `reserveWebhookEvent`'i açıkça öneriyor (stripe/appstore/playstore reserve kullanıyor) | Eşzamanlı çifte teslimde iki işleyici de geçer; CONFIRMED yazımı idempotent olduğundan etki düşük ama desen standart dışı | `reserveWebhookEvent` + hata yolunda `releaseProcessedWebhookEvent` desenine geçir | `apps/web/src/app/api/connectors/[key]/webhook/route.ts:111,132,159`; öneri: `apps/web/src/lib/webhook-idempotency.ts:39-60` |
| Cron kapsama | Orta | `cron/synthetic-monitor` (3×/gün hedefli, read-only prod smoke) hiçbir scheduler'da referanslı değil (ne cron.yml ne ofelia.ini) — ölü route | Tasarlanan sentetik izleme hiç koşmuyor; uptime-check yalnız HTTP 200 bakar, synthetic-monitor'un derin kontrolleri devre dışı | GHA'da uygun slota ekle veya route'u kaldır | `apps/web/src/app/api/cron/synthetic-monitor/route.ts:10-25`, `.github/workflows/cron.yml` (yok) |
| Cron dedupe | Orta | trial-check'in `free-access-ending` ve `annual-renewal` dedupe'u `Notification.metadata contains` check-then-act — EmailLog'un unique `dedupeKey` mekanizmasını kullanmıyor | Çakışan iki çalıştırmada (manuel + zamanlanmış) çift e-posta mümkün; diğer tüm cron'lar atomik unique-key desenine geçmişken bu ikisi eski desende | Bu iki e-postayı da `sendEmail({dedupeKey})` yoluna taşı | `apps/web/src/app/api/cron/trial-check/route.ts:75-94,141-160`; doğru desen: `apps/web/src/lib/email-service.ts:213-251` |
| Cron scheduler eşliği | Orta | Ofelia (self-host) ile GHA iş kümeleri sapmış: ofelia'da `scheduled-delivery`, `daily-digest`, `lifecycle-nudges`, `move-week-alerts`, `bill-overdue`(saat farklı), `admin-monthly-report`, `uptime-check` yok; self-host kurulumda zamanlanmış bildirim/digest hiç çalışmaz | "İki scheduler aynı işi yapar" varsayımı kırık; self-host'a dönüş veya DR senaryosunda sessiz işlev kaybı | ofelia.ini'yi cron.yml ile eşitle (veya tek kaynak haline getirip diğerini üretken kıl) | `docker/ofelia.ini` (19 iş) vs `.github/workflows/cron.yml` (24 uç) |
| Rate-limit anahtarı | Orta | Anonim uçlarda anahtar `x-forwarded-for`'un SOL-UÇ değeri (CF başlığı yoksa) — DO/proxy arkasında istemci kendi XFF'ini öne ekleyebildiğinden anonim limitler (login öncesi yüzeyler, providers, register) header döndürerek sıfırlanabilir; cron-guard'ın callerBucket'ı da aynı header'lardan | Anonim brute-force/scrape limitlerinin etrafından dolaşma; sızmış CRON_SECRET senaryosunda bucket rotasyonuyla savunma katmanı zayıflar | Platformun güvenilir başlığını (DO: sağdan-N yaklaşımı / `do-connecting-ip`) tek kaynaktan çöz; XFF sol-ucunu yalnız logging'de kullan | `apps/web/src/lib/client-ip.ts:29-31`, `cron-guard.ts:86-90`, `rate-limit-policy.ts:375-380` |
| Admin↔Web tutarlılık | Düşük | Admin `audit.ts` IP önceliği `cf > vercel > xff > x-real-ip`; web `client-ip.ts` ve admin login `resolveClientIP` ise `cf > x-real-ip > xff`. Yorum "web ile aynı" dese de değil | Nginx arkasında audit kayıtlarındaki IP, limiter'ın gördüğü IP'den farklı (spooflanabilir XFF) olabilir — adli iz güvenilirliği düşer | `firstIp(real)`'i xff'in önüne al | `apps/admin/src/lib/audit.ts:154-163` vs `apps/web/src/lib/client-ip.ts:22-31`, `apps/admin/src/app/api/auth/login/route.ts:187-196` |
| Web API | Düşük | `revalidateTag("providers", "default")` — `revalidateTag` tek argüman alır; ikinci argüman sessizce yutulur | Çalışıyor ama yanıltıcı; API değişiminde gizli kırılma riski | İkinci argümanı kaldır | `apps/web/src/app/api/providers/revalidate/route.ts:62`, `apps/admin/src/lib/providers-revalidate.ts:23` |
| Web route hijyeni | Düşük | `forgot-password/route.ts` bir route dosyasından HTTP-dışı sabit (`GENERIC_FORGOT_PASSWORD_MESSAGE`) re-export ediyor | Next.js route-export tip denetimi sıkılaşırsa build kırılır (geçmiş sürümlerde hata idi) | Sabiti `lib/`e taşı, route yalnız `POST` export etsin | `apps/web/src/app/api/auth/forgot-password/route.ts:1-6`, kaynak: `auth/password/reset/request/route.ts` |
| Mobil kontrat | Düşük | `UPSELL_GATE_CODES` içinde artık hiçbir web kodunun üretmediği `SETUP_MOVING_PLAN_LIMIT_REACHED` duruyor | Ölü kod; gelecekte gerçek kod listesiyle karşılaştırmayı bulanıklaştırır | Kaldır veya "legacy" yorumuyla işaretle | `apps/mobile/src/lib/subscription-gate.ts:15` |
| Cron UX | Düşük | weekly-digest 09:00 UTC sabit (ET 04-05:00 yerel) — günlük hatırlatıcılar yerel-08:00'e taşınmışken haftalık digest gece yarısı sonrası gidiyor | Düşük açılma oranı, spam algısı | Haftalık digest'i de 12-18 UTC yerel-saat-kapılı slotlara taşı | `.github/workflows/cron.yml:44,132` |
| Cron perf | Düşük | provider-stats cron'u provider başına ayrı `count`+`update` (N+1; katalog büyüdükçe yavaşlar) | 1000+ provider'da dakikalarca DB baskısı | Tek `groupBy(providerId)` + toplu update | `apps/web/src/app/api/cron/provider-stats/route.ts:13-35` |
| Cron çift tetik | Düşük | data-retention hem günlük 06:00 hem Pazar 04:00'te tetikleniyor (yorum "daily is safe" diyor; Pazar slotu artık gereksiz) | Kafa karışıklığı; iki kayıt kaynağı | Pazar 04:00 satırını kaldır | `.github/workflows/cron.yml:46,139,102` |

**Kritik bulgu yok.** Yüksek: 4 · Orta: 8 · Düşük: 7.

---

## 3. Alt-Alan Bazında 5-Soru Değerlendirmesi

### 3.1 Web↔Mobil API kontratı
1. **Uçtan uca çalışıyor mu?** Evet. Mobilin çağırdığı ~70 benzersiz uç noktanın TAMAMI web'de mevcut ve metodlar eşleşiyor (GET/POST/PATCH/PUT/DELETE tek tek doğrulandı; ör. `PATCH /api/notifications/feed?action=read-all` web'de `action==="read-all"` dalıyla karşılanıyor — `feed/route.ts:41-51`). `ApiClient` 401'de oturumu temizliyor (MFA-confirm istisnası `skipUnauthorizedHandler` ile), 429'da `RATE_LIMITED` kodu ve Retry-After üretiyor, 204/boş gövdeyi güvenle işliyor.
2. **Mantıksızlık?** Araç teaser kontratı (Y4): tüm diğer gate'li yüzeyler (dossier, movers, briefing) `entitled:false`'ı teaser'a çevirirken VIN kartı "hata" gösteriyor.
3. **Eksik?** Mobil `/api/movers` ve `/api/providers/saved`'ı hiç çağırmıyor (Pro mover önerileri ve kayıtlı sağlayıcılar mobilde yüzeysiz — bilinçli kapsam olabilir, ürün kararı netleştirilmeli).
4. **Bug/güvenlik?** `enforceProductionApiUrl` release build'de http'yi prod'a zorluyor (iyi); `X-Client-Platform` oturum etiketlemesi tutarlı.
5. **İyileştirme:** Kontrat kaymasını CI'da yakalamak için mobil çağrı listesi ↔ web route manifest'ini karşılaştıran bir test eklenebilir (bu denetimde elle yapıldı).

### 3.2 Admin↔Web ortak DB modelleri
1. **Çalışıyor mu?** Evet. Subscription: admin yazarları version-CAS (`change-plan/route.ts:602`) ve Stripe webhook'u `lastStripeEventAt` eskilik kapısı (`stripe/route.ts:254-272`) ile uzlaşıyor — çakışan yazar problemi tasarımla çözülmüş. ServiceProvider: admin mutasyonları HMAC'li `/api/providers/revalidate` üzerinden web'in 1 saatlik `unstable_cache`'ini patlatıyor.
2. **Mantıksızlık?** Logo upload/auto-fetch revalidate çağırmıyor (O3) — aynı sınıfın diğer route'ları çağırırken.
3. **Eksik?** RuntimeConfigEntry web'de istek başına DB'den okunuyor (cache yok) → admin yazımı anında etkili; FeatureFlag 60 sn TTL — kabul edilebilir; belgelenmesi iyi olur.
4. **Bug?** `revalidateTag`'e fazladan `"default"` argümanı (D1).
5. **İyileştirme:** Sponsored/movers (MovingCompany) admin mutasyonlarının web'de cache'i yok (her istek DB) — sorun değil ama `/api/providers` ile simetri için belgelenmeli.

### 3.3 Cron / Webhook / İdempotency zinciri
1. **Çalışıyor mu?** Zincirin iskeleti sağlam: GHA → `Authorization: Bearer CRON_SECRET` → `guardCronRequest` (sabit-zaman karşılaştırma + rota başına limit, 23/23 web cron route'unda doğrulandı) → işler → `EmailLog.dedupeKey` (unique kısıt + FAILED/SKIPPED yeniden-talep semantiği) / `Notification @@unique(userId,channel,dedupeKey)`. `scheduled-delivery` ve `connector-runtime` atomik claim (guarded updateMany) kullanıyor — örnek alınacak kalitede.
2. **Mantıksızlık?** Dakika-eşitliği kapıları (Y2) kendi uptime job'ının toleranslı kapısıyla çelişiyor; ofelia↔GHA kümeleri sapmış (O8).
3. **Eksik?** blog-image-cleanup ve synthetic-monitor hiçbir prod scheduler'da yok (Y3, O6).
4. **Bug?** trial-check'in iki e-postası check-then-act dedupe'lu (O7); connector webhook reserve yerine check-then-act (O5).
5. **İyileştirme:** Cron uçlarının "son başarılı çalışma" telemetrisi yok — IntegrationDailyStat'a `source:"cron:<name>"` yazılırsa admin Insights'tan starvation (Y2 gibi) görünür olur.

### 3.4 Entitlement gerçeklik yolu
1. **Çalışıyor mu?** Evet — `getEffectiveEntitlement` gerçekten tek hakem: web plan-limits, workspace seat/connector kapıları, admin workspace/user ekranları ve cron reconcile hepsi onu çağırıyor (12+ çağrı noktası doğrulandı). Sayısal yüzeyler: PLAN_LIMITS (3/10, 10/100, 15/500, 25/1000) ↔ web compare table ↔ mobil MAX_ADDRESSES/MAX_SERVICES ↔ BILLING_PLAN_DEFINITIONS metinleri birebir tutarlı.
2. **Mantıksızlık?** TEK sapma: mobil Family koltuk 5 vs her yerde 6 (Y1).
3. **Eksik?** Mobil `index.mobile.ts` workspace-entitlements'ı dışlıyor; literal ayna + pin testi deseni Y1'in köküdür — paylaşılan sabit dışa açılmalı.
4. **Bug?** Yok (Y1 dışında). `concurrentPlanLimit` web'de gerçekten uygulanıyor (`moving/route.ts:99-110`), mobil 3 değeri tutarlı.
5. **İyileştirme:** Web pin testi (`plan-compare-table.test.tsx:91`) ile mobil pin testinin AYNI kaynaktan beslenmesi (shared fixture) drift sınıfını kalıcı kapatır.

### 3.5 Sayaçlar / veri tutarlılığı
1. **Çalışıyor mu?** SponsoredPlacement impressions/clicks atomik `{ increment: 1 }` (movers.ts:218-233) — doğru. BlogView `@@unique(postId, ipHash, viewDay)` + günlük tuz — doğru. Koltuk sayımı: davet + kabul yolları Serializable işlem içinde üye+bekleyen davet sayıyor, kabul edilen daveti çift saymıyor; `trial-check` düşüş sonrası `reconcileSeatsForOwner` çağırıyor — üye satırları ile koltuk tavanı tutarlı.
2. **Mantıksızlık?** providers/popular tabanları soft-delete'i görmezden geliyor (O2).
3. **Eksik?** IntegrationDailyStat update yarışı (O1).
4. **Bug?** provider-stats `userCount`'u `isActive:true` ile sayıyor; servis silme `isActive:false` yazdığından (services/[id]/route.ts:277) tutarlı — sorun yok.
5. **İyileştirme:** popular endpoint'i her istekte iki tam tablo taraması yapıyor; community-popularity'deki 1 saatlik Redis cache deseni buraya da uygulanabilir.

### 3.6 Yarış / yetim riskleri
1. **Çalışıyor mu?** Kullanıcı silme zinciri sağlam: Stripe iptali (yeniden denemeli, force-erase eşiği), PushDevice/OAuthAccount/Subscription FK cascade; push token'ları `DeviceNotRegistered`'da budanıyor (notifications.ts:146-157); adres soft-delete'i servis+bütçeye kaskadlanıyor (addresses/[id]/route.ts:240-247).
2. **Mantıksızlık?** Blog R2 temizliğinin girdisi (AdminAuditLog) başka cron tarafından 365 günde siliniyor (Y3 ikinci yarısı).
3. **Eksik?** Süresi dolmuş token tabloları süpürülmüyor (O4); blog-image-cleanup prod'da hiç koşmuyor (Y3).
4. **Bug?** Yok — workspace davet/kabul yarışları Serializable + P2002/P2034 çevirileriyle kapatılmış.
5. **İyileştirme:** R2 için ayda bir "bucket listele ↔ DB referansları" mutabakat job'u, audit-log'a bağımlılığı tamamen kaldırır.

### 3.7 Rate-limit anahtarlama (web vs admin vs cron)
1. **Çalışıyor mu?** Evet — web: kimlikli yazma uçları `user:` anahtarlı (IP rotasyonuna dayanıklı), auth uçları `email_ip` politika matrisi; admin login: e-posta+IP hash'li bespoke Redis limiter + 30 dk kilit; cron: rota+IP bucket'lı ikincil savunma; Upstash yoksa cron fail-open / diğerleri degraded-memory — bilinçli ve belgeli.
2. **Mantıksızlık?** Admin `audit.ts` IP sırası web'den farklı (D4).
3. **Eksik?** DO'ya özgü güvenilir IP başlığı çözümü yok; XFF sol-uç anonim anahtarları spooflanabilir (O9 — önceki denetimde de işaretlenmiş, hâlâ açık).
4. **Bug?** Yok.
5. **İyileştirme:** `client-ip.ts`'i `packages/shared`'a taşıyıp admin'in iki kopyasını (login + audit) tek kaynağa bağlamak.

---

## 4. Modül Sağlık Özeti

| Dikiş | Sağlık | Not |
|---|---|---|
| Web↔Mobil kontrat | 🟢 İyi (1 Yüksek) | 70 uç nokta birebir eşleşik; tek kopuk teaser yüzeyi VIN kartı |
| Admin↔Web modeller | 🟢 İyi | Version-CAS + event-ordering + HMAC revalidate zinciri olgun; 2 logo route'u cache'i ıskalıyor |
| Cron/webhook zinciri | 🟡 Orta (2 Yüksek) | Guard+dedupe altyapısı çok iyi; ZAMANLAYICI katmanı (dakika kapıları, eksik işler, ofelia sapması) zayıf halka |
| Entitlement yolu | 🟢 Çok iyi (1 Yüksek) | Tek hakem deseni gerçekten uygulanmış; tek sayı (Family=5) sapmış |
| Sayaçlar/tutarlılık | 🟢 İyi | Atomik artırımlar ve k-anonimite doğru; soft-delete filtresi ve telemetri merge'ü pürüzlü |
| Yarış/yetim | 🟢 İyi | Silme kaskadları ve claim desenleri sağlam; R2 + token tabloları birikiyor |
| Rate-limit | 🟡 Orta | Desen tutarlı; IP güven modeli platforma göre doğrulanmamış (bilinen açık) |

## 5. Varsayımlar
- Prod ortamının DigitalOcean App Platform + GHA cron olduğu, ofelia'nın yalnız self-host compose için olduğu **koddaki yorumlardan** (cron.yml:5-9) çıkarılmıştır.
- GitHub Actions zamanlanmış işlerinin dakika düzeyinde gecikmesi GitHub'ın belgelenmiş davranışıdır; Y2'nin gerçek atlama oranı yük durumuna bağlıdır (en kötü durumda starvation, tipik durumda 5-10× seyrelme).
- `.next/` build çıktılarının varlığına dayanarak D2'deki route-export deseninin mevcut Next sürümünde derlendiği kabul edilmiştir.
- Mobil `es.json` varlığı US-English kapsam kararıyla çelişiyor görünse de bu raporun kapsamı dışında bırakılmıştır (cross-layer değil).
