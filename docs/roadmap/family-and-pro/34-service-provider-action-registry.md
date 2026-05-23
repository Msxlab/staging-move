# Service Provider Action Registry

- **Status**: Proposed (Family/Pro launch, Sprint 3)
- **Tier**: Infrastructure (powers Pro Partner Hub)
- **Related decisions**: D4, D7, D15
- **Related docs**: `01-architecture-decisions.md`, `06-entitlements-system.md`, `30-pro-plan-definition.md`, `33-partner-hub-ui.md`, `35-partner-sync-attempts.md`, `36-partner-deep-link-launcher.md`, `37-partner-pdf-letter-generator.md`, `38-partner-mailto-templates.md`, `51-admin-provider-actions-crud.md`, `52-admin-provider-csv-import.md`

## Amaç

`ServiceProvider` başına yapılabilecek concrete aksiyonların (address update, cancel, mail forwarding, vs.) idempotent ve admin'in editleyebileceği bir registry'sini DB'de tutmak. D15 gereği lansman partner API anlaşmaları içermez — registry deep-link URL template / mailto template / PDF template kombinasyonlarını tarifler. Plan gating D4 gereği DB'de değil **kodda** (`actionTier` field ile, `minPlan` yok).

## Kapsam

**In scope**
- `ServiceProviderAction` Prisma modeli
- Action type, channel, verification tier, action tier enum'ları
- URL template / mailto template / PDF template syntax (Mustache-like `{{newStreet}}`)
- `requiredFieldsJson` ile çağıran tarafın validate etmesi gereken alanlar
- Seed strategy: `packages/db/prisma/seed-data/provider-actions.ts` 50+ launch partner JSON
- `pnpm db:seed` script integration
- Admin'in DB'de live edit etmesi (51)
- Admin "re-seed (overwrite)" ve "merge" toolu
- Read API: `GET /api/partner-hub/actions?providerId=&category=&actionType=`
- Source of truth runtime: DB; JSON sadece rebuild seed

**Out of scope**
- Partner Hub UI (→ 33)
- Sync attempt tracking (→ 35)
- Launcher UX (→ 36)
- PDF generator (→ 37)
- Mailto template detayı (→ 38)
- Admin CRUD UI tasarımı (→ 51)
- CSV import (→ 52)
- Custom user-defined templates (vendor contact book, → 39)

## User stories

- **As a developer**, `pnpm db:seed` çalıştırırım, `provider-actions.ts` dosyasındaki 50+ partner DB'ye upsert olur.
- **As an admin**, admin panelden Netflix'in "Update address" URL'ini düzenlerim; bir sonraki kullanıcı tıkladığında yeni URL kullanılır.
- **As an admin**, yeni bir partner eklerken seed JSON'a katkıda bulunmadan **doğrudan admin CRUD**'dan ekleyebilirim. Re-seed yapsam bile bu admin-eklenen action silinmesin (merge mode).
- **As Partner Hub UI (33)**, `GET /api/partner-hub/actions?providerId=X` çağırırım, döner action'ları render ederim.
- **As D4 enforcement**, FAMILY user için `actionTier: PREMIUM` olan action'lar server tarafında filtrelenir.

## Veri modeli

`packages/db/prisma/schema.prisma`:

```prisma
+ model ServiceProviderAction {
+   id         String @id @default(cuid()) @db.VarChar(30)
+   providerId String @db.VarChar(30)
+   provider   ServiceProvider @relation(fields: [providerId], references: [id], onDelete: Cascade)
+
+   actionType         String @db.VarChar(30)
+   // ADDRESS_UPDATE | MAIL_FORWARDING | CANCEL | TRANSFER | VERIFY_ADDRESS | CONTACT_SUPPORT | UPDATE_PAYMENT
+
+   channel String @db.VarChar(20)
+   // DEEP_LINK | MAILTO | PDF | PHONE | API
+
+   urlTemplate     String? @db.Text       // for DEEP_LINK / API
+   mailtoTemplate  String? @db.Text       // for MAILTO; JSON { subject, body }
+   pdfTemplateKey  String? @db.VarChar(100) // references /apps/web/src/lib/pdf-templates/<key>.tsx
+
+   requiredFieldsJson String @db.Text @default("[]")
+   // ["accountNumber","fullName","newAddress.street","newAddress.city","newAddress.state","newAddress.zip"]
+
+   supportsHousehold       Boolean @default(false)
+   supportsBusinessAddress Boolean @default(false)
+
+   verificationTier String @default("UNVERIFIED") @db.VarChar(20)
+   // UNVERIFIED | OFFICIAL_LINK | PARTNER_VERIFIED | API_VERIFIED
+   // D15: launch only UNVERIFIED + OFFICIAL_LINK
+
+   actionTier String @default("BASIC") @db.VarChar(20)
+   // BASIC | EXTENDED | PREMIUM — D4 plan gating in code, not data
+
+   averageMinutes  Int?
+   instructionsMd  String? @db.Text       // user-facing markdown shown before launching
+
+   isActive    Boolean @default(true)
+   popularity  Int     @default(0)
+
+   syncAttempts PartnerSyncAttempt[]      // → 35
+
+   createdAt DateTime  @default(now())
+   updatedAt DateTime  @updatedAt
+   deletedAt DateTime?
+
+   @@unique([providerId, actionType, channel])
+   @@index([providerId])
+   @@index([actionType])
+   @@index([deletedAt])
+ }
```

**Notlar**:
- D4: `minPlan` alanı **yok**. Plan gating `packages/shared/src/entitlements.ts:actionTierAllowedForPlan(plan, tier)`'da.
- `@@unique([providerId, actionType, channel])` aynı partner için aynı tip + aynı kanaldan tek action.
- `verificationTier` D15 ile UNVERIFIED ve OFFICIAL_LINK ile başlar; PARTNER_VERIFIED / API_VERIFIED Faz 2.
- `ServiceProvider`'a back-relation eklenir: `actions ServiceProviderAction[]`.

### URL template syntax

Mustache-like:

```
https://www.netflix.com/youraccount?prefill_email={{accountEmail}}&address={{newStreet}},{{newCity}},{{newState}}+{{newZip}}
```

Mevcut placeholder set (server-side resolver 36'da):

| Placeholder | Source |
|---|---|
| `{{newStreet}}`, `{{newCity}}`, `{{newState}}`, `{{newZip}}` | `AddressChangeEvent.toAddress` |
| `{{oldStreet}}`, `{{oldCity}}`, `{{oldState}}`, `{{oldZip}}` | `AddressChangeEvent.fromAddress` |
| `{{accountNumber}}` | `Service.accountNumber` (decrypted) |
| `{{accountEmail}}` | `Service.email` |
| `{{fullName}}` | `User.fullName` |
| `{{moveDate}}` | `AddressChangeEvent.effectiveDate` (ISO yyyy-mm-dd) |

Eksik placeholder runtime'da resolver tarafından **boş** bırakılır + `requiredFieldsJson`'a göre validate edilir; eksikse launcher (36) "Missing X" prompt'u açar.

### mailtoTemplate JSON shape

```json
{
  "to": "support@example.com",
  "subject": "Address change request — {{fullName}}",
  "body": "Hello,\n\nPlease update my address from:\n{{oldStreet}}, {{oldCity}}, {{oldState}} {{oldZip}}\n\nTo:\n{{newStreet}}, {{newCity}}, {{newState}} {{newZip}}\n\nAccount: {{accountNumber}}\nEffective: {{moveDate}}\n\nThanks,\n{{fullName}}"
}
```

### Sample partner record (seed JSON)

```ts
// packages/db/prisma/seed-data/provider-actions.ts
export const PROVIDER_ACTIONS_SEED: SeedAction[] = [
  {
    providerSlug: "usps",
    actionType: "MAIL_FORWARDING",
    channel: "DEEP_LINK",
    urlTemplate: "https://moversguide.usps.com/mgo/?utm_source=locateflow",
    requiredFields: [],
    verificationTier: "OFFICIAL_LINK",
    actionTier: "BASIC",
    averageMinutes: 8,
    instructionsMd: "USPS will charge $1.10 identity verification. Have a credit card matching your old address ready.",
    popularity: 100,
  },
  {
    providerSlug: "netflix",
    actionType: "ADDRESS_UPDATE",
    channel: "DEEP_LINK",
    urlTemplate: "https://www.netflix.com/account/billing",
    requiredFields: [],
    verificationTier: "OFFICIAL_LINK",
    actionTier: "BASIC",
    averageMinutes: 2,
  },
  {
    providerSlug: "amazon",
    actionType: "ADDRESS_UPDATE",
    channel: "DEEP_LINK",
    urlTemplate: "https://www.amazon.com/a/addresses/add",
    requiredFields: [],
    verificationTier: "OFFICIAL_LINK",
    actionTier: "BASIC",
    averageMinutes: 3,
    supportsHousehold: true,
  },
  {
    providerSlug: "local-doctor-office",
    actionType: "ADDRESS_UPDATE",
    channel: "PDF",
    pdfTemplateKey: "address-change-letter-v1",
    requiredFields: ["fullName","accountNumber","oldStreet","newStreet"],
    verificationTier: "UNVERIFIED",
    actionTier: "EXTENDED",
    averageMinutes: 12,
    instructionsMd: "Download, print, sign, and mail this letter to your doctor's office.",
  },
  // ... 50 more
];
```

### Seed strategy

`packages/db/prisma/seed.ts` (mevcut) sonuna:

```ts
import { PROVIDER_ACTIONS_SEED } from "./seed-data/provider-actions";

for (const seed of PROVIDER_ACTIONS_SEED) {
  const provider = await prisma.serviceProvider.findUnique({
    where: { slug: seed.providerSlug },
  });
  if (!provider) {
    console.warn(`skip ${seed.providerSlug}: provider not found, run provider seed first`);
    continue;
  }
  await prisma.serviceProviderAction.upsert({
    where: {
      providerId_actionType_channel: {
        providerId: provider.id,
        actionType: seed.actionType,
        channel: seed.channel,
      },
    },
    create: {
      providerId: provider.id,
      ...seed,
      requiredFieldsJson: JSON.stringify(seed.requiredFields ?? []),
      mailtoTemplate: seed.mailtoTemplate ? JSON.stringify(seed.mailtoTemplate) : null,
    },
    update: {
      // upsert respects admin-edited fields ONLY when --force flag passed.
      // Default behavior: skip update if row exists.
    },
  });
}
```

**Seed modes** (CLI flag):
- `pnpm db:seed` → upsert create-only (admin edits korunur).
- `pnpm db:seed -- --force-actions` → overwrite (admin edits **silinir**).
- `pnpm db:seed -- --merge-actions` → seed row + admin row co-exist; çakışma için seed `displayPriority` daha düşük → admin yazısı kazanır.

Default Sprint 4 lansmanında: ilk seed full create. Sonraki seed run'larında create-only.

## API endpoint'leri

### Yeni
| Method | Path | Auth | Workspace ctx | Body | Response | Errors |
|---|---|---|---|---|---|---|
| GET | `/api/partner-hub/actions` | required | required | query: `providerId?`, `category?`, `actionType?` | `ServiceProviderActionDto[]` | 401, 403 (no partnerHub flag) |

Bu endpoint Partner Hub UI'ın (33) data source'u. Yanıtlar `entitlements.actionTier`'a göre filtrelenir.

### Mevcut endpoint'lere etki

- `GET /api/providers/[id]` (mevcut admin/web): response'a `actions` relation eklenir (admin için tam, end-user için filtered).
- `apps/admin/src/app/api/providers/route.ts` (mevcut, 382 lines): GET response'a `actionsCount` summary.

## Web

### Yeni sayfa/route
Hiçbiri (UI 33'te).

### Mevcut sayfalara etki
Hiçbiri (data layer).

### Componentler (file paths)
- `apps/web/src/lib/partner-actions.ts` (yeni) — type definitions + Dto mapper.
- `apps/web/src/lib/url-template-resolver.ts` (yeni) — Mustache substitute helper (36 ile paylaşımlı).

### Butonlar / actionlar
N/A (data).

## Mobile

### Yeni ekran
Yok.

### Mevcut ekranlara etki
Yok.

### Componentler
- `apps/mobile/src/lib/partner-actions.ts` (paylaşılan types via `packages/shared` ideal).

## Admin

### Yeni sayfa / Yetenekler

- `apps/admin/src/app/(admin)/providers/[id]/actions/page.tsx` (→ 51) — provider'a bağlı action list + edit form.
- `apps/admin/src/app/(admin)/providers/[id]/actions/new/page.tsx` (→ 51).
- "Re-seed actions" admin tool (`apps/admin/src/app/(admin)/admin-tools/reseed-actions/page.tsx`): mode seçici (create-only / force / merge), confirmation modal, async job. Audit log mecburi.

## Güvenlik

- [x] **Step-up auth**: Admin "re-seed --force" destructive action → step-up zorunlu (mevcut admin step-up pattern). Read API normal auth.
- [x] **PII redaction**: Template'lerde placeholder içeren URL'ler server-side resolve edilir; resolved URL log'da PII'lı (`{{accountNumber}}` doldurulmuş) tutulmamalı → log'lara unresolved template yazılır.
- [x] **Audit log**: Admin tarafından her action create/update/delete `AdminAuditLog`'a yazılır (`actor`, `before`, `after`). Re-seed event'i de.
- [x] **Rate limit**: `/api/partner-hub/actions` GET user başına 60/dk; çıkar cacheable.
- [x] **Permission matris**: Read API: `entitlements.flags.partnerHub` true. Admin CRUD: admin role gerek.
- [ ] **Encryption at rest**: Template'ler PII içermez; encryption gerekmez. Sample placeholder isimleri de hassas değil.
- [x] **GDPR DSAR**: Action template'leri user data değil; export'a girmez. Sync attempts (35) DSAR'da.

### URL whitelist

Admin "Add action" form'unda `urlTemplate` host'u **whitelist'e** karşı kontrol edilir (`apps/admin/src/lib/url-whitelist.ts`): yalnız bilinen partner domain'leri (örn `netflix.com`, `usps.com`). Bilinmiyorsa admin "force allow" + audit log. Bu spam/phishing template injection'a karşı savunma. Aynı whitelist runtime resolver'da (36) ikinci kez uygulanır.

## Migration / backward compat

- Migration: `CREATE TABLE ServiceProviderAction (...)` + relation back ref.
- İlk seed run'ı Sprint 3 sonunda 50+ partner ile.
- ServiceProviderAction tablosu boşsa Partner Hub UI (33) empty state gösterir (graceful).
- Mevcut `ServiceProvider` katalog migration'ı bağımsız; provider'ın action'ı olmayabilir.

## Etkilenen mevcut özellikler

- Provider seed scripts (`packages/db/prisma/seed-data/state-provider-catalog.ts`, `providers.ts`, `provider-seed.ts`): execution order — provider seed önce, action seed sonra.
- Admin provider CRUD (`apps/admin/src/app/api/providers/route.ts`) read response'una action count.
- Partner Hub UI (33).
- Launcher (36) — server-side template resolution.
- PDF generator (37) — `pdfTemplateKey` lookup.
- mailto launcher (38) — `mailtoTemplate` parse.
- Admin CRUD UI (51).
- CSV import (52) bu tabloya yazar.

## Test plan

**Unit**
- Seed upsert idempotency: aynı `(providerSlug, actionType, channel)` 2 kez seed → 1 row.
- `actionTierAllowedForPlan("FAMILY", "PREMIUM")` → false.
- URL template resolver: `{{newStreet}}` substitute, missing field → empty + error in requiredFields check.
- mailtoTemplate JSON parse: malformed → throw.

**Integration**
- `pnpm db:seed` fresh DB → expected provider action count.
- `pnpm db:seed --force-actions` → overrides admin-edited row (test fixture: admin edited Netflix URL, force seed restores).
- `GET /api/partner-hub/actions?providerId=X` Pro user → 5 actions; FAMILY user → only BASIC/EXTENDED.
- Whitelist: admin POST new action with `urlTemplate: "https://evil.com"` → 422.

**E2E**
- Admin edits Netflix URL → end-user click in Hub uses new URL (cache invalidation check).

**Manual**
- Re-seed UI: dry-run preview gösterir kaç row değişecek.
- Audit log: admin edit sonrası audit row görünür.

## Açık sorular

- `mailtoTemplate` JSON yerine ayrı kolonlar (`mailtoTo`, `mailtoSubject`, `mailtoBody`) mı? Önerilen: JSON (gelecekte multi-recipient için).
- Action `popularity` nasıl güncellenir? Otomatik (sync attempt count → batch job) mu manuel mi? MVP: manuel admin tarafında; batch job Faz 2.
- "Re-seed --force" gerçekten ihtiyaç mı yoksa gereksiz tehlike mi? Önerilen: keep with strong confirm + admin step-up.
- Provider-action one-to-many mı many-to-many mi (örn USPS aksiyonu birden fazla provider'a paylaşılsın mı)? Önerilen: one-to-many, MVP. Faz 3'te şablon kütüphanesi ele alınır.
- `instructionsMd` markdown sanitization (XSS) — server'da DOMPurify or marked + sanitize. Hangi lib? Karar code review'da.
