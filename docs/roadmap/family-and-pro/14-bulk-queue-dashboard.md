# Bulk Queue Dashboard

> **Drift fix 2026-05-23** — Çelişkili değerler [`01a-canonical-values.md`](./01a-canonical-values.md) (§C9) ile uyumludur — bu doc `confirmationNumber` encryption davranışını zaten içeriyor (§C9 / D27 ile aynı yön): `PartnerSyncAttempt.confirmationNumber` ve `notes` encrypted-at-rest (`packages/shared/src/encryption.ts`).

- **Status**: Proposed (Family/Pro launch, Sprint 3)
- **Tier**: Family + Pro
- **Related decisions**: D7, D27 (confirmation/notes encrypt)
- **Related docs**: [11](./11-address-change-event-model.md), [12](./12-address-change-target-model.md), [13](./13-address-change-wizard-web.md), [35](./35-partner-sync-attempts.md), [36](./36-partner-deep-link-launcher.md)

## Amaç

Wizard sonrası kullanıcının "Şimdi ne kaldı? Hangi partner'ı açıp güncelleyeceğim?" sorusunu cevaplayan ana operasyon sayfası. Bir `AddressChangeEvent`'in tüm `AddressChangeTarget`'lerini, her target'ın altındaki `PartnerSyncAttempt`'lerini ve her attempt için "Open & Update →" butonunu (→ 36) listeler. Progress bar ve filtre ile büyük portföyleri yönetilebilir kılar.

Sayfa real-time-ish: her revisit'te fresh fetch, kullanıcı partner sekmesi açıp dönünce attempt status update'i görünür (polling değil — `visibilitychange` event'inde refetch).

## Kapsam

**In scope**
- `/address-change/[id]` web sayfası
- Mobile detail screen (simplified list)
- Progress header, target accordions, attempt rows
- Filtre (status), notes editing, archive/cancel actions
- Empty state, completed state celebration
- Revisit refresh stratejisi

**Out of scope**
- Event/target/attempt modelleri (→ 11, 12, 35)
- Deep-link launcher mekaniği (→ 36)
- Wizard (→ 13)

## User stories

- **As an Owner**: Wizard'dan sonra dashboard yüklenir, 12 target, 47 attempt görürüm, ilk PENDING attempt'a "Open & Update" basarım.
- **As an Owner**: Partner sekmesinde adresimi güncelledim, dashboard'a dönerim, attempt "Done" işaretlerim ve progress bar ilerler.
- **As a Pro user**: 5 ADDRESS target'ım var, sadece 1 target'la ilgileniyorum, accordion'da diğerlerini kapatırım.
- **As an Owner**: Bir attempt çalışmıyor (broken URL), "Skip" basıp not eklerim.
- **As an Owner**: Tüm targets DONE — celebration animasyonu görüp event'i archive ederim.

## Veri modeli

Yeni schema yok — 11, 12, 35'teki modeller okunur. Sayfa için derived view:

```ts
type EventDashboardData = {
  event: AddressChangeEvent;
  targets: Array<AddressChangeTarget & {
    attempts: PartnerSyncAttempt[];
    progress: { total: number; done: number; skipped: number; pending: number };
  }>;
  overallProgress: { totalTargets: number; doneTargets: number; totalAttempts: number; doneAttempts: number };
  canEdit: boolean;
  canArchive: boolean;
};
```

## API endpoint'leri

### Yeni

| Method | Path | Auth | Workspace ctx | Body | Response | Errors |
|---|---|---|---|---|---|---|
| GET | `/api/address-changes/:id/dashboard` | Session | required | — | `200 EventDashboardData` | 401, 404 |
| PATCH | `/api/address-changes/:id/notes` | Session | required | `{ notes: string }` | `200 { notes }` | 401, 404, 403 (canEdit false) |

Dashboard endpoint event + targets + attempts'i tek query ile döner (Prisma `include`). Ağırlığı kontrol için target başına attempt limit yok (target başına genelde 1-5 attempt, max 500 attempt total → sayfa içi virtualization değil flat list yeterli).

### Mevcut endpoint'lere etki

- PATCH `/api/address-changes/:id` (→ 11) — "Archive" ve "Cancel" butonları bu endpoint'i çağırır (status ARCHIVED/ABANDONED).
- PATCH `/api/address-changes/:id/targets/:targetId` (→ 12) — accordion "Skip target" buton.
- PATCH `/api/partner-sync-attempts/:id` (→ 35, 36) — attempt rows'daki "Done"/"Skip" buton.

## Web

### Yeni sayfa/route

- `/address-change/[id]` — main dashboard
- `/address-change` — list of all events (status filter, default ACTIVE)

### Mevcut sayfalara etki

- `/dashboard` — "Active Move" widget tıklayınca buraya yönlendirir.
- Sidebar "Moves" item badge sayısı = ACTIVE event count.
- Address detail — eğer adres bir ACTIVE event'in from/to'su ise "View move →" inline link.

### Componentler

Tümü `apps/web/src/components/address-change/`:

- **`<EventProgressHeader>`**
  - Top of page: event label, from→to badge, status pill, scope summary ("Family, 3 members").
  - Progress bar: "8 of 12 targets done · 31 of 47 actions done"
  - Right side: action buttons (archive, cancel, share). Edit notes inline.
- **`<TargetAccordion>`**
  - One per target.
  - Header: target name (user name or address label), status pill, mini-progress "5/8 done".
  - Click to expand → attempt rows.
  - Right side menu: "Skip this target" (gated by role).
  - Empty state per target: "No partner actions found for this service set."
- **`<AttemptRow>`**
  - Logo + providerName + actionName (e.g. "Comcast · Update billing address")
  - Last opened timestamp (relative: "2h ago"), openCount badge if >1
  - Status pill (PENDING / OPENED / DONE / SKIPPED / FAILED)
  - Right: "Open & Update →" button (PENDING/OPENED) or "Done"/"Skip" buttons (after opened) — bkz 36
  - Click anywhere → expand row → notes + confirmation number input + manual status override
- **`<FilterBar>`**
  - Status: All / Pending / In progress / Done / Skipped
  - Target type filter (only shown if >1 target)
- **`<CelebrationBanner>`** — when overallProgress.doneTargets == totalTargets: confetti + "All done! Archive this move?"
- **`<EventNotesPanel>`** — collapsed by default, "Add notes" expand; textarea with auto-save (debounced 1s).

### Butonlar / actionlar

| Buton | Yer | Action | Confirmation |
|---|---|---|---|
| Open & Update → | AttemptRow | bkz 36 (deep link + clipboard) | none |
| Done | AttemptRow (after OPENED) | PATCH attempt status=DONE + confirmationNumber input | none |
| Skip | AttemptRow | PATCH status=SKIPPED + reason input | inline confirm |
| Skip target | TargetAccordion menu | PATCH target status=SKIPPED | modal confirm |
| Archive | EventProgressHeader menu | PATCH event status=ARCHIVED | modal confirm |
| Cancel (Abandon) | EventProgressHeader menu | PATCH event status=ABANDONED | modal confirm — "Tüm pending attempts skipped olacak" warning |
| Edit notes | EventProgressHeader | open EventNotesPanel | autosave |
| Mark complete | EventProgressHeader (when not auto) | PATCH event status=COMPLETED | modal confirm |

### Refresh strategy

- Initial: SSR fetch (App Router server component).
- Client interactions: optimistic update + revalidate.
- Returning to tab: `visibilitychange` listener triggers `router.refresh()` (server component re-fetches).
- Manual: "Refresh" button in header (rare; explicit user control).
- No polling — battery/server cost not worth real-time UX.

### Empty states

- Event status COMPLETED with all targets DONE: celebration + archive prompt.
- Event status ARCHIVED: read-only banner "This move is archived" + no action buttons.
- 0 targets: shouldn't happen (wizard blocks), but if encountered: "No targets in this event — likely a data issue, contact support."

## Mobile

### Yeni ekran

- **`AddressChangeDetailScreen`** (`apps/mobile/src/screens/AddressChangeDetailScreen.tsx`)
  - Header: event label + from→to + status pill + progress bar
  - Target list: flat (collapsed) cards, tap to navigate to `AddressChangeTargetScreen`
  - Bottom action sheet: archive/cancel
- **`AddressChangeTargetScreen`** — detail of one target with attempts list
- **`AddressChangeListScreen`** — list of all events

Simplified vs web: no inline accordion; per-target full screen for focus on mobile.

### Mevcut ekranlara etki

- Dashboard widget: tap navigates to AddressChangeListScreen.
- Bottom tab nav: "Moves" tab (only if Family/Pro).

### Componentler

- **`<MobileTargetCard>`** — tap to drill in
- **`<MobileAttemptRow>`** — tap to open launcher modal (→ 36 mobile)

## Admin

### Yeni sayfa

- Inline at `/admin/address-changes/:id` (11'deki sayfa): dashboard read-only view + raw JSON dump + AdminAuditLog entries for this event.

### Yetenekler

- Force complete / force archive (admin actions).
- Read attempt details (FAILED ones critical for triage).
- Resend confirmation email (if applicable).

## Güvenlik

- [x] **Step-up auth**: Hayır (D19 — event-level zaten alındı). Archive/cancel modal confirm yeterli.
- [x] **PII redaction**: Notes alanı user PII içerebilir; log'lara yazılmaz, sadece length+hash. Server log middleware'inde notes field stripping.
- [x] **Audit log**: Status değişimi her attempt + target için `AuditLog`. Notes update audit'lenmez (gürültü) ama length değişikliği log'lanır.
- [x] **Rate limit**:
  - Attempt PATCH 60/min per user (kullanıcı bir oturum'da 47 attempt güncelleyebilir; tight değil)
  - Notes PATCH debounced server-side 1/sec
  - Dashboard GET 60/min per user
- [x] **Permission matris**:
  - OWNER/ADMIN: full read/edit/archive/cancel
  - MEMBER: read olduğu event'i, kendisinin USER target'ında edit, başkasınınkinde read-only
  - CHILD: kendi USER target'ında edit, finansal field (confirmationNumber) görmez (mask)
  - VIEW_ONLY: read-only her şey
- [x] **Encryption at rest**: confirmationNumber kullanıcı tarafından girilir, hassas (bazı providers için account ID benzeri). `packages/shared/src/encryption.ts` ile encrypt edilir, dashboard'da yetkili rol için decrypt + masked görünür (son 4 karakter).
- [x] **GDPR DSAR**: Erase'de notes, confirmationNumber, attempt metadata redact/delete. Event metadata kalır (workspace history) ama PII silinir.

## Migration / backward compat

- Bu doc UI-only; veri modeli değişikliği yok.
- Feature flag `FEATURE_ADDRESS_CHANGE_WIZARD` (13 ile aynı) bu sayfayı da kontrol eder.

## Etkilenen mevcut özellikler

- Sidebar nav (Moves item).
- Dashboard widget.
- Mobile bottom tab nav (yeni tab Family/Pro only).
- `apps/web/src/app/dashboard/page.tsx` — yeni widget mount.

## Test plan

**Unit**
- Progress hesaplama: 3 target, attempts mix → doğru "X of N" sayısı
- canEdit/canArchive role matrix
- Status filter: PENDING seçiliyken DONE accordions gizlenir

**Integration**
- GET /api/address-changes/:id/dashboard döndüğü JSON tüm targets+attempts içerir
- PATCH archive when active → success, pending attempts → SKIPPED cascade
- PATCH notes 60+ char autosave (server tarafı received)

**E2E (Playwright)**
- Dashboard yüklenir → "Open & Update" → attempt OPENED → "Done" → progress bar ilerler
- Filter pending → sadece pending attempts görünür
- Cancel event → modal confirm → status ABANDONED → banner read-only
- All done → celebration banner görünür
- visibilitychange: tab switch + return → refetch tetiklenir (network log assertion)

**Manual**
- Mobile flow: list → detail → target → attempt → launcher → return → status updated
- Screen reader: progress bar değişikliği announce
- Confetti perf: 500ms içinde dismiss'able olmalı

## Açık sorular

1. Confetti animation default on/off? **Karar önerisi**: On, prefers-reduced-motion respect.
2. Notes max length? **Karar önerisi**: 2000 char.
3. Auto-complete event'i: tüm targets DONE/SKIPPED olduğunda otomatik status COMPLETED'a çekilsin mi yoksa user explicit "Mark complete" mi? **Karar önerisi**: Auto, ama UI banner ile "Marked complete automatically" notifier.
4. Mobile: target screen offline-capable mı? **Karar önerisi**: Read-only offline OK (cache), write online-only.
