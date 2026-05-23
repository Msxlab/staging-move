# Family Budget Consolidated View

- **Status**: Proposed (Family/Pro launch, Sprint 3)
- **Tier**: Family + Pro (Pro'da "Workspace budget" adıyla)
- **Related decisions**: D1 (workspace tek root → budget aggregation natural), D2 (entitlement owner'dan, CHILD gate), D3 (field-level visibility), D5 (CHILD finansal yok)
- **Related docs**: 01-architecture-decisions.md, 02-workspace-model.md, 03-workspace-member-roles.md, 06-entitlements-system.md, 20-family-plan-definition.md, 22-child-role.md, 23-shared-services.md, 25-family-reminders-consolidated.md, 30-pro-plan-definition.md, 63-entitlement-banners-empty-states.md

## Amaç

Mevcut per-user / per-address `Budget` modelini bozmadan, Family (ve Pro) workspace için **konsolide bütçe görünümü** sunmak: ay/yıl bazında workspace içindeki tüm Service'leri `paidByUserId` üzerinden gruplayan, kategori ve adres breakdown'u, geçmiş aya kıyaslama, member filtresi ve charts içeren bir view. CHILD finansal veriyi görmez. Aggregation API'sı performant (250 servis için <300ms p95).

## Kapsam

In scope:
- Yeni `GET /api/budget/family` aggregation endpoint
- Web `/budget?view=family` route
- Mobile `app/budget/family.tsx` route
- Member-bazlı, kategori-bazlı, adres-bazlı breakdown
- Geçen ayla karşılaştırma (delta + %)
- Charts (web: Recharts; mobile: react-native-svg-charts veya Victory Native)
- Filter UI (member chips, category dropdown, address dropdown, ay seçici)
- CHILD görünürlüğü: kendi servis costlarına sınırlı veya endpoint 403 + UI gizle
- Performance: workspace-level aggregation cache + indexed query

Out of scope:
- Tek Budget row CRUD (mevcut `Budget` endpoint'i değişmez) → mevcut sayfa korunur
- Budget alert kuralları (alert engine ayrı doc, cross-ref 25 reminders)
- Faz 3 forecasting / trend ML
- Faz 2 export PDF (basic CSV MVP'de)
- Bill split actual money transfer (23'ün dışı)
- Workspace-bazlı manuel budget hedefi tanımlama (sadece servis cost aggregation MVP'de)

## User stories

- **Family OWNER**: Aile için /budget açtığımda default "Family view" sekmesi: bu ay total $1,247, geçen aya göre +$32; per-member donut chart (Mehmet $620, Ayşe $480, Mert $0, Mira $147).
- **MEMBER**: Family view'i görürüm; kendi ödediğim ($480) + diğerlerinin agregat toplamı; account number ya da kart bilgisi yok, sadece total.
- **CHILD**: Family view sekmesi UI'da **görünmez**; doğrudan URL 403.
- **OWNER**: Filtre olarak "Member: Mehmet" seçerim → onun servis listesi + aylık toplam + kategori breakdown.
- **OWNER**: Adres filtresi (yazlık) → o adrese bağlı servislerin toplam aylık maliyeti.
- **OWNER**: Çubuk chart'ta son 6 ay karşılaştırması; aylık dalgalanma görsel.
- **Pro Workspace OWNER** (cross-ref 30): Aynı view "Workspace budget" başlığıyla; ek olarak `Address.label` (Pro-only D18) bazlı breakdown.

## Veri modeli

`Budget` modeli **değişmez**. Aggregation runtime'da `Service.monthlyCost` + `paidByUserId` üzerinden hesaplanır.

```prisma
// Service modeli (23'te genişletildi, referans):
model Service {
  ...
  monthlyCost      Float?
  billingDay       Int?
  billingCycle     String?  // monthly | yearly | quarterly | ...
  paidByUserId     String?  // 23
  workspaceId      String   // 23
  ...
}
```

Aggregation tarafından kullanılan **mevcut alanlar**:
- `Service.monthlyCost` → normalize edilir (yıllıksa /12, kuartalsa /3).
- `Service.billingCycle` → normalization hint.
- `Service.paidByUserId` → group key.
- `Service.category` → secondary group.
- `Service.addressId` → tertiary group.
- `Service.isActive=true` ve `deletedAt IS NULL` filter.

**Geçen ay karşılaştırması**: MVP'de aktif servislerin monthlyCost'ı sabit varsayılır (geçen ay snapshot tablosu yok). Faz 2'de `BudgetSnapshot` tablosu eklenir (monthly cron):

```prisma
// FAZ 2 — bu MVP'de YOK, planlama notu:
// model BudgetSnapshot {
//   id String @id
//   workspaceId String
//   month DateTime
//   totalMonthlyCost Float
//   breakdownJson String @db.Text  // {byMember: {...}, byCategory: {...}}
//   createdAt DateTime @default(now())
//   @@unique([workspaceId, month])
// }
```

MVP'de "geçen ay" hesabı için `Service.deactivatedAt`, `Service.createdAt`, `Service.monthlyCost` değişim history'si **mevcut değil** — dolayısıyla MVP'de "geçen ay vs bu ay" yerine **"şu anki aktif servis toplamı"** + "geçen 30 gün eklenen/silinen" mini-stat gösteririz. Snapshot tablosu Faz 2'de eklenince delta gerçekçi olur.

## API endpoint'leri

### Yeni

| Method | Path | Auth | Workspace ctx | Body / Query | Response | Errors |
|---|---|---|---|---|---|---|
| GET | `/api/budget/family` | required | required (D13) | query: `month=YYYY-MM` (default current), `memberId?`, `category?`, `addressId?` | `FamilyBudgetSummary` (aşağıda) | 403 CHILD, 403 owner sub expired (D2 grace dışı), 400 invalid month |
| GET | `/api/budget/family/export.csv` | required | required | query: aynı + `format=csv\|pdf` | CSV/PDF stream | 403, 400 |

```ts
// apps/web/src/lib/types/family-budget.ts
export interface FamilyBudgetSummary {
  workspaceId: string;
  month: string;  // "2026-05"
  totalMonthlyNormalized: number;  // USD
  byMember: Array<{
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    monthlyTotal: number;
    serviceCount: number;
  }>;
  byCategory: Array<{
    category: string;
    monthlyTotal: number;
    serviceCount: number;
  }>;
  byAddress: Array<{
    addressId: string;
    nickname: string | null;
    monthlyTotal: number;
    serviceCount: number;
  }>;
  trailing6Months: Array<{ month: string; total: number }>; // Faz 2 snapshot tablosu olmadan MVP'de aynı total tekrarlar; UI "data starting <signup>" disclaimer
  changesLast30Days: {
    addedServices: number;
    removedServices: number;
    addedMonthlyDelta: number;
    removedMonthlyDelta: number;
  };
  generatedAt: string;
}
```

### Mevcut endpoint'lere etki

- `GET /api/budget` (`apps/web/src/app/api/budget/route.ts`) — Family workspace context'inde **etkilenmez**, kişisel budget kaydı CRUD'u korunur. Sadece response header `X-Workspace-Has-Family-View: true` eklenir; UI bu hint'le "Switch to family view" sekmesi gösterir.
- `GET /api/services` — değişmez; family budget endpoint kendi aggregation query'sini koşar.
- `requireWorkspaceContext` (07) — CHILD ise `/api/budget/family` 403.

### Performance

- Query strategy: tek `SELECT` workspace içindeki aktif servisler için (`WHERE workspaceId = ? AND isActive = true AND deletedAt IS NULL`).
- Index: `Service @@index([workspaceId, isActive])` zaten 23'te eklendi.
- Aggregation kodda (Node): 250 servis için <50ms; DB tarafına itmek (`GROUP BY paidByUserId`) opsiyonel optimizasyon (Pro 1000 servis için zorunlu olur — 30'da değerlendirilir).
- Cache: `s-maxage=30, stale-while-revalidate=60` — bütçe ekranı periyodik refresh.

## Web

### Yeni sayfa/route
- `/budget` mevcut → tab/sub-route ile:
  - `/budget` (personal): mevcut görünüm (per-address Budget rows).
  - `/budget?view=family`: konsolide görünüm (Family/Pro üyeleri için default).

URL parametresi tercih edildi (basitlik + bookmarkable); ayrı sayfa route'u (`/budget/family`) ileride istenirse trivial refactor.

### Mevcut sayfalara etki
- `apps/web/src/app/(app)/budget/page.tsx`:
  - Plan FAMILY/PRO ve role !== CHILD ise üstte tab UI: "Personal" | "Family".
  - Default tab: FAMILY (üye sayısı > 1 ise), PERSONAL aksi takdirde.
  - Family tab içinde `FamilyBudgetView` component render.
- `apps/web/src/app/(app)/budget/[month]/page.tsx`: aynı tab pattern, parametre.

### Componentler (file paths)
- `apps/web/src/components/budget/FamilyBudgetView.tsx` — root.
- `apps/web/src/components/budget/FamilyBudgetTotalsCard.tsx` — total + delta.
- `apps/web/src/components/budget/MemberBreakdownChart.tsx` — donut (Recharts).
- `apps/web/src/components/budget/CategoryBreakdownChart.tsx` — horizontal bar.
- `apps/web/src/components/budget/AddressBreakdownTable.tsx`.
- `apps/web/src/components/budget/MonthSelector.tsx`.
- `apps/web/src/components/budget/MemberFilterChips.tsx` — workspace member multi-select.
- `apps/web/src/components/budget/Trailing6MonthsChart.tsx` — Recharts line chart.
- `apps/web/src/components/budget/ExportMenu.tsx` — CSV/PDF download.

### Butonlar / actionlar
- Tab switch Personal ↔ Family.
- Month seçici (prev/next + picker).
- Member filter chips.
- "Export CSV" / "Export PDF" (Family + Pro).
- Member chip click → drill down (URL: `?view=family&memberId=...`).
- "Edit service" link drill-down → `/services/[id]` (consolidated view edit kapalı, individual service'te edit).

## Mobile

### Yeni ekran
- `apps/mobile/app/budget/family.tsx` — Family/Pro role-gated route.

Tab navigation in `apps/mobile/app/budget/_layout.tsx` (yoksa eklenir):
- Stack with "Personal" (mevcut) ve "Family" sekmesi.

### Mevcut ekranlara etki
- `apps/mobile/app/budget/index.tsx` — başlığa "View: Personal ▼" dropdown veya tab bar; FAMILY view seçimi `family.tsx`'e nav.
- CHILD için: Family tab UI'da hidden (RoleGate from 22).

### Componentler
- `apps/mobile/src/components/budget/FamilyBudgetView.tsx`
- `apps/mobile/src/components/budget/MemberBreakdownChart.tsx` (react-native-svg-charts ya da Victory Native — tercih TBD)
- `apps/mobile/src/components/budget/CategoryBreakdownChart.tsx`
- `apps/mobile/src/components/budget/MonthSelector.tsx` (native picker)
- `apps/mobile/src/components/budget/ExportSheet.tsx` — CSV/PDF share via expo-sharing

**Chart library karar notu**: Mevcut mobile codebase'inde chart yoksa Victory Native (better TS, daha modern) tercih edilir; performance kritik değil (10–20 data point).

## Admin

### Yeni sayfa / Yetenekler
- `/admin/workspaces/[id]/budget` — admin debug görünümü:
  - Aynı aggregation çıktısı + ek olarak servisler full detayıyla.
  - Tarihsel snapshot (Faz 2 BudgetSnapshot eklenince).
  - Export butonu admin için PII-aware (audit log entry).

## Güvenlik

- [x] **Step-up auth**: Family budget view okuma için **gerekmez**. Export (CSV/PDF) için gerekmez (read-only data) — ancak download audit log'lanır. Faz 2 ileride export sırasında step-up isteyebilir (kart bilgileri eklenirse).
- [x] **PII redaction**: Aggregate çıktıda `accountNumber/username` **hiç yok**; sadece displayName + avatar + numeric total. Service detay drill-down'da field-level gate (D3) uygulanır.
- [x] **Audit log**: Yeni event tipleri:
  - `FAMILY_BUDGET_VIEWED { workspaceId, month, callerUserId }` (rate-throttled, dakikada bir kayıt)
  - `FAMILY_BUDGET_EXPORTED { format, workspaceId, callerUserId }`
- [x] **Rate limit**: `/api/budget/family` user başına 60 req/dakika (UI auto-refresh dahil).
- [x] **Permission matris**:
  - OWNER, ADMIN, MEMBER: full read.
  - CHILD: 403 endpoint; UI tab gizli.
  - Grace period (D2): owner subscription expired ise tüm üyeler için 403 + "Owner subscription expired" banner (63).
- [x] **Encryption at rest**: Aggregation çıktısı türetilmiş veri, encryption gereksiz. Underlying Service.accountNumber zaten encrypted ama aggregation'a girmez.
- [x] **GDPR DSAR**: Aggregate view personal data değil (workspace düzeyinde anonim metrik). Yine de kullanıcı kendi `paidByUserId=self` servisi için tek tek export edebilir (mevcut DSAR yolu).

## Migration / backward compat

- DB schema değişikliği YOK (23'teki migration kullanılır).
- API endpoint yeni; eski client'lar etkilenmez.
- Eski mobile sürüm Family tab'i göstermez (RoleGate + feature flag), `app/budget/family.tsx` route'u ileri sürüm.
- Plan downgrade Family → Individual: Family tab UI'da gizlenir; endpoint 403 (plan check).

## Etkilenen mevcut özellikler

- **`apps/web/src/app/(app)/budget/page.tsx`** — tab UI eklemesi.
- **`apps/web/src/app/api/budget/route.ts`** — response header hint; logic değişmez.
- **`apps/mobile/app/budget/index.tsx`** — view switcher.
- **`packages/shared/src/audit-event-types.ts`** — yeni event tipleri.
- **`apps/web/package.json`** — Recharts mevcut (kontrol et; yoksa ekle).
- **`apps/mobile/package.json`** — chart library decision (`victory-native` veya `react-native-svg-charts`); paket ekle.
- **i18n (67)** — Family budget string'leri.

## Performance notları

- Workspace başına 250 servis maksimum (Family). Pro 1000 → DB tarafında `GROUP BY` zorunlu, kodda aggregation 1000 row için ~150ms acceptable ama 30'da revisit.
- Cache invalidation: service create/update/delete trigger → cache bust workspace key.
- 6 ay trailing chart: MVP'de mevcut + aynı değer 6 kez (snapshot olmayınca). Disclaimer UI'da: "Trends will populate over time."

## Test plan

### Unit
- Aggregator function: 5 servis (3 paidByUserId, 2 kategorisi) → doğru toplamlar.
- `monthlyCost` normalization: yearly $1200 → $100/mo, quarterly $300 → $100/mo.
- CHILD plan check returns 403.
- Inactive service (`isActive=false`) excluded.
- Soft-deleted service excluded.

### Integration
- `GET /api/budget/family?month=2026-05` happy path döner full payload.
- Filter `memberId=...` → narrow result.
- Filter `category=internet` → narrow.
- 403 for CHILD.
- 403 for FREE_TRIAL workspace (plan gate).
- Performance: 250 servis seed + endpoint → p95 < 300ms (CI assertion or benchmark).

### E2E (Playwright)
- OWNER login → /budget → Family tab default → totals + chart visible.
- Member filter click → drill down updates URL + data.
- Export CSV → downloaded file contains expected columns.
- CHILD login → /budget → no Family tab; direct URL → redirect.

### Manual QA
- Mobile: chart rendering, scroll perf, month picker.
- Edge: workspace 1 member only → Family tab hides or "no other members" empty state.
- Workspace with 0 services → empty state with "Add your first service" CTA.
- Workspace at 250 services → render perf.

## Açık sorular

- [ ] BudgetSnapshot tablosu MVP'ye eklensin mi (cron monthly write, ~10 satır/workspace/yıl)? — Faz 2 önerisi, ancak 6-month chart için gerekli; ürün tarafı karar verecek.
- [ ] CHILD'a "Kendi servislerinin maliyet toplamı" şeklinde sınırlı bir kişisel view yazılmalı mı? — Kapsam dışı; CHILD'ın "My services" listesinde her satırda `monthlyCost` zaten var, toplam minicard yeterli (22 referansı).
- [ ] Export PDF için backend renderer (Puppeteer/Headless Chrome) mı, client-side mi? — Server-side tercih (data consistency); ayrı doc gerekebilir (cross-ref 40 tax export).
- [ ] Family ve Pro'da view ismi farklı mı? — Family: "Family budget", Pro: "Workspace budget". Aynı component, sadece i18n key.
- [ ] Currency: multi-currency desteği MVP'de yok (USD); Faz 2 multi-currency notu.
- [ ] `Subscription.monthlyCost` (Faz 2) — yıllık abonelikleri 1/12 olarak göstermek yerine "next charge" alanını da göster?
- [ ] Cache invalidation event-driven mı, time-based mi? — Time-based 30s yeterli MVP; Faz 2 service write trigger.
- [ ] Pro'da Address.label (Home/Office/Rental/...) bazlı extra breakdown ayrı bir doc'ta mı (30/32 cross-ref) yoksa bu component aynı view'ı extends? — Aynı view, plan-level prop ile label dimension açılır.
