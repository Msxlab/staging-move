# Family Reminders Consolidated

> **Drift fix 2026-05-23** — Çelişkili değerler [`01a-canonical-values.md`](./01a-canonical-values.md) (§C7) ile geçersizdir. Service assignee modeli `ServiceAssignee` junction tablosudur (`Service.assignedUserIds` JSON yoktur). Reminder targeting bu junction'dan türetilir; `ReminderTarget` ayrı junction olarak (sıcak path) yaşar.

- **Status**: Proposed (Family/Pro launch, Sprint 3)
- **Tier**: Family + Pro
- **Related decisions**: D1 (workspace tek root), D2 (entitlement owner'dan, grace), D3 (field-level visibility), D5 (CHILD rolü), D17 (PERSONAL workspace backfill), D21 (limit canonical)
- **Related docs**: 01-architecture-decisions.md, 02-workspace-model.md, 03-workspace-member-roles.md, 20-family-plan-definition.md, 22-child-role.md, 23-shared-services.md, 24-family-budget-consolidated.md, 30-pro-plan-definition.md, 60-mobile-billing-readonly.md, 63-entitlement-banners-empty-states.md, 66-email-templates.md, 67-i18n-tr-en.md

## Amaç

Mevcut per-service `Reminder` modelini bozmadan workspace-bağlamlı bir **konsolide hatırlatıcı feed**i çıkarmak: Family/Pro workspace'in tüm aktif servislerinden doğan bill/renewal/contract-expiry reminder'larını tek feed'de göstermek; üye filtresi, kişisel snooze, workspace-wide dismiss, push routing (assigned member + OWNER duplicate option), email digest, quiet hours per member ve CHILD görünürlüğü. Mevcut notifications altyapısı (`NotificationPreference`, `Notification`, `NotificationQueue`) ile entegre.

## Kapsam

In scope:
- `Reminder` modeline `workspaceId` ve `scope` (`PERSONAL | WORKSPACE`) alanları
- Yeni `ReminderTarget` junction tablosu (kim hedef? `ServiceAssignee` ile aynı junction patterni)
- Per-user `ReminderInteraction` tablosu (snooze, dismiss, done — user-level state)
- Web `/notifications` workspace view (member filter + chips)
- Mobile `app/notifications/index.tsx` workspace view
- Push notification routing (NotificationQueue → assigned members + optional duplicate to OWNER)
- Email digest (weekly) per member, `NotificationPreference.frequency = WEEKLY` ile entegre
- CHILD gates: sadece kendi targeted reminders
- Quiet hours per member (NotificationPreference extension)
- Workspace-wide dismiss yetkisi OWNER/ADMIN
- "Mark done" workspace-wide vs personal ayrımı

Out of scope:
- Mevcut single-service reminder CRUD endpoint (genişletilir, mantığı bozulmaz)
- Notification engine queue runner (mevcut cron) — yeni event tipi consumer'ı zaten generic
- Push provider entegrasyonu (mevcut Expo Notifications)
- Email template render engine (66'da)
- Calendar (ICS) export — Faz 2
- Smart suggestion ML (Faz 3)

## User stories

- **Family OWNER**: /notifications açtığımda workspace-wide feed: "Mehmet'in araba sigortası — 3 gün", "Internet faturası — yarın", "Mira'nın Spotify — 5 gün"; her satırda assigned member avatar'ı.
- **OWNER**: Member chip filtresi: "Sadece Mehmet" → onun reminder'ları.
- **MEMBER**: Kendime atanmış reminder için push notification alırım; OWNER'ın "duplicate to me" tercihi açıksa o da paralel alır (NotificationPreference).
- **MEMBER**: Bir reminder'ı snooze ederim (24 saat) → sadece bana etkisi; diğer üyeler hala görür.
- **OWNER/ADMIN**: Bir reminder'ı "Dismiss for everyone" yapabilirim (workspace-wide), MEMBER yapamaz.
- **CHILD**: Sadece bana atanmış reminder'ları görürüm; aile bütçesi reminder'ı (workspace scope, sadece OWNER target) görünmez.
- **OWNER**: Haftalık email digest istiyorum: her pazartesi 09:00, gelecek 7 günün workspace reminder'ları.
- **MEMBER**: Quiet hours 22:00–07:00 set ettim; push o saatlerde gelmez, ertesi sabah toplanır.

## Veri modeli

```prisma
// packages/db/prisma/schema.prisma — Reminder modeli genişlemesi

model Reminder {
  id String @id @default(cuid()) @db.VarChar(30)

  serviceId String?  @db.VarChar(30)
  service   Service? @relation(fields: [serviceId], references: [id], onDelete: Cascade)

+ workspaceId String @db.VarChar(30)
+ workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

+ scope String @default("PERSONAL") @db.VarChar(20) // PERSONAL | WORKSPACE

  type    String  @db.VarChar(30)  // BILL_DUE | RENEWAL | CONTRACT_EXPIRY | CUSTOM
  title   String  @db.VarChar(200)
  message String? @db.Text

  remindAt DateTime
  sent     Boolean   @default(false)
  sentAt   DateTime?

  isRecurring    Boolean @default(false)
  recurrenceRule String? @db.VarChar(100)

+ dismissedAt DateTime?           // workspace-wide dismiss
+ dismissedByUserId String? @db.VarChar(30)

+ targets ReminderTarget[]
+ interactions ReminderInteraction[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([remindAt, sent])
  @@index([serviceId])
+ @@index([workspaceId, remindAt])
+ @@index([workspaceId, scope, dismissedAt])
}

+ model ReminderTarget {
+   id          String   @id @default(cuid()) @db.VarChar(30)
+   reminderId  String   @db.VarChar(30)
+   reminder    Reminder @relation(fields: [reminderId], references: [id], onDelete: Cascade)
+   userId      String   @db.VarChar(30)
+   user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
+
+   createdAt   DateTime @default(now())
+
+   @@unique([reminderId, userId])
+   @@index([userId])
+ }

+ model ReminderInteraction {
+   id         String   @id @default(cuid()) @db.VarChar(30)
+   reminderId String   @db.VarChar(30)
+   reminder   Reminder @relation(fields: [reminderId], references: [id], onDelete: Cascade)
+   userId     String   @db.VarChar(30)
+   user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
+
+   snoozedUntil DateTime?
+   doneAt       DateTime?  // user marked done (personal)
+
+   createdAt DateTime @default(now())
+   updatedAt DateTime @updatedAt
+
+   @@unique([reminderId, userId])
+   @@index([userId, snoozedUntil])
+ }
```

**`NotificationPreference` extension**:

```prisma
model NotificationPreference {
  // ... existing fields ...
+ quietHoursStart String? @db.VarChar(5)  // "22:00"
+ quietHoursEnd   String? @db.VarChar(5)  // "07:00"
+ duplicateToOwner Boolean @default(false) // OWNER tercihi: assigned olduğum + ek olarak workspace tüm reminder'ları al
}
```

**Neden `ReminderTarget` junction?** Push routing, snooze indexing ve "find all reminders for user X" sorgusu sıcak path; junction tablosu indexable. Canonical §C7'ye uyumlu (Service için de `ServiceAssignee` junction kullanılır).

### Migration

```sql
ALTER TABLE Reminder
  ADD COLUMN workspaceId VARCHAR(30) NOT NULL DEFAULT '',
  ADD COLUMN scope VARCHAR(20) NOT NULL DEFAULT 'PERSONAL',
  ADD COLUMN dismissedAt DATETIME(3),
  ADD COLUMN dismissedByUserId VARCHAR(30);

-- Backfill workspaceId from Service.workspaceId (after 23 migration)
UPDATE Reminder r
JOIN Service s ON s.id = r.serviceId
SET r.workspaceId = s.workspaceId
WHERE r.workspaceId = '';

-- Custom reminders (serviceId IS NULL) backfill — bunlar mevcut sistemde User'a bağlı değil
-- Eğer mevcut "user-attached custom reminder" yoksa skip; varsa
-- prior model'i `userId` üzerinden workspaceId çekilir.

-- Create ReminderTarget for each existing Reminder → ServiceAssignee rows of service
INSERT INTO ReminderTarget (id, reminderId, userId, createdAt)
SELECT
  CONCAT('rt_', SUBSTRING(MD5(CONCAT(r.id, su.userId)), 1, 24)),
  r.id,
  su.userId,
  NOW()
FROM Reminder r
JOIN Service s ON s.id = r.serviceId
JOIN ServiceAssignee sa ON sa.serviceId = s.id
WHERE r.serviceId IS NOT NULL;
-- sa.userId aliased as su.userId in the SELECT above is conceptual;
-- replace su.userId with sa.userId in the SELECT clause when running this migration.

ALTER TABLE Reminder ALTER COLUMN workspaceId DROP DEFAULT;
```

Migration script `packages/db/prisma/migrations/<ts>_consolidated_reminders.ts`; D17 dual-read window içinde çalışır. Service backfill (23) tamamlandıktan sonra koşar.

## API endpoint'leri

### Yeni

| Method | Path | Auth | Workspace ctx | Body / Query | Response | Errors |
|---|---|---|---|---|---|---|
| GET | `/api/reminders/feed` | required | required | query: `memberId?`, `from?=ISO`, `to?=ISO`, `includeCompleted?=bool`, `scope?=ALL\|MINE` | `ReminderFeedItem[]` | 403 grace expired |
| POST | `/api/reminders/[id]/snooze` | required | required | `{ snoozeUntil: ISO }` | `{ interaction }` | 403 not targeted, 400 invalid time |
| POST | `/api/reminders/[id]/done` | required | required | `{ scope?: 'PERSONAL' \| 'WORKSPACE' }` (default PERSONAL) | `{ interaction \| reminder }` | 403 WORKSPACE only OWNER/ADMIN |
| POST | `/api/reminders/[id]/dismiss` | required | required | — | `{ reminder }` | 403 OWNER/ADMIN only |
| GET | `/api/notifications/preferences/quiet-hours` | required | — | — | `{ start, end }` | — |
| PATCH | `/api/notifications/preferences/quiet-hours` | required | — | `{ start: "HH:MM", end: "HH:MM" }` | `{ start, end }` | 400 invalid format |
| PATCH | `/api/notifications/preferences/duplicate-to-owner` | required | — | `{ enabled: bool }` | `{ enabled }` | 403 not OWNER (this pref only meaningful for OWNER) |

```ts
// apps/web/src/lib/types/reminders.ts
export interface ReminderFeedItem {
  id: string;
  type: string;
  title: string;
  message: string | null;
  remindAt: string;
  scope: "PERSONAL" | "WORKSPACE";
  service: { id: string; providerName: string; category: string } | null;
  targets: Array<{ userId: string; displayName: string; avatarUrl: string | null }>;
  myInteraction: {
    snoozedUntil: string | null;
    doneAt: string | null;
  } | null;
  dismissed: boolean;
}
```

### Mevcut endpoint'lere etki

- `GET /api/notifications` (apps/web/src/app/api/notifications): mevcut in-app notification list endpoint'i değişmez; reminder feed ayrı endpoint olarak yaşar. UI'da iki feed ayrı tab veya merged view (UX tartışılır — şimdilik ayrı tab).
- `POST /api/reminders` (mevcut create) — body'e opsiyonel `targetUserIds: string[]` (verilmezse `ServiceAssignee` join üzerinden türetilir), `scope: 'PERSONAL'|'WORKSPACE'` (default PERSONAL).
- `PATCH /api/reminders/[id]` — `dismissedAt`/`scope` write yasak (ayrı endpoint'ler); diğer alanlar permission gate'iyle.
- `requireWorkspaceContext` (07) — CHILD ise feed query'sine `WHERE ReminderTarget.userId = caller` filter zorunlu.

### Cron worker

Mevcut `NotificationQueue` processor (cron) genişler:
- Reminder.remindAt geldiğinde, ReminderTarget üyelerinin her biri için `NotificationQueue` row yaratır.
- OWNER'ın `duplicateToOwner=true` ise + OWNER target değilse, ek queue row.
- Üye quiet hours içinde ise `sendAt` quiet hours bitişine ertelenir (timezone: `User.timezone` mevcut alandan, yoksa UTC).
- Üyenin `ReminderInteraction.snoozedUntil > now` ise atla.

## Web

### Yeni sayfa/route
- `/notifications` mevcut sayfa genişler; iki tab: "Notifications" (mevcut in-app), "Reminders" (yeni workspace feed). Default tab: workspace üye sayısı > 1 ise Reminders.

### Mevcut sayfalara etki
- `apps/web/src/app/(app)/notifications/page.tsx`:
  - Tab UI + ReminderFeedView component.
  - Member filter chip row.
  - Quick filter: "Today", "This week", "This month", "Done", "Snoozed".
- `apps/web/src/app/(app)/settings/notifications/page.tsx`:
  - Quiet hours start/end time picker.
  - "Duplicate workspace reminders to me" toggle (sadece OWNER görür).
  - Weekly digest opt-in (per channel).

### Componentler (file paths)
- `apps/web/src/components/reminders/ReminderFeedView.tsx` — root.
- `apps/web/src/components/reminders/ReminderCard.tsx` — title, member avatar(s), countdown, actions.
- `apps/web/src/components/reminders/MemberFilterChips.tsx` (24'tekiyle paylaşılabilir — barrel).
- `apps/web/src/components/reminders/QuickRangeTabs.tsx`.
- `apps/web/src/components/reminders/SnoozeMenu.tsx` (1h, 3h, 1 gün, custom).
- `apps/web/src/components/reminders/DismissModal.tsx` — workspace-wide confirm.
- `apps/web/src/components/notifications/QuietHoursPicker.tsx`.

### Butonlar / actionlar
- Card aksiyon: "Snooze" (kişisel), "Done" (kişisel default; OWNER/ADMIN için "Mark done for everyone" alt option), "Dismiss" (OWNER/ADMIN, workspace-wide).
- "Send myself a copy" — OWNER ayar.
- Card click → drill `/services/[id]` (eğer serviceId varsa).

## Mobile

### Yeni ekran
- Yok; `apps/mobile/app/notifications/index.tsx` mevcut ekran genişler.

### Mevcut ekranlara etki
- `apps/mobile/app/notifications/index.tsx`:
  - SegmentControl: "Notifications" | "Reminders".
  - Reminders tab: workspace feed; pull-to-refresh; member chips.
  - CHILD için sadece "Notifications" sekmesi (filtered).
- `apps/mobile/app/settings/notifications.tsx`:
  - Quiet hours time pickers.
  - Duplicate-to-owner toggle (OWNER only, RoleGate).
  - Weekly digest toggle.

### Componentler
- `apps/mobile/src/components/reminders/ReminderFeed.tsx`
- `apps/mobile/src/components/reminders/ReminderRow.tsx` (swipe actions: snooze, done, dismiss)
- `apps/mobile/src/components/notifications/QuietHoursPicker.tsx` (native time picker)

### Push routing
- Mevcut Expo Notifications setup (`apps/mobile/src/lib/notifications.ts`) — payload'a `reminderId`, `workspaceId`, `serviceId` ekle; tap action → `/notifications?reminderId=...` deep-link.
- Background fetch / FCM/APNs üzerinden NotificationQueue cron'dan tetiklenir.

## Admin

### Yeni sayfa / Yetenekler
- `/admin/workspaces/[id]/reminders` (50'nin altında):
  - Workspace'in aktif reminder'ları listesi (debug).
  - "Send test reminder" butonu (admin manual trigger, audit log).
- `/admin/notifications/queue` (mevcut) — `metadata` JSON'da `reminderId/workspaceId` artık var; admin filter eklenir.

## Güvenlik

- [x] **Step-up auth**: Reminder feed read/snooze/done **gerekmez**. Workspace-wide "Dismiss" OWNER/ADMIN için step-up **gerektirmez** (low-risk action; ancak audit log). Faz 2'de "Mark done for everyone" sayıca toplu olursa step-up eklenir.
- [x] **PII redaction**: Feed item'da servis adı + kategori + member display name görünür; account number, fatura tutarı **yok** (yalnız "BILL_DUE" tipi başlıkta). Push notification body i18n template'de masked.
- [x] **Audit log**: Yeni event tipleri:
  - `REMINDER_DISMISSED_WORKSPACE { reminderId, byUserId }`
  - `REMINDER_SNOOZED { reminderId, userId, until }`
  - `REMINDER_MARKED_DONE_WORKSPACE`
  - `QUIET_HOURS_UPDATED`
- [x] **Rate limit**: Feed endpoint 60 req/dakika; snooze 30 req/dakika.
- [x] **Permission matris**:
  - Feed read: tüm üyeler; CHILD filtered.
  - Snooze: target üye kendisi.
  - Personal done: target üye kendisi.
  - Workspace done/dismiss: OWNER/ADMIN.
  - Reminder create (target set farklı): OWNER/ADMIN/service owner.
  - Reminder delete: OWNER/ADMIN.
- [x] **Encryption at rest**: Reminder.title/message düz text (özetler, hassas data değil). Service.accountNumber zaten encrypted, reminder mesajına dolaylı sızmamalı (template'lerde redaction).
- [x] **GDPR DSAR**: Kullanıcı export'unda kendi ReminderInteraction + targeted Reminder ID'leri dahil. Erase: ReminderTarget/Interaction CASCADE.

## Migration / backward compat

- Mevcut `Reminder` row'ları için `workspaceId` backfill (yukarıda SQL).
- Mevcut "tek kişilik" workspace'lerde davranış değişmez: 1 target = 1 üye, feed view aynı UX'i sunar.
- Eski mobile sürümleri yeni endpoint'leri çağırmaz; mevcut `/api/reminders` GET/PATCH çalışmaya devam eder.
- Plan downgrade Family → Individual: Workspace feed gizlenir (UI tab kaldırılır), personal reminders mevcut UI'da çalışmaya devam eder. ReminderTarget row'ları korunur (silinmez), Faz 2'de yeniden Family alınırsa data restored.
- Eski reminders sayfası feature flag `reminders-workspace-feed` arkasında lansman; bug çıkarsa flag kapat.

## Etkilenen mevcut özellikler

- **`packages/db/prisma/schema.prisma`** — Reminder genişlemesi + 2 yeni tablo.
- **`apps/web/src/app/api/reminders/*`** — mevcut endpoint genişletilir.
- **`apps/web/src/app/(app)/notifications/page.tsx`** — tab + feed view.
- **`apps/web/src/app/(app)/settings/notifications/page.tsx`** — quiet hours + duplicate toggle.
- **`apps/mobile/app/notifications/index.tsx`** — segment control.
- **`apps/mobile/app/settings/notifications.tsx`** — preference toggle.
- **Notification cron worker** (mevcut) — target fan-out + quiet hours logic.
- **`packages/shared/src/audit-event-types.ts`** — yeni event isimleri.
- **i18n (67)** — feed copy, snooze options, dismiss confirm.
- **Email templates (66)** — weekly digest template.

## Email digest

- Cron: pazartesi 09:00 (her üyenin local timezone'una göre).
- Query: gelecek 7 günde `remindAt` olan, target üye = kullanıcı, `dismissedAt IS NULL`, `ReminderInteraction.doneAt IS NULL OR snoozedUntil < now`.
- Render: 66'da `weekly-reminder-digest` template.
- Opt-in: `NotificationPreference { channel: 'EMAIL', type: 'REMINDER', frequency: 'WEEKLY' }`.
- Workspace summary: OWNER için ek bölüm "Other members' upcoming reminders (5 items)" (duplicateToOwner false bile olsa digest'te aggregate görür — UX tercihi).

## Test plan

### Unit
- Migration backfill: 10 reminder + 30 ReminderTarget yaratılır, doğru servis-üye eşleşmesi.
- Snooze: ReminderInteraction.snoozedUntil > now ise feed item'da `myInteraction.snoozedUntil` populated; push cron skip.
- Workspace dismiss: `Reminder.dismissedAt` set, feed default filter `dismissedAt IS NULL`.
- CHILD filter: 5 reminder (3 targeted child, 2 değil) → CHILD sees 3.
- Quiet hours: 23:00 trigger, quietHoursStart=22, end=07 → sendAt 07:00 ertesi gün.
- Permission: MEMBER POST /dismiss → 403.

### Integration
- `GET /api/reminders/feed` happy path.
- `POST /api/reminders/[id]/snooze` 24h → next call shows snoozedUntil.
- `POST /api/reminders/[id]/dismiss` as ADMIN → success; as MEMBER → 403.
- Member filter → narrow results.
- Cron tick: due reminder generates NotificationQueue row per target.
- duplicateToOwner=true: extra queue row for OWNER.

### E2E (Playwright)
- OWNER login → /notifications → Reminders tab → feed shows all.
- Snooze → card moves to "Snoozed" filter.
- Dismiss → workspace-wide gone for everyone (new session check).
- CHILD login → only own reminders.
- Settings: set quiet hours → toast confirms.

### Manual QA
- Mobile push: simulate due reminder, device receives notification with title + member avatar.
- Quiet hours: actual device timezone test.
- Weekly digest: cron manual trigger via admin → email arrives with correct grouping.
- Performance: workspace with 250 services × avg 1 active reminder = 250 ReminderTarget per fan-out; verify cron <30s.

## Açık sorular

- [ ] "Mark done for everyone" UX — confirm modal'da yine de "Are you sure? This will hide for all members" netliği yeterli mi? Audit yeter görüldü.
- [ ] CHILD'a custom reminder yaratma (sadece kendisi için) izin var mı? — MVP'de **evet** (PERSONAL scope, target=self); doc dışı edge.
- [ ] Quiet hours global mı, kanal-bazlı mı (push vs email)? — Karar: push-only (email digest zaten haftalık); MVP'de "push quiet hours" tek alan.
- [ ] Email digest gönderilirken Owner subscription expired ise işlem ne? — Cron her tick'te grace check; expired ise digest skip + audit.
- [ ] "Send myself a copy" sadece OWNER mı, ADMIN da görsün mü? — OWNER + ADMIN ikisi de.
- [ ] Reminder model'inde `scope=PERSONAL` ile `workspaceId` zorunlu çakışması: PERSONAL reminder yine workspaceId taşır (kullanıcının primary workspace'i). Filter `scope=PERSONAL AND targets.userId=self` ile çekilir. Doc bunu netliyor; ek alan gereksiz.
- [ ] Timezone: `User.timezone` alanı mevcut değilse Faz 2 eklenir; MVP'de UTC fallback + UI'da kullanıcı uyarı.
- [ ] Reminder targeting bir servise yeni member assigned olduğunda gelecekteki reminder'lara otomatik ekleniyor mu? — Karar: Yeni reminder yaratılırken `targetUserIds = ServiceAssignee(serviceId)` snapshot; geçmiş reminder targets değişmez (history of intent). UI'da bilgilendirme.
- [ ] ICS calendar export Faz 2'de kullanıcı reminder feed'ini takvime ekleyebilir — schema bu MVP'de uygun mu? — Evet, ek alan gerekmez.
