# Shared Services

- **Status**: Proposed (Family/Pro launch, Sprint 2)
- **Tier**: Family + Pro
- **Related decisions**: D1 (workspace tek root), D2 (entitlement owner'dan), D3 (Service field-level visibility, PRIVATE service yok), D5 (sabit rol matrisi, CHILD dahil), D17 (migration backfill)
- **Related docs**: 01-architecture-decisions.md, 02-workspace-model.md, 03-workspace-member-roles.md, 09-existing-user-migration.md, 11-address-change-event-model.md, 12-address-change-target-model.md, 20-family-plan-definition.md, 22-child-role.md, 24-family-budget-consolidated.md, 25-family-reminders-consolidated.md, 30-pro-plan-definition.md, 50-admin-workspace-inspector.md

## Amaç

`Service` modelinde workspace bağlamında **kim sahip / kim öder / kim kullanır** ayrımı için yeni alanlar (`ownedByUserId`, `paidByUserId`, `assignedUserIds`) ve bunların UI/API/permission davranışı. Bu model Family bütçe konsolidasyonu (24), CHILD görünürlüğü (22) ve adres değişikliği wizard'ı (D6 USER target — 12) tarafından tüketilir. Field-level gizlilik (`accountNumberVisibility` vb.) D3 gereği zaten Service üzerindedir; bu doc onları **referans alır** ve owner/payer/assignee semantiğini ekler.

## Kapsam

In scope:
- `Service` modeline 3 yeni alan: `ownedByUserId`, `paidByUserId`, `assignedUserIds` (JSON array)
- Migration: mevcut servisler için defaults (`ownedByUserId = userId`, `paidByUserId = userId`, `assignedUserIds = [userId]`)
- Service detail UI: "Owned by / Paid by / Used by" chip'leri
- Edit modal: rol-bazlı yeniden atama yetkisi (OWNER/ADMIN/MEMBER kendi servisi)
- CHILD görünürlüğü kuralı: `assignedUserIds.contains(childUserId)` filtresi
- Service list filtresi (member chip)
- Bill split UI **read-only, informational** (MVP'de gerçek para transferi yok)
- API endpoint'lerinin yeni alanları kabul/dön etmesi

Out of scope:
- Field-level visibility enum mekaniği (D3) → 03'te + Service modeli dokunulmaz
- Family budget consolidation aggregation logic → 24
- Reminder routing (assignedUserIds kullanır) → 25
- Address change USER target wizard'ında bu alanların kullanımı → 12, 13
- Pro Partner Hub partner action atama → 33
- Bill split **gerçek finansal işlem** (Venmo/Zelle/Stripe transfer integrasyonu) — Faz 3

## User stories

- **Family OWNER**: İnternet servisinin bana ait olduğunu (`ownedByUserId=me`), kart ile eşim ödediğini (`paidByUserId=spouse`), tüm aile kullandığını (`assignedUserIds=[me, spouse, child1, child2]`) tek bir servis kaydında belirleyebilmek istiyorum.
- **MEMBER**: Kendi adıma kayıtlı bir servisi (Spotify Premium) ekledim; OWNER ve diğerleri görür ama account number sadece bana açık (`accountNumberVisibility='OWNER_ONLY'`).
- **CHILD**: Spotify Premium servisinde `assignedUserIds`'te varım; bu servis benim "My services" listemde çıkar; ama internet servisi (ben assigned değilim) çıkmaz.
- **Family OWNER**: Bütçe görünümünde "bu ay benim $230, eşimin $180" şeklinde `paidByUserId` bazlı kırınım istiyorum.
- **Workspace MEMBER**: Kendimi assignedUserIds'ten kaldırabilirim ("Bu servisi artık kullanmıyorum"); OWNER veya servis sahibi onaylar mı? — MVP: serbest, audit log var.
- **OWNER**: Bir üye workspace'ten ayrıldı; onun owned/paid servislerini başkasına devretmek istiyorum (bulk reassign).

## Veri modeli

```prisma
// packages/db/prisma/schema.prisma — Service modeli (mevcut alanlara ek)

model Service {
  id     String @id @default(cuid()) @db.VarChar(30)
  userId String @db.VarChar(30)  // mevcut: row'u yaratan kullanıcı; backward compat için kalır
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

+ workspaceId String @db.VarChar(30)
+ workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  addressId String  @db.VarChar(30)
  address   Address @relation(fields: [addressId], references: [id], onDelete: Cascade)

  // ... existing fields (providerName, category, accountNumber, etc.) ...

+ ownedByUserId    String? @db.VarChar(30)   // kontratın sahibi (legal owner)
+ ownedBy          User?   @relation("ServiceOwnedBy", fields: [ownedByUserId], references: [id], onDelete: SetNull)

+ paidByUserId     String? @db.VarChar(30)   // faturayı ödeyen kart sahibi
+ paidBy           User?   @relation("ServicePaidBy", fields: [paidByUserId], references: [id], onDelete: SetNull)

+ assignedUserIds  String? @db.Text          // JSON array<string> — kullanıcılar (MVP'de JSON; Faz 2 ayrı junction tablosu düşünülür)

  // field-level visibility (D3) — burada referans amaçlı:
  accountNumberVisibility String @default("OWNER_ONLY") @db.VarChar(20)
  usernameVisibility      String @default("OWNER_ONLY") @db.VarChar(20)
  notesVisibility         String @default("WORKSPACE")  @db.VarChar(20)

  // ...
+ @@index([workspaceId])
+ @@index([workspaceId, paidByUserId])
+ @@index([workspaceId, ownedByUserId])
}
```

**`assignedUserIds` neden JSON?** MVP basitliği. Junction tablosu (`ServiceAssignee`) Faz 2'de eklenir; o noktada query pattern'ları (N+1 join'ler) gerekçe haline gelir. JSON validation Zod ile API katmanında.

### Migration

```sql
-- prisma migration generated:
ALTER TABLE Service
  ADD COLUMN workspaceId VARCHAR(30) NOT NULL DEFAULT '',
  ADD COLUMN ownedByUserId VARCHAR(30),
  ADD COLUMN paidByUserId VARCHAR(30),
  ADD COLUMN assignedUserIds TEXT;

-- Migration runner (packages/db/prisma/migrations/<timestamp>_shared_services.ts):
UPDATE Service s
JOIN Workspace w ON w.ownerUserId = s.userId
SET s.workspaceId = w.id,
    s.ownedByUserId = s.userId,
    s.paidByUserId = s.userId,
    s.assignedUserIds = JSON_ARRAY(s.userId);

-- Remove default after backfill
ALTER TABLE Service ALTER COLUMN workspaceId DROP DEFAULT;
```

Migration script `packages/db/prisma/migrations/<ts>_shared_services_backfill.ts` 09'da PERSONAL workspace backfill ile **aynı sprintte** koşar. Dual-read (D17) penceresinde API'lar `WHERE userId = ? OR workspaceId = ?` çalışır.

## API endpoint'leri

### Yeni

| Method | Path | Auth | Workspace ctx | Body | Response | Errors |
|---|---|---|---|---|---|---|
| PATCH | `/api/services/[id]/assignment` | required | required | `{ ownedByUserId?: string \| null, paidByUserId?: string \| null, assignedUserIds?: string[] }` | `{ service: ServiceDto }` | 400 invalid user not in workspace, 403 not allowed, 404, 409 owner-only reassign collision |
| POST | `/api/services/[id]/leave` | required | required | — (CHILD/MEMBER kendisini assignedUserIds'ten çıkarır) | `{ assignedUserIds: string[] }` | 403 if owner-only (ownedBy=self → leave engellenir) |
| POST | `/api/workspace/members/[id]/reassign-services` | OWNER + step-up | required | `{ toUserId: string, scope: 'OWNED' \| 'PAID' \| 'BOTH' }` | `{ updatedCount: number }` | 403, 404 |

### Mevcut endpoint'lere etki

- `GET /api/services` — yeni response field'ları: `ownedByUserId`, `paidByUserId`, `assignedUserIds`. CHILD ise `WHERE assignedUserIds CONTAINS userId` filter (server-side, MySQL JSON_CONTAINS).
- `POST /api/services` — body opsiyonel `ownedByUserId/paidByUserId/assignedUserIds`; verilmezse default `[caller.userId]`. Validation: tüm referans edilen userId'ler aynı workspace üyesi olmalı.
- `PATCH /api/services/[id]` — assignment alanları için ayrı endpoint (`/assignment`) tercih edildi (auditability + role separation); generic PATCH bu alanları **reddeder**.
- `DELETE /api/services/[id]` — onlyowner or service.ownedBy=self; CHILD reddedilir (kendi assigned olsa bile).
- `GET /api/budget/family` (24'te tanımlı) — `paidByUserId` bazlı aggregation.

### Permission matrisi (D5)

| Action | OWNER | ADMIN | MEMBER (self) | MEMBER (others') | CHILD (self assigned) | CHILD (not assigned) |
|---|---|---|---|---|---|---|
| Service okuma | ✓ | ✓ | ✓ | ✓ (visibility gate) | ✓ (gate) | ✗ |
| Service yaratma | ✓ | ✓ | ✓ (default kendi assigned) | n/a | ✓ (kendi assigned only) | n/a |
| ownedBy reassign | ✓ | ✓ | ✓ (kendi → başkası) | ✗ | ✗ | ✗ |
| paidBy reassign | ✓ | ✓ | ✓ (kendi servisi) | ✗ | ✗ | ✗ |
| assignedUserIds add | ✓ | ✓ | ✓ (kendi servisi) | ✗ | ✗ | ✗ |
| assignedUserIds self-remove (leave) | n/a | ✓ | ✓ | ✓ | ✓ | n/a |
| Service silme | ✓ | ✓ | ✓ (kendi ownedBy) | ✗ | ✗ | ✗ |
| Field accountNumber okuma | ✓ | ✓ if WORKSPACE | ✓ if WORKSPACE veya self ownedBy | ✓ if WORKSPACE | ✓ if WORKSPACE | n/a |

## Web

### Yeni sayfa/route
- Standalone sayfa yok. Service detail sayfası genişler.

### Mevcut sayfalara etki
- `apps/web/src/app/(app)/services/page.tsx` — list view:
  - "Filter by member" chip row (workspace üyeleri).
  - Her satırda `paidByUserId` avatar + `assignedUserIds.length` chip.
  - CHILD için filtre kaldırılır (görüntü zaten kısıtlı).
- `apps/web/src/app/(app)/services/[id]/page.tsx` — detail view:
  - "Ownership" panel: "Owned by [avatar+name], paid by [avatar+name], used by [chips]".
  - Edit modal: 3 alan için workspace member picker.
  - CHILD ise panel görünür ama edit kapalı; field-level gate `accountNumber`/`username` için ayrı.
- `apps/web/src/app/(app)/services/new/page.tsx` — create form:
  - Yeni section "Who is this for?" (default kendisi); MEMBER'lar "Add others" ile workspace üyelerini ekleyebilir.

### Componentler (file paths)
- `apps/web/src/components/services/OwnershipPanel.tsx` — 3 chip + edit trigger.
- `apps/web/src/components/services/OwnershipEditModal.tsx` — 3 dropdown + multi-select chips + save.
- `apps/web/src/components/services/MemberPicker.tsx` — workspace üye autocomplete.
- `apps/web/src/components/services/MemberFilter.tsx` — list page filter chips.
- `apps/web/src/components/services/BillSplitPreview.tsx` — read-only "If split equally: $X each" hesap (informational).

### Butonlar / actionlar
- "Reassign payer" → OwnershipEditModal odaklı paidByUserId.
- "Leave this service" (MEMBER/CHILD görür, ownedBy=self değilse) → POST `/api/services/[id]/leave`.
- Member detail sayfasında (workspace member görüntüleme) "Reassign all from this member" → bulk reassign endpoint, OWNER + step-up.

## Mobile

### Yeni ekran
- Yok; mevcut service detail ekranı genişler.

### Mevcut ekranlara etki
- `apps/mobile/app/services/index.tsx` — member filter pill list (üyeler).
- `apps/mobile/app/services/[id].tsx` — ownership panel + edit sheet.
- `apps/mobile/app/services/new.tsx` — "Who is this for?" sheet.
- CHILD görünümü: filter UI ve edit gizlenir (RoleGate, 22).

### Componentler
- `apps/mobile/src/components/services/OwnershipPanel.tsx`
- `apps/mobile/src/components/services/MemberPicker.tsx` (ActionSheet veya BottomSheet)
- `apps/mobile/src/components/services/BillSplitPreview.tsx`

## Admin

### Yeni sayfa / Yetenekler
- `/admin/workspaces/[id]/services` (50'de tanımlı workspace inspector alt-sayfası):
  - Servis listesinde her satırda owned/paid/assigned kullanıcı ID'leri görünür (debugging için).
  - Admin "transfer ownership" yetkisi (compliance edge case için), step-up + audit.

## Güvenlik

- [x] **Step-up auth**: Bulk reassign (`/api/workspace/members/[id]/reassign-services`) ve admin transfer step-up ister. Tekil reassignment standart auth (audit yeterli).
- [x] **PII redaction**: Service `accountNumber/username` zaten encrypted; visibility gate her response'ta uygulanır. Audit log redaction `audit-redaction.ts` üzerinden.
- [x] **Audit log**: Yeni event tipleri:
  - `SERVICE_OWNERSHIP_REASSIGNED { serviceId, oldOwner, newOwner }`
  - `SERVICE_PAYER_REASSIGNED`
  - `SERVICE_ASSIGNEE_ADDED / REMOVED`
  - `SERVICE_BULK_REASSIGNED { fromUserId, toUserId, count, scope }`
  - `SERVICE_ASSIGNEE_SELF_LEFT`
- [x] **Rate limit**: Standart user-level limit; bulk reassign endpoint 5 req/dakika/owner.
- [x] **Permission matris**: Yukarıdaki tabloya göre route-level enforcement; UI'da gating defense-in-depth.
- [x] **Encryption at rest**: Service.accountNumber mevcut encryption; yeni alanlar (userId'ler) düz string, encryption gereksiz.
- [x] **GDPR DSAR**: Kullanıcı kendi userId'sinin geçtiği tüm servis row'larını export edebilir (owned + paid + assigned). Erase: kullanıcı sildiğinde `onDelete: SetNull` (paidBy/ownedBy nullable), `assignedUserIds` JSON'dan elle pop (cleanup cron veya cascade trigger).

## Bill split UI (read-only, informational)

`BillSplitPreview` component:

```
Internet — $89/month
  paid by: Mehmet
  used by: 4 members
  If split equally: $22.25/person/month
  [ ] Show suggested Venmo request (coming soon)
```

MVP'de **sadece görsel**; "Venmo request" disabled chip ile Faz 2 teaser. Gerçek finansal işlem bu spec'in dışında.

## Migration / backward compat

- Mevcut servisler için backfill (yukarıda SQL): tüm üç alan = `[userId]` veya `userId`. Davranış değişmez (tek kişilik workspace zaten).
- Yeni alanlar **nullable** (`ownedByUserId`, `paidByUserId`) — eksikse "no owner / no payer" anlamı (henüz atanmamış); UI "Unassigned" gösterir. `assignedUserIds` boş array (`'[]'`) ise sadece OWNER/ADMIN görür.
- API response yeni alanları **her zaman** döner; eski client'lar (mobil <1.x) bu alanları ignore eder, breaking değil.
- Eski mobile sürüm yeni assignment endpoint'lerini bilmez → fallback davranış: ownership panel görünmez (feature flag `ownership-panel`).
- D2 grace period sırasında yeni atama yapılmaz (workspace read-only); mevcut atama korunur.

## Etkilenen mevcut özellikler

- **`packages/db/prisma/schema.prisma`** — Service modeli 4 yeni alan + indeksler.
- **`apps/web/src/app/api/services/*`** — request/response schema, filter logic.
- **`apps/web/src/components/services/*`** — list, detail, new sayfaları UI.
- **`apps/mobile/app/services/*`** — paralel UI.
- **`apps/web/src/lib/plan-limits.ts`** — service create sırasında workspace count kontrolü zaten var; workspaceId migration sonrası workspace-bazlı sayım.
- **`packages/shared/src/audit-event-types.ts`** — yeni event isimleri.
- **24-family-budget-consolidated.md** — `paidByUserId` aggregation kullanır.
- **25-family-reminders-consolidated.md** — `assignedUserIds` push routing kullanır.
- **12-address-change-target-model.md** — USER scope target `assignedUserIds.contains(targetUserId)` servisleri toplar.
- **CHILD role (22)** — CHILD service filtresi.

## Test plan

### Unit
- Migration runner: 10 fake user, 30 service → her servis için workspaceId + 3 yeni alan doğru backfill.
- `assignedUserIds` JSON validation: non-array → 400, non-string element → 400.
- Permission: MEMBER attempt to reassign other's service → 403.
- CHILD filter: 3 servis (1 assigned, 2 değil) → list 1 dönmeli.
- Field gate: CHILD requesting OWNER_ONLY field → null in response.

### Integration
- `POST /api/services/[id]/assignment` happy path.
- `POST /api/services/[id]/leave` MEMBER kendini çıkarır → assignedUserIds güncel.
- `POST /api/services/[id]/leave` ownedBy=self → 403.
- Bulk reassign: 50 servis transfer, audit log yazılır, tek transaction.
- Cross-workspace user reference → 400 ("user not in workspace").

### E2E (Playwright)
- OWNER yaratır servis, paidBy eşine atar, eşi login olur, "I paid this month $X" budget'ta görür.
- CHILD assigned servisi görür, atanmadığı servisi göremez.
- MEMBER "Leave service" akışı.
- Bulk reassign UX: confirmation modal + result toast.

### Manual QA
- Mobile create service flow: 3 alanı set edip kaydet, web'de görünür.
- Visibility + ownership combo: account number OWNER_ONLY + CHILD assigned → field masked but service visible.
- Workspace delete: CASCADE service silinir (deletedAt soft).

## Açık sorular

- [ ] `assignedUserIds` JSON yerine ayrı `ServiceAssignee` junction tablosu MVP'de mi yoksa Faz 2'de mi? — MVP JSON (basitlik), 250 servis × ortalama 4 assignee = 1000 row JSON query OK. Faz 2'de junction.
- [ ] `paidByUserId` workspace üyesi olmayan biri (eski üye) ise UI ne gösterir? — "Former member" placeholder + reassign CTA (OWNER görür).
- [ ] Service taşınırken (address change USER scope) `paidByUserId` aynı kalır mı? — Evet, sadece adres değişir; ödeme sahipliği bağımsız.
- [ ] Faz 2 Venmo/Zelle integrasyonu için neye benzemeli? — Bu doc kapsamı dışı, ancak `BillSplitPreview` placeholder layout'u uyumlu olacak şekilde tasarlanır.
- [ ] CHILD "Leave service" yapabilmesi UX olarak doğru mu (ebeveynin atadığı bir servisten ayrılıp uyarı yaratıyor)? — Karar: evet, ama ebeveyne notification gider (66).
- [ ] `Service.userId` (legacy creator) tutulmalı mı yoksa silinip `createdByUserId` olarak yeniden adlandırılmalı mı? — MVP'de tut, Faz 2 rename.
- [ ] Bulk reassign'in scope'u (`OWNED`/`PAID`/`BOTH`) yeterli mi, yoksa `ASSIGNED` (assignedUserIds remove) de eklenmeli mi? — Eklenebilir; MVP'de OWNED/PAID/BOTH.
