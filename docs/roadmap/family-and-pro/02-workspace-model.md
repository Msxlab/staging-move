# Workspace Model

- **Status**: Proposed (Family/Pro launch, Sprint 1)
- **Tier**: Infrastructure
- **Related decisions**: D1 (tek root, type yok), D2 (entitlement owner'dan türer), D17 (existing user migration), D13 (route-level helper)
- **Related docs**: 01-architecture-decisions.md, 03-workspace-member-roles.md, 04-workspace-invitation.md, 05-workspace-switcher-ui.md, 06-entitlements-system.md, 07-api-workspace-context-helper.md, 09-existing-user-migration.md, 50-admin-workspace-inspector.md, 62-subscription-plan-field-updates.md

## Amaç

`Workspace` LocateFlow'un yeni veri ekseninin **root nesnesi**dir. Bütün domain kaynakları (Address, Service, MovingPlan, Budget, AddressChangeEvent, vb.) bir Workspace'e bağlanır. Her User en az bir Workspace'in OWNER'ıdır (migration ile backfill — bkz. D17); Family/Pro kullanıcıları ek üyelerle aynı Workspace'i paylaşır.

Bu doc workspace tablosunun kendisini, lifecycle'ını, FK ve cascade kurallarını, ownership (Faz 3 transfer için iskelet) ve plan-bazlı UI naming kurallarını tarifler. Üyelik ve davet ayrı dosyalarda (03, 04).

## Kapsam

In scope:
- `Workspace` Prisma modeli ve indexler
- FK + cascade kuralları (User → Workspace, Workspace → Address/Service/...)
- Workspace lifecycle: create (signup + manual), rename, soft delete, hard delete (cron)
- Plan-bazlı display name (D1: Free/Individual → "My Move", Family → "Household", Pro → "Workspace")
- Subscription'ın workspace owner ile 1:1 ilişkisi (Subscription tablosunda değişiklik **yok**, bağlantı `Workspace.ownerUserId`)
- Workspace settings sayfası (rename, delete, transfer iskelet)
- API endpoint'leri: CRUD + rename
- Admin inspector için cross-ref noktaları

Out of scope:
- Üyelik modeli ve permission matrisi → 03-workspace-member-roles.md
- Davet token akışı → 04-workspace-invitation.md
- Switcher UI → 05-workspace-switcher-ui.md
- Entitlement resolve mantığı → 06-entitlements-system.md
- `X-Workspace-Id` header negotiation → 08-x-workspace-id-header.md
- Ownership transfer **tam akışı** (PIN, email confirm, audit) → Faz 3 (bu doc sadece schema'da `transferRequestedAt/transferRequestedToUserId` alanlarını yer ayırır)
- Mevcut row backfill scripti → 09-existing-user-migration.md

## User stories

- **Yeni kullanıcı (Free Trial)**: Signup tamamlandığında otomatik bir Workspace yaratılır, ben OWNER olurum, isim default `"<FirstName>'s space"`. Ayar yapmam gerekmez.
- **Family OWNER**: Workspace adımı `"Yılmaz Household"` olarak değiştirmek istiyorum; ayarlar > Workspace > Rename ile değiştirebilirim.
- **Family OWNER**: Workspace'i silmek istiyorum; fresh auth + 7 günlük grace pencere boyunca geri alabileceğim bilgisi gösterilir.
- **Family MEMBER**: Workspace adını ve plan badge'ini header chip'te görürüm ama rename/delete butonu gizlidir.
- **Pro OWNER**: Workspace'i farklı bir kullanıcıya devretmek istiyorum (Faz 3); MVP'de "Coming soon" CTA görürüm.
- **Admin**: Bir support ticket gelince workspace'i ID'siyle açar, owner, üye sayısı, plan ve oluşturulma tarihini görür (bkz. 50).

## Veri modeli

```prisma
model Workspace {
  id          String  @id @default(cuid()) @db.VarChar(30)
  ownerUserId String  @db.VarChar(30)
  owner       User    @relation("WorkspaceOwner", fields: [ownerUserId], references: [id], onDelete: Restrict)

  // Display name. Yeni signup'ta "<FirstName>'s space" doldurulur.
  // Plan-bazlı UI etiketi (Household/Workspace) bunu DEĞİL, plan'ı tüketir.
  name String @db.VarChar(120)

  // Faz 3 ownership transfer iskelet alanları — MVP'de set edilmez.
  transferRequestedToUserId String?   @db.VarChar(30)
  transferRequestedAt       DateTime?

  // Soft delete + 7 gün grace. Hard delete cron `deletedAt + 7d < now()`
  // row'ları temizler. Tüm query'ler `deletedAt: null` filtresi ekler.
  deletedAt          DateTime?
  deletionGraceUntil DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  members      WorkspaceMember[]
  invitations  WorkspaceInvitation[]
  addresses    Address[]
  services     Service[]
  movingPlans  MovingPlan[]
  budgets      Budget[]
  // Faz 2'de eklenecek: addressChangeEvents, partnerConsents, ...

  @@index([ownerUserId])
  @@index([deletedAt])
  @@index([createdAt])
}
```

### Mevcut tablolara etki (diff)

```prisma
model User {
   id        String  @id @default(cuid()) @db.VarChar(30)
   ...
+  ownedWorkspaces Workspace[] @relation("WorkspaceOwner")
+  workspaceMemberships WorkspaceMember[]
}

model Address {
   id     String @id @default(cuid()) @db.VarChar(30)
   userId String @db.VarChar(30)
+  workspaceId String @db.VarChar(30)
+  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
   ...
+  @@index([workspaceId])
}

// Aynı diff: Service, MovingPlan, Budget, Reminder, MoveTask.
// `userId` alanı KALIR (kayıt sahibi). `workspaceId` eklenir (izolasyon sınırı).
```

**Cascade kuralları**:
- `User → Workspace (owner)`: `onDelete: Restrict`. Owner User silinemez; önce workspace transfer veya delete edilmeli (admin manual veya GDPR DSAR akışı).
- `Workspace → child (Address, Service, ...)`: `onDelete: Cascade`. Workspace hard delete olunca tüm domain verisi gider.
- `Workspace → WorkspaceMember`: `Cascade`.

### Subscription ilişkisi (1:1, FK değil)

D2 gereği `Subscription` row'u **owner User**'a bağlı kalır (mevcut `Subscription.userId @unique`). Workspace'in plan'ını çözmek için:

```ts
const sub = await prisma.subscription.findUnique({ where: { userId: workspace.ownerUserId } });
```

`Workspace.subscriptionId` alanı **eklenmez** — drift kaynağı olmasın diye (D1 ile aynı gerekçe). Subscription downgrade/upgrade sadece Subscription row'unu update eder; entitlement çözücüsü her zaman owner'dan okur (06).

## API endpoint'leri

### Yeni

| Method | Path | Auth | Workspace ctx | Body | Response | Errors |
|---|---|---|---|---|---|---|
| GET | `/api/workspaces` | session | none (lists user's memberships) | — | `[{id, name, role, planLabel, memberCount}]` | 401 |
| GET | `/api/workspaces/:id` | session | yes | — | `{id, name, ownerUserId, createdAt, planLabel, memberCount, ...}` | 401, 403 (not member), 404 |
| POST | `/api/workspaces` | session, plan in [FAMILY, PRO] | none | `{name}` | `{id, name}` | 401, 403 (plan gate), 422 (name) |
| PATCH | `/api/workspaces/:id/rename` | session, role=OWNER | yes | `{name}` | `{id, name}` | 401, 403, 404, 422 |
| POST | `/api/workspaces/:id/delete` | session, role=OWNER, **step-up auth** | yes | `{confirm: "DELETE"}` | `{deletedAt, deletionGraceUntil}` | 401, 403, 404, 409 (already deleted), 428 (no fresh auth) |
| POST | `/api/workspaces/:id/restore` | session, role=OWNER | yes | — | `{id, deletedAt: null}` | 401, 403, 404, 410 (grace expired) |
| POST | `/api/workspaces/:id/transfer-request` | session, role=OWNER | yes | `{newOwnerUserId}` | `501 Not Implemented` (Faz 3) | — |

Tüm endpoint'ler `requireWorkspaceContext` (07) helper'ını kullanır.

### Mevcut endpoint'lere etki

- `/api/auth/signup` → signup tamamlanınca aynı transaction'da bir Workspace + WorkspaceMember (OWNER) yaratır.
- `/api/me` → response'a `workspaces: [...]` ve `defaultWorkspaceId` eklenir.
- `/api/stripe/checkout` (mevcut endpoint genişler — D26 / canonical §C3) → Family/Pro upgrade success'inde owner'ın mevcut PERSONAL workspace'i o plan'a yükselir (Workspace row'una dokunulmaz, Subscription row'u update edilir).

## Web

### Yeni sayfa/route

- `/(app)/workspace/settings/page.tsx` → Workspace ayarları:
  - "Workspace name" input + Save (sadece OWNER)
  - "Current plan" read-only badge + "Manage billing" link
  - "Members" link → `/workspace/members`
  - "Delete workspace" tehlikeli zone (sadece OWNER): step-up modal + confirm
  - "Transfer ownership" disabled CTA (Faz 3)

- `/(app)/workspace/deleted/[id]/page.tsx` → Grace pencere için "Workspace silindi, 7 gün içinde geri yüklenebilir" + Restore butonu.

### Mevcut sayfalara etki

- `/(app)/dashboard` → Workspace switcher chip header'a eklenir (05).
- `/(app)/settings/account` → Workspace ayarları için ayrı menü öğesi eklenir.
- `/(app)/services`, `/(app)/addresses`, `/(app)/budget` → list query'leri artık `workspaceId` filtresi alır (dual-read window: 09).

### Componentler

- `WorkspaceSettingsForm` (`apps/web/src/components/workspace/WorkspaceSettingsForm.tsx`) — name input + save.
- `WorkspaceDangerZone` (`apps/web/src/components/workspace/WorkspaceDangerZone.tsx`) — delete + transfer butonları.
- `WorkspaceRestoreBanner` (`apps/web/src/components/workspace/WorkspaceRestoreBanner.tsx`) — grace içindeki workspace'lere global banner.

### Butonlar / actionlar

- "Save" (workspace settings) → `PATCH /api/workspaces/:id/rename`
- "Delete workspace" (danger zone) → step-up modal → `POST /api/workspaces/:id/delete`
- "Restore" (deleted state) → `POST /api/workspaces/:id/restore`
- "Transfer ownership" (danger zone) → disabled tooltip "Coming soon — contact support"

## Mobile

### Yeni ekran

- `apps/mobile/app/(app)/workspace/settings.tsx` → Read-only rename + delete (delete bile mobile'da gizlenebilir, fakat fresh-auth desteği varsa açık kalır). Bkz. D11: mobile read-only billing ama workspace mgmt OK.

### Mevcut ekranlara etki

- `apps/mobile/app/(app)/_layout.tsx` → header'a `<WorkspaceMenu />` eklenir (05).
- `apps/mobile/app/(app)/settings/index.tsx` → "Workspace" satırı eklenir (mevcut Workspace adı + ›).

### Componentler

- `WorkspaceSettingsScreen` (`apps/mobile/components/workspace/WorkspaceSettingsScreen.tsx`) — rename + danger zone.

## Admin

### Yeni sayfa

Bu doc sadece **inspector cross-ref**'i belirtir; ayrıntı 50-admin-workspace-inspector.md'de:
- `apps/admin/src/app/workspaces/page.tsx` — list + arama (owner email, name, id)
- `apps/admin/src/app/workspaces/[id]/page.tsx` — detail: owner, plan, members, recent events, soft-delete flag

### Yetenekler

- Workspace soft-delete'i admin restore edebilir (audit log: `ADMIN_WORKSPACE_RESTORE`).
- Workspace hard-delete sadece GDPR DSAR akışından tetiklenir, admin tek tık ile yapmaz.
- Workspace rename **owner-only**; admin için ayrı yetki/akış yok (destek senaryosunda admin owner adına rename yapmaz; talimat verir).

## Güvenlik

- [x] **Step-up auth gerekli mi?** Evet — `POST /api/workspaces/:id/delete` fresh `WorkspaceAuthChallenge` ister (D10, 15, 16). Rename için gerekmez.
- [x] **PII redaction**: Workspace `name` PII içerebilir (aile soyadı). Audit log'larda `name` yerine `workspaceId` + diff hash tutulur, full plaintext yalnızca admin inspector'da görünür.
- [x] **Audit log**: `AuditLog` tablosu (mevcut). Event'ler: `WORKSPACE_CREATED`, `WORKSPACE_RENAMED`, `WORKSPACE_SOFT_DELETED`, `WORKSPACE_RESTORED`, `WORKSPACE_TRANSFER_REQUESTED` (Faz 3). Actor = userId, target = workspaceId.
- [x] **Rate limit**: `POST /api/workspaces` 5/saat/user, rename 20/saat/workspace, delete 3/gün/workspace (DELETE retry abuse'unu engellemek için).
- [x] **Permission matris**: rename/delete OWNER; read tüm MEMBER+; create FAMILY/PRO plan + caller user değil (plan-gated 06).
- [x] **Encryption at rest**: `Workspace.name` plain text. Hassas alan yok.
- [x] **GDPR DSAR + erase**: Owner User'ın DSAR'ı tüm owned workspace'leri + her workspace'in members listesini içerir. Erase: workspace transfer edilmemişse hard-delete cascade.

## Migration / backward compat

- DB migration: `add_workspace_table` — yeni tablo + FK eklemeleri (Address, Service, MovingPlan, Budget, Reminder, MoveTask için `workspaceId` nullable kolonu).
- Backfill: 09-existing-user-migration.md (her User için 1 Workspace yaratan idempotent script).
- Dual-read window: 2 hafta — query'ler `WHERE userId = ? OR workspaceId = ?`. Sonra `workspaceId` NOT NULL'a yükseltilir.
- Rollback: yeni `workspaceId` kolonları NULL'a düşürülür, kod feature flag `WORKSPACE_MODEL_ENABLED=false` ile eski path'e döner (10).

## Etkilenen mevcut özellikler

- Signup flow (`apps/web/src/app/api/auth/signup/route.ts`) — workspace + OWNER member yarat
- Tüm domain list query'leri (services, addresses, plans, budgets)
- `/api/me` response shape
- Admin user detail sayfası (owned workspaces listesi gösterir)
- Account delete flow (cascade için workspace transfer veya delete adımı eklenir)

## Test plan

- **Unit**:
  - `workspaceFactory` test util
  - rename validation (1-120 char, trim, XSS-free)
  - soft-delete + restore window calc
- **Integration**:
  - signup → workspace yaratıldı, OWNER member var, default name doğru
  - rename: OWNER OK, MEMBER 403
  - delete with step-up: token yok → 428; token var → soft-delete + grace
  - restore in grace → 200; grace sonrası → 410
  - Subscription owner'dan resolve (FAMILY plan → display "Household")
- **E2E** (Playwright):
  - Settings sayfasında rename → header chip update olur
  - Delete confirm → /workspace/deleted/[id]'ye redirect → restore çalışır
- **Manual QA**:
  - Workspace silindiyse mobile'da hangi ekran?
  - Owner User soft-deleted ise workspace ne durumda? (Beklenen: workspace de soft-deleted, ama RESTRICT FK testi yap)

## Açık sorular

- **AÇIK**: Default workspace name'de Unicode (örn. Türkçe karakter, emoji) limit'i nedir? 120 char VarChar yeter mi yoksa Text mi?
- **AÇIK**: Soft-deleted workspace'in `X-Workspace-Id` header ile request gelirse 410 mu 404 mü dönmeli? (öneri: 410, ama mobile cache invalidation deneyimini etkiler)
- **AÇIK**: Owner kendi User'ını GDPR DSAR ile silmek isterse ve transfer edemiyorsa — workspace'i otomatik soft-delete mi edilir, yoksa erase reddedilip "transfer first" mi denir? (legal review gerekli)
- **AÇIK**: Hard-delete cron interval (öneri: günlük 03:00 UTC). Backup snapshot retention'ı GDPR ile uyumlu mu? (BackupRecord tablosu ile çapraz kontrol)
