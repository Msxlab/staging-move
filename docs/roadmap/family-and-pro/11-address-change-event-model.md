# Address Change Event Model

> **Drift fix 2026-05-23** — Çelişkili değerler [`01a-canonical-values.md`](./01a-canonical-values.md) (§C7, §C13) ile geçersizdir. Canonical schema `fromAddressSnapshotJson` ve `toAddressSnapshotJson` Text alanlarını taşır; `fromAddressId`/`toAddressId` nullable. **CHILD AddressChangeEvent başlatamaz** (§C13 / D22 — MVP). CHILD'in taşınma talebi Owner/Admin'e notification gönderir.

- **Status**: Proposed (Family/Pro launch, Sprint 2)
- **Tier**: Infrastructure (Family + Pro)
- **Related decisions**: D6, D7, D10, D19, D22 (CHILD event başlatamaz)
- **Related docs**: [12](./12-address-change-target-model.md), [13](./13-address-change-wizard-web.md), [14](./14-bulk-queue-dashboard.md), [15](./15-workspace-auth-challenge.md), [16](./16-step-up-auth-flow.md), [35](./35-partner-sync-attempts.md)

## Amaç

`AddressChangeEvent` ürünün kalbi: bir kullanıcı bir adresten başka bir adrese taşındığında veya bir workspace owner'ı portföyündeki bir mülkün adres ilişkili servislerini topluca güncellerken yarattığı **tek bir batch operasyonu** temsil eder. Tüm partner sync denemeleri (`PartnerSyncAttempt`), per-target ilerleme (`AddressChangeTarget`), ve step-up auth bu event etrafında pivot eder.

Bir event'in lifecycle'ı DRAFT → ACTIVE → COMPLETED → ARCHIVED veya istenirse ABANDONED. Event yaratılması fresh step-up auth gerektirir (D10/D19); bir kez yaratıldıktan sonra status transitions ek auth istemez. Bu sayede ATO senaryosunda saldırgan tek tıkla 50 partnera fraud adresi yayamaz, kullanıcı her partner butonunda yeniden parola sorulup UX çöpe gitmez.

## Kapsam

**In scope**
- `AddressChangeEvent` Prisma modeli + migration
- Lifecycle state machine ve transition kuralları
- `/api/address-changes` CRUD endpoint'leri
- Step-up auth zorunluluğu (POST üzerinde)
- Soft delete (archive) — hard delete admin'e bırakılır

**Out of scope**
- Wizard UI (→ 13)
- Dashboard UI (→ 14)
- `AddressChangeTarget` modeli (→ 12)
- Partner sync attempt mantığı (→ 35)
- Step-up auth challenge tablosu (→ 15)

## User stories

- **As an Owner**: Eski adresimden yeni adresime taşınıyorum ve bu taşınmaya bağlı tüm servisleri tek bir "olay" altında takip etmek istiyorum, sonradan "bu taşınmada ne yaptım" diye bakabilmek istiyorum.
- **As a Family owner**: Eşim ve çocuklarımla birlikte taşınıyoruz; tek event altında herkesin servislerini ekleyebilmek istiyorum.
- **As a Pro user**: Yazlığı sattım, sadece o adrese bağlı servisleri yeni sahibe transfer etmek istiyorum; kişi bazlı değil, adres bazlı bir event açmak istiyorum.
- **As an Owner**: Yarıda bıraktığım bir taşınmayı iptal etmek (ABANDONED) veya tamamladığımda arşivlemek istiyorum.

## Veri modeli

```prisma
// packages/db/prisma/schema.prisma

enum AddressChangeScopeType {
  SELF              // sadece event creator'ın servisleri
  MEMBER            // bir workspace üyesinin servisleri (Family)
  ALL_WORKSPACE     // workspace'teki tüm üyelerin servisleri
  CUSTOM            // wizard'da manuel seçim
}

enum AddressChangeStatus {
  DRAFT             // wizard kaydedildi, henüz aktive edilmedi (rare; çoğu event DRAFT'ta kalmaz)
  ACTIVE            // partner sync attempts üretildi, kullanıcı butonlara basıyor
  COMPLETED         // tüm targetlar DONE/SKIPPED; kullanıcı manuel "Complete" basabilir
  ARCHIVED          // history'de saklanır, dashboard'da default gizli
  ABANDONED         // kullanıcı yarıda bıraktı; ARCHIVED'dan farkı: hiç COMPLETE olmadı
}

model AddressChangeEvent {
  id              String  @id @default(cuid()) @db.VarChar(30)
  workspaceId     String  @db.VarChar(30)
  workspace       Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  createdByUserId String  @db.VarChar(30)
  createdBy       User    @relation("AddressChangeEventCreatedBy", fields: [createdByUserId], references: [id])

  fromAddressId   String? @db.VarChar(30)  // null when user moves from no prior address
  fromAddress     Address? @relation("AddressChangeEventFrom", fields: [fromAddressId], references: [id])

  toAddressId     String? @db.VarChar(30)  // canonical §C7: nullable (address silinse de event korunur)
  toAddress       Address?  @relation("AddressChangeEventTo", fields: [toAddressId], references: [id])

  // Canonical §C7 snapshot fields — adres silinse de event'in tarihçesi korunur
  fromAddressSnapshotJson String? @db.Text
  toAddressSnapshotJson   String? @db.Text

  scopeType       AddressChangeScopeType
  status          AddressChangeStatus     @default(DRAFT)

  label           String? @db.VarChar(120)  // user-given: "Move to Boston"
  notes           String? @db.Text          // freeform user notes

  // Lifecycle timestamps
  createdAt       DateTime @default(now())
  activatedAt     DateTime?                  // set when status → ACTIVE
  completedAt     DateTime?                  // set when status → COMPLETED
  archivedAt      DateTime?                  // set when status → ARCHIVED or ABANDONED

  // Auth proof — event-level step-up (D19)
  authChallengeId String? @db.VarChar(30)    // FK to WorkspaceAuthChallenge that was consumed
  // No FK constraint to allow challenge cleanup without cascade; cross-checked in service layer.

  targets         AddressChangeTarget[]
  syncAttempts    PartnerSyncAttempt[]

  @@index([workspaceId, status])
  @@index([createdByUserId])
  @@index([workspaceId, createdAt])
}
```

**Diff özeti** (`packages/db/prisma/schema.prisma`):
- Yeni enum `AddressChangeScopeType`
- Yeni enum `AddressChangeStatus`
- Yeni model `AddressChangeEvent`
- `User` modeline `addressChangesCreated AddressChangeEvent[] @relation("AddressChangeEventCreatedBy")` ilişkisi
- `Address` modeline iki relation: `addressChangesFrom` / `addressChangesTo`
- `Workspace` modeline `addressChanges AddressChangeEvent[]`

## Lifecycle state machine

```
                       ┌─────────────┐
                       │   (init)    │
                       └──────┬──────┘
                              │ POST /api/address-changes
                              │ (step-up auth required)
                              ▼
                       ┌─────────────┐
       ┌───────────────│    DRAFT    │
       │               └──────┬──────┘
       │  PATCH activate      │ targets generated, attempts seeded as PENDING
       │  (rare; wizard       │
       │   commits ACTIVE     ▼
       │   directly)   ┌─────────────┐
       │               │   ACTIVE    │◀──── default state for live event
       │               └──┬───────┬──┘
       │   user cancel    │       │ all targets DONE/SKIPPED OR
       │                  │       │ user clicks "Mark complete"
       │                  ▼       ▼
       │           ┌──────────┐ ┌──────────────┐
       └──────────▶│ ABANDONED│ │  COMPLETED   │
                   └────┬─────┘ └──────┬───────┘
                        │              │
                        │              │ user / auto after 30d idle
                        ▼              ▼
                       ┌─────────────────┐
                       │    ARCHIVED     │   (terminal, soft-deleted)
                       └─────────────────┘
```

**Geçerli transition'lar** (service layer'da enforce):

| From → To | Tetikleyici | Side effect |
|---|---|---|
| (init) → DRAFT | POST /api/address-changes (wizard save) | targets seeded |
| DRAFT → ACTIVE | PATCH `{status: ACTIVE}` veya wizard direkt commit | `PartnerSyncAttempt` rows yaratılır (PENDING), `activatedAt` set |
| ACTIVE → COMPLETED | PATCH `{status: COMPLETED}` veya tüm targets DONE/SKIPPED auto-trigger | `completedAt` set |
| ACTIVE → ABANDONED | PATCH `{status: ABANDONED}` | `archivedAt` set, pending attempts → SKIPPED |
| DRAFT → ABANDONED | DELETE /api/address-changes/:id | aynı |
| COMPLETED → ARCHIVED | PATCH `{status: ARCHIVED}` veya 30 gün sonra cron | `archivedAt` set |
| ABANDONED → ARCHIVED | aynı | aynı |

**Yasak transition'lar**: ARCHIVED → \*, COMPLETED → ACTIVE, ABANDONED → ACTIVE. 409 döner.

## API endpoint'leri

### Yeni

| Method | Path | Auth | Workspace ctx | Body | Response | Errors |
|---|---|---|---|---|---|---|
| POST | `/api/address-changes` | Session + **step-up challenge token** (D10) | `requireWorkspaceContext` | `{ fromAddressId?, toAddressId, scopeType, scopeSelection: {...}, label?, notes?, authChallengeId }` | `201 { event, targets[] }` | 400 invalid body, 401 no session, 403 challenge invalid/expired, 403 not owner/admin for ALL_WORKSPACE scope, 422 target generation produced 0 rows |
| GET | `/api/address-changes` | Session | `requireWorkspaceContext` | query: `?status=ACTIVE&limit=20&cursor=...` | `200 { events[], nextCursor }` | 401 |
| GET | `/api/address-changes/:id` | Session | `requireWorkspaceContext` | — | `200 { event, targets, syncAttempts }` | 401, 404 |
| PATCH | `/api/address-changes/:id` | Session | `requireWorkspaceContext` | `{ status?, label?, notes? }` | `200 { event }` | 401, 404, 409 invalid transition, 403 not creator/owner |
| DELETE | `/api/address-changes/:id` | Session | `requireWorkspaceContext` | — | `204` (sets ABANDONED then ARCHIVED) | 401, 404 |

**Önemli**:
- POST gövdesindeki `authChallengeId` server'da `consumedAt IS NULL`, `expiresAt > now()`, `purpose = ADDRESS_CHANGE`, `userId = session.userId` koşullarını sağlamalı (→ 15). Başarılı consume sonrası challenge `consumedForActionId = event.id` ile damgalanır.
- PATCH status transitions ek auth istemez (D19).
- `scopeType = ALL_WORKSPACE` yalnız OWNER/ADMIN; `SELF` herkes; `MEMBER` OWNER/ADMIN, target user member olmalı; `CUSTOM` herkes ama yalnız erişim hakkı olduğu servisleri seçebilir.

### Mevcut endpoint'lere etki

- `apps/web/src/app/api/addresses/[id]/route.ts` — DELETE artık aktif `AddressChangeEvent.fromAddressId` veya `toAddressId` referansı varsa 409 döner. Mesaj: "Bu adres aktif bir taşınma kaydında kullanılıyor."
- `apps/web/src/app/api/services/[id]/route.ts` — DELETE: ilgili servisin `PartnerSyncAttempt`'leri PENDING/OPENED ise uyarı + cascade SKIPPED (event aktiviteyi bozmamalı).

## Web

### Yeni sayfa/route

- `/address-change/new` — wizard (→ 13)
- `/address-change/[id]` — dashboard (→ 14)
- `/address-change` — liste (filtrelenebilir, ACTIVE üstte)

### Mevcut sayfalara etki

- `/dashboard` — yeni "Active Move" kartı (eğer ACTIVE event varsa). 0 ise hidden, 1+ ise yatay scroll list.
- `/addresses/[id]` — yeni buton: **"Move from here"** → `/address-change/new?fromAddressId=...` prefill.
- Sidebar — yeni nav item "Moves" (ACTIVE varsa badge sayısı).

### Componentler

- Bu doc UI yaratmaz; bkz 13 ve 14.

### Butonlar / actionlar

- "Move from here" — Address detail header'da. Sadece edit yetkisi olan üyeye gösterilir.
- "Archive event" — dashboard sağ üst menü.

## Mobile

### Yeni ekran

- `AddressChangeListScreen` — read-only liste (mobile event yaratamaz Sprint 2'de; wizard web-only sprint 2, mobile wizard Faz 2).
- `AddressChangeDetailScreen` — read-only event detail + partner attempt completion (14'te detaylı).

### Mevcut ekranlara etki

- `AddressDetailScreen` — "Move from here" butonu **mobile'da yok** Sprint 2'de (web-only wizard).
- `Dashboard` — "Active Move" widget'ı (en fazla 1 aktif event göster).

### Componentler

- Yok bu doc'ta.

## Admin

### Yeni sayfa

- `/admin/address-changes` — global liste, filtre: status, workspaceId, dateRange, scopeType. Tıklayınca event detay + raw JSON dump.

### Yetenekler

- Read-only.
- "Force archive" — bir event'i tek tıkla ARCHIVED'a çekme (destek case'leri için). AdminAuditLog'a yazar.
- Hard delete **yok** MVP'de (GDPR erase için tüm event'leri batch silmek farklı bir endpoint, → 18).

## Güvenlik

- [x] **Step-up auth**: POST `/api/address-changes` zorunlu (D10). PATCH/DELETE gerekmiyor (D19).
- [x] **PII redaction**: Address fields log'lanırken `street1`, `street2` maskelenir (`[REDACTED]`). `label` ve `notes` user-controlled, raw yazılmaz; sadece `length` ve hash log'lanır.
- [x] **Audit log**: `AuditLog` tablosuna her create/transition için satır (`action=create|status_change|archive`, `entityType=AddressChangeEvent`, `changes=JSON of diff`).
- [x] **Rate limit**: POST 10/hour per user, 30/hour per workspace. GET 60/min per user. Enforced in `apps/web/src/lib/rate-limit.ts` keyed by `userId:address-change:create`.
- [x] **Permission matris** (D5):
  - OWNER/ADMIN: create any scope, view all, archive any
  - MEMBER: create SELF or CUSTOM (kendi servisleri), view own + ALL_WORKSPACE'e dahil olduğu eventler
  - **CHILD: create YASAK** (canonical §C13 / D22). CHILD MEMBER scope'unda hedef olabilir, kendi assigned partner action'larını tamamlayabilir, ama event create edemez. Taşınma talebi Owner/Admin'e in-app notification gönderir.
  - VIEW_ONLY: yaratamaz, sadece okuma
- [x] **Encryption at rest**: `notes` plain text (PII riski düşük; user-typed). Eğer freeform içerik hassas görülürse `packages/shared/src/encryption.ts` ile `notesEncrypted` field eklenebilir (Faz 2).
- [x] **GDPR DSAR**: User erase'de tüm `AddressChangeEvent` rows where `createdByUserId = X` hard delete; ayrıca user adına yaratılmış event'ler `createdByUserId = NULL`'a güncellenir, `label/notes` redact edilir. Cascade `Workspace` üzerinden gelir (workspace silinirse event silinir).

## Migration / backward compat

- Migration: `20260601_address_change_event.sql` — yeni enum'lar, yeni tablo, indexler.
- Mevcut `MovingPlan` modeli **silinmez**. AddressChangeEvent yeni bir kavram; MovingPlan checklist odaklı, Event partner-sync odaklı. İkisi paralel yaşar Sprint 4'te. Migration ister bilinçli: MovingPlan tetikleyicisi (yeni adres ekleme akışı) bir CTA gösterir: "Bu taşınmayı yönet" → AddressChangeEvent yaratır.
- Rollback: tablo drop güvenli (yeni feature, mevcut user etkilenmez). Sadece feature flag `FEATURE_ADDRESS_CHANGE_EVENTS` off ile UI gizlenir.

## Etkilenen mevcut özellikler

- `MovingPlan` — paralel yaşar; gelecekte event'e bağlanabilir (`MovingPlan.addressChangeEventId?`) ama bu doc kapsamında değil.
- Address DELETE endpoint — yukarıda anlatıldı.
- `apps/web/src/lib/audit.ts` — yeni entityType `AddressChangeEvent` kayıt fonksiyonu eklenir.

## Test plan

**Unit**
- State machine: tüm transitions tablo bazlı testler (`address-change-event.state.test.ts`)
- Authorization: her rol × her scope kombinasyonu (matrix test)
- Challenge consume: aynı challenge iki event POST'unda kullanılırsa ikinci 403

**Integration**
- POST with valid challenge → 201, challenge consumed
- POST with expired challenge → 403
- PATCH from ARCHIVED → 409
- DELETE → status becomes ABANDONED, sonra ARCHIVED, pending attempts → SKIPPED

**E2E (Playwright)**
- Owner wizard → submit → /address-change/[id] yüklenir, targets görünür
- Address DELETE while event ACTIVE → UI'da hata banner

**Manual**
- Family owner, MEMBER scope ile child seçer → event yaratılır, child'ın servisleri target olarak listelenir
- Pro owner, ADDRESS scope ile yazlık seçer → sadece o adres servisleri target

## Açık sorular

1. Event'i COMPLETED'a çekmek için tüm target'ların DONE/SKIPPED olması zorunlu mu, yoksa kullanıcı manuel "Mark complete" yapabilir mi her halükarda? **Karar önerisi**: Manuel zorla complete'e izin ver; eksik target'lar SKIPPED'a çekilir, AuditLog'a yazar.
2. Auto-archive cron süresi 30 gün mü 90 gün mü? → 30 gün (kullanıcı history'ye gitsin diye); ayarlanabilir env var.
3. Bir workspace'te aynı anda kaç ACTIVE event olabilir? **Karar önerisi**: Sınırsız (Pro use case: 5 mülk aynı anda). UI'da uyarı 5+'ta.
