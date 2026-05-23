# Partner Sync Attempts

- **Status**: Proposed (Family/Pro launch, Sprint 3)
- **Tier**: Infrastructure (powers Pro Partner Hub + Bulk Queue)
- **Related decisions**: D7
- **Related docs**: `01-architecture-decisions.md`, `06-entitlements-system.md`, `11-address-change-event-model.md`, `12-address-change-target-model.md`, `14-bulk-queue-dashboard.md`, `34-service-provider-action-registry.md`, `36-partner-deep-link-launcher.md`, `53-admin-sync-attempts-dashboard.md`

## Amaç

Kullanıcının bir `AddressChangeEvent` çerçevesinde her partner action'a olan etkileşimini takip etmek: kaç kez açtı, ne zaman son açtı, tamamladı mı, atladı mı, başarısız oldu mu, confirmation numarası ne. D7 gereği `@@unique([eventId, serviceId, providerActionId])` ile idempotent (kullanıcı butona N kere bassa bile tek row, `openCount++`). Bu data:

- Bulk queue dashboard (14) progress UX'inin kaynağı
- Reminder cron (66) "şu partner'ı 3 gündür unutmuşsun" mailinin kaynağı
- Admin broken-URL dashboard (53) kaynağı
- Analytics events (65) için backing store

## Kapsam

**In scope**
- `PartnerSyncAttempt` Prisma modeli
- State machine: `PENDING → OPENED → DONE | SKIPPED | FAILED`
- Auto-create when event built (POST /api/sync-attempts veya event-create job)
- PATCH status / notes / confirmation
- GET single attempt
- Workspace member permission check
- Idempotent upsert (unique key)
- Audit log entries

**Out of scope**
- AddressChangeEvent ve Target modelleri (→ 11, 12)
- Bulk queue UI (→ 14)
- Launcher flow (→ 36) — bu doc data layer, 36 UX layer
- Admin sync attempts dashboard (→ 53)
- PartnerConsent (Faz 2, → 45)

## User stories

- **As an AddressChangeEvent creator**, event oluşturduğumda her ilgili `Service × ServiceProviderAction` çifti için `PartnerSyncAttempt` (status=PENDING) otomatik yaratılır.
- **As a Pro user**, Bulk Queue'da "Netflix - Update address" satırına tıkladığımda launcher (36) tetiklenir; ilk tıklamada `status=OPENED`, `openCount=1`. Yeniden açarsam aynı row, `openCount=2`.
- **As a Pro user**, partner site'ında güncellemeyi yaptıktan sonra "Done ✓" işaretlerim → `status=DONE`, `completedAt=now`, opsiyonel `confirmationNumber`.
- **As a Pro user**, "Skip — already updated elsewhere" derim → `status=SKIPPED`.
- **As a Pro user**, "Couldn't update — broken link" → `status=FAILED` + serbest notes. Admin 53 dashboard'da görür.
- **As admin support**, kullanıcının event'ine bakar, hangi partner'lar PENDING/FAILED görür.

## Veri modeli

```prisma
+ model PartnerSyncAttempt {
+   id      String @id @default(cuid()) @db.VarChar(30)
+
+   eventId String @db.VarChar(30)
+   event   AddressChangeEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
+
+   serviceId String? @db.VarChar(30)
+   service   Service? @relation(fields: [serviceId], references: [id], onDelete: SetNull)
+   // nullable: USPS mail forwarding gibi non-service partner action'ları için NULL
+
+   providerActionId String @db.VarChar(30)
+   providerAction   ServiceProviderAction @relation(fields: [providerActionId], references: [id], onDelete: Restrict)
+
+   status String @default("PENDING") @db.VarChar(20)
+   // PENDING | OPENED | DONE | SKIPPED | FAILED
+
+   openCount Int @default(0)
+
+   lastOpenedAt        DateTime?
+   lastConfirmationAt  DateTime?
+   completedAt         DateTime?
+
+   confirmationNumber  String? @db.VarChar(100)
+   notes               String? @db.Text
+   resultMetadataJson  String? @db.Text
+   // örn: { "channel":"PDF","downloadedAt":"...","filename":"..." }
+   // veya: { "errorReason":"BROKEN_URL","statusCode":404 }
+
+   createdByUserId String? @db.VarChar(30)
+   createdBy       User?   @relation("PartnerSyncAttemptCreator", fields: [createdByUserId], references: [id], onDelete: SetNull)
+
+   updatedByUserId String? @db.VarChar(30)
+   updatedBy       User?   @relation("PartnerSyncAttemptUpdater", fields: [updatedByUserId], references: [id], onDelete: SetNull)
+
+   createdAt DateTime @default(now())
+   updatedAt DateTime @updatedAt
+
+   @@unique([eventId, serviceId, providerActionId])
+   @@index([eventId])
+   @@index([providerActionId])
+   @@index([status])
+ }
```

**Not**: `@@unique` `serviceId` nullable. MySQL'de NULL'lar unique check'ten escape eder (her NULL ayrı kabul edilir). Bu nedenle service-less (USPS) attempt'ler için ek garanti gerekir: application-level upsert key `(eventId, COALESCE(serviceId,"_NULL"), providerActionId)`. Test edilecek.

**Alternatif**: NULL yerine `__GLOBAL__` placeholder serviceId? Daha temiz ama foreign key bozulur. Karar: nullable + app-level dedupe; integration test koy.

### State machine

```
PENDING ──open──► OPENED ──confirm──► DONE
   │                 │
   │                 ├──skip──────► SKIPPED
   │                 │
   │                 └──fail──────► FAILED ──retry-open──► OPENED
   │                                                 (openCount++)
   └──auto-skip on event-cancel──► SKIPPED (system)
```

Transitions kodda enforce edilir (`packages/shared/src/sync-attempt-state.ts`):

```ts
const ALLOWED: Record<Status, Status[]> = {
  PENDING:  ["OPENED", "SKIPPED"],
  OPENED:   ["OPENED", "DONE", "SKIPPED", "FAILED"], // re-open allowed
  FAILED:   ["OPENED", "SKIPPED", "DONE"],            // retry path
  DONE:     [],                                        // terminal
  SKIPPED:  ["OPENED"],                                // user can undo
};
```

## API endpoint'leri

### Yeni
| Method | Path | Auth | Workspace ctx | Body | Response | Errors |
|---|---|---|---|---|---|---|
| POST | `/api/sync-attempts` | required | required | `{ eventId, serviceId?, providerActionId }[]` (batch) veya tekil | `PartnerSyncAttemptDto[]` (upserted) | 401, 403, 404 (event/action), 422 |
| PATCH | `/api/sync-attempts/[id]` | required | required | `{ status?, notes?, confirmationNumber?, resultMetadata? }` | `PartnerSyncAttemptDto` | 401, 403, 404, 409 (invalid transition), 422 |
| GET | `/api/sync-attempts/[id]` | required | required | — | `PartnerSyncAttemptDto` | 401, 403, 404 |
| GET | `/api/sync-attempts?eventId=` | required | required | query: `eventId` | `PartnerSyncAttemptDto[]` | 401, 403 |

POST davranışı:
- Event-create flow (11) kendi içinde POST batch çağırır — her ilgili Service için relevant action'ları (`activeActionsForService(serviceId)` helper) iterate eder.
- Tekil POST (manual add) Sprint 4 polish: kullanıcı Bulk Queue'da "Add partner..." butonuyla extra attempt ekleyebilir.

PATCH davranışı:
- `status: "OPENED"` → `openCount++`, `lastOpenedAt = now()`.
- `status: "DONE"` → `completedAt = now()`, `lastConfirmationAt = now()`.
- State machine ALLOWED check; ihlal → 409.
- Updater audit field set.

### Mevcut endpoint'lere etki

- `POST /api/address-change-events` (11): create transaction'ı içinde batch POST yapar (aynı request scope).
- `DELETE /api/address-change-events/[id]` or cancel: cascade delete `PartnerSyncAttempt`'leri siler (Prisma `onDelete: Cascade`). Eğer event "COMPLETED" arşivde tutuluyorsa attempt'ler de korunur (history için kritik).
- `GET /api/address-change-events/[id]` response'una `attemptsSummary: { pending, opened, done, skipped, failed }`.

### Server-side permission check

`requireWorkspaceContext` (07) sonrası:
1. Event'i fetch et, `event.workspaceId === ctx.workspaceId` doğrula.
2. Event status `ACTIVE` mi (DRAFT veya COMPLETED'de PATCH yasak; COMPLETED'de GET açık).
3. CHILD rolü: sadece `event.targetUserId === ctx.userId` ise PATCH erişimi (22).
4. VIEW_ONLY: GET açık, PATCH 403.

## Web

### Yeni sayfa/route
Hiçbiri (UI 14 ve 36'da).

### Mevcut sayfalara etki
- Bulk Queue (14) PATCH endpoint'ini her status değişiminde çağırır.
- Launcher (36) "Open & Update" başlangıcında PATCH `status=OPENED`.

### Componentler (file paths)
- `apps/web/src/lib/sync-attempts-api.ts` (yeni) — typed fetch wrappers.
- `apps/web/src/hooks/useSyncAttempts.ts` (yeni) — SWR/React Query hook for live event status.

### Butonlar / actionlar
Bu doc'ta direkt buton yok; 36'da launcher buttons, 14'te queue UI.

## Mobile

### Yeni ekran
Yok.

### Mevcut ekranlara etki
- Mobile launcher (36) ve queue (14) bu API'leri çağırır.

### Componentler
- `apps/mobile/src/lib/sync-attempts-api.ts` (paylaşımlı tip `packages/shared/src/sync-attempts.ts`).

## Admin

### Yeni sayfa / Yetenekler
- `apps/admin/src/app/(admin)/sync-attempts/page.tsx` (→ 53) — global list + filter status=FAILED.
- Admin override aksiyonu: "Mark as DONE" support için. Audit log + reason zorunlu.

## Güvenlik

- [x] **Step-up auth**: Event create'i zaten step-up almıştır (D10/D19). Attempt PATCH için **ek step-up yok** (D19 — bir event için bir challenge).
- [x] **PII redaction**: `notes` ve `confirmationNumber` PII içerebilir. Log'larda mask edilir. Export DSAR'da raw.
- [x] **Audit log**: Her PATCH `AddressChangeAuditLog`'a yazılır (`actor`, `previousStatus`, `nextStatus`, `eventId`, `attemptId`, `at`). FAILED reasoning serbest text → moderation gerekmez (private to workspace).
- [x] **Rate limit**: PATCH user başına 120/dk (legit bulk run 50–100 click bekliyor). POST batch 10/dk.
- [x] **Permission matris**:
  - OWNER/ADMIN/MEMBER: any event-attempt of own workspace, full PATCH.
  - CHILD: only `event.targetUserId === self` attempts (22).
  - VIEW_ONLY: GET only.
  - OVERFLOW: GET only.
- [ ] **Encryption at rest**: `confirmationNumber` low sensitivity; encrypt değil. `notes` user-typed; encrypt değil (workspace içi private zaten).
- [x] **GDPR DSAR**: User-data-export'a `PartnerSyncAttempt[] WHERE eventId IN (user's events)` dahil. Erase: cascade üzerinden Event delete olunca attempt'ler de.

## Migration / backward compat

- Migration: yeni tablo + indexes + FK'ler.
- Mevcut event kayıtları (henüz yok — AddressChangeEvent kendisi de yeni, 11). Backfill gerekmez.
- Eğer event modeli 11 yayınlanmadan önce bu tabloyu yaratıyorsak, FK temporal sorun var. Sıra: 11 migration → 35 migration (aynı PR'da peş peşe).

## Etkilenen mevcut özellikler

- AddressChangeEvent create flow (11): event create + sync-attempt batch tek transaction.
- Bulk Queue dashboard (14): primary consumer.
- Launcher (36): primary writer.
- Reminders cron (66): "your event has 5 pending partners" mail.
- Admin sync-attempts dashboard (53): broken URL tespit.
- Analytics (65): event'ler bu tabloyu trigger eder (`sync_attempt_opened`, `sync_attempt_completed`).

## Test plan

**Unit**
- State machine: ALLOWED transitions accept; disallowed reject.
- Upsert idempotency: aynı (eventId, serviceId, providerActionId) 5 POST → 1 row.
- NULL serviceId dedupe: 2 POST aynı (eventId, null, actionId) → 1 row (app-level guard).
- PATCH `status=OPENED` → `openCount++` ve `lastOpenedAt` set.
- Permission: CHILD'ın başka user'ın target'ı için PATCH → 403.

**Integration**
- Event create endpoint → expected sync-attempt rows created in same TX.
- PATCH `status=DONE` → audit log row written.
- Cascade delete: event delete → attempts disappear.
- VIEW_ONLY member PATCH → 403.
- Rate limit: 121 PATCH in 60s → 429.

**E2E (Playwright)**
- Pro user creates event with 3 services, 4 actions → bulk queue shows 4 pending; click "Open & Update" → status moves OPENED, count 1; click again → count 2; click "Done" → DONE.

**Manual**
- Admin "Mark as DONE" override → audit log entry visible.
- Concurrent PATCH from 2 workspace members on same attempt → last write wins, audit shows both.

## Açık sorular

- `serviceId` NULL için sentinel pattern (örn `__GLOBAL_USPS__` reserved Service row) düşünüldü, reddedildi (FK temizliği). App-level dedupe yeterli mi? PR review.
- `resultMetadataJson` schema validation (Zod) gerekli mi? Önerilen: evet, server-side narrow union.
- Auto-create batch boyutu (event 200 partner içeriyorsa) — Prisma `createMany` ile mı yoksa loop upsert mi? `createMany` skip-duplicates true ile çok daha hızlı; karar: createMany.
- Reminder timing — kaç gün sonra "you have 3 pending"? Önerilen: gün 1, gün 3, gün 7. 66'da netleşir.
- `openCount` overflow için Int yeterli (int32 = 2B). Fine.
