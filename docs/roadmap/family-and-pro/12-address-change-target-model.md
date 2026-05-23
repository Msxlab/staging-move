# Address Change Target Model

> **Drift fix 2026-05-23** — Çelişkili değerler [`01a-canonical-values.md`](./01a-canonical-values.md) (§C7) ile geçersizdir. Service assignee modeli `ServiceAssignee` junction tablosu; `Service.assignedUserIds` JSON alanı **yoktur**. AddressChangeEvent ek olarak `fromAddressSnapshotJson`, `toAddressSnapshotJson` alanlarını taşır (§C7).

- **Status**: Proposed (Family/Pro launch, Sprint 2)
- **Tier**: Infrastructure (Family + Pro)
- **Related decisions**: D6, D7, D22 (CHILD event başlatamaz)
- **Related docs**: [11](./11-address-change-event-model.md), [13](./13-address-change-wizard-web.md), [14](./14-bulk-queue-dashboard.md), [35](./35-partner-sync-attempts.md)

## Amaç

`AddressChangeTarget` bir `AddressChangeEvent` içinde **"neyi/kimi taşıyoruz"** sorusunun atomik birimidir. Event = batch, Target = batch içindeki satır. Bu ikinci seviye olmadan dashboard "5/12 done" gibi anlamlı bir ilerleme gösteremez ve Family/Pro arasındaki semantik farkı (kişi-bazlı vs. adres-bazlı taşınma) modelleyemez.

D6'da üç `targetType` sabitlendi: **USER** (kişinin tüm servisleri taşınır — Family), **ADDRESS** (fiziksel adrese bağlı tüm servisler taşınır — Pro), **CUSTOM** (kullanıcı manuel servis listesi seçti). Per-target status (`PENDING | IN_PROGRESS | DONE | SKIPPED`) wizard sonrası dashboard'da accordion açılır kapanır UX'inde kullanıcının nereye odaklanacağını belirler.

## Kapsam

**In scope**
- `AddressChangeTarget` Prisma modeli
- Üç targetType semantiği ve hangi alanların doldurulduğu
- Wizard'ın scope + selection'dan target'ları nasıl ürettiği
- Per-target status lifecycle ve hangi event'in tetiklediği
- Cascade kuralları (event archive → target archive)
- Target-bazlı API endpoint'leri

**Out of scope**
- Event modeli (→ 11)
- PartnerSyncAttempt (→ 35) — target → attempt ilişkisi 35'te detaylı
- Wizard UI (→ 13)

## User stories

- **As a Family owner**: Wizard'da "eşim ve oğlumun servisleri taşınıyor" derken iki USER target yaratmak istiyorum, dashboard'da her birinin ilerlemesini ayrı görmek istiyorum.
- **As a Pro user**: Yazlığı sattığımda o adrese bağlı 8 servisin hepsini tek ADDRESS target altında takip etmek istiyorum, ayrı ayrı kişi olarak görmek istemiyorum.
- **As an Owner**: "Geçenler tamamlandı, bu servisi taşımayacağım" diyerek bir target'ı SKIPPED işaretlemek istiyorum.
- **As an Owner**: Dashboard'da hangi target'ın kaç partner attempt'ı kaldığını görmek istiyorum.

## Veri modeli

```prisma
enum AddressChangeTargetType {
  USER     // hedef: bir workspace member; o user'ın tüm servisleri (Family)
  ADDRESS  // hedef: bir adres; ona bağlı tüm servisler kişi farkı yok (Pro)
  CUSTOM   // hedef: kullanıcı tarafından elle seçilmiş servis kümesi
}

enum AddressChangeTargetStatus {
  PENDING       // henüz hiçbir partner attempt OPENED değil
  IN_PROGRESS   // en az 1 attempt OPENED, hepsi DONE/SKIPPED değil
  DONE          // tüm attempts DONE veya SKIPPED ile ≥1 DONE
  SKIPPED       // kullanıcı manuel skip; child attempts otomatik SKIPPED
}

model AddressChangeTarget {
  id            String  @id @default(cuid()) @db.VarChar(30)
  eventId       String  @db.VarChar(30)
  event         AddressChangeEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)

  targetType    AddressChangeTargetType

  // Doldurulan alan targetType'a göre değişir (semantic table aşağıda)
  targetUserId  String?  @db.VarChar(30)
  targetUser    User?    @relation("AddressChangeTargetUser", fields: [targetUserId], references: [id])

  addressId     String?  @db.VarChar(30)   // ADDRESS için kaynak adres (= event.fromAddressId genelde)
  address       Address? @relation("AddressChangeTargetAddress", fields: [addressId], references: [id])

  label         String? @db.VarChar(120)   // CUSTOM için "My utility bundle" vb.

  status        AddressChangeTargetStatus @default(PENDING)
  sortOrder     Int       @default(0)

  completedAt   DateTime?
  skippedAt     DateTime?
  skipReason    String?  @db.VarChar(200)

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  syncAttempts  PartnerSyncAttempt[]

  @@index([eventId, status])
  @@index([targetUserId])
  @@index([addressId])
}
```

## targetType semantik tablosu

| targetType | targetUserId | addressId | label | Servis seçim kuralı |
|---|---|---|---|---|
| USER     | required | optional (filtre) | auto = user.fullName | `JOIN ServiceAssignee a ON a.serviceId = service.id WHERE a.userId = targetUserId` (paidByUserId değil — child use case için sahiplikten bağımsız) |
| ADDRESS  | NULL     | required          | auto = address.label + city | `WHERE service.addressId = target.addressId` |
| CUSTOM   | optional | optional          | required (user-typed) | Wizard'da explicit serviceId[] listesi → her serviceId için ayrı `PartnerSyncAttempt` ama hepsi tek CUSTOM target'a bağlı |

**Validation kuralı** (Zod, `apps/web/src/lib/validators/address-change.ts`):
- `targetType = USER` → `targetUserId` not null
- `targetType = ADDRESS` → `addressId` not null
- `targetType = CUSTOM` → `label` not null AND wizard payload'unda `serviceIds[]` >= 1

## Wizard nasıl target üretir

Wizard step-by-step (→ 13'te UI):

1. **Scope picker** seçimine göre kabul mantığı:
   - `scopeType = SELF` → 1 adet USER target (targetUserId = currentUser.id)
   - `scopeType = MEMBER` → kullanıcı 1+ member seçer → N adet USER target
   - `scopeType = ALL_WORKSPACE` → tüm aktif members → N adet USER target
   - `scopeType = CUSTOM` → wizard'ın 2. step'inde explicit checkbox UI:
     - "By person" sekmesi → USER target'lar
     - "By address" sekmesi → ADDRESS target'lar
     - "Pick specific services" sekmesi → 1 CUSTOM target + selected serviceIds
2. **Service picker** her target için auto-pick yapar (USER → tüm servisleri, ADDRESS → adresteki tüm servisler). Kullanıcı checkbox'la in/out yapar.
3. **Commit** sırasında her target row yaratılır, sortOrder = wizard'daki görünme sırası.
4. Aynı anda her target için `PartnerSyncAttempt` rows seed edilir (→ 35), status PENDING.

**Edge case**: Aynı user **ve** aynı adres iki ayrı target'ta hedef olabilir mi? **Hayır** — wizard validation aşamasında deduplicate eder. Bir servisin iki ayrı target'ın altına düşmesi attempt unique constraint ihlali olur (`@@unique([eventId, serviceId, providerActionId])` — D7).

## Per-target status lifecycle

```
PENDING ──any attempt OPENED──▶ IN_PROGRESS
PENDING ──user skip──▶ SKIPPED
IN_PROGRESS ──all attempts DONE/SKIPPED & ≥1 DONE──▶ DONE
IN_PROGRESS ──all attempts SKIPPED──▶ SKIPPED
IN_PROGRESS ──user skip──▶ SKIPPED (pending/opened attempts → SKIPPED)
```

Status değişimi **service layer'da** hesaplanır (`apps/web/src/lib/address-change-target-status.ts`):
- Her `PartnerSyncAttempt` status update'inde parent target recompute edilir.
- Recompute trigger: explicit fonksiyon çağrısı (DB trigger değil — Prisma'da maintainable değil).

## Cascade kuralları

| Olay | Hedef target'lara etki |
|---|---|
| Event ARCHIVED | Targets okunabilir kalır, yeni attempt eklenemez. Status field değişmez. |
| Event ABANDONED | Tüm PENDING/IN_PROGRESS targets → SKIPPED, skipReason = "event_abandoned" |
| Event hard delete (admin / GDPR) | Targets cascade silinir (`onDelete: Cascade`) |
| Target user remove from workspace | USER target status SKIPPED, skipReason = "member_removed" — event devam eder |
| Address delete (event ACTIVE iken) | 11'te belirtildiği gibi engellenir (409). Event ARCHIVED ise addressId NULL'a düşer (set null). |

## API endpoint'leri

### Yeni

| Method | Path | Auth | Workspace ctx | Body | Response | Errors |
|---|---|---|---|---|---|---|
| GET | `/api/address-changes/:eventId/targets` | Session | required | — | `200 { targets[] }` | 401, 404 |
| GET | `/api/address-changes/:eventId/targets/:targetId` | Session | required | — | `200 { target, attempts }` | 401, 404 |
| PATCH | `/api/address-changes/:eventId/targets/:targetId` | Session | required | `{ status?: 'SKIPPED', skipReason? }` | `200 { target }` | 401, 404, 409 invalid transition |

**Not**: Target create endpoint **yok**. Targets sadece event POST sırasında veya wizard "add target" işleminde toplu yaratılır. Hiç birim test edilmesi gereken "add single target later" akışı MVP'de yok (Faz 2).

PATCH ile sadece manual SKIP transition desteklenir; DONE otomatik attempt'lerden gelir.

### Mevcut endpoint'lere etki

- `GET /api/address-changes/:id` (→ 11) response body'sinde `targets[]` ile inline gelir; ayrı çağrı opsiyonel.

## Web

### Yeni sayfa/route

Yok bu doc'ta (targets event detail sayfasında render edilir → 14).

### Mevcut sayfalara etki

- `/address-change/[id]` — accordion list (`<TargetAccordion>` 14'te).
- `/services/[id]` — eğer bu servis bir aktif event'in attempt'ına bağlıysa banner: "Bu servis aktif bir taşınmada (label) — [Open event]".

### Componentler

- Yok bu doc'ta; bkz. 13 (`<TargetPicker>`) ve 14 (`<TargetAccordion>`).

### Butonlar / actionlar

- "Skip this target" — accordion sağ üst.
- "Mark target done manually" — sadece tüm attempts SKIPPED durumda gösterilir (rare).

## Mobile

### Yeni ekran

- `AddressChangeDetailScreen` (14'te) target list'ini gösterir, expandable.

### Mevcut ekranlara etki

- Yok.

### Componentler

- `<TargetCard>` (mobile-specific, expand/collapse).

## Admin

### Yeni sayfa

- `/admin/address-changes/:id` (11'deki sayfada inline) — targets read-only tablo, hangi user/address, hangi status.

### Yetenekler

- Read-only. "Force skip" admin action (destek için), AdminAuditLog'a yazar.

## Güvenlik

- [x] **Step-up auth**: PATCH (skip) gerektirmez (D19, event-level auth yeterli).
- [x] **PII redaction**: targetUser email/name log'lanmaz; sadece userId. Address bilgileri 11'deki redaction kuralları.
- [x] **Audit log**: Target status değişimi `AuditLog` (`entityType=AddressChangeTarget`, `action=status_change`, `changes={ from, to, reason }`).
- [x] **Rate limit**: PATCH skip 30/min per user.
- [x] **Permission matris**:
  - Kullanıcı kendi USER target'ını skip edebilir
  - OWNER/ADMIN her target'ı skip edebilir
  - CHILD sadece kendi target'ında SKIP yapamaz; sadece owner removable
  - VIEW_ONLY hiçbir mutation yok
- [x] **Encryption at rest**: `skipReason` plain text (kullanıcı seçtiği serbest metin; PII riski düşük).
- [x] **GDPR DSAR**: User erase'de `targetUserId = NULL`'a set (target arşiv için kalsın), event metadata redact edilir.

## Migration / backward compat

- Migration: `20260601_address_change_target.sql` — yeni enum'lar, yeni tablo.
- 11 ile aynı migration'da bundle edilebilir (atomic). Rollback: tablo drop güvenli.

## Etkilenen mevcut özellikler

- `User` modeline `addressChangeTargets AddressChangeTarget[] @relation("AddressChangeTargetUser")`
- `Address` modeline `addressChangeTargets AddressChangeTarget[] @relation("AddressChangeTargetAddress")`

## Test plan

**Unit**
- targetType validation matrix (Zod)
- Status recompute fonksiyonu: 16 kombinasyon (PENDING/OPENED/DONE/SKIPPED × N attempt) → expected target status
- Cascade: event archive → target durum değişmez

**Integration**
- POST event with SELF scope → 1 USER target, targetUserId = caller
- POST event with ALL_WORKSPACE scope, 3 üye → 3 USER targets
- PATCH target skip → DB updated, attempts SKIPPED
- User remove from workspace → ilgili USER target SKIPPED

**E2E**
- Wizard CUSTOM scope: 3 servis seç → dashboard'da 1 CUSTOM target, 3 attempt
- Skip a target → progress header sayısı güncellenir

**Manual**
- Pro user yazlık adres seçer → ADDRESS target, attendant servisler attempt seed

## Açık sorular

1. CUSTOM target'a sonradan servis eklenebilir mi? **Karar önerisi**: MVP hayır; Faz 2'de "add more" butonu (yeni step-up auth gerektirir mi diye düşünmek lazım).
2. Bir USER target'ında userId silinirse target görünmesin mi yoksa "Removed user" placeholder mı? **Karar önerisi**: Placeholder + grayed out; history value.
3. ADDRESS target'ında `address` silinirse (rare; usually engellenir)? **Karar önerisi**: SET NULL + label snapshot kaydet (yeni alan `addressLabelSnapshot String?`).
