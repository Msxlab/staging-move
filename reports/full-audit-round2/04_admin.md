# SCOPE 4 — ADMIN APP DENETİMİ (Round 2)

Denetlenen kod tabanı: `apps/admin` (Next.js App Router, Edge middleware + Node route handlers, Prisma).
Yalnızca kod/şema/config/route/test dosyaları okundu; hiçbir `.md`/rapor/memory dosyası girdi olarak kullanılmadı.

## Yürünen modül haritası (gerçekten okunan dosyalar)

**Auth çekirdeği**
- `src/middleware.ts` (IP kuralları, break-glass bypass, CSRF, body-size, rate-limit, CSP nonce, mustChangePassword + MFA gate, fingerprint)
- `src/lib/auth.ts` (session JWT, `requireAdmin/requireRole/requirePermission/checkPermission`, `requirePasswordConfirm` step-up + MFA + backup-code, lockout)
- `src/lib/page-guard.ts` (`requirePageRole/requirePagePermission/requirePageAdmin`, fail-closed permission map)
- `src/lib/admin-permissions.ts` (kaynak/rol matrisi), `src/lib/admin-roles.ts` (MFA zorunluluğu), `src/lib/ip-rules.ts`, `src/lib/admin-action-otp.ts`, `src/lib/audit.ts`, `src/lib/internal-secrets.ts`, `src/lib/pagination.ts`, `src/lib/hard-delete-user.ts`
- Auth route'ları: `login`, `logout`, `me`, `sessions`, `password`, `force-password-change`, `set-password`, `mfa/{setup,verify,disable}`, `login-history`

**Sayfa guard taraması:** tüm `(admin)/**/page.tsx` için `requirePage*` kullanımı tarandı (aşağıda).

**API mutasyon route'ları (her birinin guard+step-up sayımı çıkarıldı, kritik olanlar okundu):** users (`route`, `[id]`, `[id]/hard-delete`, `[id]/hard-delete/otp`, `[id]/impersonate`, `export`), subscriptions (`refund`, `cancel`, `change-plan`, `resync`, `revalidate`), team (`route`, `[id]`), providers (`route`, `[id]`, `bulk`, `merge`), provider-governance, email-templates, help-center, feature-flags, runtime-config, notifications, security, backup (`route`, `import`, `retention`), connector-fallbacks, blog/posts, tickets/[id], waitlist, internal (`ip-rules`, `security-event`), logs, reports.

**Varsayımlar:** (1) `prisma` = soft-delete uzantılı istemci, `prismaUnsafe/rawPrisma` = ham istemci (kod yorumlarıyla doğrulandı). (2) Web/mobil tüketici render davranışı için `apps/web` bileşenleri spot-kontrol edildi (help içeriği + notification href). (3) `redactAuditPayload` paylaşılan paketteki davranışı doğru kabul edildi.

---

## Bulgular tablosu (Kritik + Yüksek önce)

| Katman | Önem | Bulgu | Neden sorun | Önerilen çözüm | dosya:satır |
|---|---|---|---|---|---|
| Notifications | **Yüksek** | Admin bildirim `href` alanı yalnızca `z.string().max(500)` ile doğrulanıyor; şema/yol kontrolü yok. Web feed bunu `<Link href={notif.href}>` ile render ediyor. | `javascript:` / `data:` href → tüm son kullanıcıların tarayıcısında stored-XSS; `http://evil` → açık yönlendirme. ADMIN `settings.canCreate` yetkisiyle (broadcast IN_APP'te step-up bile yok) tetiklenebilir. | href'i `/^\/[^/]/` (göreli) veya `https?://allowedHost` allowlist'ine zorla; `javascript:`/`data:`/`vbscript:` reddet. | `app/api/notifications/route.ts:54-63,367-379` + tüketici `apps/web/src/components/layout/notification-center.tsx:216-217` |
| Email-templates | **Yüksek** | POST/PUT/DELETE'in hiçbiri `requirePasswordConfirm` (step-up/MFA) çağırmıyor — yalnızca `requirePermission("settings", …, ADMIN)`. | Bu şablonlar `password-reset`, `email-verify`, `payment-failed` gibi TÜM kullanıcılara giden güvenlik e-postaları. Ele geçmiş/grace-içi ADMIN oturumu, parola sıfırlama e-postasındaki bağlantıyı oltalama linkiyle değiştirebilir; runtime-config/feature-flags/notifications-broadcast step-up isterken bu yüzey istisna. | Mutasyonlara `requirePasswordConfirm({ requireMfa: true, operation: "email_template_write" })` ekle (feature-flags ile aynı kalıp). | `app/api/email-templates/route.ts:169-213,215-260,262-291` |
| Team yönetimi | Orta | `PATCH /api/team/[id]` e-posta/ad değişimini "sensitive" saymıyor: step-up yok, oturum iptali yok ve **e-posta için benzersizlik ön-kontrolü yok** → çakışmada Prisma P2002 generic `catch` ile 500 döner (409 değil). | Düşük-rollü bir admin'in login e-postasını yeniden-auth olmadan değiştirmek hesap-devralma yüzeyi; ayrıca yanıltıcı 500. | `email`'i de `isSensitiveChange`'e dahil et; update öncesi `findUnique({where:{email}})` ile 409 döndür. | `app/api/team/[id]/route.ts:106-113,170-209` |
| Audit/PII | Orta | Birden çok mutasyon merkezi `writeAdminAudit` (redaksiyonlu) yerine ham `prisma.adminAuditLog.create` kullanıp `changes`'a düz-metin PII yazıyor (waitlist `email`; provider-governance yerel yazıcı action'ı 20 karaktere kesip redaksiyon yapmıyor). | `redactAuditPayload` garantisi atlanıyor → AdminAuditLog'da düz e-posta at-rest; GDPR/forensics tutarsızlığı. | Bu route'ları `writeAdminAudit`'e taşı; ham `create` kullanımlarını kaldır. | `app/api/waitlist/route.ts:121-135`; `app/api/provider-governance/route.ts:55-65,298-346`; `app/api/providers/route.ts:316-325,397-406`; `app/api/blog/posts/route.ts:133-142`; `app/api/tickets/[id]/route.ts:218-226,309-318` |
| Help-center | Orta | POST/PUT/DELETE'te step-up yok; ayrıca `content` (max 200k) at-rest sanitize edilmiyor (blog/email-templates ediliyor). | İçerik adım-yetkisi olmadan yazılabilir. (Web `help-center-content.tsx` `{article.content}` ile escape ederek render ettiğinden bugün XSS değil — yalnızca derinlik savunması açığı.) | Mutasyonlara step-up ekle; içeriği yazımda sanitize et veya render'ın escape ettiğini test sabitle. | `app/api/help-center/route.ts:68-131,133-193,195-231` |
| Notifications | Orta | Tek-kullanıcı gönderiminde hedef `userId` varlık kontrolü yok; EMAIL/PUSH tek gönderim step-up'sız. | Geçersiz `userId` → FK P2003 → generic 500; hedefli e-posta yeniden-auth gerektirmiyor. | Göndermeden önce `user.findUnique` doğrula (404); tek EMAIL/PUSH için de step-up değerlendir. | `app/api/notifications/route.ts:363-393` |
| Reports/Perf | Orta | `reports` overview, tarih aralığındaki TÜM kullanıcıları `findMany(select createdAt)` ile belleğe çekip günlük kovalama yapıyor (sınırsız). | Ölçekte bellek/gecikme riski; `take` yok. | Ham SQL `GROUP BY date(createdAt)` veya raw `$queryRaw` ile gün-bazlı sayım yap. | `app/api/reports/route.ts:40-42` |
| Waitlist | Orta | GET `take:500` sabit, sayfalama yok; `total: signups.length` gerçek toplam yerine sayfa boyutunu döner; e-posta araması `toLowerCase` ile yapılıp DB'deki karışık-case ile eşleşmeyebilir. PATCH eksik id'de P2025 → 500 (404 değil). | Yanıltıcı toplam + ölçek riski + UX (arama kaçırma) + yanlış durum kodu. | Sayfalama ekle; `summary.totalAll`'ı `total` olarak kullan; case-insensitive arama; PATCH'te varlık kontrolü (404). | `app/api/waitlist/route.ts:46-50,75,43,111-119` |
| Users/Perf | Orta | Liste GET her kullanıcı için TÜM `services`'i (`select personalReview`) çekip not sayıyor. | Çok hizmetli kullanıcılarda sayfa başına büyük veri; gizli N+ benzeri yük. | `_count` + `where personalReview != null` filtreli sayım kullan, satırları çekme. | `app/api/users/route.ts:104,119-123` |
| Auth/Lifecycle | Düşük | `mfa/disable` MFA-zorunlu rolün (ADMIN/SUPER_ADMIN) kendi MFA'sını step-up ile kapatmasına izin veriyor; oturum iptal ediliyor ama sonraki login'de middleware tekrar zorunlu kılıyor. | Kısa süreli "MFA'sız" pencere kavramsal; pratikte yeniden-enrol zorlanıyor. Bilgilendirme amaçlı. | Davranış kabul edilebilir; istenirse zorunlu-rolde disable'ı tamamen engelle. | `app/api/auth/mfa/disable/route.ts:36-57` |
| Help-center | Düşük | DELETE `await req.json()` `catch`'siz → gövdesiz istek 500. | Tutarsız hata; diğer metotlar `catch(() => null)` kullanıyor. | `.catch(() => ({}))` ekle. | `app/api/help-center/route.ts:198` |
| Audit/Perf | Düşük | Salt-okuma list/detay GET'leri her çağrıda audit satırı yazıyor (USER_LIST_VIEWED, USER_DETAIL_VIEWED, AUDIT_LOGS_VIEWED). | Append-only tabloda yazma amplifikasyonu; logs sayfasının kendisini büyütür. | Okuma-audit'ini örnekleme/debounce ile sınırla. | `app/api/users/route.ts:143`; `app/api/users/[id]/route.ts:556`; `app/api/logs/route.ts:201,270` |

---

## Alt-alan başına 5-soru değerlendirmesi

### Auth (login / MFA / sessions / step-up / OTP / break-glass / middleware IP)
1. **Uçtan uca çalışıyor mu?** Evet. JWT (8h) + DB `AdminSession` çift kayıt; `getSession` token-hash'i aktif satırla eşleştiriyor, süre/sahip uyuşmazlığında satırı pasifleştirip cookie temizliyor. `requireAdmin` isActive, `requireRole` rolü DB'den taze okuyor (SEC-005). Login rate-limit (Redis fail-closed, in-mem fallback) + MFA rate-limit ayrı.
2. **Mantıksızlık/tutarsızlık?** Step-up grace 10dk, secret/key-rotation 2dk — tutarlı. MFA yalnızca ADMIN/SUPER_ADMIN için zorunlu; düşük roller için step-up yine her yıkıcı işlemde geçerli (mantıklı, belgeli).
3. **Eksik?** Email-templates mutasyonlarında step-up eksik (Yüksek, yukarıda). `set-password` token POST'unda özel hız sınırı yok (genel admin_write 90/dk'ya tabi) — token entropisi yüksek olduğundan düşük risk.
4. **Bug/güvenlik açığı?** Auth çekirdeğinde bypass bulunamadı: middleware DB'siz JWT doğruluyor, isActive/role API katmanında yeniden doğrulanıyor; fingerprint mismatch hijack event'i + cookie temizliği; break-glass yalnızca `/login,/api/auth/login,/api/healthz` için IP-deny'i atlıyor ve event yazıyor. `hashSessionToken` SHA-256, OTP HMAC + timing-safe + tek-kullanım + atomik deneme sayacı (hard-delete).
5. **İyileştirme:** Email-templates step-up; `set-password` POST'a hedefli rate-limit; opsiyonel olarak fingerprint'i sessionId'ye de bağla.

### Roller/izinler — her sayfada `requirePage*` ve her route'ta mutasyon guard'ı
1. **Çalışıyor mu?** Evet. Sayfa guard taraması: gizli/yetkili sayfaların tümü `requirePageRole/requirePagePermission` çağırıyor (runtime-config → `SUPER_ADMIN`; backups/security/feature-flags/email-templates/notifications/logs → `settings`/`audit_logs` ADMIN; users/moving/insights → VIEWER). Guard'sız görünen `page.tsx`'ler ya client component (API katmanı yetkilendiriyor) ya alias redirect (`tickets→support`) ya da public (`login`, `set-password`).
2. **Tutarsızlık?** `checkPermission` fail-closed (satır yoksa reddet, yalnızca SUPER_ADMIN short-circuit) ve `page-guard` aynı kuralı yansıtıyor — tutarlı.
3. **Eksik?** Yok denecek kadar az; izin matrisi tek kaynaktan (`admin-permissions.ts`) hem seed hem create yollarına uygulanıyor; `team/[id]` PATCH 64-satır matris doğrulayıcısı tam.
4. **Bug?** Mutasyon guard taraması (110 route): tüm yıkıcı/billing route'ları `requirePermission` + uygun `requirePasswordConfirm` taşıyor (users/team/runtime-config/backup/security/subscriptions-refund/hard-delete/impersonate). İstisnalar yukarıda (email-templates, help-center, connector-fallbacks tasarımca step-up'sız ama audit'li).
5. **İyileştirme:** `team/[id]` e-posta değişimini sensitive yap.

### Users modülü (detay / billing override / grant-revoke / hard-delete + Stripe sırası / impersonation)
1. **Çalışıyor mu?** Evet. Detay GET rol-bazlı redaksiyon (`redactUserDetail`, `canSeeRawBillingIds`). PATCH billing kombinasyon doğrulayıcısı + `premiumUntil` set edilince provider→ADMIN auto-flip (entitlement P1-8). Hard-delete iki-fazlı: faz1 OTP (e-posta), faz2 parola+MFA+OTP; cascade'de **Stripe iptali DB silmeden ÖNCE**, başarısızlıkta `force` olmadan bloklanıp HIGH alert + audit (doğru sıralama). Impersonation yalnızca SUPER_ADMIN + step-up + web internal handoff.
2. **Tutarsızlık?** Soft-delete (GDPRRequest kuyruğu) vs hard-delete (anında fiziksel) ayrımı net; restore yalnızca `admin/admin_bulk` kaynaklı DELETE'leri geri alıyor.
3. **Eksik?** Hard-delete no-FK artık temizliği (`waitlistSignup/notificationQueue/emailLog`) eklenmiş — düz e-posta sızıntısı kapatılmış (iyi).
4. **Bug?** Bulunamadı; tüm yollar `prismaUnsafe` ile soft-deleted satırları doğru görüyor, transaction içi `updateMany count` yarış-güvenli.
5. **İyileştirme:** Liste GET'inde hizmet-not sayımını `_count`'a taşı (perf).

### Subscriptions/billing admin
1. **Çalışıyor mu?** Evet. Refund: GET önizleme (VIEWER), POST ADMIN+MFA; fatura sunucu-tarafında abonelik kapsamında yeniden çözülüyor, `expectedAmount` guard'ı + kısmi-tutar `remaining`'e karşı reddediliyor, Stripe idempotency-key tutar-bağlı.
2. **Tutarsızlık?** Yok; START/COMPLETE/FAIL audit + maskelenmiş id'ler.
3. **Eksik?** Yok kayda değer.
4. **Bug/güvenlik?** Cross-müşteri fatura hedeflemesi engellenmiş (number→abonelik scoped).
5. **İyileştirme:** —

### Providers suite + movers
1. **Çalışıyor mu?** Evet. CSV import dosya-meta doğrulaması, çatışma tespiti, transaction'da coverage rebuild. Governance kuyrukları + promote-to-listed.
2. **Tutarsızlık?** providers POST/PUT MODERATOR `canCreate` ister; MODERATOR default providers READ_ONLY olduğundan pratikte ADMIN+ — tutarlı ama gizli (yetki gerçeği rol-floor'la örtüşmüyor).
3. **Eksik?** Provider mutasyonları step-up'sız (yıkıcı değil, revalidate'li) — kabul edilebilir.
4. **Bug?** Governance yerel audit yazıcısı redaksiyonsuz + action 20-char kesik (Orta, tabloda).
5. **İyileştirme:** Governance audit'ini merkezi yazıcıya taşı.

### Content (blog / help-center / email-templates)
1. **Çalışıyor mu?** Evet. Blog içeriği `blog-content.ts` üzerinden tek-huni sanitize (Tiptap→sanitize-html allowlist). Email-templates yazımda `sanitizeEmailHtml/Subject`.
2. **Tutarsızlık?** Help-center içeriği sanitize edilmiyor (render escape ettiği için bugün güvenli) — diğer iki yüzeyle tutarsız.
3. **Eksik?** Email-templates step-up (Yüksek); help-center step-up (Orta).
4. **Bug?** help-center DELETE `req.json()` catch'siz → 500 (Düşük).
5. **İyileştirme:** Step-up paritesi + help içeriği sanitize/test sabiti.

### Comms (notifications broadcast / tickets / support)
1. **Çalışıyor mu?** Evet. Broadcast batched (5k), `BROADCAST_MAX_USERS` cap, EMAIL/PUSH step-up + 30s dedupe + `processedWebhookEvent` claim. Tickets reply/PATCH ADMIN, assignee aktiflik kontrolü, durum e-postaları silinmiş kullanıcıya gitmiyor.
2. **Tutarsızlık?** IN_APP broadcast step-up'sız (geri alınabilir, belgeli).
3. **Eksik?** href doğrulaması (Yüksek); tek-gönderim hedef varlık kontrolü (Orta).
4. **Bug/güvenlik?** href stored-XSS/redirect (Yüksek, tabloda).
5. **İyileştirme:** href allowlist; tek-gönderimde 404.

### Ops (backups / runtime-config / feature-flags / security dashboard / logs facet gating)
1. **Çalışıyor mu?** Evet. Backup create/import SUPER_ADMIN+MFA; import HMAC imza doğrulaması, REPLACE `prismaUnsafe` (soft-delete tuzağı), pre-restore safety backup, restore-lock, admin-identity restore break-glass + son SUPER_ADMIN koruması. runtime-config SUPER_ADMIN+MFA, değer asla yanıtta/audit'te dönmüyor. feature-flags step-up (1h grace). Logs facet gating (page1+filtersiz, 30g pencere) full-tablo taramasını önlüyor; SUPER_ADMIN'e unmasked.
2. **Tutarsızlık?** Yok kayda değer.
3. **Eksik?** Yok kayda değer.
4. **Bug/güvenlik?** Bulunamadı; IP-kural mutasyonları self-lockout guard'lı, broad-range yalnızca SUPER_ADMIN break-glass.
5. **İyileştirme:** —

### Insights / sponsored / affiliate / analytics / reports / acquisition / waitlist / workspaces / team
1. **Çalışıyor mu?** Evet (guard sayımı + okunan örnekler). acquisition-campaigns mutasyonları step-up'lı (5/5). workspaces mutasyonları step-up'lı.
2. **Tutarsızlık?** waitlist `total` semantiği yanlış (Orta).
3. **Eksik?** waitlist sayfalama yok.
4. **Bug?** waitlist PATCH 500-vs-404 (Orta).
5. **İyileştirme:** reports bellek-içi kovalama yerine raw GROUP BY.

---

## Modül sağlık özeti

Admin uygulaması genel olarak **iyi sertleştirilmiş**: fail-closed izin modeli, her yıkıcı işlemde parola+MFA step-up, hard-delete'te ayrıca e-posta OTP + doğru Stripe-iptal sıralaması, imza-doğrulamalı yedek geri-yükleme, self-lockout/break-glass korumaları, rol-bazlı PII redaksiyonu ve CSP-nonce + CSRF + fingerprint katmanları yerinde. **Kritik (auth bypass / yetki atlama) bulunamadı.**

Öne çıkan **Yüksek** düzeltmeler: (1) bildirim `href` şema doğrulaması — feed `<Link>` stored-XSS/açık-yönlendirme; (2) email-templates mutasyonlarında step-up eksikliği — güvenlik e-postası içerik bütünlüğü. Kalan **Orta** bulgular tutarlılık/PII-redaksiyonu/perf-ölçek ve birkaç yanlış-durum-kodu odaklı.
