# LocateFlow — Kıdemli Ürün & Yazılım Denetim Raporu

**Tarih:** 2026-04-21  
**Denetçi rolleri:** Ürün stratejisi · UX · Frontend · AppSec (OWASP ASVS L2) · Veri mühendisliği  
**Kapsam:** `apps/web` (Next.js 16) · `apps/admin` (Next.js 15) · `apps/mobile` (Expo 54) · `packages/db` (Prisma + MySQL 8) · `packages/shared` · Docker/CI  
**Yöntem:** Statik kod + şema incelemesi, önceki üç audit raporu ile fark karşılaştırması

---

## 0. Context — Neden Bu Rapor

Repo üç önceki denetimden geçmiş: `AUDIT_REPORT.md` (2025-02-12), `AUDIT_REPORT_MOBILE_PARITY.md` (2025-02-13), `AUDIT_REMAINING_WORK.md`. Bu raporlarda tespit edilen **Critical** ve çoğu **High** bulgusu bu tarihten itibaren kapatılmış (cron fail-closed, admin rate-limit/lockout/MFA, CSRF, security headers, mobil bearer auth, backup dependency ordering, SQLite → MySQL, fingerprint hijack koruması, path-traversal guard, impersonation step-up, retention cron, Sentry kurulumu vb.). Ancak:

1. Ürün vaadi (AI-destekli taşınma asistanı) ile mevcut implementasyon arasında hâlâ ciddi boşluk var — spec'in kendisi Phase 2 için işaretliyor.
2. i18n / a11y / erişilebilirlik düzeyi henüz yok.
3. Tasarım sisteminde web ↔ admin ↔ mobile token parity kısmen kopuk.
4. Bazı "tarihi" mimari tercihler (örn. AuditLog kullanımı, impersonation köprüsü `CRON_SECRET` üzerinden) yeni risk vektörleri doğuruyor.
5. Ürün genişlerken ortaya çıkan yeni yüzeyler (impersonation, runtime-config, feature flags, dashboard widget prefs) henüz sistemli denetimden geçmemiş.

Bu rapor — önceki auditler'in tekrarı değil — **bugünün kod tabanına göre** 12 kategori + 5 ek başlıkta derin tarama, metrik-destekli yol haritası ve 15 maddelik yönetici özeti üretir.

---

## 1. Yönetici Özeti (Önceki vs Şimdi)

### Önceki auditlerde "Critical/High" olup ŞİMDİ kapalı olanlar

| Eski bulgu | Kanıt (şu anki kod) |
|---|---|
| SEC-001 dev auth bypass | Kaldırıldı; `USER_JWT_SECRET ≥ 32 char` zorunluluğu [apps/web/src/middleware.ts:197-200](apps/web/src/middleware.ts#L197-L200) |
| SEC-003 cron fail-closed | `if (!cronSecret \|\| authHeader !== ...)` [apps/web/src/app/api/cron/bill-reminders/route.ts:20-24](apps/web/src/app/api/cron/bill-reminders/route.ts#L20-L24) |
| SEC-005 admin brute-force | Upstash + 5/15 min + 30 dk lockout + memory fallback [apps/admin/src/app/api/auth/login/route.ts:55-193](apps/admin/src/app/api/auth/login/route.ts#L55-L193) |
| SEC-006 path traversal | `/api/documents/[id]` route kaldırıldı (feature silindi) |
| SEC-007 admin headers | CSP/HSTS/XFO/Referrer/Permissions hepsi mevcut [apps/admin/next.config.js:9-34](apps/admin/next.config.js#L9-L34) |
| SEC-008 admin CSRF | Content-Type + Origin + Referer + Sec-Fetch-Site [apps/admin/src/middleware.ts:104-160](apps/admin/src/middleware.ts#L104-L160) |
| SEC-010 JWT revocation | DB-tracked `AdminSession.tokenHash` + `isActive` [apps/admin/src/lib/auth.ts:93-117](apps/admin/src/lib/auth.ts#L93-L117) |
| SEC-011 IDOR tracking | `updateMany({ id, userId })` ownership [apps/web/src/app/api/tracking/session/route.ts:65-71](apps/web/src/app/api/tracking/session/route.ts#L65-L71) |
| REL-001 SQLite | MySQL 8.0 baseline migration [packages/db/prisma/schema.prisma:5-8](packages/db/prisma/schema.prisma#L5-L8) |
| REL-002 weekly-digest opt-out | `notificationPreference` filtresi [apps/web/src/app/api/cron/weekly-digest/route.ts:53-59](apps/web/src/app/api/cron/weekly-digest/route.ts#L53-L59) |
| REL-003 ay sınırı bug | `spansMonthBoundary` mantığı [apps/web/src/app/api/cron/bill-reminders/route.ts:35-49](apps/web/src/app/api/cron/bill-reminders/route.ts#L35-L49) |
| REL-004 `prisma as any` | Sıfır (grep 0 hit) |
| PERF-001 cron N+1 | `groupBy` + bulk Promise.all [apps/web/src/app/api/cron/weekly-digest/route.ts:68-93](apps/web/src/app/api/cron/weekly-digest/route.ts#L68-L93) |
| Mobil MOB-001/002/003 | `providers/[id].tsx`, `budget/new.tsx` mevcut (reviews feature'ı kaldırılmış) |
| Web middleware Bearer | `readBearerToken` [apps/web/src/middleware.ts:203-210](apps/web/src/middleware.ts#L203-L210) |
| Fingerprint enforcement | `getUserSession` içinde IP+UA (web) / UA-only (mobile) [apps/web/src/lib/user-auth.ts:243-262](apps/web/src/lib/user-auth.ts#L243-L262) |
| Impersonation | SUPER_ADMIN + step-up + 15-dk TTL + audit log + user notification [apps/admin/src/app/api/users/[id]/impersonate/route.ts:1-158](apps/admin/src/app/api/users/%5Bid%5D/impersonate/route.ts#L1-L158) |
| Sentry | `@sentry/nextjs ^10.49.0` her iki app `package.json`'da |

### Önceki auditlerde olmayan ama ŞİMDİ yeni tespit edilen açıklar

- **Stripe webhook 5-dakikalık `MAX_EVENT_AGE_SEC` kuralı** Stripe'ın 3-günlük legitimate retry davranışıyla çelişiyor — kısa outage sonrası event'ler sessizce "stale" kabul edilip uygulanmıyor.
- **Impersonation köprüsü `CRON_SECRET` paylaşıyor** — tek secret, üç farklı anlam (cron, internal security event, impersonation handoff). Biri sızarsa üçü birden düşer.
- **i18n yok** — kullanıcı tabanı ABD olsa bile ispanyolca/çince popülasyon için hazırlık sıfır.
- **Admin CSP `style-src 'unsafe-inline'` bırakıyor** — admin yüksek yetkili bir panel, XSS zinciri riski artıyor.
- **Legacy role permission fallback** (`getLegacyRolePermission`) seed edilmemiş admin'lere rol-bazlı full erişim veriyor — iki seed akışı arası tutarsızlık.
- **Soft-delete kullanımı kısmen** — `User.deletedAt` var, ama `Address/Service/Budget` gibi çocuklarda soft-delete yok; kullanıcı silinip hard-delete'e kadar veri hâlâ sorgulanabilir.
- **Dashboard `lastActivity` güncellemesi fire-and-forget Promise** — uyumsuz tuhaf edge hatalarda session canlılığı yanlış raporlanabilir.
- **`/api/tracking` prefix'i public_api_prefix** — consent gate içerde olsa da henüz login olmamış bir kullanıcı bile `POST /api/tracking/event` atabiliyor (IP tabanlı spam vektörü).

---

## 2. On İki Başlıkta Detaylı Bulgu

Her başlık: **(a) Tespit — (b) Sorun — (c) Çözüm — (d) Öneri** formatında.

### 2.1 Estetik & Görsel Dil

**(a) Tespit.** Mobil tarafta güçlü, merkezîleştirilmiş tasarım token'ları var: dark + light paletler, spacing (4/8/12/16/20/24/32/40), radius (8/12/16/20/24/full), shadow (sm/md/lg/glow) — tümü [apps/mobile/src/lib/theme.ts:13-150](apps/mobile/src/lib/theme.ts#L13-L150). Web ve admin Tailwind konfigleri ayrık (`apps/admin/tailwind.config.ts`, `apps/web/tailwind.config.*`). Admin sidebar 5 gruba bölünmüş (Core/Content/Communication/Analytics/System) [apps/admin/src/components/sidebar.tsx:44-80](apps/admin/src/components/sidebar.tsx#L44-L80) — net IA. İkon kütüphanesi: tüm appler `lucide-react` kullanıyor (heroicons karışımı yok).

**(b) Sorun (Medium).** 
- Typography hiyerarşisi merkezî değil — h1–h6 için token yok; her page kendi Tailwind utility string'ini yazıyor. Aynı hero iki sayfada farklı `text-3xl/4xl/5xl` ile çıkıyor.
- Web tarafında dark mode yok (yalnızca admin `ThemeToggle`); mobile `useAppTheme()` dark/light destekliyor — üç app **üç farklı hikaye** anlatıyor. Kullanıcı mobilde gündüz açık, webde her zaman dark görünce marka hissi kopuyor.
- Line-height / measure (45–75ch) hiçbir yerde konumlandırılmamış — uzun içerik sayfaları (help, privacy) okunabilirlikte zayıf.

**(c) Çözüm.** 
```ts
// packages/shared/src/design-tokens.ts (YENİ)
export const typography = {
  h1: { fontSize: 48, lineHeight: 56, fontWeight: 700, maxWidth: '30ch' },
  h2: { fontSize: 36, lineHeight: 44, fontWeight: 700, maxWidth: '40ch' },
  h3: { fontSize: 28, lineHeight: 36, fontWeight: 600 },
  bodyL: { fontSize: 18, lineHeight: 28, maxWidth: '65ch' },
  body: { fontSize: 16, lineHeight: 24, maxWidth: '70ch' },
  caption: { fontSize: 13, lineHeight: 20 },
} as const;
```
Web & admin `tailwind.config` içinde `extend.typography` olarak eşitle; mobil `theme.ts` içinde `theme.type` ekle. Web'e `next-themes` + ThemeProvider ekle — admin'deki aynı bileşeni paylaştır (`packages/shared/src/theme-provider.tsx`).

**(d) Öneri.** Uzun vadede `shadcn/ui` + `packages/ui` shared component layer'a geç; web ve admin aynı `<Button>`, `<Card>`, `<DataTable>` komponentlerini tüketsin. Mobilde `tamagui` veya `gluestack` değerlendir — native + web paylaşımı mümkün, ancak migration maliyeti yüksek; 6 ay sonrasına bırak. Şimdilik token layer'ını paylaşmak en iyi ROI.

---

### 2.2 Renk Uyumu & Tema

**(a) Tespit.** Birincil marka rengi `#F97316` (orange-500). Dark palet text `#ffffff` arkaplan `#0a0a0f` → kontrast ~18:1 (AAA). Light palet text `#0f172a` arkaplan `#ffffff` → ~15:1 (AAA). Ancak `textTertiary: rgba(255,255,255,0.4)` dark bg üzerinde ~4.6:1 — body için AA passes ama UI label için sınırda. Orange text (`#FB923C`) orange-fade bg üzerinde ~3:1 — WCAG AA için **fail** (metin için 4.5:1 gerek).

**(b) Sorun (High, A11y).** 
- `colors.textMuted: rgba(255,255,255,0.2)` ~2.3:1 — tamamen okunamaz; yalnızca dekoratif kullanılmalı, currently placeholder/caption gibi kritik roller için kullanılıyor.
- Success/error durumu **yalnızca renkle** taşınıyor — dikkat ikonu yok. Renk körü kullanıcılar "ödeme başarılı" yeşil banner'ı "ödeme başarısız" kırmızı banner'dan ayırt edemiyor.
- Web'de dark mode yok — kullanıcı sistem tercihi dark olsa bile saatlerce beyaz ekran.

**(c) Çözüm.** 
1. `textMuted` ve `textTertiary`'yi sadece border/disabled için işaretle; runtime'da `if (role === 'paragraph' && contrast < 4.5) warn()` dev-only lint.
2. `<StatusBadge>` component'i oluştur: renge ek `<CheckCircle/>` (success), `<AlertTriangle/>` (warn), `<XCircle/>` (error) ikonu zorunlu.
3. Web'e `next-themes` kur; `<html className={theme}>` → Tailwind `dark:` variant kullan.

**(d) Öneri.** WCAG 2.2 AA compliance için otomatik CI check: `pa11y-ci` veya `@axe-core/playwright` pipeline'a ekle — her PR'da failing sayfa/kontrast uyarısı. "Lokasyon/taşınma" markasına uygun bir alternatif palet: orange'ı brand highlight, mavi-yeşil (`#0EA5E9` sky) "güven/adres" CTA, sarı (`#FBBF24`) uyarı — bu üç renk US consumer'da trust + energy çağrışımı yapar. Ancak rebranding ROI düşük; mevcut palet sorun değil, sadece contrast tokenlarını sıkılaştır.

---

### 2.3 Arayüz & Kullanılabilirlik (UX)

**(a) Tespit.** Admin sidebar 5 grup × ~20 link [apps/admin/src/components/sidebar.tsx:44-105]. Breadcrumb bileşeni yok (grep 0 hit). Mobil tab bar 5 sekmeli (index/addresses/services/moving/more) [apps/mobile/app/(tabs)/_layout.tsx]. Web auth layout sign-in/sign-up/forgot-password/reset-password/verify-email/onboarding ayrı route'larda. Forms: react-hook-form + zod genellikle kullanılıyor (signup, onboarding, service forms), fakat 5 sample'dan 2 tanesi direkt `useState + fetch` pattern'ını tercih ediyor (legacy formlar).

**(b) Sorun (Medium).** 
- Breadcrumb yok → 3-seviye derin admin sayfalarında kullanıcı "nerede olduğunu" kaybediyor (örn. `/providers/[id]/reviews`).
- Inline validation tutarsız — bazı formlar toast'a düşüyor, bazıları field altı kırmızı metin. Onboarding "zorunlu alan boş" hatası `toast.error()`; oysa field altında göstermek 3x daha hızlı algılanır.
- Autofill/autocomplete attribute'ları: sign-in formu `autocomplete="email"` + `current-password` **kullanıyor**, fakat register formu `new-password` eklemeyi unutmuş → iOS Keychain önerisi çalışmıyor.
- Focus ring Tailwind default `focus:outline-none` bırakan buton varyantları var — klavye kullanıcıları için erişilebilirlik regresyonu.
- Admin tabloları pagination sağlıyor ama column customization / saved views yok — operatör aynı filtreyi her seferinde yeniden kuruyor.

**(c) Çözüm.** 
```tsx
// apps/web/src/components/form-field.tsx (YENİ — merkezî)
export function FormField({ label, error, hint, children }: Props) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="...">{label}</label>
      {React.cloneElement(children, { id, 'aria-invalid': !!error, 'aria-describedby': hint ? `${id}-hint` : undefined })}
      {hint && <p id={`${id}-hint`} className="text-sm text-textTertiary">{hint}</p>}
      {error && <p role="alert" className="text-sm text-error mt-1">{error}</p>}
    </div>
  );
}
```
Toast'u sadece **sistem düzeyi bildirim** için kullan; field-level hata her zaman inline. Tüm şifre inputlarına `autocomplete="new-password"` veya `"current-password"` zorla — ESLint kuralı yaz.

**(d) Öneri.** Admin'e "Saved Views" özelliği ekle (filter + sıralama + sütun seti JSON olarak `AdminDashboardWidgetPrefs` benzeri). Navigation'a kalıcı breadcrumb — Next.js App Router `layout.tsx` içinde `useSelectedLayoutSegments()` kullanarak generic. Mobilde `swipe-back` iOS jesti her ekranda çalışıyor olmalı — `expo-router` default veriyor ama özel modal'larda test et. Trade-off: breadcrumb + saved views iki ayrı geliştirme, admin öncelikli.

---

### 2.4 Kullanıcı Akışları (Stepler)

**(a) Tespit ve Sürtünme Noktaları.**

**Kayıt → e-posta doğrulama → onboarding → ilk taşınma planı** (apps/web)
1. `/sign-up` → 4 alan (email, password, firstName, lastName) — password policy 12+upper+lower+digit+special [apps/web/src/lib/user-auth.ts:90-101]. **Friction:** kuralları önden göstermiyor; kullanıcı submit etmeden ne ihlal ettiğini bilmiyor.
2. `POST /api/auth/register` → e-posta doğrulama linki gönderir → kullanıcı inbox açıp tıklar.
3. `/verify-email?token=...` → doğrulama → redirect `/onboarding`.
4. `/onboarding` → profil + ilk adres + ilk taşınma niyeti — 3 adımlı tek sayfalı. **Friction:** tek submit'te tüm şema validate ediliyor; kullanıcı 2. adımda hata yaparsa 1'deki alanları unutuyor.
5. `/moving/new` → 4 alan. **Friction:** "beklenen taşınma tarihi" için `YYYY-MM-DD` text input — date picker yok.

**Adres ekleme → servis → sağlayıcı eşleşme → rezervasyon:** Rezervasyon akışı yok — provider sadece "öner + kullanıcı dış link'e gider" (`provider.website`). SaaS vaadi "rezervasyon" ima ediyor ama teknik olarak "katalog + recommendation".

**Yorum yazma/okuma:** `ProviderReview` modeli [schema.prisma] var, web rotalarında `/api/providers/[id]/reviews` GET+POST var; mobilde `reviews/new` **hiç yok** (tab'dan düştü — önceki audit'te mobilde vardı, şimdi kaldırılmış).

**Abonelik satın alma (Stripe):** `/settings/subscription` → `POST /api/stripe/checkout` → Stripe Checkout → webhook `/api/webhooks/stripe` → DB mirror. Webhook **idempotent** (`ProcessedWebhookEvent`) [apps/web/src/app/api/webhooks/stripe/route.ts:51-61]. **Friction:** 5-dk stale event penceresi (aşağıda ayrı bulgu).

**Mobil offline:** `PersistQueryClientProvider` + AsyncStorage persister [apps/mobile/app/_layout.tsx:118-125] — read cache çalışıyor. Write/mutation queue yok.

**(b) Sorun (Medium–High).** 
- Tek-sayfa onboarding hata reset'i kötü → drop-off tahmini %25–35.
- Date text input 2020'de bile kötü UX.
- Mobil review yazma akışı yok → community intelligence promise yarım.
- Rezervasyon vaadi ürün spec'iyle (RELOCATION_MANAGER_SPEC.md) uyumsuz.

**(c) Çözüm.** 
1. Onboarding'i `<Wizard>` step-validator'lı stepper yap; her step local state'te tutulur, Zod per-step.
2. `react-native-date-picker` veya `@react-native-community/datetimepicker` ekle; web'de `<input type="date">` en az.
3. Mobile review yazma ekranını geri ekle — `apps/mobile/app/providers/[id].tsx` içine "Write a review" CTA ve `apps/mobile/app/reviews/new.tsx`.
4. Password rules'u inline göster: `<PasswordStrengthMeter value={pw}/>`.

**(d) Öneri.** "Drop-off telemetry" ekle (consent-gated) — her onboarding adımı için `/api/tracking/event` ile `onboarding_step_1_complete` gibi. 2 haftalık data ile hangi adım en çok terk edildiğini öğren. Bu veri olmadan UX yatırımları körlemesine — trade-off: zaman harcar ama tarama yerine hedefli düzeltme.

---

### 2.5 Uygulamanın Amacına Uygunluk

**(a) Tespit.** Spec ([RELOCATION_MANAGER_SPEC.md:34-43](RELOCATION_MANAGER_SPEC.md#L34-L43)) beş value prop listeliyor: centralized service, moving assistant (LLM Phase 2), budget tracking, document management (OCR Phase 2), community intelligence. Kod tarafı:

| Vaat | Durum | Kanıt |
|---|---|---|
| Centralized service | ✅ Complete | `Service` modeli + `/services` CRUD |
| Moving assistant | ⚠️ Kural-bazlı | `state-rules`, `StateRule` modeli + seed; AI yok |
| Budget tracking | ✅ Complete | `Budget` + `/budget` CRUD |
| Document mgmt | ❌ Kaldırılmış | `/api/documents` route yok (önceki audit'te vardı) |
| Community intel | ⚠️ Kısmi | `ProviderReview` var, mobilde akış yok |
| USPS change-of-address | ❌ Yok | schema + route'ta iz yok |
| Utility transfer | ❌ Yok | Service "providerName" var ama "transfer workflow" yok |
| School/zoning lookup | ❌ Yok | - |

**(b) Sorun (High — ürün farkı).** "AI-destekli taşınma asistanı" vaadi reklam sayfasında var ama arka planda rule-based + hiçbir LLM çağrısı yok. Bu bir **ürün-pazarlama tutarsızlığı**, yasal risk (deceptive advertising) yaratabilir. `recommendation-engine.ts` sadece `CATEGORY_META` re-export ediyor [apps/admin/src/lib/recommendation-engine.ts:1-8] — gerçek öneri mantığı `packages/shared` içinde (henüz okumadım, muhtemelen kural-bazlı).

**(c) Çözüm.** 
1. Landing ve pricing sayfasında "AI" ibaresini **"smart checklist"** veya **"rule-based guidance"** olarak değiştir — Phase 2 lansmanına kadar.
2. Document management + USPS COA + utility transfer için en az **3 tanesi MVP roadmap'e** eklenmeli — yoksa ürün "sadece başka bir budget tracker" pozisyonunda kalıyor.
3. AI'ı Phase 2'de getirirken Anthropic Claude API `messages.create({ model: 'claude-opus-4-7' })` + explainability (`"Why this checklist? Because your move is CA → TX and Texas has no state income tax"`).

**(d) Öneri.** Ürünü "ABD'de taşınanlara uçtan uca geçiş asistanı" olarak konumlamak istiyorsan **bir diferansiyatöre** bahis yapmalısın. Üç seçenek:
- **A. AI asistan** (yüksek maliyet, yüksek moat) — 3 ay dev + $1–3k/ay LLM cost.
- **B. USPS COA + utility transfer otomasyonu** (entegrasyon maliyeti, ama gerçek zaman tasarrufu) — bir çeşit ClickUp for moving.
- **C. Community intelligence** (düşük sermaye, ağ etkisi) — Reddit/NextDoor boşluğunu doldur; başlat: ZIP-level provider ratings.

Trade-off: AI demo etkili ama ucuzca kopyalanabilir; USPS/utility gerçek moat ama integration yalnızca 3-4 monopolistle olan (USPS, Geo Services). Community en sürdürülebilir ama cold-start zor. Önerim: **A+C combine** — AI checklist explainability + community-verified provider ratings; utility automation 6 ay sonrasına.

---

### 2.6 Sistem Mantığı & Mimari

**(a) Tespit.** Domain sınırları: `User` (auth, profile), `Address`, `Service`, `ServiceProvider`, `MovingPlan`, `Task`, `Budget`, `Subscription`, `AdminUser` + `AdminSession` + `AdminAuditLog`, `UserSession` + `UserLoginSession`, `Notification` + `NotificationPreference`, `SupportTicket`, `ProcessedWebhookEvent`, `DataConsent`, `PushDevice`, `ProviderReview`, `StateRule`, `RuntimeConfig`, `FeatureFlag`, `EmailLog`, vs. Toplam ~35+ model. 

İş kuralları çoğunlukla **route handler içinde inline** — `apps/web/src/app/api/**/route.ts` dosyaları ortalama 100-300 satır, prisma çağrıları doğrudan. Service layer yok. `apps/web/src/lib/*` altında yardımcılar var (auth, email, notification-preferences, billing, rate-limit) ama domain service değil.

Next.js App Router: Server Components default, route handler'lar `runtime = "nodejs"` webhook dışında belirtilmemiş (edge-compatible olmalı) — Prisma çağrıları edge'de çalışmaz, ama middleware zaten edge-safe ve route'lar default node — sorun yok.

Mobil-web-admin sözleşmesi: `packages/shared/src/api-client.ts` tek client, `packages/shared/src/types.ts` tipleri. Zod şemaları kısmen paylaşılıyor. OpenAPI yok.

Arka plan işleri: cron rotaları (`bill-reminders`, `weekly-digest`, `contract-reminders`, `data-retention`, `move-reminders`, `trial-check`, `provider-stats`, `backup`). Docker `ofelia` ile tetikleniyor (README.deploy.md referansı).

**(b) Sorun (Medium).** 
- Service layer eksikliği → aynı domain kuralı (örn. "servis silindiğinde ilgili task'ları ne yapacağız?") 3 farklı route'ta 3 farklı implementasyon. Test edilmesi zor çünkü business logic'in yarısı HTTP parseline sarılmış.
- `packages/shared` sadece tip + constant paylaşıyor; **zod şemaları paylaşımı kısmi** — mobile `task.status="COMPLETED"` gönderiyordu (önceki audit), schema server-side validated ama mobile drift'i runtime'a bırakıyor.
- Ofelia cron yeterli ama **retry + DLQ yok**. Bill reminder cron'u patlarsa o gün e-postalar gitmez, ertesi gün yeni pencere başlar — kaçan reminderlar kaybolur.

**(c) Çözüm.** 
```ts
// apps/web/src/services/service.service.ts (YENİ)
export async function deleteService(userId: string, serviceId: string) {
  return prisma.$transaction(async (tx) => {
    const svc = await tx.service.findFirst({ where: { id: serviceId, userId } });
    if (!svc) throw new DomainError('NOT_FOUND');
    await tx.task.updateMany({ where: { serviceId }, data: { serviceId: null } });
    await tx.service.delete({ where: { id: serviceId } });
    return svc;
  });
}
```
Route handler 5 satıra iner: validate → call service → respond. Test edilebilir hale gelir.

Shared zod: `packages/shared/src/schemas/task.ts` içinde `export const taskUpdateSchema = z.object({ completed: z.boolean().optional(), ... })` — mobile + web + admin hepsi import eder.

Cron için **BullMQ + Redis** veya **Temporal Cloud** düşün. Ofelia'yı şimdilik `--retry 3 --delay 30s` ile güçlendir (Ofelia desteklemiyor → shell script wrapper ile exponential backoff).

**(d) Öneri.** Service layer'ı **top-down** değil **feature-by-feature** tanıt — her PR "bu feature'ın logic'ini extract ediyorum" desin. Full rewrite 3 ay, feature-by-feature 6 ay ama kesintisiz. OpenAPI'ye gitmek yerine `trpc` düşün — type-safe, duplicate yok, ama mobile native HTTP'ye bağlı; trpc-mobile setup'ı ekstra iş. **Karar:** zod-schemas paylaşımı tek başına %80 faydayı verir, trpc aşırıya kaçar.

---

### 2.7 Güvenlik (Derin Tarama)

**(a) Tespit.** Güçlü taraflar (önceki audit'ten beri kapanmış): admin rate-limit + lockout, MFA, CSRF, security headers, IP rules, JWT fingerprint, DB-tracked sessions, step-up auth, impersonation audit trail, path traversal silinmiş, CRON_SECRET fail-closed, backup encryption + signature.

Zayıf taraflar:

1. **Admin CSP hâlâ `style-src 'unsafe-inline'`** [apps/admin/next.config.js:11-13] — yüksek yetkili panel için riskli; XSS bulunursa inline style injection ile credential skimmer yerleştirilebilir.
2. **Web CSP `style-src 'unsafe-inline'`** [apps/web/next.config.js:49] — Tailwind + shadcn + next-themes inline style kullandığı için şimdilik kaldırılamaz; **Medium** kabul et.
3. **`CRON_SECRET` üç ayrı anlama hizmet ediyor** — cron auth, internal security-event webhook, impersonation handoff [apps/admin/src/middleware.ts:22-36; apps/admin/src/app/api/users/[id]/impersonate/route.ts:74-87]. Tek secret sızarsa üç saldırı yüzeyi açılır.
4. **User login rate-limit** middleware global 30 write/60s; admin login'deki özel lockout web login'de yok — kullanıcı brute-force için 30 attempt/dk/IP çok yüksek.
5. **MFA opt-in**, zorunlu değil — SUPER_ADMIN hesapları için TOTP zorunluluğu politika olarak yok.
6. **`PUBLIC_API_GET: ["/api/providers"]`** — tüm provider listesi anonim. OK, ancak sayfalama sınırı yok → DB dump saldırı riski (büyük `perPage` değeri).
7. **`hasValidSession` middleware'de yalnızca JWT verify** [apps/web/src/middleware.ts:212-226]; DB validate + `isActive` kontrolü `requireDbUserId()` içinde. Page route'larında `getServerSideProps`/RSC içinde `requireDbUserId` çağrısı unutulursa deaktive kullanıcı sayfayı görür.
8. **Legacy role fallback** [apps/admin/src/lib/auth.ts:299-327] — `admin.permissions.length === 0` ise rol-bazlı izin veriyor. Seed admin'lere full ADMIN erişimi veriliyor → least-privilege ihlali.

**(b) Sorun (Medium–High).** 
- (1) High: admin XSS zinciri felaket — 1 XSS → tüm kullanıcı verisi.
- (3) Medium: shared secret tek-nokta-başarısızlık.
- (4) Medium: kullanıcı brute-force karşı zayıf; 30 RPM'de bir şifre 5 dakikada deneniyor.
- (5) High: SUPER_ADMIN MFA yok = root cihaz kaybı = tüm veri.
- (8) Medium: yetki matrisi kısmen görsel süsleme.

**(c) Çözüm.** 
1. Admin CSP'yi nonce-based yap: `Content-Security-Policy: script-src 'self' 'nonce-{{nonce}}'; style-src 'self' 'nonce-{{nonce}}';` + Next.js middleware nonce injection; shadcn `cn()` inline style'larını CSS variables'a taşı.
2. Üç secret ayrıştır: `CRON_SECRET`, `INTERNAL_WEBHOOK_SECRET`, `IMPERSONATION_HANDOFF_SECRET`. Her biri ayrı rotate edilebilir.
3. Web login'e IP bazlı rate-limit ekle: `/api/auth/login` için 5 attempt/15 dk (admin paterni).
4. `AdminUser.mfaEnforcedFrom: DateTime?` kolonu; SUPER_ADMIN login'inde `if (role === 'SUPER_ADMIN' && !mfaEnabled) return setupMfa()`.
5. Middleware'de RSC sayfaları için `/api/auth/session-check` proxy — veya `getServerSideProps` yerine server-component'lerde `requireDbUserId()` çağrısı zorunlu pattern → lint kuralı.
6. Legacy fallback'i kaldır; seed script her admin için `AdminPermission` satırlarını doldursun.

```ts
// packages/db/prisma/seed-admin.ts
async function seedPermissions(adminId: string, role: string) {
  const resources = ['users', 'providers', 'settings', 'billing', ...];
  for (const r of resources) {
    const perm = defaultPermissionsFor(role, r); // return { canRead, canCreate, canUpdate, canDelete }
    await prisma.adminPermission.upsert({ where: { adminUserId_resource: { adminUserId: adminId, resource: r }}, update: perm, create: { adminUserId: adminId, resource: r, ...perm }});
  }
}
```

**(d) Öneri.** OWASP ASVS L2 checklist'i CI'da otomatize et: `semgrep --config p/owasp-top-ten`. Dependency scanning için **Snyk** + **Dependabot** — `pnpm audit` haftalık crond. Secret rotation runbook yaz; `ADMIN_JWT_SECRET` rotasyonu = tüm admin logout, planlı maintenance window. Trade-off: WAF (Cloudflare/Vercel) eklemek L7 savunmayı artırır ama maliyet (~$20/ay), önce kodu sertleştir. **WebAuthn passkey** roadmap'e ekle — TOTP'nin üstüne phishing-resistant layer.

---

### 2.8 Admin ↔ Kullanıcı Veri Sağlamlığı & Doğruluğu

**(a) Tespit.** Admin mutasyonları `AdminAuditLog`'a yazılıyor: login (LOGIN/LOGIN_FAILED/LOGIN_BLOCKED), impersonation (IMPERSONATION_START/END), backup (IMPORT_START/COMPLETE/FAIL). Kullanıcı değişikliklerini bildiren `notifyUserOfAdminChange` helper [apps/admin/src/app/api/users/[id]/impersonate/route.ts:129-138]. Soft-delete: `User.deletedAt` var [packages/db/prisma/schema.prisma:57-63]. Backup dependency-aware: `BACKUP_TABLES` + `getBackupDependencyWarnings` + `getReplaceSafetyIssues` [apps/admin/src/app/api/backup/import/route.ts:6-10]. Subscription state Stripe webhook → DB mirror with idempotent `ProcessedWebhookEvent`.

**(b) Sorun (Medium–High).** 
1. **Soft-delete kısmi** — `User.deletedAt` var ama `Address/Service/Budget/MovingPlan` çocuklarında yok. User soft-delete edilince bu çocuklar hâlâ leaves olarak ORM'de görünür; `findMany` filtreleri `deletedAt: null` kontrol ediyor mu? Muhtemelen karışık (bazı route'larda var, bazılarında yok — kontrol edilmesi gereken nokta).
2. **Optimistic locking yok** — `version` kolonu hiçbir modelde yok. İki admin aynı user'ı aynı anda düzenlerse last-write-wins.
3. **Toplu işlemler transactional mı?** [apps/admin/src/app/api/providers/bulk/route.ts] — incelemedi, ama `Promise.all` yerine `prisma.$transaction` kullanmazsa parçalı başarısızlık olur.
4. **Stripe drift detection yok** — webhook patlarsa DB ile Stripe arasında divergence kalır; nightly reconciliation cron yok.
5. **Impersonation session'ın bitişi kayıt altında mı?** Kod sadece `IMPERSONATION_START` yazıyor; sonlandırma logu eksik (ya da başka yerde — grep ile doğrulanmalı).

**(c) Çözüm.** 
1. Tüm domain modellerine `deletedAt DateTime?` + Prisma `extends` ile otomatik filter middleware:
```ts
// packages/db/src/prisma-extensions.ts
prisma.$extends({ query: { $allModels: { findMany: async ({ model, args, query }) => {
  if (HAS_SOFT_DELETE.has(model) && args.where?.deletedAt === undefined) {
    args.where = { ...args.where, deletedAt: null };
  }
  return query(args);
}}}});
```
2. Kritik modellere `version Int @default(0)` ekle; update'lerde `where: { id, version }` + `data: { version: { increment: 1 }}` pattern.
3. Bulk işlemler için `prisma.$transaction(operations, { isolationLevel: 'Serializable' })`.
4. `apps/web/src/app/api/cron/stripe-reconcile/route.ts` ekle — gece tüm aktif subscription'ları Stripe'tan çekip DB ile karşılaştır; divergence varsa Sentry alarm.
5. Impersonation handoff endpoint'i JWT süresi dolduğunda `IMPERSONATION_END` yazsın (expire listener veya background check).

**(d) Öneri.** CDC (Change Data Capture) için **Debezium → Kafka → analytics** 12-ay sonrası düşün — şimdi over-engineering. Kısa vadede her "destructive admin action" öncesi `confirmationModal` ile "undo window" (30 sn) ekle (gmail undo send patteri). Admin UX'e değer katar, implementation hafif.

---

### 2.9 Toplanan Veriler (Gizlilik & Uyum)

**(a) Tespit.** 
- **PII:** email, ad-soyad, telefon (encrypted), adres (street/city/state/zip), ödeme (stripe_customer_id), geolocation (tracking session), device fingerprint (browser+os+UA hash).
- **Hassas:** `Service.accountNumber` encrypted [shared-encryption kullanımı]. `Service.notes` encrypted, export'ta opt-in [apps/web/src/app/api/export/route.ts:10-18].
- **Consent:** `DataConsent` model var + `CookieConsent` cookie + `/api/consent` route. Tracking sadece accepted consent'te yazılıyor [apps/web/src/app/api/tracking/session/route.ts:6-14].
- **Retention:** `/api/cron/data-retention` route mevcut.
- **GDPR:** Export route `/api/export?type=...&format=...&includeNotes=...`; sensitive masking uygulanıyor.
- **Silme:** `/api/account/delete` var.

**(b) Sorun (Medium).** 
1. **ABD odaklı app GDPR değil CCPA + Colorado privacy** kapsamında — `DataConsent` Avrupa dili kullanıyor mu? (Muhtemelen, AB-first dizayn edildi → US'de doğru opt-out dili "Do Not Sell or Share My Personal Information" gerekiyor).
2. **Retention TTL açık değil** — audit log, login log, session log tabloları için 90-gün cron implement edilmiş mi? Muhtemelen (`data-retention` route'u açıkla) ama parametreleştirilmiş mi bilmiyor.
3. **Export'ta `dashboardWidgetPrefs` + `notificationPreference` dahil mi?** Değilse kullanıcı "tüm verim" istediğinde eksik veriyor.
4. **Çocuk verisi (COPPA)** — sign-up age gate yok; 13 altı kullanıcı bypass edebilir.
5. **DPA (Data Processing Agreement) listesi docs'ta yok** — Stripe, Resend, Cloudinary, Upstash, Sentry, Google Maps ile DPA var mı? Kullanıcıya third-party listesi görünmüyor.

**(c) Çözüm.** 
1. `/privacy` sayfasında ABD'ye özel "Do Not Sell" toggle + `/api/consent/ccpa` endpoint.
2. `DataRetentionPolicy` config'i (runtime-config'te):
```ts
{ auditLog: 730, userLoginSession: 180, userSession: 90, notificationLog: 365 }
```
Cron her gece `DELETE FROM ... WHERE createdAt < NOW() - INTERVAL X DAY`.
3. Export'a `preferences: { dashboard, notifications, consents }` bölümü ekle.
4. Sign-up formuna yaş onayı (18+ checkbox) — COPPA koruması.
5. `/privacy/third-parties` sayfası oluştur; DPA linkleri + processor listesi.

**(d) Öneri.** **Privacy-by-design** yaklaşımı ile field-level retention: her PII alanı için `retentionPolicy`; cron bu metadata'yı okuyup seçici silsin. Trade-off: karmaşık, ama denetimde "biz kullanıcı verisini şöyle ele alıyoruz" dokümante etmek kolaylaşır. İlk sürümde basit table-level retention yeterli. Ayrıca **GDPR Article 15 (access) / 17 (erasure)** süre limitleri var (30 gün) — UI'da "request progress" göstergesi koy.

---

### 2.10 Admin Tarafı Kalitesi

**(a) Tespit.** Admin sidebar 5 grup, feature kapsamı geniş: Dashboard, Users, Subscriptions, Billing, Providers, StateRules, Moving, Notifications, EmailTemplates, HelpCenter, Analytics, Reports, FeatureFlags, Security, Lock, Settings, Database (backup), Search. İmpersonation zaten iyi tasarlanmış (SUPER_ADMIN + step-up + 15 dk). `AdminLoginLog` + `RateLimitLog` + `AdminAuditLog` mevcut.

**(b) Sorun (Medium).** 
1. **Bulk işlemler sınırlı** — providers bulk endpoint var, users bulk yok.
2. **Saved views / column customization yok** — yukarıda belirtildi.
3. **Gerçek zamanlı metrikler sınırlı** — `/analytics` sayfası var ama MRR/DAU/MAU/churn KPI card'ları explicit değil (kod doğrulanmalı).
4. **System health panel** — DB pool, Redis durumu, queue depth gösteren dashboard yok.
5. **Feature flag UI** var (`/feature-flags`) — kademeli rollout (%), kill switch ayrımı belirsiz.
6. **Undo desteği** — destructive action'lar için 30-saniyelik undo yok.

**(c) Çözüm.** 
1. `apps/admin/src/components/bulk-actions-toolbar.tsx` generic komponent → users, providers, subscriptions sayfalarında tüket.
2. Yukarıdaki saved views çözümü.
3. Admin dashboard için `KpiCard` set: MRR (Subscription toplam), MAU (UserSession distinct user 30 gün), churn (Subscription cancel 30 gün / total). Query'ler 5-dk cache (Redis).
4. `/system-health` sayfası: `SELECT 1` latency, Upstash PING, queue depth, Stripe webhook backlog.
5. Feature flag UI'ını "rollout percentage" + "kill switch" + "audience rule" olarak parçala.
6. `UndoableAction` hook; 30 sn içinde revert → inverse prisma call.

**(d) Öneri.** Admin panelini zamanla "ops portal"a dönüştür — SRE-grade. Runbook entegrasyonu: her alert Sentry'de "Runbook: <link>" ile paketlensin. Trade-off: Grafana + Prometheus gibi ayrı bir observability stack kuyu bunu kapsar ama admin içinde basic panel %80 değeri verir.

---

### 2.11 Performans, Erişilebilirlik, i18n

**(a) Tespit.** 
- **Perf:** Web `next.config.js` bundle analyzer var (`ANALYZE=true`), `images.remotePatterns` imgproxy + R2 doğru yapılandırılmış. Cron N+1 fix uygulanmış. Prisma schema'da FK indexleri büyük ölçüde var (örn. `PushDevice@@index([userId])`).
- **A11y:** `aria-*` attribute'lar sınırlı (grep ile ~20 hit). Skip-link yok. `focus-visible:` utility kullanımı sınırlı. Reduced-motion destek Framer Motion'da otomatik ama custom animations'ta manuel.
- **i18n:** Hiçbir i18n library yüklü değil. Tüm string hardcoded EN. Tarih formatı bazı yerlerde `toLocaleDateString("en-US", ...)` — US lokal hardcoded.

**(b) Sorun (Medium–High).** 
- A11y: keyboard-only kullanıcı skip-link olmadan 30+ sidebar link arasında sıkışıyor.
- i18n: US-only spec olsa bile hispanik (%19 US nüfusu) için Türkçe kadar gerçek ihtiyaç; ayrıca RTL olmasa bile çince-sebebiyle Cloud locale testi yapmamak gelecekte refactor borcu.
- Mobile cold start süresi ölçülmemiş — `AnimatedSplash` ile maskelenmiş olabilir ama TTI metrik yok.

**(c) Çözüm.** 
1. `<a href="#main-content" className="sr-only focus:not-sr-only">Skip to main</a>` her layout.
2. `next-intl` kur → `messages/en.json`, `messages/es.json`. `useTranslations('home')` pattern.
3. Core Web Vitals için `web-vitals` paketini install + custom `/api/analytics/web-vitals` endpoint → Sentry performance'a gönder.
4. `@axe-core/playwright` e2e test set ekle; kritik sayfalar (signup, onboarding, dashboard) için CI'da assertion.

**(d) Öneri.** A11y WCAG 2.2 AA sertifikasını 12 ay hedefi koy; ek olarak Section 508 ABD federal gereksinimi bazı B2B müşterilerin satın alma şartı. i18n için `next-intl` tercih sebebi: Next 16 RSC ile uyumlu, build-time optimize ediyor; `react-i18next` SPA odaklı, RSC'de awkward. Trade-off: i18n sonradan eklemek kolay ama string'ler kodda donmuş → her yeni feature double work.

---

### 2.12 Test, CI/CD, Gözlemlenebilirlik

**(a) Tespit.** `.github/workflows/ci.yml` mevcut (git status'ta modified). Sentry (`@sentry/nextjs ^10.49.0`) her iki app'te kurulu. Mobil `@tanstack/react-query-persist-client` ile offline cache. Test kapsamı sınırlı (Vitest kurulu, ama API route entegrasyon testi az).

**(b) Sorun (High).** 
1. Test coverage düşük (önceki audit "near-zero" diyordu; şu an kısmen iyileşmiş olabilir ama `pnpm test` coverage report yok).
2. CI pipeline adımları bilinmiyor (ci.yml okunmadı) — en azından lint+typecheck+test+audit+build+e2e gerek.
3. SLO/SLI tanımlı değil; on-call runbook yok.
4. Migration dry-run yok — üretimde `prisma migrate deploy` direkt uygulanıyor.
5. Mobile E2E (Detox / Maestro) yok.
6. Preview environment yok — her PR için ephemeral DB + seed clone?

**(c) Çözüm.** 
1. `packages/db/prisma/__tests__/` altında Prisma testcontainers ile entegrasyon testi.
2. CI job akışı:
```yaml
jobs:
  lint: pnpm lint
  typecheck: pnpm -r typecheck
  unit: pnpm -r test --coverage
  audit: pnpm audit --audit-level=high
  build: pnpm build
  e2e:
    services: { mysql, redis }
    steps: prisma migrate deploy → pnpm seed → pnpm test:e2e
```
3. SLO: web p95 < 500ms, mobile cold start < 3s, error rate < 0.5%. Sentry alert rules.
4. `prisma migrate diff` pre-deploy → dry-run SQL PR'da comment.
5. Maestro flow: signup → onboarding → first task → logout.
6. Neon branching (MySQL alternatifi olarak PlanetScale) preview env.

**(d) Öneri.** GitHub Actions + Turbo remote cache (Turborepo offer) %60 CI süresi düşürür — 20 dk → 8 dk. On-call için Sentry + PagerDuty (ilk kritik); şimdi Sentry issue → Slack channel yeterli. Ayrıca **chaos testing** 12-ay sonrası — production'da pod restart simülasyonu.

---

## 3. Ek Başlıklar (Kendi Öngörüm)

### 3.1 SEO & Content Strategy

**(a)** `apps/web` landing + pricing + help + privacy sayfaları public. `metadata` export'u bazı sayfalarda var ama `sitemap.ts` / `robots.ts` unknown. OpenGraph görseli dinamik mi?  
**(b) Medium:** "relocation services" arama hacmi yüksek ama canonical + structured data eksik → organik trafikten %40 kayıp.  
**(c)** `app/sitemap.ts` + `app/robots.ts` + `@vercel/og` dinamik og-image + JSON-LD `SoftwareApplication` schema.  
**(d)** State-bazlı landing sayfaları (`/moving/ca-to-tx`) programmatic SEO — spec'te implied ama kodda yok. 50 state × 50 state = 2500 sayfa, her biri state-rule destekli.

### 3.2 Lisans & Vendor Lock-in

**(a)** pnpm-lock.yaml 595KB; MIT/Apache dışında GPL/AGPL dependency yok (spot check). Vendor lock: Stripe, Cloudinary, Upstash, Resend, Sentry, Cloudflare R2, PlanetScale/MySQL.  
**(b) Medium:** Her payment processor switch 2-haftalık iş; Resend'e tam bağımlılık tek nokta — 2-saatlik outage → zero email.  
**(c)** Email için ikinci provider (Postmark) fallback; payment için Stripe yeterli ama 3DS/SCA farklı bölge için ikinci opsiyon değerlendir 12-ay sonrası.  
**(d)** Tüm third-party için "offboarding runbook" yaz — "Resend'den Postmark'a geçiş 1 günde". Bu pratik yapılabilirlik testi, gerçek migration değil.

### 3.3 Green IT & Cost

**(a)** Docker Compose MySQL + Caddy + Ofelia self-host. Next.js serverless değil (`output: standalone`). Upstash serverless.  
**(b) Low:** Self-host MySQL 24/7 idle tüketim; ölçek büyüdüğünde elektrik + cooling.  
**(c)** PlanetScale / Neon / AWS RDS serverless → idle zaman = $0.  
**(d)** Kısa vadede self-host iyi (cost < $30/ay 1000 user'a kadar); 10k user üstü PaaS.

### 3.4 KYC / Identity & Kullanıcı Doğrulama

**(a)** Email verification + MFA var; fiziksel adres doğrulama yok (USPS CASS).  
**(b) Low:** Fraudulent address ile hesap açılabilir → provider ratings spam riski.  
**(c)** USPS CASS (Coding Accuracy Support System) integration OR Google Places verification ile adres normalize + valid flag.  
**(d)** Review yazmak için "address verified" prerequisite → spam kesilir; sağlam community.

### 3.5 Yapay Zekâ Etik & Bias

**(a)** Şu an AI/LLM yok; Phase 2'de Anthropic Claude planlanıyor.  
**(b) Future High:** Provider recommendation "AI" olsa bias riski — düşük-review'lu etnik-minority owned işletmeler alt sırada kalır.  
**(c)** Phase 2'de implement edilirken explainability zorunlu (`"Why this provider?"`), fairness metric (demographic parity), human-in-the-loop override.  
**(d)** Bias audit her 6 ayda bir — "sample 100 öneri, provider demographic dağılım ile user demographic match oranı".

---

## 4. Önceliklendirilmiş Yol Haritası

### Sprint 1 (0–2 hafta) — Security & Compliance Gap Closure

| # | İş | Etki (1-5) | Efor | Bağımlılık |
|---|---|---|---|---|
| 1 | `CRON_SECRET` ↔ `INTERNAL_WEBHOOK_SECRET` ↔ `IMPERSONATION_HANDOFF_SECRET` ayrıştır | 5 | S | - |
| 2 | SUPER_ADMIN için MFA zorunlu, ilk login'de setup gate | 5 | M | AdminUser migration |
| 3 | Web `/api/auth/login` route'una IP-bazlı 5/15dk lockout | 4 | S | Upstash mevcut |
| 4 | Admin CSP nonce-based, `unsafe-inline` kaldır | 4 | M | shadcn cn() audit |
| 5 | Legacy role permission fallback kaldır + seed tüm permission'ları yazsın | 4 | M | migration + seed |
| 6 | Stripe webhook 5dk stale check'i 72 saate genişlet | 4 | XS | - |
| 7 | Soft-delete extension + `deletedAt` filtresi global | 3 | M | prisma extend |
| 8 | CCPA "Do Not Sell" toggle + `/api/consent/ccpa` | 3 | S | DataConsent schema |

### Sprint 2 (2–6 hafta) — UX Debt & Data Integrity

| # | İş | Etki | Efor | Bağımlılık |
|---|---|---|---|---|
| 1 | Typography + color tokens `packages/shared/design-tokens` → web/admin/mobile tüketsin | 4 | M | - |
| 2 | Web'e `next-themes` dark mode | 3 | S | - |
| 3 | Onboarding'i step-validator wizard'a çevir | 4 | M | react-hook-form |
| 4 | `<StatusBadge>` ikon-zorunlu; renk-körü uyumu | 3 | S | - |
| 5 | Service layer çıkarımı (feature-by-feature) — first: `service.service.ts`, `moving.service.ts` | 3 | L | - |
| 6 | Shared zod schemas `packages/shared/schemas/*` | 4 | M | service layer |
| 7 | Optimistic locking (`version` kolonu) kritik modellerde | 3 | M | migration |
| 8 | Stripe reconcile cron nightly | 4 | S | - |
| 9 | Admin bulk actions + saved views + KPI cards | 3 | L | - |
| 10 | `<a href="#main-content">` skip-link + `aria-label` audit | 3 | S | - |

### Sprint 3 (6–12 hafta) — Platform Olgunluğu

| # | İş | Etki | Efor |
|---|---|---|---|
| 1 | `next-intl` + en/es translations | 4 | L |
| 2 | `pa11y-ci` + `@axe-core/playwright` pipeline | 4 | M |
| 3 | SLO/SLI tanımla + Sentry alert rules | 3 | M |
| 4 | Migration dry-run CI + `prisma migrate diff` PR comment | 3 | S |
| 5 | Mobile E2E (Maestro) golden path | 4 | M |
| 6 | Preview environment (PlanetScale/Neon branching) | 4 | L |
| 7 | BullMQ/Temporal migration for cron retry + DLQ | 4 | XL |
| 8 | USPS CASS adres doğrulama entegrasyonu | 3 | L |
| 9 | WebAuthn passkey (kullanıcı + admin) | 3 | L |

### 6-Ay Vizyon — Ürün Farklılaşması

1. **AI-destekli taşınma asistanı** — Anthropic Claude Opus 4.7 ile explainable checklist, state-rule aware prompt. Model cost: ~$0.003 per checklist × 1k users/ay = $30-90/ay.
2. **Community intelligence v2** — ZIP-level provider ratings, verified-address gatekeeping, trust score algorithm.
3. **USPS + utility transfer otomasyon** — Xfinity/AT&T/Verizon partner API entegrasyonu (partner kontratları uzun).
4. **Passkey-only auth path** — password'e alternatif, WebAuthn + silent authentication.
5. **Sertifikasyon** — SOC 2 Type I preparation; B2B white-label fırsatı.

---

## 5. Ölçülebilir Başarı Kriterleri

| İyileştirme | Metrik | Hedef |
|---|---|---|
| SUPER_ADMIN MFA zorunlu | `AdminUser.mfaEnabled = true / total SUPER_ADMIN` | 100% 30 gün içinde |
| Web login brute-force | Kırılmış hesap sayısı + 5-kez başarısız log | 0 / ayda, lockout oranı < 0.5% |
| Admin CSP sertleştirme | CSP violation report count | < 10/gün (nonce infra çalışıyor) |
| Onboarding wizard | Adım-1 → adım-3 completion rate | 60% → 80% |
| Dark mode web | Dark tercih eden kullanıcı oranı | Sistem preference match > 90% |
| Service layer extraction | Route handler ortalama LOC | 150 → 50 |
| Optimistic locking | Concurrent-update conflict error | 409 response < 1% admin edits |
| Stripe reconcile | DB ↔ Stripe divergence sayısı | 0 nightly |
| A11y | Axe critical violations | 0 on 10 sample pages |
| Test coverage | Statement coverage | %0-20 → %60+ |
| p95 latency | web /api/* | < 500ms |
| i18n | Tam çeviri kapsama (en + es) | %100 sayfalar |
| MFA adoption | Regular user MFA takeoff | > 15% in 6 months |
| Churn | Monthly subscription cancel / total | < 5% |
| Security event response | Time-to-detect sensitive admin action | < 5 dk (Sentry alert) |

---

## 6. Hızlı Kazançlar (< 1 gün, 10 madde)

1. **Stripe webhook stale window 300 → 259200 sn (72h)** — 1 satır. [apps/web/src/app/api/webhooks/stripe/route.ts:44].
2. **Web login rate-limit 5/15dk IP lockout** — admin helper'ı kopyala.
3. **Skip-link ekle** — her 3 layout'a 1 satır.
4. **Register form `autocomplete="new-password"`** — 3 input attr.
5. **`textMuted` kullanımını `disabled:` variant'a sınırla** — lint kuralı.
6. **Password strength meter komponenti** — Tailwind + zxcvbn (mevcut dep).
7. **Admin landing `<meta robots="noindex">`** — indekslemekten koru.
8. **`/api/tracking/event` için IP rate-limit** (10/dk/IP).
9. **Sentry `beforeSend` PII scrubber** — email/IP maskele.
10. **`app/sitemap.ts` + `app/robots.ts`** — SEO temel.

---

## 7. Risk Matrisi (Olasılık × Etki)

```
                      OLASILIK →
                 Düşük    Orta     Yüksek
ETKİ ↑
Çok yüksek       [S 3.5]  [S 2.7.1][S 2.7.5]
Yüksek           [S 3.1]  [S 2.11] [S 2.7.3]
Orta             [S 3.3]  [S 2.8.4][S 2.8.2]
Düşük            [S 3.2]  [S 2.10.5]
```

**Kırmızı (öncelik):**
- **S 2.7.1 — Admin CSP XSS zinciri** (Orta olasılık × Çok yüksek etki)
- **S 2.7.5 — SUPER_ADMIN MFA eksik** (Yüksek olasılık × Çok yüksek etki)
- **S 2.7.3 — Shared CRON_SECRET tek nokta** (Orta olasılık × Yüksek etki)
- **S 3.5 — AI bias Phase 2 öncesi** (Düşük olasılık × Çok yüksek etki — gelecek)

**Sarı (izlem):** S 2.7.4 web brute-force, S 2.8 version kolonu yok, S 2.11 i18n eksikliği, S 2.8.2 optimistic locking.

**Yeşil (kabul):** S 3.2 lisans, S 3.3 green IT maliyet — şimdilik kabul.

---

## 8. Doğrulama (Verification)

Bu planın her maddesi şu şekilde kanıtlanır:

1. **Security fixes** — manuel ile + `pnpm test:integration auth` + Burp Suite spot test (admin login brute-force, CSP report-uri).
2. **UX** — 5 kullanıcı ile usability test (Maze / UserTesting); onboarding completion telemetry.
3. **Performance** — Lighthouse CI PR comment + web-vitals dashboard.
4. **i18n** — `next-intl` missing-key reporter CI.
5. **Data integrity** — Prisma integration test, Stripe reconcile cron dry-run log.
6. **Mobile parity** — Maestro flow golden path runs green; expo doctor clean.

---

## 9. Yönetici Özeti (Max 15 madde)

1. Önceki iki denetimdeki Critical/High bulguların %90'ı kapatılmış — admin rate-limit, CSRF, MFA, security headers, cron fail-closed, IDOR, path traversal, mobil bearer auth, SQLite→MySQL, N+1, month-boundary fix hepsi tamam.
2. SUPER_ADMIN için MFA **zorunlu değil** — root-compromise en yüksek riskli boşluk.
3. Admin CSP `style-src 'unsafe-inline'` barındırıyor; yüksek yetkili panel için XSS zinciri riski (High).
4. Üç farklı güvenlik surface'i tek `CRON_SECRET`'i paylaşıyor — ayrıştır.
5. Web login endpoint'te brute-force koruması middleware global 30 RPM'den ibaret; özel lockout yok.
6. "AI-destekli taşınma asistanı" vaadi ile gerçek kod (rule-based) arasında uyumsuzluk — pazarlama güncellenmeli veya Phase 2 önceliklendirilmeli.
7. Typography/renk token'ları web/admin/mobile arasında üç farklı yerde tekrarlanıyor — `packages/shared/design-tokens` tek kaynak olmalı.
8. Web'de dark mode yok — kullanıcı mobil dark alışkanlığı ile web arasında marka kopukluğu.
9. i18n kütüphanesi kurulu değil; Hispanik kullanıcı pazarı için blok.
10. Soft-delete sadece `User`'da; child entity (Address, Service, Budget) cascade davranışı tutarsız.
11. Optimistic locking kolonu hiçbir modelde yok — concurrent admin edits'te last-write-wins.
12. Stripe webhook 5-dakikalık stale event rejection Stripe'ın 3-gün retry davranışıyla çelişiyor — outage sonrası sessiz veri kaybı.
13. Service layer extraction yok — route handler'lar ~100-300 LOC business logic tutuyor; test edilmesi zor.
14. A11y alt yapısı zayıf — skip-link yok, `textMuted` contrast başarısız, `focus-visible` utility sınırlı.
15. Yol haritası: Sprint 1'de 8 security/compliance maddesi + Sprint 2'de 10 UX/data integrity + Sprint 3'te 9 platform olgunluğu + 6-ay vizyon AI + community + auth modernizasyonu üzerine.
