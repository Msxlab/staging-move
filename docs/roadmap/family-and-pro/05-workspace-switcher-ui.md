# Workspace Switcher UI

> **Drift fix 2026-05-23** — Çelişkili değerler [`01a-canonical-values.md`](./01a-canonical-values.md) (§C4) ile geçersizdir. Cookie adı `lf_workspace_id` (canonical), aşağıda eski metinlerde geçen `lf_active_workspace` yanlıştır; canonical kazanır.

- **Status**: Proposed (Family/Pro launch, Sprint 1 iskelet, Sprint 2 canlı)
- **Tier**: Infrastructure
- **Related decisions**: D1 (plan-bazlı display name), D2 (entitlement owner'dan, seat overflow), D11 (mobile read-only billing), D13 (route-level helper), D14 (plan-limits.ts adapter), D21 (limit canonical)
- **Related docs**: 02-workspace-model.md, 03-workspace-member-roles.md, 04-workspace-invitation.md, 06-entitlements-system.md, 07-api-workspace-context-helper.md, 08-x-workspace-id-header.md, 63-entitlement-banners-empty-states.md, 67-i18n-tr-en.md

## Amaç

Bir kullanıcı birden fazla workspace'e üye olabilir (örn. kendi Free Trial + ailesinin Family + işyerinin Pro). Switcher bu workspace'leri header chip / mobile settings satırı üzerinden hızlıca değiştirmeyi, mevcut seçimi tutmayı ve seçimi tüm API çağrılarında `X-Workspace-Id` header'ı olarak göndermeyi sağlar.

Bu doc switcher component'ini, persistence (cookie / AsyncStorage), ApiClient entegrasyonunu, görsel davranışı (state'ler: empty, loading, error) ve plan badge görünürlüğünü tarifler.

## Kapsam

In scope:
- `<WorkspaceSwitcher>` web header component'i
- `<WorkspaceMenu>` mobile settings satırı + bottom sheet
- Persistence: web cookie (`lf_workspace_id` — canonical §C4) + mobile AsyncStorage (`lf.workspace.id`)
- ApiClient integration: her request'e `X-Workspace-Id` header (08 ile tam protokol)
- Plan badge görünümü (D1 etiketleri)
- "Create new workspace" CTA (Family/Pro gated)
- Empty / loading / error state'leri
- Switch sonrası invalidation (TanStack Query cache flush)
- Admin: N/A (admin workspace inspect eder, switch etmez)

Out of scope:
- Workspace CRUD endpoint'leri → 02
- Member listesi → 03
- Davet kabul flow → 04
- `X-Workspace-Id` server-side resolution + güvenlik kontrolleri → 07, 08
- Entitlement banner içerikleri (overflow, grace mesajları) → 63
- Plan upsell page → 61

## User stories

- **Multi-workspace üye**: Üst header'da mevcut workspace adımı (badge ile) görüyorum, tıklayınca dropdown açılır ve diğer workspace'lerime tek tıkla geçiyorum.
- **Tek workspace üye**: Chip görünür ama dropdown sade — sadece adım + plan badge + "Create new workspace" (planım uygunsa).
- **Family OWNER**: Switcher'da workspace adının yanında `Household` badge'i görüyorum; üyesi olduğum eşimin Family workspace'inde de aynı `Household` badge'i.
- **Free Trial kullanıcı**: "Create new workspace" CTA disabled, tooltip "Upgrade to Family or Pro to create additional workspaces".
- **Mobile kullanıcı**: Settings ekranında "Workspace" satırına basıyorum, sheet açılıyor, listeden seçiyorum; uygulama context'i değişiyor.
- **Switch hata durumu**: Switch sırasında network düşerse "Couldn't switch workspace, try again" toast + önceki seçim korunur.

## Veri modeli

Bu feature **yeni Prisma modeli getirmez**. Mevcutları kullanır:
- `Workspace` (02)
- `WorkspaceMember` (03)
- `Subscription` (mevcut, owner'dan plan resolve — 06)

Server'ın switcher endpoint'i için döndüğü shape:

```ts
// GET /api/me/workspaces (zaten 02'de tanımlı)
type WorkspaceSwitcherItem = {
  id: string;
  name: string;
  role: WorkspaceRole;
  plan: BillingPlan;            // owner subscription'dan resolve
  planLabel: "My Move" | "Household" | "Workspace";  // D1
  memberCount: number;
  isOwner: boolean;
  isOverflow: boolean;          // D2: workspace overflow durumunda
  ownerName: string;            // "Owned by Ayşe Yılmaz" prefix için
  unreadCount?: number;         // future: bekleyen action sayısı
};
```

### Persistence

**Web**:
- Cookie name: `lf_workspace_id` (canonical §C4)
- Value: workspaceId
- Attributes: `HttpOnly=false` (client read için), `SameSite=Lax`, `Secure`, `Path=/`, `Max-Age=2592000` (30 gün)
- Server-side `requireWorkspaceContext` (07) bu cookie'yi ve `X-Workspace-Id` header'ı uzlaştırır; tutarsızlık halinde header öncelikli (08).

**Mobile**:
- Key: `lf.workspace.id` (AsyncStorage — canonical §C4)
- ApiClient init time okur → her request header'ına ekler
- Switch action sonrası AsyncStorage update + ApiClient header refresh + cache invalidation

### Cache invalidation

Switch event:
```ts
function switchWorkspace(newId: string) {
  // 1. persistence update (cookie / AsyncStorage)
  // 2. ApiClient header update
  // 3. queryClient.clear() — tüm domain query'leri invalidate
  // 4. router.replace('/dashboard') — workspace-scoped sayfaları reset
}
```

## API endpoint'leri

### Yeni

| Method | Path | Auth | Workspace ctx | Body | Response | Errors |
|---|---|---|---|---|---|---|
| GET | `/api/me/workspaces` | session | none | — | `WorkspaceSwitcherItem[]` | 401 |
| POST | `/api/me/active-workspace` | session | none | `{workspaceId}` | `{workspaceId}` + Set-Cookie | 401, 403 (not a member), 404 (workspace soft-deleted) |

`GET /api/me/workspaces` switcher dropdown açıldığında client tarafından (TanStack Query) fetch edilir. Cache: 60 sn.

### Mevcut endpoint'lere etki

- **Tüm domain endpoint'leri**: 08 ile tanımlı `X-Workspace-Id` header'ı bekler ve `requireWorkspaceContext` (07) ile doğrular.
- `/api/me` response'una `activeWorkspaceId` alanı eklenir (server-side cookie'den, fallback default workspace).

## Web

### Yeni sayfa/route

Bu feature **yeni sayfa eklemez**. Component header'a entegre olur.

### Mevcut sayfalara etki

- `apps/web/src/app/(app)/layout.tsx` → header'a `<WorkspaceSwitcher />` enjekte edilir (sol üst, logo'nun yanına).
- `apps/web/src/components/layout/AppHeader.tsx` → chip için yer açar (responsive: mobile breakpoint'te kısaltma).

### Componentler

- `WorkspaceSwitcher` (`apps/web/src/components/workspace/WorkspaceSwitcher.tsx`)
  - Renders: chip (current workspace adı + plan badge + chevron)
  - Click → açar `<WorkspaceSwitcherDropdown>`
  - Loading: skeleton chip
  - Error: "—" chip + tooltip "Couldn't load workspaces"
- `WorkspaceSwitcherDropdown` (`apps/web/src/components/workspace/WorkspaceSwitcherDropdown.tsx`)
  - List of `WorkspaceSwitcherItem`
  - Aktif item'da check ikonu
  - Search input (5+ workspace'i olan power user için)
  - Bottom: "+ Create new workspace" CTA (disabled state için tooltip)
- `WorkspacePlanBadge` (`apps/web/src/components/workspace/WorkspacePlanBadge.tsx`)
  - Renk + label: My Move (gri) / Household (mor) / Workspace (lacivert) / Pro (altın varyant)
- `WorkspaceOverflowDot` — chip'in köşesinde küçük uyarı noktası (D2 overflow durumunda) → tooltip "This workspace exceeds your plan limit"

### Görsel mockup (ASCII)

```
┌─────────────────────────────────────────────────────────────────┐
│ [Logo]  ┌───────────────────────────┐                   [User▾] │
│         │ ▣ Yılmaz Household  ⌃     │                           │
│         │   [Household]             │                           │
│         └───────────────────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
            ▼ (click)
            ┌─────────────────────────────────────────┐
            │ 🔍 Search workspaces                    │
            ├─────────────────────────────────────────┤
            │ ✓ Yılmaz Household        [Household]   │
            │     Owned by you · 4 members            │
            ├─────────────────────────────────────────┤
            │   Ali's space             [My Move]     │
            │     Owned by you · 1 member             │
            ├─────────────────────────────────────────┤
            │   Acme Properties         [Workspace]   │
            │     Owned by Mehmet · 3 members         │
            │     · OVERFLOW                          │
            ├─────────────────────────────────────────┤
            │ + Create new workspace                  │
            │   (Upgrade to Family or Pro)            │
            └─────────────────────────────────────────┘
```

### Butonlar / actionlar

- "Workspace chip" (header) → toggle dropdown.
- "Workspace row" (dropdown item) → `POST /api/me/active-workspace` → invalidation → router refresh.
- "+ Create new workspace" → Family/Pro plan'da → açar `<CreateWorkspaceModal />` (02); değilse → `/pricing?from=switcher` yönlendirme.
- "Manage members" (sağ alt, opsiyonel quick link) → `/workspace/members`.
- Keyboard: ↑↓ navigate, Enter select, Esc close, `Cmd/Ctrl+K` switcher açar (Sprint 2 stretch).

## Mobile

### Yeni ekran

Yeni full screen yok. Bottom sheet + settings satırı:
- `apps/mobile/components/workspace/WorkspaceMenuSheet.tsx` — modal sheet, dropdown'un mobile karşılığı.

### Mevcut ekranlara etki

- `apps/mobile/app/(app)/_layout.tsx` → header'a kompakt workspace chip (sadece ad + plan badge). Tap → sheet.
- `apps/mobile/app/(app)/settings/index.tsx` → "Workspace" satırı:
  ```
  ┌──────────────────────────────────────┐
  │ Workspace                            │
  │   Yılmaz Household                ›  │
  │   Household plan · 4 members         │
  └──────────────────────────────────────┘
  ```
  Tap → aynı `WorkspaceMenuSheet`.

### Componentler

- `WorkspaceMenu` (`apps/mobile/components/workspace/WorkspaceMenu.tsx`) — list of workspaces, check on active, "+ Create" disabled if not Family/Pro.
- `WorkspaceMenuSheet` (`apps/mobile/components/workspace/WorkspaceMenuSheet.tsx`) — react-native-bottom-sheet veya Expo @gorhom/bottom-sheet.
- `WorkspacePlanBadge` (mobile karşılığı) — `apps/mobile/components/workspace/WorkspacePlanBadge.tsx`.

### ApiClient integration

`packages/shared/src/api-client.ts` (mevcut):
```ts
// init
this.activeWorkspaceId = await AsyncStorage.getItem('lf.workspace.id');

// her request interceptor:
if (this.activeWorkspaceId) {
  headers['X-Workspace-Id'] = this.activeWorkspaceId;
}

// switch:
async setActiveWorkspace(id: string) {
  await AsyncStorage.setItem('lf.workspace.id', id);
  this.activeWorkspaceId = id;
  // emit event → React Query cache flush
}
```

Web ApiClient'ta (Next.js context):
- Cookie zaten request'le gelir → server-side `requireWorkspaceContext` cookie + header birleştirir.
- Client-side fetch wrapper, browser cookie zaten gönderildiği için manual header set etmek **gerekmez** (08'de "header opsiyonel, cookie default" kararı). Bazı durumlarda explicit header için yardımcı util: `withWorkspace(id, fetchOptions)`.

## Admin

N/A — admin workspace'ler arası **switch yapmaz**, inspect eder (50). Admin context'inde her API çağrısı target workspace ID'sini path'inden alır (`/admin/workspaces/:id/...`), header'dan değil.

## Görsel state'ler

### Empty state
- Kullanıcı **tek** workspace'in üyesi → chip tıklanır ama dropdown sadece o workspace'i ve "+ Create" CTA'yı gösterir. "No other workspaces" empty hint dropdown footer'ında küçük metin.

### Loading state
- İlk fetch sırasında chip yerine skeleton (animasyonlu gri kutu).
- Dropdown açıldığında veri henüz yoksa "Loading workspaces…" spinner.

### Error state
- `GET /api/me/workspaces` 500 → chip "—" placeholder + warning ikonu. Tıklayınca dropdown "Couldn't load. Retry" butonu.
- `POST /api/me/active-workspace` 4xx → toast: "Couldn't switch to <name>. <reason>". Önceki seçim korunur (optimistic update revert).
- `POST` 403 (üyelik kaldırılmış race condition) → toast + `GET /api/me/workspaces` refetch + dropdown güncelle.

### Overflow indicator
- D2 overflow workspace'inde chip'in sağ üst köşesinde küçük turuncu nokta. Dropdown satırında "OVERFLOW" pill. Detay 63'te.

### Grace period banner (cross-ref)
- Active workspace'in owner subscription'ı expire olduysa (D2 grace), chip'in altına global banner (63'te tanımlı) — switcher değil ama görsel olarak switcher'ın hemen altında yer alır.

## Güvenlik

- [x] **Step-up auth**: Workspace switch için **gerekmez**. Switch hassas bir mutation değil; her API çağrısı zaten server-side membership check'inden geçer (07).
- [x] **PII redaction**: Switcher itemslarında owner adı tam görünür sadece kullanıcı o workspace'in üyesi ise (membership check zaten gerekli). Email gösterilmez.
- [x] **Audit log**: Workspace switch **audit edilmez** (yüksek-volume, düşük-değer). API çağrılarının her biri zaten `workspaceId` ile audit ediliyor.
- [x] **Rate limit**: `POST /api/me/active-workspace` 60/dakika/user (UI spam'i engeller, gerçek kullanım için bol).
- [x] **Permission matris**: Switch eyleminin tek prerequisite'i hedef workspace'te ACTIVE member olmak. OVERFLOW status'te de switch açık (oradaki resource'lara erişiyor, sadece yeni invite/create kilitli — D2).
- [x] **Encryption at rest**: Cookie/AsyncStorage'daki workspaceId sensitive değil (zaten user'a bağlı, başkasına yarar sağlamaz). HttpOnly olmaması XSS riski getirir mi? Worst case attacker workspace değiştirir — server-side membership yine zorlanır.
- [x] **GDPR DSAR + erase**: Cookie / AsyncStorage user-controlled, DSAR kapsamı dışında. Server `activeWorkspaceId` saklamaz (sadece cookie).

## Migration / backward compat

- DB migration: yok.
- Backfill: yok. Tek workspace'i olan kullanıcılar için switcher trivial.
- Dual-read window: 09 + 10 — `X-Workspace-Id` header yokken server `userId` üzerinden default workspace'e fallback eder (2 hafta).
- Rollback: feature flag `WORKSPACE_SWITCHER_ENABLED=false` → chip render edilmez, ApiClient header gönderme atlanır, server-side cookie/header ignore edilir ve eski `userId`-bazlı resolution çalışır.

## Etkilenen mevcut özellikler

- App header (web + mobile)
- Settings sayfası (mobile)
- ApiClient (`packages/shared/src/api-client.ts`)
- TanStack Query cache invalidation orchestration (`apps/web/src/lib/queryClient.ts`)
- `requireWorkspaceContext` server helper (07) — cookie + header parse
- Pricing/upgrade page deep-link (`/pricing?from=switcher`)

## Test plan

- **Unit**:
  - Plan badge label mapping (D1: FREE_TRIAL/INDIVIDUAL → "My Move", FAMILY → "Household", PRO → "Workspace")
  - `WorkspaceSwitcher` reducer: switching, error, empty
  - Cookie serialization (web)
  - AsyncStorage read/write (mobile)
- **Integration**:
  - `GET /api/me/workspaces` returns user's memberships sorted (current first)
  - `POST /api/me/active-workspace`: success → cookie set, response 200
  - `POST` not-a-member → 403
  - `POST` soft-deleted workspace → 404
- **E2E (Playwright)**:
  - Login → header chip görünür, default workspace seçili
  - Dropdown aç → diğer workspace'leri gör → seç → URL değişir, dashboard refetch eder, yeni workspace içeriği gelir
  - Create new workspace CTA Family plan'da aktif, Free'de disabled
  - Overflow indicator turuncu nokta görünür
- **E2E (mobile, Detox veya Maestro)**:
  - Settings → Workspace satırı → sheet aç → seç → app context değişti
  - Cold start sonrası son seçili workspace persist
- **Manual QA**:
  - Switch sırasında network kes → revert + toast
  - 10+ workspace'i olan power user için search çalışıyor mu
  - Keyboard navigation (web): tab, ok tuşları, Esc, Enter
  - Screen reader: chip ve dropdown ARIA labels

## Açık sorular

- **AÇIK**: Workspace yeniden adlandırıldığında diğer üyelerin switcher'ı ne kadar süre eski adı gösterir? TanStack Query stale time'ı 60 sn → maksimum 60 sn gecikme. Real-time push (Server-Sent Events) gerekli mi? (öneri: hayır, eventual consistency yeterli)
- **AÇIK**: Switcher dropdown'da "Pending invitations" liste edilmeli mi yoksa ayrı dashboard banner mı kalır? (04'te banner, burada da listeleme kullanıcıya double-exposure olabilir; tercih: sadece banner)
- **AÇIK**: "Create new workspace" CTA Family plan'da kaç workspace'e kadar açık? (06'da tanımlanmalı: Family 1 workspace; Pro 3 workspace? Bu doc'ta varsayıyoruz ama 06 net cevap vermeli.)
- **AÇIK**: Multi-tab durumunda bir tab'de switch yapılırsa diğer tab'leri nasıl güncelleriz? (önerisi: BroadcastChannel API ile cookie change event, MVP'de "refresh required" toast yeterli olabilir)
- **AÇIK**: Mobile'da deep-link bir workspace ID'si içeriyorsa (örn. davet kabul sonrası) AsyncStorage'ı override etmeli mi yoksa kullanıcıya "Switch to <workspace>?" sormalı mı? (öneri: davet kabul sonrası otomatik switch + toast "Switched to <workspace>")
- **AÇIK**: Plan badge renkleri kesin (D1 etiketleri tanımlı, ama renk paleti design system'de henüz net değil — 67 veya ayrı design doc finalize etmeli).
