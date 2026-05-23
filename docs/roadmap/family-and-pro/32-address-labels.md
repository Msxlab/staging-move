# Address Labels

- **Status**: Proposed (Family/Pro launch, Sprint 3)
- **Tier**: Pro (flag) — schema present for all, UI gated to Pro/Family
- **Related decisions**: D18
- **Related docs**: `01-architecture-decisions.md`, `06-entitlements-system.md`, `30-pro-plan-definition.md`, `40-tax-property-export.md`, `22-child-role.md`

## Amaç

`Address` modeline `label` enum eklemek; sadece **UI hint + filter + export grouping** olarak kullanmak (D18). LLC/EIN izolasyonu, ayrı vergi profili, ayrı entitlement scope **YOK** — bunlar talep olursa Faz 3 Business tier'ında ele alınır. Bu sayede multi-property owner ve home-office Pro persona'ları adres listesinde anlam ayırt edebilir, vergi export'u (40) bu kırılıma göre gruplayabilir.

## Kapsam

**In scope**
- `Address.label` kolonu ekleme (`HOME | OFFICE | RENTAL | VACATION | WAREHOUSE | DORM | OTHER`)
- Default value migration (mevcut adresler için backfill)
- Create/edit form'larında dropdown
- Address list filter chip'leri
- Address detail badge
- Search/filter API query param (`?label=RENTAL`)
- Tax export grouping anahtarı (40 cross-ref)
- CHILD rolü için DORM hint (Family use case)
- Mobile aynı davranış (D11 hariç — sadece read'in problemi yok, edit de yapılır)
- Admin address inspector görünümü

**Out of scope**
- LLC/EIN/tax isolation (D18 — Faz 3)
- Ayrı vergi profili veya ayrı entitlement scope
- Multiple workspaces per user
- Address-level permissions (D3 pattern field-level değil address-level değil)
- Custom user-defined labels (sabit enum, MVP'de extensibility yok)

## User stories

- **As a Pro multi-property owner**, 3 evi var: ana ev (`HOME`), kira evi (`RENTAL`), yazlık (`VACATION`). Address list'te chip filter ile sadece kira evlerini gösterir, vergi export'unda kira gelirini ayrı grup görür.
- **As a Pro small biz owner**, ev (`HOME`) + ev ofisi (`OFFICE`) + bir depo (`WAREHOUSE`) yönetir; tax export'ta OFFICE/WAREHOUSE'u "business" diye filtreler.
- **As a Family workspace owner**, lise çağındaki çocuğu üniversiteye gidiyor; çocuğun adresi `DORM` etiketlenir, UI'da farklı ikon görünür.
- **As an Individual user**, label hiç görünmez (entitlement.flags.addressLabels=false). Adresleri sessizce `OTHER` (veya `HOME` if isPrimary) etiketlenir; upgrade ettiğinde label'lar zaten orada.
- **As an admin** (support), kullanıcının adresine bakar, label'ı görür (read-only inspector).

## Veri modeli

`packages/db/prisma/schema.prisma`, model `Address` (line 404):

```prisma
model Address {
  id     String @id @default(cuid()) @db.VarChar(30)
  userId String @db.VarChar(30)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  type     String  @db.VarChar(20)
  nickname String? @db.VarChar(50)
+ label    String  @default("OTHER") @db.VarChar(20)   // HOME|OFFICE|RENTAL|VACATION|WAREHOUSE|DORM|OTHER

  street  String  @db.VarChar(200)
  ...
+ @@index([userId, label])
}
```

**Neden enum yerine String + check?**: Prisma MySQL'de native enum kullanıyoruz mu? Mevcut schema'da çoğu enum-like alan `String @db.VarChar(20)` pattern'i kullanıyor (örnek: `ownership`, `type`). Tutarlılık için aynı pattern. Validation `packages/shared/src/address-labels.ts`'de:

```ts
export const ADDRESS_LABELS = ["HOME","OFFICE","RENTAL","VACATION","WAREHOUSE","DORM","OTHER"] as const;
export type AddressLabel = typeof ADDRESS_LABELS[number];
export function isAddressLabel(v: string): v is AddressLabel { ... }
```

### Migration

`packages/db/prisma/migrations/<ts>_add_address_label/migration.sql`:

```sql
ALTER TABLE Address ADD COLUMN label VARCHAR(20) NOT NULL DEFAULT 'OTHER';

UPDATE Address SET label = 'HOME' WHERE isPrimary = TRUE AND label = 'OTHER';

CREATE INDEX Address_userId_label_idx ON Address(userId, label);
```

Down migration:

```sql
DROP INDEX Address_userId_label_idx ON Address;
ALTER TABLE Address DROP COLUMN label;
```

Backfill kuralı: `isPrimary=true` → `HOME`; geri kalan → `OTHER`. Daha akıllı (örn nickname'den "rental" parse) yapmıyoruz; kullanıcı sonra UI'dan düzenler.

## API endpoint'leri

### Yeni
Hiçbiri. Mevcut address endpoint'leri genişler.

### Mevcut endpoint'lere etki

| Endpoint | Değişim |
|---|---|
| `POST /api/addresses` | Body'de opsiyonel `label` accept eder; eksikse default `OTHER`. Validate `isAddressLabel`. |
| `PATCH /api/addresses/[id]` | `label` field update eder. Entitlement check: `entitlements.flags.addressLabels` false ise PATCH'te `label` değişikliği 403 (sessizce kabul ya da reject? — **reject + JSON error** seçildi). |
| `GET /api/addresses` | Query param `?label=RENTAL` (veya virgüllü `?label=RENTAL,VACATION`) destekler. Eksikse tüm label'lar döner. |
| `GET /api/addresses/[id]` | Response'a `label` ekler (her zaman, plan'dan bağımsız). |
| `GET /api/export/tax-property` (40) | Output'u `label` ile gruplar. |

**Plan gating notu**: `addressLabels` flag Pro'da true, Family'de false (30 matris; Family'de DORM hint için fragment-açık seçenek — bkz aşağıda). Schema her plan'da mevcut; UI dropdown sadece Pro'da. Family CHILD user adresi için DORM otomatik suggest edilir ama user editlemez (CHILD'ın adres yaratımı 22'de detay).

**Karar**: Family için `addressLabels` flag'ini de `true` yapmak mantıklı görünüyor (sadece 7 enum). 30'da Family matrisi `addressLabels: false` yazılmıştı; bu doc önerir: **Family'de de açık olsun**, 30 matrisi güncellensin. **Open question**, aşağıda.

## Web

### Yeni sayfa/route
Hiçbiri.

### Mevcut sayfalara etki

- `apps/web/src/app/(app)/addresses/page.tsx` (mevcut list sayfası):
  - Üst toolbar'a `<AddressLabelFilterChips>` eklenir.
  - Her address card'ında label badge.
- `apps/web/src/app/(app)/addresses/new/page.tsx` ve `[id]/edit/page.tsx`:
  - Form'a `<LabelSelect>` dropdown eklenir (Pro+ için).
- `apps/web/src/app/(app)/addresses/[id]/page.tsx` (detail):
  - Header'da label badge + icon.

### Componentler (file paths)

- `apps/web/src/components/addresses/AddressLabelBadge.tsx` (yeni) — pill UI:
  - `HOME` → ev ikonu, mavi
  - `OFFICE` → bina ikonu, mor
  - `RENTAL` → anahtar ikonu, yeşil
  - `VACATION` → güneş ikonu, sarı
  - `WAREHOUSE` → kutu ikonu, gri
  - `DORM` → mortarboard ikonu, kırmızı
  - `OTHER` → nokta ikonu, nötr
- `apps/web/src/components/addresses/LabelSelect.tsx` (yeni) — Radix Select wrapper, plan gated (eğer `!entitlements.flags.addressLabels` → disabled + tooltip "Upgrade to Pro").
- `apps/web/src/components/addresses/AddressLabelFilterChips.tsx` (yeni) — multi-select chip group; URL'e `?label=X,Y` yazar.

### Butonlar / actionlar

- Label dropdown change → form submit ile birlikte PATCH.
- Filter chip click → URL update (Next.js router) + listele.
- "Clear filters" linki.

## Mobile

### Yeni ekran
Hiçbiri.

### Mevcut ekranlara etki

- `apps/mobile/app/addresses/index.tsx` — list'te badge + filter chip row.
- `apps/mobile/app/addresses/[id].tsx` ve `new.tsx` — picker (RN modal selector).

### Componentler

- `apps/mobile/src/components/AddressLabelBadge.tsx` — RN version.
- `apps/mobile/src/components/LabelPicker.tsx` — bottom sheet selector.

D11 not applicable (mobile read-only sadece **billing**'de geçerli; address edit mobile'da çalışıyor).

## Admin

### Yeni sayfa / Yetenekler

- `apps/admin/src/app/(admin)/users/[id]/addresses/page.tsx` (varsa): address inspector tabline `Label` kolonu eklenir, read-only.
- Admin label edit yapmaz (kullanıcı kararı; destek tool değil).

## Güvenlik

- [ ] **Step-up auth**: Label değişimi düşük risk; AddressChangeEvent değil. Gerekli değil.
- [ ] **PII redaction**: Label PII içermez (HOME/OFFICE/etc fixed enum).
- [x] **Audit log**: Address PATCH zaten audit log'a yazılır (mevcut `AddressChangeLog` ya da benzeri). Label değişimi delta'da görünür.
- [x] **Rate limit**: Mevcut address API rate limit'i kapsar; ekstra yok.
- [x] **Permission matris**: OWNER/ADMIN/MEMBER label edit edebilir. CHILD kendi adresinin label'ını edit edemez (22). VIEW_ONLY read-only.
- [ ] **Encryption at rest**: N/A.
- [x] **GDPR DSAR**: Address export'u label içerir; DSAR ek iş gerektirmez.

## Migration / backward compat

- Yukarıdaki SQL migration tek seferlik.
- Mevcut Address API response'larına `label` field eklenir — clients (mobile, web) eksik field tolere etmeli. Mobile mevcut TypeScript type'larında `label` opsiyonel olabilir bir sprint, sonra zorunlu.
- `apps/mobile` cached AddressDto'lar migration sonrası ilk fetch'te label dolar; client-side normalize: `label ?? "OTHER"`.
- Reverse: `label` kolonu drop, app code'unda kullanım yoksa break yok.

## Etkilenen mevcut özellikler

- Address CRUD (web + mobile).
- Address list sayfası (filter UI).
- Tax/property export (40).
- Address inspector (admin).
- AddressChangeEvent target picker (12/13) — target USER/ADDRESS/CUSTOM seçim ekranında label badge yardımcı olur (bilgilendirme).
- MoveTask UI: origin/destination address'in label'ı görünebilir (Sprint 3 polish).

## Test plan

**Unit**
- `isAddressLabel("RENTAL")` → true; `isAddressLabel("FOO")` → false.
- Address PATCH handler: invalid label → 422.
- Plan gating: Individual user PATCH `label` → 403 (eğer karar "Pro-only" ise; Family-açık kararıyla bu test kalkar).

**Integration**
- POST `/api/addresses` with `label: "RENTAL"` → DB'de yazılır.
- GET `/api/addresses?label=RENTAL,VACATION` → sadece bu iki label filtrelenir.
- Tax export endpoint output gruplaması: 3 farklı label, 3 grup.

**E2E (Playwright)**
- Pro user adres yaratır, label seçer, list'te filter chip'e tıklar, sadece o adres görünür.
- Family user (eğer flag açık karar) aynı flow.
- Individual user create form'unda label dropdown disabled görünür + upsell tooltip.

**Manual**
- Mobile RN bottom sheet ile label değiştir.
- Migration: dev DB'de existing addresses → label backfill check (`SELECT label, COUNT(*) FROM Address GROUP BY label`).
- Admin inspector label görünür.

## Açık sorular

- **Family için `addressLabels` flag açık mı kapalı mı?** Önerilen: açık (DORM hint Family persona için anlamlı). 30 matrisi update gerek. (Karar 30 update PR'ında yapılır.)
- DORM label CHILD adresinde otomatik suggest mı, varsayılan mı? Önerilen: suggest (kullanıcı override edebilir).
- Custom user-defined label (Faz 3) — gerek görüldüğünde `Address.customLabel` opsiyonel String eklenir. MVP'de yok.
- Address chips'in default sırası (popular first vs alfabetik)? Önerilen: popular first (HOME, RENTAL, OFFICE, VACATION, WAREHOUSE, DORM, OTHER) — kullanım analytics yokken makul.
- Icon set: Lucide-react'te tümü var mı? `dorm` için "GraduationCap" makul. PR'da netleşir.
