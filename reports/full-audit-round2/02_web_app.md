# SCOPE 2 — Web App (Authenticated) Tam Denetim Raporu (Round 2)
Tarih: 2026-06-11 · Denetçi: otomatik tam-yığın denetim ajanı · Girdi: YALNIZCA kod/şema/route/test dosyaları (önceki rapor/MD dosyaları okunmadı)

## Gezilen Modül Haritası
- **Auth çekirdeği**: `apps/web/src/lib/user-auth.ts` (969 satır, JWT+DB oturum+fingerprint), `lib/password-login.ts`, `lib/user-jwt-secret.ts`, `lib/user-step-up.ts`, `lib/api-gates.ts`, `src/middleware.ts` (CSRF/rate-limit/IP-block/CSP/noindex)
- **Auth route'ları**: `api/auth/login`, `register`, `logout`, `me`, `verify-email`, `password/reset/request`, `password/reset/confirm`, `mfa/setup|confirm|disable`, `oauth/google/callback`
- **Mobil auth köprüsü**: `api/mobile/auth/exchange` (PKCE), `lib/mobile-oauth` çağrıları, `password-login` paylaşımlı handler
- **Onboarding**: `app/onboarding/page.tsx` (+ ob-coach/ob-cta bileşenleri tespit edildi), `api/onboarding/progress`, `api/onboarding/briefing` (AI brifing + günlük bütçe/cache)
- **Dashboard kartları**: `api/maps/static` (Static Maps proxy + LRU), `api/addresses/[id]/dossier` (7 kaynaklı dossier + plan gating), briefing API
- **Adresler**: `api/addresses` (GET/POST), `api/addresses/[id]` (GET/PATCH/DELETE, primary devri + cascade soft-delete), `api/addresses/validate` (USPS), `api/address-autocomplete` (+cost-controls), `lib/validators.ts`
- **Servisler/Sağlayıcılar**: `api/services`, `api/services/[id]`, `api/providers/[id]`, `api/providers/popular` (k-anonimlik), `api/providers/recommendations` (+FCC/OpenEI zenginleştirme), `recommendations/feedback`, `api/custom-providers`
- **Taşınma**: `api/moving` (GET/POST + eşzamanlı plan limiti), `api/moving/[id]` (durum makinesi), `api/moving/migration`, `api/move-tasks` (atama + yaşam döngüsü)
- **Bütçe/Export**: `api/budget`, `api/budget/actuals` (ServiceCostLog), `api/export` (step-up + CSV/JSON + tax), `lib/user-step-up.ts`
- **Workspace**: `lib/workspace-context.ts`, `lib/workspace-data-scope.ts`, `api/workspaces/[id]/invitations`, `members/[memberId]` (rol/durum/silme), `transfer` (step-up'lı), `api/invitations/[token]/accept`, `api/invitations/pending/[id]/accept`
- **Bildirimler**: `api/notifications` (tercihler), `api/notifications/feed/[id]`, `api/push/register`, `api/unsubscribe` (HMAC tek-tık), `api/tracking/event` (PII süzgeci)
- **Cron'lar (24 route)**: tamamında `guardCronRequest` doğrulandı (grep ile); `task-reminders` ve `lifecycle-nudges` satır satır okundu; `cron-guard.ts` incelendi
- **Altyapı**: `lib/db.ts` (soft-delete extension + rawPrisma), `lib/rate-limit.ts`/`rate-limit-policy.ts` (kısmen), `lib/client-ip.ts`

## Bulgular Tablosu (Kritik+Yüksek önce)

| Katman | Önem | Bulgu | Neden sorun | Önerilen çözüm | dosya:satır |
|---|---|---|---|---|---|
| Auth/MFA | **Yüksek** | MFA kapatma yalnızca parola istiyor; TOTP/yedek kod istenmiyor | Parolası çalınan (phishing/stuffing) bir hesapta saldırgan oturum + parola ile MFA'yı kapatıp hesabı tamamen ele geçirir; MFA'nın koruma amacını boşa çıkarır | `mfa/disable`'a MFA etkinse geçerli `mfaCode` veya `backupCode` zorunluluğu ekleyin (parola + TOTP) | `apps/web/src/app/api/auth/mfa/disable/route.ts:55-63` |
| Middleware/Cron | **Yüksek** | Cron ön-rate-limit anahtarı kimliksiz ve global: `rl:cron:${pathname}` limit 1/60sn — saldırgan istekleri de sayacı tüketiyor | Kimliksiz bir saldırgan her `/api/cron/*` yolunu dakikada 1 kez GET'leyerek (auth'a hiç gelmeden middleware'de sayaç yakar) gerçek zamanlayıcının çağrısını 429'a düşürebilir → hatırlatma/digest/reconcile cron'larının sessiz DoS'u | Sayaç anahtarına IP ekleyin veya limiti yalnızca `x-cron-secret`/`authorization` başlığı TAŞIYAN isteklere uygulayın; route içindeki `guardCronRequest` zaten leaked-secret savunması sağlıyor | `apps/web/src/middleware.ts:293-311` |
| Middleware/IP | **Yüksek** | IP engelleme (`checkIPAccess`) ve genel limit anahtarları XFF'in **ilk** hop'unu kullanıyor | DO/proxy arkasında `x-forwarded-for`'un ilk değeri istemci kontrolündedir (LB kendi gördüğünü sona ekler): engellenen IP sahte XFF ile bloklisti atlar, rate-limit anahtarlarını kirletir (başkasının "IP"sine ceza yazdırma dahil) | Güvenilen hop sayısına göre sağdan seçim yapın (rightmost-trusted) veya yalnızca platform başlığına (`cf-connecting-ip`/`x-real-ip`, LB set ediyorsa) güvenin; `client-ip.ts`'teki öncelik middleware'e de uygulanmalı | `apps/web/src/middleware.ts:748-752`; karş. `apps/web/src/lib/client-ip.ts:23-31` |
| Auth/Step-up | Orta→Yüksek sınırı | Step-up (veri export, workspace transfer) MFA etkin kullanıcıda **yalnızca parola** ile geçiyor; ayrıca OAuth (Google/Apple) girişi MFA'yı tamamen atlıyor | Oturum + parola bilen saldırgan tüm hesabı export edebilir / workspace devredebilir; MFA'lı kullanıcı için adım yükseltme "MFA" değil. OAuth girişinde `createUserSession` MFA sorgusuz | `verifyUserStepUp`: `user.mfaEnabled` ise parola yolunu kapatıp TOTP/backup zorunlu kılın; OAuth callback'te MFA'lı kullanıcı için ara MFA challenge sayfası değerlendirin | `apps/web/src/lib/user-step-up.ts:47-49`; `apps/web/src/app/api/auth/oauth/google/callback/route.ts:219-235` |
| Moving | Orta | `/api/moving/migration` workspace scope'suz: `plan.userId !== userId → 404` | Paylaşılan workspace'te başka üyenin (veya sahibin) planı için migration analizi 404 döner; `moving/[id]` GET aynı planı gösterirken migration sekmesi kırılır — tutarsız yetkilendirme modeli | `resolveWorkspaceDataScope` + `scopedRecordWhere` kullanın (diğer moving route'larıyla aynı kalıp) | `apps/web/src/app/api/moving/migration/route.ts:44-54` |
| Validasyon | Orta | Tarih alanları serbest string: `startDate`, `endDate`, `moveDate`, `contractEndDate` zod'da format kontrolsüz; route'lar `new Date(str)` çağırıyor | `"abc"` gibi değer Invalid Date üretir → Prisma fırlatır → 500 (doğru hata sözleşmesi yerine); `moving/[id]` PATCH `moveDate` da aynı | Zod'a `.refine(v => !Number.isNaN(Date.parse(v)))` veya `z.string().datetime()`/regex ekleyin | `apps/web/src/lib/validators.ts:47-48,123,78`; `apps/web/src/app/api/moving/[id]/route.ts:93` |
| Tracking | Orta | `tracking/event` gövdedeki `sessionId`'yi sahiplik doğrulamadan yazıyor; `event` adı serbest string | Kullanıcı başka kullanıcının `UserSession` satırına event iliştirebilir (analitik veri bütünlüğü bozulur) ya da geçersiz FK 500 üretir; uydurma event adları funnel raporlarını kirletir | sessionId'nin `userId`'ye ait olduğunu doğrulayın (veya alanı yok sayın); event adlarını allowlist'leyin | `apps/web/src/app/api/tracking/event/route.ts:61-66,98-107` |
| Export | Orta | Genel CSV düzleştirici `\n` içeren değerleri quote'lamıyor (yalnız `,` ve `"` kontrol ediliyor) | moveTask `description`/`reason`, support mesaj içeriği gibi çok satırlı alanlar CSV satırlarını bozar (Excel'de kayık kolonlar); tax bölümünde düzeltilmiş, genel yolda unutulmuş | `v.includes("\n")` koşulunu da quote tetikleyicisine ekleyin | `apps/web/src/app/api/export/route.ts:698-704` (karş. doğru hali :639) |
| Middleware | Orta | `/api/address-autocomplete` middleware'de public prefix ("landing-page feature") ama route `requireDbUserId` ile 401 dönüyor | Ölü istisna: ya landing-page autocomplete gerçekten kırık (anonim 401 alır) ya da gereksiz geniş bir public istisna duruyor — iki dünyanın kötüsü | Landing kullanım gerçekse route'a anonim+sıkı-rate-limit yol açın; değilse prefix'i PUBLIC listeden çıkarın | `apps/web/src/middleware.ts:78`; `apps/web/src/app/api/address-autocomplete/route.ts:26` |
| Workspace | Orta | Davet kabulü (token yolu) `getUserSession` ile — e-posta DOĞRULANMAMIŞ hesap da kabul edebiliyor; `pending/[id]` yolu ise `requireVerifiedUser` istiyor | İki kabul yolunun güven seviyesi farklı; token mailbox kanıtı sayılsa da, davet e-postası adresine kayıtlı ama doğrulanmamış bir hesapla (token'ı ele geçiren biri) üyelik mümkün — tutarlılık için doğrulama istenmeli | Token yoluna da `requireVerifiedUser` (veya en azından emailVerifiedAt) şartı ekleyin | `apps/web/src/app/api/invitations/[token]/accept/route.ts:18-29` |
| Cron/Ölçek | Düşük | `task-reminders` `take: 500` sabit tavan; 500+ aday görevde fazlası sessizce atlanır (sayfalama yok) | Ölçek büyüyünce bazı kullanıcılar hatırlatma almaz, hata/metrik de üretilmez | Cursor'lı sayfalama veya en azından `processed === take` iken uyarı logu | `apps/web/src/app/api/cron/task-reminders/route.ts:96,118` |
| Auth | Düşük | `register` 409 "Account already exists" — e-posta numaralandırma sinyali (forgot-password generic iken) | Kayıt formu üzerinden hesap varlığı sorgulanabilir (yaygın bir kabul, ama reset akışındaki özenle çelişiyor) | Aynı kalmasına bilinçli karar verildiyse not düşün; istenirse "doğrulama e-postası gönderildi" tarzı nötr yanıt + mevcut hesaba bilgilendirme maili | `apps/web/src/app/api/auth/register/route.ts:127-132` |
| Bildirim | Düşük | `notifications` POST gövde boyutu/anahtar sayısı sınırsız (`body[definition.key]` dışındaki alanlar yok sayılıyor — risk düşük) | Sadece tanımlı anahtarlar işleniyor; pratik risk yok, fakat zod'suz gövde okuma kalıbı diğer route'lardan ayrışıyor | Kozmetik: zod şemasına geçirin | `apps/web/src/app/api/notifications/route.ts:34-68` |
| UI/Export | Düşük | Export `Content-Disposition` dosya adı sabit ve güvenli; ancak JSON export'ta `movingPlans` `include` ile iç ID'ler (fromAddressId vs.) sızıyor — PII değil, kozmetik | Veri taşınabilirliği için zarar yok; tutarlılık için select'e geçilebilir | `select` kullanın | `apps/web/src/app/api/export/route.ts:283-291` |
| Maps proxy | Düşük | `maps/static` LRU 64 kayıt/instance — çok kullanıcılı yoğunlukta hit oranı düşük kalır; ayrıca `Cache-Control: private` doğru | Maliyet koruması rate-limit'e dayanıyor (60/dk/kullanıcı) — kabul edilebilir | Gerekirse LRU'yu büyütün / Redis'e taşıyın | `apps/web/src/app/api/maps/static/route.ts:163-165` |

## 5-Soru Karnesi (alt alan bazında)

### 1) Auth (register/login/MFA/OAuth/reset/verify/logout + middleware/session + mobil köprü)
1. **Uçtan uca çalışıyor mu?** Evet. Login → lockout → MFA → session (JWT+DB satırı+UA-fingerprint) → logout zinciri eksiksiz; reset/verify token'ları hash'li, tek kullanımlık ve transaction'lı claim ediliyor (`password/reset/confirm/route.ts:81-101`). Mobil köprü PKCE'li exchange koduyla temiz (`mobile/auth/exchange/route.ts:41-66`).
2. **Mantıksızlık?** OAuth girişi MFA'yı atlıyor (yukarıda); `invitations/[token]/accept` ile `pending/[id]/accept` arasındaki doğrulama farkı.
3. **Eksik?** MFA disable'da TOTP şartı; step-up'ta MFA-öncelikli politika.
4. **Bug/açık?** Yüksek: MFA disable parola-yalnız. Timing-eşitleme (`equalizePasswordTiming`), backup-code CAS tüketimi (`password-login.ts:340-344`), fingerprint legacy geçişleri örnek seviyesinde sağlam.
5. **İyileştirme:** Login yanıtına `mfaEnabled` alanını sızdırmamak (başarılı girişte sorun değil); session listesinde `lastActivity` zaten güncelleniyor — iyi.

### 2) Middleware / CSRF / rate-limit
1. Çalışıyor; CSP nonce + strict-dynamic, HSTS, body-size, content-type zorlaması iyi kurulmuş.
2. Cron ön-limit anahtarı kimliksiz (Yüksek, yukarıda); XFF ilk-hop güveni (Yüksek).
3. Eksik: `RATE_LIMIT_SHADOW_USER_KEYED` kapalı — kullanıcı-anahtarlı limit hâlâ gölgede.
4. CSRF: JSON content-type + sec-fetch-site/Origin zinciri sağlam; logout istisnaları dar tutulmuş.
5. İyileştirme: `PUBLIC_API_PREFIXES`'i yıllık gözden geçirme listesine alın (autocomplete örneği).

### 3) Onboarding (page + steps + drafts + coach + briefing API)
1. Çalışıyor; `progress` event'leri idempotent (önce findFirst sonra create — teorik olarak çift yazım yarışı var ama UserEvent'te unique yok, zararsız çift satır).
2. `onboarding/progress`'te aynı event için iki eşzamanlı istek çift satır yaratabilir (`route.ts:62-76`) — analitik gürültüsü, Düşük.
3. Eksik yok; briefing API günlük AI bütçesi (3/gün), UTC-gün cache, plan gating ve fallback'iyle örnek tasarım (`onboarding/briefing/route.ts:66-94,279-307`).
4. Açık yok; `configured:false` anahtar yokken doğru dönüyor.
5. İyileştirme: briefing cache instance-yerel — çok-instance dağıtımda bütçe instance başına 3'e çıkar; Redis'e taşınabilir.

### 4) Dashboard kartları (briefing, route-map/maps proxy, dossier, alerts)
1. Çalışıyor; maps proxy anahtarı asla sızdırmıyor, hata durumları istemcide stylize canvas'a düşüyor.
2. Tutarsızlık yok.
3. Eksik: yok (dossier bölümleri tek tek degrade oluyor; telemetri var).
4. Açık yok — dossier'de scope assert + plan gating + 404-önce-403-yok kalıbı doğru (`dossier/route.ts:154-175`).
5. İyileştirme: dossier'de 7 dış çağrı sıralı `allSettled` — toplam gecikme için per-lookup timeout zaten lib'lerde; yeterli.

### 5) Adresler (CRUD + autocomplete + USPS validate + dossier gating)
1. Çalışıyor; primary devri + servis/bütçe cascade'i transaction'lı (`addresses/[id]/route.ts:246-265`).
2. Tutarsızlık: yok denecek düzeyde.
3. Eksik: tarih string validasyonu (Orta, tabloda).
4. Açık yok: her okuma/yazma `assertScopedRecordAction`/`scopedRecordWhere`'den geçiyor; `formattedAddress` şifreleniyor.
5. İyileştirme: PATCH'te `isPrimary:false` gönderilince kullanıcı primary'siz kalabilir (yalnız DELETE yolunda devir var) — düşük öncelikli UX bekçisi eklenebilir.

### 6) Servisler + sağlayıcılar + öneriler (+feedback/popülerlik tabanları) + custom providers
1. Çalışıyor; duplicate-guard, plan limitleri, AUTH-015 redaksiyonu (rol bazlı hassas alan gizleme) uygulanmış.
2. Tutarsızlık yok; `providers/popular` k-anonimlik (K=20, taban=5) doğru uygulanmış (`popular/route.ts:82-117`).
3. Eksik: `services` GET araması MySQL collation'a dayalı case-insensitive — bilinçliyse sorun değil.
4. Açık yok; `recommendations/feedback` provider varlığını doğruluyor, upsert per-(user,provider).
5. İyileştirme: öneri motoru sorgusu eyalet başına 1000 sağlayıcı tavanıyla sınırlandırılmış — iyi; FCC/OpenEI zenginleştirme degrade-safe.

### 7) Taşınma planları + move-tasks + migration + hatırlatmalar + yaşam döngüsü cron'ları
1. Çalışıyor; durum makinesi (PLANNING→IN_PROGRESS→COMPLETED/CANCELED) zorlanıyor, iptalde CLASSIFIER görevleri emekliye ayrılıyor (`moving/[id]/route.ts:114-133`).
2. Tutarsızlık: migration route'unun workspace körlüğü (Orta, tabloda).
3. Eksik: tarih validasyonu.
4. Açık yok; move-task ataması hedefin AYNI workspace'in ACTIVE üyesi olmasını doğruluyor (`move-tasks/route.ts:298-323`).
5. Cron'lar: 24/24 `guardCronRequest`'li; `task-reminders` timezone-bilinçli (yerel ~08:00 kapısı + UTC date-only matematiği) ve dedupe-key'li; `lifecycle-nudges` davranış tetikli, at-most-once. İyileştirme: `take:500` tavanları (tabloda).

### 8) Bütçe/harcamalar + export (csv/pdf + step-up)
1. Çalışıyor; aylık actuals `ServiceCostLog` üzerinden ay-başına gerçek değer, snapshot tazeleme dahil.
2. Tutarsızlık yok; legacy scalar mirror yalnız cari ayda güncelleniyor — doğru.
3. Eksik: CSV `\n` quote'u (Orta, tabloda).
4. Açık yok: export step-up + rate-limit + audit + maskleme (hesap no/telefon/e-posta) + CSV formula-injection koruması var; `includeNotes` opt-in.
5. İyileştirme: step-up'ı MFA-öncelikli yapmak (tabloda).

### 9) Workspaces (davet/üye/rol/transfer/purge)
1. Çalışıyor; davet akışı Serializable transaction + seat sayımı + süre dolmuş PENDING'leri sayma kuralı tutarlı (`invitations/route.ts:109-138`).
2. Tutarsızlık: token-accept'te verified şartı yok (tabloda).
3. Eksik: yok — suspend/reactivate, OVERFLOW reconcile, owner bildirimleri, audit hepsi mevcut.
4. Açık yok: caller-üyelik 404 (varlık sızdırmama), `can()` matris kontrolü her dalda; transfer step-up'lı.
5. İyileştirme: davet rate-limit'i `ws-invite:${id}` — workspace başına 5/saat; birden çok admin paylaşıyor, bilinçliyse uygun.

### 10) Bildirimler + push + unsubscribe + tracking
1. Çalışıyor; feed işaretleme userId kontrolü ile; push token cihaz-bazlı el değiştirme upsert'i bilinçli tasarım.
2. Tutarsızlık yok; unsubscribe HMAC token + RFC 8058 tek-tık + redirect akışı doğru.
3. Eksik: tracking `sessionId` sahiplik kontrolü (Orta, tabloda).
4. Açık yok; tracking metadata PII süzgeci (anahtar regex + e-posta/uzun-rakam değer filtresi) sağlam.
5. İyileştirme: `notifications` POST zod'a geçirilebilir.

## Varsayımlar
- DB MySQL (`packages/db/prisma/schema.prisma:6`); `contains` aramaları varsayılan collation ile case-insensitive kabul edildi.
- Soft-delete extension'ın `SOFT_DELETE_MODELS` listesinin Address/Service/Budget/MovingPlan/MoveTask'ı kapsadığı `lib/db.ts` dokümantasyonuna dayanarak varsayıldı; `providers/popular`'daki `address.findMany` bu sayede silinmiş adresleri dışlıyor kabul edildi.
- Apple OAuth callback'i Google ile aynı kalıbı izlediği için satır satır okunmadı (route varlığı + CSRF istisnası middleware'de doğrulandı).
- PDF export (`api/export/pdf`) ve dossier PDF'i, ana export'la aynı step-up kalıbını kullandığı varsayıldı (test dosyaları mevcut; süre kısıtı nedeniyle gövde okunmadı).
- Üretimde Upstash limiter'ın yapılandırıldığı varsayıldı (cron DoS bulgusu bu varsayıma dayanır; limiter yoksa middleware cron limiti zaten devre dışı kalır ve bulgu geçersizleşir — ama o zaman da koruma yoktur).

## Modül Sağlık Özeti
- **Auth çekirdeği: 9/10** — Sınıfının en iyisi oturum/parola/reset hijyeni; tek ciddi delik MFA-disable ve step-up'ın parola-yalnız kabulü.
- **Middleware: 7/10** — CSP/CSRF/body-size güçlü; cron ön-limit anahtarı ve XFF ilk-hop güveni düzeltilmeli.
- **Adres/Servis/Bütçe CRUD: 9/10** — Tutarlı scope kalıbı (`assertScopedRecordAction`), IDOR bulunamadı; tarih validasyonu eksik.
- **Öneri/Dossier/Briefing: 9/10** — Degrade-safe, plan-gating'li, telemetrili; örnek alınacak tasarım.
- **Taşınma/Görevler: 8/10** — Durum makinesi + cascade'ler doğru; migration route'u workspace'e uyarlanmalı.
- **Workspace: 9/10** — Roller, koltuk, audit, step-up tamam; davet kabul yollarında doğrulama tutarlılığı.
- **Bildirim/Tracking: 8/10** — PII süzgeci ve dedupe altyapısı iyi; tracking sessionId sahipliği açık.
- **Cron katmanı: 8/10** — 24/24 guard'lı, timezone-bilinçli, dedupe'lu; middleware-katmanı DoS riski ve `take` tavanları dışında temiz.

**Genel:** Kritik bulgu YOK. 3 Yüksek (MFA-disable, cron ön-limit DoS, XFF güveni) + 1 Yüksek-sınırı (step-up/OAuth MFA bütünlüğü). Kod tabanı genel olarak olağanüstü disiplinli: her route'ta userId scoping, soft-delete bilinci, dedupe anahtarları ve degrade-safe dış çağrılar standartlaşmış.
