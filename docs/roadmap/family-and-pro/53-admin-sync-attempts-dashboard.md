# Admin Sync Attempts Dashboard

- **Status**: Proposed (Family/Pro launch, Sprint 3)
- **Tier**: Admin
- **Related decisions**: D7 (PartnerSyncAttempt idempotent + openCount), D15 (Day 1 partner API yok → broken URL tespit kritik)
- **Related docs**: [`35-partner-sync-attempts.md`](./35-partner-sync-attempts.md), [`34-service-provider-action-registry.md`](./34-service-provider-action-registry.md), [`51-admin-provider-actions-crud.md`](./51-admin-provider-actions-crud.md), [`36-partner-deep-link-launcher.md`](./36-partner-deep-link-launcher.md)

## Amaç

D15 stratejisi gereği lansman partner sync'i %100 deep-link / mailto / PDF üzerinden — yani **kalite tek kontrol noktasına bağlı: admin tarafının verileri**. Bir partner sitesi URL'ini değiştirir veya formu kaldırırsa, kullanıcı sessizce başarısız olur. Bu dashboard'un işi: hangi action'lar **gerçekte çalışmıyor** otomatik tespit etmek ve admin'e öncelikli liste vermek.

Read-only dashboard — burada write yapmaz; "isActive=false yap" gibi düzeltmeler doc 51'in endpoint'lerini çağırır.

## Kapsam

**In scope**
- `/sync-attempts` ana sayfa
- 30 günlük metrik panosu (total / done / failed / opened-not-marked)
- Action bazında gruplu tablo (success rate, last attempt, common failure)
- Auto-flag: success rate <50% over 20+ attempts → "Likely broken"
- Action detail drill-down (son 20 attempt, anonimleştirilmiş)
- "Mark inactive" (doc 51 endpoint'i çağırır)
- "Open URL to test" (yeni tab, dummy data)
- "Create governance issue" (ProviderGovernanceIssue row yaratır)

**Out of scope**
- Real-time push notifications (Faz 2 — Slack webhook)
- Per-user attempt timeline (privacy + scope)
- Provider-level rollup (sadece action seviyesi)
- Geographic / device breakdown (Faz 2)

## User stories

- As an **Admin** (with `provider.quality.read`): haftalık quality review — dashboard'u aç, 30d metric: %18 failed. Flagged actions tablosu: 3 action %30 success rate gösteriyor. İlk action'a tıkla, son 20 attempt'in 14'ü FAILED, notes alanında "404 page not found" tekrar ediyor. URL'i yeni tab'da aç → gerçekten 404. "Mark inactive" + "Create governance issue: Comcast move URL changed".
- As a **support agent** (`provider.quality.read`): kullanıcı "Comcast butonuna bastım hiçbir şey olmadı" diyor; dashboard'da Comcast Change Address action'unu bul → son 7d 23 attempt, 21 OPENED hiç DONE değil → kullanıcılar tıklıyor ama "Done" işaretlemiyor → muhtemelen UX problemi, governance issue aç.
- As an **Admin**: bir partner'ı geri aç — flag clear olduğunda tablo otomatik refresh, "Likely broken" rozeti gider.

## Veri modeli

Bu doc **yeni tablo eklemez**. `PartnerSyncAttempt` (doc 35) ve `ProviderGovernanceIssue` (mevcut) okur.

`PartnerSyncAttempt` (doc 35 + D7 referansı):

```prisma
model PartnerSyncAttempt {
  id                  String   @id @default(cuid())
  eventId             String
  serviceId           String
  providerActionId    String
  status              SyncStatus  // PENDING OPENED DONE SKIPPED FAILED
  openCount           Int @default(0)
  lastOpenedAt        DateTime?
  lastConfirmationAt  DateTime?
  completedAt         DateTime?
  confirmationNumber  String?
  notes               String?     @db.Text
  resultMetadataJson  Json?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  @@unique([eventId, serviceId, providerActionId])
  @@index([providerActionId, status, updatedAt])
  @@index([updatedAt])  // for 30d window queries
}
```

İki yeni index eklenir (yukarıdaki) — bu doc bu indexler'i mandate eder; doc 35 migration'ı bunları içermeli.

`ProviderGovernanceIssue` (mevcut tablo — provider CRUD'da kullanılan): bu doc içinden create edilir.

New `AdminPermission`: `provider.quality.read`.

## API endpoint'leri

### Yeni

| Method | Path | Auth | Permission | Body | Response | Errors |
|---|---|---|---|---|---|---|
| GET | `/api/admin/sync-attempts/summary` | Admin | `provider.quality.read` | query: `windowDays` (default 30, max 90) | `{ total, done, failed, openedNotMarked, byStatus, periodStart, periodEnd }` | 403 |
| GET | `/api/admin/sync-attempts/by-action` | Admin | `provider.quality.read` | query: `windowDays`, `flaggedOnly`, `sort`, `page`, `pageSize` | `{ items: ActionStats[], total, page }` | 403 |
| GET | `/api/admin/sync-attempts/by-action/[providerActionId]` | Admin | `provider.quality.read` | — | `{ action, stats, recentAttempts: AnonymizedAttempt[] }` | 403, 404 |
| POST | `/api/admin/sync-attempts/[providerActionId]/governance-issue` | Admin | `provider.quality.read` | `{ title, description, severity }` | `{ issue }` | 400, 403, 404 |

`ActionStats` shape:

```ts
{
  providerActionId: string;
  providerName: string;
  providerId: string;
  actionLabel: string;     // e.g. "Comcast — Change service address"
  channel: ActionChannel;
  totalAttempts: number;
  doneCount: number;
  failedCount: number;
  openedNotMarkedCount: number;
  successRate: number;     // 0..1
  lastAttemptAt: Date;
  topFailureReason: string | null;  // most frequent token from notes
  flagged: boolean;        // successRate < 0.5 && totalAttempts >= 20
  flagReason: string | null;
}
```

`AnonymizedAttempt` shape (recent 20):

```ts
{
  id: string;
  status: SyncStatus;
  openCount: number;
  workspaceIdHash: string;  // sha256(workspaceId).slice(0,8) — pattern detection için
  createdAt: Date;
  lastOpenedAt: Date | null;
  completedAt: Date | null;
  notesPreview: string;     // first 200 chars, PII stripped (regex masked email + phone)
}
```

`topFailureReason` hesabı: `notes` field'inden top-3 token (basit word tokenizer, stop-word filtreli) → en yüksek frekans.

### Mevcut endpoint'lere etki

- `/api/admin/providers/[providerId]/actions/[id]` (doc 51) — dashboard "Mark inactive" linkinden PATCH `{ isActive: false }` çağırır. Bu doc o endpoint'i ekstra modifiye etmez.
- ProviderGovernanceIssue mevcut create endpoint'i yoksa bu doc kendisi yeni endpoint açar (yukarıdaki tabloda).

## Web (admin app)

### Yeni sayfa/route

- `apps/admin/src/app/(admin)/sync-attempts/page.tsx` — server component, fetches summary + first page of byAction
- `apps/admin/src/app/(admin)/sync-attempts/[providerActionId]/page.tsx` — drill-down
- `apps/admin/src/app/api/admin/sync-attempts/summary/route.ts`
- `apps/admin/src/app/api/admin/sync-attempts/by-action/route.ts`
- `apps/admin/src/app/api/admin/sync-attempts/by-action/[providerActionId]/route.ts`
- `apps/admin/src/app/api/admin/sync-attempts/[providerActionId]/governance-issue/route.ts`

### Mevcut sayfalara etki

- `apps/admin/src/app/(admin)/layout.tsx` — sol nav'a "Sync Quality" entry (between "Providers" ve "Workspaces").
- `apps/admin/src/app/(admin)/providers/[providerId]/actions/page.tsx` (doc 51) — her action row'da küçük "stats" badge linki bu dashboard'a query param ile.
- `apps/admin/src/lib/admin-auth.ts` — `provider.quality.read` permission.

### Componentler

```
apps/admin/src/app/(admin)/sync-attempts/_components/
  WindowSelector.tsx           // 7d / 30d / 90d radio
  SummaryCards.tsx             // 4 büyük metric card
  StatusDonutChart.tsx         // recharts: PENDING/OPENED/DONE/SKIPPED/FAILED
  ActionStatsTable.tsx         // sortable; "flagged" rows red highlight
  FlagBadge.tsx                // tooltip: "20+ attempts, <50% success"
  FailureReasonChip.tsx        // topFailureReason; click → filter dashboard
  ActionDetailHeader.tsx       // provider + action + channel + actionTier badge
  RecentAttemptsTable.tsx      // 20 row; status pill, workspaceIdHash, notesPreview
  TestUrlButton.tsx            // opens action.urlTemplate (rendered with fake data) in new tab; confirm dialog
  MarkInactiveButton.tsx       // confirm → PATCH doc 51 endpoint; toast
  GovernanceIssueDialog.tsx    // title + description + severity → POST
  RefreshIndicator.tsx         // last data refresh time
```

### Butonlar / actionlar

- **Window radio**: 7 / 30 / 90 gün → page reload with `?windowDays=`
- **"Flagged only"** toggle → filter
- **Sort by** column header (success rate / total attempts / last attempt)
- **Click row** → drill-down page
- **"Open URL to test"** (drill-down) → confirm modal → opens external in new tab; logs to AuditLog (`action: "test_url_opened"`)
- **"Mark action inactive"** → confirm + reason textarea → calls doc 51 PATCH; on success row badge updates
- **"Create governance issue"** → dialog → POST; on success success toast + link to issue detail

## Mobile

N/A — admin web only.

## Admin permissions

| Code | What it gates | Step-up |
|---|---|---|
| `provider.quality.read` | View dashboard + drill-down + create governance issue | No |
| `provider.actions.write` (cross-ref 51) | Mark inactive button | No |

Step-up gerekmiyor: read-only + governance issue create düşük blast radius. "Mark inactive" zaten cross-ref 51'in permission'ı altında.

## Güvenlik

- [ ] **Step-up admin auth** — gerekmez.
- [x] **PII redaction** —
  - `recentAttempts.workspaceIdHash`: `sha256(workspaceId).slice(0,8)` — admin pattern görür (aynı workspace tekrar?) ama workspace ID erişemez
  - `notesPreview`: server-side `redactPii(text)` helper'ı (`/[\w.+-]+@[\w-]+\.[\w.-]+/g → "[email]"`, `/\+?\d{1,3}[\s\-]?\(?\d+\)?[\s\-]?\d+/g → "[phone]"`)
  - Eğer admin işin uçuna gerçek workspace görmek isterse: workspace inspector'a (doc 50) `workspace.read` permission ile ayrı gider; bu dashboard kasıtlı anonim
- [x] **Audit log** — write action'lar yazılır:
  - `test_url_opened` (target: ServiceProviderAction)
  - `mark_inactive` (delegated to doc 51 audit)
  - `governance_issue_created` (target: ProviderGovernanceIssue)
- [x] **Rate limit** — summary endpoint admin başına 120/dakika (sık refresh için yeterli).
- [x] **Permission matris** — `provider.quality.read` olmayan admin sayfa 403.
- [ ] **Two-step confirmation** — sadece "Open URL to test" tek confirm (external nav uyarısı).
- [x] **Query performance** — `PartnerSyncAttempt` üzerine `(providerActionId, status, updatedAt)` index zorunlu; 30d window full table scan riskini bertaraf eder.

## Migration / backward compat

- `PartnerSyncAttempt` indeksleri (yukarıdaki iki yeni) — doc 35 ilk migration'ında veya bu doc'la birlikte ayrı migration. Bu doc her halükarda indexlerin var olduğunu **mandate** eder.
- `AdminPermission` seed: `provider.quality.read` row'u; default admin rolüne grant (gözle görünür dashboard, düşük risk).
- Backward compat: doc 35 yoksa dashboard `{ total: 0, byAction: [] }` boş state gösterir; sayfa hatasız çalışır.

## Etkilenen mevcut özellikler

- Doc 51 (Provider Actions CRUD) — list page'inde her action satırına "X attempts, Y% success (30d)" badge eklenir; tıklayınca bu dashboard'a query param ile gelir.
- Doc 34 — `ServiceProviderAction.isActive=false` olan action'lar dashboard'ta default gizli (toggle ile gösterilir).
- Doc 33 (Partner Hub) — kullanıcı tarafı: `isActive=false` action'lar listelenmez; bu dashboard'tan inactive yapılınca partner hub anında etkilenir.

## Test plan

- **Unit**
  - `redactPii("call me at 555-123-4567 or john@x.com")` returns `"call me at [phone] or [email]"`
  - `topFailureReason(["404 not found", "page 404", "ssl error"])` returns `"404"` (frequency-based)
  - `flagged` calculation: 20 attempts %49 → true; 19 attempts %30 → false; 100 attempts %51 → false
- **Integration**
  - GET summary windowDays=30 returns counts equal to direct SQL aggregate
  - GET by-action with flaggedOnly=true returns only `successRate < 0.5 && totalAttempts >= 20`
  - POST governance-issue creates ProviderGovernanceIssue row + AuditLog
- **E2E**
  - Seed: 100 PartnerSyncAttempt for action A (40 DONE, 50 FAILED, 10 PENDING) → dashboard shows flagged, drill-down shows recentAttempts list
  - Admin clicks "Mark inactive" → action.isActive becomes false → Partner Hub user-side hides action
- **Performance**
  - 100k PartnerSyncAttempt rows: summary endpoint <300ms, by-action <500ms (with indexes)
  - 90d window worst case <2s

## Açık sorular

1. "Flag" eşikleri (20+ attempts, <50%) parametrik mi DB'de mi tutulsun? MVP: hard-coded `packages/shared/src/sync-quality-thresholds.ts`; admin değiştirmek isterse PR.
2. `topFailureReason` parsing çok basit — stop-word listesi yok. İlk staging seed'ten sonra `notes` patternlerine bakıp gerekirse curated keyword list'e geçilir.
3. Workspace inspector (doc 50) drill-down link buradan açılmalı mı? `workspaceIdHash` zaten anonim; admin gerçekten kullanıcıyı bulmak isterse `workspace.search.by_email` permission'lı ayrı arama. MVP'de **dashboard'tan workspace'e link yok** — by design.
4. Real-time uyarı: %20+ FAILED action'lar Slack'e push edilsin mi? Faz 2 (webhook receiver). MVP haftalık manuel review.
5. `lastOpenedAt - createdAt` gap analizi: kullanıcı tıklayıp gelmedi mi (browser kapatıldı?) yoksa partner sitesi yüklenmedi mi? Bu MVP'de heuristic yok, governance issue'da manuel not.
