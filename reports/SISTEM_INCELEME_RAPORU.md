# LocateFlow - Sistem Derinlemesine Inceleme Raporu
**Tarih:** 2026-04-23 | **Kapsam:** Full Monorepo

---

## 1. Kritik Guvenlik Hatalari

### 1.1 [KRITIK] Web Middleware - JWT Verify Yeterli Degil
**Konum:** `apps/web/src/middleware.ts:221-225`
Middleware sadece JWT imzasini dogruluyor. Token DB'de gecersiz/revoke edilmis mi, `isActive=false` mu, `expiresAt` gecmis mi KONTROL ETMIYOR.
- Logout olan kullanici tokeni hala calisir
- Deaktive edilen kullanici hala erisir
- Edge Runtime limitasyonu ama production riski yuksek
**Oneri:** Kisa TTL (15-30 dk) + refresh token pattern

### 1.2 [KRITIK] Admin Panel - Rate Limiting YOK
**Konum:** `apps/admin/src/middleware.ts`
Admin middleware'da hic rate limiting yok. Web'de (`apps/web/src/middleware.ts:166-193`) Upstash Redis + in-memory fallback var ama admin'de kopyalanmamis.
**Oneri:** Web'deki `rateLimit` fonksiyonunu admin'e de entegre et.

### 1.3 [YUKSEK] Admin Public Paths - Prefix Match Hatasi
**Konum:** `apps/admin/src/middleware.ts:314`
```typescript
if (PUBLIC_PATHS.some((p) => pathname.startsWith(p)))
```
`/login-attempt` yanlislikla public olabilir. Exact match gerekli.

### 1.4 [YUKSEK] Mobile API URL - HTTP Default
**Konum:** `apps/mobile/src/lib/api.ts:53`
```typescript
return envApiUrl || "http://localhost:3000/api";
```
Default HTTP. Production'da HTTPS zorunlu olmali.

### 1.5 [ORTA] Encryption - Development'da Plaintext
**Konum:** `packages/shared/src/encryption.ts:35-43`
`FIELD_ENCRYPTION_KEY` yoksa development'da plaintext donduruyor. Gelistirici makinesi hacklenirse sensitive data aciga cikar.

---

## 2. Mantik Hatalari ve Bug'lar

### 2.1 [YUKSEK] Landing Page - "Mobile Coming Soon" Yalani
**Konum:** `apps/web/src/app/page.tsx:322-335`
Mobile app tamamen implemente edilmis (Expo, tabs, auth, onboarding, services, addresses, moving). Kullanicilara "coming soon" denmesi yaniltici.

### 2.2 [YUKSEK] Mobile Onboarding - Yanlis/Eksik API Endpoint
**Konum:** `apps/mobile/app/_layout.tsx:51`
```typescript
api.get<any>("/api/profile").then((res) => {
  setNeedsOnboarding(res.data?.onboardingCompleted !== true);
})
```
Web onboarding (`apps/web/src/app/(app)/layout.tsx:19-35`) profil + legal consent + address kontrolu yapar. Mobile sadece profile bakiyor.

### 2.3 [ORTA] Prisma Schema - Task Model EKSİK
**Konum:** `packages/shared/src/types.ts:112-126`
`Task` interface ve `taskSchema` var ama `schema.prisma` dosyasinda **Task modeli YOK** (1144 satir incelemesinde bulunamadi). MovingPlan'da `tasks?: Task[]` var ama DB tablosu yok.

### 2.4 [ORTA] Web Dashboard - Redirect Loop Riski
**Konum:** `apps/web/src/app/(app)/layout.tsx:38-42`
Onboarding tamamlanamazsa sonsuz redirect loop. Skip/logout butonu eksik.

### 2.5 [DUSUK] Web Middleware - isPublicPath Prefix Match
**Konum:** `apps/web/src/middleware.ts:44-49`
`/sign-in-attempt` yanlislikla public sayilir.

---

## 3. Eksik Sayfalar ve Moduller (Feature Parity)

### 3.1 Web'de Var, Mobile'da YOK
| Modul | Web | Mobile | Durum |
|-------|-----|--------|-------|
| Budget | `/(app)/budget/` | Yok | **Eksik** |
| Support/Tickets | `/(app)/support/` | Yok | **Eksik** |
| How it Works | `/how-it-works/` | Yok | **Eksik** |
| FAQ | `/faq/` | Yok | **Eksik** |
| Pricing | `/pricing/` | Yok | **Eksik** |
| Contact | `/contact/` | Yok | **Eksik** |
| Document Upload | Var | Yok | **Eksik** |
| Notifications (merkezi) | `/(app)/notifications/` | Ayrı sayfa | Parcali |

### 3.2 Admin'de Var, Web/Mobile'da Yok
| Modul | Admin | Web/Mobile |
|-------|-------|------------|
| Analytics | Tam | Widget / Yok |
| Backups | Tam | Yok |
| Email Templates | Tam | Yok |
| Feature Flags | Tam | Runtime config |
| Logs | Tam | Yok |
| Reports | Tam | Yok |
| Runtime Config | Tam | Yok |
| Security Events | Tam | Yok |
| Team Management | Tam | Yok |
| User Impersonation | Tam | Yok |

### 3.3 Mobile'da Var, Web'de Yok
| Modul | Mobile | Web |
|-------|--------|-----|
| Expo IAP (In-App Purchase) | Var | Sadece Stripe |
| Native Push Notifications | Var | Yok |
| Offline Mode (PersistQueryClient) | Var | Yok |
| Biometric Auth (SecureStore) | Potansiyel | Yok |

---

## 4. Eksik Baglantilar ve Route Hatalari

### 4.1 Waitlist Sayfasi - Bos Klasor
**Konum:** `apps/web/src/app/waitlist/` (0 items)
Landing page'den link var ama icerik yok, 404 doner.

### 4.2 Legal Sayfalar - Bos Klasorler
**Konum:**
- `ccpa-privacy-notice/` (0 items)
- `acceptable-use/` (0 items)
- `dpa/` (0 items)
- `security/` (0 items)
Footer'dan link var, 404 donerler.

### 4.3 Admin Health Endpoint - Auth Gerekiyor
**Konum:** `SYSTEM_STATUS.md:189-191`
```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3001/api/health
```
Health check auth gerektiriyor (anti-pattern, ops monitoring icin public olmali).

---

## 5. Vaat Edilen Ozellik Hatalari

### 5.1 Landing Page - Yaniltici Metinler
- "Mobile apps — coming soon": App tamamen hazir
- "2,400+ moves organized": Placeholder sayilar, gercek metrik degil
- "120k+ services tracked": Placeholder
- "4.8 Beta rating": Placeholder

### 5.2 Billing Plans - Family ve Pro Uc Noktalar
**Konum:** `packages/shared/src/billing.ts`
```typescript
export const UPCOMING_BILLING_PLAN_ORDER = ["FAMILY", "PRO"] as const;
```
FAMILY ve PRO planlari marketing sayfalarinda "Coming soon" olarak gosteriliyor ama Stripe/App Store/Play Store'da product mapping yok. Kullanici bu planlari secerse hata alir.

### 5.3 Document OCR - Vaat Edilmis Ama Erisilebilirligi Belirsiz
Landing page'de "Document OCR" vaat ediliyor (`page.tsx:331`). Ancak mobile app'da document upload/ocr feature'u tam implemente edilmemis gorunuyor.

---

## 6. Performans ve Mimari Oneriler

### 6.1 Schema ve Veritabani
- `Task` modeli eklenmeli veya `MovingPlan` ile `Task` iliskisi kaldırilmali
- `Budget` mobile'a eklenmeli (DB schema hazir)
- `NotificationPreference` modeli var ama mobile push notification integration tamamlanmali

### 6.2 Auth Mimari
- Web ve Admin middleware'da DB session kontrolu icin edge-compatible bir cozum (Durable Objects, KV store, veya kisa TTL)
- Admin rate limiting implementasyonu
- Mobile refresh token pattern (su an sadece 30 gunluk static JWT)

### 6.3 API Guvenlik
- `/api/internal/*` endpoint'lerin auth mekanizmasi gozden gecirilmeli
- Cron endpoint'leri fail-closed tasarim (CRON_SECRET yoksa 403)
- File upload path traversal kontrolu (R2/local disk)

### 6.4 I18n
- Sadece `en` ve `es` destekleniyor. Daha fazla dil icin hazirlik yapilmali.
- `landing.tsx` gibi bazi component'lerde hardcoded string'ler (`"Loved by Movers Everywhere"`) var.

---

## 7. Genel Duzeltme ve Gelistirme Onerileri

### Acil (1 hafta)
1. Admin middleware'a rate limiting ekle
2. Landing page'deki "coming soon" metnini kaldir (mobile live)
3. Mobile onboarding kontrolunu web ile ayni hale getir (legal consent + address check)
4. Waitlist ve bos legal sayfalarina icerik ekle veya linkleri kaldir
5. Admin health endpoint'ini public yap (ops icin)

### Kisa Vadeli (1 ay)
1. Task modelini Prisma schema'ya ekle veya MovingPlan'dan kaldir
2. Web middleware'a JWT revocation/DB session sync mekanizmasi ekle
3. Mobile'e Budget modulunu ekle (API hazir, sadece UI)
4. Mobile'e Support/Tickets sayfasi ekle
5. Encryption module'a development'da dummy key ekle (plaintext kaldır)

### Orta Vadeli (1-3 ay)
1. Mobile'da document upload + OCR implementasyonu
2. Web push notifications (mobile parity)
3. Family ve Pro billing planlarinin Stripe/App Store entegrasyonu
4. Admin analytics widget'larini web dashboard'a tasima
5. Offline mode web PWA olarak implemente et

---

*Rapor sonu. Detayli kod referanslari her bulgunun yaninda belirtilmistir.*
