# Vendor Contact Book

- **Status**: Proposed (Pro launch, Sprint 3)
- **Tier**: Pro (Family/Individual locked-state preview)
- **Related decisions**: D3 (field-level visibility — vendor entries hassas PII), D6 (AddressChangeTarget.targetType=CUSTOM scope vendor'ları içerir), D15 (Day 1 zero partner agreement → vendor user-defined template'lere fallback), D2 (entitlement owner subscription'ından çıkar)
- **Related docs**: [12](./12-address-change-target-model.md), [22](./22-child-role.md), [34](./34-service-provider-action-registry.md), [35](./35-partner-sync-attempts.md), [37](./37-partner-pdf-letter-generator.md), [38](./38-partner-mailto-templates.md), [50](./50-admin-workspace-inspector.md), [63](./63-entitlement-banners-empty-states.md)

---

## Amaç

Pro kullanıcı kendi **özel partner'ını** (kişisel avukat, muhasebeci, veteriner, tamirci, terzisi — global ServiceProvider catalog'unda olmayan kişi/işletme) **Vendor Contact Book**'a kaydeder. Adres değişikliği event'i yaratırken bu vendor'ları **CUSTOM scope target** olarak seçebilir; vendor için user-defined mailto body veya PDF notu üretilir.

Schema temeli **mevcut**: `UserCustomProvider` (schema satır 788). Bu özellik o tabloya iletişim & kanal field'ları ekler ve Pro UI'sını ortaya çıkarır.

## Kapsam

**In scope (MVP)**
- `UserCustomProvider` üzerine `contactName`, `contactEmail`, `contactPhone`, `preferredChannel`, `customMailtoBody`, `customPdfTemplateNotes` eklenir
- `/vendor-book` Pro-only web sayfası: list / add / edit / delete
- Mobile `apps/mobile/app/vendor-book/index.tsx` + `add.tsx` + `[id].tsx`
- Address Change Wizard'da (cross-ref [13](./13-address-change-wizard-web.md)) **CUSTOM scope** seçilince vendor picker görünür
- PartnerSyncAttempt vendor için `providerActionId = null`, yerine `customProviderId` referansı (cross-ref [35](./35-partner-sync-attempts.md) — şema değişikliği orada belgelenecek)
- Family/Individual/Free için locked empty-state (cross-ref [63](./63-entitlement-banners-empty-states.md))

**Out of scope**
- Vendor'lar arası paylaşım (workspace üyeleri arası shared vendor) — MVP **PER-USER private**, workspace-wide DEĞİL. Schema'da zaten `UserCustomProvider.userId`. Workspace-wide vendor Faz 2.
- Vendor verisinden global ServiceProvider önerisi ("Aynı vendor başka 50 kullanıcıda var, catalog'a ekleyelim mi?") — admin tooling Faz 2 (cross-ref [54](./54-admin-partner-claim-queue.md) ile birleştirilebilir)
- Vendor için custom PDF template editor — sadece **notlar** taşır, render template kullanıcının seçtiği genel "generic letter" template'i kullanır
- Vendor logo upload — MVP'de yok
- VCF/Google Contacts import — Faz 2

## User stories

- As Pro user, kişisel avukatımı vendor book'a ekleyeyim ki taşınma event'i yaratırken **CUSTOM scope** ile onu da target listeme alabileyim.
- As Pro user, vendor için **email + telefon + adres** tutabileyim — adres değişikliği bildirimi email mi PDF mi telefon mu olacak ben seçeyim.
- As Pro user, taşınma için vendor'a göndereceğim **mailto body'sini önceden hazırlayıp** kaydedebileyim — her event'te tekrar yazmayayım.
- As Family user, "Vendor Book" başlığını görüp **Pro'ya yükselt** CTA'sını tıklayabileyim (sales funnel).
- As workspace ADMIN, başka üyenin vendor'larını **görmeyeyim** — bu kişisel PII (avukat ismi). Sadece kendiminkileri görürüm.
- As support agent, kullanıcı "vendor book'umu silebilir misin" derse admin inspector'dan **read-only** görüp manual silebileyim (cross-ref [50](./50-admin-workspace-inspector.md)).

## Veri modeli

```prisma
model UserCustomProvider {
  // ... mevcut alanlar (schema satır 788–831) ...

+ contactName       String? @db.VarChar(120)
+   // "Av. Ahmet Yılmaz", "Dr. Smith"
+ contactEmail      String? @db.VarChar(191)
+ contactPhone      String? @db.VarChar(30)
+ preferredChannel  String  @default("EMAIL") @db.VarChar(20)
+   // EMAIL | PHONE | PDF | VISIT | OTHER
+ customMailtoBody  String? @db.Text
+   // user-authored, NO {{placeholder}} substitution server-side
+   // user manuel yazar; nedeni: vendor'a özel ton/tarz
+ customPdfNotes    String? @db.Text
+   // generic PDF template'ine eklenecek serbest not
+ isVendorBookEntry Boolean @default(false)
+   // true = explicit vendor book entry (Pro feature)
+   // false = legacy UserCustomProvider (mevcut servis create akışından gelen)
+   // gate'lemek için kullanılır; mevcut row'lar false kalır

+ @@index([userId, isVendorBookEntry])
}
```

**`AddressChangeTarget`** ile ilişki (cross-ref [12](./12-address-change-target-model.md)): target `targetType=CUSTOM` + `customProviderId` (yeni field [12](./12-address-change-target-model.md)'de tanımlı) ile vendor'a bağlanır.

**Encryption**: `contactEmail`, `contactPhone`, `customMailtoBody`, `customPdfNotes` PII'dir. D3 gereği field-level visibility yok (UserCustomProvider zaten user-private), ama at-rest encryption için: `customMailtoBody` ve `customPdfNotes` Faz 2'de `packages/shared/src/encryption.ts` ile şifrelenebilir. **MVP'de plaintext** (DB-level encryption RDS/PostgreSQL transparent disk encryption ile yeterli kabul edilir; doc'ta not).

## API endpoint'leri

### Yeni

| Method | Path | Auth | Workspace ctx | Body | Response | Errors |
|---|---|---|---|---|---|---|
| GET | `/api/vendors` | session | `requireWorkspaceContext` (Pro entitlement check) | — | `{ vendors: VendorDto[] }` | 401, 403 (plan < PRO) |
| POST | `/api/vendors` | session | `requireWorkspaceContext` (Pro) | `{ name, category, contactName?, contactEmail?, contactPhone?, addressLine1?, ..., preferredChannel, customMailtoBody?, customPdfNotes? }` | `201 { vendor }` | 401, 403, 422 (validation), 429 |
| GET | `/api/vendors/:id` | session | `requireWorkspaceContext` (Pro) | — | `{ vendor }` | 401, 403, 404 |
| PATCH | `/api/vendors/:id` | session | `requireWorkspaceContext` (Pro) | partial vendor | `200 { vendor }` | 401, 403, 404, 422 |
| DELETE | `/api/vendors/:id` | session | `requireWorkspaceContext` (Pro) | — | `204` (soft delete: `deletedAt = now()`) | 401, 403, 404, 409 (vendor aktif event'te target ise) |

**Soft delete** (`deletedAt` zaten schema'da var, satır 820). Aktif event'te target ise 409 + "Önce event'i tamamlayın/iptal edin".

**Plan gate**: `requireWorkspaceContext` resolved entitlements'ten `entitlements.vendorBook === true` (PRO için true, diğer planlar için false). Gate `packages/shared/src/entitlements.ts` (D4 kod-bazlı gating).

**Rate limit**: POST 30/saat/user (kötüye kullanım), GET sınırsız.

### Mevcut endpoint'lere etki

- **`/api/custom-providers`** (varsa) — bu vendor entry'leri **listede gözükür** (vendor book entry de bir UserCustomProvider'dır). Service create akışında (`POST /api/services`) `customProviderId` ile bağlanabilir — yani bir vendor hem servis sağlayıcı hem adres change target olabilir.
- **`/api/events`** POST body'sinde `customTargets: [{ customProviderId, ...}]` array'i kabul eder (CUSTOM scope için).
- **`/api/profile/export`** — DSAR export'a vendor entries dahil.

## Web

### Yeni sayfa/route

`apps/web/src/app/(workspace)/vendor-book/page.tsx` — list view:
- Header "Vendor Contact Book" + add button
- Search input (name, category)
- Grid card view: vendor name, contact name, preferred channel badge, edit/delete
- Empty state (no vendors): illustration + "Add your first vendor"
- Empty state (Pro değil): lock illustration + "Upgrade to Pro to add personal vendors" → checkout link (cross-ref [31](./31-pro-checkout-flow.md))

`apps/web/src/app/(workspace)/vendor-book/new/page.tsx` — add form:
- Vendor name (required), category (dropdown: Legal, Medical, Financial, Auto, Other)
- Contact name, email, phone
- Address (optional)
- Preferred channel (radio: Email / Phone / PDF / Visit)
- Custom mailto body (textarea, shown if channel=Email)
- Custom PDF notes (textarea, shown if channel=PDF)

`apps/web/src/app/(workspace)/vendor-book/[id]/page.tsx` — edit (aynı form, pre-filled).

### Mevcut sayfalara etki

- **Address Change Wizard** (cross-ref [13](./13-address-change-wizard-web.md)) — CUSTOM scope adımında vendor picker eklenir; "Select from Vendor Book (Pro)" link. Pro değilse disabled + upgrade tooltip.
- **Workspace dashboard sidebar** — "Vendor Book" navigation entry (Pro için aktif, diğer planlar için lock icon + tooltip).

### Componentler (file paths)

- `apps/web/src/app/(workspace)/vendor-book/page.tsx`
- `apps/web/src/components/vendor-book/VendorList.tsx`
- `apps/web/src/components/vendor-book/VendorCard.tsx`
- `apps/web/src/components/vendor-book/VendorForm.tsx` (new + edit ortak)
- `apps/web/src/components/vendor-book/VendorBookLockedState.tsx` (Family/Individual için)
- `apps/web/src/components/wizard/VendorPickerStep.tsx` (event wizard CUSTOM scope)
- `apps/web/src/lib/api/vendors.ts` — fetch wrapper

### Butonlar / actionlar

- **Add vendor** → `/vendor-book/new`
- **Edit** → `/vendor-book/{id}` form
- **Delete** → confirm modal, soft delete
- **Use in next move** → vendor card'da quick action: yeni event wizard'ını CUSTOM scope + vendor pre-selected ile açar

## Mobile

### Yeni ekran

- `apps/mobile/app/(workspace)/vendor-book/index.tsx` — list
- `apps/mobile/app/(workspace)/vendor-book/new.tsx` — add form
- `apps/mobile/app/(workspace)/vendor-book/[id].tsx` — edit/detail

Mobile satış değil tüketim (D11) — Pro değilse lock screen + "Upgrade on web" link (cross-ref [60](./60-mobile-billing-readonly.md)).

### Mevcut ekranlara etki

- Drawer/tab navigation'a "Vendor Book" entry (Pro için unlock).
- Address change wizard mobile (cross-ref [13](./13-address-change-wizard-web.md) mobile counterpart) CUSTOM scope adımı.

### Componentler

- `apps/mobile/src/features/vendor-book/VendorList.tsx`
- `apps/mobile/src/features/vendor-book/VendorForm.tsx`
- `apps/mobile/src/features/vendor-book/VendorCard.tsx`
- `apps/mobile/src/lib/api/vendors.ts`

## Admin

### Yeni sayfa

Yok. Mevcut Workspace Inspector (cross-ref [50](./50-admin-workspace-inspector.md))'a sekme:
- **"Vendors"** tab — workspace üyelerinin vendor book entries listesi (per-user grup).
- **Read-only** — admin edit/delete YAPAMAZ (kullanıcı PII).
- Sadece **soft delete** seçeneği — destek talebi geldiyse admin not + reason zorunlu, AdminAuditLog yazılır.

### Yetenekler

- Inspect (view-only fields)
- "Anonymize this vendor" — GDPR delete request için (vendor row'u `name="REDACTED"`, contact field'ları null'a çekilir; tarihçe için row silinmez, sadece anonimize).

## Güvenlik

- [x] **Step-up auth?** Hayır vendor CRUD için. CUSTOM scope event create sırasında D10 event-level step-up çalışır.
- [x] **PII redaction?** Vendor adı + iletişim PII'dir. Workspace üyeleri arası **paylaşılmaz**; sadece `userId` sahibi görür. Server query'lerinde `where: { userId: callerUserId, ... }` zorunlu. Admin inspector'da gösterim için `AdminAuditLog(action="VIEW_VENDOR")` yazılır.
- [x] **Audit log?** Vendor create/update/delete: `AuditLog(action, entityType="UserCustomProvider:Vendor", entityId)`. Admin view: `AdminAuditLog`.
- [x] **Rate limit?** POST 30/saat, PATCH 60/saat. GET sınırsız.
- [x] **Permission matris?** OWNER, ADMIN, MEMBER: kendi vendor'larını yönetir. CHILD (cross-ref [22](./22-child-role.md)): **vendor book erişimi YOK** (CHILD finansal/profesyonel ilişki yönetmez). VIEW_ONLY: erişim yok. Plan gate: Pro entitlement zorunlu.
- [x] **Encryption at rest?** Email/phone/body field'ları **MVP plaintext** (RDS encryption-at-rest yeterli kabul edilir). Faz 2'de application-level encryption ile `packages/shared/src/encryption.ts` (mevcut accountNumber pattern).
- [x] **GDPR DSAR?** `/api/profile/export` vendor list'i export eder. Vendor `DELETE` cascade davranışı: vendor silindiyse aktif event target'ı varsa 409 (önce event'i temizle); kullanıcı hesabını siliyorsa `User.onDelete: Cascade` zaten vendor'ı siler.

## Migration / backward compat

- 6 yeni nullable kolon + 1 default'lu kolon (`isVendorBookEntry`).
- Mevcut `UserCustomProvider` row'ları `isVendorBookEntry=false` kalır → vendor book UI'sında gözükmez.
- Yeni vendor book entry'ler `isVendorBookEntry=true` yaratılır.
- API queries `where: { isVendorBookEntry: true }` filter kullanır.
- `linkedServiceProviderId` (schema satır 813) kalır — kullanıcı vendor'ını global catalog'a "linkable" işaretleyebilirse Faz 2.

## Etkilenen mevcut özellikler

- **Service create** (`apps/web/src/app/api/services/route.ts` veya benzeri): UserCustomProvider yaratırken default `isVendorBookEntry=false` (legacy davranış korunur).
- **Profile export DSAR**: vendor list eklenir.
- **AddressChangeTarget model** (cross-ref [12](./12-address-change-target-model.md)): `customProviderId` field bu spec'i mümkün kılan key dependency.
- **PartnerSyncAttempt** (cross-ref [35](./35-partner-sync-attempts.md)): vendor target için `providerActionId=null` + `customProviderId` set; UI render'da channel `vendor.preferredChannel` üzerinden çözülür, deep-link/mailto/PDF üretimi vendor'ın custom body/notes'unu kullanır.
- **Entitlements** (cross-ref [06](./06-entitlements-system.md)): `entitlements.vendorBook: boolean` eklenir, `actionTierAllowedForPlan` gibi pattern (D4).

## Test plan

**Unit**
- VendorForm validation: required name, email format, phone format
- `isVendorBookEntry` filter: legacy custom provider'lar `/api/vendors` GET'inde gelmez
- Pro entitlement gate: Individual user POST → 403

**Integration**
- POST /api/vendors → 201, isVendorBookEntry=true
- GET → sadece caller'ın vendorları
- Başka user'ın vendor id'siyle GET → 404 (403 değil, leak yapmasın)
- DELETE aktif event target'ı → 409
- Pro → Family downgrade: GET hâlâ çalışır mı? (D2 grace period) → 7 gün read-only sonra 403

**E2E (Playwright)**
- Pro user: vendor ekle, edit, delete
- CUSTOM scope wizard'da vendor seç → event yaratıldı, target row'unda `customProviderId` set
- Family user: `/vendor-book` → locked state + upgrade CTA görür

**Manual**
- Mobile add vendor offline → queue (mevcut offline pattern varsa)
- Pro abone iptal etti → 7 gün sonra vendor book read-only banner
- Türkçe karakter vendor adı (Av. Ömer Ünlü) DB + UI doğru

## Açık sorular

1. CHILD rolü vendor book hiç görmeyecek mi? Çocuğun kendi terapisti olabilir. **Karar**: MVP'de hayır (UI complexity); Faz 2 değerlendirilir.
2. Vendor için "Last contacted" timestamp tutalım mı? **Karar**: PartnerSyncAttempt'ten zaten türetilebilir (vendor'lı attempt'lerin `lastOpenedAt` max'i). Ayrı kolon eklemeyelim.
3. Vendor sınıflandırması (`category`) önceden tanımlı enum mu, free-text mı? **Öneri**: enum + "Other" + free-text alt-field (filter UX için).
4. customMailtoBody {{placeholder}} substitution destekleyelim mi (cross-ref [38](./38-partner-mailto-templates.md))? **Karar**: MVP'de hayır (vendor zaten user-private, user kendi yazıyor zaten); Faz 2'de placeholder helper UX eklenebilir.
5. Vendor limit (Pro için kaç vendor)? **Öneri**: Pro 100 vendor (entitlements'a `maxVendors: 100`). Aşımda inline upsell yok, sınır soft.
