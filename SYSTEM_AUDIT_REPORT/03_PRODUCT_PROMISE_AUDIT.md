# Ürün Vaadi Denetimi

## Özet Tablo

| ID | Vaat | Kod Karşılığı | Sonuç |
|---|---|---|---|
| AUD-001 | Belgeleri servislerle saklama | Validator/UI copy var; DB/API upload yok | ❌ |
| AUD-002 | "Snap a bill" / bill capture | Mobile camera/document picker yok | ❌ |
| AUD-003 | USPS forwarding setup automatically | Connector gated/guided/API_SYNC koşullu | ⚠️ |
| OK-001 | Address/service/reminder tracking | Address/Service/Reminder modelleri ve API'leri var | ✅ |
| OK-002 | CSV/PDF export | `/api/export`, `/api/export/pdf` var | ✅ |
| OK-003 | Web/mobile subscription | Stripe + IAP route/webhook mevcut | ✅ |
| OK-004 | Notification feed/preferences | Feed/preferences/push register route'ları var | ✅ |

## Vaat: Belgeler ve "Documents in one place"

### Vaat Nerede Geçiyor?
- `apps/web/src/app/how-it-works/page.tsx`: "Documents in one place", "Store contracts, receipts, and proof-of-address..."
- `apps/web/src/app/about/page.tsx`: documents ve exports ürün kapsamına alınmış.
- `apps/web/src/lib/public-ai-discovery.ts`: household documents ve provider records.
- `apps/web/src/app/(app)/services/[id]/page.tsx`: `service.documents` varsa Documents kartı render ediyor.

### Kullanıcıya Ne Söyleniyor?
Kullanıcı sözleşme, fatura, receipt ve proof-of-address dosyalarını servisin yanında saklayabilecek.

### Kodda Karşılığı Var mı?
**Hayır / çok kısmen.**

### Backend Karşılığı
`apps/web/src/lib/validators.ts` içinde `documentUploadSchema` var; ancak `packages/db/prisma/schema.prisma` içinde `Document` modeli veya `Service.documents` relation bulunamadı. `/api/services/[id]` route'u service include içinde documents ilişkisinin okumuyor.

### Frontend Karşılığı
Service detail documents kartı sadece `service.documents && length > 0` ise görünür; gerçek upload/CRUD ekranı veya route'u bulunamadı.

### Database Karşılığı
Bulunamadı. `fileName` alanı `BackupRecord` modeline ait; Document veri modeli değil.

### Permission/Auth Karşılığı
Belge upload/download olmadığı için dosya access-control, content type allowlist, signed URL, delete retention gibi kontroller yok.

### Edge Case Denetimi
- Boş state: Belgeler hiç görünmez.
- Hata state: Upload/download olmadığı için yok.
- Yetkisiz kullanıcı: Belge API olmadığı için test edilemiyor.
- Mobil görünüm: Mobile document capture bulunmadı.

### Sonuç
❌ Vaat var ama sistem karşılamıyor.

### Öneri
Launch öncesi belge iddiasını kaldır veya Document modeli, storage, upload, download, delete, access-control, malware/content-type policy ve tests ile tamamla.

## Vaat: "Snap a bill"

### Vaat Nerede Geçiyor?
- `apps/web/src/i18n/messages/en.json`: `landing.mobile_body` içinde "Snap a bill, get a renewal nudge..."

### Kullanıcıya Ne Söyleniyor?
Mobile deneyimde fatura fotoğrafı çekilip servis/renewal bilgisine dönüştürülebilir beklentisi doğuyor.

### Kodda Karşılığı Var mı?
**Hayır.**

### Backend Karşılığı
Document/OCR/bill parse endpoint bulunmadı.

### Frontend/Mobile Karşılığı
`apps/mobile/STORE_SUBMISSION_CHECKLIST.md` ve `MOBILE_DATA_INVENTORY.md` camera, image-picker, document-picker, expo-camera kullanılmadığını söylüyor. `apps/mobile/package.json` içinde bu capture bağımlılıkları yok.

### Database Karşılığı
Document/OCR/bill snapshot modeli yok.

### Sonuç
❌ Vaat var ama sistem karşılamıyor.

### Öneri
"Snap a bill" copy'sini kaldırıp "add bill details" gibi manuel kayıt diline çek veya mobile capture/OCR feature'ını gerçek release kapsamına al.

## Vaat: USPS forwarding setup, automatically

### Vaat Nerede Geçiyor?
- `apps/web/src/i18n/messages/en.json`: `landing.mm_bullet_1`.
- Connector metinleri ve pricing comparison tarafında API sync/partner network ifadeleri.

### Kullanıcıya Ne Söyleniyor?
USPS forwarding setup'ın LocateFlow tarafından otomatik başlatıldığı algısı oluşuyor.

### Kodda Karşılığı Var mı?
**Kısmen / koşullu.**

### Backend Karşılığı
Connector altyapısı var: `PartnerConsent`, `ConnectorConfig`, `AddressChangeEvent`, `ConnectorDispatch`, `connector-runtime.ts`, `packages/connectors`. Ancak runtime feature flag, entitlement, consent, connector stage, production agreement ve config gerektiriyor. Catalog route comment'i connector'ın production agreement/credential olmadan GUIDED kaldığını belirtiyor.

### Frontend Karşılığı
Connector section `FEATURE_API_CONNECTORS` ile gated. Settings connections page "supported partners for API sync, or guided open-and-update" dilini kullanıyor.

### Database Karşılığı
Connector tabloları mevcut.

### Edge Case Denetimi
- Feature flag kapalı: API connector 503/guided behavior.
- Connector production agreement yok: GUIDED_UPDATE.
- Partner başarısız: NEEDS_USER notification.
- Kullanıcı consent yok: dispatch target oluşmaz.

### Sonuç
⚠️ Kısmen karşılanıyor; copy otomasyon seviyesini fazla iddialı anlatıyor.

### Öneri
Automatic USPS copy'sini "USPS forwarding guided setup" veya "we prepare the steps; you submit" diline çek. Automatic sadece `API_SYNC` + canlı partner config varsa conditional render edilmeli.

## Vaat: Address/service/reminder tracking

### Vaat Nerede Geçiyor?
Landing, FAQ, app navigation, mobile screens.

### Kodda Karşılığı Var mı?
**Evet.**

### Kanıt
- Prisma: `Address`, `Service`, `Reminder`, `MovingPlan`, `MoveTask`, `Budget`.
- API: `/api/addresses`, `/api/services`, `/api/moving`, `/api/budget`, cron reminder routes.
- UI: web app route'ları ve mobile tab screens.

### Sonuç
✅ Vaat doğru karşılanıyor.

### Öneri
Reminder cron test ve batch standardizasyonu yapılmalı.

## Vaat: Export-ready CSV/PDF records

### Kodda Karşılığı Var mı?
**Evet.**

### Kanıt
- `apps/web/src/app/api/export/route.ts`: CSV/JSON.
- `apps/web/src/app/api/export/pdf/route.ts`: address/full/tax PDF, step-up verification, rate limit.
- `apps/web/src/lib/pdf/*`: PDF generators.

### Sonuç
✅ Vaat doğru karşılanıyor.

## Vaat: Paid plans and plan limits

### Kodda Karşılığı Var mı?
**Evet.**

### Kanıt
- `packages/shared/src/billing.ts`: plan definitions.
- `apps/web/src/lib/plan-limits.ts`: address/service/member/provider limits.
- `apps/web/src/app/api/stripe/checkout/route.ts`: server-side plan/price validation.
- `apps/mobile/src/lib/subscription-visible-plans.ts`: mobile store visibility.

### Sonuç
✅ Vaat doğru karşılanıyor.

## Vaat: Notifications

### Kodda Karşılığı Var mı?
**Kısmen/Evet.**

### Kanıt
- `apps/web/src/lib/notifications.ts`: email, push, SMS switch.
- `apps/web/src/lib/in-app-notifications.ts`: in-app create.
- `/api/notifications/feed`, `/api/notifications/preferences`, `/api/push/register`.

### Eksik/Risk
SMS provider yok; push env/capability bağımlı; in-app dedupe unique değil.

### Sonuç
⚠️ Kısmen karşılanıyor.
