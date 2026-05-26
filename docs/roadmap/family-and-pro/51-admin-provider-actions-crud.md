# Admin Provider Actions CRUD

> **Drift fix 2026-05-23** — Çelişkili değerler [`01a-canonical-values.md`](./01a-canonical-values.md) (§C7, §C8) ile geçersizdir. **Dotted permission kodu `provider.actions.write` YASAK** (D25 / §C8); bunun yerine `ADMIN_RESOURCES`'a `provider_actions` resource'u eklenir, route'lar `provider_actions.canCreate/canUpdate/canDelete` flag'lerini kontrol eder. `ServiceProviderAction.actionType` canonical `@db.VarChar(30)` (§C7), `channel/actionTier @db.VarChar(20)`.

- **Status**: Proposed (Family/Pro launch, Sprint 2)
- **Tier**: Admin
- **Related decisions**: D4 (action tier kodda, plan-gating kodda; DB'de `tier: BASIC|EXTENDED|PREMIUM`), D15 (Day 1 partner anlaşması yok — deep-link + PDF + mailto), D25 (ADMIN_RESOURCES extension)
- **Related docs**: [`34-service-provider-action-registry.md`](./34-service-provider-action-registry.md), [`52-admin-provider-csv-import.md`](./52-admin-provider-csv-import.md), [`53-admin-sync-attempts-dashboard.md`](./53-admin-sync-attempts-dashboard.md), [`36-partner-deep-link-launcher.md`](./36-partner-deep-link-launcher.md), [`37-partner-pdf-letter-generator.md`](./37-partner-pdf-letter-generator.md), [`38-partner-mailto-templates.md`](./38-partner-mailto-templates.md)

## Amaç

Admin'in bir `ServiceProvider` (örn. "Comcast Xfinity") için **adres değişikliği aksiyonu** ekleyip düzenleyebilmesi: hangi URL'e yönlendirir, hangi mailto subject/body göndertir, hangi PDF template'i basar. Sprint 2 sonunda admin elinden 50+ partner action seed edilmiş olmalı.

D15 gereği lansman partner sync stratejisi: hiçbir gerçek API anlaşması yok; kullanıcı deep-link'e tıklar, clipboard'da hesap no ve yeni adres, partner sitesinde paste eder. Bu UI o stratejinin admin-side editor'üdür.

## Kapsam

**In scope**
- `/providers/[providerId]/actions` list
- `/providers/[providerId]/actions/new`
- `/providers/[providerId]/actions/[actionId]/edit`
- Form: actionType, channel, urlTemplate, mailtoTemplate, pdfTemplateKey, requiredFields multi-select, supportsHousehold, supportsBusinessAddress, actionTier, averageMinutes, instructionsMd
- Live preview (Partner Hub'taki kullanıcı görünümü)
- URL domain whitelist validation
- mailto template placeholder validation
- "Test as user" simulator
- Soft delete (`deletedAt`)
- AdminAuditLog full diff

**Out of scope**
- Domain whitelist yönetim sayfası (ayrı doc; bu doc onu **tüketir**)
- Provider CRUD (mevcut `apps/admin/src/app/(admin)/providers/`'de zaten var)
- PDF template registration (hardcoded React PDF components; bu UI sadece olanları listeler)
- Versioning / rollback (Faz 2; MVP soft delete yeterli)

## User stories

- As an **Admin** (with `provider.actions.write`): Comcast için yeni bir `DEEP_LINK` action ekle; URL `https://www.xfinity.com/account/move?fromAddr={{oldStreet}}&toAddr={{newStreet}}`. Domain `xfinity.com` whitelist'te → save başarılı.
- As an **Admin**: yanlışlıkla `urlTemplate` içine `httpx://...` yazdım → form save'i typo regex'ten patlatır, ne form kaybolur ne data kayıt edilir.
- As an **Admin**: "Test as user" butonuna basıyorum; arka planda dummy data ile bir `PartnerSyncAttempt` (test mode flag) oluşturulur ve sonuç preview gösterilir; gerçek user verisi etkilenmez.
- As a **support agent** (sadece `provider.read`): action listesi okuyabilir, ne ekler ne düzenler.

## Veri modeli

`ServiceProviderAction` doc 34'te tanımlanır. Bu doc **yeni alan eklemez**, sadece kullanır:

```prisma
model ServiceProviderAction {
  id                      String   @id @default(cuid())
  providerId              String
  provider                ServiceProvider @relation(fields: [providerId], references: [id])
  actionType              ActionType   // CHANGE_ADDRESS | TRANSFER_SERVICE | CANCEL | NOTIFY_ONLY
  channel                 ActionChannel // DEEP_LINK | MAILTO | PDF | PHONE | API
  urlTemplate             String?       // for DEEP_LINK
  mailtoSubjectTemplate   String?       // for MAILTO
  mailtoBodyTemplate      String?       // for MAILTO
  pdfTemplateKey          String?       // for PDF; FK-like to packages/shared/src/pdf-templates registry
  requiredFields          String[]      // ["accountNumber", "phoneNumber"]
  supportsHousehold       Boolean  @default(false)
  supportsBusinessAddress Boolean  @default(false)
  actionTier              ActionTier    @default(BASIC)
  averageMinutes          Int?
  instructionsMd          String?       @db.Text
  isActive                Boolean  @default(true)
  deletedAt               DateTime?
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
  createdByAdminId        String?
  lastUpdatedByAdminId    String?
}
```

New `AdminPermission` row: `provider.actions.write`.

## API endpoint'leri

### Yeni

| Method | Path | Auth | Permission | Body | Response | Errors |
|---|---|---|---|---|---|---|
| GET | `/api/admin/providers/[providerId]/actions` | Admin | `provider.read` | — | `{ items: ServiceProviderAction[] }` | 403, 404 |
| POST | `/api/admin/providers/[providerId]/actions` | Admin | `provider.actions.write` | `ServiceProviderActionInput` | `{ action }` | 400 (validation), 403, 404, 422 (domain not whitelisted) |
| GET | `/api/admin/providers/[providerId]/actions/[id]` | Admin | `provider.read` | — | `{ action }` | 403, 404 |
| PATCH | `/api/admin/providers/[providerId]/actions/[id]` | Admin | `provider.actions.write` | `Partial<ServiceProviderActionInput>` | `{ action }` | 400, 403, 404, 422 |
| DELETE | `/api/admin/providers/[providerId]/actions/[id]` | Admin | `provider.actions.write` | — | `{ id, deletedAt }` | 403, 404, 409 (already deleted) |
| POST | `/api/admin/providers/[providerId]/actions/[id]/test` | Admin | `provider.actions.write` | `{ fakeUserData? }` | `{ renderedUrl?, renderedMailto?, pdfPreviewUrl? }` | 403, 404 |
| GET | `/api/admin/provider-action-templates/pdf` | Admin | `provider.read` | — | `[{ key, label, description }]` | 403 |
| GET | `/api/admin/provider-domain-whitelist` | Admin | `provider.read` | — | `{ domains: string[] }` | 403 |

Validation server-side (Zod schema'sı `packages/shared/src/provider-action-schema.ts`):
- `urlTemplate` mevcutsa: `new URL(replacePlaceholders(urlTemplate, dummy))` parse edilmeli, protocol `https:`, domain whitelist'te
- `mailtoSubjectTemplate` + `mailtoBodyTemplate`: placeholder regex `{{[a-zA-Z][a-zA-Z0-9_]*}}` ile tüm tokenlar çıkarılıp known list (`PLACEHOLDER_REGISTRY`) ile karşılaştırılır; bilinmeyen token = 400
- `pdfTemplateKey`: registry içinde olmalı
- channel === MAILTO ise subject + body zorunlu; channel === DEEP_LINK ise urlTemplate zorunlu; channel === PDF ise pdfTemplateKey zorunlu; channel === PHONE ise instructionsMd zorunlu; channel === API → MVP'de 422 ("API channel not enabled in MVP per D15")

### Mevcut endpoint'lere etki

- `apps/admin/src/app/api/providers/route.ts` (382 line): değişmez. Yeni route nested altında.
- Provider detail page'i (mevcut) — "Actions" tab eklenir; link `/providers/[providerId]/actions`'a.

## Web (admin app)

### Yeni sayfa/route

- `apps/admin/src/app/(admin)/providers/[providerId]/actions/page.tsx` — list table
- `apps/admin/src/app/(admin)/providers/[providerId]/actions/new/page.tsx`
- `apps/admin/src/app/(admin)/providers/[providerId]/actions/[actionId]/edit/page.tsx`
- `apps/admin/src/app/api/admin/providers/[providerId]/actions/route.ts`
- `apps/admin/src/app/api/admin/providers/[providerId]/actions/[id]/route.ts`
- `apps/admin/src/app/api/admin/providers/[providerId]/actions/[id]/test/route.ts`

### Mevcut sayfalara etki

- `apps/admin/src/app/(admin)/providers/[id]/page.tsx` (mevcut provider detail): "Actions (N)" linki ve tab eklenir.
- `apps/admin/src/lib/admin-auth.ts`: `provider.actions.write` permission code'u eklenir.

### Componentler

```
apps/admin/src/app/(admin)/providers/[providerId]/actions/_components/
  ActionList.tsx                  // table; channel + tier badge; soft-deleted gray
  ActionForm.tsx                  // shared by new + edit; react-hook-form + zod
  PlaceholderPalette.tsx          // sidebar click-to-insert {{newStreet}} etc.
  ChannelFieldset.tsx             // conditional fields per channel
  PdfTemplatePicker.tsx           // fetches /api/admin/provider-action-templates/pdf
  RequiredFieldsMultiSelect.tsx
  LivePreview.tsx                 // shows Partner Hub user-facing card
  TestAsUserPanel.tsx             // dummy data → POST .../test
  DomainWhitelistChip.tsx         // shows green/red based on extracted domain
  SoftDeleteDialog.tsx
```

`PLACEHOLDER_REGISTRY` (kaynak: `packages/shared/src/partner-placeholders.ts`):

```ts
export const PLACEHOLDERS = [
  { token: "newStreet",       label: "New street address" },
  { token: "newCity",         label: "New city" },
  { token: "newState",        label: "New state/region" },
  { token: "newZip",          label: "New ZIP/postal code" },
  { token: "newCountry",      label: "New country" },
  { token: "oldStreet",       label: "Old street address" },
  { token: "oldCity",         label: "Old city" },
  { token: "accountNumber",   label: "User's account number (requires requiredFields)" },
  { token: "phoneNumber",     label: "User's phone (requires requiredFields)" },
  { token: "moveDate",        label: "Planned move date" },
  { token: "userFullName",    label: "Member full name" },
  { token: "userEmail",       label: "Member email" },
] as const;
```

### Butonlar / actionlar

- **"+ Add action"** (list page header) → `/new`
- **"Save"** (form) → POST/PATCH; toast: "Action saved. Live in Partner Hub now." (or "in dev only" if `isActive=false`)
- **"Test as user"** (form sidebar) → opens panel; user picks "fake address dataset 1/2/3" → POST `.../test` → renders URL + opens new tab guarded behind extra "Confirm: open external URL"
- **"Soft delete"** (list row) → confirm → DELETE → row stays grayed with restore option
- **"Restore"** (deleted rows) → PATCH `{ deletedAt: null }`
- **"View sync stats"** (list row) → links to `/sync-attempts?providerActionId=...` (cross-ref 53)

## Mobile

N/A — admin web only.

## Admin permissions

| Code | What it gates | Step-up |
|---|---|---|
| `provider.read` | List + detail (existing, possibly already present in current providers page) | No |
| `provider.actions.write` | Create / update / delete / restore action; run test endpoint | No (low blast radius — domain whitelist + audit log yeterli) |

Step-up gerekmiyor — domain whitelist + audit log + soft-delete kombinasyonu yeterli savunma. Yanlış konfig user'a 1 tık'lık yanlış URL gösterir; user fark eder, sync attempt FAILED işaretlenir, admin dashboard'da görür (cross-ref 53).

## Güvenlik

- [ ] **Step-up admin auth** — gerekmez (yukarıda gerekçe).
- [x] **PII redaction** — "Test as user" endpoint'i **gerçek user verisi kullanmaz**; sadece hardcoded fake dataset. `LivePreview` da fake data kullanır.
- [x] **Audit log** — her POST/PATCH/DELETE `AdminAuditLog` yazar:
  ```ts
  {
    adminUserId, permission: "provider.actions.write",
    targetType: "ServiceProviderAction", targetId: action.id,
    action: "create" | "update" | "soft_delete" | "restore",
    beforeJson, afterJson,   // full diff
    metadataJson: { providerId, providerName }
  }
  ```
- [x] **Rate limit** — `test` endpoint admin başına 30/dakika (PDF render maliyetli).
- [x] **Permission matris** — `provider.actions.write` olmayan admin form'u read-only görür (save butonu disabled + tooltip).
- [ ] **Two-step confirmation** — sadece soft delete'te tek confirm yeterli.
- [x] **Domain whitelist enforcement** — `urlTemplate` save'inde server-side validation, client-side de uyarı; whitelist DB tablosu (`ProviderDomainWhitelist`) ayrı admin sayfasında yönetilir (bu doc kapsamı dışında).
- [x] **Placeholder typo guard** — bilinmeyen `{{xyz}}` token save'i engeller; user'a "%%bozuk%%" string'i ulaşmaz.

## Migration / backward compat

- `ServiceProviderAction` tablosu doc 34'te yaratılır; bu doc onun üstüne UI inşa eder.
- `AdminPermission` seed: `provider.actions.write` row'u ekle; default admin rolü'ne grant manuel.
- Mevcut hardcoded action seed'leri (Sprint 3'te 50+ partner) bu UI ile **edit edilebilir** olmalı — seed script `upsert` mode kullanır, manuel edit'leri ezmez (script `lastUpdatedByAdminId == null` olanları update eder).

## Etkilenen mevcut özellikler

- `apps/admin/src/app/(admin)/providers/[id]/page.tsx` — "Actions" tab eklenir, sayfa header'a action count badge.
- Partner Hub UI (doc 33) bu action'ları render eder; admin yanlış config'i Partner Hub'ta direkt görünür → live preview compulsory.
- CSV import (doc 52) `ServiceProviderActionInput`'un **aynı Zod schema'sını** kullanır.

## Test plan

- **Unit**
  - Zod schema: channel-spesifik required field eksikse error
  - `extractDomain("https://foo.bar/{{x}}") === "foo.bar"`
  - Placeholder parser bilinmeyen token bulursa error array döner
- **Integration**
  - POST action with non-whitelisted domain → 422 + body `{ code: "DOMAIN_NOT_WHITELISTED", domain: "..." }`
  - POST mailto action with unknown placeholder `{{newCty}}` → 400 + suggestion `{{newCity}}`
  - DELETE soft-deletes; subsequent GET list with `?includeDeleted=true` returns it
  - AuditLog row created with before/after JSON
- **E2E**
  - Admin login → providers list → Comcast detail → Actions tab → "+ Add" → fill DEEP_LINK form → Save → see in list → Edit → toggle `isActive=false` → confirm Partner Hub user-side sees disabled state
- **Manual**
  - "Test as user" rendered URL'i gerçek partner sitesinde manuel paste edip 200 dönmesini doğrula (Sprint 3 seed QA acceptance criteria)

## Açık sorular

1. PDF template registry'si dinamik mi (DB row) yoksa kod-tabanlı mı (`packages/shared/src/pdf-templates/index.ts` export)? Şu an: kod-tabanlı (versiyon ile commit edilir). Eğer admin yeni template istiyorsa eng task.
2. `urlTemplate` içinde encoded vs raw URL parametresi nasıl handle edilir (örn. `{{newStreet}}` boşluk içerebilir)? Karar: server-side render `encodeURIComponent` her placeholder'a uygulanır; admin form'da bilgi notu.
3. Action versioning Faz 2: aynı action'ın geçmişine bakmak istenirse `AdminAuditLog` diff'lerinden rebuild edilir — yeterli mi? Belki ayrı `ServiceProviderActionVersion` tablosu gerekebilir.
4. `actionTier` UI'da hangi etiketler (BASIC = "Free + Individual", EXTENDED = "Family+", PREMIUM = "Pro only")? Kopyası D4 ile uyumlu olmalı — copy review Sprint 4.
