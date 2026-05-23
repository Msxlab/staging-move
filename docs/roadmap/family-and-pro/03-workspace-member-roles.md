# Workspace Member Roles

- **Status**: Proposed (Family/Pro launch, Sprint 1)
- **Tier**: Infrastructure
- **Related decisions**: D5 (sabit rol matrisi, permissionsJson yok), D3 (field-level visibility, PRIVATE service yok), D2 (entitlement owner'dan, seat overflow), D10 (event-level step-up)
- **Related docs**: 02-workspace-model.md, 04-workspace-invitation.md, 06-entitlements-system.md, 07-api-workspace-context-helper.md, 22-child-role.md, 23-shared-services.md, 50-admin-workspace-inspector.md

## Amaç

`WorkspaceMember` workspace üyelerinin **rol** atanmış kaydıdır. D5 gereği rol enum'u sabit beş değerle kapalıdır; runtime'da permission tablosu/JSON yoktur. Bu doc tabloyu, beş rolün **policy matrisini**, durum geçişlerini (ACTIVE/SUSPENDED/OVERFLOW) ve API yüzeyini tarifler.

CHILD rolü field-level davranış için 22'ye, davet akışı 04'e, switcher UI 05'e bırakılır.

## Kapsam

In scope:
- `WorkspaceMember` Prisma modeli + indexler
- Rol enum: `OWNER | ADMIN | MEMBER | CHILD | VIEW_ONLY`
- Status enum: `ACTIVE | SUSPENDED | OVERFLOW` (D2 seat overflow)
- Tek-noktada policy fonksiyonu (`packages/shared/src/permissions.ts`)
- Tüm domain action'lar için permission matrisi (markdown grid)
- API: list members, change role, remove, leave
- Web member list + invite modal trigger
- Mobile member list (read + leave own membership)
- Admin override yetkileri

Out of scope:
- Davet token/kabul akışı → 04
- CHILD field-level visibility detayları → 22
- `Service.{accountNumber,username,notes}Visibility` flag mekanikleri → 23, D3
- Entitlement resolve mantığı → 06
- Step-up auth implementation → 16

## User stories

- **OWNER**: Workspace'imdeki herkesin rolünü değiştirebilirim (kendim hariç — owner kendine transfer yapamaz). Üyeleri çıkarabilirim.
- **ADMIN**: Yeni üye davet edebilirim, MEMBER/CHILD/VIEW_ONLY rolü atayabilirim. Ama başka bir ADMIN'i remove edemem (sadece OWNER yapar) ve OWNER rolünü kimseye veremem.
- **MEMBER**: Kendi adreslerimi, servislerimi ekler, ortak ev içi reminder'ları görürüm. Faturalama ekranını görmem. AddressChangeEvent başlatabilirim ama workspace silmem.
- **CHILD**: Sadece kendi adresimi ve atandığım servisleri görürüm. Diğer üyelerin finansal alanlarını (account#, payment, budget) **görmem** (D3 + 22).
- **VIEW_ONLY**: Her şey read-only. Account beni misafir/muhasebeci olarak görmek için davet etti. Hiçbir mutation, hiçbir partner sync, hiçbir export tetikleyemem.
- **Pro OWNER**: Bir muhasebeciyi VIEW_ONLY rolüyle ekleyebilirim; tüm servis listesini görür ama account number alanlarını göremez.

## Veri modeli

```prisma
enum WorkspaceRole {
  OWNER
  ADMIN
  MEMBER
  CHILD
  VIEW_ONLY
}

enum WorkspaceMemberStatus {
  ACTIVE
  SUSPENDED   // admin/owner geçici suspend etti
  OVERFLOW    // D2: seat downgrade sonrası "tolerated" üye
}

model WorkspaceMember {
  id          String        @id @default(cuid()) @db.VarChar(30)
  workspaceId String        @db.VarChar(30)
  workspace   Workspace     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  userId      String        @db.VarChar(30)
  user        User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  role   WorkspaceRole         @default(MEMBER)
  status WorkspaceMemberStatus @default(ACTIVE)

  // CHILD rolü için opsiyonel "guardian" bağlantısı (22-child-role).
  // Sadece UI hint; permission kararı role+status'ten alınır.
  parentMemberId String? @db.VarChar(30)
  parentMember   WorkspaceMember? @relation("ChildParent", fields: [parentMemberId], references: [id], onDelete: SetNull)
  childMembers   WorkspaceMember[] @relation("ChildParent")

  // Davet akışından gelen referans (04). Direct add (admin tool) ise null.
  invitedByUserId   String?   @db.VarChar(30)
  invitationId      String?   @db.VarChar(30)
  joinedAt          DateTime  @default(now())
  lastActiveAt      DateTime?
  suspendedAt       DateTime?
  suspendedReason   String?   @db.VarChar(255)
  overflowSince     DateTime?  // D2: downgrade timestamp

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([workspaceId, userId])
  @@index([workspaceId, role])
  @@index([userId])
  @@index([status])
}
```

**Cascade**: User silinirse member kaydı da silinir; ama owner User silinemez (02 RESTRICT). Workspace silinirse memberlar cascade gider.

**OWNER invariantı**: Her aktif Workspace için **tam olarak 1** member.role=OWNER. Schema constraint MySQL'de yok; uygulama katmanında transaction guard + admin nightly check.

## Permission matrisi

| Action | OWNER | ADMIN | MEMBER | CHILD | VIEW_ONLY |
|---|:---:|:---:|:---:|:---:|:---:|
| View workspace & member list | ✅ | ✅ | ✅ | ⚠️ self+parent only | ✅ |
| Invite new member | ✅ | ✅ | ❌ | ❌ | ❌ |
| Remove member | ✅ any | ✅ except OWNER/ADMIN | ❌ | ❌ | ❌ |
| Change member role (to MEMBER/CHILD/VIEW_ONLY) | ✅ | ✅ except ADMIN/OWNER | ❌ | ❌ | ❌ |
| Promote to ADMIN | ✅ | ❌ | ❌ | ❌ | ❌ |
| Demote/remove ADMIN | ✅ | ❌ | ❌ | ❌ | ❌ |
| Transfer OWNER (Faz 3) | ✅ self only | ❌ | ❌ | ❌ | ❌ |
| Rename workspace | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete workspace | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create/edit/delete Address | ✅ | ✅ | ✅ own | ⚠️ self only | ❌ |
| View Address | ✅ | ✅ | ✅ | ⚠️ self only | ✅ |
| Create/edit Service | ✅ | ✅ | ✅ | ⚠️ self assigned only | ❌ |
| View Service (basic fields) | ✅ | ✅ | ✅ | ⚠️ self assigned only | ✅ |
| View Service.accountNumber | ✅ | ✅ | ⚠️ if `accountNumberVisibility=WORKSPACE` | ❌ | ❌ |
| View Service.username | ✅ | ✅ | ⚠️ if `usernameVisibility=WORKSPACE` | ❌ | ❌ |
| View Service.notes | ✅ | ✅ | ⚠️ if `notesVisibility=WORKSPACE` | ❌ | ✅ if WORKSPACE |
| View Service.paidByUserId / cost | ✅ | ✅ | ✅ | ❌ | ✅ |
| Edit `*Visibility` flags on Service | ✅ | ✅ | ⚠️ creator only | ❌ | ❌ |
| Initiate `AddressChangeEvent` | ✅ | ✅ | ✅ | ❌ | ❌ |
| Complete PartnerSyncAttempt | ✅ | ✅ | ✅ assigned | ⚠️ self assigned only | ❌ |
| Export tax CSV / property report | ✅ | ✅ | ⚠️ own data only (Family) / ✅ (Pro) | ❌ | ✅ |
| Manage billing / view invoices | ✅ | ❌ | ❌ | ❌ | ❌ |
| View consolidated Family Budget | ✅ | ✅ | ✅ | ❌ | ✅ |
| Leave workspace (self) | ❌ (transfer first) | ✅ | ✅ | ⚠️ requires parent/admin | ✅ |

Legend: ✅ = full, ❌ = denied, ⚠️ = conditional (see notes column / linked doc).

**CHILD field-level**: D3 + 22 gereği CHILD her `Service.*Visibility` flag'ini görse bile sadece `assignedUserIds.includes(child.userId)` ise full görür, aksi halde `count` placeholder. Detay 22'de.

## API endpoint'leri

### Yeni

| Method | Path | Auth | Workspace ctx | Body | Response | Errors |
|---|---|---|---|---|---|---|
| GET | `/api/workspaces/:id/members` | session | yes | — | `[{id, userId, role, status, displayName, email, joinedAt, lastActiveAt}]` | 401, 403, 404 |
| PATCH | `/api/workspaces/:id/members/:memberId` | session, role in [OWNER, ADMIN] | yes | `{role: WorkspaceRole}` | `{id, role}` | 401, 403, 404, 409 (cannot promote to OWNER unless caller is OWNER + transfer flow), 422 |
| DELETE | `/api/workspaces/:id/members/:memberId` | session, role in [OWNER, ADMIN] | yes | — | `204` | 401, 403, 404, 409 (cannot remove OWNER) |
| POST | `/api/workspaces/:id/members/:memberId/suspend` | session, role=OWNER | yes | `{reason}` | `{status: SUSPENDED}` | 401, 403, 404 |
| POST | `/api/workspaces/:id/members/:memberId/reactivate` | session, role=OWNER | yes | — | `{status: ACTIVE}` | 401, 403, 404, 409 (seat full → OVERFLOW) |
| POST | `/api/workspaces/:id/members/leave` | session | yes | — | `204` | 401, 403 (OWNER), 404 |

Davet endpoint'leri 04'te.

### Mevcut endpoint'lere etki

- Tüm domain endpoint'leri (`/api/services`, `/api/addresses`, `/api/budgets`, ...) `requireWorkspaceContext` (07) içinden gelen `memberRole`'a göre 403/redact uygular.
- `/api/services/:id` GET response field-level visibility flag'leri uygular (caller role + visibility setting birleşimi).

## Web

### Yeni sayfa/route

- `/(app)/workspace/members/page.tsx` → Üye listesi:
  - Tablo: avatar, isim, email, rol (badge), status, joined, lastActive, … menüsü
  - "Invite member" CTA (sağ üst) → 04 modal
  - Per-row actions (caller permission'a göre): Change role, Suspend, Remove
  - OWNER row'unda crown ikonu + "Transfer" disabled CTA (Faz 3)

### Mevcut sayfalara etki

- `/(app)/services/[id]` → Field-level visibility için "Lock" ikonu + creator için inline `*Visibility` toggle (D3).
- `/(app)/addresses` → CHILD oturumunda yalnızca kendi adresleri listelenir.
- `/(app)/billing` → CHILD/MEMBER/VIEW_ONLY için 403 redirect → "Only owner manages billing" sayfa.

### Componentler

- `MemberList` (`apps/web/src/components/workspace/MemberList.tsx`) — tablo + filter.
- `MemberRowActions` (`apps/web/src/components/workspace/MemberRowActions.tsx`) — caller policy'sine göre action menü.
- `RoleBadge` (`apps/web/src/components/workspace/RoleBadge.tsx`) — 5 rol için renkli rozet.
- `RoleChangeDialog` (`apps/web/src/components/workspace/RoleChangeDialog.tsx`) — confirm + warning ("CHILD'a düşürürseniz bu kullanıcının finansal görünürlüğü kaybolur").

### Butonlar / actionlar

- "Invite member" (members page) → açar `<InviteModal />` (04).
- "Change role" (row action) → `PATCH /api/workspaces/:id/members/:memberId`.
- "Remove" (row action) → confirm modal → `DELETE …`.
- "Leave workspace" (settings > account) → `POST /api/workspaces/:id/members/leave`.
- "Suspend" / "Reactivate" (sadece OWNER) → ilgili endpoint.

## Mobile

### Yeni ekran

- `apps/mobile/app/(app)/workspace/members.tsx` → Liste + tap → member detail. Davet butonu OWNER/ADMIN için aktif; aktif değilse "On web only" hint.

### Mevcut ekranlara etki

- `apps/mobile/app/(app)/services/[id].tsx` → field-level visibility uygulanır (sensitive alanlar `••••` ile gizlenir).
- `apps/mobile/app/(app)/settings/index.tsx` → "Leave workspace" satırı (OWNER hariç).

### Componentler

- `MemberRow` (`apps/mobile/components/workspace/MemberRow.tsx`).
- `RoleBadge` (`apps/mobile/components/workspace/RoleBadge.tsx`).

## Admin

### Yeni sayfa

- `apps/admin/src/app/workspaces/[id]/members/page.tsx` — workspace inspector altında üye sub-page (50).

### Yetenekler

- **Admin override**: Belirli yetkili admin (AdminPermission `WORKSPACE_MEMBER_FORCE_REMOVE`) bir üyeyi çıkarabilir → audit `ADMIN_FORCE_REMOVE_MEMBER`.
- **OWNER zorla atama**: `WORKSPACE_FORCE_TRANSFER_OWNER` permission'ı ile (yalnızca legal/destek edge case) — audit + 2-admin onayı (Faz 3).
- Admin **rol değiştirmez kendi keyfine**; her override audit + reason zorunlu.
- Admin **kendi kullanıcı session'ı** ile workspace'i imitate etmez; her şey "as admin" çağrılır, attribution net kalır.

## Güvenlik

- [x] **Step-up auth**: Üye remove + role downgrade (özellikle OWNER → other) **fresh auth** gerektirir mi? **MVP'de hayır** — D10 step-up sadece AddressChangeEvent için. Member mgmt için reauthorization yapmadan UI confirm yeterli. (Açık soru: ATO sonrası attacker tüm üyeleri remove edebilir → log + bildirim + 24h undo penceresi düşünmek lazım.)
- [x] **PII redaction**: Member list response'unda email tam görünür sadece OWNER/ADMIN'e; MEMBER `email` yerine `obfuscatedEmail` (`a***@example.com`).
- [x] **Audit log**: `WORKSPACE_MEMBER_ROLE_CHANGED`, `WORKSPACE_MEMBER_REMOVED`, `WORKSPACE_MEMBER_SUSPENDED`, `WORKSPACE_MEMBER_LEFT`, `WORKSPACE_MEMBER_OVERFLOW_FLAGGED` (D2 cron). Actor + target + before/after rol.
- [x] **Rate limit**: Role change 30/saat/workspace, remove 10/saat/workspace.
- [x] **Permission matris**: Yukarıda (markdown grid). Kod karşılığı `packages/shared/src/permissions.ts` içinde `can(role, action, context)` saf fonksiyon.
- [x] **Encryption at rest**: Member row'unda hassas alan yok. Visibility flag'leri Service tarafında (23).
- [x] **GDPR DSAR + erase**: Bir üye user'ın DSAR'ı tüm üyelik kayıtlarını içerir. Erase: kendi memberships cascade; ama Workspace OWNER ise 02'deki "transfer first" kuralı uygulanır.

## Migration / backward compat

- DB migration: `add_workspace_member_table` + enums.
- Backfill: 09 — her User için yaratılan Workspace'e role=OWNER member eklenir.
- Dual-read: 09 ile aynı 2 hafta penceresi; bu süre boyunca permission helper `if (!memberRole) return legacyOwnerPermissions(userId)` fallback'i taşır.
- Rollback: `WORKSPACE_MODEL_ENABLED=false` flag — tüm permission check'ler `userId === resource.userId`'ya döner.

## Etkilenen mevcut özellikler

- Tüm domain CRUD endpoint'leri (services, addresses, budgets, plans, reminders)
- Service detay sayfası (field-level visibility yeni)
- Budget hesaplama (Family consolidated view → 24)
- Reminder feed (Family consolidated → 25)
- Tax export (40) ← rol bazlı filter
- Onboarding (yeni signup'ta otomatik OWNER member yaratımı)

## Test plan

- **Unit**:
  - `can(role, action, ctx)` her satır için tablo testi (5 rol × 20+ action)
  - OWNER promote guard (caller OWNER değilse reddet)
  - Overflow state'inde invite reddi
- **Integration**:
  - ADMIN, başka ADMIN'i remove edemez → 403
  - OWNER kendini remove edemez → 409
  - CHILD, başka üyenin servisini GET → 404/redact
  - Field-level: `accountNumberVisibility=OWNER_ONLY` iken MEMBER GET → field stripped
  - Seat overflow: Pro→Family downgrade sonrası 7. üyenin status=OVERFLOW olduğu, yeni invite'ın 409 (06 grace logic ile)
- **E2E**:
  - Members sayfası invite → kabul → role change → remove flow
  - CHILD oturumunda servis detay sensitive alan gizli
- **Manual QA**:
  - Admin override force-remove sonrası workspace tutarlılığı
  - Suspended member login'de "Your access is suspended" banner

## Açık sorular

- **AÇIK**: SUSPENDED status'teki member, login olabiliyor mu, sadece o workspace context'inde 403 mü görür yoksa tüm workspace listesinden bu workspace gizlenir mi?
- **AÇIK**: Member remove sonrası kişinin **yarattığı** Service/Address ne olur? Owner'a transfer mi (önerilen), yoksa member soft-delete mi? (Şu an "kalır, createdByUserId=removed user; ama mülkiyet workspace'in" varsayımı — UX'te creator badge nasıl görünür?)
- **AÇIK**: CHILD rolünün AddressChangeEvent **complete** etmesi (kendi assigned servisi için) — mantıken evet, ama D10 step-up CHILD password setup'ı şart koşuyor mu? 22'de cevap verilmeli.
- **AÇIK**: VIEW_ONLY rolünün "comment" yetkisi var mı? (Faz 2 collaboration için; MVP'de yorum sistemi yok, bu nedenle N/A.)
- **AÇIK**: 5 rol için kullanıcıya görünen Türkçe etiketler (Sahip / Yönetici / Üye / Çocuk / Sadece Görüntüleyici?) — 67-i18n-tr-en.md'de finalize edilmeli.
