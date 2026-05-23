# Move History Timeline

- **Status**: Proposed (Pro launch — Sprint 3; tier limits live Sprint 4)
- **Tier**: Both (Pro unlimited / Family last 5 / Individual last 1 / Free N/A)
- **Related decisions**: D2 (entitlement owner subscription'ından), D6 (AddressChangeTarget.targetType USER/ADDRESS/CUSTOM badge), D5 (CHILD role görünür filter), D4 (plan limit kod-bazlı `entitlements.moveHistoryLimit`)
- **Related docs**: [11](./11-address-change-event-model.md), [12](./12-address-change-target-model.md), [14](./14-bulk-queue-dashboard.md), [22](./22-child-role.md), [30](./30-pro-plan-definition.md), [40](./40-tax-property-export.md), [63](./63-entitlement-banners-empty-states.md)

---

## Amaç

Geçmiş **AddressChangeEvent**'leri reverse-chronological timeline'da göster: from→to adresleri, status, kaç servis güncellendi, hangi üyeleri kapsadı. Mevcut MovingPlan (taşınma planı) ile birleştirilmiş tek "move history" deneyimi. Pro'nun "unlimited geçmiş" satış argümanı; Family/Individual tier limit ile sınırlı.

## Kapsam

**In scope (MVP)**
- `/move-history` web sayfası: list view + filters
- Aggregate stats card: toplam move sayısı, ortalama günler-arası, en sık from-state
- Per-event detay: from→to, status badge, scope (USER/ADDRESS/CUSTOM, D6), targets count, "X of Y attempts done" stat, archived tarih
- MovingPlan entries de aynı timeline'a interleave edilir (legacy taşınma planları)
- Filters: yıl, üye, status, scope
- Tier limit gating: Free=none, Individual=last 1, Family=last 5, Pro=unlimited
- Pagination (cursor-based, Pro için)
- Mobile basit list view `apps/mobile/app/move-history/`
- CHILD rolü filtrelenmiş görüş: sadece kendi target olduğu event'ler
- `GET /api/move-history?limit=N&cursor=...&memberId=...&year=...&status=...`

**Out of scope**
- Event edit (event archive sonrası read-only zaten)
- Export — cross-ref [40](./40-tax-property-export.md) tax export ayrı kanal
- Map visualization (from→to harita çizgisi) — Faz 2
- Timeline'a aile fotoğrafları/notlar yükleme — Faz 2
- Undo/replay event — Faz 2

## User stories

- As Pro user, son 5 yılda kaç kez taşındığımı tek bakışta göreyim.
- As Pro user, geçen yıl ofis adresi değiştiğinde **hangi servisleri güncellediğimi** retrospektif olarak göreyim — Faz 2'de aynı liste için "remind me" alabileyim.
- As Family OWNER, eşim ve çocuklarımın **hangi taşınma event'inde dahil olduğunu** görmek isterim (üye filter).
- As Family CHILD, **sadece beni etkileyen taşınmaları** göreyim — annemin ofis adres değişikliği bana gözükmesin.
- As Individual user, son 1 move'umu görüp **"5 move'a kadar erişmek için Family'ye yükselt"** CTA'sı görmeliyim.
- As Free user, "Move history Pro/Family feature" mesajı + upgrade CTA.

## Veri modeli

**Yeni tablo yok.** Mevcut modeller:
- `AddressChangeEvent` (cross-ref [11](./11-address-change-event-model.md)): id, workspaceId, fromAddressId, toAddressId, status (DRAFT|ACTIVE|COMPLETED|ARCHIVED|CANCELLED), createdAt, completedAt, archivedAt
- `AddressChangeTarget` (cross-ref [12](./12-address-change-target-model.md)): eventId, targetType, targetUserId?, targetAddressId?, customProviderId?
- `PartnerSyncAttempt` (cross-ref [35](./35-partner-sync-attempts.md)): eventId, status; aggregate "X of Y done"
- `MovingPlan` (mevcut, schema satır 516): fromAddressId, toAddressId, scheduledDate, status

Performans için **opsiyonel** denormalize cache:

```prisma
model AddressChangeEvent {
  // ... mevcut alanlar ...

+ targetCountCache        Int? @db.Integer
+   // target sayısı, event archive olunca freeze
+ attemptCompleteCountCache Int? @db.Integer
+ attemptTotalCountCache  Int? @db.Integer
+   // attempt aggregate'leri, query cost düşürmek için
+   // event COMPLETED/ARCHIVED transition sırasında set edilir
+   // null = legacy / hesaplanmamış → fallback live query
}
```

**Karar**: MVP'de bu cache **opsiyonel iyileştirme**; ilk versiyon live aggregate. 50+ event yavaşlarsa migration eklenir.

## API endpoint'leri

### Yeni

| Method | Path | Auth | Workspace ctx | Body | Response | Errors |
|---|---|---|---|---|---|---|
| GET | `/api/move-history?limit=20&cursor=...&memberId=...&year=2025&status=COMPLETED&scope=USER` | session | `requireWorkspaceContext` | — | `{ items: HistoryItemDto[], nextCursor?: string, stats: { totalMoves, avgDaysBetweenMoves, topFromState } }` | 401, 403, 422 (invalid cursor) |
| GET | `/api/move-history/:eventId` | session | `requireWorkspaceContext` | — | `{ event, targets, attempts: AttemptSummary[] }` (read-only enriched detail) | 401, 403, 404 |

**Tier limit enforcement** (D4 kod-bazlı):
```ts
// packages/shared/src/entitlements.ts
function moveHistoryLimitForPlan(plan: BillingPlan): number | "UNLIMITED" {
  switch (plan) {
    case "FREE_TRIAL": return 0;       // explicit blank state
    case "INDIVIDUAL": return 1;
    case "FAMILY": return 5;
    case "PRO": return "UNLIMITED";
  }
}
```

Server endpoint:
1. `requireWorkspaceContext` → entitlements + caller role
2. `limit_effective = min(query.limit, entitlements.moveHistoryLimit)` (UNLIMITED bypass)
3. CHILD rolü ise extra filter: `WHERE event.targets.any(targetUserId = callerUserId)` (cross-ref [22](./22-child-role.md))
4. Query: AddressChangeEvent + MovingPlan union (server-side merge by createdAt desc)
5. Aggregate stats: `totalMoves = count`, `avgDaysBetweenMoves = avg(diff)`, `topFromState = mode(fromAddress.state)`
6. Response

**Pagination**: cursor = base64(`{ts:ISO, id}`); WHERE `(createdAt, id) < (cursorTs, cursorId)`.

**Rate limit**: 60/dk/user (read-heavy, çok agresif değil).

### Mevcut endpoint'lere etki

- **`/api/events`** (list endpoint) — bu yeni endpoint'le **örtüşmez**: `/api/events` aktif/draft event'ler için (cross-ref [14](./14-bulk-queue-dashboard.md)); `/api/move-history` archived+completed için. UI'da ayrı sayfa.
- **`/api/moving-plans`** (varsa, MovingPlan list) — değişmez; bu endpoint MovingPlan'ı **fuse** eder.

## Web

### Yeni sayfa/route

`apps/web/src/app/(workspace)/move-history/page.tsx`:
- Header: "Move History" + total count + Pro badge (Pro için "Unlimited")
- Stats card (3 sayı): toplam move, ortalama günler, en sık eyalet
- Filter chips: Year (last 3 + custom), Member (workspace üyeleri dropdown), Status, Scope
- Timeline component: vertical list, her event card:
  - Status badge (COMPLETED green, CANCELLED red, ARCHIVED gray)
  - from-address line → to-address line (`MapPin → ArrowRight → MapPin`)
  - Scope badge (USER avatar / ADDRESS icon / CUSTOM tag)
  - Member avatars (target users)
  - "X of Y services updated" stat
  - Archived tarih
  - Click → detail page
- Tier limit hit: list sonunda banner "Showing 5 of 12 moves. Upgrade to Pro for full history →"
- Free için empty state: "Move history is a Family/Pro feature"

`apps/web/src/app/(workspace)/move-history/[eventId]/page.tsx`:
- Read-only event detail
- Event metadata
- Target list (her target ve attempt summary)
- "Re-create event from this" buton (Faz 2; MVP'de yok veya disabled)

### Mevcut sayfalara etki

- **Workspace dashboard sidebar** — "Move History" entry
- **Dashboard home** — "Recent moves" card son 3'ü gösterir, "See all →" link

### Componentler (file paths)

- `apps/web/src/app/(workspace)/move-history/page.tsx`
- `apps/web/src/app/(workspace)/move-history/[eventId]/page.tsx`
- `apps/web/src/components/move-history/MoveTimeline.tsx` — main timeline
- `apps/web/src/components/move-history/MoveEventCard.tsx` — per-event card
- `apps/web/src/components/move-history/MoveStatsCard.tsx` — aggregate stats
- `apps/web/src/components/move-history/MoveHistoryFilters.tsx`
- `apps/web/src/components/move-history/MoveHistoryLockedState.tsx` (Free için)
- `apps/web/src/components/move-history/TierLimitBanner.tsx` (Family/Individual üst limit hit)
- `apps/web/src/lib/api/moveHistory.ts`

### Butonlar / actionlar

- **Filter** (year/member/status/scope) — client-side URL state
- **Load more** (Pro) — cursor pagination
- **View details** — `/move-history/[id]`
- **Upgrade** (Family/Individual upper-limit) — checkout link
- **Start new move** (boş state veya CTA) → wizard (cross-ref [13](./13-address-change-wizard-web.md))

## Mobile

### Yeni ekran

`apps/mobile/app/(workspace)/move-history/index.tsx` — list  
`apps/mobile/app/(workspace)/move-history/[eventId].tsx` — detail

Stats card mobile'da kısa; filter sadece year + member.

### Mevcut ekranlara etki

- Tab navigation veya drawer'a "Move History" entry
- Profile/account ekranında "Move history" link

### Componentler

- `apps/mobile/src/features/move-history/MoveTimeline.tsx`
- `apps/mobile/src/features/move-history/MoveEventRow.tsx`
- `apps/mobile/src/features/move-history/MoveStatsCard.tsx`
- `apps/mobile/src/lib/api/moveHistory.ts`

## Admin

### Yeni sayfa

Yok. Workspace Inspector (cross-ref [50](./50-admin-workspace-inspector.md)) içine **"History" tab**:
- Bu workspace'in tüm move history'si (admin için tier limit BYPASS — full erişim)
- Read-only timeline
- "Re-create for support" buton (Faz 2)

### Yetenekler

- Inspect full history (tier limit yok)
- AdminAuditLog: `action="VIEW_HISTORY"` istek yapıldıkça

## Güvenlik

- [x] **Step-up auth?** Hayır — read-only operasyon.
- [x] **PII redaction?** From/to address kullanıcının kendi adresleri; PII ama workspace içi paylaşım zaten var. CHILD filter sıkı uygulanır (kendi target olmadığı event görünmesin). Hassas address detayları (apt no) member'a göre redact yok — workspace üyeleri tam görür.
- [x] **Audit log?** Read operasyonu — kapsamlı AuditLog yazılmaz (noise). Sadece admin inspector view'ları AdminAuditLog.
- [x] **Rate limit?** 60/dk/user GET; pagination cursor abuse'a karşı limit=100 hard cap.
- [x] **Permission matris?** OWNER + ADMIN + MEMBER: workspace history görür (tier limit dahilinde). CHILD: filtreli, sadece kendi target. VIEW_ONLY: read-only erişim var.
- [x] **Encryption at rest?** Address verisi mevcut encryption (varsa accountNumber pattern uygulanmaz — address PII farklı kategori, DB-level yeterli). Değişiklik yok.
- [x] **GDPR DSAR?** `/api/profile/export` zaten address + service dump'ı içeriyor; event/target/attempt history dahil edilmeli (varsa eksikse bu spec implementation'da ek dump fonksiyonu önerir).

## Migration / backward compat

- Schema değişikliği **yok** (opsiyonel cache kolonları Faz 2).
- Mevcut MovingPlan + AddressChangeEvent verileri retroaktif görünür.
- Eski client'lar: `/move-history` UI yoksa kullanıcı navigate edemez; API endpoint backward-compat (yeni).
- CHILD filter rule'u backend'de zorlanır → eski client bypass etse de leak olmaz.

## Etkilenen mevcut özellikler

- **Dashboard home** — "Recent moves" card eklenir; mevcut layout slot bul.
- **`/api/profile/export`** — event/target history dump'ı eklenebilir (DSAR completeness için).
- **MovingPlan** — mevcut model değişmez; bu spec sadece **read-side fusion** yapar.
- **Bulk Queue Dashboard** (cross-ref [14](./14-bulk-queue-dashboard.md)) — aktif event'ler için; "View past moves →" cross-link.
- **Tax Export** (cross-ref [40](./40-tax-property-export.md)) — export sayfasında "Use history filter to scope" hint.

## Test plan

**Unit**
- `moveHistoryLimitForPlan` switch tüm enum case'ler
- Cursor encode/decode round-trip
- CHILD filter SQL: yalnız kendi target event döner
- Stats calc: 0 event durumu, 1 event (divide by zero guard)
- MovingPlan + Event merge sort by createdAt desc

**Integration**
- Free user → 403 veya empty list (UI tercihine göre)
- Individual user: 5 event olsa bile 1 görür + banner
- Family user: 6 event → 5 görür + "1 more — upgrade"
- Pro: 100 event → cursor pagination 5 page
- CHILD: 10 event toplam, 3'ü target → 3 döner
- Year filter: 2024-01-01 ile 2024-12-31 boundary
- Invalid cursor → 422

**E2E (Playwright)**
- Pro user 50 event seed → page load < 1s, scroll pagination çalışıyor
- Family user limit banner görünür, upgrade tıkla → checkout
- CHILD account: scope farkı doğru
- Detail page archived event → read-only

**Manual**
- 0 event empty state UX
- 1 event "Your first move" badge (tasarım dokunuşu)
- Mobile: pull-to-refresh çalışıyor
- TR/EN strings (cross-ref [67](./67-i18n-tr-en.md))
- 50 event sayfa performansı (FCP, LCP)

## Açık sorular

1. MovingPlan ile AddressChangeEvent çakışıyorsa (kullanıcı her ikisini de yarattı) timeline'da iki entry mi tek mi? **Öneri**: ayrı entry'ler, "Plan" badge'i ile ayırt edilir; ileride MovingPlan → AddressChangeEvent migration düşünülebilir.
2. CHILD'a "Mom moved house" göstermeli miyiz (anne taşındı, çocuk da o adresteydi)? **Öneri**: CHILD'ın `targetUserId === callerUserId` filter'ı dışında, `ADDRESS scope + CHILD'ın o adreste user'ı varsa` ekstra kuralı? **Karar**: MVP'de strict (yalnız doğrudan target); Faz 2'de "addresses I lived at" expansion.
3. Cache kolonları (`targetCountCache` vs) MVP'ye dahil mi? **Karar**: Hayır, opsiyonel; ilk performans ölçümünde gerekirse Faz 2.
4. "Re-create event from history" feature: kullanıcı eski event'i template olarak yeni event başlatır. **Karar**: Faz 2 (UX karmaşık, validation derin).
5. Map visualization: from→to harita çizgisi cool ama Maps API maliyet + privacy concern. **Karar**: Faz 2'de a/b test.
6. Stats hesaplama timezone: workspace TZ var mı, yoksa user TZ mi UTC mi? **Decision needed**: existing TZ pattern'i bul; muhtemelen workspace.timezone yok → UTC + UI'da localize.
